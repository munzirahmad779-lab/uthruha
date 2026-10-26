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

/* ── Verifikasi DOI cocok-judul (dipanen dari rancangan uthruha-core) ──────
 * DOI yang ADA belum tentu DOI untuk judul yang diketik mahasiswa — DOI bisa
 * tertukar atau asal tempel. Fungsi ini membandingkan judul lokal dengan
 * judul resmi Crossref memakai kemiripan Jaccard yang sadar harakat Arab. */

/** Kemiripan judul 0..1 (Jaccard kata, normalisasi buang harakat & tanda baca). */
export function kemiripanJudul(a: string, b: string): number {
  const norm = (t: string) =>
    t
      .normalize("NFKD")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const wa = new Set(norm(a).split(" ").filter(Boolean));
  const wb = new Set(norm(b).split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let iris = 0;
  for (const w of wa) if (wb.has(w)) iris++;
  return iris / (wa.size + wb.size - iris);
}

export type StatusDoi = "cocok" | "tidak-cocok" | "tidak-ditemukan" | "format-salah";

export interface HasilVerifikasiDoi {
  status: StatusDoi;
  kemiripan: number;
  judulCrossref?: string;
  pesan: string;
}

export async function verifikasiDoi(doiInput: string, judulLokal: string): Promise<HasilVerifikasiDoi> {
  const doi = doiInput
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  if (!/^10\.\d{4,9}\/\S+$/.test(doi)) {
    return { status: "format-salah", kemiripan: 0, pesan: "Format DOI tidak dikenal — DOI diawali 10.xxxx/." };
  }
  const r = await validasiDOI(doi);
  if (!r.valid || !r.judul) {
    return { status: "tidak-ditemukan", kemiripan: 0, pesan: "DOI tidak ditemukan di Crossref — periksa kembali nomornya." };
  }
  const sim = kemiripanJudul(judulLokal, r.judul);
  if (sim >= 0.6) {
    return {
      status: "cocok",
      kemiripan: sim,
      judulCrossref: r.judul,
      pesan: `DOI cocok: judul Crossref sama dengan judul Anda (kemiripan ${Math.round(sim * 100)}%).`,
    };
  }
  return {
    status: "tidak-cocok",
    kemiripan: sim,
    judulCrossref: r.judul,
    pesan: `DOI ini terdaftar untuk judul LAIN: “${r.judul}” (kemiripan hanya ${Math.round(sim * 100)}%). Periksa kembali DOI atau judul Anda.`,
  };
}
