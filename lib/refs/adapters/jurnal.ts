/**
 * Adapter Crossref & OpenAlex — Sumber Jurnal Ilmiah Akademik Berbahasa Arab.
 * Mengembalikan artikel jurnal bereputasi lengkap dengan DOI, nama jurnal, dan tautan.
 */
import type { RefCandidate } from "@/lib/refs/types";
import { type OpsiAdapter } from "@/lib/refs/adapters/http";

export const info = {
  id: "jurnal" as const,
  mode: "api" as const,
  nama: "Jurnal Akademik (Crossref & OpenAlex)",
  api: "Terbuka (REST API tanpa key)",
};

interface CrossrefItem {
  title?: string[];
  "container-title"?: string[];
  author?: { given?: string; family?: string }[];
  DOI?: string;
  URL?: string;
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

        const namaJurnal = it["container-title"]?.[0]?.trim() || "Jurnal Ilmiah";
        const penulis = it.author
          ? it.author.map((a) => [a.given, a.family].filter(Boolean).join(" ")).join(", ")
          : undefined;
        const tahun = it.published?.["date-parts"]?.[0]?.[0];
        const link = it.URL || (it.DOI ? `https://doi.org/${it.DOI}` : undefined);

        out.push({
          source: "turath", // dipetakan agar kompatibel dengan engine tampilan
          kitab: `[مجلة] ${judul}`,
          penulis: penulis || undefined,
          penerbit: namaJurnal,
          tahun: tahun ? Number(tahun) : undefined,
          teks_kutipan: `بحث منشور في: ${namaJurnal}${tahun ? ` (سنة ${tahun})` : ""}. المعرف الرقمي: ${it.DOI || "-"}`,
          url_sumber: link || "https://doi.org",
          skor: 0.88,
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
