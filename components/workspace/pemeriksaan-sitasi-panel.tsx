"use client";

import { useMemo, useState } from "react";
import { periksaSitasi, type MasalahSitasi } from "@/lib/engine/periksa-sitasi";
import type { Project } from "@/lib/engine/project";
import { Note } from "@/components/ui";

/**
 * Panel pemeriksaan sitasi — SATU-SATUNYA panel pemeriksa (gabungan panel
 * cross-check lama di tab Periksa + panel pemeriksaan di tab Ekspor).
 * On-demand: laporan dihitung saat tombol ditekan. `ubah` opsional —
 * tanpa `ubah`, tombol Abaikan tidak tampil (mis. pemakaian baca-saja).
 */
export function PemeriksaanSitasiPanel({
  p,
  ubah,
  onBuka,
}: {
  p: Project;
  ubah?: (patch: Partial<Project>) => void;
  onBuka?: (sectionId: string) => void;
}) {
  const [jalan, setJalan] = useState(0);
  const laporan = useMemo(() => (jalan > 0 ? periksaSitasi(p) : null), [jalan, p]);

  function abaikan(kunci: string) {
    ubah?.({ abaikanSitasi: [...(p.abaikanSitasi ?? []), kunci] });
  }

  const labelJenis = (m: MasalahSitasi) =>
    m.jenis === "tak-dikenal"
      ? "Rujukan hilang"
      : m.jenis === "tanpa-halaman"
        ? "Tanpa halaman"
        : m.jenis === "belum-verifikasi"
          ? "Belum diverifikasi"
          : "Warisan — periksa manual";

  return (
    <div className="space-y-3 rounded-2xl border border-ink-900/10 bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-bold text-ink-900">Pemeriksaan sitasi</h3>
          <p className="mt-0.5 max-w-xl text-[11.5px] leading-relaxed text-ink-600">
            Satu pemeriksa untuk seluruh naskah: penanda [[ref:…]] yang rujukannya hilang, sitasi
            tanpa halaman, rujukan terpakai yang belum diverifikasi, dan footnote lama [^n] yang
            tidak terkelola. Ini soal <b>keberadaan & kelengkapan penanda</b>, bukan kebenaran isi kutipan.
          </p>
        </div>
        <button type="button" className="btn-primary !py-2" onClick={() => setJalan((n) => n + 1)}>
          Periksa sitasi
        </button>
      </div>

      {laporan && (
        <div className="space-y-2">
          <p className="text-[12px] text-ink-700">
            Penanda sitasi: <b>{laporan.penandaSehat}/{laporan.penandaTotal}</b> sehat.
            {laporan.masalah.length === 0
              ? " Tidak ada masalah ditemukan — semua sitasi dikenal, berhalaman, dan terverifikasi."
              : ` ${laporan.masalah.length} hal perlu dibereskan:`}
          </p>
          {laporan.masalah.map((m, i) => (
            <div
              key={i}
              className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                m.tingkat === "kritis" || m.jenis === "tak-dikenal"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : m.tingkat === "info"
                    ? "border-ink-900/10 bg-ink-900/5 text-ink-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <span className="min-w-0">
                <span className="mr-1.5 rounded bg-white/70 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                  {labelJenis(m)}
                </span>
                {m.pesan}
                {m.labelBagian && <span className="text-ink-500"> ({m.labelBagian})</span>}
              </span>
              <span className="flex shrink-0 gap-1.5">
                {m.sectionId && onBuka && (
                  <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[11px]" onClick={() => onBuka(m.sectionId!)}>
                    Buka bagian
                  </button>
                )}
                {m.kunciAbaikan && ubah && (
                  <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[11px]" onClick={() => abaikan(m.kunciAbaikan!)}>
                    Abaikan
                  </button>
                )}
              </span>
            </div>
          ))}
          {laporan.sumberTakTerpakaiJudul.length > 0 && (
            <Note>
              {laporan.sumberTakTerpakaiJudul.length} rujukan di daftar Anda belum disitir di naskah:{" "}
              {laporan.sumberTakTerpakaiJudul.slice(0, 5).join(" · ")}
              {laporan.sumberTakTerpakaiJudul.length > 5 ? " …" : ""}. Ini bukan kesalahan — sekadar
              pengingat agar daftar rujukan dan isi naskah selaras.
            </Note>
          )}
        </div>
      )}
    </div>
  );
}
