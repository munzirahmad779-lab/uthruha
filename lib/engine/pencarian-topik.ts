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

/** Minta kalimat kunci (frasa kunci, BUKAN kata lepas) ke route server (Groq → Cloudflare → tanpa-AI). */
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


/** Petakan satu work OpenAlex menjadi Sumber artikel. */
function dariOpenAlex(w: Record<string, unknown>): Sumber {
  const biblio = (w.biblio ?? {}) as Record<string, string | undefined>;
  const penulisDaftar = ((w.authorships as { author?: { display_name?: string } }[]) ?? [])
    .map((a) => a.author?.display_name ?? "")
    .filter(Boolean);
  const loc = (w.primary_location as { source?: { display_name?: string }; landing_page_url?: string } | null) ?? null;
  const hal = biblio.first_page
    ? biblio.last_page && biblio.last_page !== biblio.first_page
      ? `${biblio.first_page}-${biblio.last_page}`
      : biblio.first_page
    : undefined;
  return {
    ...sumberBaru("artikel"),
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    penulis: penulisDaftar.join(", "),
    penulisDaftar,
    tahun: w.publication_year ? String(w.publication_year) : "",
    judul: String(w.title ?? ""),
    jurnal: loc?.source?.display_name,
    volume: biblio.volume,
    nomor: biblio.issue,
    halaman: hal,
    doi: typeof w.doi === "string" ? w.doi.replace(/^https?:\/\/doi\.org\//, "") : undefined,
    url: loc?.landing_page_url ?? (typeof w.doi === "string" ? w.doi : undefined),
    sumberImpor: "openalex",
    perluVerifikasi: false,
  };
}

/** Petakan satu paper Semantic Scholar menjadi Sumber artikel. */
function dariSemanticScholar(p: Record<string, unknown>): Sumber {
  const penulisDaftar = ((p.authors as { name?: string }[]) ?? []).map((a) => a.name ?? "").filter(Boolean);
  const ext = (p.externalIds as { DOI?: string } | undefined) ?? undefined;
  return {
    ...sumberBaru("artikel"),
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    penulis: penulisDaftar.join(", "),
    penulisDaftar,
    tahun: p.year ? String(p.year) : "",
    judul: String(p.title ?? ""),
    jurnal: typeof p.venue === "string" && p.venue ? p.venue : undefined,
    doi: ext?.DOI,
    sumberImpor: "semanticscholar",
    perluVerifikasi: false,
  };
}

export interface HasilJurnal {
  entri: Sumber[];
  status: { sumber: string; ok: boolean; pesan?: string }[];
}

/** Cari jurnal dari gabungan kata kunci (Inggris+Indonesia+Arab teratas). */
export async function cariJurnalTopik(kk: KataKunci, perSumber = 10): Promise<HasilJurnal> {
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
        const res = await fetch(
          `https://api.openalex.org/works?search=${encodeURIComponent(q)}&filter=type:article&per-page=${perSumber}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        semua.push(...((data.results ?? []) as Record<string, unknown>[]).map(dariOpenAlex));
        status.push({ sumber: "openalex", ok: true });
      } catch (e) {
        status.push({ sumber: "openalex", ok: false, pesan: e instanceof Error ? e.message : "gagal" });
      }
    })(),
    (async () => {
      try {
        const res = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${perSumber}&fields=title,authors,year,venue,externalIds`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        semua.push(...((data.data ?? []) as Record<string, unknown>[]).map(dariSemanticScholar));
        status.push({ sumber: "semanticscholar", ok: true });
      } catch (e) {
        status.push({ sumber: "semanticscholar", ok: false, pesan: e instanceof Error ? e.message : "gagal" });
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

  // Dedup DOI exact lalu judul ternormalisasi; tampung maksimal 15 jurnal.
  const terlihat = new Set<string>();
  const entri = semua
    .filter((s) => {
      const kunci = normalisasiDoi(s.doi) ? `doi:${normalisasiDoi(s.doi)}` : `judul:${normalisasiJudul(s.judul)}|${s.tahun}`;
      if (terlihat.has(kunci)) return false;
      terlihat.add(kunci);
      return true;
    })
    .slice(0, 15);
  return { entri, status };
}

export interface HitKitabMentah {
  id: string;
  source: string;
  kitab: string;
  penulis?: string;
  jilid?: number;
  halaman_cetak?: number;
  teks_kutipan: string;
  url_sumber: string;
  perluVerifikasi: boolean;
}

/**
 * Pencarian kitab per KALIMAT KUNCI (rancangan awal Uthruha: yang dicari adalah
 * kalimat/frasa kunci, bukan kata lepas — kata lepas terlalu umum).
 * Tiap kalimat kunci Arab dikirim sebagai satu kalimat ke route refs
 * (pencocokan frasa di Turath/Shamela), hasil digabung & didedup per halaman.
 */
export async function cariKitabKalimat(
  kalimatKunciArab: string[],
  cadangan: string,
): Promise<{ hits: HitKitabMentah[]; frasaDipakai: string[] }> {
  const frasa = (kalimatKunciArab.length > 0 ? kalimatKunciArab : [cadangan]).slice(0, 3);
  const semua: HitKitabMentah[] = [];
  for (const f of frasa) {
    try {
      const res = await fetch("/api/refs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentences: [f], mode: "kata" }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      semua.push(...((data.hasil ?? []) as HitKitabMentah[]));
    } catch {
      /* satu frasa gagal tidak mematikan frasa lain */
    }
  }
  const terlihat = new Set<string>();
  // Tampung maksimal 20 hasil kitab (gabungan semua frasa & sumber).
  const hits = semua
    .filter((h) => {
      const kunci = `${h.url_sumber}|${h.kitab}|${h.halaman_cetak ?? ""}`;
      if (terlihat.has(kunci)) return false;
      terlihat.add(kunci);
      return true;
    })
    .slice(0, 20);
  return { hits, frasaDipakai: frasa };
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
