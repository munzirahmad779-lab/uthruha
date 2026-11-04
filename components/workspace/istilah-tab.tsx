"use client";

import { useMemo, useState } from "react";
import { getBidang } from "@/lib/content/bidang";
import { strukturProyek } from "@/lib/content/struktur";
import type { Istilah, Project } from "@/lib/engine/project";
import {
  analisisIstilahProyek,
  bentukIntiAr,
  konflikPadanan,
  saranDariDraf,
  statusIstilah,
} from "@/lib/engine/istilah";
import { IconPlus, IconTrash } from "@/components/icons";
import { Field, Note } from "@/components/ui";

export function IstilahTab({ p, ubah }: { p: Project; ubah: (patch: Partial<Project>) => void }) {
  const bidang = getBidang(p.bidangId);
  const [baru, setBaru] = useState({ id_label: "", ar: "" });

  // Semua hitungan membaca draf proyek ini sendiri lewat mesin
  // lib/engine/istilah.ts (Tahap 9): per kata utuh, normalisasi dasar
  // yang sama untuk label dan padanan.
  const analisis = useMemo(() => {
    const per = analisisIstilahProyek(p);
    return {
      per,
      konflik: konflikPadanan(p.istilah),
      dipakai: per.filter((x) => x.munculAr > 0).length,
      labelSaja: per.filter((x) => statusIstilah(x) === "label-saja"),
      varian: per.filter((x) => statusIstilah(x) === "varian"),
    };
  }, [p]);

  function tambah(istilah: Istilah) {
    if (!istilah.id_label.trim() || !istilah.ar.trim()) return;
    ubah({ istilah: [...p.istilah, istilah] });
  }

  function ubahSatu(id: string, patch: Partial<Istilah>) {
    ubah({ istilah: p.istilah.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  }

  function hapus(id: string) {
    ubah({ istilah: p.istilah.filter((t) => t.id !== id) });
  }

  // Saran utama diturunkan dari isi draf proyek (mesin yang sama):
  // hanya teori bidang yang padanan atau labelnya benar-benar muncul
  // di draf. Sisa teori bidang tetap ditawarkan di kelompok terpisah
  // yang berlabel jujur sebagai usulan bidang, bukan temuan draf.
  const saranDraf = useMemo(() => saranDariDraf(p, bidang.teori), [p, bidang]);
  const saranBidang = bidang.teori.filter((t) => {
    const inti = bentukIntiAr(t.ar);
    if (!inti) return false;
    if (saranDraf.some((s) => s.ar === inti)) return false;
    return !p.istilah.some((i) => bentukIntiAr(i.ar) === inti);
  });

  const st = strukturProyek(p);
  const totalBagian = st.chapters.reduce((a, c) => a + c.sections.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[15px] font-bold text-ink-900">Kamus istilah & konsistensi</h2>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-600">
          Tetapkan satu padanan Arab untuk setiap istilah, lalu pakai bentuk itu di semua bab.
          Penguji biasanya menanyakan istilah yang berubah bentuk di tengah naskah.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="Istilah Indonesia / Latin">
          <input
            className="input"
            value={baru.id_label}
            onChange={(e) => setBaru((b) => ({ ...b, id_label: e.target.value }))}
            placeholder="mis. penafsiran tematik"
          />
        </Field>
        <Field label="Padanan Arab">
          <input
            dir="rtl"
            className="input text-right font-naskh"
            value={baru.ar}
            onChange={(e) => setBaru((b) => ({ ...b, ar: e.target.value }))}
            placeholder="التفسير الموضوعي"
          />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            className="btn-primary h-[42px]"
            onClick={() => {
              tambah({ id: `ist-${Date.now().toString(36)}`, ...baru });
              setBaru({ id_label: "", ar: "" });
            }}
          >
            <IconPlus className="h-4 w-4" /> Tambah
          </button>
        </div>
      </div>

      {saranDraf.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Terdeteksi di draf Anda
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {saranDraf.slice(0, 6).map((s) => (
              <button
                key={s.ar}
                type="button"
                onClick={() =>
                  tambah({ id: `ist-${Date.now().toString(36)}`, id_label: s.id, ar: s.ar })
                }
                className="chip hover:border-gold-500/60 hover:bg-gold-100"
                title={`${s.id} — padanan muncul ${s.munculAr}×, label ${s.munculLabel}× di draf`}
              >
                <span className="font-arabic" dir="rtl">
                  {s.ar}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700">
                  {s.munculAr + s.munculLabel}×
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {saranBidang.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Usulan dari bidang {bidang.labelId} (belum terdeteksi di draf)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {saranBidang.slice(0, 6).map((t) => (
              <button
                key={t.ar}
                type="button"
                onClick={() =>
                  tambah({
                    id: `ist-${Date.now().toString(36)}`,
                    id_label: t.id,
                    ar: bentukIntiAr(t.ar),
                  })
                }
                className="chip hover:border-gold-500/60 hover:bg-gold-100"
                title={t.id}
              >
                <span className="font-arabic" dir="rtl">
                  {bentukIntiAr(t.ar)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {p.istilah.length === 0 ? (
        <Note>
          Belum ada istilah. Tambahkan minimal 3–5 istilah kunci penelitian Anda — istilah yang
          muncul berulang di judul, rumusan masalah, dan kerangka teori.
        </Note>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-900/10">
          <div className="grid grid-cols-[1.2fr_1.2fr_auto_auto] gap-2 bg-parchment-100/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            <span>Istilah</span>
            <span>Padanan Arab</span>
            <span className="text-center">Dipakai</span>
            <span />
          </div>
          <div className="divide-y divide-ink-900/5 bg-white/70">
            {analisis.per.map((a) => {
              const t = a.istilah;
              const st = statusIstilah(a);
              return (
                <div key={t.id} className="grid grid-cols-[1.2fr_1.2fr_auto_auto] items-center gap-2 px-3 py-2">
                  <input
                    className="w-full rounded-md bg-transparent px-1 py-1 text-[12.5px] text-ink-900 outline-none focus:bg-parchment-100"
                    value={t.id_label}
                    onChange={(e) => ubahSatu(t.id, { id_label: e.target.value })}
                  />
                  <input
                    dir="rtl"
                    className="w-full rounded-md bg-transparent px-1 py-1 text-right font-naskh text-[14px] text-ink-900 outline-none focus:bg-parchment-100"
                    value={t.ar}
                    onChange={(e) => ubahSatu(t.id, { ar: e.target.value })}
                  />
                  <span
                    className="w-[4.5rem] text-center leading-tight"
                    title={`Padanan Arab muncul ${a.munculAr}× di draf; label muncul ${a.munculLabel}×${
                      a.varianAr > 0 ? `; bentuk lain dari padanan ini ${a.varianAr}×` : ""
                    }`}
                  >
                    <span
                      className={`block text-[11px] font-semibold ${
                        st === "dipakai"
                          ? "text-emerald-700"
                          : st === "tidak-muncul"
                            ? "text-ink-400"
                            : "text-amber-700"
                      }`}
                    >
                      Arab {a.munculAr}×
                    </span>
                    <span className="block text-[10px] text-ink-500">Label {a.munculLabel}×</span>
                    {a.varianAr > 0 && (
                      <span className="block text-[10px] font-semibold text-amber-700">
                        Varian {a.varianAr}×
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => hapus(t.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-red-50 hover:text-red-600"
                    title="Hapus"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {analisis.konflik.length > 0 && (
        <Note jenis="warn">
          <strong>Istilah ganda terdeteksi:</strong>{" "}
          {analisis.konflik
            .map((g) => `${g[0].id_label} → ${g.map((x) => x.ar).join(" / ")}`)
            .join("; ")}
          . Pilih satu bentuk dan pakai di seluruh naskah.
        </Note>
      )}

      {analisis.labelSaja.length > 0 && (
        <Note jenis="warn">
          <strong>Padanan belum dipakai di draf:</strong>{" "}
          {analisis.labelSaja
            .map(
              (a) =>
                `${a.istilah.id_label} → ${a.istilah.ar} (label muncul ${a.munculLabel}×, padanan 0×)`,
            )
            .join("; ")}
          . Labelnya sudah tertulis di draf, tetapi padanan Arab yang ditetapkan belum pernah
          dipakai. Ganti penyebutan label itu dengan padanannya agar konsisten.
        </Note>
      )}

      {analisis.varian.length > 0 && (
        <Note jenis="warn">
          <strong>Bentuk lain dari padanan tetap:</strong>{" "}
          {analisis.varian
            .map(
              (a) =>
                `«${a.istilah.ar}» tertulis «${a.kutipanVarian}» ${a.varianAr}× di draf`,
            )
            .join("; ")}
          . Samakan penulisannya dengan bentuk tetap di kolom padanan.
        </Note>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-900/10 bg-white/70 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Istilah</p>
          <p className="mt-0.5 text-base font-bold text-ink-900">{p.istilah.length}</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/70 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Muncul di draf
          </p>
          <p className="mt-0.5 text-base font-bold text-ink-900">{analisis.dipakai}</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/70 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Bagian naskah
          </p>
          <p className="mt-0.5 text-base font-bold text-ink-900">{totalBagian}</p>
        </div>
      </div>
    </div>
  );
}
