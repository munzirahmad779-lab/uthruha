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
  /**
   * Bahasa naskah proyek ("ar" | "id" | "en"); bahasa instruksi
   * prompt mengikuti bidang ini (Verifikasi menyeluruh, menutup R1
   * telaah Tahap 8: dulu instruksi selalu Arab walau proyek berbahasa
   * Indonesia atau Inggris). Kosong berarti "ar", perilaku lama.
   */
  bahasa?: "ar" | "id" | "en";
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
/** Paket bahasa instruksi prompt kembangkan, per bahasa naskah proyek. */
interface PaketBahasaPrompt {
  pembuka: string;
  labelJudul: (judul: string) => string;
  labelBagian: (nama: string) => string;
  labelPedoman: (nama: string) => string;
  diminta: string;
  instruksi: string[];
  target: (jumlahKata: number, targetKata: number) => string;
  penutup: string;
  labelTeks: string;
  /** Penanda di ekor prompt yang dipotong ke batas aman penyedia. */
  penandaPotong: string;
}

const PAKET_PROMPT: Record<"ar" | "id" | "en", PaketBahasaPrompt> = {
  ar: {
    pembuka: "أنت مساعد أكاديمي متخصص في الكتابة العلمية باللغة العربية الفصحى.",
    labelJudul: (j) => `عنوان البحث: «${j}»`,
    labelBagian: (n) => `القسم المطلوب تطويره: ${n}`,
    labelPedoman: (n) => `يُكتب هذا البحث وفق: ${n}`,
    diminta: "المطلوب: طوِّر النص الآتي ووسِّعه وعمِّق تحليله، ملتزمًا بما يأتي:",
    instruksi: [
      "حافِظ على المعنى الأصلي وعلى كل فكرة واردة في النص، ولا تحذف منها شيئًا ولا تغيّر مقصود الباحث.",
      "وسِّع الشرح والأمثلة والروابط المنطقية بين الأفكار بلغة عربية أكاديمية رصينة وتراكيب مترابطة، تعميقًا لا حشوًا ولا تكرارًا.",
      "لا تخترع مراجع ولا مصادر ولا أسماء علماء ولا تواريخ ولا أرقام صفحات غير واردة في النص. وإن احتاج موضع إلى مرجع إضافي فاكتب فيه [يحتاج إلى مرجع] ولا تخترع مرجعًا.",
      "علامات الحواشي الواردة في النص بصيغة [[ref:...]] بيانات آلية لنظام كتابة البحث؛ حافِظ عليها في مواضعها نفسها ولا تعدّلها ولا تحذفها.",
    ],
    target: (j, t) =>
      `النص الحالي نحو ${j} كلمة، والمستهدف في هذا القسم نحو ${t} كلمة؛ فوسِّع النص حتى يقارب المستهدف دون إخلال بالشروط السابقة.`,
    penutup:
      "أخيرًا: أعِد النص المطوَّر فقط، جاهزًا لأن يُلصق محل النص الأصلي، من دون مقدمات ولا تعليقات ولا عناوين من خارج النص.",
    labelTeks: "النص الحالي:",
    penandaPotong: "\n\n[… تم اقتصاص النص بسبب حدود الرموز]",
  },
  id: {
    pembuka: "Anda adalah asisten akademik yang ahli dalam penulisan ilmiah berbahasa Indonesia.",
    labelJudul: (j) => `Judul penelitian: «${j}»`,
    labelBagian: (n) => `Bagian yang diminta dikembangkan: ${n}`,
    labelPedoman: (n) => `Penelitian ini ditulis mengikuti: ${n}`,
    diminta: "Tugas: kembangkan teks berikut, perluas dan perdalam analisisnya, dengan mematuhi ketentuan berikut:",
    instruksi: [
      "Pertahankan makna asli dan setiap gagasan yang ada di dalam teks; jangan menghapus apa pun dan jangan mengubah maksud peneliti.",
      "Perluas penjelasan, contoh, dan kaitan logis antar gagasan dengan bahasa Indonesia akademik yang kokoh dan susunan yang saling berkaitan; pendalaman, bukan pengulangan atau isian kosong.",
      "Jangan mengarang rujukan, sumber, nama ulama atau pakar, tanggal, atau nomor halaman yang tidak ada di dalam teks. Bila suatu tempat membutuhkan rujukan tambahan, tuliskan [perlu rujukan] di tempat itu, jangan mengarang rujukan.",
      "Penanda catatan kaki dalam teks berbentuk [[ref:...]] adalah data mesin sistem penulisan risalah; pertahankan pada tempat dan bentuknya, jangan diubah dan jangan dihapus.",
    ],
    target: (j, t) =>
      `Teks saat ini sekitar ${j} kata, dan target bagian ini sekitar ${t} kata; perluas teks hingga mendekati target tanpa melanggar ketentuan di atas.`,
    penutup:
      "Terakhir: kembalikan hanya teks hasil pengembangan, siap ditempel menggantikan teks asli, tanpa pengantar, komentar, atau judul dari luar teks.",
    labelTeks: "Teks saat ini:",
    penandaPotong: "\n\n[… teks dipotong karena batas karakter]",
  },
  en: {
    pembuka: "You are an academic assistant specialising in scholarly writing in English.",
    labelJudul: (j) => `Research title: "${j}"`,
    labelBagian: (n) => `Section to expand: ${n}`,
    labelPedoman: (n) => `This work follows the guidelines: ${n}`,
    diminta: "Task: expand the following text and deepen its analysis, observing these rules:",
    instruksi: [
      "Preserve the original meaning and every idea in the text; delete nothing and do not alter the researcher's intent.",
      "Expand the explanations, examples, and logical links between ideas in solid academic English with a coherent structure; deepen, do not pad or repeat.",
      "Do not invent references, sources, scholars' names, dates, or page numbers that are not in the text. Where a passage needs an additional reference, write [needs reference] there instead of inventing one.",
      "Footnote markers in the text in the form [[ref:...]] are machine data of the thesis-writing system; keep them exactly in place, unmodified and undeleted.",
    ],
    target: (j, t) =>
      `The current text is about ${j} words and the target for this section is about ${t} words; expand the text towards the target without breaking the rules above.`,
    penutup:
      "Finally: return only the expanded text, ready to be pasted in place of the original, with no introductions, comments, or headings from outside the text.",
    labelTeks: "Current text:",
    penandaPotong: "\n\n[… text truncated due to the character limit]",
  },
};

function paketPrompt(k: KonteksKembangkan): PaketBahasaPrompt {
  return PAKET_PROMPT[k.bahasa === "id" || k.bahasa === "en" ? k.bahasa : "ar"];
}

export function buatPromptKembangkan(k: KonteksKembangkan): string | null {
  const teks = (k.teks ?? "").trim();
  if (!teks) return null;
  const judul = (k.judul ?? "").trim();
  const namaBagian = (k.namaBagian ?? "").trim();
  const namaPedoman = (k.namaPedoman ?? "").trim();
  const jumlahKata = teks.split(/\s+/).filter(Boolean).length;
  const paket = paketPrompt(k);

  const instruksi: string[] = [...paket.instruksi];
  if (typeof k.targetKata === "number" && k.targetKata > 0 && jumlahKata < k.targetKata) {
    instruksi.push(paket.target(jumlahKata, k.targetKata));
  }

  const baris: string[] = [paket.pembuka, ""];
  if (judul) baris.push(paket.labelJudul(judul));
  if (namaBagian) baris.push(paket.labelBagian(namaBagian));
  if (namaPedoman) baris.push(paket.labelPedoman(namaPedoman));
  if (judul || namaBagian || namaPedoman) baris.push("");
  baris.push(paket.diminta);
  instruksi.forEach((isi, i) => baris.push(`${i + 1}. ${isi}`));
  baris.push(paket.penutup, "", paket.labelTeks, "---", teks, "---");
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
      ? prompt.slice(0, provider.batasKarakter) + paketPrompt(k).penandaPotong
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
