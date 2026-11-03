/**
 * Konstanta halaman legal (/privasi & /ketentuan) — SATU tempat sunting.
 *
 * EMAIL_KONTAK adalah alamat email layanan yang aktif (ditetapkan
 * pemilik), dipakai bersama oleh kedua halaman legal. Ganti sekali di
 * berkas ini bila alamat layanan berubah.
 */
export const EMAIL_KONTAK = "munzirahmad779@gmail.com";

/**
 * Nomor WhatsApp pemilik untuk permintaan kunci (ditetapkan pemilik,
 * 3 Nov 2026), dipakai tautan wa.me di halaman masuk. Format
 * internasional tanpa tanda tambah dan tanpa spasi.
 */
export const WA_KONTAK = "6281354229189";

/** Bangun tautan wa.me dengan teks pesan yang sudah terisi. */
export function tautanWa(teks: string): string {
  return `https://wa.me/${WA_KONTAK}?text=${encodeURIComponent(teks)}`;
}

/** Tanggal berlaku versi kebijakan privasi & ketentuan saat ini. */
export const TANGGAL_BERLAKU_LEGAL = "28 Oktober 2026";

export const NAMA_LAYANAN = "Kitabah";
export const DOMAIN_LAYANAN = "kitabah.web.id";
