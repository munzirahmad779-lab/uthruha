/**
 * BM25 murni (tanpa AI) untuk menyisipkan rujukan ke kalimat yang paling
 * cocok di dalam paragraf — dipakai tombol "kembangkan" pada uji coba tamu
 * dan panel pengembangan. Kode klasik, nol biaya model.
 */

const KATA_HENTI = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "pada", "dengan", "dalam",
  "adalah", "ini", "itu", "atau", "sebagai", "oleh", "tidak", "akan",
  "the", "of", "and", "in", "to", "a", "an", "for", "on", "is", "are",
  "في", "من", "إلى", "على", "أن", "إن", "ما", "لا", "هو", "هي", "كان",
  "ذو", "ذات", "بين", "عند", "لدى", "غير", "كل", "أي", "عن", "بعد", "قبل",
]);

export function tokenisasi(teks: string): string[] {
  return teks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^(ال)/, "")) // lepas al- ta'rif untuk padanan kasar
    .filter((t) => t.length >= 3 && !KATA_HENTI.has(t));
}

interface Dok {
  token: string[];
  panjang: number;
}

/** Skor BM25 satu dokumen terhadap kueri token. */
export function skorBM25(kueri: string[], dok: Dok, idf: Map<string, number>, rataPanjang: number): number {
  const k1 = 1.5;
  const b = 0.75;
  const freq = new Map<string, number>();
  for (const t of dok.token) freq.set(t, (freq.get(t) ?? 0) + 1);
  let skor = 0;
  for (const t of new Set(kueri)) {
    const f = freq.get(t) ?? 0;
    if (f === 0) continue;
    const w = idf.get(t) ?? 0;
    skor += w * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * dok.panjang) / Math.max(1, rataPanjang))));
  }
  return skor;
}

export interface LampiranRujukan {
  refId: string;
  paragrafIdx: number;
  kalimatIdx: number;
  skor: number;
}

/**
 * Tempelkan tiap rujukan ke kalimat dengan skor BM25 tertinggi.
 * Mengembalikan lampiran + paragraf baru dengan penanda [[fn:<refId>]]
 * di akhir kalimat terpilih.
 */
export function sisipkanRujukan(
  paragraf: string[],
  rujukan: { id: string; teksPadanan: string }[],
): { paragrafBaru: string[]; lampiran: LampiranRujukan[] } {
  // Pecah paragraf menjadi kalimat (Arab/Indonesia/Inggris).
  const kalimatPer: string[][] = paragraf.map((p) =>
    p
      .split(/(?<=[.!؟?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const semuaKalimat: { p: number; k: number; teks: string }[] = [];
  kalimatPer.forEach((arr, p) => arr.forEach((teks, k) => semuaKalimat.push({ p, k, teks })));

  const doks: Dok[] = semuaKalimat.map((s) => {
    const token = tokenisasi(s.teks);
    return { token, panjang: token.length };
  });
  const rata = doks.reduce((a, d) => a + d.panjang, 0) / Math.max(1, doks.length);
  const df = new Map<string, number>();
  for (const d of doks) for (const t of new Set(d.token)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, n] of df) idf.set(t, Math.log(1 + (doks.length - n + 0.5) / (n + 0.5)));

  const lampiran: LampiranRujukan[] = [];
  const penanda = new Map<string, string[]>(); // "p:k" -> refId[]
  for (const r of rujukan) {
    const q = tokenisasi(r.teksPadanan);
    if (q.length === 0) continue;
    let terbaik = -1;
    let skorTerbaik = 0;
    doks.forEach((d, i) => {
      const s = skorBM25(q, d, idf, rata);
      if (s > skorTerbaik) {
        skorTerbaik = s;
        terbaik = i;
      }
    });
    if (terbaik < 0 || skorTerbaik <= 0) continue;
    const sel = semuaKalimat[terbaik]!;
    lampiran.push({ refId: r.id, paragrafIdx: sel.p, kalimatIdx: sel.k, skor: Math.round(skorTerbaik * 100) / 100 });
    const kunci = `${sel.p}:${sel.k}`;
    (penanda.get(kunci) ?? penanda.set(kunci, []).get(kunci)!).push(r.id);
  }

  const paragrafBaru = kalimatPer.map((arr, p) =>
    arr
      .map((kal, k) => {
        const refs = penanda.get(`${p}:${k}`);
        return refs ? `${kal} ${refs.map((id) => `[[fn:${id}]]`).join(" ")}` : kal;
      })
      .join(" "),
  );
  return { paragrafBaru, lampiran };
}
