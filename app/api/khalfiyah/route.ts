import { NextResponse } from "next/server";
import { susunKhalfiyah } from "@/lib/engine/khalfiyah-workflow";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 10 permintaan per jam per IP — proses ini memanggil banyak API luar. */
const JENDELA_MS = 60 * 60 * 1000;
const MAKS_PER_IP = 10;
/** Batas lidah global agar pemutaran header IP tidak membuka keran. */
const MAKS_GLOBAL = 200;

/**
 * GET: keterangan endpoint. Tidak menjalankan pekerjaan berat.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/khalfiyah",
    deskripsi:
      "Penyusunan Khalfiyah Al-Bahts berbasis Tri-Fokus Judul & Referensi Berlapis",
    metode: "POST",
    input: { judul: "string (wajib) - judul penelitian" },
    output: {
      judul: "string",
      klaster: "3 klaster kunci dari judul",
      artikel: "artikel jurnal per klaster",
      maraji: "rujukan kitab klasik",
      paragraf: "struktur paragraf khalfiyah",
      narasiLengkap: "teks khalfiyah siap pakai",
      researchGap: "argumen alasan memilih judul",
    },
    catatan: [
      "Proses 30-60 detik karena memanggil Crossref, OpenAlex, Turath, dan Shamela.",
      "Batas 10 permintaan per jam per IP.",
      "Hasil deterministik: judul yang sama menghasilkan keluaran yang sama.",
    ],
  });
}

/**
 * POST: susun khalfiyah dari judul.
 */
export async function POST(req: Request) {
  // Pertahanan lapis kedua (N-01): verifikasi cookie sesi di handler sendiri.
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;

  // Tolak permintaan tulis dari situs lain (CSRF sederhana).
  if (!asalSah(req)) {
    return NextResponse.json(
      { error: "Asal permintaan tidak dikenal." },
      { status: 403 },
    );
  }

  const ip = ipKlien(req);

  const perIp = bolehLaju(`khalfiyah:ip:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(
      perIp.ulangDetik,
      `Terlalu banyak permintaan. Batas ${MAKS_PER_IP} per jam. Coba lagi dalam ${perIp.ulangDetik} detik.`,
    );
  }
  const global = bolehLaju("khalfiyah:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Server sedang sibuk. Coba lagi sebentar.");
  }

  let body: { judul?: unknown };
  try {
    body = (await req.json()) as { judul?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Badan permintaan harus JSON dengan field 'judul'." },
      { status: 400 },
    );
  }

  const judul = typeof body.judul === "string" ? body.judul.trim() : "";
  if (!judul) {
    return NextResponse.json(
      { error: "Field 'judul' wajib diisi dan tidak boleh kosong." },
      { status: 400 },
    );
  }
  if (judul.length < 10) {
    return NextResponse.json(
      { error: "Judul terlalu pendek. Minimal 10 karakter." },
      { status: 400 },
    );
  }
  if (judul.length > 300) {
    return NextResponse.json(
      { error: "Judul terlalu panjang. Maksimal 300 karakter." },
      { status: 400 },
    );
  }

  try {
    const hasil = await susunKhalfiyah(judul);
    return NextResponse.json(hasil, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch (error) {
    // Jangan bocorkan jejak tumpukan ke klien.
    console.error("Error in khalfiyah workflow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyusun khalfiyah. Silakan coba lagi.",
      },
      { status: 500 },
    );
  }
}