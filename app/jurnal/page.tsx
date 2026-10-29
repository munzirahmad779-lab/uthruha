"use client";

import { useMemo, useState } from "react";
import { BIDANG } from "@/lib/content/bidang";
import { JURNAL } from "@/lib/content/jurnal";
import { cocokkanJurnal, filterJurnal } from "@/lib/engine/match";
import { IconExternal, IconSearch, IconSparkle } from "@/components/icons";
import { Note } from "@/components/ui";

export default function JurnalPage() {
  const [q, setQ] = useState("");
  const [bidang, setBidang] = useState("");
  const [akses, setAkses] = useState("");
  const [teks, setTeks] = useState("");
  const [modeCocok, setModeCocok] = useState(false);

  const hasil = useMemo(() => filterJurnal({ q, bidang, akses }), [q, bidang, akses]);
  const skor = useMemo(
    () => (teks.trim().length > 20 ? cocokkanJurnal(teks, bidang || undefined) : []),
    [teks, bidang],
  );

  return (
    <div className="wrap py-10 sm:py-14">
      <header className="max-w-2xl">
        <span className="eyebrow">Direktori</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.6rem]">
          Jurnal yang menerima naskah berbahasa Arab
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
          {JURNAL.length} judul: jurnal kajian Islam di Indonesia dan judul internasional yang
          memuat karya berbahasa Arab. Data bersifat indikatif — setiap entri memuat catatan apa
          yang harus Anda periksa sendiri.
        </p>
      </header>

      <div className="mt-6 grid gap-2 sm:grid-cols-[1.6fr_1fr_1fr]">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama jurnal, penerbit, atau cakupan…"
          />
        </div>
        <select className="input" value={bidang} onChange={(e) => setBidang(e.target.value)}>
          <option value="">Semua bidang</option>
          {BIDANG.map((b) => (
            <option key={b.id} value={b.id}>
              {b.labelId}
            </option>
          ))}
        </select>
        <select className="input" value={akses} onChange={(e) => setAkses(e.target.value)}>
          <option value="">Semua akses</option>
          <option value="Terbuka">Akses terbuka</option>
          <option value="Hibrida">Hibrida</option>
          <option value="Berlangganan">Berlangganan</option>
        </select>
      </div>

      <div className="mt-4 rounded-2xl border border-ink-900/10 bg-white/70 p-4">
        <button
          type="button"
          onClick={() => setModeCocok((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="text-[13px] font-bold text-ink-900">Pemadu jurnal</span>
            <span className="mt-0.5 block text-[11.5px] text-ink-600">
              Tempel judul dan abstrak Anda, lalu lihat jurnal yang cakupannya paling dekat.
            </span>
          </span>
          <span className="btn-quiet shrink-0">
            {modeCocok ? "Tutup" : "Buka"} <IconSparkle className="h-3.5 w-3.5" />
          </span>
        </button>

        {modeCocok && (
          <div className="mt-3">
            <textarea
              className="input min-h-28 text-right font-naskh text-[14px] leading-loose"
              dir="rtl"
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              placeholder="عنوان البحث وملخصه…"
            />
            <div className="mt-3 space-y-2">
              {skor.map((s) => (
                <div
                  key={s.jurnal.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-900/10 bg-parchment-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink-900">
                      {s.jurnal.namaLatin}
                    </p>
                    <p className="truncate text-[10.5px] text-ink-500">{s.jurnal.cakupan}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-900/10">
                      <span
                        className="block h-full rounded-full bg-gold-500"
                        style={{ width: `${s.skor}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-[11px] font-bold text-ink-800">
                      {s.skor}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {teks.trim().length > 20 && skor.length === 0 && (
              <p className="mt-2 text-[11.5px] text-ink-500">
                Tidak ada kalimat kunci yang cocok. Periksa kembali bahasa teks (Arab) atau pilih
                bidang tertentu.
              </p>
            )}
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
              Skor dihitung dari irisan kalimat kunci antara teks Anda dan cakupan jurnal. Ini
              indikator awal, bukan keputusan editorial.
            </p>
          </div>
        )}
      </div>

      <p className="mt-5 text-[11px] text-ink-500">{hasil.length} jurnal ditampilkan</p>

      <div className="mt-2 grid gap-2.5 md:grid-cols-2">
        {hasil.map((j) => (
          <article key={j.id} className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-arabic text-[14px] font-semibold text-ink-900" dir="rtl">
                  {j.namaAr}
                </p>
                <h2 className="mt-1 text-[12.5px] font-bold leading-snug text-ink-800">
                  {j.namaLatin}
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-500">{j.penerbit}</p>
              </div>
              <a
                href={j.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Buka laman resmi"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-900/15 text-ink-600 hover:border-gold-500 hover:text-gold-700"
              >
                <IconExternal className="h-3.5 w-3.5" />
              </a>
            </div>

            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-700">{j.cakupan}</p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="chip !py-0.5 !text-[10px]">{j.bahasa}</span>
              <span className="chip !py-0.5 !text-[10px]">{j.akses}</span>
              <span className="chip !py-0.5 !text-[10px]">{j.apc}</span>
              {j.indeks.map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-gold-500/30 bg-gold-100/60 px-2 py-0.5 text-[10px] font-semibold text-ink-700"
                >
                  {i}
                </span>
              ))}
            </div>

            <p className="mt-2.5 border-t border-dashed border-ink-900/10 pt-2 text-[10.5px] leading-relaxed text-ink-500">
              {j.catatan}
            </p>
            {j.terakhirDiverifikasi && (
              <p className="mt-1 text-[10.5px] text-ink-400">
                Tautan resmi terakhir diverifikasi: {j.terakhirDiverifikasi}
              </p>
            )}
          </article>
        ))}
      </div>

      {hasil.length === 0 && (
        <div className="mt-8 card p-8 text-center">
          <p className="text-[13px] text-ink-600">Tidak ada jurnal yang cocok dengan filter ini.</p>
        </div>
      )}

      <div className="mt-8">
        <Note jenis="warn">
          <strong>Wajib diverifikasi.</strong> Status indeks, biaya publikasi, dan cakupan jurnal
          berubah dari waktu ke waktu. Buka laman resmi setiap jurnal sebelum mengirim naskah, dan
          jangan pernah membayar ke rekening yang tidak tercantum di laman resmi penerbit.
        </Note>
      </div>
    </div>
  );
}
