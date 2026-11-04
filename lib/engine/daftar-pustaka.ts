/**
 * Daftar pustaka SATU JALUR (Tahap 6, menutup sisa A7): semua
 * permukaan proyek (tab Ekspor untuk .md/.docx, tab Rujukan, kartu
 * detail sumber) merumuskan entri dari fungsi di sini, dengan urutan
 * lapisan yang sama seperti kompilator footnote:
 *
 * 1. Hawamisy template pedoman kampus (Mangkoso/As'adiyah) —
 *    pengelompokan, urutan, dan bentuk entri dari SPEC-PEDOMAN.
 * 2. Pedoman kampus unggahan (p.pedoman.formatPustaka) — template
 *    isi-slot lama, tidak berubah.
 * 3. Gaya proyek (Turabian/Chicago/APA) — perumus gaya lama.
 * 4. Arab klasik — pengelompokan bawaan cite.ts, tidak berubah.
 *
 * Sebelum tahap ini tab Ekspor dan tab Rujukan memilih perumus
 * berbeda untuk proyek yang sama (tab Rujukan bahkan mengabaikan
 * gaya proyek), jadi satu sumber bisa tampil dengan dua bentuk
 * berbeda. Sekarang bentuknya identik dari permukaan mana pun.
 */
import { entriDaftarPustaka, susunDaftarPustaka, type Sumber } from "@/lib/engine/cite";
import {
  daftarPustakaGaya,
  daftarPustakaPedoman,
  gayaSah,
  susunDaftarPustakaGaya,
} from "@/lib/engine/citation";
import {
  daftarPustakaKampus,
  entriPustakaAsadiyah,
  entriPustakaMangkoso,
  kampusProyek,
} from "@/lib/engine/hawamisy";
import type { Project } from "@/lib/engine/project";

export interface GrupPustaka {
  judul: string;
  entri: string[];
}

/** Daftar pustaka lengkap proyek, terkelompok sesuai lapisannya. */
export function daftarPustakaProyek(p: Project): GrupPustaka[] {
  const kampus = p.pedoman?.formatPustaka ? null : kampusProyek(p);
  if (kampus) return daftarPustakaKampus(p.sumber, kampus);
  if (p.pedoman?.formatPustaka) {
    return [{ judul: "قائمة المراجع", entri: daftarPustakaPedoman(p.sumber, p.pedoman) }];
  }
  const gaya = gayaSah(p.gayaSitasi);
  if (gaya !== "arab-klasik") {
    return [{ judul: "قائمة المراجع", entri: susunDaftarPustakaGaya(p.sumber, gaya) }];
  }
  return susunDaftarPustaka(p.sumber);
}

/** Satu entri daftar pustaka untuk satu sumber pada konteks proyek
 *  yang sama — dipakai kartu detail sumber agar teksnya persis sama
 *  dengan entri di daftar lengkap. */
export function entriPustakaProyek(p: Project, s: Sumber): string {
  const kampus = p.pedoman?.formatPustaka ? null : kampusProyek(p);
  if (kampus === "mangkoso") return entriPustakaMangkoso(s);
  if (kampus === "asadiah") return entriPustakaAsadiyah(s);
  if (p.pedoman?.formatPustaka) return daftarPustakaPedoman([s], p.pedoman)[0] ?? "";
  const gaya = gayaSah(p.gayaSitasi);
  if (gaya !== "arab-klasik") return daftarPustakaGaya(s, gaya);
  return entriDaftarPustaka(s);
}
