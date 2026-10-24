"use client";

import { useMemo, useState } from "react";
import { hitungBatas, type HasilBatas } from "@/lib/refs/footnote";
import { pedomanDefault, type PedomanRules } from "@/lib/refs/pedoman";
import { IconCheck, IconScale } from "@/components/icons";

/**
 * Strip "Periksa Batas" — memeriksa naskah terhadap pedoman kampus:
 * jumlah footnote per paragraf, perkiraan halaman A4, dan target font.
 *
 * Perkiraan halaman memakai konstanta kata-per-halaman yang kasar, jadi
 * kalimatnya selalu menyebut "perkiraan" — bukan pengukuran Word.
 */
export function BatasStrip({
  teks,
  pedoman,
  label = "Periksa Batas",
  ringkas = false,
  testId = "batas-periksa",
}: {
  teks: string;
  pedoman?: PedomanRules | null;
  label?: string;
  ringkas?: boolean;
  /** Id unik untuk pengujian; satu halaman bisa memuat lebih dari satu strip. */
  testId?: string;
}) {
  const p: PedomanRules = pedoman ?? pedomanDefault();
  const [hasil, setHasil] = useState<HasilBatas | null>(null);

  const adaIsi = useMemo(() => teks.trim().length > 0, [teks]);

  return (
    <div className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</p>
        <button
          type="button"
          onClick={() => setHasil(hitungBatas(teks, p))}
          disabled={!adaIsi}
          data-testid={testId}
          className="btn-quiet !px-2.5 !py-1 !text-[11px] disabled:opacity-40"
        >
          <IconScale className="h-3 w-3" /> Periksa
        </button>
      </div>

      {hasil ? (
        <div className="mt-2">
          <p className="text-[11.5px] text-ink-700">
            {hasil.footnoteTotal} footnote · ±{hasil.kata} kata · ±{hasil.halamanPerkiraan} halaman A4 · target{" "}
            {hasil.target.font} {hasil.target.ukuran} pt spasi {String(hasil.target.spasi).replace(".", ",")}
          </p>
          {!ringkas && hasil.paragraf.length > 0 && (
            <p className="mt-1 text-[11px] text-ink-500">
              Footnote per paragraf:{" "}
              {hasil.paragraf.map((x) => `${x.nomor}:${x.jumlah}`).join(" · ")} (maks {p.maksFootnotePerParagraf})
            </p>
          )}
          {hasil.pelanggaran.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {hasil.pelanggaran.map((v) => (
                <li key={v} className="text-[11px] text-amber-800">
                  ! {v}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-800">
              <IconCheck className="h-3 w-3" /> Batas terpenuhi (perkiraan, bukan pengukuran Word).
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-ink-500">
          Periksa jumlah footnote per paragraf, perkiraan halaman A4, dan target format naskah.
        </p>
      )}
    </div>
  );
}
