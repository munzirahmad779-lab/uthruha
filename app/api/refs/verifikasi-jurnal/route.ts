import { NextResponse } from "next/server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { penggunaDariRequest } from "@/lib/server/identitas";
import { bolehLajuServer } from "@/lib/server/laju-server";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";
import { getBidang } from "@/lib/content/bidang";
import {
  verifikasiKandidat,
  type KandidatVerifikasi,
} from "@/lib/server/verifikasi-rujukan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifikasi tambah jurnal (Aturan Pencarian Valid, perintah pemilik
 * 5 Nov 2026): panel topik mengirim kartu hasil pencarian jurnal ke
 * sini SEBELUM tombol Tambah boleh hidup. Server memeriksa metadata ke
 * Crossref hidup dan bidang lewat gerbang relevansi, lalu mengembalikan
 * putusan per kandidat. Hanya status "terverifikasi" yang boleh
 * ditambahkan; gagal dan belum terverifikasi tertahan tanpa kecuali
 * (blokir keras, tanpa jalur konfirmasi).
 *
 * Pagar meniru /api/refs/search: cookie gerbang (lapis kedua), asal,
 * wajib sesi identitas, batas laju per IP + per akun + global persisten.
 * Route ini TIDAK masuk JALUR_BEBAS middleware.
 */

/** 30 permintaan per menit per IP (satu permintaan memuat maks 15 kartu). */
const JENDELA_MS = 60_000;
const MAKS_PER_IP = 30;
/** Batas lidah global per menit. */
const MAKS_GLOBAL = 600;
/** Maksimal kandidat per permintaan: sama dengan tampungan panel. */
const MAKS_KANDIDAT = 15;

function teksBersih(v: unknown, maks: number): string {
  return typeof v === "string" ? v.trim().slice(0, maks) : "";
}

export async function POST(req: Request) {
  // Pertahanan lapis kedua (N-01): verifikasi cookie sesi di handler sendiri.
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;

  if (!asalSah(req)) {
    return NextResponse.json(
      { error: "Asal permintaan tidak dikenal." },
      { status: 403 },
    );
  }

  // Route ini membakar panggilan Crossref dan (lewat gerbang) kolam LLM,
  // jadi wajib sesi identitas dengan batas per akun persisten, persis
  // pagar /api/refs/search sejak pengencangan 3 Nov 2026 (S-2).
  const u = await penggunaDariRequest(req);
  if (!u) {
    return NextResponse.json(
      { error: "Masuk dengan Google dulu untuk memakai verifikasi rujukan.", kode: "WAJIB_LOGIN" },
      { status: 401 },
    );
  }

  const ip = ipKlien(req);

  const perIp = bolehLaju(`verjurnal:ip:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(
      perIp.ulangDetik,
      `Terlalu banyak permintaan. Batas ${MAKS_PER_IP} per menit. Coba lagi dalam ${perIp.ulangDetik} detik.`,
    );
  }
  const perUser = await bolehLajuServer(`verjurnal:user:${u.id}`, MAKS_PER_IP, JENDELA_MS);
  if (!perUser.boleh) {
    return balasanLaju(perUser.ulangDetik, "Jatah akun Anda untuk verifikasi ini tercapai. Coba lagi sebentar.");
  }
  const global = await bolehLajuServer("verjurnal:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Server sedang sibuk. Coba lagi sebentar.");
  }

  let body: {
    kandidat?: unknown;
    bidangId?: unknown;
    judulProyek?: unknown;
    topikAr?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Badan permintaan bukan JSON." }, { status: 400 });
  }

  const mentah = Array.isArray(body?.kandidat) ? body.kandidat : [];
  if (mentah.length === 0 || mentah.length > MAKS_KANDIDAT) {
    return NextResponse.json(
      { error: `Kirim 1-${MAKS_KANDIDAT} kandidat untuk diperiksa.` },
      { status: 400 },
    );
  }

  const kandidat: KandidatVerifikasi[] = [];
  for (const [i, m] of mentah.entries()) {
    const item = (m ?? {}) as Record<string, unknown>;
    const id = teksBersih(item.id, 80) || `kandidat-${i}`;
    const judul = teksBersih(item.judul, 600);
    if (!judul) {
      return NextResponse.json(
        { error: `Kandidat ke-${i + 1} tidak mempunyai judul; kartu tanpa judul tidak bisa diperiksa.` },
        { status: 400 },
      );
    }
    const tahunMentah = item.tahun;
    const tahun =
      typeof tahunMentah === "number" && Number.isFinite(tahunMentah)
        ? String(Math.trunc(tahunMentah))
        : teksBersih(tahunMentah, 10);
    kandidat.push({
      id,
      judul,
      doi: teksBersih(item.doi, 200) || undefined,
      jurnal: teksBersih(item.jurnal, 300) || undefined,
      tahun: tahun || undefined,
      jenis: teksBersih(item.jenis, 40) || undefined,
    });
  }

  const bidangId = teksBersih(body.bidangId, 60);
  const bidang = bidangId ? getBidang(bidangId) : null;
  const konteks = {
    bidangId,
    bidangLabel: bidang ? `${bidang.labelId} (${bidang.labelAr})` : "",
    judulProyek: teksBersih(body.judulProyek, 300),
    topik: teksBersih(body.topikAr, 300),
  };

  try {
    const hasil = await verifikasiKandidat(kandidat, konteks, u);
    return NextResponse.json({ hasil });
  } catch (e) {
    console.error("Error in verifikasi jurnal:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verifikasi gagal." },
      { status: 502 },
    );
  }
}
