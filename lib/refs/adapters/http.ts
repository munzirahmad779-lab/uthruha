/** Pembungkus fetch dengan batas waktu — dipakai semua adapter. */

export interface OpsiAdapter {
  /** Key milik pengguna (hanya sumber yang menerima key). */
  kunci?: string;
  /** Jumlah maksimum kandidat yang dikembalikan. */
  maks?: number;
  /** Timeout per permintaan. */
  batasMs?: number;
}

export const UA =
  "Uthruha/1.0 (alat bantu penulisan akademik; +https://uthruha.id) tentukan-sumber";

/** Status yang layak dicoba ulang: jaringan putus, timeout, 429, 5xx. */
function bolehUlang(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

const JEDA_ULANG_MS = 350;

async function tidur(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Ambil JSON dengan satu percobaan ulang untuk kegagalan sementara.
 *
 * Penting: tanpa ini, gangguan sesaat pada sumber membuat pencarian
 * dilaporkan "kosong" — padahal sumbernya tidak menjawab. Pengguna lalu
 * menyimpulkan aplikasinya rusak. Kegagalan harus jujur disebut gagal.
 */
export async function ambilJson<T>(url: string, opsi: OpsiAdapter = {}): Promise<T> {
  const batas = opsi.batasMs ?? 9000;
  let terakhir: unknown;

  for (let percobaan = 0; percobaan < 2; percobaan++) {
    const ctl = new AbortController();
    const jam = setTimeout(() => ctl.abort(), batas);
    try {
      const res = await fetch(url, {
        signal: ctl.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": UA,
          ...(opsi.kunci ? { Authorization: `Bearer ${opsi.kunci}` } : {}),
        },
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as T;

      // Gagal yang tidak akan berubah walau diulang (404, 400) → langsung lempar.
      if (!bolehUlang(res.status) || percobaan === 1) {
        throw new Error(`HTTP ${res.status}`);
      }
      terakhir = new Error(`HTTP ${res.status}`);
    } catch (e) {
      terakhir = e;
      if (percobaan === 1) throw e;
    } finally {
      clearTimeout(jam);
    }
    await tidur(JEDA_ULANG_MS);
  }

  throw terakhir instanceof Error ? terakhir : new Error("permintaan gagal");
}

/**
 * POST form-urlencoded, kembalikan HTML.
 *
 * Shamela.ws tidak punya endpoint JSON: pencariannya berjalan lewat
 * `POST /ajax/search` dengan field `term`, dan jawabannya HTML. Endpoint
 * ini hanya mau diakses lewat POST (GET selalu 400 "رجاء التأكد من كتابة
 * عبارة البحث"), jadi tidak bisa memakai ambilTeks().
 */
export async function ambilHtmlPost(
  url: string,
  isian: Record<string, string>,
  opsi: OpsiAdapter & { rujukan?: string } = {},
): Promise<string> {
  const batas = opsi.batasMs ?? 12000;
  const body = new URLSearchParams(isian);

  for (let percobaan = 0; percobaan < 2; percobaan++) {
    const ctl = new AbortController();
    const jam = setTimeout(() => ctl.abort(), batas);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          Accept: "text/html, */*",
          "Accept-Language": "ar,en;q=0.8",
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          ...(opsi.rujukan ? { Referer: opsi.rujukan, Origin: new URL(opsi.rujukan).origin } : {}),
          ...(opsi.kunci ? { Authorization: `Bearer ${opsi.kunci}` } : {}),
        },
        body,
        cache: "no-store",
      });

      // Shamela membalas 400 + HTML bila `term` tidak diterima; itu bukan
      // gangguan sementara, jadi jangan diulang — lempar apa adanya.
      if (res.ok) return await res.text();
      if (!bolehUlang(res.status) || percobaan === 1) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      if (percobaan === 1) throw e;
    } finally {
      clearTimeout(jam);
    }
    await tidur(JEDA_ULANG_MS);
  }

  throw new Error("permintaan gagal");
}

/** Ambil teks biasa (untuk endpoint yang mengembalikan HTML). */
export async function ambilTeks(url: string, opsi: OpsiAdapter = {}): Promise<string> {
  const batas = opsi.batasMs ?? 9000;
  const ctl = new AbortController();
  const jam = setTimeout(() => ctl.abort(), batas);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": UA,
        ...(opsi.kunci ? { Authorization: `Bearer ${opsi.kunci}` } : {}),
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(jam);
  }
}
