// Uji luring metadata DOI: fixture persis respons API yang diverifikasi
// koordinator untuk DOI 10.54528/1549-004-001-003, tanpa jaringan.
import {
  gabungMetadata,
  keteranganAsalKolom,
  petakanCrossref,
  petakanOpenAlex,
} from "../lib/engine/doi-metadata";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " : " + detail : ""}`);
  if (!ok) gagal++;
};

// Fixture Crossref persis fakta API nyata untuk DOI patokan.
const crossrefPatokan = {
  DOI: "10.54528/1549-004-001-003",
  title: ["الشرعية التنظيمية بين النظرية والتطبيق"],
  "container-title": ["مجلة أبحاث"],
  publisher: "Abhath",
  volume: null,
  issue: null,
  page: "29",
  type: "journal-article",
  author: [{ given: "كريم", family: "إموداش" }],
  issued: { "date-parts": [[2019]] },
  published: { "date-parts": [[2019]] },
  URL: "https://doi.org/10.54528/1549-004-001-003",
};

// Fixture OpenAlex persis fakta API nyata untuk DOI yang sama.
const openAlexPatokan = {
  doi: "https://doi.org/10.54528/1549-004-001-003",
  biblio: { volume: null, issue: null, first_page: "29", last_page: "29" },
  type: "article",
  primary_location: { source: null },
  publication_year: 2019,
};

const hasil1 = gabungMetadata(petakanCrossref(crossrefPatokan), petakanOpenAlex(openAlexPatokan));

cek("jurnal terisi مجلة أبحاث", hasil1.data.jurnal === "مجلة أبحاث", hasil1.data.jurnal);
cek("penerbit kosong", !hasil1.data.penerbit, String(hasil1.data.penerbit ?? ""));
cek('"penerbit" ada di kurang', hasil1.kurang.includes("penerbit"), hasil1.kurang.join(", "));
cek("volume kosong", !hasil1.data.volume, String(hasil1.data.volume ?? ""));
cek("nomor kosong", !hasil1.data.nomor, String(hasil1.data.nomor ?? ""));
cek('"volume" ada di kurang', hasil1.kurang.includes("volume"), hasil1.kurang.join(", "));
cek('"nomor" ada di kurang', hasil1.kurang.includes("nomor"), hasil1.kurang.join(", "));
cek('halaman "29"', hasil1.data.halaman === "29", String(hasil1.data.halaman ?? ""));
cek('"rentang halaman" ada di kurang', hasil1.kurang.includes("rentang halaman"), hasil1.kurang.join(", "));
cek('tahun "2019"', hasil1.data.tahun === "2019", String(hasil1.data.tahun ?? ""));
cek("penulis memuat إموداش", hasil1.data.penulis.includes("إموداش"), hasil1.data.penulis);
cek("judul terisi", hasil1.data.judul === "الشرعية التنظيمية بين النظرية والتطبيق", hasil1.data.judul);
cek("doi terisi", hasil1.data.doi === "10.54528/1549-004-001-003", hasil1.data.doi);

// Kasus kedua rekaan wajar: Crossref lengkap, penerbit berbeda dari jurnal.
const crossrefLengkap = {
  DOI: "10.54528/1549-004-001-003",
  title: ["الشرعية التنظيمية بين النظرية والتطبيق"],
  "container-title": ["مجلة أبحاث"],
  publisher: "University of Djelfa Press",
  volume: "4",
  issue: "1",
  page: "29-46",
  type: "journal-article",
  author: [{ given: "كريم", family: "إموداش" }],
  issued: { "date-parts": [[2019]] },
  published: { "date-parts": [[2019]] },
  URL: "https://doi.org/10.54528/1549-004-001-003",
};

const openAlexLengkap = {
  doi: "https://doi.org/10.54528/1549-004-001-003",
  biblio: { volume: "4", issue: "1", first_page: "29", last_page: "46" },
  type: "article",
  primary_location: { source: null },
  publication_year: 2019,
};

const hasil2 = gabungMetadata(petakanCrossref(crossrefLengkap), petakanOpenAlex(openAlexLengkap));

cek("kasus lengkap: penulis terisi", hasil2.data.penulis.includes("إموداش"), hasil2.data.penulis);
cek("kasus lengkap: judul terisi", Boolean(hasil2.data.judul), hasil2.data.judul);
cek("kasus lengkap: jurnal terisi", hasil2.data.jurnal === "مجلة أبحاث", hasil2.data.jurnal);
cek("kasus lengkap: penerbit terisi dan bukan nama jurnal", hasil2.data.penerbit === "University of Djelfa Press", String(hasil2.data.penerbit ?? ""));
cek('kasus lengkap: tahun "2019"', hasil2.data.tahun === "2019", String(hasil2.data.tahun ?? ""));
cek('kasus lengkap: volume "4"', hasil2.data.volume === "4", String(hasil2.data.volume ?? ""));
cek('kasus lengkap: nomor "1"', hasil2.data.nomor === "1", String(hasil2.data.nomor ?? ""));
cek('kasus lengkap: halaman "29-46"', hasil2.data.halaman === "29-46", String(hasil2.data.halaman ?? ""));
cek("kasus lengkap: kurang kosong", hasil2.kurang.length === 0, hasil2.kurang.join(", "));

// Asal per kolom pada kasus lengkap: nilai yang sama di dua sumber
// dicatat dari Crossref (sumber yang didahulukan penggabungan).
cek("asal: jurnal dari Crossref", hasil2.asal.jurnal === "crossref", String(hasil2.asal.jurnal ?? ""));
cek("asal: volume dari Crossref", hasil2.asal.volume === "crossref", String(hasil2.asal.volume ?? ""));
cek("asal: halaman dari Crossref", hasil2.asal.halaman === "crossref", String(hasil2.asal.halaman ?? ""));
cek("asal: kolom kosong pada kasus patokan tidak bertanda",
  hasil1.asal.volume === undefined && hasil1.asal.nomor === undefined);

// Kasus ketiga (kejujuran metadata DOI, pola kasus N9): rekod TANPA
// volume tetapi halaman berupa rentang penuh. Volume wajib tetap
// kosong (dilarang nilai bawaan karangan seperti "1"), rentang
// halaman wajib tampil utuh "29-46", tidak dipotong menjadi "29".
const crossrefTanpaVolume = {
  DOI: "10.54528/1549-004-001-003",
  title: ["الشرعية التنظيمية بين النظرية والتطبيق"],
  "container-title": ["مجلة أبحاث"],
  publisher: "University of Djelfa Press",
  issue: "1",
  page: "29-46",
  type: "journal-article",
  author: [{ given: "كريم", family: "إموداش" }],
  issued: { "date-parts": [[2019]] },
  URL: "https://doi.org/10.54528/1549-004-001-003",
};
const hasil3 = gabungMetadata(petakanCrossref(crossrefTanpaVolume), null);
cek("tanpa volume: volume tetap kosong, tidak diisi bawaan", !hasil3.data.volume, String(hasil3.data.volume ?? ""));
cek('tanpa volume: "volume" ada di kurang', hasil3.kurang.includes("volume"), hasil3.kurang.join(", "));
cek('tanpa volume: halaman rentang utuh "29-46"', hasil3.data.halaman === "29-46", String(hasil3.data.halaman ?? ""));
cek("tanpa volume: rentang halaman tidak dicatat kurang", !hasil3.kurang.includes("rentang halaman"), hasil3.kurang.join(", "));
cek("tanpa volume: asal halaman Crossref", hasil3.asal.halaman === "crossref", String(hasil3.asal.halaman ?? ""));
cek("tanpa volume: asal volume tidak bertanda", hasil3.asal.volume === undefined);

// Kasus keempat: rekod TANPA halaman sama sekali (Crossref tidak
// mencantumkan page, OpenAlex tidak punya first/last page). Halaman
// wajib kosong dan tercatat kurang; tidak boleh lahir angka karangan.
const crossrefTanpaHalaman = {
  DOI: "10.54528/1549-004-001-003",
  title: ["الشرعية التنظيمية بين النظرية والتطبيق"],
  "container-title": ["مجلة أبحاث"],
  publisher: "University of Djelfa Press",
  volume: "4",
  issue: "1",
  type: "journal-article",
  author: [{ given: "كريم", family: "إموداش" }],
  issued: { "date-parts": [[2019]] },
  URL: "https://doi.org/10.54528/1549-004-001-003",
};
const openAlexTanpaHalaman = {
  doi: "https://doi.org/10.54528/1549-004-001-003",
  biblio: { volume: "4", issue: "1", first_page: null, last_page: null },
  type: "article",
  primary_location: { source: null },
  publication_year: 2019,
};
const hasil4 = gabungMetadata(petakanCrossref(crossrefTanpaHalaman), petakanOpenAlex(openAlexTanpaHalaman));
cek("tanpa halaman: halaman tetap kosong", !hasil4.data.halaman, String(hasil4.data.halaman ?? ""));
cek('tanpa halaman: "halaman" ada di kurang', hasil4.kurang.includes("halaman"), hasil4.kurang.join(", "));
cek("tanpa halaman: asal halaman tidak bertanda", hasil4.asal.halaman === undefined);

// Keterangan asal untuk label formulir per kolom.
cek('keterangan asal Crossref', keteranganAsalKolom("crossref", true) === "dari Crossref");
cek('keterangan asal OpenAlex', keteranganAsalKolom("openalex", true) === "dari OpenAlex");
cek("keterangan asal kolom kosong menyatakan tidak ada di rekod",
  keteranganAsalKolom(undefined, false).includes("tidak ada di rekod"));

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
