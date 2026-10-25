/**
 * Pencarian TOPIK dari browser (Urutan 3 + C.3).
 * Jurnal: CrossRef (query.bibliographic + filter journal-article) & DOAJ —
 * keduanya CORS * dan sudah/diizinkan CSP. Hasil = DRAF Sumber berlabel
 * sumberImpor; tidak ada yang masuk library tanpa user menekan Tambah.
 * Lokal: BM25 di atas referensi & draf proyek sendiri — jujur disebut
 * "pencarian kata kunci lokal", bekerja penuh offline.
 */
import { sumberBaru, type Sumber } from "@/lib/engine/cite";
import { normalisasiDoi, normalisasiJudul } from "@/lib/engine/referensi";
import type { Project } from "@/lib/engine/project";

export interface KataKunci {
  arab: string[];
  indonesia: string[];
  inggris: string[];
  sumber: string;
}

/** Minta kata kunci ke route server (Groq → Cloudflare → tanpa-AI). */
export async function ekstrakKataKunci(teks: string): Promise<KataKunci> {
  const res = await fetch("/api/kata-kunci", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teks }),
  });
  if (!res.ok) throw new Error("Ekstraksi kata kunci gagal.");
  const d = await res.json();
  return {
    arab: d.arab ?? [],
    indonesia: d.indonesia ?? [],
    inggris: d.inggris ?? [],
    sumber: String(d.sumber ?? "tanpa-ai"),
  };
}

function dariCrossref(it: Record<string, unknown>): Sumber {
  const author = (it.author as { given?: string; family?: string }[]) ?? [];
  const penulisDaftar = author.map((a) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean);
  const issued = (it.issued as { "date-parts"?: number[][] })?.["date-parts"]?.[0]?.[0];
  return {
    ...sumberBaru("artikel"),
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    penulis: penulisDaftar.join(", "),
    penulisDaftar,
    tahun: issued ? String(issued) : "",
    judul: ((it.title as string[]) ?? [])[0] ?? "",
    jurnal: ((it["container-title"] as string[]) ?? [])[0],
    volume: it.volume ? String(it.volume) : undefined,
    nomor: it.issue ? String(it.issue) : undefined,
    halaman: it.page ? String(it.page) : undefined,
    doi: it.DOI ? String(it.DOI) : undefined,
    url: it.URL ? String(it.URL) : undefined,
    sumberImpor: "crossref",
    perluVerifikasi: false,
  };
}

function dariDoaj(r: Record<string, unknown>): Sumber {
  const b = (r.bibjson ?? {}) as Record<string, unknown>;
  const penulisDaftar = ((b.author as { name?: string }[]) ?? []).map((a) => a.name ?? "").filter(Boolean);
  const doi = ((b.identifier as { type?: string; id?: string }[]) ?? []).find((i) => i.type === "doi")?.id;
  return {
    ...sumberBaru("artikel"),
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    penulis: penulisDaftar.join(", "),
    penulisDaftar,
    tahun: b.year ? String(b.year) : "",
    judul: String(b.title ?? ""),
    jurnal: (b.journal as { title?: string })?.title,
    doi,
    url: ((b.link as { url?: string }[]) ?? [])[0]?.url,
    sumberImpor: "doaj",
    perluVerifikasi: false,
  };
}

export interface HasilJurnal {
  entri: Sumber[];
  status: { sumber: string; ok: boolean; pesan?: string }[];
}

/** Cari jurnal dari gabungan kata kunci (Inggris+Indonesia+Arab teratas). */
export async function cariJurnalTopik(kk: KataKunci, perSumber = 8): Promise<HasilJurnal> {
  const q = [kk.inggris[0], kk.indonesia[0], kk.arab[0]].filter(Boolean).join(" ");
  const qDoaj = [kk.indonesia[0], kk.indonesia[1]].filter(Boolean).join(" ") || q;
  const status: HasilJurnal["status"] = [];
  const semua: Sumber[] = [];

  const tugas: Promise<void>[] = [
    (async () => {
      try {
        const params = new URLSearchParams({
          "query.bibliographic": q,
          rows: String(perSumber),
          filter: "type:journal-article",
          select: "title,author,issued,container-title,DOI,URL,volume,issue,page",
        });
        const res = await fetch(`https://api.crossref.org/works?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = (await res.json())?.message?.items ?? [];
        semua.push(...items.map(dariCrossref));
        status.push({ sumber: "crossref", ok: true });
      } catch (e) {
        status.push({ sumber: "crossref", ok: false, pesan: e instanceof Error ? e.message : "gagal" });
      }
    })(),
    (async () => {
      try {
        const res = await fetch(`https://doaj.org/api/search/articles/${encodeURIComponent(qDoaj)}?pageSize=${perSumber}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        semua.push(...(data.results ?? []).map(dariDoaj));
        status.push({ sumber: "doaj", ok: true });
      } catch (e) {
        status.push({ sumber: "doaj", ok: false, pesan: e instanceof Error ? e.message : "gagal" });
      }
    })(),
  ];
  await Promise.all(tugas);

  // Dedup DOI exact lalu judul ternormalisasi.
  const terlihat = new Set<string>();
  const entri = semua.filter((s) => {
    const kunci = normalisasiDoi(s.doi) ? `doi:${normalisasiDoi(s.doi)}` : `judul:${normalisasiJudul(s.judul)}|${s.tahun}`;
    if (terlihat.has(kunci)) return false;
    terlihat.add(kunci);
    return true;
  });
  return { entri, status };
}

/* ---------------- BM25 lokal (pencarian kata kunci, offline) ---------------- */

function token(teks: string): string[] {
  return teks
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2);
}

export interface HasilLokal {
  sumber?: Sumber;
  sectionId?: string;
  cuplikan: string;
  skor: number;
}

/** BM25 sederhana di atas referensi + draf milik user sendiri. */
export function cariLokalBM25(kueri: string, p: Project, maks = 10): HasilLokal[] {
  const dok: { teks: string; sumber?: Sumber; sectionId?: string }[] = [
    ...p.sumber.map((s) => ({
      teks: [s.judul, s.penulis, s.jurnal ?? "", s.tahun].join(" "),
      sumber: s,
    })),
    ...Object.entries(p.draf).map(([id, teks]) => ({ teks, sectionId: id })),
  ];
  const tokenDok = dok.map((d) => token(d.teks));
  const N = dok.length;
  if (N === 0) return [];
  const panjangRata = tokenDok.reduce((a, b) => a + b.length, 0) / N || 1;
  const df = new Map<string, number>();
  for (const td of tokenDok) for (const t of new Set(td)) df.set(t, (df.get(t) ?? 0) + 1);
  const q = [...new Set(token(kueri))];
  const k1 = 1.5;
  const b = 0.75;

  const hasil: HasilLokal[] = [];
  dok.forEach((d, i) => {
    const td = tokenDok[i];
    const tf = new Map<string, number>();
    for (const t of td) tf.set(t, (tf.get(t) ?? 0) + 1);
    let skor = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      skor += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * td.length) / panjangRata)));
    }
    if (skor > 0) {
      hasil.push({
        sumber: d.sumber,
        sectionId: d.sectionId,
        cuplikan: d.sumber ? `${d.sumber.judul} — ${d.sumber.penulis}` : d.teks.slice(0, 140),
        skor: Number(skor.toFixed(3)),
      });
    }
  });
  return hasil.sort((a, c) => c.skor - a.skor).slice(0, maks);
}

/** Parser tempelan sitasi dari situs sumber (C.11): pola Arab ج/ص + tahun. */
export function parseTempelanSitasi(teks: string): Sumber {
  const jilid = teks.match(/ج\s*(\d+)/)?.[1];
  const halaman = teks.match(/ص\s*(\d+)/)?.[1];
  const tahun = teks.match(/\b(1[3-9]\d{2}|20\d{2})\b/)?.[1];
  const bersih = teks
    .replace(/ج\s*\d+\s*،?\s*/g, "")
    .replace(/ص\s*\d+\s*،?\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const potong = bersih.split("،").map((x) => x.trim()).filter(Boolean);
  return {
    ...sumberBaru("kitab"),
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    penulis: potong.length >= 2 ? potong[0] : "",
    judul: potong.length >= 2 ? potong.slice(1).join("، ") : bersih,
    tahun: tahun ?? "",
    jilid,
    halaman,
    sumberImpor: "tempel",
    perluVerifikasi: true,
  };
}
