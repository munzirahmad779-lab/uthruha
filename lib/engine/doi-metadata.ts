/**
 * Metadata DOI gabungan Crossref dan OpenAlex.
 *
 * Fungsi pemetaan dan penggabungan di modul ini murni: tidak ada fetch
 * di dalamnya. Satu satunya fungsi yang menyentuh jaringan adalah
 * ambilMetadataDoi, dan ia menerima fetch standar sebagai parameter
 * agar bisa diuji luring dengan fetch pengganti.
 *
 * Prinsip: field yang tidak ada di sumber dibiarkan kosong dan dicatat
 * di daftar kurang. Kode tidak pernah mengarang angka untuk volume,
 * nomor, halaman, atau penerbit.
 */

export interface MetadataDoi {
  penulis: string;
  judul: string;
  jurnal: string;
  penerbit?: string;
  tahun?: string;
  volume?: string;
  nomor?: string;
  halaman?: string;
  doi: string;
  url?: string;
}

export interface HasilMetadata {
  data: MetadataDoi;
  kurang: string[];
  catatan: string[];
}

/** Hasil pemetaan Crossref apa adanya, sebelum penggabungan. */
export interface MetadataCrossref {
  penulis: string;
  judul: string;
  jurnal: string;
  penerbit?: string;
  tahun?: string;
  volume?: string;
  nomor?: string;
  halaman?: string;
  doi: string;
  url?: string;
}

/** Hasil pemetaan OpenAlex apa adanya, sebelum penggabungan. */
export interface MetadataOpenAlex {
  penulis: string;
  judul: string;
  jurnal: string;
  penerbit?: string;
  tahun?: string;
  volume?: string;
  nomor?: string;
  halaman?: string;
  halamanAwal?: string;
  halamanAkhir?: string;
  doi: string;
  url?: string;
}

type Rekaman = Record<string, unknown>;

function sebagaiRekaman(x: unknown): Rekaman | null {
  return typeof x === "object" && x !== null ? (x as Rekaman) : null;
}

function teks(x: unknown): string | undefined {
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  if (typeof x !== "string") return undefined;
  const t = x.trim();
  return t ? t : undefined;
}

function teksPertama(x: unknown): string | undefined {
  if (!Array.isArray(x)) return teks(x);
  for (const item of x) {
    const t = teks(item);
    if (t) return t;
  }
  return undefined;
}

function bersihDoi(x: unknown): string {
  const t = teks(x) ?? "";
  return t.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").trim();
}

function tahunDariDateParts(rec: Rekaman | null): string | undefined {
  if (!rec) return undefined;
  const dp = rec["date-parts"];
  if (Array.isArray(dp) && Array.isArray(dp[0]) && dp[0].length > 0) {
    return teks(dp[0][0]);
  }
  return undefined;
}

/** Petakan satu respons Crossref (objek message, atau respons utuh berisi message). */
export function petakanCrossref(m: unknown): MetadataCrossref {
  const luar = sebagaiRekaman(m);
  const pesan = sebagaiRekaman(luar?.message) ?? luar ?? {};
  const penulisMentah = Array.isArray(pesan.author) ? pesan.author : [];
  const penulis = penulisMentah
    .map((a) => {
      const rec = sebagaiRekaman(a);
      if (!rec) return "";
      return [teks(rec.family), teks(rec.given)].filter(Boolean).join(", ");
    })
    .filter(Boolean)
    .join("; ");
  const tahun =
    tahunDariDateParts(sebagaiRekaman(pesan.issued)) ??
    tahunDariDateParts(sebagaiRekaman(pesan.published)) ??
    tahunDariDateParts(sebagaiRekaman(pesan["published-print"])) ??
    tahunDariDateParts(sebagaiRekaman(pesan["published-online"])) ??
    tahunDariDateParts(sebagaiRekaman(pesan.created));
  return {
    penulis,
    judul: teksPertama(pesan.title) ?? "",
    jurnal: teksPertama(pesan["container-title"]) ?? "",
    penerbit: teks(pesan.publisher),
    tahun,
    volume: teks(pesan.volume),
    nomor: teks(pesan.issue),
    halaman: teks(pesan.page),
    doi: bersihDoi(pesan.DOI),
    url: teks(pesan.URL),
  };
}

/** Petakan satu karya OpenAlex (objek work). */
export function petakanOpenAlex(w: unknown): MetadataOpenAlex {
  const rec = sebagaiRekaman(w) ?? {};
  const biblio = sebagaiRekaman(rec.biblio) ?? {};
  const lokasi = sebagaiRekaman(rec.primary_location) ?? {};
  const sumber = sebagaiRekaman(lokasi.source);
  const kepengarangan = Array.isArray(rec.authorships) ? rec.authorships : [];
  const penulis = kepengarangan
    .map((a) => {
      const ar = sebagaiRekaman(a);
      const pengarang = sebagaiRekaman(ar?.author);
      return teks(pengarang?.display_name) ?? teks(ar?.display_name) ?? "";
    })
    .filter(Boolean)
    .join("; ");
  const awal = teks(biblio.first_page);
  const akhir = teks(biblio.last_page);
  const halaman = awal && akhir && awal !== akhir ? `${awal}-${akhir}` : (awal ?? akhir);
  const doi = bersihDoi(rec.doi);
  return {
    penulis,
    judul: teks(rec.display_name) ?? teks(rec.title) ?? "",
    jurnal: teks(sumber?.display_name) ?? "",
    penerbit:
      teks(sumber?.host_organization_name) ??
      teks(rec.host_organization_name) ??
      undefined,
    tahun: teks(rec.publication_year),
    volume: teks(biblio.volume),
    nomor: teks(biblio.issue),
    halaman,
    halamanAwal: awal,
    halamanAkhir: akhir,
    doi,
    url: teks(lokasi.landing_page_url) ?? (doi ? `https://doi.org/${doi}` : undefined),
  };
}

const PETA_TRANSLIT: Record<string, string> = {
  "ا": "a",
  "أ": "a",
  "إ": "i",
  "آ": "a",
  "ب": "b",
  "ت": "t",
  "ث": "th",
  "ج": "j",
  "ح": "h",
  "خ": "kh",
  "د": "d",
  "ذ": "dh",
  "ر": "r",
  "ز": "z",
  "س": "s",
  "ش": "sh",
  "ص": "s",
  "ض": "d",
  "ط": "t",
  "ظ": "z",
  "ع": "a",
  "غ": "gh",
  "ف": "f",
  "ق": "q",
  "ك": "k",
  "ل": "l",
  "م": "m",
  "ن": "n",
  "ه": "h",
  "ة": "a",
  "و": "w",
  "ي": "y",
  "ى": "a",
};

function translitKata(kata: string): string {
  let hasil = "";
  for (const ch of kata) {
    if (/[\u064B-\u065F\u0670]/.test(ch)) continue;
    const peta = PETA_TRANSLIT[ch];
    if (peta) {
      hasil += peta;
      continue;
    }
    if (/[\u0600-\u06FF]/.test(ch)) continue;
    if (/[a-zA-Z]/.test(ch)) hasil += ch.toLowerCase();
  }
  return hasil;
}

/**
 * Deteksi penerbit palsu: penerbit dari Crossref sebenarnya nama jurnal.
 * (a) sama persis secara case-insensitive dengan container-title, atau
 * (b) transliterasi sederhana satu kata judul jurnal sama dengan
 * penerbit ternormalisasi. Kata مجلة pada judul jurnal dilewati.
 */
export function deteksiPenerbitPalsu(penerbit: string, jurnal: string): boolean {
  const p = penerbit.trim();
  const j = jurnal.trim();
  if (!p || !j) return false;
  if (p.toLowerCase() === j.toLowerCase()) return true;
  const normUtuh = p.toLowerCase().replace(/[^a-z]/g, "");
  if (!normUtuh) return false;
  const tokenPenerbit = p.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const kataJurnal = j.split(/\s+/).filter((k) => k && k !== "مجلة");
  for (const kata of kataJurnal) {
    const t = translitKata(kata);
    if (t && (t === normUtuh || tokenPenerbit.includes(t))) return true;
  }
  return false;
}

function tampakSepertiCrossrefMentah(x: Rekaman): boolean {
  return (
    "container-title" in x ||
    "author" in x ||
    "issued" in x ||
    "message" in x ||
    Array.isArray(x.title)
  );
}

function tampakSepertiOpenAlexMentah(x: Rekaman): boolean {
  return (
    "biblio" in x ||
    "primary_location" in x ||
    "publication_year" in x ||
    "authorships" in x ||
    "display_name" in x
  );
}

function normalisasiCr(input: unknown): MetadataCrossref | null {
  if (input === null || input === undefined) return null;
  const rec = sebagaiRekaman(input);
  if (!rec) return null;
  if (tampakSepertiCrossrefMentah(rec)) return petakanCrossref(input);
  return {
    penulis: teks(rec.penulis) ?? "",
    judul: teks(rec.judul) ?? "",
    jurnal: teks(rec.jurnal) ?? "",
    penerbit: teks(rec.penerbit),
    tahun: teks(rec.tahun),
    volume: teks(rec.volume),
    nomor: teks(rec.nomor),
    halaman: teks(rec.halaman),
    doi: bersihDoi(rec.doi),
    url: teks(rec.url),
  };
}

function normalisasiOa(input: unknown): MetadataOpenAlex | null {
  if (input === null || input === undefined) return null;
  const rec = sebagaiRekaman(input);
  if (!rec) return null;
  if (tampakSepertiOpenAlexMentah(rec)) return petakanOpenAlex(input);
  return {
    penulis: teks(rec.penulis) ?? "",
    judul: teks(rec.judul) ?? "",
    jurnal: teks(rec.jurnal) ?? "",
    penerbit: teks(rec.penerbit),
    tahun: teks(rec.tahun),
    volume: teks(rec.volume),
    nomor: teks(rec.nomor),
    halaman: teks(rec.halaman),
    halamanAwal: teks(rec.halamanAwal),
    halamanAkhir: teks(rec.halamanAkhir),
    doi: bersihDoi(rec.doi),
    url: teks(rec.url),
  };
}

function mengandungRentang(halaman: string): boolean {
  const cocok = halaman.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (!cocok) return false;
  const a = (cocok[1] ?? "").trim();
  const b = (cocok[2] ?? "").trim();
  return Boolean(a && b && a !== b);
}

/**
 * Gabung hasil Crossref dan OpenAlex menjadi satu metadata.
 * Menerima hasil petakanCrossref dan petakanOpenAlex, atau objek
 * mentah masing masing API, atau null bila satu sumber gagal.
 */
export function gabungMetadata(
  crInput: MetadataCrossref | Rekaman | null | undefined,
  oaInput: MetadataOpenAlex | Rekaman | null | undefined,
  doiCadangan = "",
): HasilMetadata {
  const cr = normalisasiCr(crInput);
  const oa = normalisasiOa(oaInput);
  const catatan: string[] = [];
  const kurang: string[] = [];

  const penulis = cr?.penulis || oa?.penulis || "";
  const judul = cr?.judul || oa?.judul || "";
  const jurnal = cr?.jurnal || oa?.jurnal || "";
  const tahun = cr?.tahun ?? oa?.tahun;
  const doi = cr?.doi || oa?.doi || bersihDoi(doiCadangan);
  const url = cr?.url ?? oa?.url;

  function gabungAngka(
    nama: "volume" | "nomor",
    nilaiCr: string | undefined,
    nilaiOa: string | undefined,
  ): string | undefined {
    if (nilaiCr && nilaiOa && nilaiCr !== nilaiOa) {
      catatan.push(
        `Konflik ${nama}: Crossref mencatat "${nilaiCr}" sedangkan OpenAlex mencatat "${nilaiOa}". Field ${nama} dikosongkan agar diperiksa manual.`,
      );
      return undefined;
    }
    return nilaiCr ?? nilaiOa;
  }

  const volume = gabungAngka("volume", cr?.volume, oa?.volume);
  const nomor = gabungAngka("nomor", cr?.nomor, oa?.nomor);

  let halaman: string | undefined;
  let rentangKurang = false;
  const halamanCr = cr?.halaman;
  const awalOa = oa?.halamanAwal;
  const akhirOa = oa?.halamanAkhir;
  if (halamanCr && mengandungRentang(halamanCr)) {
    halaman = halamanCr;
  } else if (awalOa && akhirOa && awalOa !== akhirOa) {
    halaman = `${awalOa}-${akhirOa}`;
  } else if (halamanCr || awalOa || oa?.halaman) {
    halaman = halamanCr ?? awalOa ?? oa?.halaman;
    rentangKurang = true;
  } else {
    halaman = undefined;
  }

  let penerbit: string | undefined;
  if (oa?.penerbit) {
    penerbit = oa.penerbit;
  } else if (cr?.penerbit) {
    if (deteksiPenerbitPalsu(cr.penerbit, jurnal)) {
      catatan.push(
        `Penerbit "${cr.penerbit}" dari Crossref ditolak karena sama dengan nama jurnal "${jurnal}".`,
      );
      penerbit = undefined;
    } else {
      penerbit = cr.penerbit;
    }
  }

  if (!penulis) kurang.push("penulis");
  if (!judul) kurang.push("judul");
  if (!jurnal) kurang.push("jurnal");
  if (!penerbit) kurang.push("penerbit");
  if (!tahun) kurang.push("tahun");
  if (!volume) kurang.push("volume");
  if (!nomor) kurang.push("nomor");
  if (!halaman) kurang.push("halaman");
  else if (rentangKurang) kurang.push("rentang halaman");

  const data: MetadataDoi = {
    penulis,
    judul,
    jurnal,
    ...(penerbit ? { penerbit } : {}),
    ...(tahun ? { tahun } : {}),
    ...(volume ? { volume } : {}),
    ...(nomor ? { nomor } : {}),
    ...(halaman ? { halaman } : {}),
    doi,
    ...(url ? { url } : {}),
  };
  return { data, kurang, catatan };
}

/**
 * Ambil metadata DOI dari Crossref dan OpenAlex secara paralel.
 * Kegagalan satu sumber tidak menggagalkan sumber lain. Bila keduanya
 * gagal, fungsi ini melempar Error.
 */
export async function ambilMetadataDoi(
  doiInput: string,
  fetchFn: typeof fetch = fetch,
): Promise<HasilMetadata> {
  const doi = bersihDoi(doiInput);
  if (!doi) throw new Error("DOI kosong.");

  async function ambilJson(url: string): Promise<unknown> {
    const res = await fetchFn(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  const [hasilCr, hasilOa] = await Promise.allSettled([
    ambilJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`),
    ambilJson(`https://api.openalex.org/works/doi:${doi}`),
  ]);

  const cr = hasilCr.status === "fulfilled" ? petakanCrossref(hasilCr.value) : null;
  const oa = hasilOa.status === "fulfilled" ? petakanOpenAlex(hasilOa.value) : null;
  if (!cr && !oa) {
    throw new Error("Metadata DOI tidak ditemukan di Crossref maupun OpenAlex.");
  }
  const salahSatuKosong =
    (cr && !cr.judul && !cr.penulis) || (oa && !oa.judul && !oa.penulis);
  void salahSatuKosong;
  return gabungMetadata(cr, oa, doi);
}
