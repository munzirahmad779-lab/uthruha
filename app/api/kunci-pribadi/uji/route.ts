/**
 * UJI KUNCI API PRIBADI (perbaikan P1.3, laporan perekaman tutorial
 * macro 10 Nov 2026).
 *
 * POST { penyedia: "gemini" | "groq", kunci: string } → { valid, pesan }
 *
 * Server memanggil endpoint daftar model penyedia dengan kunci yang
 * dikirim: diterima penyedia berarti kunci valid, ditolak berarti
 * tidak valid. Kunci TIDAK disimpan, TIDAK dicatat di log, dan TIDAK
 * pernah masuk respons — ia hanya hidup di permintaan ini.
 *
 * Penjaga sama dengan rute induk /api/kunci-pribadi: sesi Google yang
 * sah WAJIB (penggunaDariRequest), lalu cookie gerbang ATAU tanda
 * mahasiswa, karena mahasiswa memang harus bisa menguji kunci
 * pertamanya sebelum gerbang setor kunci di /api/masuk membukanya.
 */
import { NextResponse } from "next/server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah } from "@/lib/security/laju";
import { penggunaDariRequest } from "@/lib/server/identitas";
import { kunciPribadiSah } from "@/lib/server/kunci-pribadi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATAS_UJI_MS = 10_000;

export async function POST(req: Request) {
  const u = await penggunaDariRequest(req);
  if (!u) {
    return NextResponse.json(
      { valid: false, pesan: "Belum masuk. Masuk dulu untuk menguji kunci." },
      { status: 401 },
    );
  }
  if (!u.mahasiswa) {
    const tolak = tolakTanpaSesi(req);
    if (tolak) return tolak;
  }
  if (!asalSah(req)) {
    return NextResponse.json({ valid: false, pesan: "Asal tidak dikenal." }, { status: 403 });
  }

  let body: { penyedia?: unknown; kunci?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ valid: false, pesan: "Isi permintaan tidak sah." }, { status: 400 });
  }
  if (body.penyedia !== "gemini" && body.penyedia !== "groq") {
    return NextResponse.json({ valid: false, pesan: "Penyedia tidak dikenal." }, { status: 400 });
  }
  // Aturan format lama yang sama dengan penyimpanan: 20–200 karakter,
  // tanpa spasi. Di luar itu uji bahkan tidak berangkat ke penyedia.
  if (!kunciPribadiSah(body.kunci)) {
    return NextResponse.json({
      valid: false,
      pesan: "Kunci tidak sah bentuknya (20–200 karakter, tanpa spasi). Periksa salinan kunci Anda.",
    });
  }
  const penyedia = body.penyedia;
  const kunci = body.kunci;
  const nama = penyedia === "gemini" ? "Gemini" : "Groq";

  try {
    const res =
      penyedia === "gemini"
        ? await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
            headers: { "x-goog-api-key": kunci },
            signal: AbortSignal.timeout(BATAS_UJI_MS),
          })
        : await fetch("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${kunci}` },
            signal: AbortSignal.timeout(BATAS_UJI_MS),
          });
    if (res.ok) {
      return NextResponse.json({
        valid: true,
        pesan: `Kunci valid: ${nama} menerima kunci ini.`,
      });
    }
    return NextResponse.json({
      valid: false,
      pesan: `Kunci tidak valid: ${nama} menolak kunci ini (HTTP ${res.status}). Periksa kembali kunci dari situs penyedianya.`,
    });
  } catch {
    return NextResponse.json({
      valid: false,
      pesan: `Uji tidak selesai: ${nama} tidak menjawab dalam 10 detik. Coba lagi sebentar.`,
    });
  }
}
