/**
 * Formatter sitasi multi-gaya (Urutan 2) — ditulis tangan, tanpa citation-js.
 * Gaya: Turabian 9 (DEFAULT), Chicago 17, APA 7, dan Arab Klasik (membungkus
 * formatter existing di cite.ts agar perilaku lama tidak berubah).
 *
 * Catatan kejujuran cakupan: ini implementasi subset yang dipakai karya ilmiah
 * berbahasa Arab/Indonesia — footnote + daftar pustaka untuk kitab, artikel
 * jurnal, bab, dan skripsi/tesis. Kasus eksotik (surat kabar, arsip, wawancara)
 * jatuh ke pola umum, bukan ditebak detailnya.
 */
import { catatanKaki, entriDaftarPustaka, keAngkaArab, type Sumber } from "@/lib/engine/cite";
import type { PedomanRules } from "@/lib/refs/pedoman";

export type GayaSitasi = "turabian9" | "chicago17" | "apa7" | "arab-klasik";

export const GAYA_LABEL: Record<GayaSitasi, string> = {
  turabian9: "Turabian 9 (footnote)",
  chicago17: "Chicago 17 (footnote)",
  apa7: "APA 7 (penulis–tahun)",
  "arab-klasik": "Arab klasik (gaya bawaan Uthruha)",
};

export const GAYA_DEFAULT: GayaSitasi = "turabian9";

export function gayaSah(v?: string): GayaSitasi {
  return v === "chicago17" || v === "apa7" || v === "arab-klasik" ? v : "turabian9";
}

/** Nama tampil penulis: utamakan penulisDaftar (Latin/impor), else penulis Arab. */
function namaPenulis(s: Sumber): string {
  if (s.penulisDaftar && s.penulisDaftar.length > 0) return s.penulisDaftar.join(", ");
  return s.penulis;
}

/** "Aziz, Abdul" → "Abdul Aziz" untuk posisi awal footnote. */
function namaDepan(nama: string): string {
  const p = nama.split(",").map((x) => x.trim());
  return p.length >= 2 ? `${p[1]} ${p[0]}` : nama;
}

function namaPertama(s: Sumber): string {
  const daftar = s.penulisDaftar && s.penulisDaftar.length > 0 ? s.penulisDaftar : [s.penulis];
  return namaDepan(daftar[0] ?? "");
}

/** Penanda miring untuk judul — dirender miring oleh pratinjau & ekspor .docx. */
export function miring(teks: string): string {
  return `*${teks}*`;
}

export interface OpsiFootnote {
  halaman?: string;
  jilid?: string;
  /** Sitasi berikutnya untuk sumber yang sama (Ibid./disingkat) — v1: belum dipakai otomatis. */
}

function tempatTerbit(s: Sumber): string {
  const kotaPenerbit = [s.kota, s.penerbit].filter(Boolean).join(": ");
  if (kotaPenerbit && s.tahun) return `(${kotaPenerbit}, ${s.tahun})`;
  if (kotaPenerbit) return `(${kotaPenerbit})`;
  if (s.tahun) return `(${s.tahun})`;
  return "";
}

function halamanJilid(opsi: OpsiFootnote, s: Sumber): string {
  const bag: string[] = [];
  const jilid = opsi.jilid ?? s.jilid;
  const hal = opsi.halaman ?? s.halaman;
  if (jilid) bag.push(`${jilid}`);
  if (hal) bag.push(`${hal}`);
  return bag.join(", ");
}

/** Footnote lengkap satu sumber menurut gaya. */
export function footnoteGaya(s: Sumber, gaya: GayaSitasi, opsi: OpsiFootnote = {}): string {
  if (gaya === "arab-klasik") {
    return catatanKaki({ ...s, halaman: opsi.halaman ?? s.halaman, jilid: opsi.jilid ?? s.jilid });
  }
  if (gaya === "apa7") {
    // APA tidak memakai footnote isi; kembalikan bentuk penulis–tahun untuk sisip dalam teks.
    const nama = (s.penulisDaftar?.[0] ?? s.penulis).split(",")[0].trim();
    const hal = opsi.halaman ?? s.halaman;
    return `(${nama}, ${s.tahun}${hal ? `, hlm. ${hal}` : ""})`;
  }
  // Turabian 9 & Chicago 17 — pola notes yang sama untuk jenis-jenis ini.
  const penulis = namaPertama(s);
  const hl = halamanJilid(opsi, s);
  switch (s.jenis) {
    case "artikel": {
      const vol = [s.volume && `vol. ${s.volume}`, s.nomor && `no. ${s.nomor}`].filter(Boolean).join(", ");
      const inti = `${penulis}, "${s.judul}," ${miring(s.jurnal ?? "")}${vol ? ` ${vol}` : ""} (${s.tahun})`;
      return `${inti}${hl ? `: ${hl}` : ""}.`;
    }
    case "bab": {
      const inti = `${penulis}, "${s.judul}," dalam ${miring(s.jurnal ?? s.catatan ?? "")}`;
      return `${inti} ${tempatTerbit(s)}${hl ? `, ${hl}` : ""}.`;
    }
    default: {
      const sunting = s.muhaqqiq ? `, disunting oleh ${s.muhaqqiq}` : s.penerjemah ? `, diterjemahkan oleh ${s.penerjemah}` : "";
      const inti = `${penulis}, ${miring(s.judul)}${sunting} ${tempatTerbit(s)}`;
      return `${inti}${hl ? `, ${hl}` : ""}.`;
    }
  }
}

/** Satu entri daftar pustaka menurut gaya. */
export function daftarPustakaGaya(s: Sumber, gaya: GayaSitasi): string {
  if (gaya === "arab-klasik") return entriDaftarPustaka(s);
  const penulis = namaPenulis(s);
  if (gaya === "apa7") {
    if (s.jenis === "artikel") {
      const vol = [s.volume && `${s.volume}`, s.nomor && `(${s.nomor})`].filter(Boolean).join("");
      const doi = s.doi ? ` https://doi.org/${s.doi.replace(/^https?:\/\/doi\.org\//, "")}` : "";
      return `${penulis} (${s.tahun}). ${s.judul}. ${miring(s.jurnal ?? "")}${vol ? `, ${vol}` : ""}.${doi}`;
    }
    const kotaPenerbit = [s.kota, s.penerbit].filter(Boolean).join(": ");
    return `${penulis} (${s.tahun}). ${miring(s.judul)}. ${kotaPenerbit}.`.replace(/\s+/g, " ");
  }
  // Turabian/Chicago bibliography: nama dibalik untuk entri pertama.
  if (s.jenis === "artikel") {
    const vol = [s.volume, s.nomor && `no. ${s.nomor}`].filter(Boolean).join(", ");
    const doi = s.doi ? ` https://doi.org/${s.doi.replace(/^https?:\/\/doi\.org\//, "")}` : "";
    return `${penulis}. "${s.judul}." ${miring(s.jurnal ?? "")} ${vol} (${s.tahun}).${doi}`.replace(/\s+/g, " ");
  }
  const sunting = s.muhaqqiq ? `. Disunting oleh ${s.muhaqqiq}` : "";
  const kotaPenerbit = [s.kota, s.penerbit].filter(Boolean).join(": ");
  return `${penulis}. ${miring(s.judul)}${sunting}. ${kotaPenerbit}${s.tahun ? `, ${s.tahun}` : ""}.`.replace(/\s+/g, " ");
}

/** Susun daftar pustaka: urut penulis (kolator Arab/Latin campuran), satu gaya. */
export function susunDaftarPustakaGaya(items: Sumber[], gaya: GayaSitasi): string[] {
  const collator = new Intl.Collator("ar");
  return [...items]
    .sort((a, b) => collator.compare(namaPenulis(a), namaPenulis(b)) || (a.tahun || "").localeCompare(b.tahun || ""))
    .map((s) => daftarPustakaGaya(s, gaya));
}

/* ------- Pedoman kampus: lapisan TERATAS (mengalahkan gaya proyek) ------- */

/** Isi slot template pedoman {penulis} {judul} {kota} … dari satu Sumber. */
function isiTemplate(template: string, s: Sumber, opsi: OpsiFootnote = {}, angkaArab = false): string {
  const nilai: Record<string, string> = {
    penulis: s.penulis,
    judul: s.judul,
    kota: s.kota ?? "",
    penerbit: s.penerbit ?? "",
    tahun: s.tahun,
    tahunHijriah: s.tahunHijriah ?? "",
    jilid: opsi.jilid ?? s.jilid ?? "",
    halaman: opsi.halaman ?? s.halaman ?? "",
    muhaqqiq: s.muhaqqiq ?? s.tahqiq ?? "",
    tahqiq: s.tahqiq ?? s.muhaqqiq ?? "",
    penerjemah: s.penerjemah ?? "",
    jurnal: s.jurnal ?? "",
    volume: s.volume ?? "",
    nomor: s.nomor ?? "",
    doi: s.doi ?? "",
    edisi: s.edisi ?? "",
  };
  let hasil = template
    .replace(/\{(\w+)\}/g, (_, k: string) => nilai[k] ?? "")
    .replace(/\(\s*[:،,]?\s*\)/g, "")
    .replace(/،\s*،/g, "،")
    .replace(/:\s*،/g, "،")
    .replace(/\s+/g, " ")
    .replace(/\s+([،.])/g, "$1")
    .trim();
  if (angkaArab) {
    // Pedoman meminta angka Arab (٠١٢٣): ubah semua digit, KECUALI DOI —
    // pengenal DOI harus tetap persis seperti terdaftar.
    const doi = s.doi?.trim();
    if (doi && hasil.includes(doi)) {
      const jaga = "\u0001DOI\u0001";
      hasil = keAngkaArab(hasil.replace(doi, jaga)).replace(jaga, doi);
    } else {
      hasil = keAngkaArab(hasil);
    }
  }
  return hasil;
}

/** Footnote menurut template pedoman kampus user (bila proyek punya pedoman). */
export function footnotePedoman(s: Sumber, pedoman: PedomanRules, opsi: OpsiFootnote = {}): string {
  return isiTemplate(pedoman.formatFootnote, s, opsi, pedoman.angkaArab);
}

/** Daftar pustaka menurut template pedoman kampus user, urut alfabet Arab. */
export function daftarPustakaPedoman(items: Sumber[], pedoman: PedomanRules): string[] {
  const collator = new Intl.Collator("ar");
  return [...items]
    .sort((a, b) => collator.compare(a.penulis, b.penulis) || (a.tahun || "").localeCompare(b.tahun || ""))
    .map((s) => isiTemplate(pedoman.formatPustaka, s, {}, pedoman.angkaArab));
}
