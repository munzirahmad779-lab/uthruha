/**
 * Adapter Waqfeya — sumber VERIFIKASI, bukan pencarian.
 * Uji langsung: https://waqfeya.com/search?q=... → 200 (HTML, tanpa API).
 * Karena itu adapter ini tidak pernah menghasilkan kandidat berskor;
 * perannya hanya menyediakan tautan untuk mencocokkan halaman cetak.
 */
import type { RefCandidate } from "@/lib/refs/types";

const SITUS = "https://waqfeya.com";

export const info = {
  id: "waqfeya" as const,
  mode: "deeplink" as const,
  situs: SITUS,
  peran: "verifikasi" as const,
};

export function tautanCari(kueri: string): string {
  return `${SITUS}/search?q=${encodeURIComponent(kueri.slice(0, 180))}`;
}

/** Tautan verifikasi untuk satu kandidat: cari kitabnya di Waqfeya. */
export function verifikasiUntuk(c: RefCandidate): string {
  const kueri = [c.kitab, c.penulis, c.penerbit].filter(Boolean).join(" ").trim();
  return tautanCari(kueri || c.teks_kutipan);
}

export function catatanVerifikasi(c: RefCandidate): string {
  const bagian = [
    c.kitab ? `«${c.kitab}»` : undefined,
    c.jilid ? `ج ${c.jilid}` : undefined,
    c.halaman_cetak ? `ص ${c.halaman_cetak}` : "nomor halaman belum pasti",
  ].filter(Boolean);
  return `Cocokkan ${bagian.join("، ")} dengan PDF cetak di Waqfeya sebelum footnote dipakai.`;
}
