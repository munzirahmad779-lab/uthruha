export type KaryaType = "skripsi" | "tesis" | "disertasi" | "jurnal";
export type Metode = "kuantitatif" | "kualitatif" | "mixed";

export const KARYA_LABEL: Record<KaryaType, { id: string; ar: string; jenjang: string }> = {
  skripsi: { id: "Skripsi", ar: "البحث الجامعي", jenjang: "Sarjana (S-1)" },
  tesis: { id: "Tesis", ar: "الرسالة العلمية", jenjang: "Magister (S-2)" },
  disertasi: { id: "Disertasi", ar: "الأطروحة", jenjang: "Doktor (S-3)" },
  jurnal: { id: "Artikel Jurnal", ar: "المقال العلمي", jenjang: "Publikasi" },
};

export const METODE_LABEL: Record<Metode, { id: string; ar: string; desc: string }> = {
  kuantitatif: {
    id: "Kuantitatif",
    ar: "البحث الكمي",
    desc: "Angka, uji statistik, generalisasi, hipotesis terukur.",
  },
  kualitatif: {
    id: "Kualitatif",
    ar: "البحث الكيفي",
    desc: "Makna, kedalaman kasus, wawancara, analisis tematik.",
  },
  mixed: {
    id: "Campuran (Mixed)",
    ar: "البحث المختلط",
    desc: "Gabungan kuantitatif–kualitatif dengan desain eksplisit.",
  },
};

/** Bidang keilmuan yang lazim menulis karya ilmiah dalam bahasa Arab. */
export interface FieldDef {
  id: string;
  labelId: string;
  labelAr: string;
  /** Kata kunci untuk pencocokan jurnal & pencarian frasa. */
  keywords: string[];
  /** Teori/konsep kunci berbahasa Arab yang biasa dipakai di bidang ini. */
  teori: { ar: string; id: string }[];
  /** Rujukan kanonik yang sering muncul di bidang ini (bukan pengganti verifikasi). */
  rujukanKunci: string[];
  /** Contoh topik yang bisa langsung dipakai. */
  contohTopik: { ar: string; id: string }[];
}

/** Satu sub-bagian naskah (mis. خلفية البحث). */
export interface SectionDef {
  id: string;
  labelId: string;
  labelAr: string;
  /** Judul yang dicetak di naskah (Arab). */
  headingAr: string;
  /** Panduan pengisian dalam Bahasa Indonesia. */
  panduan: string;
  /** Pertanyaan pemicu untuk memetakan isi bagian ini. */
  pemicu: string[];
  /** Target kata minimum yang wajar. */
  targetKata: number;
  /** Batasi bagian ini ke metode tertentu. */
  metode?: Metode[];
  /** Tandai bagian yang butuh data lapangan penulis. */
  butuhData?: boolean;
}

export interface ChapterDef {
  id: string;
  labelId: string;
  labelAr: string;
  /** Sebutan bab dalam naskah Arab, mis. الباب الأول. */
  babAr: string;
  sections: SectionDef[];
}

export interface StrukturDef {
  karya: KaryaType;
  labelId: string;
  labelAr: string;
  deskripsi: string;
  rentang: string;
  chapters: ChapterDef[];
  /** Bagian depan & belakang naskah. */
  frontMatter: string[];
  backMatter: string[];
}

export interface FrasaEntry {
  id: string;
  /** id SectionDef tujuan, mis. "khalfiya" */
  section: string;
  ar: string;
  arti: string;
  tags: string[];
}

export interface SidangItem {
  id: string;
  kategori: "metode" | "teori" | "sumber" | "etika" | "kebaruan" | "penulisan";
  pertanyaanId: string;
  pertanyaanAr: string;
  tipsId: string;
  metode?: Metode[];
}

export interface JurnalEntry {
  id: string;
  namaAr: string;
  namaLatin: string;
  penerbit: string;
  cakupan: string;
  bahasa: string;
  akses: "Terbuka" | "Hibrida" | "Berlangganan";
  apc: string;
  indeks: string[];
  bidang: string[];
  url: string;
  catatan: string;
}

export interface MetodeDef {
  id: Metode;
  labelId: string;
  labelAr: string;
  ringkas: string;
  desain: { ar: string; id: string }[];
  teknik: { ar: string; id: string }[];
  analisis: { ar: string; id: string }[];
  keabsahan: { ar: string; id: string }[];
}
