import { NextResponse } from "next/server";
import { sisipkanRujukan } from "@/lib/server/bm25";
import type { RujukanTamu } from "@/lib/server/rujukan";
import { ambil, simpan } from "@/lib/server/store";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

/**
 * Tombol "kembangkan" uji coba tamu: sisipkan rujukan ke kalimat yang
 * paling cocok dengan pencocokan BM25 — TANPA panggilan AI sama sekali.
 */
export async function POST(req: Request) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const laju = bolehLaju(`uji-kembang:${ipKlien(req)}`, 10, 3_600_000);
  if (!laju.boleh) return balasanLaju(laju.ulangDetik, "Terlalu sering. Coba lagi nanti.");

  const body = (await req.json().catch(() => null)) as { sesiId?: string } | null;
  if (!body?.sesiId) return NextResponse.json({ error: "sesiId wajib." }, { status: 400 });

  const sesi = await ambil("sesiUji", body.sesiId);
  if (!sesi) return NextResponse.json({ error: "Sesi uji coba tidak ditemukan/kedaluwarsa." }, { status: 404 });

  if (sesi.dikembangkan && Array.isArray(sesi.paragrafKembang)) {
    return NextResponse.json({ paragraf: sesi.paragrafKembang, lampiran: sesi.lampiran ?? [] });
  }

  const generasi = sesi.generasi as { khalfiyah: string[] } | undefined;
  const refs = (sesi.refs as unknown as RujukanTamu[]) ?? [];
  if (!generasi?.khalfiyah?.length) return NextResponse.json({ error: "Sesi tidak lengkap." }, { status: 422 });

  const { paragrafBaru, lampiran } = sisipkanRujukan(
    generasi.khalfiyah,
    refs.map((r) => ({ id: r.id, teksPadanan: `${r.judul} ${r.penulis.join(" ")} ${r.wadah}` })),
  );

  await simpan("sesiUji", { ...sesi, dikembangkan: true, paragrafKembang: paragrafBaru, lampiran });
  return NextResponse.json({ paragraf: paragrafBaru, lampiran });
}
