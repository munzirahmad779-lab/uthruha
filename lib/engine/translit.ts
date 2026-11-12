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

/**
 * Kamus nama yang sangat lazim di naskah pengguna dan hampir selalu
 * salah bila disusun huruf demi huruf (mis. Muhammad: h-nya ح dan
 * vokal u-nya hilang di mode akademik, dulu menghasilkan مهمّد).
 * Dicocokkan per kata utuh, tidak peka huruf besar.
 */
const KAMUS_NAMA: Record<string, string> = {
  muhammad: "محمد",
  ahmad: "أحمد",
  fauzan: "فوزان",
  yusuf: "يوسف",
  ibrahim: "إبراهيم",
  ismail: "إسماعيل",
  ishaq: "إسحاق",
  yaqub: "يعقوب",
  musa: "موسى",
  isa: "عيسى",
  harun: "هارون",
  sulaiman: "سليمان",
  dawud: "داود",
  nuh: "نوح",
  adam: "آدم",
  idris: "إدريس",
  hud: "هود",
  salih: "صالح",
  shaleh: "صالح",
  luth: "لوط",
  ayyub: "أيوب",
  yunus: "يونس",
  zakariya: "زكريا",
  yahya: "يحيى",
  ilyas: "إلياس",
  khadijah: "خديجة",
  fatimah: "فاطمة",
  aisyah: "عائشة",
  maryam: "مريم",
  hasan: "حسن",
  husain: "حسين",
  husein: "حسين",
  ali: "علي",
  umar: "عمر",
  utsman: "عثمان",
  usman: "عثمان",
  bakr: "بكر",
  abu: "أبو",
  abdullah: "عبد الله",
  abdurrahman: "عبد الرحمن",
  rahman: "رحمن",
  fauzi: "فوزي",
  fauziah: "فوزية",
  nur: "نور",
  rizqi: "رزقي",
  rizki: "رزقي",
};

export function latinKeArab(teks: string, mode: ModeLatin = "akademik"): string {
  return teks
    .split(/(\s+)/)
    .map((bagian) => {
      if (/^\s+$/.test(bagian) || bagian.length === 0) return bagian;
      return bagian.replace(/[A-Za-zÀ-ÿ'\u2019]+/g, (kata) => {
        const apostrof = /['\u2019]/.test(kata);
        const bersih = kata.replace(/['\u2019]/g, "");
        const dariKamus = KAMUS_NAMA[bersih.toLowerCase()];
        if (dariKamus) return dariKamus;
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

/**
 * Istilah yang paling sering muncul dan paling sering salah ditransliterasi.
 * Elemen ketiga `true` = wajib batas kata (huruf Arab tidak boleh
 * mengikutinya), untuk kata yang berbahaya bila menempel di kata lain:
 * الجامع tidak boleh memakan الجامعة, dst.
 */
const KAMUS: [string, string, boolean?][] = [
  ["القرآن الكريم", "Al-Qur'an al-Karim"],
  ["القرآن", "Al-Qur'an"],
  ["القرطبي", "Al-Qurthubi", true],
  ["الجامع", "Jami'", true],
  ["الأحكام", "ahkam"],
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

const KELAS_TANDA = "\\u064B-\\u0652\\u0670";
const RE_TANDA = /[\u064B-\u0652\u0670]/;
const FATHA = "\u064E";
const KASRA = "\u0650";
const DAMMA = "\u064F";
const FATHATAN = "\u064B";
const DAMMATAN = "\u064C";
const KASRATAN = "\u064D";
const SUKUN = "\u0652";
const TANDA_SYADDAH = "\u0651";
const ALIF_KHANJARIYAH = "\u0670";

/**
 * Transliterasi satu rentang Arab dengan MEMBACA harakatnya.
 *
 * Perbaikan 12 Nov 2026: versi lama membuang semua harakat lebih dulu,
 * jadi teks yang sudah divokalkan pengguna tetap keluar sebagai rangka
 * konsonan (العِلْمُ menjadi al-'lm, bukan al-'ilm). Kini fathah/kasrah/
 * dhammah/tanwin dibaca sebagai vokal, syaddah menggandakan konsonan,
 * huruf mad (ا/و/ي sesudah harakat sejenis) memanjangkan vokal, dan
 * و/ي bersukun sesudah fathah menjadi diftong. Teks TANPA harakat
 * menghasilkan keluaran yang sama persis dengan versi lama.
 */
function translitBertanda(teks: string, k: "s" | "i"): string {
  const chars = Array.from(teks);
  let out = "";
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (RE_TANDA.test(c)) {
      i += 1; // tanda tanpa huruf di depannya: lewati
      continue;
    }
    // ا yang berdiri sendiri (di luar huruf mad yang termakan huruf
    // sebelumnya) adalah hamzah wasl / alif biasa: dibaca "a" pendek
    // di kedua gaya, bukan ā.
    const lat = c === "ا" ? "a" : ARAB_LATIN[c]?.[k];
    if (lat === undefined) {
      out += c;
      i += 1;
      continue;
    }
    // Kumpulkan tanda yang menempel pada huruf ini.
    let j = i + 1;
    const tanda: string[] = [];
    while (j < chars.length && RE_TANDA.test(chars[j])) {
      tanda.push(chars[j]);
      j += 1;
    }
    const ada = (t: string) => tanda.includes(t);

    // Lam proclitic di awal kata tanpa harakat, diikuti hamzah atas
    // (لأحكام، لأصول): partikel li- yang kasrahnya memang lazim tidak
    // ditulis. Dulu keluar "lahkam" karena kasrah itu hilang. Hanya
    // berlaku bila lam tidak membawa harakatnya sendiri.
    if (
      c === "ل" &&
      tanda.length === 0 &&
      (i === 0 || !/[\u0621-\u064A\u064B-\u0652\u0670]/.test(chars[i - 1])) &&
      chars[j] === "أ"
    ) {
      out += "li";
      i = j;
      continue;
    }

    let potongan = lat;
    if (ada(TANDA_SYADDAH)) potongan = lat + lat;

    let vokal = "";
    if (ada(FATHATAN)) vokal = "an";
    else if (ada(KASRATAN)) vokal = "in";
    else if (ada(DAMMATAN)) vokal = "un";
    else if (ada(FATHA)) vokal = "a";
    else if (ada(KASRA)) vokal = "i";
    else if (ada(DAMMA)) vokal = "u";
    else if (ada(ALIF_KHANJARIYAH)) vokal = k === "i" ? "ā" : "a";
    // Alif khanajariyah (ٰ) sesudah fathah memanjangkan vokal itu.
    if (ada(ALIF_KHANJARIYAH) && vokal === "a" && k === "i") vokal = "ā";

    // Huruf pembawa vokal (أ إ آ ا) sudah memuat vokalnya di peta:
    // jangan gandakan vokal yang sama.
    if (vokal && (potongan.endsWith(vokal) || c === "آ")) vokal = "";

    // Huruf mad: ا/و/ي tak bertanda (atau bersukun) tepat sesudah
    // harakat sejenis memanjangkan vokal dan ikut termakan.
    const berikut = chars[j];
    const tandaBerikut: string[] = [];
    let jj = j + 1;
    while (jj < chars.length && RE_TANDA.test(chars[jj])) {
      tandaBerikut.push(chars[jj]);
      jj += 1;
    }
    const madPolos =
      berikut !== undefined &&
      (tandaBerikut.length === 0 || tandaBerikut.every((t) => t === SUKUN));
    if (madPolos && vokal === "a" && berikut === "ا") {
      if (k === "i") out += `${potongan}ā`;
      else out += `${potongan}a`;
      i = jj;
      continue;
    }
    if (madPolos && vokal === "u" && berikut === "و") {
      out += `${potongan}${k === "i" ? "ū" : "u"}`;
      i = jj;
      continue;
    }
    if (madPolos && vokal === "i" && berikut === "ي") {
      out += `${potongan}${k === "i" ? "ī" : "i"}`;
      i = jj;
      continue;
    }
    // Diftong: و/ي bersukun sesudah fathah.
    if (
      vokal === "a" &&
      (berikut === "و" || berikut === "ي") &&
      tandaBerikut.includes(SUKUN)
    ) {
      const dif = berikut === "و" ? (k === "i" ? "aw" : "au") : k === "i" ? "ay" : "ai";
      out += `${potongan}${dif}`;
      i = jj;
      continue;
    }

    out += potongan + vokal;
    i = j;
  }
  return out;
}

/** Pola regex satu entri KAMUS yang toleran harakat di sela huruf. */
function polaKamus(ar: string, batas: boolean): RegExp {
  const lolos = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const inti = Array.from(ar)
    .map((c) => (c === " " ? " " : lolos(c)))
    .join(`[${KELAS_TANDA}]*`);
  const ekor = batas ? `(?![\\u0621-\\u064A${KELAS_TANDA}])` : "";
  return new RegExp(`${inti}[${KELAS_TANDA}]*${ekor}`, "g");
}

export function arabKeLatin(teks: string, gaya: GayaArab = "sederhana"): string {
  const k = gaya === "ilmiah" ? "i" : "s";
  let hasil = teks;

  for (const [ar, lat, batas] of KAMUS) {
    hasil = hasil.replace(polaKamus(ar, batas === true), lat);
  }

  // Satu kata ber-alif-lam (awal + sisa) menjadi bentuk Latinnya.
  const artikel = (awal: string, sisa: string): string => {
    const latAwal = ARAB_LATIN[awal]?.[k] ?? awal;
    // الله perkecualian: lam-nya tidak melebur dan kata ini dibaca
    // utuh (allāh), bukan dipecah sebagai alif-lam + awal kata.
    if (awal === "ل" && sisa.replace(/^[\u064B-\u0652\u0670]+/, "").startsWith("ه")) {
      // Pindai utuh, lalu rapikan: lam artikel + lam bersyaddah di
      // kata ini terbaca dua lam saja (allāh), bukan tiga.
      let utuh = translitBertanda(`ال${awal}${sisa}`, k);
      utuh = utuh.replace(/^(a|ā)lll/, "$1ll");
      if (k === "i") utuh = utuh.replace(/^alla/, "allā");
      return utuh;
    }
    const isi = translitBertanda(awal + sisa, k);
    if (SYAMSIYAH.has(awal)) {
      // Syaddah pada huruf syamsiyah adalah tanda peleburan itu
      // sendiri: jangan dihitung dua kali (ar-raḥmān, bukan ar-rraḥmān).
      const isiBersih = isi.startsWith(latAwal + latAwal)
        ? isi.slice(latAwal.length)
        : isi;
      return `a${latAwal}-${isiBersih}`;
    }
    return `al-${isi}`;
  };

  // Gabungan وَ + alif lam di awal kata (وَالْكِتَابُ): tanpa penanganan
  // khusus, artikelnya tidak terbaca dan keluar "waalkitabu". Dibaca
  // sebagai kata sambung + artikel: "wa al-kitabu".
  hasil = hasil.replace(
    new RegExp(
      `(?<![\\p{L}${KELAS_TANDA}])و[${KELAS_TANDA}]*ال([\\u0621-\\u064A])((?:[\\u0621-\\u064A${KELAS_TANDA}])*)`,
      "gu",
    ),
    (_m, awal: string, sisa: string) => `wa ${artikel(awal, sisa)}`,
  );

  // Alif lam: sesuaikan dengan aturan lam syamsiyah. Rentang sesudah
  // ال kini boleh memuat harakat, dan sisa katanya ditransliterasikan
  // dengan pembaca harakat yang sama.
  hasil = hasil.replace(
    new RegExp(
      `(?<![\\p{L}${KELAS_TANDA}])ال([\\u0621-\\u064A])((?:[\\u0621-\\u064A${KELAS_TANDA}])*)`,
      "gu",
    ),
    (_m, awal: string, sisa: string) => artikel(awal, sisa),
  );

  return translitBertanda(hasil, k);
}
