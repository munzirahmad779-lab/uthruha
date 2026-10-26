// lib/engine/gerbang-mutu.ts
// Gerbang mutu per jenjang: aturan KETAT yang berbeda untuk skripsi, tesis,
// disertasi, dan artikel jurnal bereputasi — deterministik, tanpa AI.
// Berbeda dari "Kelengkapan naskah" (daftar bagian kosong): gerbang menilai
// syarat kuantitatif & khas jenjang yang membuat sebuah karya layak jenjangnya.

import type { Project } from "@/lib/engine/project";
import { strukturProyek } from "@/lib/content/struktur";
import { periksaSitasi } from "@/lib/engine/periksa-sitasi";

export interface SyaratGerbang {
  id: string;
  label: string;
  terpenuhi: boolean;
  detail: string;
}

export interface HasilGerbang {
  jenjang: string;
  lolos: boolean;
  syarat: SyaratGerbang[];
}

interface AturanJenjang {
  label: string;
  minSumber: number;
  persenArtikelMin: number;
  minKitab?: number;
  persenMutakhirMin?: number;
}

const ATURAN: Record<string, AturanJenjang> = {
  skripsi: { label: "Skripsi", minSumber: 15, persenArtikelMin: 30 },
  tesis: { label: "Tesis", minSumber: 30, persenArtikelMin: 50 },
  disertasi: { label: "Disertasi", minSumber: 50, persenArtikelMin: 40, minKitab: 8 },
  jurnal: { label: "Artikel jurnal bereputasi", minSumber: 25, persenArtikelMin: 70, persenMutakhirMin: 50 },
};

const BAGIAN_WAJIB: Record<string, { id: string; label: string }[]> = {
  tesis: [{ id: "kontribusi", label: "Bagian Kontribusi Penelitian terisi" }],
  disertasi: [
    { id: "kebaruan", label: "Bagian Kebaruan & Orisinalitas terisi" },
    { id: "kontribusi", label: "Bagian Kontribusi Penelitian terisi" },
  ],
  jurnal: [{ id: "abstrakEn", label: "Abstrak bahasa Inggris (Abstract) terisi" }],
};

export function periksaGerbang(p: Project): HasilGerbang {
  const a = ATURAN[p.jenis] ?? ATURAN.skripsi;
  const syarat: SyaratGerbang[] = [];

  const artikel = p.sumber.filter((s) => s.jenis === "artikel");
  const persenArtikel = p.sumber.length ? Math.round((artikel.length / p.sumber.length) * 100) : 0;
  syarat.push({
    id: "sumber",
    label: `Minimal ${a.minSumber} rujukan tersimpan`,
    terpenuhi: p.sumber.length >= a.minSumber,
    detail: `Saat ini ${p.sumber.length} rujukan.`,
  });
  syarat.push({
    id: "artikel",
    label: `Minimal ${a.persenArtikelMin}% rujukan berupa artikel jurnal`,
    terpenuhi: persenArtikel >= a.persenArtikelMin,
    detail: `Saat ini ${persenArtikel}% (${artikel.length} artikel dari ${p.sumber.length} rujukan).`,
  });
  if (a.minKitab) {
    const kitab = p.sumber.filter((s) => s.jenis === "kitab").length;
    syarat.push({
      id: "kitab",
      label: `Minimal ${a.minKitab} kitab/sumber primer turats`,
      terpenuhi: kitab >= a.minKitab,
      detail: `Saat ini ${kitab} kitab.`,
    });
  }
  if (a.persenMutakhirMin) {
    const mutakhir = artikel.filter((s) => {
      const t = parseInt(s.tahun, 10);
      return !Number.isNaN(t) && t >= 2016;
    }).length;
    const persen = artikel.length ? Math.round((mutakhir / artikel.length) * 100) : 0;
    syarat.push({
      id: "mutakhir",
      label: `Minimal ${a.persenMutakhirMin}% artikel terbit 2016 ke atas`,
      terpenuhi: persen >= a.persenMutakhirMin,
      detail: `Saat ini ${persen}% artikel mutakhir (${mutakhir} dari ${artikel.length}).`,
    });
  }

  const st = strukturProyek(p);
  const idsAda = new Set(st.chapters.flatMap((c) => c.sections.map((s) => s.id)));
  for (const w of BAGIAN_WAJIB[p.jenis] ?? []) {
    if (!idsAda.has(w.id)) {
      syarat.push({
        id: `wajib-${w.id}`,
        label: w.label,
        terpenuhi: false,
        detail: "Bagian ini belum ada di struktur proyek — tambahkan lewat editor daftar isi di tab Struktur.",
      });
    } else {
      const isi = (p.draf[w.id] ?? "").trim().length;
      syarat.push({
        id: `wajib-${w.id}`,
        label: w.label,
        terpenuhi: isi > 100,
        detail: isi > 100 ? "Sudah terisi." : "Masih kosong atau sangat pendek — isi di tab Tulis.",
      });
    }
  }

  const periksa = periksaSitasi(p);
  const kritis = periksa.masalah.filter((m) => m.jenis === "tak-dikenal").length;
  syarat.push({
    id: "sitasi",
    label: "Tidak ada sitasi yang rujukannya hilang",
    terpenuhi: periksa.penandaTotal > 0 && kritis === 0,
    detail:
      periksa.penandaTotal === 0
        ? "Belum ada penanda sitasi di naskah."
        : kritis === 0
          ? `${periksa.penandaSehat}/${periksa.penandaTotal} penanda sehat.`
          : `${kritis} penanda menunjuk rujukan yang sudah tidak ada.`,
  });

  const target = st.chapters.flatMap((c) => c.sections).reduce((x, s) => x + (s.targetKata ?? 0), 0);
  const kata = Object.values(p.draf).join(" ").split(/\s+/).filter(Boolean).length;
  const persenKata = target ? Math.round((kata / target) * 100) : 0;
  syarat.push({
    id: "kata",
    label: "Naskah mencapai minimal 70% target kata jenjangnya",
    terpenuhi: persenKata >= 70,
    detail: `Saat ini ±${kata.toLocaleString("id-ID")} dari target ${target.toLocaleString("id-ID")} kata (${persenKata}%).`,
  });

  return { jenjang: a.label, lolos: syarat.every((s) => s.terpenuhi), syarat };
}
