"use client";

import { useState } from "react";
import type { BabKustom, Project } from "@/lib/engine/project";
import { susunDaftarIsiIsykal, susunDaftarIsiBawaan } from "@/lib/content/struktur";
import { parseOutlinePedoman, parseOutlineTempelan } from "@/lib/engine/daftar-isi-pedoman";

/**
 * Daftar isi dari pedoman kampus: membaca bagian sistematika di pedoman .md
 * yang terunggah, atau tempelan daftar isi yang disalin mahasiswa dari buku
 * pedoman. Hasilnya menjadi daftar isi proyek yang bisa diedit seperti biasa.
 */
function PanelDaftarIsiPedoman({
  p,
  ubah,
  sudahAda,
}: {
  p: Project;
  ubah: (patch: Partial<Project>) => void;
  sudahAda: boolean;
}) {
  const [tempel, setTempel] = useState("");
  const [pesan, setPesan] = useState("");
  const dariPedoman = p.pedoman?.mentah ? parseOutlinePedoman(p.pedoman.mentah) : null;
  const jumlahSub = (d: BabKustom[]) => d.reduce((n, b) => n + b.sections.length, 0);

  function terapkanDari(d: BabKustom[], sumber: string) {
    if (sudahAda && !window.confirm(`Ganti daftar isi saat ini dengan daftar isi ${sumber}? Draf yang sudah ditulis tidak ikut terhapus.`)) return;
    ubah({ daftarIsi: d });
    setPesan(`Daftar isi dari ${sumber} diterapkan: ${d.length} bab, ${jumlahSub(d)} sub-bab. Silakan edit lagi bila perlu.`);
  }

  return (
    <div className="mt-3 border-t border-ink-900/10 pt-3">
      <h4 className="text-[12.5px] font-bold text-ink-900">Daftar isi dari pedoman kampus</h4>
      {p.pedoman ? (
        dariPedoman ? (
          <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
            Pedoman terunggah ({p.pedoman.namaBerkas || "pedoman.md"}) memuat sistematika:{" "}
            <b>{dariPedoman.length} bab, {jumlahSub(dariPedoman)} sub-bab</b>.
          </p>
        ) : (
          <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
            Pedoman terunggah belum memuat bagian daftar isi/sistematika, jadi belum bisa dibaca ke
            sini. Unggah ulang pedoman dengan prompt terbaru (di tab Rujukan → Pedoman kampus — prompt
            kini meminta sistematika), atau tempel daftar isinya langsung di bawah ini.
          </p>
        )
      ) : (
        <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
          Belum ada pedoman terunggah di proyek ini. Unggah di tab Rujukan → Pedoman kampus, atau
          tempel daftar isi dari buku pedoman Anda di bawah ini.
        </p>
      )}
      {dariPedoman && (
        <button type="button" className="btn-primary mt-2" onClick={() => terapkanDari(dariPedoman, "pedoman kampus")}>
          Pakai daftar isi dari pedoman
        </button>
      )}
      <textarea
        className="input mt-3 min-h-28 w-full font-naskh text-[12.5px]"
        dir="auto"
        value={tempel}
        onChange={(e) => setTempel(e.target.value)}
        placeholder={"Tempel daftar isi dari buku pedoman di sini. Satu baris satu judul:\nBAB I PENDAHULUAN\n  Latar Belakang\n  Rumusan Masalah\nBAB II …"}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-quiet"
          disabled={tempel.trim().length < 5}
          onClick={() => {
            const hasil = parseOutlineTempelan(tempel);
            if (!hasil) {
              setPesan("Tempelan belum terbaca: pastikan ada minimal 1 bab dengan sub-bab menjorok (2 spasi) atau bernomor 1.1.");
              return;
            }
            terapkanDari(hasil, "tempelan Anda");
          }}
        >
          Susun daftar isi dari tempelan
        </button>
        <span className="text-[10.5px] text-ink-500">Penomoran 1 / 1.1 / 1.1.1 juga dipahami.</span>
      </div>
      {pesan && <p className="mt-2 text-[12px] text-ink-700">{pesan}</p>}
    </div>
  );
}

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

  function ubahAnak(i: number, j: number, k: number, patch: Partial<BabKustom["sections"][number]>) {
    if (!daftar) return;
    terapkan(
      daftar.map((b, bi) =>
        bi === i
          ? {
              ...b,
              sections: b.sections.map((s, sj) =>
                sj === j ? { ...s, anak: (s.anak ?? []).map((a, ak) => (ak === k ? { ...a, ...patch } : a)) } : s,
              ),
            }
          : b,
      ),
    );
  }

  function tambahAnak(i: number, j: number) {
    if (!daftar) return;
    const unik = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    terapkan(
      daftar.map((b, bi) =>
        bi === i
          ? {
              ...b,
              sections: b.sections.map((s, sj) =>
                sj === j
                  ? { ...s, anak: [...(s.anak ?? []), { id: `fasal-${unik}`, labelId: "Fasal/matlab baru", labelAr: "" }] }
                  : s,
              ),
            }
          : b,
      ),
    );
  }

  function hapusAnak(i: number, j: number, k: number) {
    if (!daftar) return;
    terapkan(
      daftar.map((b, bi) =>
        bi === i
          ? {
              ...b,
              sections: b.sections.map((s, sj) =>
                sj === j ? { ...s, anak: (s.anak ?? []).filter((_, ak) => ak !== k) } : s,
              ),
            }
          : b,
      ),
    );
  }

  function pindahAnak(i: number, j: number, k: number, arah: -1 | 1) {
    if (!daftar) return;
    const anak = [...(daftar[i]?.sections[j]?.anak ?? [])];
    const t = k + arah;
    if (t < 0 || t >= anak.length) return;
    const [diambil] = anak.splice(k, 1);
    if (!diambil) return;
    anak.splice(t, 0, diambil);
    terapkan(
      daftar.map((b, bi) =>
        bi === i
          ? { ...b, sections: b.sections.map((s, sj) => (sj === j ? { ...s, anak } : s)) }
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
        <div className="mt-3 border-t border-ink-900/10 pt-3">
          <p className="text-[12px] leading-relaxed text-ink-600">
            Tidak memakai pola isykal? Anda tetap bisa mengganti judul bab dan sub-bab: jadikan struktur
            bawaan saat ini sebagai daftar isi milik proyek, lalu edit bebas (termasuk menambah
            fasal/matlab di bawah sub-bab).
          </p>
          <button type="button" onClick={() => ubah({ daftarIsi: susunDaftarIsiBawaan(p) })} className="btn-quiet mt-2">
            Jadikan struktur bawaan bisa diedit
          </button>
        </div>
        <PanelDaftarIsiPedoman p={p} ubah={ubah} sudahAda={false} />
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-gold-600/30 bg-gold-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-ink-900">
          Daftar isi proyek ini <span className="font-normal text-ink-500">(milik proyek — bebas diedit)</span>
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
              <li key={s.id}>
                <div className="flex flex-wrap items-center gap-1.5">
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
                  <button type="button" className="btn-quiet !px-1.5 !py-0.5 !text-[11px]" onClick={() => tambahAnak(i, j)} title="Tambah fasal/matlab di bawah sub-bab ini">
                    + Fasal
                  </button>
                </div>
                {(s.anak ?? []).length > 0 && (
                  <ul className="mt-1.5 space-y-1.5 border-s-2 border-gold-600/30 ps-3 ms-2">
                    {(s.anak ?? []).map((a, k) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Fasal</span>
                        <input
                          className="input !w-40 !py-1 text-[11px]"
                          value={a.labelId}
                          onChange={(e) => ubahAnak(i, j, k, { labelId: e.target.value })}
                          aria-label="Judul fasal/matlab (Indonesia)"
                        />
                        <input
                          className="input min-w-32 flex-1 !py-1 text-right font-naskh text-[11.5px]"
                          dir="rtl"
                          value={a.labelAr}
                          onChange={(e) => ubahAnak(i, j, k, { labelAr: e.target.value })}
                          aria-label="Judul fasal/matlab (Arab)"
                        />
                        <button type="button" className="btn-quiet !px-1.5 !py-0.5 !text-[11px]" onClick={() => pindahAnak(i, j, k, -1)} title="Naikkan">
                          ↑
                        </button>
                        <button type="button" className="btn-quiet !px-1.5 !py-0.5 !text-[11px]" onClick={() => pindahAnak(i, j, k, 1)} title="Turunkan">
                          ↓
                        </button>
                        <button type="button" className="btn-quiet !px-1.5 !py-0.5 !text-[11px]" onClick={() => hapusAnak(i, j, k)} title="Hapus fasal">
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="btn-quiet mt-2 !py-1 !text-[11px]" onClick={() => tambahSub(i)}>
            + Tambah sub-bab
          </button>
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-ink-500">
        Perubahan langsung dipakai tab Tulis, penyusun draf otomatis, dan ekspor. Tiap sub-bab bisa
        diberi fasal/matlab (tombol “+ Fasal”) sesuai pedoman masing-masing. Menghapus sub-bab tidak
        menghapus draf yang sudah ditulis — drafnya tetap tersimpan di proyek ini.
      </p>
      <PanelDaftarIsiPedoman p={p} ubah={ubah} sudahAda={true} />
    </section>
  );
}
