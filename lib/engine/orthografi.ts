export type Tingkat = "info" | "saran" | "kritis";

export interface Temuan {
  id: string;
  aturan: string;
  aturanAr: string;
  tingkat: Tingkat;
  /** Potongan teks yang bermasalah. */
  kutipan: string;
  /** Usulan perbaikan (boleh berupa penjelasan bila tidak ada saran tunggal). */
  saran: string;
  /** Posisi karakter pada teks asli. */
  index: number;
}

export interface LaporanOrtografi {
  temuan: Temuan[];
  statistik: {
    karakter: number;
    kata: number;
    kalimat: number;
    paragraf: number;
    kataArab: number;
    kataLatin: number;
    rasioArab: number;
    berharakat: number;
    halamanPerkiraan: number;
  };
}

const ARABIC_LETTER = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/;
const HARAKAT = /[\u064B-\u0652\u0670\u0640]/;

/** Ejaan baku yang sering salah ketika mengetik cepat di kibor Latin/Arab. */
const KOREKSI: { salah: RegExp; benar: string; ket: string }[] = [
  { salah: /(?<![\p{L}\p{N}])انشاء\s+الله(?![\p{L}\p{N}])/gu, benar: "إن شاء الله", ket: "Hamzah kasrah + penulisan terpisah «إن شاء الله»" },
  { salah: /(?<![\p{L}\p{N}])ان\s+شاء\s+الله(?![\p{L}\p{N}])/gu, benar: "إن شاء الله", ket: "Hamzah kasrah pada «إن»" },
  { salah: /(?<![\p{L}\p{N}])باذن\s+الله(?![\p{L}\p{N}])/gu, benar: "بإذن الله", ket: "Hamzah kasrah pada «بإذن»" },
  { salah: /(?<![\p{L}\p{N}])الاسلام(?![\p{L}\p{N}])/gu, benar: "الإسلام", ket: "Hamzah kasrah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الايمان(?![\p{L}\p{N}])/gu, benar: "الإيمان", ket: "Hamzah kasrah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الاحسان(?![\p{L}\p{N}])/gu, benar: "الإحسان", ket: "Hamzah kasrah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الاخرة(?![\p{L}\p{N}])/gu, benar: "الآخرة", ket: "Alif mamdudah «آ»" },
  { salah: /(?<![\p{L}\p{N}])الانسان(?![\p{L}\p{N}])/gu, benar: "الإنسان", ket: "Hamzah kasrah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الاخلاق(?![\p{L}\p{N}])/gu, benar: "الأخلاق", ket: "Hamzah fatah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الاصول(?![\p{L}\p{N}])/gu, benar: "الأصول", ket: "Hamzah fatah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الامام(?![\p{L}\p{N}])/gu, benar: "الإمام", ket: "Hamzah kasrah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الاحاديث(?![\p{L}\p{N}])/gu, benar: "الأحاديث", ket: "Hamzah fatah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الادب(?![\p{L}\p{N}])/gu, benar: "الأدب", ket: "Hamzah fatah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الاستاذ(?![\p{L}\p{N}])/gu, benar: "الأستاذ", ket: "Hamzah fatah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الاهمية(?![\p{L}\p{N}])/gu, benar: "الأهمية", ket: "Hamzah fatah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الاثر(?![\p{L}\p{N}])/gu, benar: "الأثر", ket: "Hamzah fatah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الاول(?![\p{L}\p{N}])/gu, benar: "الأول", ket: "Hamzah fatah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الافضل(?![\p{L}\p{N}])/gu, benar: "الأفضل", ket: "Hamzah fatah setelah alif lam" },
  { salah: /(?<![\p{L}\p{N}])الا\s+أن(?![\p{L}\p{N}])/gu, benar: "إلا أن", ket: "«إلا» dengan hamzah kasrah" },
  { salah: /(?<![\p{L}\p{N}])قران(?![\p{L}\p{N}])/gu, benar: "قرآن", ket: "Alif mamdudah «آ» pada «قرآن»" },
  { salah: /(?<![\p{L}\p{N}])القران(?![\p{L}\p{N}])/gu, benar: "القرآن", ket: "Alif mamdudah «آ» pada «القرآن»" },
  { salah: /(?<![\p{L}\p{N}])مسالة(?![\p{L}\p{N}])/gu, benar: "مسألة", ket: "Hamzah pada «مسألة»" },
  { salah: /(?<![\p{L}\p{N}])رايس(?![\p{L}\p{N}])/gu, benar: "رئيس", ket: "Hamzah pada «رئيس»" },
  { salah: /(?<![\p{L}\p{N}])هاذا(?![\p{L}\p{N}])/gu, benar: "هذا", ket: "«هذا» tanpa alif" },
  { salah: /(?<![\p{L}\p{N}])هاذه(?![\p{L}\p{N}])/gu, benar: "هذه", ket: "«هذه» tanpa alif" },
  { salah: /(?<![\p{L}\p{N}])الذى(?![\p{L}\p{N}])/gu, benar: "الذي", ket: "Nama huruf «ي» tidak ditulis dengan alif maqsurah pada «الذي»" },
  { salah: /(?<![\p{L}\p{N}])التى(?![\p{L}\p{N}])/gu, benar: "التي", ket: "«التي» dengan ya" },
  { salah: /(?<![\p{L}\p{N}])هؤلا(?![\p{L}\p{N}])/gu, benar: "هؤلاء", ket: "«هؤلاء» dengan hamzah dan alif mamdudah" },
];

/** Kata berakhiran «ه» yang dalam naskah akademik hampir selalu «ة». */
const TA_MARBUTA_SUSPECT = [
  "مدرسه",
  "مكتبه",
  "جامعه",
  "كليه",
  "اسره",
  "دراسه",
  "مقارنه",
  "تربيه",
  "ثقافه",
  "حضاره",
  "قيمه",
  "مشكله",
  "نتيجه",
  "طريقه",
  "وسيله",
  "نظريه",
  "فرضيه",
];

const PUNCT_LATIN: { salah: RegExp; benar: string; ket: string }[] = [
  { salah: /(?<=\S) +([،؛؟!])/g, benar: "$1", ket: "Tidak ada spasi sebelum tanda baca Arab" },
  { salah: /([،؛؟!])(?=[^\s،؛؟!»)\]])/g, benar: "$1 ", ket: "Perlu satu spasi setelah tanda baca Arab" },
  { salah: /(?<=\S),(?=\s)/g, benar: "،", ket: "Gunakan koma Arab «،» di dalam teks Arab" },
  { salah: /(?<=\S);(?=\s)/g, benar: "؛", ket: "Gunakan titik koma Arab «؛»" },
  { salah: /(?<=\S)\?(?=\s|$)/g, benar: "؟", ket: "Gunakan tanda tanya Arab «؟»" },
  { salah: /\.\.\./g, benar: "…", ket: "Gunakan elipsis «…»" },
  { salah: /(?<=\S) {2,}/g, benar: " ", ket: "Spasi ganda" },
];

function aturanKutipanTeks(teks: string): Temuan[] {
  const out: Temuan[] = [];
  const reg = /(?<![\u0621-\u064A\u0671-\u06D3])([\u0621-\u064A\u0671-\u06D3]+)\s+\1(?![\u0621-\u064A\u0671-\u06D3])/g;
  let m: RegExpExecArray | null;
  while ((m = reg.exec(teks))) {
    out.push({
      id: `ulang-${m.index}`,
      aturan: "Kata terulang",
      aturanAr: "تكرار الكلمة",
      tingkat: "saran",
      kutipan: m[0],
      saran: `Hapus satu pengulangan: «${m[1]}»`,
      index: m.index,
    });
  }
  return out;
}

export function periksaOrtografi(teks: string): LaporanOrtografi {
  const temuan: Temuan[] = [];
  if (teks.trim().length === 0) {
    return {
      temuan,
      statistik: {
        karakter: 0,
        kata: 0,
        kalimat: 0,
        paragraf: 0,
        kataArab: 0,
        kataLatin: 0,
        rasioArab: 0,
        berharakat: 0,
        halamanPerkiraan: 0,
      },
    };
  }

  // 1. Ejaan baku
  for (const k of KOREKSI) {
    if (k.benar === k.salah.source) continue;
    const re = new RegExp(k.salah.source, "gu");
    let m: RegExpExecArray | null;
    while ((m = re.exec(teks))) {
      if (m[0] === k.benar) continue;
      temuan.push({
        id: `ejaan-${m.index}`,
        aturan: "Ejaan baku",
        aturanAr: "الرسم الإملائي",
        tingkat: "kritis",
        kutipan: m[0],
        saran: `${k.benar} — ${k.ket}`,
        index: m.index,
      });
    }
  }

  // 2. Ta marbuta yang ditulis dengan ha
  const kata = teks.split(/[\s،؛.:!؟«»()\[\]{}"']+/);
  let kursor = 0;
  for (const w of kata) {
    const idx = teks.indexOf(w, kursor);
    if (idx >= 0) kursor = idx + w.length;
    const bersih = w.replace(/[\u064B-\u0652]/g, "");
    if (TA_MARBUTA_SUSPECT.includes(bersih)) {
      const usul = bersih.replace(/ه$/, "ة");
      temuan.push({
        id: `ta-${idx}`,
        aturan: "Ta marbuta",
        aturanAr: "التاء المربوطة",
        tingkat: "saran",
        kutipan: w,
        saran: `${usul} — bila yang dimaksud memang ta marbuta (bukan dhamir «ـه»)`,
        index: idx,
      });
    }
  }

  // 3. Tanda baca Arab vs Latin
  for (const p of PUNCT_LATIN) {
    const re = new RegExp(p.salah.source, "gu");
    let m: RegExpExecArray | null;
    while ((m = re.exec(teks))) {
      const sebelum = teks.slice(Math.max(0, m.index - 12), m.index);
      if (!ARABIC_LETTER.test(sebelum + m[0])) continue;
      temuan.push({
        id: `punct-${m.index}`,
        aturan: "Tanda baca",
        aturanAr: "علامات الترقيم",
        tingkat: "info",
        kutipan: m[0] === " " ? "␣␣" : m[0],
        saran: p.ket,
        index: m.index,
      });
    }
  }

  // 4. Kata terulang
  temuan.push(...aturanKutipanTeks(teks));

  // 5. Script campur dalam satu kata
  const campur = /([\u0621-\u064A]+[A-Za-z]+|[A-Za-z]+[\u0621-\u064A]+)/g;
  let mc: RegExpExecArray | null;
  while ((mc = campur.exec(teks))) {
    temuan.push({
      id: `campur-${mc.index}`,
      aturan: "Huruf campur",
      aturanAr: "خلط الحروف",
      tingkat: "kritis",
      kutipan: mc[0],
      saran: "Pisahkan huruf Latin dan Arab — biasanya istilah asing ditulis dalam kurung.",
      index: mc.index,
    });
  }

  // 6. Kurung & kutip tidak seimbang
  const buka = (teks.match(/\(/g) || []).length;
  const tutup = (teks.match(/\)/g) || []).length;
  if (buka !== tutup) {
    temuan.push({
      id: "kurung",
      aturan: "Kurung tidak seimbang",
      aturanAr: "الأقواس",
      tingkat: "kritis",
      kutipan: `( × ${buka}  ) × ${tutup}`,
      saran: "Periksa pasangan tanda kurung.",
      index: 0,
    });
  }
  const quote = (teks.match(/«/g) || []).length;
  const quote2 = (teks.match(/»/g) || []).length;
  if (quote !== quote2) {
    temuan.push({
      id: "kutip",
      aturan: "Kutip «» tidak seimbang",
      aturanAr: "علامات التنصيص",
      tingkat: "saran",
      kutipan: `« × ${quote}  » × ${quote2}`,
      saran: "Lengkapi tanda kutip Arab «…».",
      index: 0,
    });
  }

  // 7. Angka Latin di teks Arab (info)
  const angkaLatin = /\b\d+([.,]\d+)?\b/g;
  let mn: RegExpExecArray | null;
  const angkaTemuan: Temuan[] = [];
  while ((mn = angkaLatin.exec(teks))) {
    // Lewati penanda daftar bernomor ("1.", "2)") agar tidak jadi bising.
    const sebelum = teks.slice(0, mn.index);
    const baris = sebelum.slice(sebelum.lastIndexOf("\n") + 1);
    const sesudah = teks.charAt(mn.index + mn[0].length);
    if (/^\s*$/.test(baris) && (sesudah === "." || sesudah === ")")) continue;
    angkaTemuan.push({
      id: `angka-${mn.index}`,
      aturan: "Angka Latin",
      aturanAr: "الأرقام",
      tingkat: "info",
      kutipan: mn[0],
      saran: "Bila pedoman kampus memakai angka Arab, tulis ٠١٢٣٤٥٦٧٨٩.",
      index: mn.index,
    });
  }
  temuan.push(...angkaTemuan.slice(0, 8));

  // Statistik
  const bersihTanpaHarakat = teks.replace(HARAKAT, "");
  const semuaKata = bersihTanpaHarakat.split(/\s+/).filter(Boolean);
  const kataArab = semuaKata.filter((w) => ARABIC_LETTER.test(w)).length;
  const kataLatin = semuaKata.filter((w) => /[A-Za-z]/.test(w)).length;
  const kalimat = (teks.match(/[.!؟…]+(?=\s|$)/g) || []).length || (bersihTanpaHarakat.trim() ? 1 : 0);
  const paragraf = teks.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length || 1;
  const harakatCount = (teks.match(HARAKAT) || []).length;
  const hurufArab = (teks.match(ARABIC_LETTER) || []).length;

  return {
    temuan: temuan.sort((a, b) => a.index - b.index),
    statistik: {
      karakter: teks.length,
      kata: semuaKata.length,
      kalimat,
      paragraf,
      kataArab,
      kataLatin,
      rasioArab: semuaKata.length ? Math.round((kataArab / semuaKata.length) * 100) : 0,
      berharakat: hurufArab ? Math.round((harakatCount / hurufArab) * 100) : 0,
      halamanPerkiraan: Math.max(1, Math.round(semuaKata.length / 250)),
    },
  };
}

/** Terapkan perbaikan otomatis yang aman (ejaan baku + tanda baca). */
export function perbaikiOtomatis(teks: string): string {
  let hasil = teks;
  for (const k of KOREKSI) {
    if (k.benar === k.salah.source) continue;
    hasil = hasil.replace(new RegExp(k.salah.source, "gu"), (m) =>
      m === k.benar ? m : k.benar,
    );
  }
  for (const p of PUNCT_LATIN) {
    hasil = hasil.replace(new RegExp(p.salah.source, "gu"), (m, g1) => {
      if (p.benar === "$1") return g1 as string;
      if (p.benar === "$1 ") return `${g1} `;
      return p.benar;
    });
  }
  return hasil;
}
