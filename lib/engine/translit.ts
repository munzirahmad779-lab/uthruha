/**
 * Transliterasi dua arah untuk kebutuhan naskah akademik berbahasa Arab:
 * nama orang, nama tempat, dan istilah.
 *
 * Catatan penting: transliterasi nama tidak pernah tunggal kebenarannya.
 * Alat ini menyusun bentuk yang paling lazim dipakai, dan hasilnya tetap
 * bisa disunting manual.
 */

export type ModeLatin = "akademik" | "fonetis";
export type GayaArab = "sederhana" | "ilmiah";

/** Digraph Latin Indonesia menjadi huruf Arab (dicocokkan dari yang terpanjang). */
const DIGRAPH: [string, string][] = [
  ["ng", "نغ"],
  ["ny", "ني"],
  ["sy", "ش"],
  ["kh", "خ"],
  ["ts", "ث"],
  ["th", "ط"],
  ["dz", "ذ"],
  ["dh", "ض"],
  ["sh", "ص"],
  ["zh", "ظ"],
  ["ch", "تش"],
  ["gh", "غ"],
  ["aa", "ا"],
  ["ii", "ي"],
  ["uu", "و"],
  ["ai", "اي"],
  ["au", "او"],
];

const HURUF: Record<string, string> = {
  a: "",
  b: "ب",
  c: "ك",
  d: "د",
  e: "",
  f: "ف",
  g: "غ",
  h: "ه",
  i: "",
  j: "ج",
  k: "ك",
  l: "ل",
  m: "م",
  n: "ن",
  o: "",
  p: "ب",
  q: "ق",
  r: "ر",
  s: "س",
  t: "ت",
  u: "",
  v: "ف",
  w: "و",
  x: "كس",
  y: "ي",
  z: "ز",
  ä: "ا",
  é: "ي",
  è: "ي",
  ó: "و",
};

const VOKAL = new Set(["a", "i", "u", "e", "o", "ä", "é", "è", "ó"]);
const VOKAL_AWAL: Record<string, string> = {
  a: "أ",
  i: "إ",
  u: "أ",
  e: "إ",
  o: "أ",
  ä: "أ",
  é: "إ",
  è: "إ",
  ó: "أ",
};
const VOKAL_PANJANG: Record<string, string> = {
  a: "ا",
  i: "ي",
  u: "و",
  e: "ي",
  o: "و",
  ä: "ا",
  é: "ي",
  è: "ي",
  ó: "و",
};

const SHADDA = "\u0651";

function tulisKata(kata: string, mode: ModeLatin): string {
  const s = kata.toLowerCase();
  let out = "";
  let i = 0;
  let hurufTerakhir = "";
  let vokalTerakhir = "";

  while (i < s.length) {
    const sisa = s.slice(i);
    const digraf = DIGRAPH.find(([l]) => sisa.startsWith(l));
    if (digraf) {
      const [, ar] = digraf;
      out += ar;
      hurufTerakhir = ar;
      vokalTerakhir = "";
      i += digraf[0].length;
      continue;
    }

    const c = s[i];
    if (VOKAL.has(c)) {
      const diAwal = out.length === 0;
      const diAkhir = i === s.length - 1;
      const setelahHuruf = hurufTerakhir !== "";
      if (diAwal) {
        out += VOKAL_AWAL[c] ?? "أ";
        hurufTerakhir = "";
        vokalTerakhir = c;
      } else if (diAkhir) {
        out += VOKAL_PANJANG[c] ?? "ا";
        vokalTerakhir = c;
      } else if (mode === "fonetis") {
        out += VOKAL_PANJANG[c] ?? "";
        vokalTerakhir = c;
      } else if (!setelahHuruf) {
        out += VOKAL_PANJANG[c] ?? "";
        vokalTerakhir = c;
      } else {
        vokalTerakhir = c;
      }
      i += 1;
      continue;
    }

    const ar = HURUF[c];
    if (ar === undefined) {
      out += c;
      hurufTerakhir = "";
      vokalTerakhir = "";
      i += 1;
      continue;
    }

    // Dua konsonan identik berurutan: shadda pada huruf pertama.
    if (ar === hurufTerakhir && vokalTerakhir === "" && out.length > 0) {
      out += SHADDA;
      i += 1;
      continue;
    }

    out += ar;
    hurufTerakhir = ar;
    vokalTerakhir = "";
    i += 1;
  }

  return out;
}

export function latinKeArab(teks: string, mode: ModeLatin = "akademik"): string {
  return teks
    .split(/(\s+)/)
    .map((bagian) => {
      if (/^\s+$/.test(bagian) || bagian.length === 0) return bagian;
      return bagian.replace(/[A-Za-zÀ-ÿ'\u2019]+/g, (kata) => {
        const apostrof = /['\u2019]/.test(kata);
        const bersih = kata.replace(/['\u2019]/g, "");
        const hasil = tulisKata(bersih, mode);
        return apostrof && !hasil.startsWith("ع") ? "ع" + hasil.replace(/^[أإ]/, "") : hasil;
      });
    })
    .join("");
}

/** Peta huruf Arab ke Latin, dua gaya. */
const ARAB_LATIN: Record<string, { s: string; i: string }> = {
  ا: { s: "a", i: "ā" },
  أ: { s: "a", i: "ʾa" },
  إ: { s: "i", i: "ʾi" },
  آ: { s: "aa", i: "ā" },
  ب: { s: "b", i: "b" },
  ت: { s: "t", i: "t" },
  ث: { s: "ts", i: "th" },
  ج: { s: "j", i: "j" },
  ح: { s: "h", i: "ḥ" },
  خ: { s: "kh", i: "kh" },
  د: { s: "d", i: "d" },
  ذ: { s: "dz", i: "dh" },
  ر: { s: "r", i: "r" },
  ز: { s: "z", i: "z" },
  س: { s: "s", i: "s" },
  ش: { s: "sy", i: "sh" },
  ص: { s: "sh", i: "ṣ" },
  ض: { s: "dh", i: "ḍ" },
  ط: { s: "th", i: "ṭ" },
  ظ: { s: "zh", i: "ẓ" },
  ع: { s: "'", i: "ʿ" },
  غ: { s: "gh", i: "gh" },
  ف: { s: "f", i: "f" },
  ق: { s: "q", i: "q" },
  ك: { s: "k", i: "k" },
  ل: { s: "l", i: "l" },
  م: { s: "m", i: "m" },
  ن: { s: "n", i: "n" },
  ه: { s: "h", i: "h" },
  و: { s: "w", i: "w" },
  ي: { s: "y", i: "y" },
  ى: { s: "a", i: "ā" },
  ة: { s: "h", i: "h" },
  ء: { s: "'", i: "ʾ" },
  ؤ: { s: "u'", i: "ʾu" },
  ئ: { s: "i'", i: "ʾi" },
};

const HARAKAT = /[\u064B-\u0652\u0670]/g;

/** Istilah yang paling sering muncul dan paling sering salah ditransliterasi. */
const KAMUS: [string, string][] = [
  ["القرآن الكريم", "Al-Qur'an al-Karim"],
  ["القرآن", "Al-Qur'an"],
  ["الحديث", "hadis"],
  ["السنة", "sunnah"],
  ["الفقه", "fikih"],
  ["أصول الفقه", "ushul fikih"],
  ["التفسير", "tafsir"],
  ["التربية", "tarbiyah"],
  ["الشريعة", "syariah"],
  ["المقاصد", "maqashid"],
  ["الاجتهاد", "ijtihad"],
  ["الفتوى", "fatwa"],
  ["الوقف", "wakaf"],
  ["الزكاة", "zakat"],
  ["الربا", "riba"],
  ["الإجازة", "ijazah"],
  ["السند", "sanad"],
  ["المتن", "matan"],
  ["الرواية", "riwayat"],
  ["الدراية", "dirayah"],
  ["الإسناد", "isnad"],
  ["الصحابة", "sahabat"],
  ["التابعون", "tabi'in"],
  ["الخلفاء الراشدون", "khulafa' ar-rasyidin"],
  ["المذهب", "mazhab"],
  ["الأشعرية", "Asy'ariyah"],
  ["الماتريدية", "Maturidiyah"],
  ["المعتزلة", "Mu'tazilah"],
  ["التصوف", "tasawuf"],
  ["البلاغة", "balaghah"],
  ["النحو", "nahwu"],
  ["الصرف", "sharaf"],
  ["الإعراب", "i'rab"],
  ["المجاز", "majaz"],
  ["الاستعارة", "isti'arah"],
  ["المنطق", "mantiq"],
  ["الاستشراق", "orientalisme"],
  ["الحضارة", "peradaban"],
  ["الدعوة", "dakwah"],
  ["الخطابة", "khatabah"],
  ["البحث الكمي", "penelitian kuantitatif"],
  ["البحث الكيفي", "penelitian kualitatif"],
  ["البحث المختلط", "penelitian campuran"],
  ["الفرضيات", "hipotesis"],
  ["الاستبانة", "angket"],
  ["المقابلة", "wawancara"],
  ["الملاحظة", "observasi"],
  ["العينة", "sampel"],
  ["المجتمع البحثي", "populasi"],
  ["الصدق", "validitas"],
  ["الثبات", "reliabilitas"],
  ["التثليث", "triangulasi"],
  ["الخلاصة", "kesimpulan"],
  ["المقدمة", "pendahuluan"],
  ["المراجع", "daftar rujukan"],
  ["المصادر", "sumber"],
  ["الملخص", "abstrak"],
  ["الإطار النظري", "kerangka teori"],
];

const SYAMSIYAH = new Set(["ت", "ث", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ل", "ن"]);

export function arabKeLatin(teks: string, gaya: GayaArab = "sederhana"): string {
  const k = gaya === "ilmiah" ? "i" : "s";
  let hasil = teks.replace(HARAKAT, "");

  for (const [ar, lat] of KAMUS) {
    const re = new RegExp(ar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    hasil = hasil.replace(re, lat);
  }

  // Alif lam: sesuaikan dengan aturan lam syamsiyah.
  hasil = hasil.replace(
    /(?<![\p{L}])ال([\u0621-\u064A])([\u0621-\u064A]*)/gu,
    (_m, awal: string, sisa: string) => {
      const latAwal = ARAB_LATIN[awal]?.[k] ?? awal;
      const sisaLat = Array.from(sisa)
        .map((c) => ARAB_LATIN[c]?.[k] ?? c)
        .join("");
      if (SYAMSIYAH.has(awal)) {
        return `a${latAwal}-${latAwal}${sisaLat}`;
      }
      return `al-${latAwal}${sisaLat}`;
    },
  );

  return Array.from(hasil)
    .map((c) => ARAB_LATIN[c]?.[k] ?? c)
    .join("");
}
