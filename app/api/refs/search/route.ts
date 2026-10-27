import { NextResponse } from "next/server";
import { cariRujukan, kemampuanSumber } from "@/lib/refs";
import { statusPenyedia } from "@/lib/refs/llm/penyedia";
import { BATAS, type SearchRequest, type SourceId } from "@/lib/refs/types";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 30 permintaan per menit per IP. */
const JENDELA_MS = 60_000;
const MAKS_PER_IP = 30;
/** Batas lidah global per menit. */
const MAKS_GLOBAL = 600;

/** Kemampuan sumber apa adanya - dipakai UI untuk menjelaskan mode. */
export async function GET() {
  return NextResponse.json({
    sumber: kemampuanSumber(),
    batas: BATAS,
    llm: statusPenyedia(),
    catatan: [
      "Turath memakai endpoint terbuka api.turath.io (tanpa key).",
      "Shamela, Ketabonline, Usul hanya mencari otomatis bila endpoint resmi diisi lewat environment variable.",
      "Waqfeya hanya dipakai untuk verifikasi halaman cetak, tidak memberi skor.",
      "LLM (bila siap) hanya menyusun istilah pencarian. Nama kitab, jilid, dan halaman selalu dari Turath.",
    ],
  });
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

  const ip = ipKlien(req);

  const perIp = bolehLaju(`refs:ip:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(
      perIp.ulangDetik,
      `Terlalu banyak permintaan. Batas ${MAKS_PER_IP} per menit. Coba lagi dalam ${perIp.ulangDetik} detik.`,
    );
  }
  const global = bolehLaju("refs:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Server sedang sibuk. Coba lagi sebentar.");
  }

  let body: SearchRequest;
  try {
    body = (await req.json()) as SearchRequest;
  } catch {
    return NextResponse.json({ error: "Badan permintaan bukan JSON." }, { status: 400 });
  }

  const kalimat = Array.isArray(body?.sentences) ? body.sentences : [];
  if (kalimat.length === 0 || kalimat.length > BATAS.maksKalimat) {
    return NextResponse.json(
      { error: `Kirim 1-${BATAS.maksKalimat} kalimat.` },
      { status: 400 },
    );
  }
  if (kalimat.some((s) => typeof s !== "string" || s.length > BATAS.maksPanjangKalimat)) {
    return NextResponse.json(
      { error: `Tiap kalimat maksimal ${BATAS.maksPanjangKalimat} karakter.` },
      { status: 400 },
    );
  }

  // Key hanya diteruskan bila dikirim klien (sessionStorage), tidak disimpan.
  const kunci: Partial<Record<SourceId, string>> = {};
  if (body.kunci && typeof body.kunci === "object") {
    for (const id of ["turath", "shamela", "ketabonline", "usul"] as const) {
      const v = body.kunci[id];
      if (typeof v === "string" && v.trim() && v.length < 200) kunci[id] = v.trim();
    }
  }

  try {
    const mode = body.mode === "konsep" ? "konsep" : "kata";
    const penyediaLLM = Array.isArray(body.penyediaLLM)
      ? body.penyediaLLM.filter((p): p is string => typeof p === "string").slice(0, 9)
      : undefined;
    const hasil = await cariRujukan({
      sentences: kalimat,
      sources: body.sources,
      kunci,
      mode,
      tanpaLLM: body.tanpaLLM === true,
      penyediaLLM,
      kunciLLM: typeof body.kunciLLM === "string" ? body.kunciLLM.trim() : undefined,
      konsepKustom: Array.isArray(body.konsepKustom)
        ? body.konsepKustom.filter((s) => typeof s === "string" && s.trim())
        : undefined,
    });
    return NextResponse.json(hasil);
  } catch (e) {
    console.error("Error in refs search:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pencarian gagal." },
      { status: 502 },
    );
  }
}