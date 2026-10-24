"use client";

import { useState } from "react";
import {
  JENIS_LABEL,
  catatanKaki,
  entriDaftarPustaka,
  entriIndonesia,
  kutipanDalamTeks,
  sumberBaru,
  susunDaftarPustaka,
  type JenisSumber,
  type Sumber,
} from "@/lib/engine/cite";
import { CopyButton, Field, Note } from "@/components/ui";

const AWAL: Sumber = {
  ...sumberBaru("kitab"),
  penulis: "القرطبي، أبو عبد الله محمد",
  tahun: "1964",
  judul: "الجامع لأحكام القرآن",
  kota: "القاهرة",
  penerbit: "دار الكتب المصرية",
  tahqiq: "أحمد البردوني",
  jilid: "1",
  halaman: "23",
};

export function AlatSitasi() {
  const [s, setS] = useState<Sumber>(AWAL);
  const [kumpulan, setKumpulan] = useState<Sumber[]>([]);

  const daftar = susunDaftarPustaka(kumpulan);
  const teksDaftar = daftar
    .map((g) => `${g.judul}\n${g.entri.map((e, i) => `${i + 1}. ${e}`).join("\n")}`)
    .join("\n\n");

  function ubah(patch: Partial<Sumber>) {
    setS((lama) => ({ ...lama, ...patch }));
  }

  return (
    <section id="sitasi" className="scroll-mt-24">
      <div>
        <span className="eyebrow">Alat ٠٣</span>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">
          Penyusun sitasi & daftar rujukan
        </h2>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-600">
          Satu data sumber, empat bentuk keluaran: kutipan dalam teks, catatan kaki gaya kitab,
          entri daftar pustaka Arab, dan padanan gaya Indonesia.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenis">
              <select
                className="input"
                value={s.jenis}
                onChange={(e) => ubah({ jenis: e.target.value as JenisSumber })}
              >
                {(Object.keys(JENIS_LABEL) as JenisSumber[]).map((j) => (
                  <option key={j} value={j}>
                    {JENIS_LABEL[j].id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tahun">
              <input className="input" value={s.tahun} onChange={(e) => ubah({ tahun: e.target.value })} />
            </Field>
            <Field label="Penulis (Arab)" className="sm:col-span-2">
              <input
                dir="rtl"
                className="input text-right font-naskh"
                value={s.penulis}
                onChange={(e) => ubah({ penulis: e.target.value })}
              />
            </Field>
            <Field label="Judul (Arab)" className="sm:col-span-2">
              <input
                dir="rtl"
                className="input text-right font-naskh text-[15px]"
                value={s.judul}
                onChange={(e) => ubah({ judul: e.target.value })}
              />
            </Field>
            <Field label="Kota">
              <input dir="rtl" className="input text-right font-naskh" value={s.kota ?? ""} onChange={(e) => ubah({ kota: e.target.value })} />
            </Field>
            <Field label="Penerbit">
              <input dir="rtl" className="input text-right font-naskh" value={s.penerbit ?? ""} onChange={(e) => ubah({ penerbit: e.target.value })} />
            </Field>
            <Field label="تحقيق">
              <input dir="rtl" className="input text-right font-naskh" value={s.tahqiq ?? ""} onChange={(e) => ubah({ tahqiq: e.target.value })} />
            </Field>
            <Field label="Jilid / halaman">
              <div className="flex gap-2">
                <input className="input" value={s.jilid ?? ""} onChange={(e) => ubah({ jilid: e.target.value })} placeholder="jilid" />
                <input className="input" value={s.halaman ?? ""} onChange={(e) => ubah({ halaman: e.target.value })} placeholder="hal." />
              </div>
            </Field>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!s.penulis.trim() || !s.judul.trim()) return;
                setKumpulan((k) => [...k, { ...s, id: `s-${Date.now()}` }]);
              }}
              className="btn-ghost !py-2 !text-[12px]"
            >
              Tambahkan ke daftar uji
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { label: "Kutipan dalam teks", nilai: kutipanDalamTeks(s) },
            { label: "Catatan kaki", nilai: catatanKaki(s) },
            { label: "Entri daftar pustaka", nilai: entriDaftarPustaka(s) },
            { label: "Gaya Indonesia (APA)", nilai: entriIndonesia(s) },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {f.label}
                </p>
                <CopyButton teks={f.nilai} label="" className="btn-quiet !px-1.5" />
              </div>
              <p dir="auto" className="mt-1 text-[13px] leading-relaxed text-ink-900">
                {f.nilai}
              </p>
            </div>
          ))}
        </div>
      </div>

      {kumpulan.length > 0 && (
        <div className="mt-4 rounded-xl border border-ink-900/10 bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-ink-900">
              Daftar rujukan (urut kaidah Arab)
            </h3>
            <CopyButton teks={teksDaftar} label="Salin daftar" />
          </div>
          <div className="mt-2 space-y-3">
            {daftar.map((g) => (
              <div key={g.judul}>
                <p className="font-arabic text-[12px] font-semibold text-gold-700" dir="rtl">
                  {g.judul}
                </p>
                <ol className="mt-1 space-y-1">
                  {g.entri.map((e, i) => (
                    <li key={i} dir="rtl" className="text-right font-naskh text-[13px] leading-relaxed text-ink-800">
                      {i + 1}. {e}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <Note>
          Format mengikuti gaya catatan kaki kitab yang lazim di naskah Arab, bukan APA terjemahan.
          Susunan akhir tetap mengikuti pedoman kampus atau jurnal target.
        </Note>
      </div>
    </section>
  );
}
