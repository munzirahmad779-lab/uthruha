/**
 * Penyusun footnote & daftar pustaka dari kandidat rujukan, mengikuti
 * pedoman kampus yang diunggah. Tidak pernah mengisi kolom yang tidak
 * diketahui: nilai kosong menjadi `[ ! verifikasi ]`.
 */
import type { RefCandidate } from "@/lib/refs/types";
import type { PedomanRules } from "@/lib/refs/pedoman";
import { bersihkanJudul, keAngkaArab, type Sumber } from "@/lib/engine/cite";
import { hitungFootnoteBlok } from "@/lib/engine/marker";

export const TANDA_VERIFIKASI = "[ ! verifikasi ]";

/** Hash FNV-1a 32-bit atas teks. Cukup untuk identitas stabil satu
 *  kandidat antarsesi di klien; bukan alat keamanan. */
function hashTeks(teks: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Normalisasi satu unsur identitas kanonis: tag jenis di kepala
 *  judul dibuang dengan bersihkanJudul yang sama seperti sanitasi
 *  simpan/tampil (Tahap 6), pemisah nama diseragamkan, spasi
 *  diringkas, huruf dikecilkan. */
function normalKanonis(teks: string | undefined): string {
  return bersihkanJudul(teks ?? "")
    .replace(/[،;]/g, ",")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Id sumber stabil dari identitas kanonis judul + penulis + tahun.
 * Dipakai BERSAMA oleh jalur dialog Cari Rujukan (kandidatKeSumber)
 * dan jalur Generate Footnote (rujukanKeSumber di server), supaya
 * karya yang sama yang tiba lewat dua fitur itu memperoleh id yang
 * sama dan saling dikenali sebagai satu sumber (menutup L1 telaah
 * Tahap 4 di Tahap 6). Penulis diterima sebagai string tunggal yang
 * sudah digabung pemanggilnya.
 */
export function idStabilDariIdentitas(judul: string, penulis: string, tahun: string): string {
  const kanonis = [normalKanonis(judul), normalKanonis(penulis), tahun ? String(tahun) : ""].join("\n");
  return `src-${hashTeks(kanonis)}`;
}

/**
 * Id SUMBER yang stabil dan deterministik untuk satu kandidat
 * rujukan (menutup temuan S2 telaah silang Tahap 4). Penjaga duplikat
 * B2 di dialog Pasang Footnote dan penahan duplikat daftar sumber
 * sama-sama berkunci pada id sumber; id acak per konversi membuat
 * hit yang sama tidak pernah dikenali sebagai duplikat. Identitas
 * kanonisnya adalah judul + penulis + tahun ternormalisasi —
 * pencocokan yang sama kelasnya dengan penjaga di alur seleksi
 * (tanamSumber di tab Tulis mencocokkan DOI atau judul). RefCandidate
 * tidak membawa DOI, jadi judul yang menanggung identitasnya; jilid
 * dan halaman SENGAJA tidak ikut: keduanya milik penanda sitasi,
 * bukan identitas sumbernya (satu sumber yang sama sah dirujuk pada
 * banyak halaman berbeda).
 */
export function idStabilKandidat(c: RefCandidate): string {
  return idStabilDariIdentitas(c.kitab, c.penulis ?? "", c.tahun ? String(c.tahun) : "");
}

export function kandidatKeSumber(c: RefCandidate): Sumber {
  return {
    id: idStabilKandidat(c),
    // Jenis sebagai data (Tahap 6): kandidat artikel jurnal menjadi
    // Sumber berjenis "artikel" dengan nama jurnal dan DOI pada
    // bidangnya, bukan kitab bertajuk "[مجلة] …".
    jenis: c.jenis ?? "kitab",
    penulis: c.penulis ?? "",
    judul: bersihkanJudul(c.kitab),
    jurnal: c.jurnal || undefined,
    doi: c.doi || undefined,
    volume: c.volume || undefined,
    nomor: c.nomor || undefined,
    kota: c.kota ?? "",
    penerbit: c.penerbit ?? "",
    tahun: c.tahun ? String(c.tahun) : "",
    jilid: c.jilid ? String(c.jilid) : "",
    halaman: c.halaman_cetak ? String(c.halaman_cetak) : "",
    url: c.url_sumber || undefined,
    // Kategori kitab rekod sumber ikut dibawa (Tahap G1).
    kategoriKitab: c.kategoriKitab || undefined,
    daftarIsi: c.judul_bab || undefined,
    // Konversi ini hanya dipanggil RefFinder untuk kandidat yang
    // SUDAH lolos gerbangnya (bisaDipakai): hit indeks dengan rekod
    // yang bisa dibuka, atau jurnal yang lolos periksa bidang.
    // Sumber hasil konversi dicap terverifikasi agar gerbang pasang
    // (putusanPasangSumber) mengenalinya; kandidat manual tidak
    // pernah sampai ke sini sejak perbaikan QA 6 Nov 2026.
    statusVerifikasi: "terverifikasi",
  };
}

function nilai(v: string | number | undefined, p: PedomanRules): string {
  if (v === undefined || v === null || String(v).trim() === "") return TANDA_VERIFIKASI;
  return typeof v === "number" ? isiAngka(v, p) : String(v).trim();
}

function isiAngka(n: number, p: PedomanRules): string {
  const s = String(n);
  return p.angkaArab ? keAngkaArab(s) : s;
}

function isiTemplate(template: string, c: RefCandidate, p: PedomanRules): string {
  const peta: Record<string, string> = {
    penulis: nilai(c.penulis, p),
    judul: nilai(bersihkanJudul(c.kitab), p),
    kota: nilai(c.kota, p),
    penerbit: nilai(c.penerbit, p),
    tahun: nilai(c.tahun, p),
    jilid: nilai(c.jilid, p),
    halaman: nilai(c.halaman_cetak, p),
    kitab: nilai(bersihkanJudul(c.kitab), p),
    situs: nilai(c.url_sumber, p),
  };
  return template
    .replace(/\{(\w+)\}/g, (utuh, kunci: string) => peta[kunci] ?? utuh)
    .replace(/\s+/g, " ")
    .replace(/،\s*،/g, "،")
    .replace(/\.\s*\./g, ".")
    .trim();
}

/** Teks footnote (tanpa nomor urut). */
export function footnoteDari(c: RefCandidate, p: PedomanRules): string {
  return isiTemplate(p.formatFootnote, c, p);
}

/** Entri daftar pustaka. */
export function entriPustakaDari(c: RefCandidate, p: PedomanRules): string {
  return isiTemplate(p.formatPustaka, c, p);
}

export interface HasilBatas {
  paragraf: { nomor: number; jumlah: number; lebih: boolean }[];
  footnoteTotal: number;
  kata: number;
  halamanPerkiraan: number;
  halamanLebih: boolean;
  target: { font: string; ukuran: number; spasi: number };
  pelanggaran: string[];
}

/**
 * Perkiraan halaman A4 untuk naskah Arab 16 pt spasi 1,5, dari
 * kalibrasi terukur (Pembangunan Ulang Tahap 10) dan kalibrasi
 * ulangnya dengan huruf Carlito pada tahap verifikasi menyeluruh:
 * dokumen uji 1.652 kata menjadi 8 halaman, 3.134 kata menjadi 14,
 * 6.100 kata menjadi 27 pada render berhuruf Carlito, yang cocok
 * dengan 230 kata per halaman. Angka ini sama dengan konstanta format
 * standar di lib/engine/estimasi-halaman.ts (dijaga suite
 * test-tahap10-target, bukan impor, agar lib/refs tidak bergantung
 * pada lib/engine) dan tetap perkiraan, bukan pengukuran Word.
 */
export const KATA_PER_HALAMAN = 230;

export function hitungBatas(teks: string, p: PedomanRules): HasilBatas {
  // Penomoran paragraf meniru pengindeksan dialog Pasang Footnote
  // (ambilParagraf di pasang-footnote.tsx) dan sisip penanda Generate:
  // blok judul markdown (diawali "#") BUKAN paragraf isi dan tidak
  // memakan nomor, karena kunci paragraf penegak batas lapis di
  // server memakai indeks yang sama. Jumlah footnote per blok dari
  // hitungFootnoteBlok (lib/engine/marker.ts), penghitung bersama
  // yang mengenal penanda simpan draf [[ref:…]]; pola lama [^n] saja
  // membuat pemeriksa selalu membaca 0 pada draf nyata (perbaikan
  // laporan QA 6 Nov 2026, lihat komentar hitungFootnoteBlok).
  const paragrafMentah = teks
    .split(/\n{2,}/)
    .filter((s) => s.trim() !== "" && !s.trim().startsWith("#"));
  const paragraf = paragrafMentah.map((blok, i) => {
    const jumlah = hitungFootnoteBlok(blok);
    return { nomor: i + 1, jumlah, lebih: jumlah > p.maksFootnotePerParagraf };
  });

  const kata = (teks.match(/[\u0621-\u064A]+/g) ?? []).length;
  const halamanPerkiraan = Math.max(1, Math.ceil(kata / KATA_PER_HALAMAN));

  const pelanggaran: string[] = [];
  const lebihPar = paragraf.filter((x) => x.lebih);
  if (lebihPar.length > 0) {
    pelanggaran.push(
      `Paragraf ${lebihPar.map((x) => x.nomor).join(", ")} memuat lebih dari ${p.maksFootnotePerParagraf} footnote.`,
    );
  }
  if (halamanPerkiraan > p.maksHalaman) {
    pelanggaran.push(
      `Perkiraan ${halamanPerkiraan} halaman A4 (${kata} kata) melebihi batas ${p.maksHalaman} halaman.`,
    );
  }

  return {
    paragraf,
    footnoteTotal: paragraf.reduce((n, x) => n + x.jumlah, 0),
    kata,
    halamanPerkiraan,
    halamanLebih: halamanPerkiraan > p.maksHalaman,
    target: { font: p.fontArab, ukuran: p.ukuranNaskah, spasi: p.spasi },
    pelanggaran,
  };
}

/** Markdown bawaan saat pedoman belum diunggah (jujur: bukan dari kampus). */
export function pedomanBelumAda(): PedomanRules | null {
  return null;
}
