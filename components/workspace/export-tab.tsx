"use client";

import { useMemo, useState } from "react";
import { ringkasanPanjangProyek, strukturProyek } from "@/lib/content/struktur";
import {
  estimasiHalamanDariKata,
  formatHalamanProyek,
  hitungKataNaskah,
} from "@/lib/engine/estimasi-halaman";
import { buatDocx, unduh } from "@/lib/engine/export";
import { modePerBab } from "@/lib/engine/hawamisy";
import type { Project } from "@/lib/engine/project";
import { markdownEksporProyek } from "@/components/workspace/footnote-bagian";
import { PemeriksaanSitasiPanel } from "@/components/workspace/pemeriksaan-sitasi-panel";
import { IconDoc, IconDownload } from "@/components/icons";
import { CopyButton, Note, Stat } from "@/components/ui";

function namaBerkas(p: Project, ekstensi: string) {
  const dasar = (p.judulAr || p.topikAr || "naskah-uthruha")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${dasar}.${ekstensi}`;
}

export function ExportTab({ p, onBuka }: { p: Project; onBuka?: (sectionId: string) => void }) {
  const [pakaiRujukan, setPakaiRujukan] = useState(true);
  const [sedang, setSedang] = useState(false);

  const markdown = useMemo(() => {
    // Penyusunan markdown ekspor kini SATU JALUR bersama di
    // markdownEksporProyek (kompilasi dokumen sadar batas bab +
    // daftar pustaka satu jalur) — fungsi yang sama dipakai
    // penghitung kata bersama kataDokumenProyek untuk tab Ringkasan
    // (perbaikan P2.3), jadi angka KATA kedua tab tidak bisa berbeda.
    return markdownEksporProyek(p, pakaiRujukan);
  }, [p, pakaiRujukan]);

  // Panjang dokumen yang akan diunduh (Tahap 10): kata dihitung
  // dengan penghitung kalibrasi dan halaman ditaksir pada format
  // proyek, menggantikan konvensi 250 kata per halaman yang tidak
  // terukur. Angka ini perkiraan, dinyatakan apa adanya.
  const kata = hitungKataNaskah(markdown);
  const formatEkspor = formatHalamanProyek(p);
  const halamanDokumen = estimasiHalamanDariKata(kata, formatEkspor);
  const panjang = ringkasanPanjangProyek(p);

  function docx() {
    setSedang(true);
    try {
      const ped = p.pedoman ?? null;
      const blob = buatDocx(
        p.judulAr || p.topikAr || "Naskah Kitabah",
        markdown,
        {
          ...(ped
            ? {
                font: ped.fontArab,
                ukuranNaskah: ped.ukuranNaskah,
                ukuranFootnote: ped.ukuranFootnote,
                spasi: ped.spasi,
                marginCm: ped.marginCm,
              }
            : {}),
          // Mode per-bab (As'adiyah): Word menyetel ulang nomor
          // footnote di tiap seksi bab; label bab dari struktur
          // proyek (data terstruktur, bukan tebakan dari teks).
          ...(modePerBab(p)
            ? {
                footnotePerBab: true,
                labelBab: strukturProyek(p).chapters.map((c) => c.labelAr),
              }
            : {}),
        },
      );
      unduh(blob, namaBerkas(p, "docx"));
    } finally {
      setSedang(false);
    }
  }

  function md() {
    unduh(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), namaBerkas(p, "md"));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[15px] font-bold text-ink-900">Ekspor naskah</h2>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-600">
          Berkas .docx dihasilkan langsung di peramban: arah kanan-ke-kiri, rata kiri-kanan,
          dan penanda bagian kosong tetap terlihat agar tidak ada yang terlupa.
        </p>
      </div>


      <PemeriksaanSitasiPanel p={p} onBuka={onBuka} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Kata" nilai={kata.toLocaleString("id-ID")} />
        <Stat label="Bagian" nilai={strukturProyek(p).chapters.reduce((a, c) => a + c.sections.length, 0)} />
        <Stat label="Rujukan" nilai={p.sumber.length} />
        <Stat label="Halaman ±" nilai={halamanDokumen} />
      </div>

      <div className="rounded-xl border border-ink-900/10 bg-white/70 px-3 py-2.5">
        <p className="text-[12.5px] font-semibold text-ink-800">Ringkasan panjang sebelum ekspor</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
          Dokumen ini berisi {kata.toLocaleString("id-ID")} kata, setara perkiraan ±
          {halamanDokumen.toLocaleString("id-ID")} halaman pada format {formatEkspor.label}{" "}
          (±{formatEkspor.kataPerHalaman} kata per halaman, terkalibrasi dari dokumen uji).
          Perkiraan ini bukan jumlah halaman pasti; angka pastinya terlihat sesudah berkas
          dibuka di pengolah kata Anda.
        </p>
        {panjang.baris.length > 0 && (
          <ul className="mt-2 space-y-1">
            {panjang.baris.map((b) => (
              <li key={b.kunci} className="text-[12px] leading-relaxed text-ink-700">
                {b.label}: ±
                {b.halamanMentah.toLocaleString("id-ID", { maximumFractionDigits: 1 })} dari{" "}
                {b.targetHalaman} halaman ({b.labelSumber}) —{" "}
                <span className={b.tercapai ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                  {b.tercapai ? "tercapai" : "belum tercapai"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-center gap-2.5 rounded-xl border border-ink-900/10 bg-white/70 px-3 py-2.5">
        <input
          type="checkbox"
          checked={pakaiRujukan}
          onChange={(e) => setPakaiRujukan(e.target.checked)}
          className="h-4 w-4 rounded border-ink-900/30 text-ink-900"
        />
        <span className="text-[12.5px] text-ink-800">
          Sertakan daftar rujukan ({p.sumber.length} entri) di akhir naskah
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={docx} disabled={sedang} className="btn-gold">
          <IconDownload className="h-4 w-4" />
          {sedang ? "Menyiapkan…" : "Unduh .docx"}
        </button>
        <button type="button" onClick={md} className="btn-ghost">
          <IconDoc className="h-4 w-4" /> Unduh .md
        </button>
        <CopyButton teks={markdown} label="Salin seluruh naskah" className="btn-ghost" />
      </div>

      <Note jenis="aman">
        Berkas .docx memakai font Amiri/Traditional Arabic bila tersedia di komputer Anda. Bila
        tampilannya berbeda, atur font naskah ke <em>Traditional Arabic</em> ukuran 16 pt, spasi
        1,5, dan perataan justify — lalu sesuaikan margin dengan pedoman kampus.
      </Note>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-bold text-ink-900">Pratinjau markdown</h3>
          <span className="text-[10px] text-ink-500">{markdown.length.toLocaleString("id-ID")} karakter</span>
        </div>
        <pre
          dir="rtl"
          className="doc-scroll mt-2 max-h-80 overflow-auto rounded-xl border border-ink-900/10 bg-white p-4 text-right font-naskh text-[12.5px] leading-loose text-ink-800"
        >
          {markdown.slice(0, 3000)}
          {markdown.length > 3000 ? "\n\n…" : ""}
        </pre>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-500">
        Draf yang belum Anda sunting tetap diekspor dengan tanda{" "}
        <span className="font-semibold">(مسودة تلقائية — لم تُراجع بعد)</span>. Hapus tanda itu
        hanya setelah bagian tersebut benar-benar Anda periksa.
      </p>
    </div>
  );
}
