/**
 * Skema ketat keluaran model PENCARIAN (Tahap G2, 6 Nov 2026).
 *
 * Prinsip dari bahan resmi pemilik (search_output.schema.json):
 * keluaran model untuk kata kunci/kalimat kunci adalah SARAN
 * PENCARIAN, bukan rujukan. Karena itu bentuknya dikunci:
 *  - status hanya satu dari siap / perlu_disambiguasi /
 *    tidak_ditemukan;
 *  - kata_kunci_inti berisi istilah + bahasa + pendamping konteks;
 *  - perluasan_kueri berisi teks kueri + jenis + sumber target;
 *  - bidang memakai enum label tertutup (sebelas label bahan);
 *  - FIELD BIBLIOGRAFIS APA PUN (judul, doi, penulis, kandidat,
 *    referensi, dst.), pola DOI di teks mana pun, kueri satu token,
 *    atau kunci tak dikenal di tingkat mana pun membuat keluaran
 *    TIDAK SAH — pemanggil mencoba ulang sekali, lalu gagal
 *    tertutup (tidak_ditemukan beralasan enum), bukan mengarang
 *    kunci cadangan.
 *
 * Berkas ini MURNI: validator tidak memanggil jaringan dan tidak
 * mengubah masukan. Struktur internal mengikuti skema; nama tampil
 * di UI tetap "kalimat kunci" seperti ketetapan pemilik.
 */

/** Sebelas label bidang bahan resmi (enum tertutup skema). */
export const LABEL_BIDANG_SKEMA = [
  "fikih_munakahat",
  "ushul_fikih",
  "akidah_tauhid",
  "tafsir_ulum_quran",
  "hadis_ulum_hadis",
  "maqashid_syarie",
  "pemikiran_islam",
  "integrasi_keilmuan",
  "lainnya_studi_islam",
  "di_luar_studi_islam",
  "tidak_jelas",
] as const;
export type LabelBidangSkema = (typeof LABEL_BIDANG_SKEMA)[number];

export type BahasaSkema = "id" | "ar" | "en";
export type JenisPerluasan = "inti" | "sinonim" | "lebih_luas" | "lebih_sempit" | "terkait";
export type SumberTarget = "crossref" | "doaj" | "openalex" | "shamela" | "turath";
export type AlasanTidakDitemukan =
  | "di_luar_studi_islam"
  | "topik_tidak_spesifik"
  | "tidak_cukup_informasi";

export interface KataKunciIntiSkema {
  istilah: string;
  bahasa: BahasaSkema;
  pendamping_konteks: string[];
}
export interface PerluasanKueriSkema {
  teks: string;
  bahasa: BahasaSkema;
  jenis: JenisPerluasan;
  sumber_target: SumberTarget[];
}
export interface MaknaAmbiguitasSkema {
  makna: string;
  bidang: LabelBidangSkema;
}
export interface KeluaranPencarian {
  status: "siap" | "perlu_disambiguasi" | "tidak_ditemukan";
  kata_kunci_inti: KataKunciIntiSkema[];
  perluasan_kueri: PerluasanKueriSkema[];
  bidang_utama?: LabelBidangSkema;
  bidang_pendukung?: LabelBidangSkema[];
  ambiguitas?: { istilah_ambigu: string; kemungkinan_makna: MaknaAmbiguitasSkema[] };
  alasan_tidak_ditemukan?: AlasanTidakDitemukan;
}

/** Nama field bibliografis yang kehadirannya membatalkan keluaran
 *  model pencarian di tingkat mana pun. */
export const FIELD_BIBLIOGRAFIS = [
  "judul", "doi", "penulis", "pengarang", "kandidat", "referensi",
  "tahun", "jurnal", "penerbit", "isbn", "issn", "volume", "halaman",
  "title", "author", "authors", "year", "journal", "publisher",
];

/** Pola DOI di teks bebas (10.xxxx/… atau tautan doi.org). */
const POLA_DOI = /10\.\d{4,9}\/\S+|doi\.org\//i;
export function mengandungPolaDoi(teks: string): boolean {
  return POLA_DOI.test(teks);
}

function objekPolos(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function kunciAsing(obj: Record<string, unknown>, diizinkan: string[]): string | null {
  for (const k of Object.keys(obj)) {
    if (!diizinkan.includes(k)) return k;
  }
  return null;
}

function teksSah(x: unknown, min: number, maks: number): x is string {
  return typeof x === "string" && x.trim().length >= min && x.trim().length <= maks;
}

type HasilValidasi =
  | { sah: true; nilai: KeluaranPencarian }
  | { sah: false; alasan: string };

/**
 * Validasi satu keluaran mentah model terhadap skema ketat.
 * Mengembalikan nilai ternormalisasi (string dipangkas) atau alasan
 * penolakan pertama yang ditemukan.
 */
export function validasiKeluaranPencarian(mentah: unknown): HasilValidasi {
  const gagal = (alasan: string): HasilValidasi => ({ sah: false, alasan });
  if (!objekPolos(mentah)) return gagal("keluaran bukan objek JSON");

  const asing = kunciAsing(mentah, [
    "status", "kata_kunci_inti", "perluasan_kueri", "bidang_utama",
    "bidang_pendukung", "ambiguitas", "alasan_tidak_ditemukan",
  ]);
  if (asing) {
    return gagal(
      FIELD_BIBLIOGRAFIS.includes(asing)
        ? `keluaran memuat field bibliografis "${asing}" — model pencarian dilarang mengeluarkan rujukan`
        : `keluaran memuat field tak dikenal "${asing}" di luar skema`,
    );
  }
  const status = mentah.status;
  if (status !== "siap" && status !== "perlu_disambiguasi" && status !== "tidak_ditemukan") {
    return gagal("status tidak dikenal (wajib siap/perlu_disambiguasi/tidak_ditemukan)");
  }

  const intiMentah = mentah.kata_kunci_inti ?? [];
  const perluasanMentah = mentah.perluasan_kueri ?? [];
  if (!Array.isArray(intiMentah) || !Array.isArray(perluasanMentah)) {
    return gagal("kata_kunci_inti/perluasan_kueri bukan daftar");
  }

  const inti: KataKunciIntiSkema[] = [];
  for (const item of intiMentah) {
    if (!objekPolos(item)) return gagal("butir kata_kunci_inti bukan objek");
    const a = kunciAsing(item, ["istilah", "bahasa", "pendamping_konteks"]);
    if (a) return gagal(`butir kata_kunci_inti memuat field tak dikenal "${a}"`);
    if (!teksSah(item.istilah, 1, 120)) return gagal("istilah kata_kunci_inti kosong/terlalu panjang");
    if (mengandungPolaDoi(item.istilah)) return gagal("istilah memuat pola DOI");
    if (item.bahasa !== "id" && item.bahasa !== "ar" && item.bahasa !== "en") {
      return gagal("bahasa kata_kunci_inti di luar enum id/ar/en");
    }
    const pendamping = item.pendamping_konteks;
    if (
      !Array.isArray(pendamping) ||
      pendamping.length < 1 ||
      pendamping.length > 5 ||
      !pendamping.every((p) => teksSah(p, 1, 80))
    ) {
      return gagal("pendamping_konteks wajib 1-5 frasa pendek (maks 80 aksara)");
    }
    if (pendamping.some((p) => mengandungPolaDoi(p as string))) {
      return gagal("pendamping_konteks memuat pola DOI");
    }
    inti.push({
      istilah: (item.istilah as string).trim(),
      bahasa: item.bahasa,
      pendamping_konteks: pendamping.map((p) => (p as string).trim()),
    });
  }

  const perluasan: PerluasanKueriSkema[] = [];
  const JENIS: JenisPerluasan[] = ["inti", "sinonim", "lebih_luas", "lebih_sempit", "terkait"];
  const SUMBER: SumberTarget[] = ["crossref", "doaj", "openalex", "shamela", "turath"];
  for (const item of perluasanMentah) {
    if (!objekPolos(item)) return gagal("butir perluasan_kueri bukan objek");
    const a = kunciAsing(item, ["teks", "bahasa", "jenis", "sumber_target"]);
    if (a) return gagal(`butir perluasan_kueri memuat field tak dikenal "${a}"`);
    if (!teksSah(item.teks, 5, 200)) return gagal("teks perluasan_kueri di luar 5-200 aksara");
    const teks = (item.teks as string).trim();
    if (mengandungPolaDoi(teks)) return gagal("teks perluasan_kueri memuat pola DOI");
    if (teks.split(/\s+/).filter(Boolean).length < 2) {
      return gagal("teks perluasan_kueri hanya satu token — kueri wajib frasa");
    }
    if (item.bahasa !== "id" && item.bahasa !== "ar" && item.bahasa !== "en") {
      return gagal("bahasa perluasan_kueri di luar enum id/ar/en");
    }
    if (!JENIS.includes(item.jenis as JenisPerluasan)) return gagal("jenis perluasan di luar enum");
    const target = item.sumber_target;
    if (
      !Array.isArray(target) ||
      target.length < 1 ||
      target.length > 5 ||
      !target.every((t) => SUMBER.includes(t as SumberTarget))
    ) {
      return gagal("sumber_target wajib 1-5 dari enum sumber");
    }
    perluasan.push({
      teks,
      bahasa: item.bahasa,
      jenis: item.jenis as JenisPerluasan,
      sumber_target: target as SumberTarget[],
    });
  }

  const bidangSah = (x: unknown): x is LabelBidangSkema =>
    typeof x === "string" && (LABEL_BIDANG_SKEMA as readonly string[]).includes(x);
  let bidangUtama: LabelBidangSkema | undefined;
  if (mentah.bidang_utama !== undefined) {
    if (!bidangSah(mentah.bidang_utama)) return gagal("bidang_utama di luar enum label");
    bidangUtama = mentah.bidang_utama;
  }
  let bidangPendukung: LabelBidangSkema[] | undefined;
  if (mentah.bidang_pendukung !== undefined) {
    if (!Array.isArray(mentah.bidang_pendukung) || !mentah.bidang_pendukung.every(bidangSah)) {
      return gagal("bidang_pendukung di luar enum label");
    }
    bidangPendukung = mentah.bidang_pendukung;
  }

  if (status === "siap") {
    if (inti.length < 1 || inti.length > 12) return gagal("status siap wajib membawa 1-12 kata_kunci_inti");
    if (perluasan.length < 1 || perluasan.length > 10) return gagal("status siap wajib membawa 1-10 perluasan_kueri");
    if (!bidangUtama) return gagal("status siap wajib membawa bidang_utama");
    if (mentah.ambiguitas !== undefined) return gagal("status siap tidak boleh membawa ambiguitas");
    if (mentah.alasan_tidak_ditemukan !== undefined) return gagal("status siap tidak boleh membawa alasan_tidak_ditemukan");
    return {
      sah: true,
      nilai: {
        status,
        kata_kunci_inti: inti,
        perluasan_kueri: perluasan,
        bidang_utama: bidangUtama,
        ...(bidangPendukung ? { bidang_pendukung: bidangPendukung } : {}),
      },
    };
  }

  if (status === "perlu_disambiguasi") {
    if (inti.length > 0 || perluasan.length > 0) {
      return gagal("status perlu_disambiguasi tidak boleh membawa kata kunci/kueri jadi");
    }
    const amb = mentah.ambiguitas;
    if (!objekPolos(amb)) return gagal("status perlu_disambiguasi wajib membawa objek ambiguitas");
    const a = kunciAsing(amb, ["istilah_ambigu", "kemungkinan_makna"]);
    if (a) return gagal(`ambiguitas memuat field tak dikenal "${a}"`);
    if (!teksSah(amb.istilah_ambigu, 1, 120)) return gagal("istilah_ambigu kosong");
    const makna = amb.kemungkinan_makna;
    if (!Array.isArray(makna) || makna.length < 2 || makna.length > 6) {
      return gagal("kemungkinan_makna wajib 2-6 butir");
    }
    const daftar: MaknaAmbiguitasSkema[] = [];
    for (const m of makna) {
      if (!objekPolos(m)) return gagal("butir kemungkinan_makna bukan objek");
      const am = kunciAsing(m, ["makna", "bidang"]);
      if (am) return gagal(`butir kemungkinan_makna memuat field tak dikenal "${am}"`);
      if (!teksSah(m.makna, 1, 200)) return gagal("makna kosong/terlalu panjang");
      if (!bidangSah(m.bidang)) return gagal("bidang makna di luar enum label");
      daftar.push({ makna: (m.makna as string).trim(), bidang: m.bidang });
    }
    return {
      sah: true,
      nilai: {
        status,
        kata_kunci_inti: [],
        perluasan_kueri: [],
        ambiguitas: { istilah_ambigu: (amb.istilah_ambigu as string).trim(), kemungkinan_makna: daftar },
        ...(bidangUtama ? { bidang_utama: bidangUtama } : {}),
        ...(bidangPendukung ? { bidang_pendukung: bidangPendukung } : {}),
      },
    };
  }

  // tidak_ditemukan
  if (inti.length > 0 || perluasan.length > 0) {
    return gagal("status tidak_ditemukan tidak boleh membawa kata kunci/kueri");
  }
  if (mentah.ambiguitas !== undefined) return gagal("status tidak_ditemukan tidak boleh membawa ambiguitas");
  const alasan = mentah.alasan_tidak_ditemukan;
  if (
    alasan !== "di_luar_studi_islam" &&
    alasan !== "topik_tidak_spesifik" &&
    alasan !== "tidak_cukup_informasi"
  ) {
    return gagal("tidak_ditemukan wajib membawa alasan_tidak_ditemukan dari enum");
  }
  return {
    sah: true,
    nilai: { status, kata_kunci_inti: [], perluasan_kueri: [], alasan_tidak_ditemukan: alasan },
  };
}

/* ── Kamus ambiguitas (bahan resmi) ────────────────────────────────
 * Makna-makna istilah yang terbukti ambigu beserta konteks wajib
 * tiap makna. Memilih makna berarti pendamping konteksnya DIPAKSA
 * ikut dalam pencarian (pemanggil menambahkannya ke kunci Arab). */
export interface EntriAmbiguitas {
  /** Istilah pemicu (dicocokkan ternormalisasi sebagai potongan). */
  istilah: string[];
  makna: { makna: string; bidang: LabelBidangSkema; konteks: string[] }[];
}

export const KAMUS_AMBIGUITAS: EntriAmbiguitas[] = [
  {
    istilah: ["تكامل", "التكامل", "takamul"],
    makna: [
      {
        makna: "Integrasi keilmuan (takamul ma'rifi): penyatuan ilmu-ilmu syariah dan keilmuan umum",
        bidang: "integrasi_keilmuan",
        konteks: ["المعرفة", "العلوم الشرعية", "العلوم الكونية", "التأصيل", "إسلامية المعرفة"],
      },
      {
        makna: "Integrasi ekonomi antarnegara/kawasan",
        bidang: "di_luar_studi_islam",
        konteks: ["الاقتصادي", "التجارة", "السوق", "الإقليمي"],
      },
      {
        makna: "Kalkulus (hisab at-tafadul wa at-takamul, matematika)",
        bidang: "di_luar_studi_islam",
        konteks: ["التفاضل", "حساب", "الرياضيات"],
      },
      {
        makna: "Integrasi sosial kemasyarakatan",
        bidang: "pemikiran_islam",
        konteks: ["المجتمع", "الاجتماعي", "الثقافي"],
      },
    ],
  },
];

/** Entri kamus untuk teks (judul/istilah), atau null. Pencocokan
 *  sederhana pada bentuk huruf kecil; istilah Arab dicocokkan apa
 *  adanya sebagai potongan teks. */
export function kamusAmbiguitasUntuk(teks: string): EntriAmbiguitas | null {
  const t = (teks ?? "").toLowerCase();
  for (const entri of KAMUS_AMBIGUITAS) {
    if (entri.istilah.some((i) => t.includes(i.toLowerCase()))) return entri;
  }
  return null;
}

/** Kalimat penjelasan jujur per alasan tidak_ditemukan (untuk UI). */
export function penjelasanTidakDitemukan(alasan: AlasanTidakDitemukan): string {
  switch (alasan) {
    case "di_luar_studi_islam":
      return "Topik ini dinilai berada di luar studi Islam, jadi tidak ada kalimat kunci yang disusun.";
    case "topik_tidak_spesifik":
      return "Topik ini belum cukup spesifik untuk disusun kalimat kuncinya. Persempit judul atau tambahkan kata kunci pokoknya.";
    case "tidak_cukup_informasi":
      return "Informasi yang tersedia belum cukup untuk menyusun kalimat kunci yang sah. Tambahkan judul yang lebih lengkap atau kata kunci terpilih.";
  }
}
