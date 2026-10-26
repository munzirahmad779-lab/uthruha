"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { strukturProyek } from "@/lib/content/struktur";
import { composeSection } from "@/lib/engine/compose";
import type { Project } from "@/lib/engine/project";
import { IconArrowRight, IconCheck, IconDownload, IconPen, IconSearch, IconSparkle } from "@/components/icons";
import { CopyButton, Note } from "@/components/ui";
import { Manuscript } from "@/components/manuscript";
import { RefFinder } from "@/components/workspace/ref-finder";
import { PasangFootnote } from "@/components/workspace/pasang-footnote";
import { FootnoteBagian } from "@/components/workspace/footnote-bagian";
import { BatasStrip } from "@/components/workspace/batas-strip";

export function TulisTab({
  p,
  ubah,
  bagian,
  setBagian,
  onSusun,
}: {
  p: Project;
  ubah: (patch: Partial<Project>) => void;
  bagian: string;
  setBagian: (id: string) => void;
  onSusun: (id: string) => void;
}) {
  const st = strukturProyek(p);
  const semua = st.chapters.flatMap((c) => c.sections.map((s) => ({ ...s, bab: c.labelAr })));
  const aktif = semua.find((s) => s.id === bagian) ?? semua[0];
  const [teks, setTeks] = useState(p.draf[bagian] ?? "");
  const [pratinjau, setPratinjau] = useState(false);
  const [cariRujukan, setCariRujukan] = useState(false);
  const [pasangTarget, setPasangTarget] = useState<{ sumber: import("@/lib/engine/cite").Sumber; kutipan?: string } | null>(null);
  const [pesanPasang, setPesanPasang] = useState("");
  const sinkron = useRef(p.draf[bagian] ?? "");

  // Ganti bagian: muat draf bagian tersebut.
  useEffect(() => {
    const isi = p.draf[bagian] ?? "";
    setTeks(isi);
    sinkron.current = isi;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagian]);

  // Draf berubah dari luar (tombol susun di tab lain).
  useEffect(() => {
    const isi = p.draf[bagian] ?? "";
    if (isi !== sinkron.current) {
      sinkron.current = isi;
      setTeks(isi);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.draf[bagian]]);

  // Simpan tertunda.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (teks !== sinkron.current) {
        sinkron.current = teks;
        ubah({ draf: { ...p.draf, [bagian]: teks } });
      }
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teks]);

  const kata = useMemo(() => teks.split(/\s+/).filter(Boolean).length, [teks]);
  const selesai = semua.filter((s) => (p.draf[s.id] ?? "").trim().length > 80).length;

  function susunUlang() {
    const hasil = composeSection(p, bagian, Date.now() % 100000);
    setTeks(hasil.markdown);
    sinkron.current = hasil.markdown;
    ubah({ draf: { ...p.draf, [bagian]: hasil.markdown } });
  }

  function sisipkan(jawaban: string) {
    const gabung = `${teks.trim()}\n\n${jawaban.trim()}`;
    setTeks(gabung);
    sinkron.current = gabung;
    ubah({ draf: { ...p.draf, [bagian]: gabung } });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[210px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
            Bagian naskah
          </h2>
          <span className="text-[10px] font-semibold text-ink-500">
            {selesai}/{semua.length}
          </span>
        </div>
        <nav className="mt-2 max-h-[26rem] space-y-0.5 overflow-y-auto pe-1 doc-scroll lg:max-h-[calc(100vh-12rem)]">
          {st.chapters.map((c) => (
            <div key={c.id} className="pt-2 first:pt-0">
              <p className="mb-1 font-arabic text-[10.5px] text-ink-400" dir="rtl">
                {c.babAr}
              </p>
              {c.sections.map((s) => {
                const on = s.id === aktif?.id;
                const sudah = (p.draf[s.id] ?? "").trim().length > 80;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBagian(s.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition ${
                      on ? "bg-ink-900 text-parchment-100" : "text-ink-700 hover:bg-ink-900/5"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        sudah ? "bg-emerald-500" : on ? "bg-parchment-200/50" : "bg-ink-900/20"
                      }`}
                    />
                    <span className="truncate">{s.labelId}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-900/10 pb-3">
          <div className="min-w-0">
            <p className="text-right font-arabic text-lg font-bold leading-relaxed text-ink-900" dir="rtl">
              {aktif?.headingAr}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-500">
              {aktif?.labelId} · {aktif?.bab} · target ±{aktif?.targetKata.toLocaleString("id-ID")} kata
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => onSusun(bagian)} className="btn-quiet">
              <IconPen className="h-3.5 w-3.5" /> Susun draf
            </button>
            <button type="button" onClick={() => setCariRujukan(true)} className="btn-quiet">
              <IconSearch className="h-3.5 w-3.5" /> Cari Rujukan
            </button>
            <button type="button" onClick={susunUlang} className="btn-quiet">
              <IconSparkle className="h-3.5 w-3.5" /> Variasi
            </button>
            <CopyButton teks={teks} />
            <button
              type="button"
              onClick={() => setPratinjau((v) => !v)}
              data-testid="tulis-pratinjau"
              className={`btn-quiet ${pratinjau ? "!bg-ink-900 !text-parchment-100" : ""}`}
            >
              <IconCheck className="h-3.5 w-3.5" /> Pratinjau
            </button>
          </div>
        </div>

        <p className="mt-3 rounded-xl bg-parchment-100/80 px-3 py-2 text-[12px] leading-relaxed text-ink-700">
          <span className="font-semibold text-ink-900">Panduan: </span>
          {aktif?.panduan}
        </p>

        {aktif?.pemicu && aktif.pemicu.length > 0 && (
          <details className="mt-3 rounded-xl border border-ink-900/10 bg-white/60 px-3 py-2">
            <summary className="cursor-pointer text-[12px] font-semibold text-ink-800">
              Pertanyaan pemicu ({aktif.pemicu.length}) — jawab dulu agar draf tidak generik
            </summary>
            <div className="mt-3 space-y-3">
              {aktif.pemicu.map((q, i) => {
                const kunci = `${bagian}:${i}`;
                const nilai = p.jawaban[kunci] ?? "";
                return (
                  <div key={kunci}>
                    <label className="block text-[12px] text-ink-700">{q}</label>
                    <div className="mt-1 flex gap-1.5">
                      <textarea
                        value={nilai}
                        onChange={(e) => ubah({ jawaban: { ...p.jawaban, [kunci]: e.target.value } })}
                        className="input min-h-14 text-[12px]"
                        placeholder="Jawaban singkat…"
                      />
                      <button
                        type="button"
                        onClick={() => sisipkan(nilai)}
                        disabled={!nilai.trim()}
                        title="Sisipkan jawaban ke akhir draf"
                        className="btn-quiet shrink-0 disabled:opacity-40"
                      >
                        <IconArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {aktif?.butuhData && (
          <div className="mt-3">
            <Note jenis="warn">
              Bagian ini butuh data lapangan Anda sendiri. Draf otomatis hanya menyiapkan
              kerangka tabel dan alur analisis — angka dan temuan wajib Anda isi.
            </Note>
          </div>
        )}

        <div className="mt-3">
          {pratinjau ? (
            <div className="rounded-xl border border-ink-900/10 bg-white p-5">
              <Manuscript md={teks} angkaArab={p.pedoman?.angkaArab ?? true} />
            </div>
          ) : (
            <textarea
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              dir="rtl"
              spellCheck={false}
              className="doc-scroll min-h-[26rem] w-full rounded-xl border border-ink-900/15 bg-white p-4 text-right font-naskh text-[15.5px] leading-[2.1] text-ink-900 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
              placeholder="اكتب هنا، أو اضغط «Susun draf» لتوليد هيكل أولي…"
            />
          )}
        </div>

        {cariRujukan && (
          <RefFinder
            p={p}
            tutup={() => setCariRujukan(false)}
            onPasang={(sumber, kutipan) => {
              setCariRujukan(false);
              setPasangTarget({ sumber, kutipan });
            }}
            onSisip={(blok, sumberBaru) => {
              const gabung = `${teks.trim()}\n\n${blok}`;
              setTeks(gabung);
              sinkron.current = gabung;
              ubah({ draf: { ...p.draf, [bagian]: gabung }, sumber: [...p.sumber, ...sumberBaru] });
              setCariRujukan(false);
            }}
          />
        )}

        {pasangTarget && (
          <PasangFootnote
            p={p}
            ubah={ubah}
            sumber={pasangTarget.sumber}
            kutipan={pasangTarget.kutipan}
            babAwalId={bagian}
            onTutup={() => setPasangTarget(null)}
            onTerpasang={(m, drafMapBaru) => {
              setPesanPasang(m);
              // Segarkan editor dari draf hasil pemasangan agar penanda tidak tertimpa.
              const baru = drafMapBaru?.[bagian];
              if (typeof baru === "string") {
                setTeks(baru);
                sinkron.current = baru;
              }
            }}
          />
        )}
        {pesanPasang && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">{pesanPasang}</p>
        )}

        <FootnoteBagian
          p={p}
          bagian={bagian}
          onCariRujukan={() => setCariRujukan(true)}
          onPasang={(sumber) => setPasangTarget({ sumber })}
        />

        <div className="mt-3">
          <BatasStrip teks={teks} pedoman={p.pedoman} />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-500">
          <span>
            {kata.toLocaleString("id-ID")} kata · {teks.length.toLocaleString("id-ID")} karakter ·{" "}
            {aktif?.targetKata
              ? `${Math.min(100, Math.round((kata / aktif.targetKata) * 100))}% dari target`
              : "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <IconDownload className="h-3.5 w-3.5" /> Ekspor tersedia di tab Ekspor
          </span>
        </div>
      </div>
    </div>
  );
}
