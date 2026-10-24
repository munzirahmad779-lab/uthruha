/**
 * Pembatas laju + penentuan IP klien yang tidak bisa dipalsukan.
 *
 * Tiga cacat pada versi lama yang diperbaiki di sini:
 *
 *  1. `x-forwarded-for` diambil elemen PERTAMA. Header itu ditulis klien dan
 *     boleh berisi apa saja, jadi penyerang cukup mengubahnya setiap kali
 *     untuk mendapat jatah tak terbatas. Sekarang urutannya:
 *     `cf-connecting-ip` (diisi Cloudflare, tidak bisa dipalsukan lewat origin)
 *     → `x-real-ip` (diisi reverse proxy sendiri) → XFF elemen TERAKHIR
 *     (yang ditambahkan proxy terdekat) → "lokal".
 *
 *  2. `Map` jejak tumbuh tanpa batas → kebocoran memori pada server yang
 *     hidup lama. Sekarang ada penyapuan berkala.
 *
 *  3. Satu dimensi saja (IP). Sekarang dua dimensi: IP dan kunci akses,
 *     plus batas global agar pemutaran header tidak menolong.
 */

interface Catatan {
  n: number;
  mulai: number;
}

const jejak = new Map<string, Catatan>();
let terakhirSapu = 0;

/** Buang catatan kedaluwarsa agar Map tidak tumbuh selamanya. */
function sapu(jendelaMs: number, sekarang: number): void {
  if (sekarang - terakhirSapu < 60_000) return;
  terakhirSapu = sekarang;
  for (const [k, v] of jejak) {
    if (sekarang - v.mulai > jendelaMs) jejak.delete(k);
  }
}

/**
 * IP klien yang layak dipercaya.
 * Urutan mengikuti apa yang benar-benar bisa dipercaya di belakang tunnel.
 */
export function ipKlien(req: Request): string {
  const h = req.headers;

  // Cloudflare Tunnel menyetel header ini di edge; origin tidak bisa dipalsukan
  // karena hanya tunnel yang boleh menghubungi origin.
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);

  const nyata = h.get("x-real-ip")?.trim();
  if (nyata) return nyata.slice(0, 64);

  // XFF berbentuk "klien, proxy1, proxy2". Elemen terakhir ditambahkan oleh
  // proxy terdekat dan paling sulit dipalsukan dari sisi klien.
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const bagian = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (bagian.length > 0) return bagian[bagian.length - 1].slice(0, 64);
  }

  return "lokal";
}

/** Periksa apakah permintaan masih dalam jatah. */
export function bolehLaju(
  kunci: string,
  batas: number,
  jendelaMs: number,
  sekarang = Date.now(),
): { boleh: boolean; sisa: number; ulangDetik: number } {
  sapu(jendelaMs, sekarang);

  const rec = jejak.get(kunci);
  if (!rec || sekarang - rec.mulai > jendelaMs) {
    jejak.set(kunci, { n: 1, mulai: sekarang });
    return { boleh: true, sisa: batas - 1, ulangDetik: 0 };
  }

  rec.n += 1;
  const boleh = rec.n <= batas;
  const ulangDetik = boleh ? 0 : Math.ceil((jendelaMs - (sekarang - rec.mulai)) / 1000);
  return { boleh, sisa: Math.max(0, batas - rec.n), ulangDetik };
}

/** Balasan 429 baku dengan header Retry-After. */
export function balasanLaju(ulangDetik: number, pesan: string): Response {
  return new Response(JSON.stringify({ error: pesan }), {
    status: 429,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Retry-After": String(Math.max(1, ulangDetik)),
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Tolak permintaan tulis yang datang dari situs lain.
 *
 * Content-Type: application/json sudah memaksa preflight di peramban, tetapi
 * pemeriksaan Origin menutup klien non-peramban yang tetap mengirim POST.
 * Bila Origin tidak ada (curl/server-ke-server), permintaan diloloskan —
 * gerbang kunci akseslah yang menjadi pertahanan utamanya.
 */
export function asalSah(req: Request): boolean {
  const asal = req.headers.get("origin");
  if (!asal) return true; // bukan peramban; dijaga lapisan kunci akses
  try {
    const u = new URL(asal);
    const host = req.headers.get("host");
    if (host && u.host === host) return true;
    // Di belakang Cloudflare, Host asli bisa berbeda dari host tunnel.
    const maju = req.headers.get("x-forwarded-host");
    if (maju && u.host === maju.split(",")[0]!.trim()) return true;
    return false;
  } catch {
    return false;
  }
}
