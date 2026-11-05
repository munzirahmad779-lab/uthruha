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
  /** Jenis sumber sebagai DATA terstruktur (Tahap 6). Dulu jenis
   *  artikel jurnal disisipkan sebagai tag teks "[مجلة]" di kepala
   *  judul dan mencemari semua permukaan; sekarang jenis hidup di
   *  bidang ini dan judul selalu judul bersih. */
  jenis?: import("@/lib/engine/cite").JenisSumber;
  /** Nama jurnal untuk kandidat artikel (bukan lagi disisipkan ke
   *  penerbit atau judul). */
  jurnal?: string;
  /** Kategori kitab MENTAH dari rekod sumber (mis. "العقيدة" dari
   *  klasifikasi Shamela/Turath), apa adanya dari sumber — pemetaan
   *  ke taksonomi bidang adalah pekerjaan gerbang kategori kitab
   *  (lib/engine/kategori-kitab.ts, Tahap G1). Kosong berarti rekod
   *  sumber memang tidak membawa kategori; bukan karangan adapter. */
  kategoriKitab?: string;
  /** DOI bersih (tanpa awalan https://doi.org/) bila diketahui. */
  doi?: string;
  /** Volume dan nomor terbitan jurnal. */
  volume?: string;
  nomor?: string;
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
  /** Penilaian relevansi ringan sesudah hasil terkumpul (lib/refs/index):
   *  judul kandidat hampir tidak menyentuh konsep atau kalimat pencarian.
   *  Kandidat tetap tampil dengan skor apa adanya, hanya diberi label
   *  dan diurutkan sesudah kandidat yang relevan. */
  relevansiRendah?: boolean;
  /** Alasan singkat relevansiRendah, ditampilkan pada kartu hasil. */
  alasanRelevansi?: string;
}

/** Kandidat + konteks kalimat asal. */
export interface RefHit extends RefCandidate {
  id: string;
  /** Kalimat dari paragraf yang dicari. */
  kalimat: string;
  /** Putusan gerbang relevansi bidang dari server (Tahap 4) — hanya
   *  terisi bila rute pencarian menerima konteks bidang proyek.
   *  Kandidat tertahan (lolos false) wajib ditampilkan dengan
   *  alasannya dan hanya dipasang lewat konfirmasi sadar pengguna. */
  gerbang?: {
    lolos: boolean;
    perluKonfirmasi: boolean;
    bidangSumber: string;
    alasan: string;
    statusPenilaian: "dinilai" | "tidak-dinilai" | "aturan-keras";
    skorModel?: number;
  };
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
  /** Konteks bidang proyek untuk gerbang relevansi (Tahap 4): id bidang
   *  dari lib/content/bidang.ts. Bila terisi, rute menilai kandidat
   *  teratas dengan gerbang yang sama seperti Generate Footnote. */
  bidangId?: string;
  /** Judul proyek untuk konteks gerbang relevansi. */
  judulProyek?: string;
  /** Sinyal tema proyek untuk konteks gerbang (judul lebih dulu). */
  topikAr?: string;
  /** Diisi SERVER dari sesi (bukan dari klien): pemanggil Premium terverifikasi. */
  premium?: boolean;
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
