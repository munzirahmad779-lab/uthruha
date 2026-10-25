"use client";

import { useMemo, useState } from "react";
import { getBidang } from "@/lib/content/bidang";
import { strukturProyek } from "@/lib/content/struktur";
import type { Istilah, Project } from "@/lib/engine/project";
import { IconPlus, IconTrash } from "@/components/icons";
import { Field, Note } from "@/components/ui";

function normal(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
}

export function IstilahTab({ p, ubah }: { p: Project; ubah: (patch: Partial<Project>) => void }) {
  const bidang = getBidang(p.bidangId);
  const [baru, setBaru] = useState({ id_label: "", ar: "" });

  const draf = useMemo(() => Object.values(p.draf).join("\n"), [p.draf]);

  const analisis = useMemo(() => {
    const per = p.istilah.map((t) => {
      const hit = t.ar.trim()
        ? (draf.match(new RegExp(t.ar.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length
        : 0;
      return { ...t, muncul: hit };
    });

    const grup = new Map<string, Istilah[]>();
    for (const t of p.istilah) {
      if (!t.id_label.trim()) continue;
      const k = normal(t.id_label);
      grup.set(k, [...(grup.get(k) ?? []), t]);
    }
    const konflik = Array.from(grup.values()).filter(
      (g) => new Set(g.map((x) => normal(x.ar))).size > 1,
    );
    return { per, konflik, dipakai: per.filter((x) => x.muncul > 0).length };
  }, [p.istilah, draf]);

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

  const saran = bidang.teori.filter(
    (t) => !p.istilah.some((i) => normal(i.ar) === normal(t.ar)),
  );

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

      {saran.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Usulan dari bidang {bidang.labelId}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {saran.slice(0, 6).map((t) => (
              <button
                key={t.ar}
                type="button"
                onClick={() => tambah({ id: `ist-${Date.now().toString(36)}`, id_label: t.id, ar: t.ar })}
                className="chip hover:border-gold-500/60 hover:bg-gold-100"
                title={t.id}
              >
                <span className="font-arabic" dir="rtl">
                  {t.ar.split("(")[0].trim()}
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
            {analisis.per.map((t) => (
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
                  className={`w-14 text-center text-[11px] font-semibold ${
                    t.muncul > 0 ? "text-emerald-700" : "text-ink-400"
                  }`}
                >
                  {t.muncul}×
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
            ))}
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
