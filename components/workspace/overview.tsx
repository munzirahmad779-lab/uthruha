"use client";

import { getBidang } from "@/lib/content/bidang";
import { getMetode } from "@/lib/content/metode";
import { getStruktur } from "@/lib/content/struktur";
import { rumusanDefault, tujuanDefault } from "@/lib/engine/compose";
import type { Project } from "@/lib/engine/project";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { Field, Note, Progress, Stat } from "@/components/ui";

export function OverviewTab({
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
  const st = getStruktur(p.jenis);
  const bidang = getBidang(p.bidangId);
  const metode = getMetode(p.metode);
  const rumusan = rumusanDefault(p);
  const tujuan = tujuanDefault(p);
  const total = st.chapters.reduce((a, c) => a + c.sections.length, 0);
  const terisi = st.chapters
    .flatMap((c) => c.sections)
    .filter((s) => (p.draf[s.id] ?? "").trim().length > 80).length;
  const kata = Object.values(p.draf)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
      <div className="space-y-5">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Identitas penelitian</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
            Semua kolom di sini dipakai penyusun draf. Tulis dalam huruf Arab bila sudah ada.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Topik / kata kunci (Arab)" className="sm:col-span-2">
            <input
              dir="rtl"
              className="input text-right font-naskh text-[15px]"
              value={p.topikAr}
              onChange={(e) => ubah({ topikAr: e.target.value })}
              placeholder="الوقف الإنتاجي وتنمية الاقتصاد المحلي"
            />
          </Field>
          <Field label="Lokasi (Arab)">
            <input
              dir="rtl"
              className="input text-right font-naskh"
              value={p.lokasi}
              onChange={(e) => ubah({ lokasi: e.target.value })}
              placeholder="معهد دار المعارف"
            />
          </Field>
          <Field label="Populasi / subjek (Arab)">
            <input
              dir="rtl"
              className="input text-right font-naskh"
              value={p.populasi}
              onChange={(e) => ubah({ populasi: e.target.value })}
              placeholder="طلاب الصف الثاني"
            />
          </Field>
          <Field
            label="Fenomena lapangan (Arab)"
            className="sm:col-span-2"
            hint="Dipakai untuk mengisi placeholder «fenomena» pada latar belakang."
          >
            <textarea
              dir="rtl"
              className="input min-h-24 text-right font-naskh text-[15px] leading-loose"
              value={p.fenomenaAr}
              onChange={(e) => ubah({ fenomenaAr: e.target.value })}
              placeholder="يلاحظ الباحث ضعف الطلاب في المحادثة رغم دراستهم للنحو"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Rumusan masalah (satu per baris, Arab)"
            hint="Kosongkan untuk memakai rumusan otomatis yang bisa disunting."
          >
            <textarea
              dir="rtl"
              className="input min-h-28 text-right font-naskh text-[14px] leading-loose"
              value={p.rumusan.join("\n")}
              onChange={(e) =>
                ubah({ rumusan: e.target.value.split("\n").filter((s) => s.trim().length > 0) })
              }
              placeholder={rumusan.join("\n")}
            />
          </Field>
          <Field label="Tujuan penelitian (satu per baris, Arab)">
            <textarea
              dir="rtl"
              className="input min-h-28 text-right font-naskh text-[14px] leading-loose"
              value={p.tujuan.join("\n")}
              onChange={(e) =>
                ubah({ tujuan: e.target.value.split("\n").filter((s) => s.trim().length > 0) })
              }
              placeholder={tujuan.join("\n")}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              Teori kunci bidang
            </p>
            <ul className="mt-2 space-y-1.5">
              {bidang.teori.slice(0, 3).map((t) => (
                <li key={t.ar} className="text-right font-arabic text-[12px] text-ink-800" dir="rtl">
                  {t.ar}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              Desain metode
            </p>
            <ul className="mt-2 space-y-1.5">
              {metode.desain.slice(0, 3).map((d) => (
                <li key={d.ar} className="text-right font-arabic text-[12px] text-ink-800" dir="rtl">
                  {d.ar}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Field label="Catatan pribadi" hint="Tidak diekspor. Untuk mengingat keputusan dan tenggat Anda.">
          <textarea
            className="input min-h-20 text-[13px]"
            value={p.catatan}
            onChange={(e) => ubah({ catatan: e.target.value })}
            placeholder="Mis. revisi Bab II setelah bimbingan 12 Maret…"
          />
        </Field>
      </div>

      <aside className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Bagian" nilai={`${terisi}/${total}`} />
          <Stat label="Kata" nilai={kata.toLocaleString("id-ID")} />
          <Stat label="Halaman ±" nilai={Math.max(1, Math.round(kata / 250))} />
        </div>

        <div className="rounded-2xl border border-ink-900/10 bg-white/70 p-4">
          <h3 className="text-[13px] font-bold text-ink-900">Progres per bab</h3>
          <div className="mt-3 space-y-3">
            {st.chapters.map((c) => {
              const selesai = c.sections.filter((s) => (p.draf[s.id] ?? "").trim().length > 80).length;
              const persen = Math.round((selesai / c.sections.length) * 100);
              return (
                <div key={c.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-arabic text-[12px] text-ink-800" dir="rtl">
                      {c.labelAr}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-ink-500">
                      {selesai}/{c.sections.length}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Progress nilai={persen} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-900/10 bg-white/70 p-4">
          <h3 className="text-[13px] font-bold text-ink-900">Langkah berikutnya</h3>
          <ul className="mt-3 space-y-2">
            {st.chapters
              .flatMap((c) => c.sections.map((s) => ({ ...s, bab: c.labelAr })))
              .filter((s) => (p.draf[s.id] ?? "").trim().length <= 80)
              .slice(0, 4)
              .map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] text-ink-700">{s.labelId}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onSusun(s.id)}
                      className="rounded-md bg-ink-900 px-2 py-1 text-[10px] font-semibold text-parchment-100 hover:bg-ink-800"
                    >
                      Susun
                    </button>
                    <button
                      type="button"
                      onClick={() => onBuka(s.id)}
                      className="rounded-md border border-ink-900/15 px-2 py-1 text-[10px] font-semibold text-ink-700 hover:border-ink-900/30"
                    >
                      Buka
                    </button>
                  </span>
                </li>
              ))}
            {st.chapters
              .flatMap((c) => c.sections)
              .every((s) => (p.draf[s.id] ?? "").trim().length > 80) && (
              <li className="flex items-center gap-2 text-[12px] text-emerald-700">
                <IconCheck className="h-4 w-4" /> Semua bagian sudah berisi. Waktunya periksa
                ortografi dan rujukan.
              </li>
            )}
          </ul>
        </div>

        <Note jenis="warn">
          Draf menandai bagian yang masih butuh data Anda dengan teks dalam kurung siku{" "}
          <span dir="rtl" className="font-naskh">
            [ … ]
          </span>
          . Bagian itu wajib diisi sebelum dibawa ke bimbingan.
        </Note>

        <button
          type="button"
          onClick={() => onBuka(st.chapters[0]?.sections[0]?.id ?? "khalfiya")}
          className="btn-ghost w-full"
        >
          Buka editor naskah
          <IconArrowRight className="h-4 w-4" />
        </button>
      </aside>
    </div>
  );
}
