"use client";

import { useMemo, useState } from "react";
import { FRASA } from "@/lib/content/frasa";
import { getStruktur } from "@/lib/content/struktur";
import type { KaryaType } from "@/lib/content/types";
import { CopyButton } from "@/components/ui";

const BAGIAN = Array.from(
  new Map(
    getStruktur("skripsi")
      .chapters.flatMap((c) => c.sections)
      .concat(getStruktur("jurnal").chapters.flatMap((c) => c.sections))
      .map((s) => [s.id, s.labelId]),
  ),
).map(([id, label]) => ({ id, label }));

export function AlatFrasa() {
  const [q, setQ] = useState("");
  const [bagian, setBagian] = useState<string>("semua");
  const [tag, setTag] = useState<string>("semua");

  const tagSemua = useMemo(() => {
    const set = new Set<string>();
    FRASA.forEach((f) => f.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, []);

  const hasil = useMemo(() => {
    const kueri = q.trim().toLowerCase();
    return FRASA.filter((f) => {
      if (bagian !== "semua" && f.section !== bagian) return false;
      if (tag !== "semua" && !f.tags.includes(tag)) return false;
      if (!kueri) return true;
      return [f.ar, f.arti, f.tags.join(" "), f.section].join(" ").toLowerCase().includes(kueri);
    });
  }, [q, bagian, tag]);

  return (
    <section id="frasa" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Alat ٠٤</span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">
            Bank frasa akademik
          </h2>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-600">
            {FRASA.length} pola kalimat Arab per bagian naskah. Ganti penanda{" "}
            <code className="rounded bg-ink-900/5 px-1 text-[11px]">{"{{topik}}"}</code> dengan
            istilah penelitian Anda.
          </p>
          <p className="mt-2 max-w-xl rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-800">
            Ingat: pola ini kerangka awal, bukan kalimat jadi. Tulis ulang dengan data dan kata-katamu
            sendiri — naskah yang seluruhnya disusun dari pola yang sama akan terdengar seragam dan
            berisiko terdeteksi sebagai jiplakan pola oleh pemeriksa kesamaan (similarity).
          </p>
        </div>
        <span className="chip">{hasil.length} tampil</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari kata kunci Arab atau Indonesia…"
        />
        <select className="input" value={bagian} onChange={(e) => setBagian(e.target.value)}>
          <option value="semua">Semua bagian</option>
          {BAGIAN.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="semua">Semua tag</option>
          {tagSemua.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2">
        {hasil.slice(0, 60).map((f) => (
          <figure key={f.id} className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
            <blockquote dir="rtl" className="font-naskh text-[15.5px] leading-loose text-ink-900">
              {f.ar}
            </blockquote>
            <figcaption className="mt-2.5 flex items-start justify-between gap-3 border-t border-dashed border-ink-900/10 pt-2.5">
              <p className="text-[11.5px] leading-relaxed text-ink-600">
                <span className="font-semibold text-gold-700">#{f.section}</span> · {f.arti}
              </p>
              <CopyButton teks={f.ar} label="" className="btn-quiet shrink-0 !px-1.5" />
            </figcaption>
          </figure>
        ))}
      </div>

      {hasil.length === 0 && (
        <p className="mt-6 rounded-xl bg-parchment-100 p-6 text-center text-[13px] text-ink-600">
          Tidak ada frasa yang cocok. Coba kata kunci lain atau pilih «semua bagian».
        </p>
      )}
      {hasil.length > 60 && (
        <p className="mt-3 text-[11px] text-ink-500">
          Menampilkan 60 dari {hasil.length}. Persempit dengan filter bagian atau tag.
        </p>
      )}
    </section>
  );
}
