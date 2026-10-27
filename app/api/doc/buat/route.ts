import { NextResponse } from "next/server";
import { buatDocProyek } from "@/lib/server/doc";
import { penggunaDariRequest, tierEfektif } from "@/lib/server/identitas";
import { proyekPengguna } from "@/lib/server/lapis";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

/**
 * Buat Google Doc proyek (Premium saja). Token Drive datang dari klien
 * setelah persetujuan bertahap (drive.file) — server tidak menyimpannya.
 * Naik Premium membuka fitur ini juga untuk proyek yang dibuat saat gratis.
 */
export async function POST(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const laju = bolehLaju(`doc-buat:${ipKlien(req)}`, 6, 60_000);
  if (!laju.boleh) return balasanLaju(laju.ulangDetik, "Terlalu sering membuat dokumen.");

  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Masuk dengan Google dulu.", kode: "WAJIB_LOGIN" }, { status: 401 });
  if (tierEfektif(u) !== "premium") {
    return NextResponse.json(
      { error: "Google Doc per proyek adalah fitur Premium.", kode: "PREMIUM" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    proyekId?: string;
    judulProyek?: string;
    driveToken?: string;
    bagian?: { judul: string; teks: string }[];
  } | null;
  if (!body?.driveToken) {
    return NextResponse.json(
      { error: "Token Drive belum ada. Setujui akses Drive (hanya berkas buatan Uthruha) pada langkah persetujuan yang muncul.", kode: "PERLU_DRIVE" },
      { status: 400 },
    );
  }
  const judul = body.judulProyek?.trim().slice(0, 200) || "Proyek Uthruha";
  const bagian = (body.bagian ?? [])
    .filter((b) => typeof b?.judul === "string" && typeof b?.teks === "string")
    .slice(0, 40)
    .map((b) => ({ judul: b.judul.slice(0, 200), teks: b.teks.slice(0, 60_000) }));

  // Proyek lama dari masa gratis tetap sah dipakai begitu akun Premium.
  if (body.proyekId) {
    const milik = await proyekPengguna(u.id);
    if (milik.length > 0 && !milik.some((p) => p.id === body.proyekId)) {
      // Bukan penolakan keras: proyek lokal lama mungkin belum tercatat —
      // tetap izinkan pembuatan Doc, dicatat di log server.
      console.warn("[doc/buat] proyekId tidak tercatat di server:", body.proyekId);
    }
  }

  try {
    const hasil = await buatDocProyek({ driveToken: body.driveToken, judulProyek: judul, bagian });
    return NextResponse.json(hasil);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membuat dokumen." },
      { status: 502 },
    );
  }
}
