/**
 * Estimasi halaman dan target panjang (Pembangunan Ulang Tahap 10,
 * menutup A10 audit kode: dulu tidak ada target halaman di generasi;
 * angka halaman hanya prosa aturan template, dan permukaan memakai
 * konvensi 250 kata per halaman yang ditolak KATALOG-REPO tema 10).
 *
 * PRINSIP KEJUJURAN:
 * - Semua keluaran modul ini PERKIRAAN. Ia tidak pernah mengklaim
 *   jumlah halaman pasti: penomoran nyata hanya lahir dari render
 *   dokumen akhir (Word/LibreOffice) dengan font yang benar-benar
 *   terpasang di mesin pembaca.
 * - Konstanta kata per halaman BUKAN angka baku warisan dan bukan
 *   karangan: ia hasil KALIBRASI TERUKUR yang bisa diperiksa ulang
 *   (lihat catatan kalibrasi di bawah), dan permukaan wajib menyebut
 *   basis formatnya.
 * - Target panjang punya dua sumber yang TIDAK dicampur:
 *   (1) ATURAN PEMILIK web (perintah user): khalfiyah minimal 2
 *       halaman, Bab 2 minimal 20 halaman A4 huruf 16 Calibri, total
 *       risalah selesai minimal 100 halaman. Angka-angka ini TIDAK
 *       ditemukan di kedua pedoman (SPEC-PEDOMAN 2.7 dan 3.3/3.7)
 *       dan selalu dilabeli "aturan pemilik" di permukaan.
 *   (2) SYARAT PEDOMAN kampus dari data template Tahap 1: halaman
 *       minimal risalah menurut pedomannya sendiri (Mangkoso 150,
 *       SPEC-PEDOMAN 2.7; As'adiyah 40 dihitung dari Bab 1 sampai
 *       Bab 5, SPEC-PEDOMAN 3.7). Dilabeli "pedoman" di permukaan.
 *
 * CATATAN KALIBRASI (5 Nov 2026, lingkungan VM pembangunan ini):
 * - Metode mengikuti putusan KATALOG-REPO tema 10: halaman dibaca
 *   dari RENDER dokumen uji nyata, bukan konvensi kata per halaman.
 *   Dokumen uji dibangun dari prosa Arab bank frasa aplikasi dengan
 *   jumlah kata terhitung persis oleh hitungKataNaskah modul ini,
 *   diekspor lewat buatDocx aplikasi (format standar) atau dibangun
 *   pada format persis pedoman (format As'adiyah), lalu dirender
 *   LibreOffice headless ke PDF dan halamannya dihitung (pdfinfo).
 *   Berkas dan naskah kalibrasi disimpan di
 *   ~/workspace/kitabah-rebuild-10/kalibrasi-tahap10/.
 * - Hasil ukur format standar (Calibri 16, spasi 1,5, margin 2,5 cm):
 *   1.652 kata -> 8 halaman; 3.134 kata -> 14 halaman; 6.100 kata ->
 *   26 halaman. Konstanta 235 kata/halaman menghasilkan kembali ketiga
 *   angka itu persis lewat ceil(kata/235).
 * - KALIBRASI ULANG (tahap verifikasi menyeluruh, menutup L1 telaah
 *   Tahap 10): huruf Carlito (pengganti Calibri yang cocok metriknya,
 *   SIL OFL) dipasang di lingkungan ukur dan ketiga fixture standar
 *   dirender ulang; pdffonts membuktikan Carlito kini benar-benar
 *   memuat Latin pada PDF hasil. Angka baru: 1.652 -> 8; 3.134 -> 14;
 *   6.100 -> 27 halaman. Konstanta standar diganti 230 kata/halaman,
 *   yang menghasilkan kembali ketiga angka Carlito itu persis dan
 *   tetap dalam 4 persen dari ketiga angka ukur lama. Catatan jujur:
 *   glif Arab pada kedua render tetap dirujukbalik ke DejaVu Sans
 *   karena Carlito (dan Calibri asli) tidak memuat huruf Arab; di
 *   Word nyata rujukbalik Arab bergantung huruf Arab bawaan mesin
 *   pengguna, jadi angka ini tetap perkiraan berlabel, bukan janji.
 * - Hasil ukur format As'adiyah (Sakkal Majalla 16, spasi Exactly
 *   24 pt, margin kanan 4, kiri 3, atas 3, bawah 3 cm): 3.134 kata ->
 *   14 halaman; 6.100 kata -> 26 halaman; konstanta 235 juga
 *   menghasilkan kembali keduanya persis. Kesamaan angka kedua format
 *   konsisten dengan geometrinya: As'adiyah memuat lebih banyak
 *   baris per halaman (27 baris pada tinggi pakai 23,7 cm) tetapi
 *   lebar barisnya lebih sempit (14 cm lawan 16 cm).
 * - BATAS UKUR yang dinyatakan: Calibri dan Sakkal Majalla TIDAK
 *   terpasang di lingkungan kalibrasi, jadi LibreOffice mengganti
 *   keduanya (pdffonts pada PDF hasil: DejaVu Sans). Lebar huruf
 *   pengganti tidak sama dengan huruf aslinya, jadi konstanta ini
 *   jangkar pada dokumen ekspor sebagaimana dirender lingkungan ini.
 *   Pembanding silang pada geometri yang sama dengan Traditional
 *   Arabic (huruf bawaan ekspor aplikasi, benar-benar terpasang):
 *   6.100 kata -> 22 halaman (277 kata/halaman). Selisihnya adalah
 *   ukuran kepekaan terhadap huruf; karena itu permukaan selalu
 *   menulis "perkiraan" beserta basis formatnya, dan target kata
 *   yang diturunkan dari konstanta ini adalah sasaran kerja, bukan
 *   janji penomoran.
 *
 * Penyimpangan dari arah KATALOG yang dinyatakan: KATALOG menunjuk
 * Paged.js sebagai mesin angka halaman resmi dan tally-ts untuk
 * hitung dasar. Paged.js merender HTML/CSS Paged Media di peramban,
 * sedangkan dokumen akhir aplikasi ini adalah DOCX dari eksportir
 * sendiri dengan format pedoman; angka halaman yang jujur untuk
 * dokumen itu adalah render DOCX-nya (yang dipakai kalibrasi ini),
 * bukan render HTML yang berbeda format. Hitung kata sadar locale
 * Arab yang ditunjuk tally-ts dikerjakan hitungKataNaskah di sini
 * (token berhuruf Arab/Latin; penanda markdown dan sitasi tidak
 * dihitung), tanpa dependensi baru.
 */
import { TEMPLATE_PEDOMAN } from "@/lib/pedoman/template-pedoman";
import type { Project } from "@/lib/engine/project";

/** Format halaman yang dinyatakan, dengan konstanta terkalibrasi. */
export interface FormatHalaman {
  id: "standar" | "asadiyah";
  /** Nama tampil untuk label basis di permukaan. */
  label: string;
  font: string;
  ukuranPt: number;
  /** Uraian spasi persis seperti dinyatakan sumber formatnya. */
  spasi: string;
  marginCm: { kanan: number; kiri: number; atas: number; bawah: number };
  /** Hasil kalibrasi terukur (lihat catatan kalibrasi di kepala berkas). */
  kataPerHalaman: number;
}

/**
 * Format standar: yang dinyatakan perintah pemilik untuk Bab 2 (A4,
 * Calibri 16) dan pedoman Mangkoso untuk naskah (Calibri 16, spasi
 * 1,5, A4; SPEC-PEDOMAN 2.7). Pedoman Mangkoso tidak menetapkan
 * margin, jadi margin yang dipakai adalah margin bawaan eksportir
 * aplikasi (2,5 cm semua sisi, DOK_DEFAULT di lib/engine/export.ts),
 * dinyatakan di sini agar basisnya tidak diam-diam berubah.
 */
export const FORMAT_STANDAR: FormatHalaman = {
  id: "standar",
  label: "A4 · Calibri 16 · spasi 1,5 · margin 2,5 cm",
  font: "Calibri",
  ukuranPt: 16,
  spasi: "1,5",
  marginCm: { kanan: 2.5, kiri: 2.5, atas: 2.5, bawah: 2.5 },
  kataPerHalaman: 230,
};

/**
 * Format As'adiyah persis pedomannya (SPEC-PEDOMAN 3.7): Sakkal
 * Majalla 16 dengan spasi Exactly 24 pt dan margin kanan 4, kiri 3,
 * atas 3, bawah 3 cm. Eksportir aplikasi tidak menyatakan spasi
 * exact dan margin per sisi, jadi kalibrasinya dibangun pada format
 * persis ini, bukan pada keluaran eksportir.
 */
export const FORMAT_ASADIYAH: FormatHalaman = {
  id: "asadiyah",
  label: "A4 · Sakkal Majalla 16 · spasi Exactly 24 pt · margin 4/3/3/3 cm",
  font: "Sakkal Majalla",
  ukuranPt: 16,
  spasi: "Exactly 24 pt",
  marginCm: { kanan: 4, kiri: 3, atas: 3, bawah: 3 },
  kataPerHalaman: 235,
};

export const FORMAT_HALAMAN: Record<FormatHalaman["id"], FormatHalaman> = {
  standar: FORMAT_STANDAR,
  asadiyah: FORMAT_ASADIYAH,
};

/**
 * Kampus pemilik template pedoman proyek, dari nama pedoman persis
 * milik template bawaan (pencocokan yang sama dengan kampusProyek di
 * lib/engine/hawamisy.ts: mesin tidak menebak kampus dari teks
 * bebas). null untuk proyek tanpa template bawaan.
 */
export function kampusTemplateProyek(
  p: Pick<Project, "strukturPedoman">,
): "mangkoso" | "asadiah" | null {
  const nama = p.strukturPedoman?.namaPedoman ?? "";
  if (!nama) return null;
  const mk = TEMPLATE_PEDOMAN.find((t) => /mangkoso/i.test(t.namaPedoman));
  const as = TEMPLATE_PEDOMAN.find((t) => /as'adiyah/i.test(t.namaPedoman));
  if (mk && nama === mk.namaPedoman) return "mangkoso";
  if (as && nama === as.namaPedoman) return "asadiah";
  return null;
}

/** Format halaman yang berlaku untuk proyek: format pedoman
 *  kampusnya bila template bawaan, selain itu format standar. */
export function formatHalamanProyek(p: Pick<Project, "strukturPedoman">): FormatHalaman {
  return kampusTemplateProyek(p) === "asadiah" ? FORMAT_ASADIYAH : FORMAT_STANDAR;
}

/**
 * Halaman minimal risalah menurut PEDOMAN proyek (sumber: pedoman,
 * bukan pemilik): dibaca dari data template Tahap 1
 * (halamanMinimalRisalah pada skema struktur pedoman). Proyek lama
 * yang salinan template tersimpannya mendahului bidang ini dibaca
 * dari template bawaannya lewat nama pedoman yang sama. null bila
 * proyek tidak memakai template yang memuat angka itu.
 */
export function halamanMinimalPedoman(p: Pick<Project, "strukturPedoman">): number | null {
  const tersimpan = p.strukturPedoman?.halamanMinimalRisalah;
  if (typeof tersimpan === "number" && tersimpan > 0) return tersimpan;
  const nama = p.strukturPedoman?.namaPedoman ?? "";
  if (!nama) return null;
  const tpl = TEMPLATE_PEDOMAN.find((t) => t.namaPedoman === nama);
  const dariTemplate = tpl?.halamanMinimalRisalah;
  return typeof dariTemplate === "number" && dariTemplate > 0 ? dariTemplate : null;
}

/**
 * Target panjang ATURAN PEMILIK web (perintah user, BUKAN bunyi
 * pedoman; SPEC-PEDOMAN menegaskan angka per bab dan angka total
 * 100 tidak ada di kedua pedoman). Berlaku untuk karya skripsi
 * (risalah); jenjang lain tidak menerima target halaman pemilik.
 */
export const TARGET_PEMILIK = {
  /** Latar belakang (khalfiyah) minimal 2 halaman. */
  khalfiyahHalaman: 2,
  /** Bab 2 minimal 20 halaman A4 huruf 16 Calibri. */
  bab2Halaman: 20,
  /** Naskah selesai total minimal 100 halaman. */
  totalHalaman: 100,
} as const;

export type SumberTarget = "pemilik" | "pedoman";

/** Label sumber target untuk permukaan: dua sumber tidak dicampur. */
export function labelSumberTarget(sumber: SumberTarget): string {
  return sumber === "pemilik" ? "aturan pemilik web" : "pedoman kampus";
}

/**
 * Hitung kata naskah yang sadar teks Arab: penanda markdown (judul,
 * tebal, kutip, tabel) dan penanda sitasi mesin ([[ref:...]] dan
 * definisi [^n]) dibersihkan dulu, lalu token yang memuat minimal
 * satu huruf (Arab, Latin, atau aksara lain) dihitung satu kata.
 * Token angka murni dan tanda baca lepas tidak dihitung. Inilah
 * penghitung yang sama dengan yang dipakai kalibrasi, jadi angka
 * permukaan dan angka kalibrasi satu bahasa.
 */
export function hitungKataNaskah(teks: string): number {
  if (!teks) return 0;
  const bersih = teks
    .replace(/\[\[ref:[^\]]*\]\]/g, " ")
    .replace(/\[\^[^\]]+\]/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>#|]/g, " ");
  return bersih.split(/\s+/).filter((t) => /\p{L}/u.test(t)).length;
}

/** Estimasi halaman (dibulatkan ke atas) dari jumlah kata pada satu
 *  format. 0 kata menghasilkan 0, bukan 1: permukaan yang ingin
 *  menampilkan minimum 1 untuk naskah berisi menentukannya sendiri. */
export function estimasiHalamanDariKata(kata: number, format: FormatHalaman): number {
  if (kata <= 0) return 0;
  return Math.max(1, Math.ceil(kata / format.kataPerHalaman));
}

/** Halaman mentah (pecahan, untuk persen capaian yang jujur). */
export function halamanMentahDariKata(kata: number, format: FormatHalaman): number {
  if (kata <= 0) return 0;
  return kata / format.kataPerHalaman;
}

/** Kata yang setara dengan sejumlah halaman pada satu format:
 *  jalan menurunkan target halaman menjadi target kata yang dibaca
 *  struktur, gerbang mutu, dan prompt pengembangan. */
export function kataUntukHalaman(halaman: number, format: FormatHalaman): number {
  return Math.round(halaman * format.kataPerHalaman);
}
