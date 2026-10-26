"use client";

import { useMemo, useState } from "react";
import { strukturProyek } from "@/lib/content/struktur";
import { composeNaskah } from "@/lib/engine/compose";
import { buatDocx, unduh } from "@/lib/engine/export";
import { susunDaftarPustaka } from "@/lib/engine/cite";
import { daftarPustakaPedoman, gayaSah, susunDaftarPustakaGaya } from "@/lib/engine/citation";
import { kompilasiMarker } from "@/lib/engine/marker";
import { periksaSitasi } from "@/lib/engine/periksa-sitasi";
import type { Project } from "@/lib/engine/project";
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
  const periksa = useMemo(() => periksaSitasi(p), [p]);

  const markdown = useMemo(() => {
    const gaya = gayaSah(p.gayaSitasi);
    const hasil = kompilasiMarker(composeNaskah(p), p);
    const isi = hasil.markdown;
    if (!pakaiRujukan || p.sumber.length === 0) return isi;
    if (p.pedoman?.formatPustaka) {
      // Pedoman kampus mengalahkan gaya proyek untuk daftar pustaka juga.
      const entri = daftarPustakaPedoman(p.sumber, p.pedoman)
        .map((e, i) => `${i + 1}. ${e}`)
        .join("\n");
      return `${isi}\n\n---\n\n# قائمة المراجع\n\n${entri}`;
    }
    if (gaya !== "arab-klasik") {
      const entri = susunDaftarPustakaGaya(p.sumber, gaya)
        .map((e, i) => `${i + 1}. ${e}`)
        .join("\n");
      return `${isi}\n\n---\n\n# قائمة المراجع\n\n${entri}`;
    }
    const daftar = susunDaftarPustaka(p.sumber)
      .map((g) => `### ${g.judul}\n\n${g.entri.map((e, i) => `${i + 1}. ${e}`).join("\n")}`)
      .join("\n\n");
    return `${isi}\n\n---\n\n# قائمة المراجع\n\n${daftar}`;
  }, [p, pakaiRujukan]);

  const kata = markdown.split(/\s+/).filter(Boolean).length;

  function docx() {
    setSedang(true);
    try {
      const ped = p.pedoman ?? null;
      const blob = buatDocx(
        p.judulAr || p.topikAr || "Naskah Uthruha",
        markdown,
        ped
          ? {
              font: ped.fontArab,
              ukuranNaskah: ped.ukuranNaskah,
              ukuranFootnote: ped.ukuranFootnote,
              spasi: ped.spasi,
              marginCm: ped.marginCm,
            }
          : undefined,
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


      <div className={`rounded-2xl border p-4 ${periksa.masalah.length > 0 ? "border-amber-500/40 bg-amber-50" : "border-emerald-600/30 bg-emerald-50"}`}>
        <h3 className="text-[13px] font-bold text-ink-900">
          Pemeriksaan sitasi {periksa.masalah.length > 0 ? `— ${periksa.masalah.length} hal perlu dibereskan` : "— bersih ✓"}
        </h3>
        {periksa.masalah.length === 0 ? (
          <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
            {periksa.jumlahSitasi} sitasi di naskah semuanya dikenal, mencantumkan halaman, dan
            rujukannya sudah diverifikasi.
            {periksa.jumlahSumberTakTerpakai > 0
              ? ` Ada ${periksa.jumlahSumberTakTerpakai} rujukan di daftar referensi yang belum pernah disitasi (tidak ikut masalah — hanya informasi).`
              : ""}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {periksa.masalah.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5">
                <span className="min-w-0 text-[12px] leading-relaxed text-ink-700">
                  <span className="font-semibold text-amber-800">
                    {m.jenis === "tak-dikenal" ? "Rujukan hilang" : m.jenis === "tanpa-halaman" ? "Tanpa halaman" : "Belum diverifikasi"}:
                  </span>{" "}
                  {m.pesan}
                  {m.labelBagian && <span className="text-ink-500"> ({m.labelBagian})</span>}
                </span>
                {m.sectionId && onBuka && (
                  <button type="button" className="btn-quiet shrink-0 !px-2 !py-0.5 !text-[11px]" onClick={() => onBuka(m.sectionId!)}>
                    Buka bagian
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Kata" nilai={kata.toLocaleString("id-ID")} />
        <Stat label="Bagian" nilai={strukturProyek(p).chapters.reduce((a, c) => a + c.sections.length, 0)} />
        <Stat label="Rujukan" nilai={p.sumber.length} />
        <Stat label="Halaman ±" nilai={Math.max(1, Math.round(kata / 250))} />
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
