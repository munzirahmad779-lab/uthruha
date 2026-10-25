"use client";

import { strukturProyek } from "@/lib/content/struktur";
import type { Project } from "@/lib/engine/project";
import { IconArrowRight, IconDoc, IconPen } from "@/components/icons";
import { DaftarIsiEditor } from "@/components/workspace/daftar-isi-editor";

export function StrukturTab({
  p,
  ubah,
  onBuka,
  onSusun,
}: {
  p: Project;
  ubah: (patch: Partial<Project>) => void;
  onBuka: (sectionId: string) => void;
  onSusun: (sectionId: string) => void;
}) {
  const st = strukturProyek(p);

  return (
    <div className="space-y-6">
      <DaftarIsiEditor p={p} ubah={ubah} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">
            Struktur {st.labelId} · <span className="font-arabic">{st.labelAr}</span>
          </h2>
          <p className="mt-1 text-[12px] text-ink-600">
            {st.deskripsi} Perkiraan panjang: {st.rentang}. Bagian bertanda{" "}
            <span className="font-semibold">data lapangan</span> hanya bisa diisi dari hasil
            penelitian Anda.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {st.chapters.map((c) => (
          <section key={c.id} className="rounded-2xl border border-ink-900/10 bg-white/70 p-4">
            <header className="flex items-baseline justify-between gap-3 border-b border-dashed border-ink-900/15 pb-2.5">
              <h3 className="text-[13px] font-bold text-ink-900">{c.labelId}</h3>
              <span className="font-arabic text-[12px] text-gold-700" dir="rtl">
                {c.babAr}
              </span>
            </header>

            <ul className="mt-2 divide-y divide-ink-900/5">
              {c.sections.map((s) => {
                const draf = (p.draf[s.id] ?? "").trim();
                const sudah = draf.length > 80;
                const kata = draf ? draf.split(/\s+/).length : 0;
                return (
                  <li key={s.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-right font-arabic text-[13.5px] font-semibold text-ink-900" dir="rtl">
                          <span
                            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                              sudah ? "bg-emerald-600" : "bg-ink-900/20"
                            }`}
                          />
                          {s.headingAr}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          {s.labelId} · target ±{s.targetKata.toLocaleString("id-ID")} kata
                          {kata > 0 ? ` · terisi ${kata}` : ""}
                          {s.butuhData ? " · data lapangan" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => onSusun(s.id)}
                          title="Susun draf otomatis"
                          className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-parchment-100 hover:bg-ink-800"
                        >
                          <IconPen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onBuka(s.id)}
                          title="Buka di editor"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-ink-900/15 text-ink-700 hover:border-ink-900/30"
                        >
                          <IconArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-900/10 bg-parchment-100/60 p-4">
          <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-ink-600">
            <IconDoc className="h-4 w-4" /> Bagian depan
          </h3>
          <ul className="mt-2 space-y-1">
            {st.frontMatter.map((f) => (
              <li key={f} className="font-arabic text-[13px] text-ink-800" dir="rtl">
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-ink-900/10 bg-parchment-100/60 p-4">
          <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-ink-600">
            <IconDoc className="h-4 w-4" /> Bagian belakang
          </h3>
          <ul className="mt-2 space-y-1">
            {st.backMatter.map((f) => (
              <li key={f} className="font-arabic text-[13px] text-ink-800" dir="rtl">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
