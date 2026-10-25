"use client";

import { useMemo, useState } from "react";
import { periksaSitasi } from "@/lib/engine/crosscheck";
import type { Project } from "@/lib/engine/project";
import { Note } from "@/components/ui";

/**
 * Panel cross-check sitasi (Urutan 4) — on-demand: laporan hanya dihitung
 * saat user menekan tombol, bukan setiap ketikan.
 */
export function CrosscheckPanel({ p, ubah }: { p: Project; ubah: (patch: Partial<Project>) => void }) {
  const [jalan, setJalan] = useState(0);
  const laporan = useMemo(() => (jalan > 0 ? periksaSitasi(p) : null), [jalan, p]);

  function abaikan(kunci: string) {
    ubah({ abaikanSitasi: [...(p.abaikanSitasi ?? []), kunci] });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ink-900/10 bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-bold text-ink-900">Cross-check sitasi</h3>
          <p className="mt-0.5 max-w-xl text-[11.5px] leading-relaxed text-ink-600">
            Memeriksa penanda [[ref:…]] di seluruh naskah: apakah setiap penanda menunjuk
            rujukan yang masih ada, dan apakah ada footnote lama yang tidak terkelola.
            Pemeriksaan ini soal <b>keberadaan penanda</b>, bukan kebenaran isi kutipan.
          </p>
        </div>
        <button type="button" className="btn-primary !py-2" onClick={() => setJalan((n) => n + 1)}>
          Periksa sitasi
        </button>
      </div>

      {laporan && (
        <div className="space-y-2">
          <p className="text-[12px] text-ink-700">
            Penanda sitasi: <b>{laporan.markerSehat}/{laporan.markerTotal}</b> sehat.
            {laporan.temuan.length === 0 && laporan.markerTotal > 0
              ? " Tidak ada masalah penanda ditemukan."
              : laporan.markerTotal === 0
                ? " Belum ada penanda [[ref:…]] di naskah — sitasi lama berbentuk footnote manual hanya bisa diperiksa kewajarannya (jalur warisan)."
                : ""}
          </p>
          {laporan.temuan.map((t, i) => (
            <div
              key={i}
              className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                t.tingkat === "kritis"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : t.tingkat === "saran"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-ink-900/10 bg-ink-900/5 text-ink-700"
              }`}
            >
              <span>
                <span className="mr-1.5 rounded bg-white/70 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                  {t.jalur === "marker" ? "penanda" : "warisan — periksa manual"}
                </span>
                <b>{t.bagian}:</b> {t.pesan}
              </span>
              {t.kunciAbaikan && (
                <button type="button" className="btn-quiet shrink-0 !py-0.5" onClick={() => abaikan(t.kunciAbaikan!)}>
                  Abaikan
                </button>
              )}
            </div>
          ))}
          {laporan.sumberTakDisitir.length > 0 && (
            <Note>
              {laporan.sumberTakDisitir.length} rujukan di daftar Anda belum disitir dengan penanda
              di naskah: {laporan.sumberTakDisitir.slice(0, 5).join(" · ")}
              {laporan.sumberTakDisitir.length > 5 ? " …" : ""}. Ini bukan kesalahan — sekadar
              pengingat agar daftar rujukan dan isi naskah selaras.
            </Note>
          )}
        </div>
      )}
    </div>
  );
}
