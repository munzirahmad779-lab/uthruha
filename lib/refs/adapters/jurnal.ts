/**
 * Adapter Crossref & OpenAlex — Sumber Jurnal Ilmiah Akademik Berbahasa Arab.
 * Mengembalikan artikel jurnal bereputasi lengkap dengan DOI, nama jurnal, dan tautan.
 *
 * Skor TIDAK lagi konstan: dulu semua item Crossref diberi 0,88 apa pun
 * isinya, sehingga entri perangkat lunak pun tampil seolah artikel kuat.
 * Sekarang skor dihitung per item dari skor relevansi Crossref (bila
 * ada) dipadukan tumpang-tindih token judul terhadap kueri, dan hanya
 * jenis journal-article / proceedings-article yang diterima.
 */
import type { RefCandidate } from "@/lib/refs/types";
import { type OpsiAdapter } from "@/lib/refs/adapters/http";
import { tokenkan } from "@/lib/refs/score";

export const info = {
  id: "jurnal" as const,
  mode: "api" as const,
  nama: "Jurnal Akademik (Crossref & OpenAlex)",
  api: "Terbuka (REST API tanpa key)",
};

/** Jenis Crossref yang benar-benar artikel ilmiah. Jenis lain (book,
 *  dataset, component, reference-entry, report, dan sejenisnya) bukan
 *  artikel jurnal dan tidak boleh tampil sebagai hasil jurnal. */
export const JENIS_ARTIKEL_CROSSREF = new Set(["journal-article", "proceedings-article"]);

/**
 * True bila judul menunjukkan entri PERANGKAT LUNAK atau rilisan program,
 * bukan artikel. Kasus nyata: "المكتبة الشاملة الإصدار 5" pernah lolos
 * sebagai artikel jurnal berskor tinggi.
 */
export function apakahJudulPerangkatLunak(judul: string): boolean {
  const j = (judul ?? "").toLowerCase();
  if (!j.trim()) return false;
  if (j.includes("المكتبة الشاملة") && j.includes("إصدار")) return true;
  if (j.includes("برنامج") && j.includes("إصدار")) return true;
  if (/\bsoftware\b/.test(j)) return true;
  if (/\b(program|software) release\b/.test(j)) return true;
  if (j.includes("perangkat lunak")) return true;
  return false;
}

/** Token bermakna dari teks, konsisten dengan tokenisasi repo (lib/refs/score). */
function tokenTeks(teks: string): Set<string> {
  return new Set(tokenkan((teks ?? "").toLowerCase()));
}

/**
 * Tumpang-tindih token judul terhadap kueri: token judul yang muncul di
 * kueri dibagi jumlah token judul (gaya yang sama dengan skor relevansi
 * di lib/server/rujukan.ts). 0..1.
 */
export function skorTumpangTindihJudul(judul: string, kueri: string): number {
  const tJudul = tokenTeks(judul);
  const tKueri = tokenTeks(kueri);
  if (tJudul.size === 0 || tKueri.size === 0) return 0;
  let sama = 0;
  for (const t of tJudul) if (tKueri.has(t)) sama += 1;
  return sama / tJudul.size;
}

/**
 * Skor akhir satu item Crossref, 0..1 dan berbeda antar item.
 * Skor Crossref mentah tidak berskala tetap (belasan sampai ratusan),
 * jadi dinormalkan dengan kurva jenuh skor/(skor+40): skor 40 Crossref
 * bernilai 0,5. Bila Crossref tidak memberi skor, dipakai tumpang-tindih
 * token murni.
 */
export function hitungSkorJurnal(judul: string, kueri: string, skorCrossref?: number): number {
  const tumpang = skorTumpangTindihJudul(judul, kueri);
  if (typeof skorCrossref === "number" && Number.isFinite(skorCrossref) && skorCrossref > 0) {
    const norm = skorCrossref / (skorCrossref + 40);
    return Number(Math.min(1, Math.max(0, 0.5 * norm + 0.5 * tumpang)).toFixed(3));
  }
  return Number(tumpang.toFixed(3));
}

interface CrossrefItem {
  title?: string[];
  "container-title"?: string[];
  author?: { given?: string; family?: string }[];
  DOI?: string;
  URL?: string;
  type?: string;
  score?: number;
  publisher?: string;
  volume?: string;
  issue?: string;
  published?: { "date-parts"?: number[][] };
}

interface CrossrefResponse {
  message?: {
    items?: CrossrefItem[];
  };
}

export async function cariJurnal(
  kueri: string,
  opsi: OpsiAdapter = {},
): Promise<RefCandidate[]> {
  const maks = opsi.maks ?? 5;
  const kata = kueri.trim();
  if (!kata) return [];

  const out: RefCandidate[] = [];

  // 1. Panggil Crossref API
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(kata)}&rows=${maks}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "UthruhaAcademic/1.0 (mailto:peneliti@uthruha.id)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = (await res.json()) as CrossrefResponse;
      const items = data.message?.items ?? [];

      for (const it of items) {
        const judul = it.title?.[0]?.trim();
        if (!judul) continue;
        // Hanya artikel jurnal dan prosiding; jenis lain dibuang.
        if (!it.type || !JENIS_ARTIKEL_CROSSREF.has(it.type)) continue;
        // Entri perangkat lunak atau rilisan bukan artikel.
        if (apakahJudulPerangkatLunak(judul)) continue;

        const namaJurnal = it["container-title"]?.[0]?.trim() || "Jurnal Ilmiah";
        const penulis = it.author
          ? it.author.map((a) => [a.given, a.family].filter(Boolean).join(" ")).join(", ")
          : undefined;
        const tahun = it.published?.["date-parts"]?.[0]?.[0];
        const link = it.URL || (it.DOI ? `https://doi.org/${it.DOI}` : undefined);

        out.push({
          source: "turath", // dipetakan agar kompatibel dengan engine tampilan
          // Judul BERSIH (Tahap 6): tag "[مجلة]" tidak lagi disisipkan
          // ke judul; jenis dan nama jurnal hidup sebagai bidang data.
          kitab: judul,
          jenis: "artikel",
          jurnal: namaJurnal,
          doi: it.DOI || undefined,
          volume: it.volume || undefined,
          nomor: it.issue || undefined,
          penulis: penulis || undefined,
          penerbit: it.publisher || undefined,
          tahun: tahun ? Number(tahun) : undefined,
          teks_kutipan: `بحث منشور في: ${namaJurnal}${tahun ? ` (سنة ${tahun})` : ""}. المعرف الرقمي: ${it.DOI || "-"}`,
          url_sumber: link || "https://doi.org",
          skor: hitungSkorJurnal(judul, kata, it.score),
          mode: "api",
          perluVerifikasi: false,
          catatanVerifikasi: "Diverifikasi via repositori jurnal resmi (Crossref/DOI).",
          skor_jenis: "konsep",
        });
      }
    }
  } catch {
    // Abaikan kegagalan jaringan
  }

  return out.slice(0, maks);
}
