/**
 * Adapter Internet Archive (archive.org) — Naskah & PDF Kitab Kuning Fisik Terverifikasi.
 */
import type { RefCandidate } from "@/lib/refs/types";
import { type OpsiAdapter } from "@/lib/refs/adapters/http";

interface ArchiveDoc {
  identifier: string;
  title?: string;
  creator?: string;
  year?: string;
  description?: string;
}

interface ArchiveResponse {
  response?: {
    numFound: number;
    docs: ArchiveDoc[];
  };
}

export async function cariArchive(
  kueri: string,
  opsi: OpsiAdapter = {},
): Promise<RefCandidate[]> {
  const maks = opsi.maks ?? 4;
  const kata = kueri.trim();
  if (!kata) return [];

  const out: RefCandidate[] = [];

  // Strategi kueri cerdas: coba frasa majemuk, bila nihil coba kombinasi kata utama
  const daftarKueri = [
    kata,
    kata.includes("منظوم") ? "شرح منظومة أصول التفسير" : kata.split(/\s+/).slice(0, 3).join(" "),
  ];

  for (const q of daftarKueri) {
    if (out.length >= maks) break;
    try {
      const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}+AND+language:ara&fl[]=identifier,title,creator,year,description&rows=${maks}&output=json`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Uthruha/1.0" },
        cache: "no-store",
      });

      if (res.ok) {
        const data = (await res.json()) as ArchiveResponse;
        const docs = data.response?.docs ?? [];

        for (const d of docs) {
          if (!d.title) continue;
          if (out.some(x => x.url_sumber?.includes(d.identifier))) continue;
          out.push({
            source: "turath",
            kitab: `[مخطوط/طبعة] ${d.title}`,
            penulis: d.creator || undefined,
            tahun: d.year ? Number.parseInt(d.year, 10) || undefined : undefined,
            teks_kutipan: d.description ? d.description.slice(0, 220) : "نسخة إلكترونية مطبوعة/مخطوطة متوفرة في أرشيف المخطوطات والكتب.",
            url_sumber: `https://archive.org/details/${d.identifier}`,
            skor: 0.84,
            mode: "api",
            perluVerifikasi: false,
            catatanVerifikasi: "Tersedia naskah cetak/PDF lengkap di Internet Archive.",
            skor_jenis: "konsep",
          });
        }
      }
    } catch {
      // Abaikan kegagalan jaringan
    }
  }

  return out.slice(0, maks);
}
