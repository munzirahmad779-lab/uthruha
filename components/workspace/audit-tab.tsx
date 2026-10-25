"use client";

import { useMemo, useState } from "react";
import { strukturProyek } from "@/lib/content/struktur";
import { perbaikiOtomatis, periksaOrtografi } from "@/lib/engine/orthografi";
import type { Project } from "@/lib/engine/project";
import { IconCheck, IconSparkle } from "@/components/icons";
import { Note, Stat } from "@/components/ui";
import { CrosscheckPanel } from "@/components/workspace/crosscheck-panel";

const LEVEL: Record<string, string> = {
  kritis: "bg-red-50 text-red-700 border-red-200",
  saran: "bg-amber-50 text-amber-800 border-amber-200",
  info: "bg-ink-900/5 text-ink-700 border-ink-900/10",
};

export function AuditTab({
  p,
  ubah,
  bagian,
}: {
  p: Project;
  ubah: (patch: Partial<Project>) => void;
  bagian: string;
}) {
  const [lingkup, setLingkup] = useState<"bagian" | "semua">("bagian");
  const [filter, setFilter] = useState<"semua" | "kritis" | "saran" | "info">("semua");

  const st = strukturProyek(p);
  const semuaBagian = st.chapters.flatMap((c) => c.sections);
  const judulBagian =
    semuaBagian.find((s) => s.id === bagian)?.labelId ?? bagian;

  const teks = useMemo(
    () =>
      lingkup === "bagian"
        ? (p.draf[bagian] ?? "")
        : Object.values(p.draf).join("\n\n"),
    [lingkup, p.draf, bagian],
  );

  const laporan = useMemo(() => periksaOrtografi(teks), [teks]);
  const tampil = laporan.temuan.filter((t) => filter === "semua" || t.tingkat === filter);

  const kosong = semuaBagian.filter((s) => (p.draf[s.id] ?? "").trim().length <= 80);

  function perbaiki() {
    if (lingkup === "bagian") {
      ubah({ draf: { ...p.draf, [bagian]: perbaikiOtomatis(p.draf[bagian] ?? "") } });
    } else {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(p.draf)) next[k] = perbaikiOtomatis(v);
      ubah({ draf: next });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Pemeriksa naskah</h2>
          <p className="mt-1 text-[12px] text-ink-600">
            Ortografi Arab, tanda baca, dan kelengkapan bagian. Pemeriksaan berjalan di
            peramban Anda — teks tidak dikirim ke mana pun.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <div className="flex overflow-hidden rounded-xl border border-ink-900/15">
            {(["bagian", "semua"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLingkup(l)}
                className={`px-3 py-2 text-[11.5px] font-semibold ${
                  lingkup === l ? "bg-ink-900 text-parchment-100" : "bg-white/70 text-ink-700"
                }`}
              >
                {l === "bagian" ? `Bagian: ${judulBagian}` : "Seluruh naskah"}
              </button>
            ))}
          </div>
          <button type="button" onClick={perbaiki} className="btn-gold !py-2 !text-[11.5px]">
            <IconSparkle className="h-3.5 w-3.5" /> Perbaiki otomatis
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Kata" nilai={laporan.statistik.kata.toLocaleString("id-ID")} />
        <Stat label="Kalimat" nilai={laporan.statistik.kalimat} />
        <Stat label="Isi Arab" nilai={`${laporan.statistik.rasioArab}%`} />
        <Stat label="Temuan" nilai={laporan.temuan.length} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["semua", "kritis", "saran", "info"] as const).map((f) => {
          const n =
            f === "semua" ? laporan.temuan.length : laporan.temuan.filter((t) => t.tingkat === f).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold capitalize transition ${
                filter === f
                  ? "border-ink-900 bg-ink-900 text-parchment-100"
                  : "border-ink-900/15 bg-white/70 text-ink-600 hover:border-ink-900/30"
              }`}
            >
              {f} · {n}
            </button>
          );
        })}
      </div>

      {teks.trim().length === 0 ? (
        <Note>Belum ada teks pada lingkup ini. Susun draf dulu di tab Tulis.</Note>
      ) : tampil.length === 0 ? (
        <div className="rounded-xl border border-emerald-600/25 bg-emerald-50/70 px-4 py-6 text-center">
          <IconCheck className="mx-auto h-6 w-6 text-emerald-700" />
          <p className="mt-2 text-[13px] font-semibold text-emerald-900">
            Tidak ada temuan pada filter ini.
          </p>
          <p className="mt-1 text-[11.5px] text-emerald-800/80">
            Pemeriksa ini menangkap pola ortografi dan tanda baca, bukan kesalahan nahwu.
            Naskah tetap perlu dibaca ulang.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-ink-900/5 overflow-hidden rounded-xl border border-ink-900/10 bg-white/70">
          {tampil.slice(0, 80).map((t) => (
            <li key={t.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
              <span
                className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${LEVEL[t.tingkat]}`}
              >
                {t.tingkat}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-ink-600">
                  {t.aturan} · <span className="font-arabic text-ink-500">{t.aturanAr}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
                  <span className="rounded bg-red-50 px-1.5 py-0.5 font-naskh text-[13.5px] text-red-900" dir="rtl">
                    {t.kutipan}
                  </span>
                  <span className="text-[11.5px] leading-relaxed text-ink-700">{t.saran}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tampil.length > 80 && (
        <p className="text-[11px] text-ink-500">
          Menampilkan 80 temuan pertama dari {tampil.length}. Perbaiki bertahap agar mudah ditinjau.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
          <h3 className="text-[12px] font-bold text-ink-900">Kelengkapan naskah</h3>
          <p className="mt-1 text-[11.5px] text-ink-600">
            {kosong.length === 0
              ? "Semua bagian sudah berisi."
              : `${kosong.length} bagian belum berisi: ${kosong
                  .slice(0, 4)
                  .map((s) => s.labelId)
                  .join(", ")}${kosong.length > 4 ? "…" : ""}`}
          </p>
          <p className="mt-2 text-[11.5px] text-ink-600">
            Rujukan tersimpan: <strong>{p.sumber.length}</strong> · istilah:{" "}
            <strong>{p.istilah.length}</strong>
          </p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
          <h3 className="text-[12px] font-bold text-ink-900">Yang tidak diperiksa mesin</h3>
          <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-ink-600">
            <li>• Kebenaran isi dan kesesuaian data lapangan</li>
            <li>• Ketepatan nahwu/sharaf pada kalimat Anda</li>
            <li>• Validitas kutipan terhadap sumber aslinya</li>
            <li>• Pedoman format kampus (margin, font, penomoran)</li>
          </ul>
        </div>
      </div>

      <CrosscheckPanel p={p} ubah={ubah} />
    </div>
  );
}
