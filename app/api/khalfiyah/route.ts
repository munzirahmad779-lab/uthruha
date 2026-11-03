import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { susunKhalfiyah } from "@/lib/engine/khalfiyah-workflow";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { penggunaDariRequest } from "@/lib/server/identitas";
import { bolehLajuServer } from "@/lib/server/laju-server";
import { ambil, simpan } from "@/lib/server/store";
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

  // Pengencangan 3 Nov 2026 (S-3): proses terberat di situs ini
  // (30-60 detik, LLM + puluhan fetch luar) wajib sesi identitas,
  // dengan batas per akun dan global persisten.
  const u = await penggunaDariRequest(req);
  if (!u) {
    return NextResponse.json(
      { error: "Masuk dengan Google dulu untuk menyusun khalfiyah.", kode: "WAJIB_LOGIN" },
      { status: 401 },
    );
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

  // Tembolok per sidik judul ternormalisasi: judul yang sama (mis.
  // satu kelas memakai judul yang sama) tidak menjalankan ulang
  // proses 30-60 detik dan tidak menguras kuota.
  const idCache = `kh:${createHash("sha256")
    .update(judul.toLowerCase().replace(/\s+/g, " "))
    .digest("hex")
    .slice(0, 32)}`;
  const cache = (await ambil("tembolok", idCache).catch(() => null)) as { hasil?: unknown } | null;
  if (cache?.hasil) {
    return NextResponse.json(cache.hasil as Record<string, unknown>, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  const ip = ipKlien(req);

  const perIp = bolehLaju(`khalfiyah:ip:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(
      perIp.ulangDetik,
      `Terlalu banyak permintaan. Batas ${MAKS_PER_IP} per jam. Coba lagi dalam ${perIp.ulangDetik} detik.`,
    );
  }
  const perUser = await bolehLajuServer(`khalfiyah:user:${u.id}`, 5, JENDELA_MS);
  if (!perUser.boleh) {
    return balasanLaju(perUser.ulangDetik, "Jatah akun Anda untuk penyusunan khalfiyah tercapai. Coba lagi nanti.");
  }
  const global = await bolehLajuServer("khalfiyah:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Server sedang sibuk. Coba lagi sebentar.");
  }

  try {
    const hasil = await susunKhalfiyah(judul);
    await simpan("tembolok", { id: idCache, hasil, dibuat: new Date().toISOString() }).catch(() => undefined);
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