// app/api/kata-kunci/route.ts
// Ekstraksi kata kunci pencarian referensi Uthruha.
// Arsitektur (Evaluasi Fase 1, Addendum 3):
//   Browser -> route handler ini (server-side, key TIDAK terekspos ke browser)
//     -> Provider 1: Groq (model Qwen, gratis, cepat)
//     -> Provider 2: Cloudflare Workers AI (gratis 10.000 Neuron/hari)
//     -> Fallback: tanpa AI (teks user dipakai apa adanya sebagai query)
// Model HANYA mengekstrak kata kunci. Ia tidak boleh mengarang referensi/DOI.
//
// PENTING:
// - Route ini JANGAN ditambahkan ke JALUR_BEBAS di middleware.ts.
//   Ia harus melewati auth yang sama seperti route workspace lain,
//   supaya key gratis tidak bisa disedot publik tanpa login.
// - Semua key dibaca dari environment variable server (Vercel / .env.local),
//   tidak pernah dari request body dan tidak pernah dikirim ke client.

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  PROMPT_KALIMAT,
  PROMPT_KATA,
  kalimatTanpaAI,
  kataTanpaAI,
  parseKalimat,
  parseKata,
} from "@/lib/engine/kata-kunci-server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { penggunaDariRequest, tierEfektif } from "@/lib/server/identitas";
import { bolehLajuServer } from "@/lib/server/laju-server";
import { ambil, simpan } from "@/lib/server/store";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

type KataKunci = { arab: string[]; indonesia: string[]; inggris: string[] };

const SYSTEM_PROMPT = `Anda adalah pengekstrak KALIMAT KUNCI (frasa kunci pencarian) untuk literatur akademik.
Tugas Anda HANYA menyusun kalimat kunci dari topik/rumusan masalah pengguna.
Aturan:
- Keluarkan HANYA JSON valid, tanpa penjelasan, tanpa markdown:
  {"arab":["..."],"indonesia":["..."],"inggris":["..."]}
- Masing-masing 3-5 KALIMAT KUNCI. Kalimat kunci adalah frasa utuh 3-7 kata yang cukup khas untuk dicari persis — BUKAN kata tunggal dan BUKAN daftar kata kunci lepas. Kata kunci lepas menghasilkan pencarian yang terlalu umum.
- "arab": kalimat kunci dalam HURUF ARAB (bukan transliterasi Latin), istilah/ungkapan akademik Arab untuk konsep yang sama — cukup panjang untuk menjadi frasa pencarian di kitab/jurnal Arab.
- "indonesia": kalimat kunci dalam Bahasa Indonesia.
- "inggris": padanan akademik frasa tersebut dalam Bahasa Inggris (untuk CrossRef).
- Jangan mengarang nama penulis, judul, tahun, atau DOI. Hanya kalimat kunci dari teks pengguna.`;

function parseKataKunci(raw: string): KataKunci | null {
  try {
    const bersih = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(bersih.slice(bersih.indexOf("{"), bersih.lastIndexOf("}") + 1));
    const arr = (v: unknown) =>
      Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : [];
    const hasil = { arab: arr(json.arab), indonesia: arr(json.indonesia), inggris: arr(json.inggris) };
    return hasil.arab.length || hasil.indonesia.length || hasil.inggris.length ? hasil : null;
  } catch {
    return null;
  }
}

async function panggilOpenAICompatible(opts: {
  baseURL: string;
  apiKey: string;
  model: string;
  teks: string;
}): Promise<KataKunci | null> {
  const res = await fetch(`${opts.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.1,
      max_tokens: 250,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: opts.teks },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null; // 429 / 5xx -> provider berikutnya
  const data = await res.json();
  const isi: string | undefined = data?.choices?.[0]?.message?.content;
  return isi ? parseKataKunci(isi) : null;
}

/** Panggil provider LLM berurutan (Groq → Cloudflare); kembalikan teks mentah. */
async function panggilLLMMentah(system: string, user: string, maksToken: number, premium = false): Promise<{ sumber: string; isi: string } | null> {
  // Fase 3 (H): jalur utama kini KOLAM KUNCI (Gemini → Groq → Cloudflare →
  // slot DeepSeek/Meta) dengan rotasi + cooldown per kunci. Rantai lama di
  // bawah dipertahankan sebagai cadangan bila kolam belum terkonfigurasi.
  try {
    const { panggilKolam } = await import("@/lib/server/kolam");
    const hasil = await panggilKolam({ sistem: system, pengguna: user, maksToken, json: true, premium });
    if (hasil.teks) return { sumber: `kolam:${hasil.penyedia}`, isi: hasil.teks };
  } catch {
    /* kolam kosong/gagal — jatuh ke rantai lama */
  }
  const penyedia: Array<{ sumber: string; baseURL: string; apiKey: string; model: string }> = [];
  if (process.env.GROQ_API_KEY) {
    penyedia.push({
      sumber: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b",
    });
  }
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    penyedia.push({
      sumber: "cloudflare",
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
      apiKey: process.env.CLOUDFLARE_API_TOKEN,
      model: process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct",
    });
  }
  for (const s of penyedia) {
    try {
      const res = await fetch(`${s.baseURL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: s.model,
          temperature: 0.2,
          max_tokens: maksToken,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const isi: string | undefined = data?.choices?.[0]?.message?.content;
      if (isi) return { sumber: s.sumber, isi };
    } catch {
      /* provider berikutnya */
    }
  }
  return null;
}

// Rate limit memakai pola aman bersama lib/security/laju.ts (N-02, audit
// menyeluruh 27 Okt): IP dari ipKlien() — BUKAN x-forwarded-for elemen
// pertama yang bisa ditulis bebas oleh klien — plus pemeriksaan Origin.
// Sejak pengencangan 3 Nov 2026: batas per akun dan batas global memakai
// penghitung persisten lib/server/laju-server.ts (berlaku lintas
// instance), dan rute ini wajib sesi identitas (lihat POST).
const JENDELA_MS = 60_000;
const MAKS_PER_IP = 10; // maks 10 request / menit / IP (sama seperti sebelumnya)
const MAKS_GLOBAL = 300; // batas lidah global per menit

export async function POST(req: NextRequest) {
  // Pertahanan lapis kedua (N-01): verifikasi cookie sesi di handler
  // sendiri, tidak hanya mengandalkan middleware.
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;

  if (!asalSah(req)) {
    return NextResponse.json({ error: "Asal permintaan tidak dikenal." }, { status: 403 });
  }

  // Pengencangan 3 Nov 2026 (T-1): rute ini membakar kolam LLM, jadi
  // wajib sesi identitas Google. Cookie gerbang dari kunci bersama
  // saja tidak cukup lagi, agar kuota tidak bisa dikuras tanpa akun.
  const penggunaSesi = await penggunaDariRequest(req);
  if (!penggunaSesi) {
    return NextResponse.json(
      { error: "Masuk dengan Google dulu untuk memakai fitur ini.", kode: "WAJIB_LOGIN" },
      { status: 401 },
    );
  }
  // Pemanggil Premium memakai kolam khusus premium lebih dulu.
  const premium = tierEfektif(penggunaSesi) === "premium";

  const body = await req.json().catch(() => null);
  const teks = typeof body?.teks === "string" ? body.teks.trim().slice(0, 2000) : "";
  if (teks.length < 10) {
    return NextResponse.json({ error: "Teks terlalu pendek untuk diekstrak kata kuncinya." }, { status: 400 });
  }

  // Tembolok hasil: masukan yang sama (per lapis) tidak membakar LLM
  // dua kali. Yang disimpan hanya keluaran AI, bukan fallback lokal.
  const tahapKunci = typeof body?.tahap === "string" ? body.tahap : "";
  const judulKunci = tahapKunci === "kalimat" && typeof body?.judul === "string" ? body.judul.trim().slice(0, 300) : "";
  const kataKunciKunci: string[] =
    tahapKunci === "kalimat" && Array.isArray(body?.kata)
      ? body.kata.filter((x: unknown) => typeof x === "string").slice(0, 12)
      : [];
  const idCache = `kk:${createHash("sha256")
    .update([tahapKunci || "utama", premium ? "premium" : "gratis", teks, judulKunci, kataKunciKunci.join("، ")].join("|"))
    .digest("hex")
    .slice(0, 32)}`;
  const cache = (await ambil("tembolok", idCache).catch(() => null)) as { hasil?: Record<string, unknown> } | null;
  if (cache?.hasil) return NextResponse.json({ ...cache.hasil, dariTembolok: true });

  const ip = ipKlien(req);
  const perIp = bolehLaju(`kata-kunci:ip:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(
      perIp.ulangDetik,
      `Terlalu banyak permintaan. Coba lagi dalam ${perIp.ulangDetik} detik.`,
    );
  }
  const perUser = await bolehLajuServer(`kata-kunci:user:${penggunaSesi.id}`, 20, JENDELA_MS);
  if (!perUser.boleh) {
    return balasanLaju(perUser.ulangDetik, "Jatah akun Anda untuk fitur ini tercapai. Coba lagi sebentar.");
  }
  const global = await bolehLajuServer("kata-kunci:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Server sedang sibuk. Coba lagi sebentar.");
  }

  const keluaran = await (async (): Promise<{ json: Record<string, unknown>; ai: boolean }> => {
  // ── Tahap kurasi v2 ──────────────────────────────────────────────────────
  const tahap = typeof body?.tahap === "string" ? body.tahap : "";
  if (tahap === "kata") {
    const mentah = await panggilLLMMentah(PROMPT_KATA, teks, 500, premium);
    const kata = mentah ? parseKata(mentah.isi) : null;
    if (kata) return { json: { sumber: mentah!.sumber, kata }, ai: true };
    return {
      json: {
        sumber: "tanpa-ai",
        kata: kataTanpaAI(teks),
        catatan: "Provider AI tidak tersedia — kata kunci disaring dari teks Anda sendiri; periksa dan edit sebelum menyusun kalimat.",
      },
      ai: false,
    };
  }
  if (tahap === "kalimat") {
    const judul = typeof body?.judul === "string" ? body.judul.trim().slice(0, 300) : teks;
    const kataPilihan: string[] = Array.isArray(body?.kata)
      ? body.kata.filter((x: unknown) => typeof x === "string").slice(0, 12)
      : [];
    const user = `JUDUL: ${judul}\nKATA KUNCI TERPILIH: ${kataPilihan.join("، ") || "(belum ada — ambil dari judul)"}`;
    const mentah = await panggilLLMMentah(PROMPT_KALIMAT, user, 800, premium);
    const kalimat = mentah ? parseKalimat(mentah.isi) : null;
    if (kalimat) return { json: { sumber: mentah!.sumber, kalimat }, ai: true };
    return {
      json: {
        sumber: "tanpa-ai",
        kalimat: kalimatTanpaAI(judul, kataPilihan),
        catatan: "Provider AI tidak tersedia — kalimat berupa templat per peran; edit sebelum mencari.",
      },
      ai: false,
    };
  }

  // Provider 1 — Groq (Qwen). Key: GROQ_API_KEY (console.groq.com, gratis, tanpa kartu).
  if (process.env.GROQ_API_KEY) {
    const hasil = await panggilOpenAICompatible({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b",
      teks,
    }).catch(() => null);
    if (hasil) return { json: { sumber: "groq", ...hasil }, ai: true };
  }

  // Provider 2 — Cloudflare Workers AI. Key: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    const hasil = await panggilOpenAICompatible({
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
      apiKey: process.env.CLOUDFLARE_API_TOKEN,
      // Model default terverifikasi di katalog; ganti lewat env bila dashboard
      // menampilkan model Qwen instruct yang lebih baru untuk akun Anda.
      model: process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct",
      teks,
    }).catch(() => null);
    if (hasil) return { json: { sumber: "cloudflare", ...hasil }, ai: true };
  }

  // Fallback tanpa AI — pencarian CrossRef tetap jalan dengan teks apa adanya.
  return {
    json: {
      sumber: "tanpa-ai",
      arab: [],
      indonesia: [teks.slice(0, 120)],
      inggris: [],
      catatan: "Provider AI tidak tersedia/kuota habis. Query memakai teks asli pengguna.",
    },
    ai: false,
  };
  })();

  if (keluaran.ai) {
    await simpan("tembolok", { id: idCache, hasil: keluaran.json, dibuat: new Date().toISOString() }).catch(
      () => undefined,
    );
  }
  return NextResponse.json(keluaran.json);
}
