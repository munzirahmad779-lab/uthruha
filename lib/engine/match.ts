import { BIDANG } from "@/lib/content/bidang";
import { JURNAL } from "@/lib/content/jurnal";
import type { JurnalEntry } from "@/lib/content/types";

const STOP = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "pada", "dalam", "dengan", "adalah",
  "ini", "itu", "atau", "juga", "akan", "tidak", "sebagai", "oleh", "serta", "para",
  "من", "في", "على", "إلى", "عن", "أن", "إن", "التي", "الذي", "هذا", "هذه", "ما",
  "لا", "مع", "بين", "بعد", "قبل", "كل", "بعض", "هو", "هي", "قد", "كان", "يكون",
  "the", "and", "of", "in", "to", "for", "with", "on", "is", "are", "this",
]);

export function tokenkan(teks: string): string[] {
  return teks
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

export interface SkorJurnal {
  jurnal: JurnalEntry;
  skor: number;
  cocok: string[];
}

export function cocokkanJurnal(teks: string, bidangId?: string, batas = 6): SkorJurnal[] {
  const token = new Set(tokenkan(teks));
  const hasil: SkorJurnal[] = JURNAL.map((j) => {
    const bidangJurnal = j.bidang
      .map((b) => BIDANG.find((x) => x.id === b))
      .filter(Boolean) as typeof BIDANG;
    const kataKunci = tokenkan(
      [j.namaLatin, j.namaAr, j.cakupan, ...bidangJurnal.flatMap((b) => [b.labelId, b.labelAr, ...b.keywords])].join(" "),
    );
    const unik = Array.from(new Set(kataKunci));
    const cocok = unik.filter((k) => {
      if (token.has(k)) return true;
      for (const t of token) {
        if (t.length > 4 && (k.includes(t) || t.includes(k))) return true;
      }
      return false;
    });
    let skor = cocok.length * 10;
    if (bidangId && j.bidang.includes(bidangId)) skor += 18;
    if (j.akses === "Terbuka") skor += 2;
    return { jurnal: j, skor, cocok: cocok.slice(0, 6) };
  });
  const max = Math.max(1, ...hasil.map((h) => h.skor));
  return hasil
    .map((h) => ({ ...h, skor: Math.round((h.skor / max) * 100) }))
    .sort((a, b) => b.skor - a.skor)
    .slice(0, batas);
}

export interface FilterJurnal {
  q?: string;
  bidang?: string;
  akses?: string;
  indeks?: string;
}

export function filterJurnal(f: FilterJurnal): JurnalEntry[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return JURNAL.filter((j) => {
    if (f.bidang && !j.bidang.includes(f.bidang)) return false;
    if (f.akses && j.akses !== f.akses) return false;
    if (f.indeks && !j.indeks.some((i) => i.toLowerCase().includes(f.indeks!.toLowerCase()))) return false;
    if (!q) return true;
    return [j.namaLatin, j.namaAr, j.penerbit, j.cakupan, ...j.indeks].join(" ").toLowerCase().includes(q);
  }).sort((a, b) => a.namaLatin.localeCompare(b.namaLatin));
}
