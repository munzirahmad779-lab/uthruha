/**
 * Pencarian berbasis KONSEP (mode "makna").
 *
 * PENTING — apa ini dan apa bukan:
 * Ini BUKAN pemahaman bahasa. Tidak ada model bahasa, tidak ada embedding.
 * Semua perhitungan deterministik dan bisa diulang persis.
 *
 * Cara kerjanya:
 *  1. Paragraf dipecah menjadi kata konsep (kata fungsi dibuang).
 *  2. Tiap konsep dicari ke Turath (yang mencocokkan frasa persis).
 *  3. Untuk setiap halaman hasil, dihitung berapa banyak konsep paragraf
 *     yang muncul di JUDUL BAB (`meta.headings`) dan di teks halaman.
 *
 * Judul bab berbobot jauh lebih tinggi daripada teks, karena judul
 * menunjukkan topik bahasan, sedangkan teks bisa sekadar menyebut kata.
 * Dari situ muncul halaman yang membahas topik yang sama meski tidak
 * memakai satu kata pun dari paragraf asal.
 */

import { normalisasi } from "@/lib/refs/score";

/**
 * Buang imbuhan depan sehingga "والمكي" → "مكي", "المدني" → "مدني",
 * "بالقواعد" → "قواعد". Tanpa ini, "والمكي" tidak pernah cocok dengan
 * judul bab yang menulis "المكي".
 */
function tanpaAl(t: string): string {
  let s = t;
  // Imbuhan sambung/awalan yang menempel sebelum ال.
  s = s.replace(/^[وفبكل](?=[\u0600-\u06FF]{3,})/u, "");
  // Kata sandang.
  s = s.replace(/^ال(?=[\u0600-\u06FF]{2,})/u, "");
  s = s.replace(/^[وفبكل](?=[\u0600-\u06FF]{3,})/u, "");
  return s;
}

/**
 * Kata yang TIDAK menandai topik kitab.
 *
 * Dua kelompok:
 * 1. Kata fungsi biasa (في، من، على …).
 * 2. Kata wacana/metodologis — ini yang paling merusak kalau lolos. Kata
 *    seperti «أمثلة», «حديثه», «وقع», «أسلوب» muncul di hampir semua kitab
 *    sebagai bahasa penyusun, bukan sebagai pokok bahasan. Membiarkannya
 *    membuat hasil didominasi kitab fikih yang memakai «أمثلة» di judul bab.
 */
const STOP_KONSEP = new Set(
  `في من على الى عن ان كان قد ما لا ثم او هو هي به له بها لها منه عليه فيه بين كل
   بعض غير كما اذا حتى لم لن ولا ومن وفي وعلى هذا هذه ذلك التي الذي هناك حيث
   عند وقد لكن لكنه فان وإن بل اما إما ايضا كذلك هكذا فيها منها منهم بعد قبل
   حين وقت كان يكون تكون هؤلاء اولئك عليهم اليه اليها
   أمثلة مثال أمثله أخرى اخر حديثه تحدث ذكره ذكر بيان بينانه أورد ورد اتفاق اتفق
   خلاف اختلف وقع يقع مبين مبينا واضح أسلوب اهتمام يهتم مؤلف مصنف ربط يربط
   قواعد قاعدة نظرية نظري تطبيقية تطبيقي كشف يكشف عرض يعرض طريقة منهج منهجية
   باب فصل مبحث مطلب مسألة تنبيه فائدة ملاحظة تعليق إشارة جزء مجلد صفحة
   الأول الثاني الثالث الرابع الخامس السادس السابع الثامن التاسع العاشر
   كثير قليل جميع سائر نحو مثل ذلك جدا فقط اي
   وما ومما بينهم بينهما فيهم فيها منهم منهما اليه اليها عليه عليها اليهم
   ويكشف يكشف ويكون وكان وقد وهي وهو فهذا وهذا وذلك وتلك
   بربط يربط ارتباط ربط بامثله بامثلتها امثلتها بامثلته`
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => tanpaAl(normalisasi(s))),
);

/**
 * Kata konsep dari sebuah paragraf, urut sesuai kemunculan pertama.
 * Kata yang sangat umum di dalam paragraf itu sendiri (mis. "المؤلف")
 * tetap disimpan — penyaringannya terjadi saat skor, bukan di sini.
 */
export function ekstrakKonsep(teks: string, maks = 12): string[] {
  const kata = normalisasi(teks)
    .split(" ")
    .map((k) => tanpaAl(k))
    .filter((k) => k.length >= 3 && !STOP_KONSEP.has(k));

  const unik: string[] = [];
  for (const k of kata) {
    if (!unik.includes(k)) unik.push(k);
    if (unik.length >= maks) break;
  }
  return unik;
}

/**
 * Cocokkan satu istilah (bisa 1..5 kata) di dalam teks yang sudah dinormalisasi.
 *
 * Istilah dari LLM biasanya berbentuk frasa ("المدني والمكي"), sedangkan
 * istilah deterministik berbentuk satu kata. Keduanya harus jalan:
 *  - Frasa dicoba utuh lebih dulu; bila tidak ada, dinilai per kata.
 *  - Setiap kata dibersihkan imbuhannya supaya "والمكي" cocok "المكي".
 */
function cocokIstilah(istilah: string, teks: string): { utuh: boolean; bagian: number; total: number } {
  const kata = istilah
    .split(/\s+/)
    .map((k) => tanpaAl(normalisasi(k)))
    .filter(Boolean);

  if (kata.length === 0) return { utuh: false, bagian: 0, total: 0 };
  if (kata.length === 1) {
    const ada = teks.includes(kata[0]);
    return { utuh: ada, bagian: ada ? 1 : 0, total: 1 };
  }

  // Frasa utuh: paling kuat, menandakan topik yang benar-benar sama.
  if (teks.includes(kata.join(" "))) {
    return { utuh: true, bagian: kata.length, total: kata.length };
  }

  let bagian = 0;
  for (const k of kata) if (teks.includes(k)) bagian++;
  return { utuh: false, bagian, total: kata.length };
}

export interface SkorKonsep {
  /** Berapa konsep paragraf muncul di judul bab. */
  diHeading: number;
  /** Berapa konsep paragraf muncul di teks halaman. */
  diTeks: number;
  /** Jumlah konsep yang dicari (pembagi). */
  total: number;
  /** 0..1 — angka tampil apa adanya, bukan "keyakinan AI". */
  skor: number;
  /** Konsep yang benar-benar ditemukan di judul bab. */
  konsepCocok: string[];
}

/**
 * Hitung seberapa besar halaman ini membahas konsep paragraf.
 * Judul bab diberi bobot 3x teks: judul = topik, teks = penyebutan.
 *
 * Istilah boleh berupa frasa. Frasa yang muncul UTUH di judul bab diberi
 * nilai penuh; frasa yang hanya sebagian katanya muncul diberi nilai
 * sebagian — supaya "المدني والمكي" mengalahkan "المكي" saja.
 */
export function skorKonsep(
  konsep: string[],
  headings: string[],
  teks: string,
): SkorKonsep {
  if (konsep.length === 0) {
    return { diHeading: 0, diTeks: 0, total: 0, skor: 0, konsepCocok: [] };
  }

  const h = normalisasi(headings.join(" "));
  const t = normalisasi(teks);

  let nilaiHeading = 0;
  let nilaiTeks = 0;
  let diHeading = 0;
  let diTeks = 0;
  const cocok: string[] = [];

  for (const k of konsep) {
    const diH = cocokIstilah(k, h);
    const diT = cocokIstilah(k, t);

    // Frasa utuh bernilai 1.0; sebagian bernilai proporsi kata yang muncul,
    // tetapi hanya dihitung bila lebih dari separuh katanya ada.
    const nilaiH = diH.utuh ? 1 : diH.bagian > diH.total / 2 ? diH.bagian / diH.total : 0;
    const nilaiT = diT.utuh ? 1 : diT.bagian > diT.total / 2 ? diT.bagian / diT.total : 0;

    if (nilaiH > 0) {
      diHeading++;
      cocok.push(k);
    }
    if (nilaiT > 0) diTeks++;
    nilaiHeading += nilaiH;
    nilaiTeks += nilaiT;
  }

  // Bobot: judul bab 3x, teks 1x. Dibagi (total * 4) agar skala 0..1.
  const mentah = nilaiHeading * 3 + nilaiTeks * 1;
  const maksimal = konsep.length * 4;
  const skor = maksimal > 0 ? Math.min(1, mentah / maksimal) : 0;

  // Urutkan istilah yang cocok: frasa utuh di judul bab lebih dulu.
  cocok.sort((a, b) => {
    const ua = cocokIstilah(a, h).utuh ? 1 : 0;
    const ub = cocokIstilah(b, h).utuh ? 1 : 0;
    return ub - ua || a.split(/\s+/).length - b.split(/\s+/).length;
  });

  return {
    diHeading,
    diTeks,
    total: konsep.length,
    skor: Number(skor.toFixed(3)),
    konsepCocok: cocok.slice(0, 8),
  };
}
