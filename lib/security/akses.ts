/**
 * Gerbang akses berbasis kunci bersama (HMAC).
 *
 * Tujuan: saat aplikasi diekspos ke internet lewat tunnel (Cloudflare/ngrok),
 * tidak sembarang orang bisa membuka halaman atau memanggil API — termasuk
 * orang yang menemukan URL-nya lalu memakai GPU/LLM Anda.
 *
 * Prinsip:
 *  - Kunci asli TIDAK pernah disimpan di cookie. Yang dikirim adalah cap
 *    waktu terbit + HMAC-nya (format N-03: server menolak token kedaluwarsa
 *    walau cookie disalin utuh).
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

/** HMAC-SHA256 mentah (hex) dari sebuah pesan dengan kunci tertentu. */
function hmac(kunci: string, pesan: string): string {
  return createHmac("sha256", kunci).update(pesan).digest("hex");
}

/**
 * Sidik kunci untuk membandingkan kunci yang diketik pengguna dengan kunci
 * server tanpa membandingkan teks mentah (dipakai /api/masuk).
 */
export function sidikKunci(kunci: string): string {
  return hmac(kunci, PESAN);
}

/**
 * Nilai cookie sesi — format N-03 (audit menyeluruh 27 Okt):
 * `<detik-terbit>.<HMAC(PESAN + "." + detik-terbit)>`.
 * Cap waktu DI DALAM nilai membuat server bisa menolak token curian yang
 * umurnya melewati batas, walau cookie-nya sendiri disalin utuh ke
 * peramban lain. Format lama (HMAC polos tanpa cap waktu) TIDAK lagi
 * diterima — sesi lama cukup masuk ulang sekali di /masuk.
 */
export function tandaAkses(
  kunci: string,
  sekarangDetik = Math.floor(Date.now() / 1000),
): string {
  return `${sekarangDetik}.${hmac(kunci, `${PESAN}.${sekarangDetik}`)}`;
}

/** Nilai cookie perangkat tepercaya — format cap waktu sama seperti sesi. */
export function tandaPerangkat(
  kunci: string,
  sekarangDetik = Math.floor(Date.now() / 1000),
): string {
  return `${sekarangDetik}.${hmac(kunci, `${PESAN_PERANGKAT}.${sekarangDetik}`)}`;
}

/** Periksa nilai cookie bercap waktu: format benar, belum kedaluwarsa, tanda cocok. */
function nilaiSah(
  nilai: string | undefined,
  kunci: string,
  pesan: string,
  maksUmurDetik: number,
): boolean {
  if (!nilai) return false;
  const titik = nilai.indexOf(".");
  if (titik <= 0) return false;
  const ts = Number(nilai.slice(0, titik));
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const sekarang = Math.floor(Date.now() / 1000);
  if (ts > sekarang + 300) return false; // toleransi jam miring 5 menit
  if (sekarang - ts > maksUmurDetik) return false;
  return tandaSama(nilai, `${ts}.${hmac(kunci, `${pesan}.${ts}`)}`);
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
  return nilaiSah(nilai, kunciAkses(), PESAN, UMUR_SESI_DETIK);
}

/** Apakah nilai cookie perangkat sah untuk kunci saat ini? */
export function perangkatSah(nilai: string | undefined): boolean {
  if (!gerbangAktif()) return false;
  return nilaiSah(nilai, kunciAkses(), PESAN_PERANGKAT, UMUR_PERANGKAT_DETIK);
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

/**
 * Pertahanan lapis kedua (N-01, audit menyeluruh 27 Okt): route handler
 * sensitif memverifikasi cookie sesi/perangkat DENGAN SENDIRI memakai
 * pemeriksaan yang sama persis seperti middleware — jadi bila middleware
 * suatu saat terlewat (matcher berubah, berkas hilang), rute yang membakar
 * kunci LLM tidak ikut terbuka diam-diam.
 *
 * Bila gerbang tidak aktif, fungsi ini meloloskan (perilaku pengembangan
 * lokal tidak berubah) TETAPI di produksi meninggalkan jejak console.error
 * yang keras di log server — gerbang mati di produksi tidak lagi senyap.
 * Keberadaan UTH_ACCESS_KEY di dashboard Vercel tetap hanya bisa
 * dipastikan pemilik.
 */
export function sesiSahDariRequest(req: Request): boolean {
  if (!gerbangAktif()) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[akses] PERINGATAN N-01: gerbang akses TIDAK AKTIF di produksi " +
          "(UTH_ACCESS_KEY kosong/<16 karakter). Rute sensitif berjalan " +
          "tanpa gerbang sampai env itu diisi di dashboard Vercel.",
      );
    }
    return true;
  }
  const header = req.headers.get("cookie") ?? "";
  const peta = new Map<string, string>();
  for (const bagian of header.split(";")) {
    const i = bagian.indexOf("=");
    if (i > 0) peta.set(bagian.slice(0, i).trim(), bagian.slice(i + 1).trim());
  }
  return bolehMasuk(peta.get(COOKIE_AKSES), peta.get(COOKIE_PERANGKAT));
}

/** Balasan 401 baku bila lapis kedua menolak; null bila lolos. */
export function tolakTanpaSesi(req: Request): Response | null {
  if (sesiSahDariRequest(req)) return null;
  return new Response(
    JSON.stringify({
      error: "Akses ditolak. Buka /masuk lalu masukkan kunci akses.",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}