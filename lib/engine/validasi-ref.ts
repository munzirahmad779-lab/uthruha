/**
 * Validasi Rujukan — Utruha v2.0
 *
 * Memverifikasi apakah sumber rujukan benar-benar ada dan valid.
 * Status: موثق (verified) | يحتاج_تحقق (needs check) | غير_موجود (not found) | محرر_يدويًّا (manually edited)
 */

import type { Sumber } from "@/lib/engine/cite";
import type { StatusVerifikasi } from "@/lib/engine/auto-ref";

export interface HasilValidasi {
  sumberId: string;
  status: StatusVerifikasi;
  detail: string; // Penjelasan dalam bahasa Indonesia
  doiValid?: boolean;
  urlHidup?: boolean;
  shamelaDitemukan?: boolean;
}

/**
 * Validasi DOI via Crossref API.
 * Returns true jika DOI valid dan ditemukan.
 */
export async function validasiDOI(doi: string): Promise<{ valid: boolean; judul?: string }> {
  if (!doi || !doi.trim()) return { valid: false };

  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, "").trim();
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
      headers: { "User-Agent": "Utruha/2.0 (mailto:uthruha@example.com)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { valid: false };

    const data = await res.json();
    const judul = data?.message?.title?.[0];
    return { valid: true, judul };
  } catch {
    return { valid: false };
  }
}

/**
 * Cek apakah URL hidup via HEAD request.
 */
export async function cekURLHidup(url: string): Promise<boolean> {
  if (!url || !url.trim()) return false;

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    return res.ok || res.status === 301 || res.status === 302;
  } catch {
    return false;
  }
}

/**
 * Cari kitab di Shamela via search API.
 */
export async function cariDiShamela(judul: string): Promise<{ ditemukan: boolean; link?: string }> {
  if (!judul || !judul.trim()) return { ditemukan: false };

  try {
    // Shamela search API (public endpoint)
    const res = await fetch(
      `https://shamela.ws/api/search?q=${encodeURIComponent(judul)}&limit=3`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) return { ditemukan: false };

    const data = await res.json();
    const results = data?.results ?? data?.data ?? [];
    if (Array.isArray(results) && results.length > 0) {
      return { ditemukan: true, link: results[0]?.url ?? results[0]?.link };
    }
    return { ditemukan: false };
  } catch {
    return { ditemukan: false };
  }
}

/**
 * Validasi lengkap satu sumber rujukan.
 */
export async function validasiSumber(sumber: Sumber): Promise<HasilValidasi> {
  const hasil: HasilValidasi = {
    sumberId: sumber.id,
    status: "يحتاج_تحقق",
    detail: "Belum diverifikasi otomatis.",
  };

  // 1. Cek DOI
  if (sumber.doi) {
    const doiResult = await validasiDOI(sumber.doi);
    hasil.doiValid = doiResult.valid;
    if (doiResult.valid) {
      hasil.status = "موثق";
      hasil.detail = "DOI valid dan ditemukan di Crossref.";
      return hasil;
    } else {
      hasil.status = "غير_موجود";
      hasil.detail = "DOI tidak ditemukan di Crossref. Periksa kembali nomor DOI.";
      return hasil;
    }
  }

  // 2. Cek URL
  if (sumber.url) {
    const hidup = await cekURLHidup(sumber.url);
    hasil.urlHidup = hidup;
    if (hidup) {
      hasil.status = "موثق";
      hasil.detail = "URL aktif dan dapat diakses.";
      return hasil;
    } else {
      hasil.status = "غير_موجود";
      hasil.detail = "URL tidak dapat diakses (404 atau timeout).";
      return hasil;
    }
  }

  // 3. Cek di Shamela untuk kitab
  if (sumber.jenis === "kitab" || sumber.jenis === "terjemahan") {
    const shamela = await cariDiShamela(sumber.judul);
    hasil.shamelaDitemukan = shamela.ditemukan;
    if (shamela.ditemukan) {
      hasil.status = "موثق";
      hasil.detail = "Kitab ditemukan di Shamela.";
      return hasil;
    }
  }

  // 4. Fallback: tidak bisa diverifikasi otomatis
  hasil.status = "يحتاج_تحقق";
  if (sumber.halaman) {
    hasil.detail = "Halaman tercantum tetapi tidak dapat diverifikasi tanpa teks lengkap. Harap cek manual.";
  } else {
    hasil.detail = "Tidak ada DOI/URL untuk verifikasi otomatis. Harap cek manual.";
  }

  return hasil;
}

/**
 * Validasi batch beberapa sumber sekaligus.
 */
export async function validasiBatch(sumberList: Sumber[]): Promise<HasilValidasi[]> {
  return Promise.all(sumberList.map(validasiSumber));
}
