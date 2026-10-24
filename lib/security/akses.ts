/**
 * Gerbang akses berbasis kunci bersama (HMAC).
 *
 * Tujuan: saat aplikasi diekspos ke internet lewat tunnel (Cloudflare/ngrok),
 * tidak sembarang orang bisa membuka halaman atau memanggil API — termasuk
 * orang yang menemukan URL-nya lalu memakai GPU/LLM Anda.
 *
 * Prinsip:
 *  - Kunci asli TIDAK pernah disimpan di cookie. Yang dikirim hanya HMAC-nya.
 *  - Perbandingan memakai waktu konstan agar tidak bisa ditebak lewat timing.
 *  - Bila env `UTH_ACCESS_KEY` kosong, gerbang MATI (mode pengembangan lokal).
 *
 * Dua jenis cookie:
 *  - `uthruha_akses`    : sesi biasa, 7 hari.
 *  - `uthruha_perangkat`: "ingat perangkat ini", 365 hari. Dipakai agar laptop
 *                         milik Anda langsung masuk tanpa mengetik kunci lagi.
 *
 * Modul ini dipakai di runtime Node (route handler). Middleware Edge memakai
 * Web Crypto dengan pesan & algoritme yang sama, sehingga hasilnya identik.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Nama cookie sesi biasa. */
export const COOKIE_AKSES = "uthruha_akses";

/** Nama cookie perangkat tepercaya (auto-login). */
export const COOKIE_PERANGKAT = "uthruha_perangkat";

/** Umur sesi biasa: 7 hari. */
export const UMUR_SESI_DETIK = 7 * 24 * 60 * 60;

/** Umur perangkat tepercaya: 365 hari. */
export const UMUR_PERANGKAT_DETIK = 365 * 24 * 60 * 60;

/** Pesan yang ditandatangani — HARUS sama di middleware Edge. */
const PESAN = "uthruha-akses-v1";

/** Pesan khusus cookie perangkat — dipisah agar tak bisa saling tukar. */
const PESAN_PERANGKAT = "uthruha-perangkat-v1";

/** Kunci bersama dari environment. Kosong = gerbang mati. */
export function kunciAkses(): string {
  return process.env.UTH_ACCESS_KEY?.trim() ?? "";
}

/** Apakah gerbang akses diaktifkan? */
export function gerbangAktif(): boolean {
  return kunciAkses().length >= 16;
}

/**
 * Apakah cookie boleh ditandai Secure.
 * Default: ya, di produksi. Bisa dimatikan lewat UTH_COOKIE_SECURE=0 bila
 * aplikasi diuji lewat http biasa di jaringan lokal.
 */
export function cookieSecure(): boolean {
  const paksa = process.env.UTH_COOKIE_SECURE?.trim();
  if (paksa === "0") return false;
  if (paksa === "1") return true;
  return process.env.NODE_ENV === "production";
}

/** Hitung tanda HMAC-SHA256 untuk sesi. */
export function tandaAkses(kunci: string): string {
  return createHmac("sha256", kunci).update(PESAN).digest("hex");
}

/** Hitung tanda HMAC-SHA256 untuk perangkat tepercaya. */
export function tandaPerangkat(kunci: string): string {
  return createHmac("sha256", kunci).update(PESAN_PERANGKAT).digest("hex");
}

/** Bandingkan dua tanda dengan waktu konstan. */
export function tandaSama(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Apakah nilai cookie sesi sah untuk kunci saat ini? */
export function cookieSah(nilai: string | undefined): boolean {
  if (!gerbangAktif()) return true;
  if (!nilai) return false;
  return tandaSama(nilai, tandaAkses(kunciAkses()));
}

/** Apakah nilai cookie perangkat sah untuk kunci saat ini? */
export function perangkatSah(nilai: string | undefined): boolean {
  if (!gerbangAktif()) return false;
  if (!nilai) return false;
  return tandaSama(nilai, tandaPerangkat(kunciAkses()));
}

/**
 * Boleh masuk bila punya sesi sah ATAU perangkat tepercaya sah.
 * Mengganti UTH_ACCESS_KEY otomatis membatalkan semua perangkat —
 * itu memang yang diinginkan bila kunci bocor.
 */
export function bolehMasuk(
  sesi: string | undefined,
  perangkat: string | undefined,
): boolean {
  if (!gerbangAktif()) return true;
  return cookieSah(sesi) || perangkatSah(perangkat);
}