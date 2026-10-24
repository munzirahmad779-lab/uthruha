/** Tipe bersama untuk pencari rujukan multi-sumber. */

/** Sumber pencarian yang benar-benar dipanggil. */
export type SourceId = "turath" | "shamela" | "ketabonline" | "usul";

/** Sumber verifikasi (tidak masuk skor pencarian). */
export type VerifId = "waqfeya";

/** Sumber data manual — rujukan yang ditulis sendiri oleh pengguna. */
export type ManualId = "manual";

/** Sumber mana pun yang bisa menjadi pemilik sebuah kandidat. */
export type RefSourceId = SourceId | ManualId;

export type AdapterMode = "api" | "deeplink";

/**
 * Cara mencari.
 * - `kata`   : mencocokkan kata/frasa paragraf apa adanya (persis).
 * - `konsep` : mencocokkan TOPIK lewat konsep + judul bab kitab.
 *
 * Mode `konsep` memakai LLM (bila tersedia) HANYA untuk mengubah paragraf
 * menjadi istilah pencarian. Bila tidak ada LLM yang siap, ia turun ke
 * pengekstrakan konsep deterministik. Sitasi selalu dari Turath.
 */
export type ModeCari = "kata" | "konsep";

/** Dari mana istilah mode konsep berasal — ditampilkan agar bisa diaudit. */
export interface AsalIstilah {
  /** "llm" bila dibantu model, "aturan" bila deterministik. */
  jenis: "llm" | "aturan";
  /** id penyedia LLM yang menjawab ("ollama", "gemini", …). */
  penyedia?: string;
  /** Model yang benar-benar dipakai. */
  model?: string;
  /** Alasan bila LLM gagal dan terpaksa memakai aturan. */
  alasan?: string;
}

/** Satu kandidat rujukan yang sudah dinormalisasi lintas sumber. */
export interface RefCandidate {
  source: RefSourceId;
  kitab: string;
  penulis?: string;
  jilid?: number;
  /** Nomor halaman cetak (bukan halaman digital/PDF). */
  halaman_cetak?: number;
  halaman_digital?: number;
  penerbit?: string;
  kota?: string;
  tahun?: number;
  teks_kutipan: string;
  url_sumber: string;
  /** Tautan verifikasi (PDF cetak Waqfeya atau halaman asal). */
  url_verifikasi?: string;
  /** 0..1 — kemiripan antara kalimat pencarian dan kutipan. */
  skor: number;
  mode: AdapterMode;
  /** true bila ada kolom wajib yang belum terisi dan butuh dicek manusia. */
  perluVerifikasi: boolean;
  /** Alasan `perluVerifikasi` — ditampilkan apa adanya ke pengguna. */
  catatanVerifikasi?: string;
  /** Judul bab kitab (mode konsep) — bukti topik yang dipakai untuk menilai. */
  judul_bab?: string;
  /** Konsep paragraf yang ditemukan di judul bab (mode konsep). */
  konsep_cocok?: string[];
  /** Dari cara pencarian mana skor ini berasal. */
  skor_jenis?: ModeCari;
}

/** Kandidat + konteks kalimat asal. */
export interface RefHit extends RefCandidate {
  id: string;
  /** Kalimat dari paragraf yang dicari. */
  kalimat: string;
}

export interface SourceStatus {
  source: SourceId | VerifId;
  mode: AdapterMode;
  status: "ok" | "kosong" | "gagal" | "lewati";
  jumlah: number;
  pesan?: string;
}

export interface SearchRequest {
  sentences: string[];
  sources?: SourceId[];
  /** Cara mencari: cocokkan kata paragraf, atau cocokkan topik/konsepnya. */
  mode?: ModeCari;
  /** Jangan pakai LLM sama sekali (mode konsep jadi murni deterministik). */
  tanpaLLM?: boolean;
  /** Batasi ke penyedia LLM tertentu; kosong = seluruh rantai. */
  penyediaLLM?: string[];
  /** Key milik pengguna (sessionStorage), hanya untuk sumber yang menerima key. */
  kunci?: Partial<Record<SourceId, string>>;
  /** Kunci LLM pribadi yang dibawa mahasiswa dari browser (BYOK). */
  kunciLLM?: string;
  /** Konsep kustom yang dipilih/ditulis pengguna langsung dari UI. */
  konsepKustom?: string[];
}

export interface SearchResponse {
  /** Kandidat nyata dari sumber ber-API — boleh dipilih sebagai footnote. */
  hasil: RefHit[];
  /** Tautan buka-manual dari sumber tanpa API — tidak bisa dipilih. */
  pintu: RefHit[];
  status: SourceStatus[];
  peringatan: string[];
  /** Mode yang benar-benar dipakai server (bisa turun dari konsep ke kata). */
  mode?: ModeCari;
  /** Konsep yang dipakai pada mode konsep — ditampilkan agar bisa diaudit. */
  konsep?: string[];
  /** Asal istilah: LLM atau aturan deterministik. */
  asal?: AsalIstilah;
}

/** Batas keras produk. */
export const BATAS = {
  maksKalimat: 8,
  maksPanjangKalimat: 600,
  maksFootnotePerParagraf: 2,
  maksHalaman: 1,
} as const;

export const SOURCE_INFO: Record<SourceId, { nama: string; domain: string; peran: string; api: string }> = {
  turath: {
    nama: "Turath.io",
    domain: "api.turath.io",
    peran: "Pencarian kalimat Arab presisi, jilid & halaman cetak",
    api: "Terbuka (tanpa key) — diuji langsung",
  },
  shamela: {
    nama: "Shamela.ws",
    domain: "shamela.ws",
    peran: "Basis korpus kitab",
    api: "Terbuka (tanpa key) — diuji langsung, POST /ajax/search",
  },
  ketabonline: {
    nama: "Ketabonline",
    domain: "ketabonline.com",
    peran: "Korpus luas (100.000+ kitab)",
    api: "Tidak terdokumentasi — deep-link",
  },
  usul: {
    nama: "Usul.ai",
    domain: "usul.ai",
    peran: "Eksplorasi konsep",
    api: "Belum dikonfirmasi penyedia — deep-link",
  },
};

export const VERIF_INFO: Record<VerifId, { nama: string; domain: string; peran: string }> = {
  waqfeya: {
    nama: "Waqfeya",
    domain: "waqfeya.com",
    peran: "PDF cetak asli untuk verifikasi halaman",
  },
};

export const MANUAL_INFO: Record<ManualId, { nama: string; domain: string; peran: string; api: string }> = {
  manual: {
    nama: "Rujukan manual",
    domain: "—",
    peran: "Data rujukan yang Anda tulis sendiri dari kitab cetak",
    api: "Tanpa pencarian — isian manual, kolom kosong ditandai",
  },
};

/** Nama sumber yang bisa dipakai untuk sumber otomatis maupun manual. */
export function namaSumber(id: RefSourceId): string {
  if (id === "manual") return MANUAL_INFO.manual.nama;
  return SOURCE_INFO[id]?.nama ?? id;
}
