/**
 * ISBN sejajar DOI: validasi digit pemeriksa lokal (tanpa biaya API),
 * lalu verifikasi keberadaan kitab di Open Library → Google Books.
 * ISBN yang digit pemeriksanya salah PASTI fiktif/salah ketik — ditolak
 * sebelum panggilan jaringan apa pun.
 */

export function bersihkanISBN(mentah: string): string {
  return mentah.replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function isbnSah(mentah: string): boolean {
  const s = bersihkanISBN(mentah);
  if (s.length === 10) {
    let total = 0;
    for (let i = 0; i < 10; i += 1) {
      const c = s[i]!;
      const d = c === "X" ? 10 : Number(c);
      if (Number.isNaN(d)) return false;
      total += d * (10 - i);
    }
    return total % 11 === 0;
  }
  if (s.length === 13) {
    if (!/^\d{13}$/.test(s)) return false;
    let total = 0;
    for (let i = 0; i < 13; i += 1) total += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
    return total % 10 === 0;
  }
  return false;
}

/** Konversi ISBN-10 → ISBN-13 (awalan 978 + digit pemeriksa baru). */
export function keISBN13(mentah: string): string | null {
  const s = bersihkanISBN(mentah);
  if (s.length === 13 && isbnSah(s)) return s;
  if (s.length !== 10 || !isbnSah(s)) return null;
  const inti = `978${s.slice(0, 9)}`;
  let total = 0;
  for (let i = 0; i < 12; i += 1) total += Number(inti[i]) * (i % 2 === 0 ? 1 : 3);
  return `${inti}${(10 - (total % 10)) % 10}`;
}

export interface MetaKitab {
  judul: string;
  pengarang: string[];
  penerbit: string;
  tahun: string;
  isbn: string;
  sumberVerifikasi: "openlibrary" | "googlebooks";
}

const UA = "Uthruha/1.0 (verifikasi ISBN; +https://uthruha.vercel.app)";

/** Verifikasi ISBN ke katalog buku. Null = tidak ditemukan di keduanya. */
export async function verifikasiISBN(mentah: string): Promise<MetaKitab | null> {
  const isbn13 = keISBN13(mentah);
  if (!isbn13) return null;
  // 1) Open Library — tanpa kunci.
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn13}.json`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const j = (await res.json()) as Record<string, unknown>;
      const judul = typeof j.title === "string" ? j.title : "";
      if (judul) {
        let pengarang: string[] = [];
        const authorKeys = (j.authors as { key?: string }[] | undefined) ?? [];
        for (const a of authorKeys.slice(0, 3)) {
          if (!a.key) continue;
          try {
            const ra = await fetch(`https://openlibrary.org${a.key}.json`, {
              headers: { "User-Agent": UA },
              cache: "no-store",
              signal: AbortSignal.timeout(8_000),
            });
            if (ra.ok) {
              const ja = (await ra.json()) as { name?: string };
              if (ja.name) pengarang.push(ja.name);
            }
          } catch { /* nama pengarang opsional */ }
        }
        return {
          judul,
          pengarang,
          penerbit: Array.isArray(j.publishers) ? String(j.publishers[0] ?? "") : "",
          tahun: typeof j.publish_date === "string" ? j.publish_date.replace(/\D/g, "").slice(-4) : "",
          isbn: isbn13,
          sumberVerifikasi: "openlibrary",
        };
      }
    }
  } catch { /* lanjut ke Google Books */ }
  // 2) Google Books — kata kunci isbn:.
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}`,
      { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(12_000) },
    );
    if (res.ok) {
      const j = (await res.json()) as {
        items?: { volumeInfo?: Record<string, unknown> }[];
      };
      const info = j.items?.[0]?.volumeInfo;
      if (info && typeof info.title === "string") {
        return {
          judul: info.title,
          pengarang: Array.isArray(info.authors) ? info.authors.map(String) : [],
          penerbit: typeof info.publisher === "string" ? info.publisher : "",
          tahun: typeof info.publishedDate === "string" ? info.publishedDate.slice(0, 4) : "",
          isbn: isbn13,
          sumberVerifikasi: "googlebooks",
        };
      }
    }
  } catch { /* tidak ditemukan */ }
  return null;
}
