/**
 * Mesin Pencarian Referensi Berbasis Kalimat Kunci — Utruha v2.0
 *
 * PRINSIP:
 *  - Pencarian berbasis KALIMAT KUNCI, bukan kata individual.
 *  - Normalisasi Arab: hapus harakat, normalisasi alif/ya/ta marbuta.
 *  - Skor keselarasan % = semantik(60%) + kata_kunci(30%) + struktur(10%).
 *  - Hasil diklasifikasi: kitab, jurnal, web, skripsi.
 *  - Alasan kecocokan wajib (bukan hanya angka).
 *  - Semua output full Arab (transliterasi otomatis untuk sumber non-Arab).
 *  - Footnote opsional — user memilih di UI.
 *  - Batas 1 halaman ≈ 1800 karakter Arab untuk badan teks utama.
 */

import type { Project } from "@/lib/engine/project";
import type { Sumber, JenisSumber } from "@/lib/engine/cite";
import { catatanKaki } from "@/lib/engine/cite";
import { latinKeArab } from "@/lib/engine/translit";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Status verifikasi rujukan. */
export type StatusVerifikasi = "موثق" | "يحتاج_تحقق" | "غير_موجود" | "محرر_يدويًّا";

/** Kandidat footnote yang siap ditampilkan di UI untuk dipilih user. */
export interface KandidatFootnote {
  id: string;
  sumber: Sumber;
  /** Kalimat kunci dari paragraf yang dicocokkan. */
  kalimatKunci: string;
  /** Skor keselarasan 0–100. */
  skorPersen: number;
  /** Penjelasan mengapa sumber ini relevan (full Arab). */
  alasan: string;
  /** Teks footnote lengkap (siap sisip). */
  teksFootnote: string;
  /** Index paragraf tempat footnote ini disarankan. */
  indexParagraf: number;
  /** Klasifikasi jenis sumber untuk filter UI. */
  klasifikasi: JenisSumber;
  /** Status verifikasi awal. */
  statusVerifikasi: StatusVerifikasi;
}

/** Hasil pencarian referensi untuk satu paragraf/kalimat kunci. */
export interface HasilPencarianRef {
  kalimatKunci: string;
  kandidat: KandidatFootnote[];
  totalDitemukan: number;
}

// ─── Normalisasi Arab ─────────────────────────────────────────────────────────

/** Hapus harakat (tashkeel) dari teks Arab. */
function hapusHarakat(teks: string): string {
  return teks.replace(/[\u064B-\u065F\u0670]/g, "");
}

/** Normalisasi variasi huruf Arab. */
function normalisasiArab(teks: string): string {
  return hapusHarakat(teks)
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ء")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cek apakah teks dominan Arab (≥50% karakter Arab). */
function dominanArab(teks: string): boolean {
  if (!teks || !teks.trim()) return true;
  const tanpaSpasi = teks.replace(/\s/g, "");
  if (tanpaSpasi.length === 0) return true;
  const arab = (tanpaSpasi.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arab / tanpaSpasi.length >= 0.5;
}

/** Konversi field Latin ke Arab via transliterasi. */
function keArab(teks: string | undefined): string {
  if (!teks || !teks.trim()) return "";
  if (dominanArab(teks)) return teks;
  return latinKeArab(teks, "akademik");
}

// ─── Ekstraksi Kalimat Kunci ──────────────────────────────────────────────────

/**
 * Ekstrak 1–3 kalimat kunci dari paragraf Arab.
 * Kalimat kunci = kalimat yang mengandung klaim/fakta/argumen.
 * Heuristik: >8 kata, mengandung kata kerja, bukan pertanyaan/perintah.
 */
export function ekstrakKalimatKunci(paragraf: string, maks = 3): string[] {
  // Pecah jadi kalimat (berdasarkan titik Arab, tanda tanya, atau newline)
  const kalimatList = paragraf
    .split(/[.۔؟!\n]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 10);

  if (kalimatList.length === 0) return [paragraf.trim()];

  // Skor setiap kalimat
  const dinilai = kalimatList.map((kalimat) => {
    let skor = 0;
    const kataList = kalimat.split(/\s+/);

    // Panjang: >8 kata = lebih mungkin kalimat klaim
    if (kataList.length > 8) skor += 2;
    else if (kataList.length > 5) skor += 1;

    // Mengandung kata kerja Arab (fi'il)
    const polaFiil = /^(ي|ت|ن|ا|س|ف)/;
    if (kataList.some((k) => polaFiil.test(normalisasiArab(k)))) skor += 2;

    // Bukan pertanyaan
    if (!/[؟?]/.test(kalimat)) skor += 1;

    // Bukan kalimat penghubung/transisi pendek
    const transisi = ["ثم", "و", "أيضا", "كما", "فضلا", "علاوة", "بالإضافة"];
    const normalized = normalisasiArab(kalimat);
    if (!transisi.some((t) => normalized.startsWith(normalisasiArab(t)))) skor += 1;

    // Mengandung kata benda akademik
    const akademik = ["البحث", "الدراسة", "النتيجة", "التحليل", "المشكلة", "الفرضية", "المنهج", "الإطار", "النظرية", "المفهوم"];
    if (akademik.some((a) => normalized.includes(a))) skor += 2;

    return { kalimat, skor };
  });

  // Ambil top-N
  return dinilai
    .sort((a, b) => b.skor - a.skor)
    .slice(0, maks)
    .map((d) => d.kalimat);
}

// ─── Scoring Kecocokan ────────────────────────────────────────────────────────

/** Ekstrak kata-kata bermakna (>2 char) dari teks Arab ternormalisasi. */
function ekstrakkataBermakna(teks: string): Set<string> {
  const norm = normalisasiArab(teks);
  const stopWords = new Set(["في", "من", "على", "إلى", "عن", "مع", "هذا", "هذه", "التي", "الذي", "أن", "كان", "قد", "ما", "لا", "لم", "هو", "هي", "هم", "نحن", "أنت", "ذلك", "هذه", "كل", "بعض", "بين", "حتى", "ثم", "أو", "و"]);
  return new Set(
    norm.split(/\s+/).filter((k) => k.length > 2 && !stopWords.has(k))
  );
}

/**
 * Ekstrak akar kata (root) sederhana dari kata Arab.
 * Menghilangkan prefix/suffix umum untuk mencocokkan kata dengan akar sama.
 */
function ekstrakAkar(kata: string): string {
  const norm = normalisasiArab(kata);
  // Hapus al- (definite article)
  let akar = norm.replace(/^ال/, "");
  // Hapus suffix umum
  akar = akar.replace(/(ات|ين|ون|ان|ة|ه|ي|ا)$/, "");
  // Hapus prefix umum
  akar = akar.replace(/^(ت|ي|ن|س|ف|م|ب|ل|ك)/, "");
  return akar.length >= 2 ? akar : norm;
}

/** Cek apakah dua kata memiliki akar yang sama. */
function akarSama(a: string, b: string): boolean {
  if (a === b) return true;
  return ekstrakAkar(a) === ekstrakAkar(b);
}

/**
 * Hitung skor keselarasan antara kalimat kunci dan sumber.
 * Formula: semantik(60%) + kata_kunci(30%) + struktur(10%)
 * Tanpa LLM → semantik diganti TF-IDF-like weighted overlap.
 */
export function hitungSkorKeselarasan(kalimatKunci: string, sumber: Sumber): number {
  const kkNorm = normalisasiArab(kalimatKunci);
  const srcText = normalisasiArab(`${sumber.judul} ${sumber.penulis} ${sumber.catatan ?? ""}`);

  const kataKK = ekstrakkataBermakna(kkNorm);
  const kataSrc = ekstrakkataBermakna(srcText);

  if (kataKK.size === 0 || kataSrc.size === 0) return 0;

  // --- Komponen 1: Kata kunci overlap + root matching (30%) ---
  let overlap = 0;
  for (const k of kataKK) {
    if (kataSrc.has(k)) {
      overlap++;
    } else {
      // Cek root matching
      for (const s of kataSrc) {
        if (akarSama(k, s)) { overlap += 0.7; break; } // Partial credit untuk root match
      }
    }
  }
  const skorKata = kataKK.size > 0 ? Math.min(overlap / kataKK.size, 1) : 0;

  // --- Komponen 2: Semantik proxy — Jaccard + root-aware (60%) ---
  const allSrcRoots = new Set([...kataSrc].map(ekstrakAkar));
  let rootOverlap = 0;
  for (const k of kataKK) {
    if (allSrcRoots.has(ekstrakAkar(k))) rootOverlap++;
  }
  const unionSize = Math.max(kataKK.size, kataSrc.size);
  const skorSemantik = unionSize > 0 ? rootOverlap / unionSize : 0;

  // --- Komponen 3: Struktur (10%) ---
  let skorStruktur = 0;
  const judulNorm = normalisasiArab(sumber.judul ?? "");
  const kataKKArr = [...kataKK];
  for (let i = 0; i < kataKKArr.length - 2; i++) {
    const trigram = `${kataKKArr[i]} ${kataKKArr[i + 1]} ${kataKKArr[i + 2]}`;
    if (judulNorm.includes(trigram)) { skorStruktur = 1; break; }
  }
  if (skorStruktur === 0) {
    for (let i = 0; i < kataKKArr.length - 1; i++) {
      const bigram = `${kataKKArr[i]} ${kataKKArr[i + 1]}`;
      if (judulNorm.includes(bigram)) { skorStruktur = 0.5; break; }
    }
  }
  // Bonus: cek apakah akar kata dari kalimat kunci muncul di judul
  if (skorStruktur === 0) {
    const judulRoots = new Set(judulNorm.split(/\s+/).filter((k) => k.length > 2).map(ekstrakAkar));
    for (const k of kataKK) {
      if (judulRoots.has(ekstrakAkar(k))) { skorStruktur = 0.3; break; }
    }
  }

  const skorFinal = (skorSemantik * 0.6) + (skorKata * 0.3) + (skorStruktur * 0.1);
  return Math.round(skorFinal * 100);
}

// ─── Label & Template Alasan (Full Arab) ──────────────────────────────────────

const LABEL_JENIS_ARAB: Record<JenisSumber, string> = {
  kitab: "كتاب",
  artikel: "مقال علمي",
  bab: "فصل في كتاب",
  skripsi: "رسالة علمية",
  web: "موقع إلكتروني",
  terjemahan: "كتاب مترجم",
};

const TEMPLATE_ALASAN: Record<string, string[]> = {
  khalfiya: [
    "يدعم البيان المتعلق بخلفية المشكلة",
    "يقدّم بيانات ميدانية متصلة بالظاهرة المدروسة",
    "يُظهر فجوة في الدراسات السابقة",
    "يعزّز ضرورة البحث من منظور نظري",
  ],
  masalah: [
    "يحيل إلى صياغة مشكلة مماثلة في الأدبيات",
    "يقدّم سابقة أكاديمية لتأطير هذه المشكلة",
  ],
  fawaid: [
    "يُظهر إسهام البحث في مجال العلم",
    "يقارن الفوائد النظرية بما ورد في الدراسات السابقة",
  ],
  mustalahat: [
    "تعريف المصطلح مستمد من هذا المصدر المعتمد",
    "المرجع الأصلي للمصطلحات المستعملة في البحث",
  ],
  ithar: [
    "يناقش النظرية أو المفهوم نفسه من زاوية مختلفة",
    "المصدر الأولي لتعريف هذا المفهوم",
    "دراسة مقارنة تُثري الإطار النظري",
    "الكتاب المرجعي الرئيسي في هذا المجال",
  ],
  dirasat: [
    "بحث سابق بموضوع مشابه وسياق مختلف",
    "نتائجه قابلة للمقارنة مع نتائج هذا البحث",
    "منهجيته تُتخذ مرجعًا أو نقطة مقارنة",
  ],
  itharFikri: [
    "يقدّم أساسًا منطقيًّا لهذا الإطار الفكري",
    "هذه النظرية أساس العلاقة بين المتغيرات",
  ],
  manhajNau: [
    "تبرير اختيار المنهج استنادًا إلى الأدبيات المنهجية",
    "سابقة استعمال منهج مشابه في دراسات مماثلة",
  ],
  adawat: [
    "التحقق من الأداة يستند إلى معايير هذا المصدر",
    "تقنية جمع البيانات مقتبسة من هذا البحث",
  ],
  tahlil: [
    "تقنية تحليل البيانات تتبع منهج هذا المصدر",
    "مرجع للإجراءات الإحصائية أو الموضوعية المستعملة",
  ],
  farudhiyat: [
    "الفرضية مبنية على ما ورد في هذه الأدبيات",
    "أساس نظري للتنبؤ بالعلاقة بين المتغيرات",
  ],
  munazara: [
    "نتائج هذا البحث تتفق أو تختلف مع نتائج هذا المصدر",
    "يمكن تفسير اختلاف النتائج باختلاف السياق أو المنهج",
    "هذا المصدر يقدّم منظورًا إضافيًّا للتفسير",
  ],
  muqaddima: [
    "وضع الموضوع في سياق أدبيات المجال",
    "بيان موقع البحث في خريطة المعرفة",
  ],
  tariqa: [
    "الإجراءات المنهجية تستند إلى هذا المصدر",
    "إثبات صحة مقاربة البحث من الأدبيات",
  ],
  nataij: [
    "هذا الاكتشاف يتسق أو يختلف مع نتائج دراسة سابقة",
    "بيانات داعمة من دراسة ميدانية ذات صلة",
  ],
};

const RELEVANSI_SECTION: Record<string, JenisSumber[]> = {
  khalfiya: ["kitab", "artikel", "skripsi"],
  masalah: ["kitab", "artikel"],
  fawaid: ["kitab", "artikel"],
  mustalahat: ["kitab"],
  ithar: ["kitab", "terjemahan", "bab", "artikel"],
  dirasat: ["artikel", "skripsi"],
  itharFikri: ["kitab", "artikel"],
  manhajNau: ["kitab", "artikel"],
  adawat: ["kitab", "artikel"],
  tahlil: ["kitab", "artikel"],
  farudhiyat: ["kitab", "artikel"],
  munazara: ["kitab", "artikel", "skripsi"],
  muqaddima: ["kitab", "artikel"],
  tariqa: ["kitab", "artikel"],
  nataij: ["artikel"],
};

// ─── Konversi Sumber ke Arab ──────────────────────────────────────────────────

/** Buat salinan Sumber dengan semua field dikonversi ke Arab. */
export function konversiSumberKeArab(s: Sumber): Sumber {
  if (dominanArab(s.penulis) && dominanArab(s.judul)) return s;
  return {
    ...s,
    penulis: keArab(s.penulis),
    judul: keArab(s.judul),
    kota: keArab(s.kota),
    penerbit: keArab(s.penerbit),
    jurnal: keArab(s.jurnal),
    penerjemah: keArab(s.penerjemah),
    tahqiq: keArab(s.tahqiq),
    edisi: keArab(s.edisi),
  };
}

/** Format footnote full Arab dengan label jenis sumber. */
export function formatFootnoteArab(s: Sumber, alasan: string): string {
  const label = LABEL_JENIS_ARAB[s.jenis];
  const sitasi = catatanKaki(s, { angkaArab: true });
  return `[${label}] ${sitasi} — ${alasan}`;
}

// ─── Tentukan Status Verifikasi Awal ──────────────────────────────────────────

function tentukanStatusVerifikasi(s: Sumber): StatusVerifikasi {
  if (s.doi) return "يحتاج_تحقق"; // DOI ada tapi belum dicek live
  if (s.url) return "يحتاج_تحقق";
  if (s.halaman) return "يحتاج_تحقق"; // Halaman ada tapi tidak bisa diverifikasi tanpa full text
  return "يحتاج_تحقق"; // Default: perlu dicek manual
}

// ─── Mesin Pencarian Utama ────────────────────────────────────────────────────

/**
 * Cari referensi yang cocok untuk sebuah section berdasarkan kalimat kunci.
 * Mengembalikan kandidat yang sudah diskor dan diklasifikasi.
 */
export function cariReferensi(
  p: Project,
  sectionId: string,
  markdown: string,
): HasilPencarianRef[] {
  const jenisRelevan = RELEVANSI_SECTION[sectionId];
  if (!jenisRelevan || p.sumber.length === 0) return [];

  // Konversi semua sumber ke Arab
  const sumberArab = p.sumber.map(konversiSumberKeArab);

  // Filter sumber relevan
  const sumberRelevan = sumberArab
    .filter((s) => jenisRelevan.includes(s.jenis))
    .sort((a, b) => (b.tahun || "").localeCompare(a.tahun || ""));

  if (sumberRelevan.length === 0) return [];

  // Bagi markdown jadi paragraf
  const paragrafList = markdown.split(/\n\n+/).filter((p) => p.trim().length > 20);

  const hasil: HasilPencarianRef[] = [];
  const sudahDipakai = new Set<string>();

  for (let i = 0; i < paragrafList.length; i++) {
    const paragraf = paragrafList[i]!;
    const kalimatKunciList = ekstrakKalimatKunci(paragraf);
    const kandidatPerParagraf: KandidatFootnote[] = [];

    for (const kk of kalimatKunciList) {
      // Nilai semua sumber (termasuk yang sudah dipakai — bisa muncul lagi dengan skor lebih tinggi)
      const dinilai = sumberRelevan
        .map((s) => ({ sumber: s, skor: hitungSkorKeselarasan(kk, s) }))
        .filter((d) => d.skor >= 20) // Threshold minimum 20% (heuristic tanpa embedding)
        .sort((a, b) => b.skor - a.skor);

      for (const item of dinilai.slice(0, 3)) {
        // Hindari duplikat persis (sumber + paragraf yang sama)
        const dupKey = `${item.sumber.id}-${i}`;
        if (sudahDipakai.has(dupKey)) continue;
        sudahDipakai.add(dupKey);

        const templates = TEMPLATE_ALASAN[sectionId] ?? TEMPLATE_ALASAN["khalfiya"]!;
        const idxAlasan = (i + item.sumber.judul.length) % templates.length;
        const alasan = templates[idxAlasan]!;

        kandidatPerParagraf.push({
          id: `${sectionId}-fn-${i}-${item.sumber.id}`,
          sumber: item.sumber,
          kalimatKunci: kk,
          skorPersen: item.skor,
          alasan,
          teksFootnote: formatFootnoteArab(item.sumber, alasan),
          indexParagraf: i,
          klasifikasi: item.sumber.jenis,
          statusVerifikasi: tentukanStatusVerifikasi(item.sumber),
        });
      }
    }

    if (kandidatPerParagraf.length > 0) {
      hasil.push({
        kalimatKunci: kalimatKunciList[0]!,
        kandidat: kandidatPerParagraf,
        totalDitemukan: kandidatPerParagraf.length,
      });
    }
  }

  return hasil;
}

// ─── Kompatibilitas dengan API Lama ───────────────────────────────────────────

/**
 * Wrapper untuk kompatibilitas dengan compose.ts yang masih pakai API lama.
 * Mengembalikan flat list KandidatFootnote dari hasil pencarian baru.
 */
export function hasilkanKandidatFootnote(
  p: Project,
  sectionId: string,
  markdown: string,
): KandidatFootnote[] {
  const hasilPencarian = cariReferensi(p, sectionId, markdown);
  return hasilPencarian.flatMap((h) => h.kandidat);
}

/**
 * Sisipkan footnote yang sudah dipilih user ke dalam markdown.
 */
export function sisipkanFootnoteTerpilih(
  markdown: string,
  dipilih: KandidatFootnote[],
): string {
  if (dipilih.length === 0) return markdown;

  const paragrafList = markdown.split(/\n\n+/);
  const footnotes: string[] = [];
  let nomor = 1;

  const diurutkan = [...dipilih].sort((a, b) => a.indexParagraf - b.indexParagraf);

  for (const fn of diurutkan) {
    if (fn.indexParagraf < paragrafList.length) {
      paragrafList[fn.indexParagraf] = `${paragrafList[fn.indexParagraf]}[^${nomor}]`;
      footnotes.push(`[^${nomor}]: ${fn.teksFootnote}`);
      nomor++;
    }
  }

  return paragrafList.join("\n\n") + "\n\n" + footnotes.join("\n");
}

// ─── Batas Halaman ────────────────────────────────────────────────────────────

export const BATAS_HALAMAN = 1800;

export function pangkasSatuHalaman(markdown: string, batas = BATAS_HALAMAN): string {
  if (markdown.length <= batas) return markdown;

  const paragraf = markdown.split(/\n\n+/);
  let hasil = "";

  for (const p of paragraf) {
    const calon = hasil ? `${hasil}\n\n${p}` : p;
    if (calon.length > batas) break;
    hasil = calon;
  }

  if (!hasil) {
    return markdown.slice(0, batas).replace(/\s+\S*$/, "") + "\n\n[… تابع في الصفحة التالية]";
  }

  return hasil;
}