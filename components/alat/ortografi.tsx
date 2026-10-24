"use client";

import { useMemo, useState } from "react";
import { perbaikiOtomatis, periksaOrtografi } from "@/lib/engine/orthografi";
import { IconSparkle, IconCheck } from "@/components/icons";
import { CopyButton, Note, Stat } from "@/components/ui";

const CONTOH = `انشاء الله سيكون هذا البحث مفيدا, وتظهر المشكلة في ضعف الطلاب في المحادثة ؛ حيث انهم يدرسون النحو سنوات عديدة .. ولكنهم لا يستطيعون التحدث . ولذلك يرى الباحث ان هذه المسالة تستحق الدراسة في مكتبه الجامعه.`;

const LEVEL: Record<string, string> = {
  kritis: "bg-red-50 text-red-700 border-red-200",
  saran: "bg-amber-50 text-amber-800 border-amber-200",
  info: "bg-ink-900/5 text-ink-700 border-ink-900/10",
};

export function AlatOrtografi() {
  const [teks, setTeks] = useState("");
  const laporan = useMemo(() => periksaOrtografi(teks), [teks]);
  const kritis = laporan.temuan.filter((t) => t.tingkat === "kritis").length;

  return (
    <section id="ortografi" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Alat ٠١</span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">
            Pemeriksa ortografi Arab
          </h2>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-600">
            Menangkap hamzah yang hilang, ة yang ditulis ه, kata terulang, spasi sebelum tanda
            baca, dan tanda baca Latin di dalam kalimat Arab.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setTeks(CONTOH)} className="btn-quiet">
            Isi contoh
          </button>
          <button
            type="button"
            onClick={() => setTeks((t) => perbaikiOtomatis(t))}
            disabled={!teks.trim()}
            className="btn-gold !py-2 !text-[12px]"
          >
            <IconSparkle className="h-3.5 w-3.5" /> Perbaiki otomatis
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <textarea
            dir="rtl"
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="ألصق فقرة من بحثك هنا…"
            className="doc-scroll min-h-64 w-full rounded-xl border border-ink-900/15 bg-white p-4 text-right font-naskh text-[15.5px] leading-[2.05] text-ink-900 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-ink-500">
              {laporan.statistik.kata} kata · {laporan.statistik.kalimat} kalimat ·{" "}
              {laporan.statistik.rasioArab}% Arab
            </span>
            {teks.trim() && <CopyButton teks={teks} label="Salin hasil" />}
          </div>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Temuan" nilai={laporan.temuan.length} />
            <Stat label="Kritis" nilai={kritis} />
            <Stat label="Halaman ±" nilai={laporan.statistik.halamanPerkiraan} />
          </div>

          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-ink-900/10 bg-white/70 doc-scroll">
            {laporan.temuan.length === 0 ? (
              <p className="flex items-center gap-2 px-3 py-6 text-center text-[12px] text-ink-500">
                <IconCheck className="h-4 w-4 text-emerald-600" />
                {teks.trim() ? "Tidak ada pola yang tertangkap." : "Tempel teks untuk memulai."}
              </p>
            ) : (
              <ul className="divide-y divide-ink-900/5">
                {laporan.temuan.slice(0, 60).map((t) => (
                  <li key={t.id} className="px-3 py-2">
                    <p className="flex items-center gap-2">
                      <span
                        className={`rounded border px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider ${LEVEL[t.tingkat]}`}
                      >
                        {t.tingkat}
                      </span>
                      <span className="text-[10.5px] font-semibold text-ink-600">{t.aturan}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-baseline gap-1.5">
                      <span className="rounded bg-red-50 px-1 font-naskh text-[13px] text-red-900" dir="rtl">
                        {t.kutipan}
                      </span>
                      <span className="text-[11px] leading-relaxed text-ink-700">{t.saran}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Note>
          Pemeriksaan ini berbasis pola dan kamus internal — bukan model bahasa. Ia tidak
          menggantikan pembacaan ulang untuk nahwu, sharaf, dan ketepatan makna.
        </Note>
      </div>
    </section>
  );
}
