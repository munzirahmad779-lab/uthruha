/**
 * Normalisasi item JSON dari sumber mana pun ke RefCandidate.
 * Bentuk respons tiap penyedia berbeda; parser ini toleran terhadap nama
 * kolom yang lazim (book_name/title/kitab, author/penulis, vol/jilid,
 * page/halaman, text/snippet/kutipan, url/link) agar adapter tinggal
 * menunjuk satu endpoint ketika penyedia mengonfirmasi akses.
 */
import type { AdapterMode, RefCandidate, SourceId } from "@/lib/refs/types";
import { bersihkanKutipan, skorMirip } from "@/lib/refs/score";

type Bebas = Record<string, unknown>;

function teks(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function angka(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function ambil(obj: Bebas, kunci: string[]): unknown {
  for (const k of kunci) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

export function dariItemJson(
  source: SourceId,
  item: Bebas,
  kalimat: string,
  mode: AdapterMode,
  dasarUrl?: string,
): RefCandidate | null {
  const kutipanMentah =
    teks(ambil(item, ["text", "snippet", "snip", "kutipan", "content", "excerpt", "quote"])) ?? "";
  const kutipan = bersihkanKutipan(kutipanMentah);
  if (!kutipan) return null;

  const judul = teks(ambil(item, ["book_name", "kitab", "title", "book", "judul"])) ?? "";
  const penulis = teks(ambil(item, ["author_name", "author", "penulis", "muallif"]));
  const jilid = angka(ambil(item, ["vol", "volume", "jilid", "part"]));
  const halaman = angka(ambil(item, ["page", "halaman", "print_page", "page_number"]));
  const digital = angka(ambil(item, ["page_id", "digital_page", "pdf_page"]));
  const penerbit = teks(ambil(item, ["publisher", "penerbit", "dar"]));
  const kota = teks(ambil(item, ["city", "kota", "place"]));
  const tahun = angka(ambil(item, ["year", "tahun", "date"]));
  const urlItem = teks(ambil(item, ["url", "link", "url_sumber", "permalink"]));

  const skor = skorMirip(kalimat, kutipan);

  const kurang: string[] = [];
  if (!judul) kurang.push("nama kitab");
  if (!penulis) kurang.push("penulis");
  if (!penerbit) kurang.push("penerbit");
  if (!tahun) kurang.push("tahun");
  if (!kota) kurang.push("kota");

  return {
    source,
    kitab: judul || "[ ! verifikasi ]",
    penulis,
    jilid,
    halaman_cetak: halaman,
    halaman_digital: digital,
    penerbit,
    kota,
    tahun,
    teks_kutipan: kutipan,
    url_sumber: urlItem ?? dasarUrl ?? `https://${source}.example/`,
    skor: Number(skor.toFixed(3)),
    mode,
    perluVerifikasi: kurang.length > 0,
    catatanVerifikasi: kurang.length
      ? `Sumber ini tidak mengirim ${kurang.join(", ")}. Lengkapi manual sebelum dipakai.`
      : undefined,
  };
}

/** Ambil larik item dari respons JSON yang bentuk luarnya tidak seragam. */
export function larikItem(json: unknown): Bebas[] {
  if (Array.isArray(json)) return json.filter((x): x is Bebas => typeof x === "object" && x !== null);
  if (json && typeof json === "object") {
    const o = json as Bebas;
    for (const k of ["data", "results", "items", "hits", "documents", "docs"]) {
      const v = o[k];
      if (Array.isArray(v)) return v.filter((x): x is Bebas => typeof x === "object" && x !== null);
    }
  }
  return [];
}
