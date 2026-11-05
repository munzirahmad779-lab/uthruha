/**
 * Gerbang kategori kitab — blokir keras subbidang untuk kandidat KITAB
 * (Tahap G1, menutup bocor uji judul uang panai, 5–6 Nov 2026).
 *
 * Bocornya: pada proyek fikih berjudul "حكم uang panai في الشريعة
 * الاسلامية: دراسة مقاصدية", kitab tauhid القواعد في توحيد العبادة dari
 * jalur masadir Generate Footnote mendapat skor model 90, tombol
 * pasangnya aktif, terklik, dan TERSIMPAN sebagai rujukan proyek.
 * Akarnya struktural: kandidat kitab tidak membawa kategori sumbernya,
 * deteksiBidangSumber (gerbang-relevansi) bekerja pada penanda judul
 * JURNAL yang tidak mencakup subbidang internal Islam seperti tauhid,
 * sehingga satu-satunya penahan kitab di luar subbidang adalah skor
 * model — dan model boleh keliru meloloskan.
 *
 * Mesin putusannya (data pemetaan resmi dari pemilik lewat kajian
 * Claude luar, diterapkan 6 Nov 2026) MURNI dan deterministik:
 * gerbang menurunkan TOPIK proyek secara deterministik dari bidangId
 * + judul proyek, menghitung RELASI cabang sumber terhadap topik itu
 * (sesuai / bersebelahan / bertentangan / tak diketahui), lalu
 * memeriksa ISTILAH INTI dan ISTILAH PENOLAK pada judul kitab
 * ternormalisasi dan daftar isi/bab yang dibawa hit. Sembilan aturan:
 *   (1) penolak ada dan inti tidak ada → GUGUR
 *   (2) cabang bertentangan → GUGUR
 *   (3) topik mewajibkan domain Islam, domain sumber bukan Islam → GUGUR
 *   (4) cabang sesuai dan inti ada → LOLOS
 *   (5) cabang sesuai, inti tidak ada → kitab KONFIRMASI
 *       (artikel berabstrak GUGUR, tanpa abstrak KONFIRMASI — gerbang
 *       ini jalur kitab; artikel dinilai jalur jurnal yang sudah ada)
 *   (6) bersebelahan + inti ada → KONFIRMASI
 *   (7) bersebelahan + inti tidak ada → GUGUR
 *   (8) tak diketahui + inti ada → KONFIRMASI
 *   (9) tak diketahui + inti tidak ada → GUGUR
 * Pengaman: LOLOS yang juga memuat penolak turun ke KONFIRMASI;
 * relasi bersebelahan (bidang pendukung) paling tinggi menaikkan
 * GUGUR menjadi KONFIRMASI, tidak pernah menjadi LOLOS.
 *
 * Semantik terhadap aplikasi (putusan pemilik 5 Nov 2026 15:57,
 * blokir keras penuh, jalur konfirmasi instal DICABUT):
 *   LOLOS      → "lolos" (boleh diberi sidik dan dipasang)
 *   GUGUR      → "gagal-bidang"
 *   KONFIRMASI → "belum-terverifikasi" dengan alasan berawalan
 *                "Perlu konfirmasi: ..." — tertahan TANPA sidik dan
 *                TANPA tombol pasang; tidak ada jalan instal untuknya.
 * Satu pengecualian terdokumentasi pada bukti inti: judul kitab yang
 * DISEBUT PERSIS pada judul proyek atau teks paragraf (penulis
 * sendiri yang mengutipnya) adalah bukti deterministik terkuat —
 * aturan lama codebase "kitab yang disebut persis selalu menang" —
 * dan diperlakukan sebagai inti kuat yang bisa meloloskan pada
 * aturan (4) dan (8). Leksikon inti saja tidak sekuat itu.
 *
 * Bila tidak ada topik yang bisa diturunkan dari proyek, gerbang
 * memakai MODE CADANGAN: himpunan bidang dari ketetapan awal pemilik
 * (TABEL_BIDANG_KITAB) sebagai relasi sesuai, relasi lain tak
 * diketahui, inti hanya dari sebutan persis, penolak dari daftar
 * umum — tetap fail-closed lewat aturan (8)/(9).
 *
 * Model di jalur kitab sesudah gerbang ini hanya boleh MENGGUGURKAN
 * (lewat nilaiRelevansi seperti biasa), tidak pernah meloloskan yang
 * sudah gugur atau tertahan di sini.
 */
import { normalisasiJudul } from "./referensi";

/** Label taksonomi kitab tertutup. */
export type LabelKitab =
  | "akidah"
  | "fiqh"
  | "ushul-fiqh"
  | "tafsir"
  | "hadis"
  | "sirah-tarikh"
  | "akhlak-tasawuf"
  | "lughah-adab"
  | "tarbiyah"
  | "iqtishad";

/**
 * Daftar kategori kitab Shamela/Turath (id → nama Arab persis seperti
 * di sumber). Diverifikasi HIDUP 6 Nov 2026 dari halaman kitab
 * Shamela (breadcrumb kategori + daftar <select id="sel_aqsam"> pada
 * shamela.ws/book/604) dan dicocokkan dengan cat_id pada respons
 * api.turath.io/search: kitab 604 (القواعد في توحيد العبادة) membawa
 * cat_id 1 di Turath dan breadcrumb category/1 = العقيدة di Shamela —
 * kedua korpus memakai penomoran yang sama (Turath dibangun di atas
 * korpus Shamela).
 *
 * Selisih dari daftar ingatan pada bahan kajian luar: di sana
 * kategori ditulis sebagai string gabungan ("الفقه وأصوله",
 * "التفسير وعلوم القرآن", "الحديث وعلومه", "التاريخ والتراجم",
 * "الآداب والبلاغة") — pada sumber nyata kategori-kategori itu
 * TERPISAH (الفقه terbagi per mazhab + الفقه العام + أصول الفقه
 * sendiri; التفسير sendiri, علوم القرآن وأصول التفسير sendiri; dst.).
 * String nyata di bawah ini yang menang; pemetaan label di
 * ATURAN_LABEL menangkap kedua bentuk.
 */
export const KATEGORI_SUMBER: Record<number, string> = {
  1: "العقيدة",
  2: "الفرق والردود",
  3: "التفسير",
  4: "علوم القرآن وأصول التفسير",
  5: "التجويد والقراءات",
  6: "كتب السنة",
  7: "شروح الحديث",
  8: "التخريج والأطراف",
  9: "العلل والسؤلات الحديثية",
  10: "علوم الحديث",
  11: "أصول الفقه",
  12: "علوم الفقه والقواعد الفقهية",
  13: "المنطق",
  14: "الفقه الحنفي",
  15: "الفقه المالكي",
  16: "الفقه الشافعي",
  17: "الفقه الحنبلي",
  18: "الفقه العام",
  19: "مسائل فقهية",
  20: "السياسة الشرعية والقضاء",
  21: "الفرائض والوصايا",
  22: "الفتاوى",
  23: "الرقائق والآداب والأذكار",
  24: "السيرة النبوية",
  25: "التاريخ",
  26: "التراجم والطبقات",
  27: "الأنساب",
  28: "البلدان والرحلات",
  29: "كتب اللغة",
  30: "الغريب والمعاجم",
  31: "النحو والصرف",
  32: "الأدب",
  33: "العروض والقوافي",
  34: "الشعر ودواوينه",
  35: "البلاغة",
  36: "الجوامع",
  37: "فهارس الكتب والأدلة",
  38: "الطب",
  39: "كتب عامة",
  40: "علوم أخرى",
};

/** Nama kategori dari id sumber (Turath cat_id / Shamela category). */
export function namaKategoriSumber(catId?: number | null): string | undefined {
  if (typeof catId !== "number" || !Number.isFinite(catId)) return undefined;
  return KATEGORI_SUMBER[catId];
}

/**
 * Normalisasi teks Arab untuk pencocokan: di atas normalisasiJudul
 * (buang harakat, tanda baca, huruf kecil), tambah buang tatwil dan
 * samakan bentuk alif (أ إ آ ٱ → ا), ya maqshurah (ى → ي), dan ta
 * marbuthah (ة → ه) — variasi ortografi yang tidak mengubah makna.
 */
export function normalisasiKategori(teks: string): string {
  return normalisasiJudul(teks)
    .normalize("NFKC")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stemming kasar satu token (sesuai arahan bahan resmi: buang awalan
 * al/wa/fa/ba/ka/la dan gabungannya) agar istilah inti/penolak cocok
 * lintas bentuk berawalan. Term dan teks sama-sama distem, jadi
 * perbandingannya konsisten; token hasil stem lebih pendek dari 2
 * aksara dibuang pemanggil karena terlalu umum.
 */
function stemKata(tok: string): string {
  let t = tok;
  t = t.replace(/^(وال|فال|بال|كال|لال|ال)/, "");
  if (t.length >= 4) t = t.replace(/^[وفبكل]/, "");
  return t;
}

/** Himpunan token terstem dari teks ternormalisasi. */
function himpunanToken(teksNorm: string): Set<string> {
  const out = new Set<string>();
  for (const mentah of teksNorm.split(" ")) {
    if (!mentah) continue;
    const s = stemKata(mentah);
    if (s.length >= 2) out.add(s);
  }
  return out;
}

/**
 * Apakah istilah (satu kata atau frasa) hadir pada teks: cocok bila
 * frasa ternormalisasinya muncul sebagai potongan teks ATAU semua
 * token terstem istilah ada pada himpunan token teks (urutan frasa
 * Arab bisa berubah antar penulisan judul).
 */
function memuatIstilah(teksNorm: string, tokenTeks: Set<string>, istilah: string): boolean {
  const istilahNorm = normalisasiKategori(istilah);
  if (!istilahNorm) return false;
  if (teksNorm.includes(istilahNorm)) return true;
  const tokenIstilah = [...himpunanToken(istilahNorm)];
  if (tokenIstilah.length === 0) return false;
  return tokenIstilah.every((t) => tokenTeks.has(t));
}

/** Istilah pertama dari daftar yang hadir pada teks, atau null. */
function istilahPertama(
  teksNorm: string,
  tokenTeks: Set<string>,
  daftar: string[],
): string | null {
  for (const istilah of daftar) {
    if (memuatIstilah(teksNorm, tokenTeks, istilah)) return istilah;
  }
  return null;
}

/**
 * Aturan pemetaan kategori mentah → label, diperiksa BERURUTAN:
 * bentuk yang lebih khusus didahulukan (أصول الفقه sebelum الفقه).
 * Pola ditulis dalam bentuk ternormalisasi dan dicocokkan sebagai
 * potongan teks pada kategori ternormalisasi — menangkap string
 * nyata Shamela/Turath maupun string gabungan dari bahan kajian.
 *
 * Kategori sumber yang sengaja TIDAK dipetakan (→ null, tidak
 * dikenal): المنطق (13, alat bantu lintas bidang), الجوامع (36,
 * campuran), فهارس الكتب (37), الطب (38), كتب عامة (39),
 * علوم أخرى (40). Untuk kategori itu relasi cabangnya tak
 * diketahui dan aturan (8)/(9) yang memutuskan.
 */
const ATURAN_LABEL: { label: LabelKitab; pola: string[] }[] = [
  {
    label: "ushul-fiqh",
    pola: ["اصول الفقه", "ushul fiqh", "usul fiqh", "ushul fikih", "usul fikih"],
  },
  {
    label: "hadis",
    pola: [
      "الحديث", "السنه", "مصطلح الحديث", "علوم الحديث", "شروح الحديث",
      "التخريج", "العلل الحديثيه", "hadis", "hadith", "sunnah", "sunah",
    ],
  },
  {
    label: "tafsir",
    pola: [
      "التفسير", "علوم القران", "اصول التفسير", "التجويد", "القراءات",
      "tafsir", "ulumul quran", "ilmu al quran",
    ],
  },
  {
    label: "akidah",
    pola: [
      "العقيده", "التوحيد", "الفرق والردود", "الفرق", "الكلام",
      "الاعتقاد", "akidah", "aqidah", "tauhid", "kalam",
    ],
  },
  {
    label: "fiqh",
    pola: [
      "الفقه", "فقهيه", "المناكحات", "الفرائض", "الفتاوي", "السياسه الشرعيه",
      "القضاء", "العبادات", "المعاملات", "fiqh", "fikih",
    ],
  },
  {
    label: "sirah-tarikh",
    pola: [
      "السيره", "التاريخ", "التراجم", "الطبقات", "الانساب", "البلدان",
      "الرحلات", "sirah", "sejarah", "tarikh",
    ],
  },
  {
    label: "akhlak-tasawuf",
    pola: [
      "الرقائق", "الاداب", "الاذكار", "التصوف", "الاخلاق", "الزهد",
      "akhlak", "tasawuf",
    ],
  },
  {
    label: "lughah-adab",
    pola: [
      "اللغه", "الغريب", "المعاجم", "النحو", "الصرف", "الادب",
      "العروض", "القوافي", "الشعر", "البلاغه", "bahasa arab", "sastra",
      "nahwu", "balaghah",
    ],
  },
  {
    label: "tarbiyah",
    pola: ["التربيه", "التعليم", "pendidikan", "tarbiyah"],
  },
  {
    label: "iqtishad",
    pola: ["الاقتصاد", "ekonomi", "iqtishad"],
  },
];

/**
 * Petakan string kategori mentah dari sumber (Arab atau Indonesia)
 * ke label taksonomi tertutup. Tidak dikenal → null.
 */
export function normalisasiKategoriKitab(mentah?: string | null): LabelKitab | null {
  const teks = normalisasiKategori(mentah ?? "");
  if (!teks) return null;
  for (const aturan of ATURAN_LABEL) {
    for (const pola of aturan.pola) {
      if (teks.includes(pola)) return aturan.label;
    }
  }
  return null;
}

/**
 * Tabel bidang proyek → label kitab yang BERIRISAN dengannya
 * (ketetapan awal pemilik; dipakai sebagai relasi SESUAI pada mode
 * cadangan bila topik proyek tidak bisa diturunkan). Kunci adalah
 * bidangId nyata dari lib/content/bidang.ts (sembilan bidang
 * bawaan), ditambah baris "akidah" untuk kategori kustom bernama
 * akidah. Alasan tiap baris dicatat agar tabel ini bisa diaudit.
 */
export const TABEL_BIDANG_KITAB: Record<string, LabelKitab[]> = {
  // Ilmu Al-Qur'an & Tafsir: masadir intinya kitab tafsir dan ulum
  // quran; kategori tajwid/qiraat sumber dipetakan ke label tafsir.
  quran: ["tafsir"],
  // Ilmu Hadis: hanya kitab hadis dan cabang-cabangnya.
  hadis: ["hadis"],
  // Fiqh & Ushul Fiqh: kitab fiqh dan kitab ushul fiqh keduanya
  // masadir inti (kasus uang panai: proyek ini bidang fiqh, kitab
  // tauhid gugur karena di luar dua label ini).
  fiqh: ["fiqh", "ushul-fiqh"],
  // Pendidikan Islam: bertumpu pada kitab tarbiyah dan kitab akhlak;
  // kategori sumber Shamela tidak punya kelas tarbiyah tersendiri.
  tarbiyah: ["tarbiyah", "akhlak-tasawuf"],
  // Bahasa & Sastra Arab: kitab lughah dan adab.
  bahasa: ["lughah-adab"],
  // Sejarah & Peradaban Islam: sirah, tarikh, thabaqat.
  tarikh: ["sirah-tarikh"],
  // Ekonomi Syariah: di samping kitab ekonomi Islam, hukum akad dan
  // muamalah adalah fiqh, jadi label fiqh beririsan langsung.
  iqtishad: ["iqtishad", "fiqh"],
  // Dakwah & Komunikasi Islam: materi dakwah klasik adalah sirah,
  // kitab hadis targhib-tarhib, tafsir ayat dakwah, dan kitab adab.
  dakwah: ["sirah-tarikh", "hadis", "tafsir", "akhlak-tasawuf"],
  // Filsafat & Kalam: ilmu kalam adalah akidah, dan tasawuf termasuk
  // kata kunci resmi bidang ini di bidang.ts.
  falsafah: ["akidah", "akhlak-tasawuf"],
  // Baris tambahan (bukan bidang bawaan bidang.ts): kategori kustom
  // bernama akidah hanya beririsan dengan kitab akidah.
  akidah: ["akidah"],
};

/* ── Data topik proyek (pemetaan resmi v1) ───────────────────────────
 * Delapan topik, semuanya mewajibkan domain Islam. Relasi ditulis
 * dalam ruang LabelKitab: nama cabang pada bahan resmi yang bukan
 * label kitab (fikih_munakahat, hukum_keluarga, maqashid, kalam,
 * sejarah_islam, integrasi_keilmuan, pemikiran_islam) diterjemahkan
 * ke label kitab yang mewadahinya, dan terjemahannya dicatat:
 *   fikih/hukum_keluarga → fiqh; ushul_fikih/maqashid → ushul-fiqh;
 *   kalam/tauhid → akidah; sejarah_islam → sirah-tarikh;
 *   sastra → lughah-adab; ekonomi → iqtishad.
 * Konflik ruang label yang diputuskan di sini: untuk topik
 * fikih_munakahat, bahan resmi menaruh sastra pada bertentangan DAN
 * pemikiran_islam (yang kategorinya memuat الآداب والبلاغة) pada
 * bersebelahan; keduanya label lughah-adab di ruang kitab, dan
 * daftar bertentangan yang eksplisit dimenangkan. sejarah_umum pada
 * bertentangan tidak bisa dibedakan dari sejarah Islam dalam ruang
 * label (kategori sumbernya sirah/tarikh Islam), jadi sirah-tarikh
 * ditaruh bersebelahan lewat pemikiran_islam.
 */
export interface DataTopik {
  /** Label skema topik (untuk klasifikasi proyek). */
  id: string;
  sesuai: LabelKitab[];
  bersebelahan: LabelKitab[];
  bertentangan: LabelKitab[];
  /** Istilah inti: kehadirannya pada judul/daftar isi adalah bukti
   *  kitab ini memang tentang topik proyek. */
  inti: string[];
  /** Istilah penolak khusus topik (di luar PENOLAK_UMUM). */
  penolak: string[];
}

/** Penolak umum hampir semua topik (bahan resmi): ekonomi, dagang,
 *  politik, perang, olahraga. Bentuk sifat الاقتصادي ditambah agar
 *  judul seperti التكامل الاقتصادي tertangkap juga sebagai token. */
export const PENOLAK_UMUM: string[] = [
  "اقتصاد", "الاقتصادي", "تجارة", "سوق", "استثمار", "بنك", "تمويل",
  "سياسة", "انتخابات", "حرب", "رياضة",
];

export const DATA_TOPIK: Record<string, DataTopik> = {
  fikih_munakahat: {
    id: "fikih_munakahat",
    // Bahan: fikih, fikih_munakahat, hukum_keluarga, ushul_fikih,
    // maqashid → fiqh + ushul-fiqh.
    sesuai: ["fiqh", "ushul-fiqh"],
    // Bahan: hadis, tafsir, pemikiran_islam, integrasi_keilmuan →
    // hadis + tafsir + sirah-tarikh (sejarah Islam pemikiran).
    bersebelahan: ["hadis", "tafsir", "sirah-tarikh"],
    // Bahan: akidah, tauhid, ekonomi, politik, sains_alam,
    // kedokteran, teknologi, olahraga, sejarah_umum, sastra →
    // yang punya label kitab: akidah, iqtishad, lughah-adab.
    bertentangan: ["akidah", "iqtishad", "lughah-adab"],
    inti: [
      "نكاح", "زواج", "طلاق", "خلع", "مهر", "ولي", "عدة", "حضانة",
      "نفقة", "خطبة", "عقد النكاح", "فقه الأسرة", "أحوال شخصية",
      "mahar", "pernikahan", "perkawinan",
    ],
    penolak: [],
  },
  ushul_fikih: {
    id: "ushul_fikih",
    // Bahan: ushul_fikih, fikih, maqashid.
    sesuai: ["ushul-fiqh", "fiqh"],
    bersebelahan: ["hadis", "tafsir"],
    bertentangan: [],
    inti: [
      "أصول الفقه", "اجتهاد", "قياس", "استحسان", "استصحاب",
      "مصلحة مرسلة", "سد الذرائع", "تعارض الأدلة", "ترجيح", "إجماع",
    ],
    penolak: [],
  },
  akidah_tauhid: {
    id: "akidah_tauhid",
    // Bahan: akidah, tauhid, kalam. Bertentangan mencakup fikih.
    sesuai: ["akidah"],
    // Pilihan pembangun terdokumentasi: tasawuf/akhlak bersebelahan
    // dengan kalam (bidang falsafah di bidang.ts memang memuat
    // tasawuf sebagai kata kuncinya).
    bersebelahan: ["akhlak-tasawuf"],
    bertentangan: ["fiqh", "ushul-fiqh"],
    inti: [
      "توحيد", "عقيدة", "إيمان", "أسماء الله وصفاته", "القدر",
      "اليوم الآخر", "الشرك", "الكفر", "أهل السنة والجماعة",
      "علم الكلام",
    ],
    penolak: [],
  },
  tafsir_ulum_quran: {
    id: "tafsir_ulum_quran",
    sesuai: ["tafsir"],
    bersebelahan: ["hadis", "lughah-adab"],
    bertentangan: [],
    inti: [
      "تفسير", "علوم القرآن", "أسباب النزول", "الناسخ والمنسوخ",
      "تأويل", "القراءات", "إعجاز القرآن",
    ],
    penolak: [],
  },
  hadis_ulum_hadis: {
    id: "hadis_ulum_hadis",
    sesuai: ["hadis"],
    bersebelahan: ["tafsir", "sirah-tarikh"],
    bertentangan: [],
    inti: [
      "الحديث", "علوم الحديث", "مصطلح الحديث", "الجرح والتعديل",
      "تخريج", "صحيح", "سنن", "رواية", "إسناد",
    ],
    penolak: [],
  },
  maqashid_syarie: {
    id: "maqashid_syarie",
    // Kategori bahan: الفقه وأصوله → ushul-fiqh + fiqh.
    sesuai: ["ushul-fiqh", "fiqh"],
    bersebelahan: ["iqtishad", "hadis", "tafsir", "akidah"],
    bertentangan: [],
    inti: [
      "مقاصد", "مقاصد الشريعة", "الضروريات", "حفظ الدين", "حفظ النفس",
      "حفظ العقل", "حفظ النسل", "حفظ المال", "المصالح", "الحاجيات",
      "التحسينيات",
    ],
    penolak: [],
  },
  pemikiran_islam: {
    id: "pemikiran_islam",
    // Kategori bahan: التاريخ والتراجم dan الآداب والبلاغة →
    // sirah-tarikh + lughah-adab.
    sesuai: ["sirah-tarikh", "lughah-adab"],
    bersebelahan: ["akidah", "akhlak-tasawuf", "tafsir", "hadis"],
    bertentangan: [],
    inti: [
      "الفكر الإسلامي", "الحضارة الإسلامية", "التراث الإسلامي",
      "النهضة الإسلامية", "التاريخ الإسلامي", "الاستشراق", "التأصيل",
    ],
    penolak: [],
  },
  integrasi_keilmuan: {
    id: "integrasi_keilmuan",
    // Kategori bahan: الفقه وأصوله; sesuai bahan: integrasi_keilmuan,
    // pemikiran_islam → fiqh + ushul-fiqh, ditambah tafsir karena
    // konteks takamul yang terverifikasi adalah integrasi علوم
    // القرآن dengan أصول الفقه.
    sesuai: ["fiqh", "ushul-fiqh", "tafsir"],
    bersebelahan: ["hadis", "sirah-tarikh", "lughah-adab", "akhlak-tasawuf"],
    // Ekonomi adalah kawan palsu klasik konteks takamul (judul
    // التكامل الاقتصادي yang menggugurkan penerimaan 5 Nov).
    bertentangan: ["iqtishad"],
    inti: [
      "تكامل المعرفة", "تكامل العلوم", "التكامل بين العلوم",
      "إسلامية المعرفة", "العلوم الشرعية", "العلوم الكونية",
      "نظرية المعرفة", "التأصيل الإسلامي",
    ],
    // Penolak khusus bahan resmi untuk konteks takamul.
    penolak: [
      "التكامل الاقتصادي", "التجارة", "السوق", "تكامل السوق",
      "التكامل الإقليمي", "التفاضل والتكامل", "حساب التفاضل",
    ],
  },
};

/** Penanda judul untuk menurunkan topik dari bidang fiqh. */
const PENANDA_MUNAKAHAT: string[] = [
  "نكاح", "زواج", "طلاق", "مهر", "أحوال شخصية", "uang panai",
  "mahar", "pernikahan", "perkawinan", "nikah", "munakahat",
];
const PENANDA_MAQASHID: string[] = ["مقاصد", "مقاصدية", "maqashid", "maqasid", "makasid"];
const PENANDA_USHUL: string[] = ["أصول الفقه", "أصول", "قياس", "اجتهاد", "ushul", "usul fiqh"];

/**
 * Turunkan topik proyek secara deterministik dari bidangId + judul
 * proyek. Urutan pemeriksaan disengaja:
 *  1. Konteks takamul (integrasi_keilmuan) dari judul, bidang apa
 *     pun — proyek takamul terverifikasi beridang quran.
 *  2. Bidang fiqh: munakahat didahulukan dari maqashid dan ushul —
 *     judul uang panai memuat ketiganya ("uang panai" + "مقاصدية")
 *     dan topiknya adalah munakahat, maqashid hanya lensanya.
 *  3. Bidang lain memetakan ke topik senama bila ada (quran →
 *     tafsir, hadis → hadis, falsafah → akidah/kalam, tarikh →
 *     pemikiran/sejarah Islam, akidah kustom → akidah_tauhid).
 * Tidak ada yang cocok → null (mode cadangan).
 */
export function topikProyekDari(bidangId: string, judulProyek?: string): DataTopik | null {
  const judul = normalisasiKategori(judulProyek ?? "");
  const tokenJudul = himpunanToken(judul);
  const ada = (daftar: string[]) => istilahPertama(judul, tokenJudul, daftar) !== null;

  if (
    judul &&
    judul.includes("تكامل") &&
    (judul.includes("علوم") || judul.includes("معرف"))
  ) {
    return DATA_TOPIK.integrasi_keilmuan!;
  }
  if (bidangId === "fiqh" || bidangId === "ushul-fiqh" || bidangId === "ushul_fikih") {
    if (judul && ada(PENANDA_MUNAKAHAT)) return DATA_TOPIK.fikih_munakahat!;
    if (judul && ada(PENANDA_MAQASHID)) return DATA_TOPIK.maqashid_syarie!;
    if (judul && ada(PENANDA_USHUL)) return DATA_TOPIK.ushul_fikih!;
    if (bidangId !== "fiqh") return DATA_TOPIK.ushul_fikih!;
    return null;
  }
  switch (bidangId) {
    case "quran":
      return DATA_TOPIK.tafsir_ulum_quran!;
    case "hadis":
      return DATA_TOPIK.hadis_ulum_hadis!;
    case "falsafah":
    case "akidah":
      return DATA_TOPIK.akidah_tauhid!;
    case "tarikh":
      return DATA_TOPIK.pemikiran_islam!;
    default:
      return null;
  }
}

/** Penanda domain bukan Islam pada kategori mentah (aturan 3):
 *  korpus kitab Islam tidak memetakannya ke label, jadi kategori
 *  seperti "الطب" atau "kedokteran" dibaca di sini apa adanya. */
const PENANDA_DOMAIN_ASING: string[] = [
  "الطب", "kedokteran", "medicine", "sains", "science", "teknologi",
  "technology", "olahraga", "sport", "novel", "fiksi",
];

export interface KandidatKitabGerbang {
  judul: string;
  /** Kategori mentah dari rekod sumber (mis. "العقيدة"), bila ada. */
  kategoriKitab?: string;
  /** Daftar isi / bab yang dibawa hit sumber (Turath headings),
   *  tempat istilah inti/penolak juga diperiksa. */
  daftarIsi?: string;
  /** Teks paragraf tempat footnote akan dipasang (bukti persis). */
  teksParagraf?: string;
  /** Judul proyek (penurunan topik + bukti persis). */
  judulProyek?: string;
}

export type PutusanGerbang = "lolos" | "gagal-bidang" | "belum-terverifikasi";

export interface HasilGerbangKitab {
  putusan: PutusanGerbang;
  /** Label taksonomi kitab, null bila kategorinya tidak dikenal. */
  labelKitab: LabelKitab | null;
  /** Kode alasan mesin (mis. "CAB_BERTENTANGAN") untuk uji + log. */
  kode: string;
  /** Topik proyek yang dipakai menilai (id DATA_TOPIK), atau
   *  "cadangan-<bidangId>" pada mode cadangan. */
  topik: string;
  /** Relasi cabang sumber terhadap topik. */
  relasi: "sesuai" | "bersebelahan" | "bertentangan" | "tak diketahui";
  /** Alasan Bahasa Indonesia yang menyebut bukti putusannya. Untuk
   *  putusan tertahan, berawalan "Perlu konfirmasi: ". */
  alasan: string;
}

/** Judul kitab cukup panjang untuk dipercaya sebagai sebutan persis
 *  (meniru ambang 8 aksara aturan lama di pilihRujukan). */
const MIN_JUDUL_PERSEPSI = 8;

/**
 * Bukti sebutan persis: judul kitab ternormalisasi muncul utuh pada
 * judul proyek/teks paragraf, ATAU token kepala judulnya (token
 * terpanjang khas, mis. المستصفى) disebut di sana. Mengembalikan
 * bentuk buktinya untuk alasan, atau null.
 *
 * Token kepala yang termasuk kosakata topik itu sendiri (inti atau
 * penolak, mis. تكامل pada proyek takamul) TIDAK dihitung: kata itu
 * muncul di judul proyek karena topiknya, bukan karena kitab ini
 * yang dimaksud penulis — tanpa saringan ini judul التكامل
 * الاقتصادي terbaca "disebut persis" oleh proyek takamul mana pun
 * (tertangkap uji emas G1).
 */
function buktiSebutanPersis(
  kandidat: KandidatKitabGerbang,
  kataTopik?: Set<string>,
): string | null {
  const judulNorm = normalisasiKategori(kandidat.judul ?? "");
  const konteksNorm = normalisasiKategori(
    `${kandidat.judulProyek ?? ""} ${kandidat.teksParagraf ?? ""}`,
  );
  if (!konteksNorm) return null;
  if (judulNorm.length >= MIN_JUDUL_PERSEPSI && konteksNorm.includes(judulNorm)) {
    return "judul kitab disebut persis pada judul proyek atau teks paragraf";
  }
  const tokenKonteks = himpunanToken(konteksNorm);
  const tokenJudul = [...himpunanToken(judulNorm)]
    .filter((t) => t.length >= 5 && !(kataTopik?.has(t) ?? false))
    .sort((a, b) => b.length - a.length);
  for (const t of tokenJudul) {
    if (tokenKonteks.has(t)) return `nama khas kitab ("${t}") disebut pada judul proyek atau teks paragraf`;
  }
  return null;
}

/** Himpunan token terstem dari seluruh kosakata sebuah daftar
 *  istilah (untuk menyaring bukti sebutan persis di atas). */
function tokenDariDaftarIstilah(daftar: string[]): Set<string> {
  const out = new Set<string>();
  for (const istilah of daftar) {
    for (const t of himpunanToken(normalisasiKategori(istilah))) out.add(t);
  }
  return out;
}

/**
 * Gerbang kategori kitab. MURNI, deterministik, tanpa model.
 * Lihat kepala berkas untuk sembilan aturan dan pemetaannya ke
 * status aplikasi.
 */
export function gerbangKategoriKitab(
  kandidat: KandidatKitabGerbang,
  bidangId: string,
): HasilGerbangKitab {
  const labelKitab = normalisasiKategoriKitab(kandidat.kategoriKitab);
  const kategoriTampil = (kandidat.kategoriKitab ?? "").trim();
  const topik = topikProyekDari(bidangId, kandidat.judulProyek);

  // Teks bukti istilah: judul kitab + daftar isi/bab dari hit.
  const teksBukti = normalisasiKategori(`${kandidat.judul ?? ""} ${kandidat.daftarIsi ?? ""}`);
  const tokenBukti = himpunanToken(teksBukti);
  const kataTopik = tokenDariDaftarIstilah(
    topik ? [...topik.inti, ...topik.penolak, ...PENOLAK_UMUM] : PENOLAK_UMUM,
  );
  const persis = buktiSebutanPersis(kandidat, kataTopik);

  const selesai = (
    putusan: PutusanGerbang,
    kode: string,
    relasi: HasilGerbangKitab["relasi"],
    alasan: string,
  ): HasilGerbangKitab => ({
    putusan,
    labelKitab,
    kode,
    topik: topik ? topik.id : `cadangan-${bidangId || "(kosong)"}`,
    relasi,
    alasan,
  });

  /* ── Mode cadangan: tidak ada topik yang bisa diturunkan ──────────
   * Relasi sesuai = TABEL_BIDANG_KITAB (ketetapan awal pemilik),
   * relasi lain tak diketahui, inti hanya dari sebutan persis,
   * penolak dari daftar umum. Cabang sesuai lolos seperti aturan
   * awal; sisanya fail-closed lewat aturan (8)/(9). */
  if (!topik) {
    const sesuaiCadangan = TABEL_BIDANG_KITAB[bidangId] ?? [];
    const penolakUmum = istilahPertama(teksBukti, tokenBukti, PENOLAK_UMUM);
    if (labelKitab && sesuaiCadangan.includes(labelKitab)) {
      if (penolakUmum && !persis) {
        return selesai(
          "belum-terverifikasi",
          "KONF_PENOLAK",
          "sesuai",
          `Perlu konfirmasi: kategori kitab "${kategoriTampil}" sesuai bidang proyek (${bidangId}), tetapi judul/daftar isinya memuat istilah penolak "${penolakUmum}" dan kitab tidak disebut persis oleh penulis, jadi ia tertahan tanpa sidik.`,
        );
      }
      return selesai(
        "lolos",
        "CAD_SESUAI",
        "sesuai",
        `Kategori kitab "${kategoriTampil}" (label ${labelKitab}) beririsan dengan bidang proyek (${bidangId}) menurut tabel bidang kitab.`,
      );
    }
    const relasi: HasilGerbangKitab["relasi"] = "tak diketahui";
    if (persis) {
      return selesai(
        "lolos",
        "SEBUT_PERSIS",
        relasi,
        `Kategori kitab ${kategoriTampil ? `"${kategoriTampil}" ` : ""}tidak membuktikan irisan bidang proyek (${bidangId}), tetapi ${persis}, jadi ia adalah sumber yang memang dimaksud penulis.`,
      );
    }
    if (labelKitab) {
      return selesai(
        "gagal-bidang",
        "GUGUR_TAKJELAS_KOSONG",
        relasi,
        `Kategori kitab pada rekod sumbernya adalah "${kategoriTampil}" (label ${labelKitab}), yang tidak beririsan dengan bidang proyek (${bidangId}), dan judul kitab tidak disebut persis oleh penulis. Kitab di luar subbidang proyek tidak bisa dipasang sebagai footnote, berapa pun skor penilaiannya.`,
      );
    }
    return selesai(
      "gagal-bidang",
      "GUGUR_TAKJELAS_KOSONG",
      relasi,
      kategoriTampil
        ? `Kategori kitab "${kategoriTampil}" pada rekod sumbernya tidak dikenal pada taksonomi bidang, dan judul kitab tidak disebut persis pada judul proyek atau paragraf, jadi tidak ada bukti deterministik ia sebidang dengan proyek (${bidangId}).`
        : `Rekod sumber kitab ini tidak membawa kategori, dan judul kitab tidak disebut persis pada judul proyek atau paragraf, jadi tidak ada bukti deterministik ia sebidang dengan proyek (${bidangId}).`,
    );
  }

  /* ── Mode topik: sembilan aturan ───────────────────────────────── */
  const relasi: HasilGerbangKitab["relasi"] = !labelKitab
    ? "tak diketahui"
    : topik.sesuai.includes(labelKitab)
      ? "sesuai"
      : topik.bersebelahan.includes(labelKitab)
        ? "bersebelahan"
        : topik.bertentangan.includes(labelKitab)
          ? "bertentangan"
          : "tak diketahui";

  const intiLeksikon = istilahPertama(teksBukti, tokenBukti, topik.inti);
  const intiAda = intiLeksikon !== null || persis !== null;
  const buktiInti = intiLeksikon
    ? `istilah inti topik "${intiLeksikon}" ada pada judul/daftar isi kitab`
    : persis
      ? persis
      : "";
  const penolakAda = istilahPertama(teksBukti, tokenBukti, [
    ...topik.penolak,
    ...PENOLAK_UMUM,
  ]);
  const cabangTampil = kategoriTampil
    ? `kategori "${kategoriTampil}" (label ${labelKitab ?? "tidak dikenal"})`
    : "kategori tidak tercatat pada rekod sumbernya";

  // (3) Domain sumber bukan Islam padahal topik mewajibkan Islam.
  if (!labelKitab && kategoriTampil) {
    const domainAsing = istilahPertama(
      normalisasiKategori(kategoriTampil),
      himpunanToken(normalisasiKategori(kategoriTampil)),
      PENANDA_DOMAIN_ASING,
    );
    if (domainAsing) {
      return selesai(
        "gagal-bidang",
        "DOMAIN_ASING",
        "bertentangan",
        `Kategori kitab pada rekod sumbernya adalah "${kategoriTampil}", domain di luar studi Islam, padahal topik proyek (${topik.id}) mewajibkan domain Islam.`,
      );
    }
  }

  // (1) Penolak ada dan inti tidak ada → GUGUR.
  if (penolakAda && !intiAda) {
    return selesai(
      "gagal-bidang",
      "IST_PENOLAK",
      relasi,
      `Judul/daftar isi kitab memuat istilah penolak "${penolakAda}" untuk topik proyek (${topik.id}) dan tidak memuat istilah inti topik apa pun, jadi kitab ini gugur sebelum penilaian lain.`,
    );
  }

  // (2) Cabang bertentangan → GUGUR. Kategori menggugurkan SEBELUM
  // istilah inti menolong: kitab akidah yang judulnya menyebut
  // الزواج tetap gugur pada topik munakahat.
  if (relasi === "bertentangan") {
    return selesai(
      "gagal-bidang",
      "CAB_BERTENTANGAN",
      relasi,
      `Kitab ini ${cabangTampil}, cabang yang BERTENTANGAN dengan topik proyek (${topik.id}). Kategori sumber menggugurkan lebih dulu, sebelum istilah pada judulnya diperiksa, dan tidak ada skor model yang boleh membatalkannya.`,
    );
  }

  // (4) Sesuai + inti → LOLOS; pengaman: penolak ikut hadir → KONFIRMASI.
  if (relasi === "sesuai" && intiAda) {
    if (penolakAda) {
      return selesai(
        "belum-terverifikasi",
        "KONF_PENOLAK",
        relasi,
        `Perlu konfirmasi: cabang kitab sesuai topik (${topik.id}) dan ${buktiInti}, tetapi judul/daftar isinya juga memuat istilah penolak "${penolakAda}", jadi putusan lolosnya diturunkan menjadi tertahan tanpa sidik.`,
      );
    }
    return selesai(
      "lolos",
      "SESUAI_INTI",
      relasi,
      `Kitab ini ${cabangTampil}, sesuai topik proyek (${topik.id}), dan ${buktiInti}.`,
    );
  }

  // (5) Sesuai tanpa inti → kitab KONFIRMASI (tertahan).
  if (relasi === "sesuai") {
    return selesai(
      "belum-terverifikasi",
      "KONF_SESUAI_TANPA_INTI",
      relasi,
      `Perlu konfirmasi: kategori kitab "${kategoriTampil}" sesuai topik proyek (${topik.id}), tetapi tidak ada istilah inti topik pada judul/daftar isinya dan kitab tidak disebut persis oleh penulis, jadi ia tertahan tanpa sidik dan tidak bisa dipasang.`,
    );
  }

  // (6) Bersebelahan + inti → KONFIRMASI (bidang pendukung paling
  // tinggi menaikkan gugur menjadi tertahan, tidak pernah lolos).
  if (relasi === "bersebelahan" && intiAda) {
    return selesai(
      "belum-terverifikasi",
      "KONF_SEBELAHAN_INTI",
      relasi,
      `Perlu konfirmasi: cabang kitab (${cabangTampil}) hanya BERSEBELAHAN dengan topik proyek (${topik.id}); ${buktiInti} menaikkannya dari gugur menjadi tertahan, tetapi bidang pendukung tidak pernah meloloskan, jadi ia tetap tanpa sidik dan tidak bisa dipasang.`,
    );
  }

  // (7) Bersebelahan tanpa inti → GUGUR.
  if (relasi === "bersebelahan") {
    return selesai(
      "gagal-bidang",
      "GUGUR_SEBELAHAN_TANPA_INTI",
      relasi,
      `Cabang kitab (${cabangTampil}) hanya bersebelahan dengan topik proyek (${topik.id}) dan tidak ada istilah inti topik pada judul/daftar isinya, jadi kitab ini gugur.`,
    );
  }

  // (8) Tak diketahui + inti → KONFIRMASI; kecuali inti kuat berupa
  // sebutan persis oleh penulis sendiri → LOLOS (bukti deterministik
  // terkuat, aturan lama "kitab yang disebut persis selalu menang").
  if (intiAda) {
    if (persis) {
      return selesai(
        "lolos",
        "SEBUT_PERSIS",
        relasi,
        `Relasi cabang kitab terhadap topik proyek (${topik.id}) tidak bisa dibuktikan dari ${cabangTampil}, tetapi ${persis}, jadi ia adalah sumber yang memang dimaksud penulis.`,
      );
    }
    return selesai(
      "belum-terverifikasi",
      "KONF_TAKJELAS_INTI",
      relasi,
      `Perlu konfirmasi: relasi cabang kitab terhadap topik proyek (${topik.id}) tidak diketahui dari ${cabangTampil}, tetapi ${buktiInti}; bukti istilah saja tidak meloloskan, jadi ia tertahan tanpa sidik.`,
    );
  }

  // (9) Tak diketahui tanpa inti → GUGUR.
  return selesai(
    "gagal-bidang",
    "GUGUR_TAKJELAS_KOSONG",
    relasi,
    `Tidak ada bukti deterministik kitab ini sebidang dengan topik proyek (${topik.id}): ${cabangTampil} tidak memetakan relasi apa pun, dan tidak ada istilah inti topik pada judul/daftar isinya.`,
  );
}

/* ════════════════════════════════════════════════════════════════════
 * Tahap G2 (6 Nov 2026): gerbang yang sama untuk kandidat JURNAL.
 *
 * Mesin sembilan aturan di atas dipakai ulang apa adanya (DATA_TOPIK,
 * TABEL_BIDANG_KITAB, leksikon inti/penolak, normalisasi yang sama);
 * yang berbeda dari kitab hanya SUMBER LABEL dan BENTUK BUKTI:
 *  - Label cabang jurnal datang dari metadata sumber (OpenAlex
 *    topics/concepts/primary_topic, subjek DOAJ, nama jurnal) yang
 *    dipetakan labelCabangDariTeks di bawah — kandidat bisa membawa
 *    BEBERAPA label sekaligus.
 *  - Bukti istilah dibaca dari judul + nama jurnal + abstrak
 *    (artikel tidak punya daftar isi).
 *  - Varian aturan 5 untuk artikel (bahan resmi): cabang sesuai
 *    tanpa istilah inti — artikel BERABSTRAK gugur (abstraknya bisa
 *    dibaca dan tetap tidak membuktikan topik), artikel TANPA
 *    abstrak tertahan (belum bisa dibuktikan, bukan terbukti salah).
 *  - Bukti inti tambahan khas artikel: judul/nama jurnal yang
 *    menyebut nama disiplin cabang yang SESUAI (mis. judul memuat
 *    "Fiqh"/"Ushul Fiqh"/"تفسير") adalah bukti kuat artikel itu
 *    memang dari cabang tersebut; ia hanya berlaku untuk cabang
 *    sesuai, tidak untuk cabang bersebelahan (aturan 6 tetap
 *    memakai istilah inti topik, sama seperti kitab).
 *  - Penolak ekonomi (اقتصاد، تجارة، سوق، استثمار، بنك، تمويل)
 *    TIDAK berlaku bila cabang iqtishad sendiri termasuk cabang
 *    sesuai proyek: pada proyek ekonomi syariah, kata-kata itu
 *    kosakata bidangnya sendiri, bukan penolak (kalau tidak, artikel
 *    ekonomi yang sah pada proyek iqtishad gugur oleh leksikonnya
 *    sendiri).
 * Putusan dan pemetaan statusnya sama dengan kitab: lolos /
 * gagal-bidang / belum-terverifikasi ("Perlu konfirmasi: ", tertahan
 * tanpa jalan pasang — putusan pemilik 5 Nov 2026 15:57).
 * ════════════════════════════════════════════════════════════════════ */

/**
 * Pola tambahan bahasa Inggris untuk memetakan teks metadata jurnal
 * (display_name topik/konsep OpenAlex, subjek DOAJ, nama jurnal) ke
 * label cabang. Diperiksa dengan urutan yang sama seperti
 * ATURAN_LABEL (yang khusus didahulukan). Sengaja TIDAK memetakan
 * kata generik telanjang: "education" sendirian bukan tarbiyah,
 * "theology" sendirian bukan akidah, "spirituality" bukan apa pun —
 * hanya frasa yang menyebut konteks Islam yang dipetakan; frasa
 * generik semacam "Islamic Studies"/"Islamic Thought" hanya menjadi
 * penanda domain Islam di pemanggil, bukan label cabang.
 */
const ATURAN_LABEL_INGGRIS: { label: LabelKitab; pola: string[] }[] = [
  {
    label: "ushul-fiqh",
    pola: ["usul al fiqh", "usul al-fiqh", "principles of islamic jurisprudence", "islamic legal theory"],
  },
  {
    label: "hadis",
    pola: ["hadith studies", "prophetic tradition"],
  },
  {
    label: "tafsir",
    pola: ["quranic", "koranic", "quran", "exegesis"],
  },
  {
    label: "akidah",
    pola: ["islamic theology"],
  },
  {
    label: "fiqh",
    pola: ["islamic law", "islamic jurisprudence", "sharia", "shariah", "halal", "muamalah", "fatwa"],
  },
  {
    label: "sirah-tarikh",
    pola: ["islamic history", "history of islam"],
  },
  {
    label: "akhlak-tasawuf",
    pola: ["sufism", "islamic ethics", "tasawwuf"],
  },
  {
    label: "lughah-adab",
    pola: ["linguistics", "arabic language", "arabic literature"],
  },
  {
    label: "tarbiyah",
    pola: ["islamic education"],
  },
  {
    label: "iqtishad",
    pola: ["economics", "economic", "islamic finance", "islamic banking", "finance", "banking", "trade"],
  },
];

/**
 * Petakan SATU string teks sumber (nama jurnal, display_name topik
 * atau konsep OpenAlex, istilah subjek DOAJ) ke label cabang, atau
 * null bila tidak ada pola yang cocok. MURNI. Pemanggil menjalankan
 * fungsi ini per string lalu menggabungkan label yang ditemukan.
 */
export function labelCabangDariTeks(teks?: string | null): LabelKitab | null {
  // Tanda kutip dibuang SEBELUM normalisasi: normalisasiJudul
  // mengubahnya menjadi spasi, yang akan memecah kata seperti
  // "Qur'anic" menjadi "qur anic" dan lolos dari pola "quranic".
  const tanpaKutip = (teks ?? "").replace(/['’‘`ʼ]/g, "");
  const bersih = normalisasiKategori(tanpaKutip)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!bersih) return null;
  for (const aturan of ATURAN_LABEL) {
    for (const pola of aturan.pola) {
      if (bersih.includes(pola)) return aturan.label;
    }
  }
  for (const aturan of ATURAN_LABEL_INGGRIS) {
    for (const pola of aturan.pola) {
      if (bersih.includes(pola)) return aturan.label;
    }
  }
  return null;
}

/**
 * Istilah nama disiplin per label cabang: kehadirannya pada JUDUL
 * artikel atau NAMA JURNAL adalah bukti artikel itu memang dari
 * cabang tersebut (judul yang menyebut nama ilmunya sendiri).
 * Daftar dibuat ketat per cabang; kata umum lintas bidang ("studi",
 * "jurnal", "pendidikan" telanjang) sengaja tidak dimasukkan.
 */
export const ISTILAH_CABANG: Record<LabelKitab, string[]> = {
  fiqh: [
    "فقه", "fiqh", "fikih", "الشريعة", "syariah", "sharia", "hukum islam",
    "islamic law", "فتاوى", "المعاملات",
  ],
  "ushul-fiqh": [
    "أصول الفقه", "ushul fiqh", "usul fiqh", "ushul fikih", "استنباط",
    "الاستنباط", "القواعد الفقهية", "istinbath",
  ],
  tafsir: ["تفسير", "tafsir", "القرآن", "quran", "علوم القرآن"],
  hadis: ["حديث", "hadis", "hadith", "السنة", "sunnah"],
  akidah: ["عقيدة", "توحيد", "akidah", "aqidah", "tauhid", "علم الكلام"],
  "sirah-tarikh": ["سيرة", "تاريخ", "sejarah", "sirah", "tarikh", "الحضارة الإسلامية"],
  "akhlak-tasawuf": ["أخلاق", "الأخلاق", "تصوف", "akhlak", "tasawuf", "sufism"],
  "lughah-adab": ["لغة", "أدب", "bahasa arab", "arabic language", "النحو", "البلاغة"],
  tarbiyah: [
    "التربية", "pendidikan islam", "pendidikan agama islam",
    "islamic education", "tarbiyah", "التعليم الإسلامي",
  ],
  iqtishad: [
    "اقتصاد", "الاقتصاد", "ekonomi", "economics", "keuangan syariah",
    "islamic finance", "islamic economics", "perbankan syariah", "الاقتصاد الإسلامي",
  ],
};

/** Penolak umum yang merupakan kosakata cabang iqtishad itu
 *  sendiri; dikeluarkan dari daftar penolak aktif bila iqtishad
 *  termasuk cabang sesuai proyek (lihat kepala bagian G2). */
const PENOLAK_EKONOMI: string[] = [
  "اقتصاد", "الاقتصادي", "تجارة", "سوق", "استثمار", "بنك", "تمويل",
];

export interface KandidatJurnalGerbang {
  judul: string;
  /** Nama jurnal penerbit (bukti istilah + sumber label terakhir). */
  jurnal?: string;
  /** Abstrak/cuplikan artikel bila ada (dari rekod OpenAlex atau
   *  bawaan kandidat). Kehadirannya mengubah aturan 5 versi artikel. */
  isi?: string;
  /** Label cabang dari metadata sumber (boleh lebih dari satu). */
  labelSumber?: LabelKitab[];
  /** Domain sumber terbukti BUKAN Islam (domain utama OpenAlex di
   *  sains keras) dan tidak ada bukti domain Islam → aturan 3. */
  domainAsingKeras?: boolean;
  /** Judul proyek (penurunan topik + bukti sebutan persis). */
  judulProyek?: string;
}

export interface HasilGerbangJurnal {
  putusan: PutusanGerbang;
  /** Kode alasan mesin (sama keluarga dengan gerbang kitab). */
  kode: string;
  /** Topik proyek yang dipakai menilai, atau "cadangan-<bidangId>". */
  topik: string;
  /** Relasi cabang sumber terkuat terhadap topik. */
  relasi: "sesuai" | "bersebelahan" | "bertentangan" | "tak diketahui";
  /** Label cabang sumber yang terbaca (bisa kosong). */
  labelSumber: LabelKitab[];
  /** Alasan Bahasa Indonesia; tertahan berawalan "Perlu konfirmasi: ". */
  alasan: string;
}

/**
 * Gerbang sembilan aturan untuk kandidat JURNAL. MURNI,
 * deterministik, tanpa model — lihat kepala bagian G2 untuk varian
 * artikelnya. Model hanya boleh MEMVETO hasil "lolos" fungsi ini
 * (di pemanggil, lib/server/verifikasi-rujukan.ts); model tidak
 * pernah menaikkan putusan fungsi ini.
 */
export function gerbangJurnal(
  kandidat: KandidatJurnalGerbang,
  bidangId: string,
): HasilGerbangJurnal {
  const labelSumber = [...new Set(kandidat.labelSumber ?? [])];
  const topik = topikProyekDari(bidangId, kandidat.judulProyek);
  const sesuaiSet = topik ? topik.sesuai : (TABEL_BIDANG_KITAB[bidangId] ?? []);
  const relasi: HasilGerbangJurnal["relasi"] = !topik
    ? labelSumber.some((l) => sesuaiSet.includes(l))
      ? "sesuai"
      : "tak diketahui"
    : labelSumber.some((l) => topik.sesuai.includes(l))
      ? "sesuai"
      : labelSumber.some((l) => topik.bersebelahan.includes(l))
        ? "bersebelahan"
        : labelSumber.some((l) => topik.bertentangan.includes(l))
          ? "bertentangan"
          : "tak diketahui";

  // Bukti istilah: judul + nama jurnal + abstrak.
  const teksBukti = normalisasiKategori(
    `${kandidat.judul ?? ""} ${kandidat.jurnal ?? ""} ${kandidat.isi ?? ""}`,
  );
  const tokenBukti = himpunanToken(teksBukti);
  const teksJudul = normalisasiKategori(`${kandidat.judul ?? ""} ${kandidat.jurnal ?? ""}`);
  const tokenJudul = himpunanToken(teksJudul);

  // Penolak aktif: penolak topik + penolak umum, dengan kosakata
  // ekonomi dikeluarkan bila iqtishad cabang sesuai proyek.
  const penolakMentah = [...(topik?.penolak ?? []), ...PENOLAK_UMUM];
  const penolakAktif = sesuaiSet.includes("iqtishad")
    ? penolakMentah.filter((p) => !PENOLAK_EKONOMI.includes(p))
    : penolakMentah;
  const penolakAda = istilahPertama(teksBukti, tokenBukti, penolakAktif);

  // Inti leksikon topik pada seluruh bukti; inti disiplin hanya dari
  // judul/nama jurnal dan hanya untuk cabang sesuai.
  const intiLeksikon = topik ? istilahPertama(teksBukti, tokenBukti, topik.inti) : null;
  let intiDisiplin: string | null = null;
  for (const label of sesuaiSet) {
    const istilah = istilahPertama(teksJudul, tokenJudul, ISTILAH_CABANG[label] ?? []);
    if (istilah) {
      intiDisiplin = istilah;
      break;
    }
  }
  // Sebutan persis memakai mesin kitab (judul artikel disebut utuh
  // pada judul proyek): bukti penulis memang meneliti artikel ini.
  // Saringan kata topik diperluas ke bentuk nisba (akhiran ه ↔ ي,
  // mis. معرفة ↔ معرفي): stemmer awalan G1 tidak menyamakan kedua
  // bentuk itu, dan tanpa varian ini kata sifat topik pada judul
  // artikel terbaca sebagai "nama khas" oleh bukti sebutan persis.
  const kataTopikMentah = tokenDariDaftarIstilah(
    topik ? [...topik.inti, ...topik.penolak, ...PENOLAK_UMUM] : PENOLAK_UMUM,
  );
  const kataTopik = new Set<string>(kataTopikMentah);
  for (const t of kataTopikMentah) {
    if (t.endsWith("ه")) kataTopik.add(`${t.slice(0, -1)}ي`);
    if (t.endsWith("ي")) kataTopik.add(`${t.slice(0, -1)}ه`);
  }
  const persis = buktiSebutanPersis(
    { judul: kandidat.judul, judulProyek: kandidat.judulProyek },
    kataTopik,
  );
  const intiAda = intiLeksikon !== null || intiDisiplin !== null || persis !== null;
  const buktiInti = intiLeksikon
    ? `istilah inti topik "${intiLeksikon}" ada pada judul/abstrak artikel`
    : intiDisiplin
      ? `judul/nama jurnal menyebut disiplin cabang yang sesuai ("${intiDisiplin}")`
      : persis
        ? persis.replace("judul kitab", "judul artikel")
        : "";
  const labelTampil =
    labelSumber.length > 0
      ? `label cabang dari metadata sumber: ${labelSumber.join(", ")}`
      : "metadata sumber tidak memberi label cabang yang dikenal";
  const adaIsi = Boolean((kandidat.isi ?? "").trim());

  const selesai = (
    putusan: PutusanGerbang,
    kode: string,
    alasan: string,
  ): HasilGerbangJurnal => ({
    putusan,
    kode,
    topik: topik ? topik.id : `cadangan-${bidangId || "(kosong)"}`,
    relasi,
    labelSumber,
    alasan,
  });

  // (3) Domain sumber bukan Islam (sains keras) padahal proyek
  // studi Islam → GUGUR sebelum aturan lain.
  if (kandidat.domainAsingKeras) {
    return selesai(
      "gagal-bidang",
      "DOMAIN_ASING",
      `Domain utama sumber artikel ini pada rekod OpenAlex berada di luar studi Islam (sains keras), sedangkan proyek ini bidang studi Islam (${bidangId}); ${labelTampil}.`,
    );
  }

  // (1) Penolak ada dan inti tidak ada → GUGUR.
  if (penolakAda && !intiAda) {
    return selesai(
      "gagal-bidang",
      "IST_PENOLAK",
      `Judul/abstrak artikel memuat istilah penolak "${penolakAda}" untuk proyek ini dan tidak memuat bukti inti apa pun; ${labelTampil}. Artikel ini gugur sebelum penilaian lain.`,
    );
  }

  // (2) Ada label cabang BERTENTANGAN dan tidak ada label sesuai →
  // GUGUR; label menggugurkan sebelum istilah menolong (pelajaran
  // kasus uang panai). Label sesuai yang ikut hadir menang lebih
  // dulu karena relasi dihitung "sesuai" untuk kasus itu.
  if (relasi === "bertentangan") {
    return selesai(
      "gagal-bidang",
      "CAB_BERTENTANGAN",
      `Artikel ini ${labelTampil}, cabang yang BERTENTANGAN dengan topik proyek (${topik?.id ?? bidangId}). Label sumber menggugurkan lebih dulu, sebelum istilah pada judulnya diperiksa, dan tidak ada skor model yang boleh membatalkannya.`,
    );
  }

  // (4) Sesuai + inti → LOLOS; pengaman: penolak ikut hadir →
  // turun menjadi tertahan.
  if (relasi === "sesuai" && intiAda) {
    if (penolakAda) {
      return selesai(
        "belum-terverifikasi",
        "KONF_PENOLAK",
        `Perlu konfirmasi: cabang artikel sesuai proyek dan ${buktiInti}, tetapi judul/abstraknya juga memuat istilah penolak "${penolakAda}", jadi putusan lolosnya diturunkan menjadi tertahan tanpa jalan pasang.`,
      );
    }
    return selesai(
      "lolos",
      "SESUAI_INTI",
      `Artikel ini ${labelTampil}, sesuai dengan proyek (${topik?.id ?? bidangId}), dan ${buktiInti}.`,
    );
  }

  // (5) Sesuai tanpa inti → varian artikel: berabstrak GUGUR,
  // tanpa abstrak tertahan.
  if (relasi === "sesuai") {
    if (adaIsi) {
      return selesai(
        "gagal-bidang",
        "GUGUR_SESUAI_TANPA_INTI",
        `Artikel ini ${labelTampil} yang sesuai proyek, tetapi abstraknya terbaca dan tetap tidak memuat istilah inti topik maupun nama disiplin cabangnya, jadi ia gugur (aturan artikel berabstrak).`,
      );
    }
    return selesai(
      "belum-terverifikasi",
      "KONF_SESUAI_TANPA_INTI",
      `Perlu konfirmasi: artikel ini ${labelTampil} yang sesuai proyek, tetapi tidak ada abstrak yang bisa dibaca dan tidak ada istilah inti pada judulnya, jadi ia tertahan tanpa jalan pasang sampai ada bukti isi.`,
    );
  }

  // (6) Bersebelahan + inti → tertahan (pendukung tidak meloloskan).
  if (relasi === "bersebelahan" && (intiLeksikon !== null || persis !== null)) {
    return selesai(
      "belum-terverifikasi",
      "KONF_SEBELAHAN_INTI",
      `Perlu konfirmasi: cabang artikel (${labelTampil}) hanya BERSEBELAHAN dengan topik proyek (${topik?.id ?? bidangId}); ${buktiInti} menaikkannya dari gugur menjadi tertahan, tetapi bidang pendukung tidak pernah meloloskan.`,
    );
  }

  // (7) Bersebelahan tanpa inti → GUGUR.
  if (relasi === "bersebelahan") {
    return selesai(
      "gagal-bidang",
      "GUGUR_SEBELAHAN_TANPA_INTI",
      `Cabang artikel (${labelTampil}) hanya bersebelahan dengan topik proyek (${topik?.id ?? bidangId}) dan tidak ada istilah inti topik pada judul/abstraknya, jadi artikel ini gugur.`,
    );
  }

  // (8)/(9) Relasi tak diketahui.
  if (persis) {
    return selesai(
      "lolos",
      "SEBUT_PERSIS",
      `Relasi cabang artikel terhadap proyek tidak bisa dibuktikan dari ${labelTampil}, tetapi ${persis.replace("judul kitab", "judul artikel")}, jadi ia adalah sumber yang memang dimaksud penulis.`,
    );
  }
  if (intiAda) {
    return selesai(
      "belum-terverifikasi",
      "KONF_TAKJELAS_INTI",
      `Perlu konfirmasi: relasi cabang artikel terhadap proyek tidak diketahui dari ${labelTampil}, tetapi ${buktiInti}; bukti istilah saja tidak meloloskan artikel yang label cabangnya tidak terbukti, jadi ia tertahan tanpa jalan pasang.`,
    );
  }
  return selesai(
    "gagal-bidang",
    "GUGUR_TAKJELAS_KOSONG",
    `Tidak ada bukti deterministik artikel ini sebidang dengan proyek (${topik?.id ?? bidangId}): ${labelTampil}, dan tidak ada istilah inti topik pada judul/abstraknya.`,
  );
}
