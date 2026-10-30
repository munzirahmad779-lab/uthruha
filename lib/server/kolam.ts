/**
 * Kolam kunci AI (Fase 3, pola KeyState/KeyPool + failover berjenjang).
 *
 * - Banyak kunci per penyedia dari env (pisah koma): GEMINI_API_KEYS,
 *   GROQ_API_KEYS — bentuk tunggal (GEMINI_API_KEY dst.) tetap didukung.
 * - Keadaan tiap kunci disimpan di store (koleksi "kolam"): status,
 *   cooldown sampai, jumlah sukses/gagal. Kunci yang kena 429 diistirahatkan
 *   dengan jeda eksponensial (1 mnt → 5 mnt → 30 mnt → 6 jam).
 * - Urutan failover penyedia: Gemini → Groq → Cloudflare → DeepSeek
 *   (slot disiapkan; saldo pemilik 0 sehingga akan gagal wajar dan dilewati)
 *   → Meta (slot DISIAPKAN KOSONG atas perintah pemilik — tidak diisi dan
 *   tidak akan pernah terpilih sampai env META_MODEL_API_KEY diisi pemilik
 *   sendiri lewat jalur resmi).
 * - Nilai kunci TIDAK pernah disimpan di store/log; store hanya menyimpan
 *   label ("gemini#2") dan statistik.
 * - Kolam khusus Premium (keputusan pemilik 30 Okt 2026): env
 *   GEMINI_API_KEYS_PREMIUM & GROQ_API_KEYS_PREMIUM (dari akun terpisah agar
 *   kuota tidak menumpuk) HANYA boleh dipakai pemanggil bertanda premium.
 *   Pemanggil premium mencoba kunci premium lebih dulu, lalu jatuh ke kunci
 *   umum bila kunci premium habis/cooldown; pemanggil umum TIDAK pernah
 *   menyentuh kunci premium. Label keadaan terpisah: "gemini-premium#1".
 */
import { ambil, simpan } from "./store";

interface KeadaanKunci {
  id: string;
  status: "sehat" | "cooldown" | "sakit";
  cooldownSampai: number;
  sukses: number;
  gagal: number;
  errorTerakhir: string;
}

interface PenyediaKolam {
  id: string;
  model: string;
  kunci: string[];
  /** Kunci khusus Premium dari env terpisah; kosong bila belum diisi pemilik. */
  kunciPremium: string[];
  panggil: (kunci: string, model: string, sistem: string, pengguna: string, maksToken: number, json: boolean) => Promise<string>;
}

const UA = "Uthruha/1.0 (kolam kunci; +https://uthruha.vercel.app)";

function daftarKunci(...nama: string[]): string[] {
  const hasil: string[] = [];
  for (const n of nama) {
    const v = process.env[n]?.trim();
    if (v) hasil.push(...v.split(",").map((s) => s.trim()).filter(Boolean));
  }
  return [...new Set(hasil)];
}

async function panggilOpenAI(base: string, kunci: string, model: string, sistem: string, pengguna: string, maksToken: number, json: boolean): Promise<string> {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${kunci}`, "User-Agent": UA },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: maksToken,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        ...(sistem ? [{ role: "system", content: sistem }] : []),
        { role: "user", content: pengguna },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const isi = j.choices?.[0]?.message?.content;
  if (!isi) throw new Error("balasan kosong");
  return isi;
}

async function panggilGemini(kunci: string, model: string, sistem: string, pengguna: string, maksToken: number, json: boolean): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": kunci, "User-Agent": UA },
    body: JSON.stringify({
      ...(sistem ? { systemInstruction: { parts: [{ text: sistem }] } } : {}),
      contents: [{ role: "user", parts: [{ text: pengguna }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: maksToken,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const j = (await res.json()) as {
    candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  };
  const isi = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!isi) throw new Error("balasan kosong");
  // Balasan terpotong BUKAN sukses: teks setengah akan gagal dibaca pemanggil
  // dan tidak memicu failover bila dianggap berhasil. Lempar agar kolam
  // mencoba kunci/penyedia berikutnya.
  if (j.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    throw new Error("balasan terpotong (MAX_TOKENS)");
  }
  return isi;
}

function penyediaSemua(): PenyediaKolam[] {
  const daftar: PenyediaKolam[] = [];
  // Penyedia UJI — hanya aktif pada mode uji eksplisit (UTH_MODE_UJI=1),
  // menunjuk stub lokal OpenAI-compatible milik rangkaian pengujian.
  if (process.env.UTH_MODE_UJI === "1" && process.env.KOLAM_UJI_BASE?.trim()) {
    daftar.push({
      id: "uji",
      model: "model-uji",
      kunci: ["kunci-uji"],
      kunciPremium: [],
      panggil: (k, m, s, u, t, j) => panggilOpenAI(process.env.KOLAM_UJI_BASE!.trim(), k, m, s, u, t, j),
    });
  }
  daftar.push(
    {
      id: "gemini",
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
      kunci: daftarKunci("GEMINI_API_KEYS", "GEMINI_API_KEY", "GOOGLE_API_KEY"),
      kunciPremium: daftarKunci("GEMINI_API_KEYS_PREMIUM"),
      panggil: panggilGemini,
    },
    {
      id: "groq",
      model: process.env.GROQ_MODEL?.trim() || "qwen/qwen3.8-27b",
      kunci: daftarKunci("GROQ_API_KEYS", "GROQ_API_KEY"),
      kunciPremium: daftarKunci("GROQ_API_KEYS_PREMIUM"),
      panggil: (k, m, s, u, t, j) => panggilOpenAI("https://api.groq.com/openai/v1", k, m, s, u, t, j),
    },
    {
      id: "cloudflare",
      model: process.env.CLOUDFLARE_MODEL?.trim() || "@cf/meta/llama-3.1-8b-instruct",
      kunci: daftarKunci("CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"),
      kunciPremium: [],
      panggil: (k, m, s, u, t, j) =>
        panggilOpenAI(
          `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || "akun-belum-diisi"}/ai/v1`,
          k, m, s, u, t, j,
        ),
    },
    {
      // Slot DeepSeek: siap dipakai begitu pemilik mengisi saldo & kunci.
      id: "deepseek",
      model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
      kunci: daftarKunci("DEEPSEEK_API_KEYS", "DEEPSEEK_API_KEY"),
      kunciPremium: [],
      panggil: (k, m, s, u, t, j) => panggilOpenAI("https://api.deepseek.com/v1", k, m, s, u, t, j),
    },
    {
      // Slot Meta Model API: DISIAPKAN KOSONG atas perintah pemilik
      // (menunggu kunci resmi akun pemilik sendiri dari obrolan lain).
      id: "meta",
      model: process.env.META_MODEL?.trim() || "muse-spark-1.3",
      kunci: daftarKunci("META_MODEL_API_KEYS", "META_MODEL_API_KEY"),
      kunciPremium: [],
      panggil: (k, m, s, u, t, j) => panggilOpenAI("https://api.meta.ai/v1", k, m, s, u, t, j),
    },
  );
  return daftar;
}

const JEDA_DETIK = [60, 300, 1800, 21_600];

async function keadaan(idKunci: string): Promise<KeadaanKunci> {
  const ada = (await ambil("kolam", idKunci)) as unknown as KeadaanKunci | null;
  return ada ?? { id: idKunci, status: "sehat", cooldownSampai: 0, sukses: 0, gagal: 0, errorTerakhir: "" };
}

export interface HasilKolam {
  teks: string;
  penyedia: string;
  model: string;
  labelKunci: string;
}

export interface PercobaanGagal {
  label: string;
  alasan: string;
}

/**
 * Uji kesahan JSON dengan irisan yang PERSIS dipakai semua pemanggil mode
 * json (objek dari "{" pertama sampai "}" terakhir). Teks yang lolos uji ini
 * dijamin terbaca JSON.parse di sisi pemanggil; bentuk isinya tetap urusan
 * pemanggil masing-masing.
 */
function jsonSah(teks: string): boolean {
  const mulai = teks.indexOf("{");
  const akhir = teks.lastIndexOf("}");
  if (mulai < 0 || akhir <= mulai) return false;
  try {
    JSON.parse(teks.slice(mulai, akhir + 1));
    return true;
  } catch {
    return false;
  }
}

/**
 * Panggil LLM lewat kolam: kunci sehat dalam penyedia → kunci berikutnya →
 * penyedia berikutnya. Melempar hanya bila semua habis; daftar percobaan
 * disertakan untuk diagnosis.
 */
export async function panggilKolam(opsi: {
  sistem?: string;
  pengguna: string;
  maksToken?: number;
  json?: boolean;
  /** True hanya untuk pemanggil Premium terverifikasi: kunci premium dicoba
   *  lebih dulu, kunci umum menjadi cadangan. Pemanggil lain tidak pernah
   *  menerima kunci premium. */
  premium?: boolean;
}): Promise<HasilKolam> {
  const gagal: PercobaanGagal[] = [];
  const sekarang = Date.now();
  for (const p of penyediaSemua()) {
    // Grup kunci yang boleh dipakai pemanggil ini, urut per prioritas.
    const grup: { kunci: string; label: string }[][] = [];
    if (opsi.premium && p.kunciPremium.length > 0) {
      grup.push(p.kunciPremium.map((k, i) => ({ kunci: k, label: `${p.id}-premium#${i + 1}` })));
    }
    grup.push(p.kunci.map((k, i) => ({ kunci: k, label: `${p.id}#${i + 1}` })));
    if (grup.every((g) => g.length === 0)) {
      gagal.push({ label: p.id, alasan: "tidak ada kunci (slot kosong/belum diisi)" });
      continue;
    }
    // Dalam tiap grup: kunci sehat & paling jarang dipakai lebih dulu.
    const kandidat: { kunci: string; label: string; st: KeadaanKunci }[] = [];
    for (const g of grup) {
      const siap: { kunci: string; label: string; st: KeadaanKunci }[] = [];
      for (const item of g) {
        const st = await keadaan(item.label);
        if (st.status === "cooldown" && st.cooldownSampai > sekarang) continue;
        siap.push({ ...item, st });
      }
      siap.sort((a, b) => a.st.sukses + a.st.gagal - (b.st.sukses + b.st.gagal));
      kandidat.push(...siap);
    }
    for (const k of kandidat) {
      try {
        const teks = await p.panggil(k.kunci, p.model, opsi.sistem ?? "", opsi.pengguna, opsi.maksToken ?? 1200, opsi.json ?? false);
        // Mode json: balasan yang tidak terbaca sebagai JSON adalah kegagalan
        // percobaan, bukan sukses — lempar agar failover berjalan ke
        // kunci/penyedia berikutnya (dulu teks rusak dianggap sukses dan
        // pemanggil yang menanggung 502-nya).
        if (opsi.json && !jsonSah(teks)) throw new Error("balasan bukan JSON sah");
        await simpan("kolam", {
          ...k.st,
          status: "sehat",
          cooldownSampai: 0,
          sukses: k.st.sukses + 1,
          errorTerakhir: "",
        } as unknown as Record<string, unknown> & { id: string });
        return { teks, penyedia: p.id, model: p.model, labelKunci: k.label };
      } catch (e) {
        const status = (e as { status?: number }).status;
        const alasan = e instanceof Error ? e.message : "gagal";
        const gagalKe = k.st.gagal + 1;
        const perluCooldown = status === 429 || status === 402 || status === 401 || status === 403;
        await simpan("kolam", {
          ...k.st,
          status: perluCooldown ? "cooldown" : "sakit",
          cooldownSampai: perluCooldown
            ? Date.now() + JEDA_DETIK[Math.min(gagalKe - 1, JEDA_DETIK.length - 1)]! * 1000
            : 0,
          gagal: gagalKe,
          errorTerakhir: alasan.slice(0, 120),
        } as unknown as Record<string, unknown> & { id: string });
        gagal.push({ label: k.label, alasan });
      }
    }
  }
  const err = new Error("Semua penyedia AI gagal/semua kunci kosong.") as Error & {
    percobaan?: PercobaanGagal[];
  };
  err.percobaan = gagal;
  throw err;
}

/** Status ringkas kolam untuk panel/status — tanpa nilai kunci. */
export async function statusKolam(): Promise<
  {
    penyedia: string;
    model: string;
    jumlahKunci: number;
    sehat: number;
    jumlahKunciPremium: number;
    sehatPremium: number;
  }[]
> {
  const hasil = [];
  const sekarang = Date.now();
  for (const p of penyediaSemua()) {
    let sehat = 0;
    for (let i = 0; i < p.kunci.length; i += 1) {
      const st = await keadaan(`${p.id}#${i + 1}`);
      if (!(st.status === "cooldown" && st.cooldownSampai > sekarang)) sehat += 1;
    }
    let sehatPremium = 0;
    for (let i = 0; i < p.kunciPremium.length; i += 1) {
      const st = await keadaan(`${p.id}-premium#${i + 1}`);
      if (!(st.status === "cooldown" && st.cooldownSampai > sekarang)) sehatPremium += 1;
    }
    hasil.push({
      penyedia: p.id,
      model: p.model,
      jumlahKunci: p.kunci.length,
      sehat,
      jumlahKunciPremium: p.kunciPremium.length,
      sehatPremium,
    });
  }
  return hasil;
}
