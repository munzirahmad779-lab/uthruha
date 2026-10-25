"use client";

import type { BabKustom, Project } from "@/lib/engine/project";
import { susunDaftarIsiIsykal } from "@/lib/content/struktur";

/**
 * Editor daftar isi milik proyek (pola Ma'had: bab mewakili isykaliyyat).
 * Daftar isi disusun dari rumusan masalah, lalu mahasiswa bebas mengedit:
 * mengganti judul bab/sub-bab, menambah, mengurangi, dan memindah urutan.
 * Daftar inilah yang dipakai tab Tulis, penyusun draf, dan ekspor.
 */
export function DaftarIsiEditor({ p, ubah }: { p: Project; ubah: (patch: Partial<Project>) => void }) {
  const daftar = p.daftarIsi ?? null;
  const jumlahRumusan = (p.rumusan ?? []).filter((r) => r.trim()).length;

  function susunDariIsykal() {
    const hasil = susunDaftarIsiIsykal(p);
    if (hasil) ubah({ daftarIsi: hasil });
  }

  function terapkan(next: BabKustom[]) {
    ubah({ daftarIsi: next });
  }

  function ubahBab(i: number, patch: Partial<BabKustom>) {
    if (!daftar) return;
    terapkan(daftar.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  function ubahSub(i: number, j: number, patch: Partial<BabKustom["sections"][number]>) {
    if (!daftar) return;
    terapkan(
      daftar.map((b, bi) =>
        bi === i ? { ...b, sections: b.sections.map((s, sj) => (sj === j ? { ...s, ...patch } : s)) } : b,
      ),
    );
  }

  function pindahSub(i: number, j: number, arah: -1 | 1) {
    if (!daftar) return;
    const bab = daftar[i];
    const k = j + arah;
    if (!bab || k < 0 || k >= bab.sections.length) return;
    const sections = [...bab.sections];
    const [diambil] = sections.splice(j, 1);
    if (!diambil) return;
    sections.splice(k, 0, diambil);
    terapkan(daftar.map((b, bi) => (bi === i ? { ...b, sections } : b)));
  }

  function hapusSub(i: number, j: number) {
    if (!daftar) return;
    terapkan(
      daftar.map((b, bi) => (bi === i ? { ...b, sections: b.sections.filter((_, sj) => sj !== j) } : b)),
    );
  }

  function tambahSub(i: number) {
    if (!daftar) return;
    const unik = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    terapkan(
      daftar.map((b, bi) =>
        bi === i
          ? { ...b, sections: [...b.sections, { id: `sub-${unik}`, labelId: "Sub-bab baru", labelAr: "" }] }
          : b,
      ),
    );
  }

  function hapusBab(i: number) {
    if (!daftar) return;
    terapkan(daftar.filter((_, bi) => bi !== i));
  }

  if (!daftar) {
    return (
      <section className="rounded-2xl border border-gold-600/30 bg-gold-500/5 p-4">
        <h3 className="text-[13px] font-bold text-ink-900">Daftar isi dari isykaliyyat (pola Ma'had)</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
          Di Ma'had Aly, setiap bab isi mewakili satu rumusan masalah: isykal 1 menjadi bab II, isykal 2
          menjadi bab III, isykal 3 menjadi bab IV — bab analisis akhir yang merinci jawaban judul dari
          analisis bab-bab sebelumnya. Susun daftar isi proyek ini dari {jumlahRumusan} rumusan masalah
          Anda, lalu edit bebas: ganti judul, tambah, kurangi sub-bab.
        </p>
        <button type="button" onClick={susunDariIsykal} disabled={jumlahRumusan === 0} className="btn-primary mt-3 disabled:opacity-40">
          Susun daftar isi dari isykaliyyat
        </button>
        {jumlahRumusan === 0 && (
          <p className="mt-2 text-[11px] text-amber-800">
            Rumusan masalah proyek ini masih kosong — isi dulu di wizard/ringkasan proyek.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-gold-600/30 bg-gold-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-ink-900">
          Daftar isi proyek ini <span className="font-normal text-ink-500">(dari isykaliyyat — bebas diedit)</span>
        </h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn-quiet !py-1 !text-[11px]"
            onClick={() => {
              if (window.confirm("Susun ulang dari rumusan masalah? Edit manual Anda akan diganti.")) susunDariIsykal();
            }}
          >
            Susun ulang dari isykaliyyat
          </button>
          <button
            type="button"
            className="btn-quiet !py-1 !text-[11px]"
            onClick={() => {
              if (window.confirm("Kembalikan ke daftar isi bawaan jenis karya? Daftar isi kustom dihapus.")) ubah({ daftarIsi: null });
            }}
          >
            Kembalikan ke bawaan
          </button>
        </div>
      </div>

      {daftar.map((b, i) => (
        <div key={b.id} className="rounded-xl border border-ink-900/10 bg-white/80 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input !w-56 !py-1 text-[12px] font-semibold"
              value={b.labelId}
              onChange={(e) => ubahBab(i, { labelId: e.target.value })}
              aria-label="Judul bab (Indonesia)"
            />
            <input
              className="input min-w-40 flex-1 !py-1 text-right font-naskh text-[12.5px]"
              dir="rtl"
              value={b.labelAr}
              onChange={(e) => ubahBab(i, { labelAr: e.target.value })}
              aria-label="Judul bab (Arab)"
            />
            {b.isykalKe ? (
              <span className="rounded-full bg-ink-900/5 px-2 py-0.5 text-[10px] font-bold text-ink-600">
                Isykal {b.isykalKe}
              </span>
            ) : null}
            <button type="button" className="btn-quiet !px-2 !py-1 !text-[11px]" onClick={() => hapusBab(i)}>
              Hapus bab
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {b.sections.map((s, j) => (
              <li key={s.id} className="flex flex-wrap items-center gap-1.5">
                <input
                  className="input !w-48 !py-1 text-[11.5px]"
                  value={s.labelId}
                  onChange={(e) => ubahSub(i, j, { labelId: e.target.value })}
                  aria-label="Judul sub-bab (Indonesia)"
                />
                <input
                  className="input min-w-36 flex-1 !py-1 text-right font-naskh text-[12px]"
                  dir="rtl"
                  value={s.labelAr}
                  onChange={(e) => ubahSub(i, j, { labelAr: e.target.value })}
                  aria-label="Judul sub-bab (Arab)"
                />
                <button type="button" className="btn-quiet !px-1.5 !py-0.5 !text-[11px]" onClick={() => pindahSub(i, j, -1)} title="Naikkan">
                  ↑
                </button>
                <button type="button" className="btn-quiet !px-1.5 !py-0.5 !text-[11px]" onClick={() => pindahSub(i, j, 1)} title="Turunkan">
                  ↓
                </button>
                <button type="button" className="btn-quiet !px-1.5 !py-0.5 !text-[11px]" onClick={() => hapusSub(i, j)} title="Hapus sub-bab">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-quiet mt-2 !py-1 !text-[11px]" onClick={() => tambahSub(i)}>
            + Tambah sub-bab
          </button>
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-ink-500">
        Perubahan langsung dipakai tab Tulis, penyusun draf otomatis, dan ekspor. Menghapus sub-bab tidak
        menghapus draf yang sudah ditulis — drafnya tetap tersimpan di proyek ini.
      </p>
    </section>
  );
}
