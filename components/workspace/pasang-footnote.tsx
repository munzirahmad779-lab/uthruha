"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/lib/engine/project";
import type { Sumber } from "@/lib/engine/cite";
import { strukturProyek } from "@/lib/content/struktur";
import { composeNaskah, composeSection } from "@/lib/engine/compose";
import { kompilasiMarker } from "@/lib/engine/marker";
import { footnoteGaya, footnotePedoman, gayaSah } from "@/lib/engine/citation";

/**
 * Pasang footnote terarah: dari satu rujukan temuan, mahasiswa memilih
 * bagian → paragraf → setelah kalimat ke berapa penanda sitasi ditanam.
 * Pratinjau menampilkan footnote persis seperti hasil akhir (format pedoman
 * kampus bila ada) lengkap dengan nomor yang akan didapatnya di naskah.
 */

function pecahKalimatLokal(paragraf: string): string[] {
  return paragraf
    .split(/(?<=[.؟!؛])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sisipSetelahKalimat(paragraf: string, idx: number, sisipan: string): string {
  const parts = pecahKalimatLokal(paragraf);
  if (parts.length === 0) return `${paragraf}${sisipan}`;
  const i = Math.min(Math.max(idx, 0), parts.length - 1);
  parts[i] = `${parts[i]}${sisipan}`;
  return parts.join(" ");
}

export function PasangFootnote({
  p,
  ubah,
  sumber,
  kutipan,
  babAwalId,
  onTutup,
  onTerpasang,
}: {
  p: Project;
  ubah: (patch: Partial<Project>) => void;
  sumber: Sumber;
  kutipan?: string;
  babAwalId?: string;
  onTutup: () => void;
  onTerpasang: (pesan: string, drafBaru?: Record<string, string>) => void;
}) {
  const st = useMemo(() => strukturProyek(p), [p]);
  const semuaBagian = useMemo(
    () =>
      st.chapters.flatMap((c) =>
        c.sections.map((s) => ({ id: s.id, label: `${c.labelId} — ${s.labelId}`, labelAr: s.labelAr })),
      ),
    [st],
  );
  const bagianAwal =
    semuaBagian.find((b) => b.id === babAwalId) ?? semuaBagian[0];
  const [sectionId, setSectionId] = useState(bagianAwal?.id ?? "");
  const [paragrafIdx, setParagrafIdx] = useState(0);
  const [kalimatIdx, setKalimatIdx] = useState(0);
  const [halaman, setHalaman] = useState(sumber.halaman ?? "");
  const [jilid, setJilid] = useState(sumber.jilid ?? "");

  const drafLama = p.draf[sectionId] ?? "";
  const paragraf = useMemo(
    () => drafLama.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean),
    [drafLama],
  );
  const bisaBaru = Boolean(kutipan && kutipan.trim().length > 10);
  const [modeBaru, setModeBaru] = useState(paragraf.length === 0 && bisaBaru);
  const kalimat = useMemo(
    () => pecahKalimatLokal(paragraf[paragrafIdx] ?? ""),
    [paragraf, paragrafIdx],
  );

  const penanda = ` [[ref:${sumber.id}${halaman.trim() ? `|hlm:${halaman.trim()}` : ""}${jilid.trim() ? `|jilid:${jilid.trim()}` : ""}]]`;

  const drafBaru = useMemo(() => {
    if (modeBaru) {
      const parBaru = `${(kutipan ?? "").trim()}${penanda}`;
      return drafLama.trim() ? `${drafLama.trim()}\n\n${parBaru}` : parBaru;
    }
    if (paragraf.length === 0) return drafLama;
    const salin = [...paragraf];
    salin[paragrafIdx] = sisipSetelahKalimat(salin[paragrafIdx] ?? "", kalimatIdx, penanda);
    return salin.join("\n\n");
  }, [modeBaru, kutipan, penanda, drafLama, paragraf, paragrafIdx, kalimatIdx]);

  /** Pratinjau: kompilasi naskah bayangan untuk tahu nomor footnote-nya. */
  const pratinjau = useMemo(() => {
    const opsi = {
      halaman: halaman.trim() || undefined,
      jilid: jilid.trim() || undefined,
    };
    const teksCadangan = p.pedoman?.formatFootnote
      ? footnotePedoman(sumber, p.pedoman, opsi)
      : footnoteGaya(sumber, gayaSah(p.gayaSitasi), opsi);
    const bayangan: Project = {
      ...p,
      sumber: p.sumber.some((s) => s.id === sumber.id) ? p.sumber : [...p.sumber, sumber],
      draf: { ...p.draf, [sectionId]: drafBaru },
    };
    const hasil = kompilasiMarker(composeNaskah(bayangan), bayangan);
    const defs = [...hasil.markdown.matchAll(/^\[\^(\d+)\]: (.*)$/gm)].map((m) => ({
      nomor: m[1] ?? "?",
      teks: m[2] ?? "",
    }));
    // Indeks kemunculan penanda sisipan dalam urutan naskah bayangan —
    // penomoran kini per kemunculan (berulang = bentuk singkat), jadi nomor
    // & teks pratinjau diambil dari def urutan itu, bukan pencocokan teks.
    const POLA = /\[\[ref:([^\]|]+)(?:\|hlm:([^\]|]*))?(?:\|jilid:([^\]]*))?\]\]/g;
    const perId = new Set(bayangan.sumber.map((s) => s.id));
    const st = strukturProyek(bayangan);
    let berjalan = 0;
    let idx = -1;
    let selesai = false;
    for (const c of st.chapters) {
      if (selesai) break;
      for (const s of c.sections) {
        const drafS = bayangan.draf[s.id];
        const teksS = drafS && drafS.trim().length > 20 ? drafS : composeSection(bayangan, s.id).markdown;
        const cocok = [...teksS.matchAll(POLA)].filter((m) => perId.has((m[1] ?? "").trim()));
        if (s.id === sectionId) {
          if (modeBaru) {
            idx = berjalan + cocok.length - 1;
          } else {
            const pars = drafBaru.split(/\n\s*\n/);
            let offset = 0;
            for (let i = 0; i < paragrafIdx && i < pars.length; i++) offset += (pars[i]?.length ?? 0) + 2;
            const kal = pecahKalimatLokal(pars[paragrafIdx] ?? "");
            let dalam = 0;
            for (let j = 0; j <= kalimatIdx && j < kal.length; j++) dalam += (kal[j]?.length ?? 0) + (j > 0 ? 1 : 0);
            const posisi = offset + dalam;
            const sebelum = cocok.filter((m) => (m.index ?? 0) <= posisi + 1).length;
            idx = berjalan + Math.max(sebelum - 1, 0);
          }
          selesai = true;
          break;
        }
        berjalan += cocok.length;
      }
    }
    const def = idx >= 0 ? defs[idx] : undefined;
    return { teksFootnote: def?.teks ?? teksCadangan, nomor: def?.nomor ?? "?" };
  }, [p, sumber, sectionId, drafBaru, halaman, jilid, modeBaru, paragrafIdx, kalimatIdx]);

  function pasang() {
    const drafMapBaru = { ...p.draf, [sectionId]: drafBaru };
    ubah({
      sumber: p.sumber.some((s) => s.id === sumber.id) ? p.sumber : [...p.sumber, sumber],
      draf: drafMapBaru,
    });
    const labelBagian = semuaBagian.find((b) => b.id === sectionId)?.label ?? sectionId;
    onTerpasang(
      modeBaru
        ? `Footnote nomor ${pratinjau.nomor} terpasang sebagai paragraf baru di ${labelBagian}.`
        : `Footnote nomor ${pratinjau.nomor} terpasang di ${labelBagian}, paragraf ${paragrafIdx + 1}, setelah kalimat ${kalimatIdx + 1}.`,
      drafMapBaru,
    );
    onTutup();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 p-3" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-parchment-50 p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[14px] font-bold text-ink-900">Pasang footnote</h3>
          <button type="button" onClick={onTutup} className="btn-quiet !px-2 !py-0.5">✕</button>
        </div>
        <p className="mt-0.5 font-naskh text-[12.5px] leading-relaxed text-ink-700" dir="rtl">
          {sumber.judul}
        </p>

        <label className="mt-3 block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">1 · Bagian tujuan</span>
          <select
            className="input mt-1 w-full"
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setParagrafIdx(0);
              setKalimatIdx(0);
            }}
          >
            {semuaBagian.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </label>

        {bisaBaru && (
          <label className="mt-3 flex items-center gap-2 text-[12px] text-ink-700">
            <input type="checkbox" checked={modeBaru} onChange={(e) => setModeBaru(e.target.checked)} className="h-4 w-4" />
            Buat paragraf baru dari kutipan ini di akhir bagian
          </label>
        )}

        {!modeBaru && (
          <>
            <div className="mt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">2 · Paragraf tujuan</span>
              {paragraf.length === 0 ? (
                <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                  Bagian ini belum punya draf. Tulis dulu di tab Tulis
                  {bisaBaru ? ", atau centang paragraf baru dari kutipan di atas." : "."}
                </p>
              ) : (
                <div className="mt-1 max-h-36 space-y-1.5 overflow-y-auto">
                  {paragraf.map((par, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setParagrafIdx(i); setKalimatIdx(0); }}
                      className={`block w-full rounded-lg border px-2.5 py-1.5 text-right font-naskh text-[12px] leading-relaxed ${i === paragrafIdx ? "border-gold-600 bg-gold-500/10 text-ink-900" : "border-ink-900/10 bg-white/70 text-ink-600"}`}
                      dir="rtl"
                    >
                      {par.slice(0, 160)}{par.length > 160 ? "…" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {paragraf.length > 0 && (
              <div className="mt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">3 · Pasang setelah kalimat</span>
                <div className="mt-1 max-h-32 space-y-1.5 overflow-y-auto">
                  {kalimat.map((k, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setKalimatIdx(i)}
                      className={`block w-full rounded-lg border px-2.5 py-1.5 text-right font-naskh text-[12px] leading-relaxed ${i === kalimatIdx ? "border-gold-600 bg-gold-500/10 text-ink-900" : "border-ink-900/10 bg-white/70 text-ink-600"}`}
                      dir="rtl"
                    >
                      <span className="ms-1 font-sans text-[10px] font-bold text-ink-400">{i + 1}.</span> {k.slice(0, 140)}{k.length > 140 ? "…" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Halaman</span>
            <input className="input mt-1 w-full" value={halaman} onChange={(e) => setHalaman(e.target.value)} inputMode="numeric" />
          </label>
          <label>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Jilid</span>
            <input className="input mt-1 w-full" value={jilid} onChange={(e) => setJilid(e.target.value)} inputMode="numeric" />
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-gold-600/30 bg-gold-500/5 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            Pratinjau — akan menjadi footnote nomor {pratinjau.nomor}
          </p>
          <p className="mt-1 font-naskh text-[13px] leading-relaxed text-ink-900" dir="rtl">
            {pratinjau.teksFootnote}
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onTutup} className="btn-ghost">Batal</button>
          <button
            type="button"
            onClick={pasang}
            disabled={!modeBaru && paragraf.length === 0}
            className="btn-primary disabled:opacity-40"
          >
            Pasang footnote
          </button>
        </div>
      </div>
    </div>
  );
}
