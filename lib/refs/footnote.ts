/**
 * Penyusun footnote & daftar pustaka dari kandidat rujukan, mengikuti
 * pedoman kampus yang diunggah. Tidak pernah mengisi kolom yang tidak
 * diketahui: nilai kosong menjadi `[ ! verifikasi ]`.
 */
import type { RefCandidate } from "@/lib/refs/types";
import type { PedomanRules } from "@/lib/refs/pedoman";
import { keAngkaArab, type Sumber } from "@/lib/engine/cite";

export const TANDA_VERIFIKASI = "[ ! verifikasi ]";

export function kandidatKeSumber(c: RefCandidate): Sumber {
  return {
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    jenis: "kitab",
    penulis: c.penulis ?? "",
    judul: c.kitab,
    kota: c.kota ?? "",
    penerbit: c.penerbit ?? "",
    tahun: c.tahun ? String(c.tahun) : "",
    jilid: c.jilid ? String(c.jilid) : "",
    halaman: c.halaman_cetak ? String(c.halaman_cetak) : "",
    url: c.url_sumber || undefined,
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
    judul: nilai(c.kitab, p),
    kota: nilai(c.kota, p),
    penerbit: nilai(c.penerbit, p),
    tahun: nilai(c.tahun, p),
    jilid: nilai(c.jilid, p),
    halaman: nilai(c.halaman_cetak, p),
    kitab: nilai(c.kitab, p),
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
 * Perkiraan halaman A4 untuk naskah Arab 16 pt spasi 1,5 ≈ 300 kata.
 * Angka ini perkiraan, bukan pengukuran Word — ditulis apa adanya di UI.
 */
export const KATA_PER_HALAMAN = 300;

export function hitungBatas(teks: string, p: PedomanRules): HasilBatas {
  const paragrafMentah = teks.split(/\n{2,}/).filter((s) => s.trim() !== "");
  const paragraf = paragrafMentah.map((blok, i) => {
    const jumlah = (blok.match(/\[\^\d+\]/g) ?? []).length;
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
