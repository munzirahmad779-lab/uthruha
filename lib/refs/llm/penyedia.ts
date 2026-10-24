/**
 * Rantai penyedia LLM GRATIS.
 *
 * PRINSIP (jangan diubah tanpa alasan kuat):
 *  1. Satu kunci per penyedia. TIDAK ADA rotasi beberapa kunci dari penyedia
 *     yang sama â€” itu menembus kuota, bukan memakainya. Sembilan entri di
 *     bawah adalah sembilan PERUSAHAAN BERBEDA, masing-masing dengan jatah
 *     gratis resminya sendiri. Itu sah.
 *  2. Kunci hanya dari variabel lingkungan server. Tidak pernah dikirim ke
 *     peramban, tidak pernah masuk log.
 *  3. Semua kegagalan ditelan: penyedia yang limit/mati dilewati, pencarian
 *     tetap jalan. Kalau semua gagal, pemanggil jatuh ke mode deterministik.
 *  4. LLM HANYA dipakai untuk mengubah paragraf menjadi istilah pencarian.
 *     LLM tidak pernah menulis nama kitab, jilid, halaman, atau tahun.
 */

/** Satu istilah pencarian yang diusulkan model. */
export interface HasilLLM {
  teks: string;
  /** id penyedia yang menjawab â€” ditampilkan di UI agar bisa diaudit. */
  penyedia: string;
  /** Model yang benar-benar dipakai. */
  model: string;
}

export interface OpsiLLM {
  batasMs?: number;
  maksToken?: number;
  /** Kunci yang diberikan pengguna lewat UI (menimpa env). */
  kunci?: string;
}

export interface Penyedia {
  id: string;
  nama: string;
  /** Keterangan jujur jatah gratisnya. */
  gratis: string;
  /** Nama variabel lingkungan untuk kunci. Kosong = tanpa kunci. */
  env: string[];
  model: string;
  /**
   * Biaya kasar per pencarian dalam satuan penyedia, untuk peringatan kuota.
   * Hanya keterangan, tidak dipakai menghitung.
   */
  catatan?: string;
  panggil: (prompt: string, opsi: OpsiLLM) => Promise<string>;
}

const UA = "Uthruha/1.0 (alat bantu penulisan akademik; +https://uthruha.id) tentukan-sumber";

function ambilKunci(env: string[], opsi: OpsiLLM): string | undefined {
  if (opsi.kunci?.trim()) return opsi.kunci.trim();
  for (const e of env) {
    const v = process.env[e]?.trim();
    if (v) return v;
  }
  return undefined;
}

/** Apakah penyedia ini mungkin dipakai (kunci tersedia atau tanpa kunci). */
export function siap(p: Penyedia, opsi: OpsiLLM = {}): boolean {
  if (p.env.length === 0) return true;
  return Boolean(ambilKunci(p.env, opsi));
}

interface BalasanOpenAI {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/**
 * Pemanggil gaya OpenAI â€” dipakai 8 dari 9 penyedia (Ollama, Groq, Cerebras,
 * Mistral, GitHub Models, OpenRouter, Alibaba, Cloudflare).
 */
async function panggilOpenAI(
  base: string,
  model: string,
  prompt: string,
  kunci: string | undefined,
  opsi: OpsiLLM,
  tambahanHeader: Record<string, string> = {},
): Promise<string> {
  const batas = opsi.batasMs ?? 20000;
  const ctl = new AbortController();
  const jam = setTimeout(() => ctl.abort(), batas);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: ctl.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        ...(kunci ? { Authorization: `Bearer ${kunci}` } : {}),
        ...tambahanHeader,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "ط£ظ†طھ ظ…ط³ط§ط¹ط¯ ط¨ط­ط« ط£ظƒط§ط¯ظٹظ…ظٹ ط¹ط±ط¨ظٹ. ظ…ظ‡ظ…طھظƒ: ط§ط³طھط®ط±ط§ط¬ ظ…طµط·ظ„ط­ط§طھ ط¨ط­ط« ظپظ‚ط·. ظ„ط§ طھظƒطھط¨ ط£ط¨ط¯ظ‹ط§ ط£ط³ظ…ط§ط، ظƒطھط¨ ط£ظˆ ط£ط±ظ‚ط§ظ… طµظپط­ط§طھ ط£ظˆ ظ…ط±ط§ط¬ط¹.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: opsi.maksToken ?? 220,
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as BalasanOpenAI;
    const isi = j.choices?.[0]?.message?.content;
    if (!isi) throw new Error(j.error?.message ?? "balasan kosong");
    return isi;
  } finally {
    clearTimeout(jam);
  }
}

function buatOpenAI(
  id: string,
  nama: string,
  gratis: string,
  env: string[],
  base: string,
  model: string,
  catatan?: string,
): Penyedia {
  return {
    id,
    nama,
    gratis,
    env,
    model,
    catatan,
    async panggil(prompt, opsi) {
      const kunci = ambilKunci(env, opsi);
      return panggilOpenAI(base, model, prompt, kunci, opsi);
    },
  };
}

interface BalasanGemini {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

/**
 * Urutan rantai. Yang pertama dicoba lebih dulu.
 * Ollama di depan karena lokal: tanpa kuota, tanpa jaringan keluar, dan
 * paragraf pengguna tidak pernah meninggalkan komputernya.
 */
export const PENYEDIA: Penyedia[] = [
  {
    id: "ollama",
    nama: "Ollama (lokal)",
    gratis: "Tanpa batas, tanpa kunci â€” berjalan di komputer Anda",
    // Ollama TIDAK butuh kunci. OLLAMA_HOST hanya alamat server, bukan rahasia.
    env: [],
    model: process.env.OLLAMA_MODEL?.trim() || "qwen2.5:3b",
    catatan: "Butuh Ollama terpasang. Paragraf tidak keluar dari komputer.",
    async panggil(prompt, opsi) {
      const host = process.env.OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
      const batasOllama = opsi.batasMs ?? 60000;
      // Domain *.ngrok-free.dev mengembalikan halaman peringatan HTML bila
      // permintaan dianggap berasal dari peramban, sehingga balasan bukan JSON.
      // Header ini mematikannya. Hanya relevan bila OLLAMA_HOST lewat ngrok.
      const lewatNgrok = /ngrok-free\.(dev|app)|ngrok\.io|ngrok\.app/i.test(host);
      const tambahan: Record<string, string> = lewatNgrok
        ? { "ngrok-skip-browser-warning": "true" }
        : {};
      return panggilOpenAI(
        `${host.replace(/\/$/, "")}/v1`,
        process.env.OLLAMA_MODEL?.trim() || "qwen2.5:3b",
        prompt,
        undefined,
        { ...opsi, batasMs: batasOllama },
        tambahan,
      );
    },
  },
  buatOpenAI(
    "cloudflare",
    "Cloudflare Workers AI",
    "10.000 Neuron/hari (gratis harian)",
    ["CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"],
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || "akun-belum-diisi"}/ai/v1`,
    process.env.CF_MODEL?.trim() || "@cf/qwen/qwen3-30b-a3b-fp8",
    "Butuh CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.",
  ),
  {
    id: "gemini",
    nama: "Google Gemini",
    gratis: "Tier gratis permanen (limit per menit)",
    env: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
    catatan: "Tidak perlu kartu kredit.",
    async panggil(prompt, opsi) {
      const kunci = ambilKunci(["GEMINI_API_KEY", "GOOGLE_API_KEY"], opsi);
      if (!kunci) throw new Error("kunci Gemini belum diisi");
      const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
      const batas = opsi.batasMs ?? 20000;
      const ctl = new AbortController();
      const jam = setTimeout(() => ctl.abort(), batas);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(url, {
          method: "POST",
          signal: ctl.signal,
          cache: "no-store",
          headers: { "Content-Type": "application/json", "User-Agent": UA, "x-goog-api-key": kunci },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text:
                    "ط£ظ†طھ ظ…ط³ط§ط¹ط¯ ط¨ط­ط« ط£ظƒط§ط¯ظٹظ…ظٹ ط¹ط±ط¨ظٹ. ظ…ظ‡ظ…طھظƒ: ط§ط³طھط®ط±ط§ط¬ ظ…طµط·ظ„ط­ط§طھ ط¨ط­ط« ظپظ‚ط·. ظ„ط§ طھظƒطھط¨ ط£ط¨ط¯ظ‹ط§ ط£ط³ظ…ط§ط، ظƒطھط¨ ط£ظˆ ط£ط±ظ‚ط§ظ… طµظپط­ط§طھ ط£ظˆ ظ…ط±ط§ط¬ط¹.",
                },
              ],
            },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: opsi.maksToken ?? 220 },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as BalasanGemini;
        const isi = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
        if (!isi) throw new Error(j.error?.message ?? "balasan kosong");
        return isi;
      } finally {
        clearTimeout(jam);
      }
    },
  },
  buatOpenAI(
    "alibaba",
    "Alibaba Model Studio (Qwen)",
    "~1 juta token gratis per model, berlaku 90 hari",
    ["DASHSCOPE_API_KEY", "ALIBABA_API_KEY"],
    process.env.DASHSCOPE_BASE?.trim() || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    process.env.QWEN_MODEL?.trim() || "qwen-plus",
    "Nyalakan آ«Free Quota Onlyآ» di konsol agar tidak tertagih saat kuota habis.",
  ),
  buatOpenAI(
    "groq",
    "Groq",
    "Tier gratis, cepat (LPU)",
    ["GROQ_API_KEY"],
    "https://api.groq.com/openai/v1",
    process.env.GROQ_MODEL?.trim() || "qwen/qwen3-32b",
  ),
  buatOpenAI(
    "cerebras",
    "Cerebras",
    "Tier gratis harian",
    ["CEREBRAS_API_KEY"],
    "https://api.cerebras.ai/v1",
    process.env.CEREBRAS_MODEL?.trim() || "qwen-3-32b",
  ),
  buatOpenAI(
    "mistral",
    "Mistral",
    "Tier gratis (experiment plan)",
    ["MISTRAL_API_KEY"],
    "https://api.mistral.ai/v1",
    process.env.MISTRAL_MODEL?.trim() || "mistral-small-latest",
  ),
  buatOpenAI(
    "github",
    "GitHub Models",
    "Gratis dengan akun GitHub (limit per menit)",
    ["GITHUB_TOKEN", "GH_TOKEN"],
    "https://models.github.ai/inference",
    process.env.GITHUB_MODEL?.trim() || "openai/gpt-4o-mini",
  ),
  buatOpenAI(
    "openrouter",
    "OpenRouter",
    "Model berakhiran :free, limit harian",
    ["OPENROUTER_API_KEY"],
    "https://openrouter.ai/api/v1",
    process.env.OPENROUTER_MODEL?.trim() || "qwen/qwen-2.5-72b-instruct:free",
    "Kirim header HTTP-Referer bila ingin masuk daftar gratis penuh.",
  ),
];

/**
 * Coba penyedia satu per satu sampai ada yang menjawab.
 * Tidak pernah melempar â€” kegagalan dikembalikan sebagai daftar alasan.
 */
export async function panggilLLM(
  prompt: string,
  opsi: OpsiLLM & { hanya?: string[] } = {},
): Promise<{ hasil: HasilLLM | null; dicoba: { penyedia: string; alasan: string }[] }> {
  const dicoba: { penyedia: string; alasan: string }[] = [];
  const urutan = opsi.hanya?.length
    ? opsi.hanya
        .map((id) => PENYEDIA.find((p) => p.id === id))
        .filter((p): p is Penyedia => Boolean(p))
    : PENYEDIA;

  for (const p of urutan) {
    if (!siap(p, opsi)) {
      dicoba.push({ penyedia: p.id, alasan: "kunci belum diisi" });
      continue;
    }
    try {
      const teks = await p.panggil(prompt, opsi);
      if (!teks.trim()) {
        dicoba.push({ penyedia: p.id, alasan: "balasan kosong" });
        continue;
      }
      return { hasil: { teks, penyedia: p.id, model: p.model }, dicoba };
    } catch (e) {
      dicoba.push({
        penyedia: p.id,
        alasan: e instanceof Error ? e.message.slice(0, 80) : "gagal",
      });
    }
  }
  return { hasil: null, dicoba };
}

/** Ringkasan untuk UI: penyedia mana yang siap dipakai sekarang. */
export function statusPenyedia(): {
  id: string;
  nama: string;
  gratis: string;
  model: string;
  siap: boolean;
  catatan?: string;
}[] {
  return PENYEDIA.map((p) => ({
    id: p.id,
    nama: p.nama,
    gratis: p.gratis,
    model: p.model,
    siap: siap(p),
    catatan: p.catatan,
  }));
}
