/**
 * Label cabang jurnal dari METADATA SUMBER (Tahap G2, 6 Nov 2026).
 *
 * Gerbang jurnal deterministik (gerbangJurnal di
 * lib/engine/kategori-kitab.ts) menilai relasi cabang artikel
 * terhadap topik proyek dari label yang SUMBERNYA sendiri berikan,
 * bukan dari tebakan model. Berkas ini mengambil label itu:
 *
 *  (a) OpenAlex — per kandidat, dari rekod karyanya
 *      (api.openalex.org/works/doi:{doi}, atau pencarian judul bila
 *      DOI tidak ada): primary_topic (display_name + subfield +
 *      field + domain), topics[].display_name, concepts[].display_name
 *      dipetakan ke label cabang oleh labelCabangDariTeks. Abstrak
 *      (abstract_inverted_index) disusun ulang menjadi teks bukti.
 *      Domain utama di sains keras (Physical/Life/Health Sciences)
 *      tanpa bukti Islam apa pun menjadi penanda domainAsingKeras
 *      untuk aturan 3.
 *  (b) DOAJ — subjek jurnal dari ISSN (diambil dari rekod Crossref):
 *      kode LCC yang diawali BP/KBP menandakan DOMAIN Islam (sesuai
 *      peringatan bahan resmi, LCC hanya membuktikan domain, BUKAN
 *      cabang spesifik); istilah subjek dan kata kunci jurnal ikut
 *      masuk kolam teks yang dipetakan ke label cabang.
 *  (c) Nama jurnal kandidat sendiri ikut dipetakan sebagai sumber
 *      label terakhir (di pemanggil lewat kolam yang sama).
 *
 * Semua kegagalan jaringan DIAM: label kosong, abstrak kosong —
 * gerbang yang memutuskan nasib label kosong (aturan 8/9,
 * fail-closed), bukan berkas ini. Hasil bertembolok di memori
 * proses (termasuk hasil kosong) agar verifikasi massal tidak
 * memukul API yang sama berulang kali.
 */
import { labelCabangDariTeks, type LabelKitab } from "@/lib/engine/kategori-kitab";
import { normalisasiJudul } from "@/lib/engine/referensi";

export interface LabelSumber {
  /** Label cabang gabungan dari semua sumber (bisa kosong). */
  label: LabelKitab[];
  /** Abstrak artikel dari rekod OpenAlex, disusun ulang ("" bila
   *  sumber tidak menyediakannya). */
  abstrak: string;
  /** Ada bukti domain Islam (label terbaca, LCC BP/KBP, atau teks
   *  metadata menyebut Islam). */
  domainIslam: boolean;
  /** Domain utama OpenAlex di sains keras DAN tanpa bukti Islam. */
  domainAsingKeras: boolean;
  /** Catatan asal label untuk alasan/log, mis. "OpenAlex: Fiqh". */
  asal: string[];
}

const KOSONG: LabelSumber = {
  label: [],
  abstrak: "",
  domainIslam: false,
  domainAsingKeras: false,
  asal: [],
};

const tembolok = new Map<string, { exp: number; nilai: LabelSumber }>();
const TTL_MS = 6 * 3_600_000;

async function ambilJson(url: string, timeoutMs = 9_000): Promise<unknown | null> {
  const kontrol = new AbortController();
  const t = setTimeout(() => kontrol.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "UthruhaAcademic/1.0 (mailto:peneliti@uthruha.id)",
        Accept: "application/json",
      },
      signal: kontrol.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Susun ulang abstrak dari abstract_inverted_index OpenAlex. */
function susunAbstrak(inv: Record<string, number[]> | undefined | null): string {
  if (!inv) return "";
  const posisi = new Map<number, string>();
  for (const [kata, daftar] of Object.entries(inv)) {
    for (const i of daftar) posisi.set(i, kata);
  }
  const teks = [...posisi.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, kata]) => kata)
    .join(" ");
  return teks.slice(0, 1500);
}

/** Kemiripan judul sederhana (tumpang-tindih token ternormalisasi)
 *  untuk memilih hit pencarian OpenAlex tanpa DOI. */
function kemiripanJudulRingkasan(a: string, b: string): number {
  const ta = new Set(normalisasiJudul(a ?? "").split(" ").filter((t) => t.length >= 3));
  const tb = new Set(normalisasiJudul(b ?? "").split(" ").filter((t) => t.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let sama = 0;
  for (const t of ta) if (tb.has(t)) sama += 1;
  return sama / Math.max(ta.size, tb.size);
}

interface KaryaOpenAlex {
  title?: string;
  primary_topic?: {
    display_name?: string;
    subfield?: { display_name?: string };
    field?: { display_name?: string };
    domain?: { display_name?: string };
  } | null;
  topics?: { display_name?: string }[];
  concepts?: { display_name?: string }[];
  abstract_inverted_index?: Record<string, number[]> | null;
}

const DOMAIN_KERAS = new Set(["Physical Sciences", "Life Sciences", "Health Sciences"]);

function dariKaryaOpenAlex(karya: KaryaOpenAlex, kolam: string[], asal: string[]): {
  abstrak: string;
  domainKeras: boolean;
} {
  const pt = karya.primary_topic ?? undefined;
  for (const teks of [
    pt?.display_name,
    pt?.subfield?.display_name,
    pt?.field?.display_name,
    ...(karya.topics ?? []).map((t) => t.display_name),
    ...(karya.concepts ?? []).map((c) => c.display_name),
  ]) {
    if (teks) kolam.push(teks);
  }
  if (pt?.display_name) asal.push(`OpenAlex: ${pt.display_name}`);
  return {
    abstrak: susunAbstrak(karya.abstract_inverted_index),
    domainKeras: DOMAIN_KERAS.has(pt?.domain?.display_name ?? ""),
  };
}

/** ISSN jurnal dari rekod Crossref (untuk kueri DOAJ). */
async function issnDariCrossref(doi: string): Promise<string[]> {
  const data = (await ambilJson(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}?select=ISSN`,
  )) as { message?: { ISSN?: string[] } } | null;
  return (data?.message?.ISSN ?? []).filter((s) => typeof s === "string").slice(0, 2);
}

/** Subjek DOAJ per ISSN: LCC BP/KBP → domain Islam; istilah subjek
 *  dan kata kunci masuk kolam teks label. */
async function dariDoaj(issn: string, kolam: string[], asal: string[]): Promise<boolean> {
  const data = (await ambilJson(
    `https://doaj.org/api/journals/${encodeURIComponent(issn)}`,
  )) as {
    bibjson?: {
      subject?: { scheme?: string; code?: string; term?: string }[];
      keywords?: string[];
    };
  } | null;
  const bib = data?.bibjson;
  if (!bib) return false;
  let domainIslam = false;
  for (const s of bib.subject ?? []) {
    const kode = (s.code ?? "").trim().toUpperCase();
    if (kode.startsWith("BP") || kode.startsWith("KBP")) domainIslam = true;
    if (s.term) kolam.push(s.term);
  }
  for (const k of bib.keywords ?? []) kolam.push(k);
  if (domainIslam) asal.push(`DOAJ: subjek LCC ${issn} domain Islam (BP/KBP)`);
  return domainIslam;
}

/**
 * Ambil label cabang + abstrak untuk satu kandidat jurnal.
 * Tidak pernah melempar; kegagalan apa pun menghasilkan label
 * kosong (fail-closed di gerbang).
 */
export async function ambilLabelSumber(kandidat: {
  doi?: string;
  judul: string;
  jurnal?: string;
}): Promise<LabelSumber> {
  const kunci = (kandidat.doi?.trim().toLowerCase() || normalisasiJudul(kandidat.judul ?? "")).slice(0, 200);
  if (!kunci) return KOSONG;
  const tersimpan = tembolok.get(kunci);
  if (tersimpan && tersimpan.exp > Date.now()) return tersimpan.nilai;

  const kolam: string[] = [];
  const asal: string[] = [];
  if (kandidat.jurnal) kolam.push(kandidat.jurnal);
  let abstrak = "";
  let domainKeras = false;
  let domainIslamDoaj = false;

  try {
    let karya: KaryaOpenAlex | null = null;
    if (kandidat.doi) {
      karya = (await ambilJson(
        `https://api.openalex.org/works/doi:${encodeURIComponent(kandidat.doi)}`,
      )) as KaryaOpenAlex | null;
    }
    if (!karya && kandidat.judul) {
      const cari = (await ambilJson(
        `https://api.openalex.org/works?search=${encodeURIComponent(kandidat.judul)}&per-page=3`,
      )) as { results?: KaryaOpenAlex[] } | null;
      for (const hit of cari?.results ?? []) {
        if (kemiripanJudulRingkasan(hit.title ?? "", kandidat.judul) >= 0.6) {
          karya = hit;
          break;
        }
      }
    }
    if (karya) {
      const h = dariKaryaOpenAlex(karya, kolam, asal);
      abstrak = h.abstrak;
      domainKeras = h.domainKeras;
    }
    if (kandidat.doi) {
      for (const issn of await issnDariCrossref(kandidat.doi)) {
        if (await dariDoaj(issn, kolam, asal)) domainIslamDoaj = true;
      }
    }
  } catch {
    /* diam: label kosong */
  }

  const label = new Set<LabelKitab>();
  for (const teks of kolam) {
    const l = labelCabangDariTeks(teks);
    if (l) label.add(l);
  }
  const domainIslam =
    label.size > 0 ||
    domainIslamDoaj ||
    kolam.some((t) => /islam/i.test(t));
  const nilai: LabelSumber = {
    label: [...label],
    abstrak,
    domainIslam,
    domainAsingKeras: domainKeras && !domainIslam,
    asal,
  };
  tembolok.set(kunci, { exp: Date.now() + TTL_MS, nilai });
  return nilai;
}
