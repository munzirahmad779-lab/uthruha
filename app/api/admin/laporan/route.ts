import { NextResponse } from "next/server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { apakahAdmin } from "@/lib/server/admin";
import { penggunaDariRequest, tierEfektif, type Pengguna } from "@/lib/server/identitas";
import { statusEmail } from "@/lib/server/email";
import { statusKunciPribadi } from "@/lib/server/kunci-pribadi";
import { statusKolam } from "@/lib/server/kolam";
import { semua, type Rekam } from "@/lib/server/store";

export const runtime = "nodejs";

/**
 * LAPORAN SUPER ADMIN (perintah pemilik, 3 Nov 2026): satu sumber angka
 * resmi layanan untuk halaman /admin. Hanya sesi Google pemilik (daftar
 * email admin di lib/server/admin.ts) yang boleh membaca; selain itu 401
 * (belum masuk) atau 403 (bukan admin). Angka uji coba dihitung dari
 * catatan server persisten (perangkat, ipUji, sesiUji), bukan perkiraan.
 */

const teks = (v: unknown, maks = 300): string => (typeof v === "string" ? v.slice(0, maks) : "");
const angka = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const urutBaru = (a: Rekam, b: Rekam) => (teks(b.dibuat) < teks(a.dibuat) ? -1 : 1);

export async function GET(req: Request) {
  // Pengencangan 3 Nov 2026 (S-7): lapis kedua cookie gerbang di
  // handler, pola yang sama seperti rute LLM.
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  if (!apakahAdmin(u)) return NextResponse.json({ error: "Halaman ini khusus pemilik layanan." }, { status: 403 });

  const [perangkat, ipUji, sesiUji, pengguna, proyek, pembayaran, insiden, kolam] = await Promise.all([
    semua("perangkat"),
    semua("ipUji"),
    semua("sesiUji"),
    semua("pengguna"),
    semua("proyek"),
    semua("pembayaran"),
    semua("insiden"),
    statusKolam().catch(() => []),
  ]);

  const penggunaTyped = pengguna as unknown as Pengguna[];
  const premiumAktif = penggunaTyped.filter((x) => tierEfektif(x) === "premium").length;

  // Daftar pengguna terbaru + status kunci pribadi (BYOK): pemilik perlu
  // melihat mahasiswa mana yang sudah mengisi kunci API-nya sendiri.
  const penggunaTerbaru = await Promise.all(
    [...pengguna].sort(urutBaru).slice(0, 25).map(async (x) => {
      const st = await statusKunciPribadi(teks(x.id, 120)).catch(() => null);
      return {
        id: teks(x.id, 120),
        nama: teks(x.nama, 80),
        email: teks(x.email, 120),
        tier: tierEfektif(x as unknown as Pengguna),
        premiumSampai: teks((x as { premiumSampai?: unknown }).premiumSampai, 40),
        nonaktif: (x as { nonaktif?: unknown }).nonaktif === true,
        mahasiswa: (x as { mahasiswa?: unknown }).mahasiswa === true,
        akunUji: (x as { personaUji?: unknown }).personaUji === true,
        kunciGemini: st?.gemini.ada ?? false,
        kunciGroq: st?.groq.ada ?? false,
        jumlahPerangkat: Array.isArray((x as { perangkatAkun?: unknown }).perangkatAkun)
          ? ((x as { perangkatAkun?: unknown }).perangkatAkun as unknown[]).length
          : 0,
        perangkatDaftar: (Array.isArray((x as { perangkatAkun?: unknown }).perangkatAkun)
          ? ((x as { perangkatAkun?: unknown }).perangkatAkun as { sidik?: unknown; pertama?: unknown; terakhir?: unknown; label?: unknown }[])
          : []
        ).map((d) => ({
          sidik: teks(d.sidik, 8),
          label: teks(d.label, 60) || "Perangkat tidak dikenal",
          pertama: teks(d.pertama, 40),
          terakhir: teks(d.terakhir, 40),
        })),
        dibuat: teks(x.dibuat, 40),
        loginTerakhir: teks(x.loginTerakhir, 40),
      };
    }),
  );

  const statusBayar: Record<string, number> = {};
  for (const b of pembayaran) {
    const s = teks(b.statusInternal, 60) || "tidak dikenal";
    statusBayar[s] = (statusBayar[s] ?? 0) + 1;
  }

  return NextResponse.json({
    dibuat: new Date().toISOString(),
    email: statusEmail(),
    admin: u.email,
    ujiCoba: {
      jumlahPerangkat: perangkat.length,
      jumlahIpUnik: ipUji.length,
      jumlahSesi: sesiUji.length,
      totalPercobaanIp: ipUji.reduce((a, r) => a + angka(r.percobaan), 0),
      totalDitolak: ipUji.reduce((a, r) => a + angka(r.ditolak), 0),
      sesiTerbaru: [...sesiUji].sort(urutBaru).slice(0, 25).map((s) => ({
        judul: teks(s.judul),
        pedoman: teks(s.pedoman, 40) || "umum",
        perangkatId: teks(s.perangkatId, 40),
        ip: teks(s.ipSidik, 8),
        dibuat: teks(s.dibuat, 40),
        dikembangkan: s.dikembangkan === true,
      })),
      ipTeratas: [...ipUji]
        .sort((a, b) => angka(b.percobaan) - angka(a.percobaan))
        .slice(0, 10)
        .map((r) => ({
          ip: teks(r.id, 8),
          percobaan: angka(r.percobaan),
          ditolak: angka(r.ditolak),
          terakhir: teks(r.terakhir, 40),
        })),
    },
    pengguna: {
      total: pengguna.length,
      premiumAktif,
      gratis: pengguna.length - premiumAktif,
      nonaktif: penggunaTyped.filter((x) => x.nonaktif).length,
      terbaru: penggunaTerbaru,
    },
    proyekServer: {
      total: proyek.length,
      terbaru: [...proyek].sort(urutBaru).slice(0, 15).map((x) => ({
        judul: teks(x.judul),
        kategoriId: teks(x.kategoriId, 80),
        totalFootnote: angka(x.totalFootnote),
        dibuat: teks(x.dibuat, 40),
      })),
    },
    pembayaran: {
      total: pembayaran.length,
      perStatus: statusBayar,
      terbaru: [...pembayaran].sort(urutBaru).slice(0, 10).map((x) => ({
        id: teks(x.id, 60),
        email: teks(x.email, 120),
        jumlah: angka(x.jumlah),
        status: teks(x.statusInternal, 60),
        dibuat: teks(x.dibuat, 40),
      })),
    },
    insiden: {
      total: insiden.length,
      terbuka: insiden.filter((x) => teks(x.status, 40) === "terbuka").length,
      terbaru: [...insiden].sort(urutBaru).slice(0, 15).map((x) => ({
        email: teks(x.email, 120),
        pesan: teks(x.pesan, 240),
        status: teks(x.status, 40),
        dibuat: teks(x.dibuat, 40),
        tenggat: teks(x.tenggat, 40),
      })),
    },
    kolam,
  });
}
