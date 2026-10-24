"use client";

import { useState } from "react";
import { arabKeLatin, latinKeArab, type GayaArab, type ModeLatin } from "@/lib/engine/translit";
import { CopyButton, Note } from "@/components/ui";

export function AlatTransliterasi() {
  const [arab, setArab] = useState("القرطبي، الجامع لأحكام القرآن");
  const [gaya, setGaya] = useState<GayaArab>("sederhana");
  const [latin, setLatin] = useState("Muhammad Fauzan");
  const [mode, setMode] = useState<ModeLatin>("akademik");

  return (
    <section id="transliterasi" className="scroll-mt-24">
      <div>
        <span className="eyebrow">Alat ٠٢</span>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">
          Transliterasi dua arah
        </h2>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-600">
          Nama penulis, nama tempat, dan istilah. Mode akademik cocok untuk istilah Arab;
          mode fonetis cocok untuk nama Indonesia yang harus ditulis dengan vokal panjang.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Arab → Latin
            </p>
            <select
              className="rounded-lg border border-ink-900/15 bg-white px-2 py-1 text-[11px]"
              value={gaya}
              onChange={(e) => setGaya(e.target.value as GayaArab)}
            >
              <option value="sederhana">Gaya sederhana</option>
              <option value="ilmiah">Gaya ilmiah (ḥ, ṣ, ʿ)</option>
            </select>
          </div>
          <textarea
            dir="rtl"
            value={arab}
            onChange={(e) => setArab(e.target.value)}
            className="mt-2 min-h-20 w-full rounded-lg border border-ink-900/10 bg-parchment-50 p-3 text-right font-naskh text-[15px] leading-loose outline-none focus:border-gold-500"
          />
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-ink-900 p-3">
            <p className="flex-1 break-words text-[13.5px] leading-relaxed text-parchment-100">
              {arabKeLatin(arab, gaya) || "—"}
            </p>
            <CopyButton
              teks={arabKeLatin(arab, gaya)}
              label=""
              className="btn-quiet shrink-0 !text-parchment-200 hover:!bg-white/10"
            />
          </div>
        </div>

        <div className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Latin → Arab
            </p>
            <select
              className="rounded-lg border border-ink-900/15 bg-white px-2 py-1 text-[11px]"
              value={mode}
              onChange={(e) => setMode(e.target.value as ModeLatin)}
            >
              <option value="akademik">Akademik (istilah)</option>
              <option value="fonetis">Fonetis (nama)</option>
            </select>
          </div>
          <textarea
            value={latin}
            onChange={(e) => setLatin(e.target.value)}
            className="mt-2 min-h-20 w-full rounded-lg border border-ink-900/10 bg-parchment-50 p-3 text-[13.5px] outline-none focus:border-gold-500"
          />
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-ink-900 p-3">
            <p dir="rtl" className="flex-1 break-words text-right font-naskh text-[16px] leading-loose text-parchment-100">
              {latinKeArab(latin, mode) || "—"}
            </p>
            <CopyButton
              teks={latinKeArab(latin, mode)}
              label=""
              className="btn-quiet shrink-0 !text-parchment-200 hover:!bg-white/10"
            />
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Note jenis="warn">
          Transliterasi nama tidak punya satu jawaban benar. Hasil di sini adalah titik mulai —
          cocokkan dengan ejaan yang dipakai di dokumen resmi (KTP, ijazah) atau pedoman
          transliterasi kampus Anda.
        </Note>
      </div>
    </section>
  );
}
