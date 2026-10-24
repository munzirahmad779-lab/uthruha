"use client";

import { useMemo, useState } from "react";
import { SIDANG } from "@/lib/content/sidang";
import { IconChevronDown } from "@/components/icons";

const KATEGORI = [
  { id: "semua", label: "Semua" },
  { id: "metode", label: "Metode" },
  { id: "teori", label: "Teori" },
  { id: "sumber", label: "Sumber" },
  { id: "etika", label: "Etika" },
  { id: "kebaruan", label: "Kebaruan" },
  { id: "penulisan", label: "Penulisan" },
];

const METODE = [
  { id: "semua", label: "Semua metode" },
  { id: "kuantitatif", label: "Kuantitatif" },
  { id: "kualitatif", label: "Kualitatif" },
  { id: "mixed", label: "Campuran" },
];

export function AlatSidang() {
  const [kategori, setKategori] = useState("semua");
  const [metode, setMetode] = useState("semua");
  const [buka, setBuka] = useState<string | null>(null);

  const hasil = useMemo(
    () =>
      SIDANG.filter((s) => {
        if (kategori !== "semua" && s.kategori !== kategori) return false;
        if (metode !== "semua" && s.metode && !s.metode.includes(metode as never)) return false;
        return true;
      }),
    [kategori, metode],
  );

  return (
    <section id="sidang" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Alat ٠٥</span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">
            Simulasi pertanyaan sidang
          </h2>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-600">
            {SIDANG.length} pertanyaan yang realistis diucapkan penguji — dalam bahasa Indonesia
            dan Arab — beserta bukti naskah yang harus Anda tunjukkan.
          </p>
        </div>
        <span className="chip">{hasil.length} pertanyaan</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {KATEGORI.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKategori(k.id)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              kategori === k.id
                ? "border-ink-900 bg-ink-900 text-parchment-100"
                : "border-ink-900/15 bg-white/70 text-ink-600 hover:border-ink-900/30"
            }`}
          >
            {k.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-900/15" />
        <select
          className="rounded-lg border border-ink-900/15 bg-white px-2 py-1 text-[11px]"
          value={metode}
          onChange={(e) => setMetode(e.target.value)}
        >
          {METODE.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-2.5">
        {hasil.map((s, i) => {
          const terbuka = buka === s.id;
          return (
            <article key={s.id} className="rounded-xl border border-ink-900/10 bg-white/70">
              <button
                type="button"
                onClick={() => setBuka(terbuka ? null : s.id)}
                aria-expanded={terbuka}
                className="flex w-full items-start gap-3 p-3.5 text-left"
              >
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-parchment-200 text-[10px] font-bold text-ink-700">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-ink-900/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-600">
                      {s.kategori}
                    </span>
                    {s.metode?.map((m) => (
                      <span key={m} className="text-[9px] font-medium uppercase tracking-wider text-ink-400">
                        {m}
                      </span>
                    ))}
                  </span>
                  <span className="mt-1 block text-[13px] font-semibold leading-relaxed text-ink-900">
                    {s.pertanyaanId}
                  </span>
                  <span
                    dir="rtl"
                    className="mt-1 block text-right font-naskh text-[14.5px] leading-loose text-ink-700"
                  >
                    {s.pertanyaanAr}
                  </span>
                </span>
                <IconChevronDown
                  className={`mt-1 h-4 w-4 shrink-0 text-ink-400 transition-transform ${terbuka ? "rotate-180" : ""}`}
                />
              </button>
              {terbuka && (
                <div className="border-t border-dashed border-ink-900/10 px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gold-700">
                    Cara menjawab
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-700">{s.tipsId}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
