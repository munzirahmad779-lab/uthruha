/**
 * AI Handoff — Ekspor draft ke AI eksternal & impor hasil kembali.
 * Utruha v2.0
 *
 * Mekanisme: copy-to-clipboard + buka URL (browser tidak bisa auto-type ke web lain).
 * Prompt template menyertakan instruksi footnote valid + format return.
 *
 * Pembangunan Ulang Tahap 8 menambahkan jalur SERAH KEMBANGKAN: empat
 * penyedia yang diminta pemilik web (ChatGPT, Claude, DeepSeek, Meta AI)
 * dan pembangun prompt pengembangan (buatPromptKembangkan) yang meracik
 * konteks nyata proyek. Penyedia warisan (Gemini, Qwen) TIDAK dihapus
 * dari AI_PROVIDERS; mereka hanya tidak tampil di permukaan serah.
 * Tidak ada pengiriman otomatis: prompt hanya DISALIN atas tekan tombol
 * mahasiswa, lalu ia menempelnya sendiri di situs penyedia.
 *
 * batasKarakter adalah batas aman INTERNAL aplikasi untuk pemotongan
 * prompt, bukan angka batas resmi layanan penyedia.
 */

// ─── Provider Config ──────────────────────────────────────────────────────────

export interface AIProvider {
  id: string;
  nama: string;
  url: string;
  batasKarakter: number;
  warna: string; // Untuk UI badge
}

export const AI_PROVIDERS: AIProvider[] = [
  { id: "gemini", nama: "Gemini", url: "https://gemini.google.com/app", batasKarakter: 30000, warna: "#4285F4" },
  { id: "qwen", nama: "Qwen", url: "https://chat.qwen.ai", batasKarakter: 25000, warna: "#FF6A00" },
  { id: "gpt", nama: "ChatGPT", url: "https://chatgpt.com", batasKarakter: 15000, warna: "#10A37F" },
  { id: "claude", nama: "Claude", url: "https://claude.ai", batasKarakter: 25000, warna: "#D97757" },
  { id: "meta", nama: "Meta AI", url: "https://meta.ai", batasKarakter: 20000, warna: "#0064E0" },
  { id: "deepseek", nama: "DeepSeek", url: "https://chat.deepseek.com", batasKarakter: 20000, warna: "#1A1A2E" },
];

// ─── Penyedia Serah Kembangkan (Tahap 8) ─────────────────────────────────────

/** Empat penyedia serah yang diminta pemilik web, menurut urutan tampil. */
export const ID_PENYEDIA_SERAH = ["gpt", "claude", "deepseek", "meta"] as const;

export type IdPenyediaSerah = (typeof ID_PENYEDIA_SERAH)[number];

/**
 * Daftar penyedia yang tampil di panel "Kembangkan di AI luar": tepat
 * empat, diambil dari AI_PROVIDERS agar URL dan batasnya satu sumber.
 */
export function penyediaSerah(): AIProvider[] {
  return ID_PENYEDIA_SERAH.map((id) => AI_PROVIDERS.find((p) => p.id === id)).filter(
    (p): p is AIProvider => Boolean(p),
  );
}

// ─── Prompt Template ──────────────────────────────────────────────────────────

const PROMPT_TEMPLATE = `أنت مساعد أكاديمي متخصص في الكتابة العلمية باللغة العربية.

المسودة التالية هي جزء من بحث علمي. مهمتك:
1. حسّن الصياغة الأكاديمية مع الحفاظ على المعنى الأصلي.
2. أضف هوامش (footnotes) صالحة بالرجوع إلى المصادر التالية فقط:
   - موقع الشميلة للكتب التراثية: https://shamela.ws
   - المجلات العربية المحكمة عبر DOAJ: https://doaj.org
   - Crossref للأبحاث الدولية: https://crossref.org
3. كل هامش يجب أن يتضمن: اسم المؤلف، عنوان الكتاب/المقال، مكان النشر، الناشر، السنة، الجزء، الصفحة.
4. لا تخترع مصادر أو صفحات. إذا لم تجد مصدرًا مناسبًا، اكتب [بحاجة إلى مصدر].
5. أعد النتيجة بالصيغة التالية حتى يمكن إعادتها للنظام:

---BEGIN_RESULT---
[النص المحسن مع الهوامش بصيغة [^1] [^2]...]

[^1]: المؤلف، العنوان، (المدينة: الناشر، السنة)، جـ، ص.
[^2]: ...
---END_RESULT---

⚠️ تنبيه: البيانات المرسلة ستُعالَج بواسطة ذكاء اصطناعي خارجي. تأكد من عدم تضمين معلومات شخصية حساسة.

---

المسودة:
`;

/**
 * Buat prompt lengkap untuk dikirim ke AI eksternal.
 * @param markdown - Draft section yang akan dikirim
 * @param sectionId - ID section untuk konteks tambahan
 * @param editablePrompt - Prompt custom user (opsional, override default)
 */
export function buatPromptAI(
  markdown: string,
  sectionId: string,
  editablePrompt?: string,
): string {
  const base = editablePrompt ?? PROMPT_TEMPLATE;
  return `${base}\n${markdown}`;
}

/**
 * Siapkan payload ekspor untuk satu provider.
 * Memotong draft jika melebihi batas karakter.
 */
export interface PayloadEkspor {
  provider: AIProvider;
  promptLengkap: string;
  terpotong: boolean;
  panjangAsli: number;
  panjangFinal: number;
  url: string;
}

export function siapkanEkspor(
  markdown: string,
  providerId: string,
  sectionId: string,
  editablePrompt?: string,
): PayloadEkspor | null {
  const provider = AI_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;

  const promptLengkap = buatPromptAI(markdown, sectionId, editablePrompt);
  const terpotong = promptLengkap.length > provider.batasKarakter;
  const finalPrompt = terpotong
    ? promptLengkap.slice(0, provider.batasKarakter) + "\n\n[… تم اقتصاص النص بسبب حدود الرموز]"
    : promptLengkap;

  return {
    provider,
    promptLengkap: finalPrompt,
    terpotong,
    panjangAsli: promptLengkap.length,
    panjangFinal: finalPrompt.length,
    url: provider.url,
  };
}

// ─── Prompt Kembangkan (Tahap 8) ─────────────────────────────────────────────

/**
 * Konteks nyata proyek untuk prompt pengembangan. Semua bidang berasal
 * dari data proyek itu sendiri (judul, bagian aktif, teks draf bagian
 * atau teks yang diblok mahasiswa, nama pedoman terpilih, target kata
 * bagian dari struktur). Tidak ada bidang untuk data di luar tulisan
 * proyek: prompt serah tidak boleh memuat data privat lain.
 */
export interface KonteksKembangkan {
  /** Judul penelitian proyek. */
  judul: string;
  /** Nama bagian yang sedang dikembangkan. */
  namaBagian: string;
  /** Teks bagian saat ini, atau teks yang diblok mahasiswa. */
  teks: string;
  /** Nama pedoman penulisan proyek, bila proyek memakai pedoman. */
  namaPedoman?: string;
  /** Target kata bagian menurut struktur proyek, bila ada. */
  targetKata?: number;
}

/**
 * Racik prompt siap salin untuk mengembangkan satu bagian di AI luar.
 *
 * Isi prompt: konteks proyek (judul, bagian, pedoman bila ada), lalu
 * instruksi pengembangan berbahasa Arab akademik: perluas dan perdalam
 * TANPA mengubah makna, TANPA mengarang rujukan (tempat yang butuh
 * rujukan tambahan ditandai [يحتاج إلى مرجع], bukan diisi karangan),
 * dan penanda sitasi [[ref:...]] dipertahankan apa adanya karena ia
 * data mesin naskah. Baris target panjang hanya muncul bila targetKata
 * adalah data nyata bagian itu dan teks kini masih di bawahnya; tidak
 * ada angka target karangan.
 *
 * Mengembalikan null bila teks kosong: bagian yang belum ada isinya
 * tidak menghasilkan prompt, dan permukaan wajib menyatakannya jujur
 * (tombol nonaktif), bukan menyerahkan kerangka kosong.
 */
export function buatPromptKembangkan(k: KonteksKembangkan): string | null {
  const teks = (k.teks ?? "").trim();
  if (!teks) return null;
  const judul = (k.judul ?? "").trim();
  const namaBagian = (k.namaBagian ?? "").trim();
  const namaPedoman = (k.namaPedoman ?? "").trim();
  const jumlahKata = teks.split(/\s+/).filter(Boolean).length;

  const instruksi: string[] = [
    "حافِظ على المعنى الأصلي وعلى كل فكرة واردة في النص، ولا تحذف منها شيئًا ولا تغيّر مقصود الباحث.",
    "وسِّع الشرح والأمثلة والروابط المنطقية بين الأفكار بلغة عربية أكاديمية رصينة وتراكيب مترابطة، تعميقًا لا حشوًا ولا تكرارًا.",
    "لا تخترع مراجع ولا مصادر ولا أسماء علماء ولا تواريخ ولا أرقام صفحات غير واردة في النص. وإن احتاج موضع إلى مرجع إضافي فاكتب فيه [يحتاج إلى مرجع] ولا تخترع مرجعًا.",
    "علامات الحواشي الواردة في النص بصيغة [[ref:...]] بيانات آلية لنظام كتابة البحث؛ حافِظ عليها في مواضعها نفسها ولا تعدّلها ولا تحذفها.",
  ];
  if (typeof k.targetKata === "number" && k.targetKata > 0 && jumlahKata < k.targetKata) {
    instruksi.push(
      `النص الحالي نحو ${jumlahKata} كلمة، والمستهدف في هذا القسم نحو ${k.targetKata} كلمة؛ فوسِّع النص حتى يقارب المستهدف دون إخلال بالشروط السابقة.`,
    );
  }

  const baris: string[] = [
    "أنت مساعد أكاديمي متخصص في الكتابة العلمية باللغة العربية الفصحى.",
    "",
  ];
  if (judul) baris.push(`عنوان البحث: «${judul}»`);
  if (namaBagian) baris.push(`القسم المطلوب تطويره: ${namaBagian}`);
  if (namaPedoman) baris.push(`يُكتب هذا البحث وفق: ${namaPedoman}`);
  if (judul || namaBagian || namaPedoman) baris.push("");
  baris.push("المطلوب: طوِّر النص الآتي ووسِّعه وعمِّق تحليله، ملتزمًا بما يأتي:");
  instruksi.forEach((isi, i) => baris.push(`${i + 1}. ${isi}`));
  baris.push(
    "أخيرًا: أعِد النص المطوَّر فقط، جاهزًا لأن يُلصق محل النص الأصلي، من دون مقدمات ولا تعليقات ولا عناوين من خارج النص.",
    "",
    "النص الحالي:",
    "---",
    teks,
    "---",
  );
  return baris.join("\n");
}

export interface SerahKembangkan {
  provider: AIProvider;
  /** Prompt persis yang ditampilkan panel dan yang disalin ke papan klip. */
  prompt: string;
  /** True bila prompt dipotong ke batas aman internal penyedia ini. */
  terpotong: boolean;
  /** Panjang prompt utuh sebelum pemotongan. */
  panjangAsli: number;
  /** Jumlah kata teks bagian yang diserahkan. */
  jumlahKata: number;
  /** URL penyedia yang dibuka di tab baru sesudah prompt disalin. */
  url: string;
}

/**
 * Siapkan satu serahan untuk satu penyedia: prompt dari
 * buatPromptKembangkan, dipotong ke batas aman penyedia bila perlu
 * (dengan penanda potong yang sama seperti siapkanEkspor, agar panel
 * dan mahasiswa melihat dengan jujur bahwa teksnya tidak utuh).
 * Null bila penyedia tak dikenal atau teks kosong.
 */
export function siapkanSerahKembangkan(
  k: KonteksKembangkan,
  providerId: string,
): SerahKembangkan | null {
  const provider = AI_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;
  const prompt = buatPromptKembangkan(k);
  if (!prompt) return null;
  const terpotong = prompt.length > provider.batasKarakter;
  return {
    provider,
    prompt: terpotong
      ? prompt.slice(0, provider.batasKarakter) + "\n\n[… تم اقتصاص النص بسبب حدود الرموز]"
      : prompt,
    terpotong,
    panjangAsli: prompt.length,
    jumlahKata: (k.teks ?? "").trim().split(/\s+/).filter(Boolean).length,
    url: provider.url,
  };
}

// ─── Impor Hasil AI ───────────────────────────────────────────────────────────

export interface HasilImporAI {
  teksNaskah: string;
  footnotes: Array<{ nomor: number; teks: string }>;
  berhasil: boolean;
  pesanError?: string;
}

/**
 * Parse hasil dari AI eksternal.
 * Mencari blok ---BEGIN_RESULT--- ... ---END_RESULT--- atau fallback parse [^N].
 */
export function parseHasilAI(input: string): HasilImporAI {
  if (!input || !input.trim()) {
    return { teksNaskah: "", footnotes: [], berhasil: false, pesanError: "Input kosong." };
  }

  // Coba parse blok BEGIN/END RESULT
  const blokMatch = input.match(/---BEGIN_RESULT---\s*([\s\S]*?)\s*---END_RESULT---/);
  const teksRelevan = blokMatch ? blokMatch[1]! : input;

  // Extract footnotes [^N]: ...
  const fnRegex = /\[\^(\d+)\]:\s*(.+?)(?=\[\^\d+\]:|$)/gs;
  const footnotes: Array<{ nomor: number; teks: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = fnRegex.exec(teksRelevan)) !== null) {
    footnotes.push({
      nomor: parseInt(match[1]!, 10),
      teks: match[2]!.trim(),
    });
  }

  // Hapus footnote dari teks naskah
  let teksNaskah = teksRelevan.replace(/\[\^\d+\]/g, "").replace(fnRegex, "").trim();

  // Bersihkan marker BEGIN/END jika masih ada
  teksNaskah = teksNaskah
    .replace(/---BEGIN_RESULT---/g, "")
    .replace(/---END_RESULT---/g, "")
    .trim();

  if (!teksNaskah && footnotes.length === 0) {
    return { teksNaskah: input, footnotes: [], berhasil: false, pesanError: "Tidak dapat memisahkan naskah dan footnote dari hasil AI." };
  }

  return { teksNaskah, footnotes, berhasil: true };
}

// ─── Diff Preview ─────────────────────────────────────────────────────────────

export interface DiffSegment {
  type: "same" | "added" | "removed";
  text: string;
}

/**
 * Generate simple word-level diff antara teks asli dan hasil AI.
 * Untuk preview sebelum diterapkan.
 */
export function generateDiff(asli: string, baru: string): DiffSegment[] {
  const kataAsli = asli.split(/\s+/);
  const kataBaru = baru.split(/\s+/);
  const segments: DiffSegment[] = [];

  let i = 0, j = 0;
  while (i < kataAsli.length || j < kataBaru.length) {
    if (i < kataAsli.length && j < kataBaru.length && kataAsli[i] === kataBaru[j]) {
      segments.push({ type: "same", text: kataAsli[i]! });
      i++; j++;
    } else if (j < kataBaru.length && (i >= kataAsli.length || !kataAsli.slice(i, i + 5).includes(kataBaru[j]!))) {
      segments.push({ type: "added", text: kataBaru[j]! });
      j++;
    } else if (i < kataAsli.length) {
      segments.push({ type: "removed", text: kataAsli[i]! });
      i++;
    } else {
      break;
    }
  }

  return segments;
}
