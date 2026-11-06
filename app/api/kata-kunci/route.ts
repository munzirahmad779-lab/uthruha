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
  PROMPT_KATA,
  PROMPT_PENCARIAN,
  kataTanpaAI,
  parseKata,
} from "@/lib/engine/kata-kunci-server";
import {
  kamusAmbiguitasUntuk,
  validasiKeluaranPencarian,
  type KeluaranPencarian,
  type PerluasanKueriSkema,
} from "@/lib/engine/skema-pencarian";
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
    // Pengerasan G2: keluaran yang membawa field bibliografis atau
    // pola DOI bukan ekstraksi kata kunci yang sah.
    const FIELD = ["judul", "doi", "penulis", "kandidat", "referensi", "tahun", "jurnal", "penerbit"];
    if (Object.keys(json as Record<string, unknown>).some((k) => FIELD.includes(k))) return null;
    const arr = (v: unknown) =>
      Array.isArray(v)
        ? v.filter((x) => typeof x === "string" && !/10\.\d{4,9}\/\S+|doi\.org\//i.test(x)).slice(0, 5)
        : [];
    const hasil = { arab: arr(json.arab), indonesia: arr(json.indonesia), inggris: arr(json.inggris) };
    return hasil.arab.length || hasil.indonesia.length || hasil.inggris.length ? hasil : null;
  } catch {
    return null;
  }
}

/** Parse JSON longgar dari teks model (buang pagar kode, ambil objek
 *  terluar). null bila tidak terbaca — validator skema yang menolak. */
function parseJsonLonggar(raw: string): unknown {
  try {
    const bersih = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(bersih.slice(bersih.indexOf("{"), bersih.lastIndexOf("}") + 1));
  } catch {
    return null;
  }
}

/**
 * Petakan keluaran skema "siap" menjadi 3 kalimat kunci panel
 * (Tahap G2): perluasan berbahasa Arab (inti lebih dulu) menjadi
 * teks kalimat; perluasan Bahasa Indonesia seurutan menjadi
 * padanannya; alasan ditulis dari struktur skemanya sendiri
 * (jenis perluasan + sumber target + kata kunci inti), bukan
 * karangan. Peran taswir/aqwal/tarjih diberikan berurutan seperti
 * perilaku panel selama ini.
 */
function petakanKalimatDariSkema(n: KeluaranPencarian) {
  const URUT_JENIS: Record<PerluasanKueriSkema["jenis"], number> = {
    inti: 0,
    sinonim: 1,
    terkait: 2,
    lebih_sempit: 3,
    lebih_luas: 4,
  };
  const LABEL_JENIS: Record<PerluasanKueriSkema["jenis"], string> = {
    inti: "inti",
    sinonim: "sinonim",
    lebih_luas: "lebih luas",
    lebih_sempit: "lebih sempit",
    terkait: "terkait",
  };
  const peranUrut = ["taswir", "aqwal", "tarjih"];
  const arab = n.perluasan_kueri
    .filter((q) => q.bahasa === "ar")
    .sort((a, b) => URUT_JENIS[a.jenis] - URUT_JENIS[b.jenis]);
  const indo = n.perluasan_kueri
    .filter((q) => q.bahasa === "id")
    .sort((a, b) => URUT_JENIS[a.jenis] - URUT_JENIS[b.jenis]);
  const lain = n.perluasan_kueri.filter((q) => q.bahasa !== "ar" && q.bahasa !== "id");
  const intiTampil = n.kata_kunci_inti.slice(0, 3).map((k) => k.istilah).join("، ");
  return [...arab, ...lain].slice(0, 3).map((q, i) => ({
    teks: q.teks,
    arti: indo[i]?.teks ?? "",
    alasan: `Perluasan kueri ${LABEL_JENIS[q.jenis]} dari skema pencarian (sumber target: ${q.sumber_target.join(", ")}). Kata kunci inti: ${intiTampil}.`,
    peran: peranUrut[i] ?? "taswir",
  }));
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
async function panggilLLMMentah(
  system: string,
  user: string,
  maksToken: number,
  premium = false,
  kolam?: {
    pribadi?: { userId: string; gemini?: string; groq?: string };
    wajibPribadi?: boolean;
    pinjaman?: { userId: string; gemini?: string; groq?: string }[];
  },
): Promise<{ sumber: string; isi: string } | null> {
  // Fase 3 (H): jalur utama kini KOLAM KUNCI (Gemini → Groq → Cloudflare →
  // slot DeepSeek/Meta) dengan rotasi + cooldown per kunci. Rantai lama di
  // bawah dipertahankan sebagai cadangan bila kolam belum terkonfigurasi.
  try {
    const { panggilKolam } = await import("@/lib/server/kolam");
    const hasil = await panggilKolam({
      sistem: system,
      pengguna: user,
      maksToken,
      json: true,
      premium,
      pribadi: kolam?.pribadi,
      wajibPribadi: kolam?.wajibPribadi,
      pinjaman: kolam?.pinjaman,
    });
    if (hasil.teks) {
      // Sukses lewat kunci pinjaman ditandai pada sumbernya
      // ("kolam:pinjaman"), tidak menyamar sebagai layanan kunci
      // pribadi atau kolam biasa (Paket C, perbaikan QA 6 Nov 2026).
      return {
        sumber: hasil.lewatPinjaman ? "kolam:pinjaman" : `kolam:${hasil.penyedia}`,
        isi: hasil.teks,
      };
    }
  } catch (err) {
    // Paket C: untuk akun mahasiswa, penolakan kunci pribadi oleh
    // penyedia BUKAN "kolam gagal" biasa yang boleh ditelan menjadi
    // keluaran tanpa-ai; galat berkodenya diteruskan agar POST
    // menjawab 403 yang jelas mengarahkan ke /kunci.
    const { galatKunciPribadiDitolak } = await import("@/lib/server/kolam");
    if (kolam?.wajibPribadi && galatKunciPribadiDitolak(err)) throw err;
    /* kolam kosong/gagal — jatuh ke rantai lama */
  }
  // Akun mahasiswa (wajibPribadi) TIDAK boleh jatuh ke rantai lama:
  // rantai ini memakai kunci env pemilik secara langsung.
  if (kolam?.wajibPribadi) return null;
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
  // BYOK mahasiswa: tanpa kunci pribadi, berhenti jujur sebelum membakar apa pun.
  const { opsiKolamUntuk, PESAN_PERLU_KUNCI } = await import("@/lib/server/kunci-pribadi");
  const opsiP = await opsiKolamUntuk(penggunaSesi);
  if (opsiP.perluIsiKunci) {
    return NextResponse.json({ error: PESAN_PERLU_KUNCI, kode: "KUNCI_PRIBADI" }, { status: 403 });
  }
  const kolamPribadi = {
    pribadi: opsiP.pribadi,
    wajibPribadi: opsiP.wajibPribadi,
    pinjaman: opsiP.pinjaman,
  };

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
  // Makna pilihan sesudah disambiguasi ikut kunci tembolok: jawaban
  // untuk makna yang berbeda tidak boleh tertukar dari cache.
  const maknaKunci =
    tahapKunci === "kalimat" && typeof body?.makna?.makna === "string" ? body.makna.makna.slice(0, 200) : "";
  const idCache = `kk:${createHash("sha256")
    .update([tahapKunci || "utama", premium ? "premium" : "gratis", teks, judulKunci, kataKunciKunci.join("، "), maknaKunci].join("|"))
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

  let keluaran: { json: Record<string, unknown>; ai: boolean };
  try {
    keluaran = await (async (): Promise<{ json: Record<string, unknown>; ai: boolean }> => {
  // ── Tahap kurasi v2 ──────────────────────────────────────────────────────
  const tahap = typeof body?.tahap === "string" ? body.tahap : "";
  if (tahap === "kata") {
    const mentah = await panggilLLMMentah(PROMPT_KATA, teks, 500, premium, kolamPribadi);
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
    // Tahap G2: tahap kalimat berjalan di atas SKEMA KETAT
    // (lib/engine/skema-pencarian.ts). Keluaran model divalidasi di
    // kode; tidak sah → SATU kali coba ulang dengan prompt yang
    // sama; tetap tidak sah (atau model tidak menjawab) → GAGAL
    // TERTUTUP berstatus tidak_ditemukan. Tidak ada lagi templat
    // kalimat cadangan: panel menerima alasan jujurnya.
    const judul = typeof body?.judul === "string" ? body.judul.trim().slice(0, 300) : teks;
    const kataPilihan: string[] = Array.isArray(body?.kata)
      ? body.kata.filter((x: unknown) => typeof x === "string").slice(0, 12)
      : [];
    const maknaMentah = body?.makna as
      | { makna?: unknown; bidang?: unknown; konteks?: unknown }
      | undefined;
    const maknaDipilih =
      maknaMentah && typeof maknaMentah.makna === "string" && maknaMentah.makna.trim()
        ? {
            makna: maknaMentah.makna.trim().slice(0, 200),
            bidang: typeof maknaMentah.bidang === "string" ? maknaMentah.bidang.slice(0, 60) : "",
            konteks: Array.isArray(maknaMentah.konteks)
              ? maknaMentah.konteks
                  .filter((x: unknown) => typeof x === "string")
                  .map((x) => (x as string).trim())
                  .filter(Boolean)
                  .slice(0, 5)
              : [],
          }
        : null;

    // Kamus ambiguitas deterministik didahulukan: istilah yang
    // memang tercatat ambigu dijawab dari kamus (dengan konteks
    // wajib tiap maknanya) tanpa memanggil model sama sekali.
    if (!maknaDipilih) {
      const kamus = kamusAmbiguitasUntuk(`${judul} ${kataPilihan.join(" ")}`);
      if (kamus) {
        return {
          json: {
            sumber: "kamus-ambiguitas",
            status: "perlu_disambiguasi",
            ambiguitas: {
              istilah_ambigu: kamus.istilah[0],
              kemungkinan_makna: kamus.makna.map((m) => ({
                makna: m.makna,
                bidang: m.bidang,
                konteks: m.konteks,
              })),
            },
          },
          ai: false,
        };
      }
    }

    let user = `JUDUL: ${judul}\nKATA KUNCI TERPILIH: ${kataPilihan.join("، ") || "(belum ada — ambil dari judul)"}`;
    if (maknaDipilih) {
      user +=
        `\nMAKNA YANG DIPILIH PENGGUNA: ${maknaDipilih.makna} (bidang ${maknaDipilih.bidang || "-"}).` +
        (maknaDipilih.konteks.length > 0
          ? ` Pendamping konteks wajib makna ini: ${maknaDipilih.konteks.join("، ")} — perluasan_kueri berbahasa Arab WAJIB memakai konteks ini.`
          : "") +
        ` Susun status "siap" untuk makna ini; jangan kembalikan perlu_disambiguasi untuk istilah yang sama.`;
    }

    let nilai: KeluaranPencarian | null = null;
    let sumberModel = "";
    let alasanTolak = "";
    for (let percobaan = 0; percobaan < 2 && !nilai; percobaan++) {
      const mentah = await panggilLLMMentah(PROMPT_PENCARIAN, user, 1100, premium, kolamPribadi);
      if (!mentah) break;
      sumberModel = mentah.sumber;
      const v = validasiKeluaranPencarian(parseJsonLonggar(mentah.isi));
      if (v.sah) nilai = v.nilai;
      else alasanTolak = v.alasan;
    }
    if (!nilai) {
      return {
        json: {
          sumber: sumberModel || "tanpa-ai",
          status: "tidak_ditemukan",
          alasan_tidak_ditemukan: "tidak_cukup_informasi",
          kalimat: [],
          catatan: alasanTolak
            ? `Keluaran model tidak memenuhi skema pencarian (${alasanTolak}) dan tidak diteruskan; tidak ada kalimat kunci yang dikarang sebagai cadangan.`
            : "Model tidak menjawab; tidak ada kalimat kunci yang dikarang sebagai cadangan.",
        },
        ai: false,
      };
    }
    if (nilai.status === "perlu_disambiguasi" && nilai.ambiguitas) {
      // Makna dari kamus (yang membawa konteks wajib) didahulukan
      // bila istilahnya tercatat di kamus; makna model dipakai apa
      // adanya selain itu.
      const kamus = kamusAmbiguitasUntuk(nilai.ambiguitas.istilah_ambigu) ??
        kamusAmbiguitasUntuk(judul);
      return {
        json: {
          sumber: sumberModel,
          status: "perlu_disambiguasi",
          ambiguitas: {
            istilah_ambigu: nilai.ambiguitas.istilah_ambigu,
            kemungkinan_makna: kamus
              ? kamus.makna.map((m) => ({ makna: m.makna, bidang: m.bidang, konteks: m.konteks }))
              : nilai.ambiguitas.kemungkinan_makna.map((m) => ({ makna: m.makna, bidang: m.bidang, konteks: [] as string[] })),
          },
        },
        ai: true,
      };
    }
    if (nilai.status === "tidak_ditemukan") {
      return {
        json: {
          sumber: sumberModel,
          status: "tidak_ditemukan",
          alasan_tidak_ditemukan: nilai.alasan_tidak_ditemukan ?? "tidak_cukup_informasi",
          kalimat: [],
        },
        ai: true,
      };
    }
    const kalimat = petakanKalimatDariSkema(nilai);
    if (kalimat.length === 0) {
      return {
        json: {
          sumber: sumberModel,
          status: "tidak_ditemukan",
          alasan_tidak_ditemukan: "tidak_cukup_informasi",
          kalimat: [],
          catatan: "Keluaran skema sah tetapi tidak memuat perluasan kueri yang bisa dipetakan menjadi kalimat kunci.",
        },
        ai: false,
      };
    }
    return {
      json: {
        sumber: sumberModel,
        status: "siap",
        kalimat,
        kataKunciInti: nilai.kata_kunci_inti,
        bidangUtama: nilai.bidang_utama,
        bidangPendukung: nilai.bidang_pendukung ?? [],
        ...(maknaDipilih ? { konteksWajib: maknaDipilih.konteks } : {}),
      },
      ai: true,
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
  } catch (err) {
    // Paket C (perbaikan QA 6 Nov 2026): galat penolakan kunci
    // pribadi dari panggilLLMMentah dijawab 403 berkode dengan pesan
    // yang jelas, sama seperti rute Generate Footnote.
    const { galatKunciPribadiDitolak, KODE_KUNCI_PRIBADI_DITOLAK, PESAN_KUNCI_PRIBADI_DITOLAK } =
      await import("@/lib/server/kolam");
    if (galatKunciPribadiDitolak(err)) {
      return NextResponse.json(
        { error: PESAN_KUNCI_PRIBADI_DITOLAK, kode: KODE_KUNCI_PRIBADI_DITOLAK },
        { status: 403 },
      );
    }
    throw err;
  }

  if (keluaran.ai) {
    await simpan("tembolok", { id: idCache, hasil: keluaran.json, dibuat: new Date().toISOString() }).catch(
      () => undefined,
    );
  }
  return NextResponse.json(keluaran.json);
}
