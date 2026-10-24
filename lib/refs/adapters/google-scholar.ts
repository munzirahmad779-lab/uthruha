/**
 * Adapter Google Scholar & Crossref untuk agregasi jurnal deterministik.
 * Mencari artikel jurnal per klaster tanpa AI.
 */
import type { ArtikelJurnal } from "@/lib/engine/khalfiyah";

/**
 * Cari artikel dari Crossref API untuk satu klaster.
 */
export async function cariArtikelCrossref(
  kueriKlaster: string[],
  klasterIndex: 1 | 2 | 3,
  maks = 5,
): Promise<ArtikelJurnal[]> {
  const kueri = kueriKlaster.join(" ");
  if (!kueri.trim()) return [];

  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(kueri)}&rows=${maks}&filter=type:journal-article`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "UthruhaKhalfiyah/1.0 (mailto:peneliti@uthruha.id)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`Crossref gagal untuk klaster ${klasterIndex}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const items = data.message?.items ?? [];

    const hasil: ArtikelJurnal[] = [];
    for (const item of items) {
      const judul = item.title?.[0]?.trim();
      if (!judul) continue;

      const penulis =
        item.author?.map((a: any) => {
          const parts = [a.given, a.family].filter(Boolean);
          return parts.join(" ");
        }) ?? [];

      const tahun = item.published?.["date-parts"]?.[0]?.[0] ?? item.created?.["date-parts"]?.[0]?.[0];
      if (!tahun) continue;

      const namaJurnal = item["container-title"]?.[0]?.trim() || "Journal";
      const doi = item.DOI;
      const url = item.URL || (doi ? `https://doi.org/${doi}` : "");

      // Ekstrak masalah empiris dari abstrak (jika ada)
      const abstrak = item.abstract?.replace(/<[^>]+>/g, "").trim();
      const masalahEmpiris = abstrak 
        ? ekstrakMasalahEmpiris(abstrak)
        : `[Abstrak tidak tersedia di API - verifikasi manual diperlukan] Topik artikel: ${judul.slice(0, 100)}...`;

      hasil.push({
        judul,
        penulis,
        tahun: Number(tahun),
        namaJurnal,
        abstrak: abstrak?.slice(0, 500),
        doi,
        url,
        masalahEmpiris,
        klaster: klasterIndex,
      });
    }

    return hasil.slice(0, maks);
  } catch (error) {
    console.error(`Error fetching Crossref for klaster ${klasterIndex}:`, error);
    return [];
  }
}

/**
 * Cari artikel dari OpenAlex API (alternatif Google Scholar).
 */
export async function cariArtikelOpenAlex(
  kueriKlaster: string[],
  klasterIndex: 1 | 2 | 3,
  maks = 5,
): Promise<ArtikelJurnal[]> {
  const kueri = kueriKlaster.join(" ");
  if (!kueri.trim()) return [];

  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(kueri)}&filter=type:journal-article&per-page=${maks}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "UthruhaKhalfiyah/1.0 (mailto:peneliti@uthruha.id)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`OpenAlex gagal untuk klaster ${klasterIndex}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = data.results ?? [];

    const hasil: ArtikelJurnal[] = [];
    for (const item of results) {
      const judul = item.title?.trim();
      if (!judul) continue;

      const penulis =
        item.authorships?.map((a: any) => a.author?.display_name).filter(Boolean) ?? [];

      const tahun = item.publication_year;
      if (!tahun) continue;

      const namaJurnal =
        item.primary_location?.source?.display_name || "Journal";
      const doi = item.doi?.replace("https://doi.org/", "");
      const url = item.doi || item.id || "";

      // Ekstrak inverted abstract (OpenAlex format)
      let abstrak = "";
      if (item.abstract_inverted_index) {
        const words: [string, number[]][] = Object.entries(
          item.abstract_inverted_index,
        );
        const sorted = words.flatMap(([word, positions]) =>
          positions.map((pos) => ({ word, pos })),
        );
        sorted.sort((a, b) => a.pos - b.pos);
        abstrak = sorted.map((x) => x.word).join(" ").slice(0, 500);
      }

      const masalahEmpiris = abstrak
        ? ekstrakMasalahEmpiris(abstrak)
        : `[Abstrak tidak tersedia di API - verifikasi manual diperlukan] Topik artikel: ${judul.slice(0, 100)}...`;

      hasil.push({
        judul,
        penulis,
        tahun,
        namaJurnal,
        abstrak,
        doi,
        url,
        masalahEmpiris,
        klaster: klasterIndex,
      });
    }

    return hasil.slice(0, maks);
  } catch (error) {
    console.error(`Error fetching OpenAlex for klaster ${klasterIndex}:`, error);
    return [];
  }
}

/**
 * Ekstrak rumusan masalah empiris dari abstrak artikel.
 * Menggunakan pola linguistik umum dalam abstrak akademik.
 * 
 * CATATAN: Fungsi ini HANYA bekerja jika abstrak tersedia dari API.
 * Tidak semua artikel di Crossref/OpenAlex menyertakan abstrak.
 */
function ekstrakMasalahEmpiris(teks: string): string {
  if (!teks || teks.trim().length < 20) {
    return "Abstrak tidak tersedia - silakan akses artikel asli via DOI untuk problem statement lengkap.";
  }

  // Pola umum yang menandakan problem statement dalam abstrak bahasa Inggris
  const pola = [
    /however[,\s]+([^.]+\.)/i,
    /despite[,\s]+([^.]+\.)/i,
    /although[,\s]+([^.]+\.)/i,
    /the problem[,\s]+([^.]+\.)/i,
    /this study addresses[,\s]+([^.]+\.)/i,
    /gap in[,\s]+([^.]+\.)/i,
    /lack of[,\s]+([^.]+\.)/i,
    /limited[,\s]+([^.]+\.)/i,
    /challenge[,\s]+([^.]+\.)/i,
    /issue[,\s]+([^.]+\.)/i,
    /remains unclear[,\s]+([^.]+\.)/i,
    /little is known[,\s]+([^.]+\.)/i,
  ];

  for (const p of pola) {
    const cocok = teks.match(p);
    if (cocok && cocok[1]) {
      return `Problem: ${cocok[1].trim()}`;
    }
  }

  // Fallback: ambil 2 kalimat pertama sebagai konteks
  const kalimat = teks.split(/[.!?]+/).filter(k => k.trim().length > 10);
  if (kalimat.length >= 2) {
    return kalimat.slice(0, 2).join(". ").trim().slice(0, 250) + "...";
  } else if (kalimat.length === 1) {
    return kalimat[0].trim().slice(0, 200) + "...";
  }
  
  return "Problem statement tidak terdeteksi - buka artikel untuk detail.";
}

/**
 * Agregasi lengkap: gabungkan hasil dari Crossref dan OpenAlex.
 */
export async function agregasiJurnalKlaster(
  kueriKlaster: string[],
  klasterIndex: 1 | 2 | 3,
  maks = 8,
): Promise<ArtikelJurnal[]> {
  const [crossref, openalex] = await Promise.all([
    cariArtikelCrossref(kueriKlaster, klasterIndex, Math.ceil(maks / 2)),
    cariArtikelOpenAlex(kueriKlaster, klasterIndex, Math.ceil(maks / 2)),
  ]);

  // Gabungkan dan deduplikasi berdasarkan DOI atau judul
  const gabung = [...crossref, ...openalex];
  const unik = new Map<string, ArtikelJurnal>();

  for (const artikel of gabung) {
    const kunci = artikel.doi || artikel.judul.toLowerCase();
    if (!unik.has(kunci)) {
      unik.set(kunci, artikel);
    }
  }

  return Array.from(unik.values()).slice(0, maks);
}

/**
 * Cari persilangan masalah antara dua klaster.
 */
export function cariPersilanganMasalah(
  artikelK1: ArtikelJurnal[],
  artikelK2: ArtikelJurnal[],
): string[] {
  const masalahK1 = new Set(
    artikelK1.map((a) => a.masalahEmpiris?.toLowerCase()).filter((x): x is string => Boolean(x)),
  );
  const masalahK2 = artikelK2.map((a) => a.masalahEmpiris).filter((x): x is string => Boolean(x));

  const persilangan: string[] = [];
  for (const m2 of masalahK2) {
    const kata = m2.toLowerCase().split(/\s+/);
    for (const k of kata) {
      if (k.length > 4) {
        // kata signifikan
        for (const m1 of masalahK1) {
          if (m1.includes(k)) {
            persilangan.push(
              `Kata kunci "${k}" muncul di kedua klaster, menunjukkan gap penelitian.`,
            );
            break;
          }
        }
      }
    }
  }

  return persilangan.slice(0, 3);
}
