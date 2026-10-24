/**
 * Normalisasi dan skoring teks Arab untuk pencocokan rujukan.
 * Murni deterministik: tidak ada model bahasa, hasil bisa dihitung ulang.
 */

const HARAKAT = /[\u064B-\u0652\u0670\u0640]/g;

/** Bentuk pencarian: buang harakat & tatweel, satukan varian huruf. */
export function normalisasi(teks: string): string {
  return teks
    .replace(HARAKAT, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // أ إ آ ٱ → ا
    .replace(/\u0649/g, "\u064A") // ى → ي
    .replace(/\u0629/g, "\u0647") // ة → ه
    .replace(/\u0624/g, "\u0648") // ؤ → و
    .replace(/\u0626/g, "\u064A") // ئ → ي
    .replace(/[\u060C\u061B\u061F\u066B\u066C.,;:!?"'«»()\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kata bermakna: buang kata fungsi yang muncul di hampir semua kitab. */
const STOP = new Set(
  [
    "في",
    "من",
    "على",
    "الى",
    "عن",
    "ان",
    "أن",
    "إن",
    "كان",
    "قد",
    "ما",
    "لا",
    "هذا",
    "هذه",
    "ذلك",
    "التي",
    "الذي",
    "ثم",
    "او",
    "أو",
    "و",
    "ب",
    "ل",
    "ك",
    "ف",
    "هو",
    "هي",
    "به",
    "له",
    "بها",
    "لها",
    "منه",
    "عليه",
    "فيه",
    "بين",
    "كل",
    "بعض",
    "غير",
    "كما",
    "اذا",
    "إذا",
    "حتى",
    "ولم",
    "لم",
    "لن",
    "ولا",
    "ومن",
    "وفي",
    "وعلى",
  ].map((s) => normalisasi(s)),
);

export function tokenkan(teks: string): string[] {
  const n = normalisasi(teks);
  if (!n) return [];
  return n
    .split(" ")
    .map((t) => t.replace(/^ال(?=[\u0621-\u064A]{2,})/u, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function himpunan(tokens: string[]): Set<string> {
  return new Set(tokens);
}

/** Skor 0..1: irisan token / token kueri, dengan bonus frasa persis. */
export function skorMirip(kueri: string, kutipan: string): number {
  const a = tokenkan(kueri);
  const b = tokenkan(kutipan);
  if (a.length === 0 || b.length === 0) return 0;

  const sb = himpunan(b);
  let cocok = 0;
  for (const t of himpunan(a)) if (sb.has(t)) cocok++;
  const irisan = cocok / himpunan(a).size;

  // Bonus bila deret 3 kata kueri muncul utuh di kutipan.
  const na = normalisasi(kueri);
  const nb = normalisasi(kutipan);
  let bonus = 0;
  if (na.length >= 12 && nb.includes(na)) bonus = 0.35;
  else {
    const kata = na.split(" ");
    for (let i = 0; i + 3 <= kata.length; i++) {
      const potongan = kata.slice(i, i + 3).join(" ");
      if (potongan.length > 8 && nb.includes(potongan)) {
        bonus = 0.18;
        break;
      }
    }
  }

  // Penalti panjang: kutipan yang jauh lebih panjang dari kueri bukan
  // kecocokan kalimat, hanya halaman yang memuat kata-kata itu.
  const rasio = Math.min(1, a.length / Math.max(1, b.length));
  return Math.max(0, Math.min(1, irisan * (0.55 + 0.45 * rasio) + bonus));
}

/** Bersihkan teks kutipan dari markup sumber (Turath menandai <em>). */
export function bersihkanKutipan(teks: string): string {
  return teks
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
