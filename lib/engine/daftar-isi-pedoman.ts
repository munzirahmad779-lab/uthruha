// lib/engine/daftar-isi-pedoman.ts
// Mengubah daftar isi / sistematika penulisan dari pedoman kampus menjadi
// daftar isi proyek (BabKustom[]). Dua sumber:
//   1. Bagian "Daftar Isi / Sistematika / Struktur" di dalam pedoman .md
//      (parseOutlinePedoman — hanya membaca bagian itu).
//   2. Tempelan bebas dari mahasiswa (parseOutlineTempelan — semua baris
//      dianggap outline).
// Format outline yang dipahami:
//   - BAB I Pendahuluan            <- bab (tanpa indentasi / diawali BAB|الباب)
//     - Latar Belakang             <- sub-bab (indentasi 2 spasi / penomoran 1.1)
//       - Pengertian               <- fasal/matlab (indentasi 4 spasi / 1.1.1)
// Penomoran desimal (1, 1.1, 1.1.1) juga dipahami dan mengalahkan indentasi.

import type { BabKustom, SubBabKustom } from "@/lib/engine/project";

const BAB_AR = [
  "الأول", "الثاني", "الثالث", "الرابع", "الخامس",
  "السادس", "السابع", "الثامن", "التاسع", "العاشر",
];

const mengandungArab = (s: string) => /[\u0600-\u06FF]/.test(s);

interface BarisOutline {
  tingkat: number; // 0 bab, 1 sub-bab, 2 fasal
  teks: string;
}

function bersihkanBaris(raw: string): { tingkat: number; teks: string } | null {
  const tanpaKanan = raw.replace(/\s+$/, "");
  if (!tanpaKanan.trim()) return null;
  if (/^-{3,}$/.test(tanpaKanan.trim())) return null;

  let isi = tanpaKanan.replace(/^\s+/, "");
  const indentMentah = tanpaKanan.slice(0, tanpaKanan.length - isi.length);
  const indent = indentMentah.replace(/\t/g, "  ").length;

  // Penanda daftar markdown / penomoran.
  isi = isi.replace(/^[-*•]\s+/, "");
  let tingkatDesimal: number | null = null;
  const desimal = isi.match(/^(\d+(?:\.\d+){0,2})[.)]?\s+(.+)$/);
  if (desimal) {
    tingkatDesimal = desimal[1].split(".").length - 1;
    isi = desimal[2];
  } else {
    isi = isi.replace(/^\d+[.)]\s+/, "");
  }
  const teks = isi.replace(/\*\*/g, "").trim();
  if (!teks) return null;

  const babTegas = /^(BAB\s|الباب\s|Bab\s)/.test(teks);
  let tingkat: number;
  if (babTegas) tingkat = 0;
  else if (tingkatDesimal !== null) tingkat = Math.min(tingkatDesimal, 2);
  else if (indent >= 4) tingkat = 2;
  else if (indent >= 2) tingkat = 1;
  else tingkat = 0;
  return { tingkat, teks };
}

function barisKeDaftarIsi(baris: BarisOutline[]): BabKustom[] {
  const hasil: BabKustom[] = [];
  let bab: BabKustom | null = null;
  let sub: SubBabKustom | null = null;
  for (const b of baris) {
    if (b.tingkat === 0) {
      const n = hasil.length + 1;
      bab = {
        id: `ped-bab-${n}`,
        labelId: b.teks,
        labelAr: mengandungArab(b.teks) ? b.teks : "",
        babAr: `الباب ${BAB_AR[n - 1] ?? n}`,
        sections: [],
      };
      hasil.push(bab);
      sub = null;
    } else if (b.tingkat === 1) {
      if (!bab) continue;
      sub = {
        id: `ped-bab-${hasil.length}-${bab.sections.length + 1}`,
        labelId: b.teks,
        labelAr: mengandungArab(b.teks) ? b.teks : "",
      };
      bab.sections.push(sub);
    } else {
      if (!bab || !sub) continue;
      const anak: SubBabKustom = {
        id: `${sub.id}-${(sub.anak?.length ?? 0) + 1}`,
        labelId: b.teks,
        labelAr: mengandungArab(b.teks) ? b.teks : "",
      };
      sub.anak = [...(sub.anak ?? []), anak];
    }
  }
  return hasil;
}

function kumpulkan(teks: string): BarisOutline[] {
  const hasil: BarisOutline[] = [];
  for (const raw of teks.split(/\r?\n/)) {
    const b = bersihkanBaris(raw);
    if (b) hasil.push(b);
  }
  return hasil;
}

/**
 * Baca daftar isi dari teks pedoman .md — HANYA dari bagian berjudul
 * Daftar Isi / Sistematika / Struktur. Null bila bagian itu tidak ada atau
 * isinya kosong, supaya pemanggil bisa memberi petunjuk yang benar.
 */
export function parseOutlinePedoman(mentah: string): BabKustom[] | null {
  if (!mentah) return null;
  const lines = mentah.split(/\r?\n/);
  let mulai = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,4}\s/.test(lines[i]) && /(daftar isi|sistematika|struktur)/i.test(lines[i])) {
      mulai = i + 1;
      break;
    }
  }
  if (mulai < 0) return null;
  let akhir = lines.length;
  for (let i = mulai; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) {
      akhir = i;
      break;
    }
  }
  const potongan = lines.slice(mulai, akhir).join("\n");
  if (/tidak disebut/i.test(potongan) && potongan.replace(/tidak disebut/i, "").trim().length < 10) return null;
  const baris = kumpulkan(potongan);
  if (baris.length === 0) return null;
  const daftar = barisKeDaftarIsi(baris);
  return daftar.length > 0 ? daftar : null;
}

/** Baca daftar isi dari tempelan bebas mahasiswa (semua baris = outline). */
export function parseOutlineTempelan(teks: string): BabKustom[] | null {
  if (!teks || teks.trim().length < 5) return null;
  const baris = kumpulkan(teks);
  if (baris.length < 2) return null;
  const daftar = barisKeDaftarIsi(baris);
  return daftar.length > 0 && daftar.some((b) => b.sections.length > 0) ? daftar : null;
}
