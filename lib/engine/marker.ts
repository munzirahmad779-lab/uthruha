/**
 * Marker sitasi (Urutan 2).
 * Format SIMPAN di draf:  [[ref:<id-sumber>|hlm:45|jilid:2]]
 * Format RENDER/EKSPOR:   footnote markdown [^n] + definisi, dihasilkan oleh
 * kompilasiMarker() dari data Sumber + gaya aktif — angka footnote tidak
 * pernah ditulis tangan user, jadi tidak ada nomor yang basi saat naskah
 * disusun ulang. Draf lama tanpa marker tidak berubah sama sekali.
 */
import { footnoteGaya, footnotePedoman, gayaSah } from "@/lib/engine/citation";
import type { Project } from "@/lib/engine/project";

export interface MarkerSitasi {
  mentah: string;
  id: string;
  halaman?: string;
  jilid?: string;
  posisi: number;
}

const POLA = /\[\[ref:([^\]|]+)(?:\|hlm:([^\]|]*))?(?:\|jilid:([^\]]*))?\]\]/g;

export function cariMarker(teks: string): MarkerSitasi[] {
  const hasil: MarkerSitasi[] = [];
  for (const m of teks.matchAll(POLA)) {
    hasil.push({
      mentah: m[0],
      id: m[1].trim(),
      halaman: m[2]?.trim() || undefined,
      jilid: m[3]?.trim() || undefined,
      posisi: m.index ?? 0,
    });
  }
  return hasil;
}

export function buatMarker(id: string, halaman?: string, jilid?: string): string {
  const bag = [`[[ref:${id}`];
  if (halaman) bag.push(`hlm:${halaman}`);
  if (jilid) bag.push(`jilid:${jilid}`);
  return `${bag.join("|")}]]`;
}

export interface HasilKompilasi {
  markdown: string;
  /** Marker yang id-nya tidak ditemukan di sumber proyek — JANGAN dibuang diam-diam. */
  takDikenal: MarkerSitasi[];
  jumlah: number;
}

/**
 * Kompilasi seluruh marker dalam satu markdown menjadi footnote [^n].
 * Penomoran mengikuti urutan kemunculan di dokumen gabungan.
 * Marker tak dikenal dipertahankan sebagai teks [[ref:…]] agar terlihat saat
 * pemeriksaan (cross-check Urutan 4 melaporkannya juga).
 */
export function kompilasiMarker(markdown: string, p: Project): HasilKompilasi {
  const gaya = gayaSah(p.gayaSitasi);
  const perId = new Map(p.sumber.map((s) => [s.id, s]));
  const nomorUntuk = new Map<string, number>();
  const definisi: string[] = [];
  const takDikenal: MarkerSitasi[] = [];
  let jumlah = 0;

  const diganti = markdown.replace(POLA, (mentah, idRaw: string, hlm?: string, jil?: string) => {
    const id = idRaw.trim();
    const sumber = perId.get(id);
    if (!sumber) {
      takDikenal.push({ mentah, id, halaman: hlm, jilid: jil, posisi: 0 });
      return mentah;
    }
    const kunci = `${id}|${hlm ?? ""}|${jil ?? ""}`;
    let nomor = nomorUntuk.get(kunci);
    if (nomor === undefined) {
      nomor = definisi.length + 1;
      nomorUntuk.set(kunci, nomor);
      const opsi = { halaman: hlm?.trim() || undefined, jilid: jil?.trim() || undefined };
      // Pedoman kampus adalah lapisan teratas: bila proyek punya pedoman,
      // template footnote pedoman yang dipakai, bukan gaya proyek.
      const teksFootnote = p.pedoman?.formatFootnote
        ? footnotePedoman(sumber, p.pedoman, opsi)
        : footnoteGaya(sumber, gaya, opsi);
      definisi.push(`[^${nomor}]: ${teksFootnote}`);
      jumlah++;
    }
    return `[^${nomor}]`;
  });

  return {
    markdown: definisi.length > 0 ? `${diganti}\n\n${definisi.join("\n")}` : diganti,
    takDikenal,
    jumlah,
  };
}
