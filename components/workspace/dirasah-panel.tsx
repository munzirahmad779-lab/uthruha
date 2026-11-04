"use client";

import { useMemo, useState } from "react";
import { IconBook, IconCheck, IconPlus, IconSearch, IconSpinner } from "@/components/icons";
import { Field, Note } from "@/components/ui";
import { composeSection } from "@/lib/engine/compose";
import { sumberBaru, type Sumber } from "@/lib/engine/cite";
import {
  kajianDirasah,
  lepasKajian,
  statusDirasah,
  tanamKajian,
  MIN_KAJIAN_DIRASAH,
  type HasilCariDirasah,
  type KandidatDirasah,
} from "@/lib/engine/dirasah";
import type { Project } from "@/lib/engine/project";
import { normalisasiJudul } from "@/lib/engine/referensi";
import { idStabilDariIdentitas } from "@/lib/refs/footnote";

/**
 * Panel Dirasah Sabiqoh (Tahap 7): pencarian kajian terdahulu yang
 * nyata dari tab Struktur. Mahasiswa mencari dengan judul proyeknya,
 * membaca putusan gerbang bidang dan inti tiap kandidat (dari
 * abstraknya), lalu MEMILIH sendiri kajian yang dipakai. Yang terpilih
 * menjadi sumber proyek lewat jalur sumber yang sah dan menjadi bahan
 * susunan teks الدراسات السابقة. Minimal 3 kajian adalah aturan
 * pemilik web (bukan bunyi pedoman), ditegakkan sebagai penanda
 * kelengkapan yang jujur; kekurangannya tidak pernah ditambal
 * karangan, jalan keluarnya adalah tambahan manual dari kajian yang
 * benar-benar dibaca mahasiswa.
 */
export function DirasahPanel({
  p,
  ubah,
}: {
  p: Project;
  ubah: (patch: Partial<Project>) => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<HasilCariDirasah | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [konfirmasi, setKonfirmasi] = useState<Record<string, boolean>>({});
  const [tampilManual, setTampilManual] = useState(false);
  const [manual, setManual] = useState({ penulis: "", judul: "", tahun: "", jurnal: "", penerbit: "", doi: "", tautan: "", abstrak: "" });

  const terpilih = useMemo(() => kajianDirasah(p), [p]);
  const status = useMemo(() => statusDirasah(p), [p]);

  async function cari() {
    if (sibuk) return;
    setSibuk(true);
    setGalat("");
    setPesan("");
    try {
      const res = await fetch("/api/dirasah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judulProyek: p.judulAr ?? "",
          bidangId: p.bidangId,
          topikAr: p.judulAr || p.topikAr,
        }),
      });
      const data = (await res.json().catch(() => null)) as HasilCariDirasah & { error?: string } | null;
      if (!res.ok || !data || !Array.isArray(data.kajian)) {
        setGalat(data?.error ?? "Pencarian dirasah gagal. Periksa koneksi lalu coba lagi.");
        return;
      }
      setHasil(data);
      setKonfirmasi({});
    } catch {
      setGalat("Pencarian dirasah gagal tersambung ke server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  /** Kandidat tertahan aturan keras TIDAK bisa dipilih. Kandidat
   *  tertahan penilaian (model menilai rendah atau model tidak
   *  menilai) hanya bisa dipilih sesudah mahasiswa mencentang
   *  konfirmasi sadar pada kartunya, pola Tahap 4. */
  function bisaPilih(k: KandidatDirasah): boolean {
    if (!k.gerbang || k.gerbang.lolos) return true;
    if (k.gerbang.statusPenilaian === "aturan-keras") return false;
    return Boolean(konfirmasi[k.sumber.id]);
  }

  function sudahDipilih(k: KandidatDirasah): boolean {
    return p.sumber.some(
      (s) =>
        s.dirasah &&
        (s.id === k.sumber.id || normalisasiJudul(s.judul) === normalisasiJudul(k.sumber.judul)),
    );
  }

  function pilih(k: KandidatDirasah) {
    const { proyek, status: st } = tanamKajian(p, k.sumber);
    if (st === "sudah-ada" && proyek === p) {
      setPesan(`Kajian "${k.sumber.judul}" sudah termasuk kajian terpilih Anda.`);
      return;
    }
    ubah({ sumber: proyek.sumber });
    setPesan(
      st === "penanda-ditempel"
        ? `Kajian "${k.sumber.judul}" sudah ada di daftar rujukan Anda; kini ditandai sebagai kajian dirasah terpilih.`
        : `Kajian "${k.sumber.judul}" ditambahkan sebagai kajian terpilih dan sumber proyek.`,
    );
  }

  function lepas(id: string, judul: string) {
    ubah({ sumber: lepasKajian(p, id).sumber });
    setPesan(`"${judul}" dilepas dari kajian terpilih. Sumbernya tetap ada di tab Rujukan.`);
  }

  function susunTeks() {
    const hasilSusun = composeSection(p, "dirasat");
    ubah({ draf: { ...p.draf, dirasat: hasilSusun.markdown } });
    setPesan(
      status.cukup
        ? `Teks الدراسات السابقة disusun dari ${status.jumlah} kajian terpilih dan disimpan ke draf bagian itu. Baca dan sunting di tab Tulis.`
        : `Teks الدراسات السابقة disusun dari ${status.jumlah} kajian terpilih (belum mencapai minimal ${MIN_KAJIAN_DIRASAH}) dan disimpan ke draf. Teksnya memuat penanda kekurangan itu; lengkapi kajiannya lalu susun ulang.`,
    );
  }

  function tambahManual() {
    const penulis = manual.penulis.trim();
    const judul = manual.judul.trim();
    const tahun = manual.tahun.trim();
    if (!penulis || !judul || !tahun) {
      setPesan("Tambahan manual wajib memuat penulis, judul, dan tahun kajian. Tanpa ketiganya entri tidak layak tampil sebagai kajian.");
      return;
    }
    const sumber: Sumber = {
      ...sumberBaru(manual.jurnal.trim() ? "artikel" : "kitab"),
      id: idStabilDariIdentitas(judul, penulis, tahun),
      penulis,
      judul,
      tahun,
      jurnal: manual.jurnal.trim() || undefined,
      penerbit: manual.penerbit.trim() || undefined,
      doi: manual.doi.trim() || undefined,
      url: manual.tautan.trim() || undefined,
      sumberImpor: "manual",
      perluVerifikasi: true,
      dirasah: {
        ...(manual.abstrak.trim() ? { abstrak: manual.abstrak.trim() } : {}),
        dariAbstrak: Boolean(manual.abstrak.trim()),
      },
    };
    const { proyek, status: st } = tanamKajian(p, sumber);
    if (st === "sudah-ada" && proyek === p) {
      setPesan(`Kajian "${judul}" sudah ada di proyek Anda.`);
      return;
    }
    ubah({ sumber: proyek.sumber });
    setManual({ penulis: "", judul: "", tahun: "", jurnal: "", penerbit: "", doi: "", tautan: "", abstrak: "" });
    setPesan(`Kajian manual "${judul}" ditambahkan sebagai kajian terpilih. Tandanya perlu verifikasi karena datanya dari isian Anda sendiri.`);
  }

  return (
    <section className="rounded-2xl border border-ink-900/10 bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink-900">
            <IconBook className="h-4 w-4" /> Dirasah Sabiqoh ·{" "}
            <span className="font-arabic" dir="rtl">الدراسات السابقة</span>
          </h3>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-600">
            Cari kajian terdahulu yang nyata untuk judul penelitian Anda, pilih yang sebidang,
            lalu susun teksnya. Minimal {MIN_KAJIAN_DIRASAH} kajian adalah ketentuan pemilik web,
            bukan bunyi pedoman kampus. Kajian yang ditemukan dan intinya selalu datang dari data
            indeks akademik; yang tidak ditemukan tidak diganti karangan.
          </p>
        </div>
        <div
          className={`shrink-0 rounded-xl border px-3 py-2 text-center ${
            status.cukup
              ? "border-emerald-600/25 bg-emerald-50/70 text-emerald-900"
              : "border-amber-500/30 bg-amber-50/80 text-amber-900"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Kajian terpilih</p>
          <p className="mt-0.5 text-base font-bold">
            {status.jumlah} / {MIN_KAJIAN_DIRASAH}
          </p>
          <p className="text-[10.5px]">{status.cukup ? "Minimal terpenuhi" : `Kurang ${status.kurang} lagi`}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void cari()}
          disabled={sibuk || !(p.judulAr ?? "").trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-[12px] font-semibold text-parchment-100 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sibuk ? <IconSpinner className="h-3.5 w-3.5 animate-spin" /> : <IconSearch className="h-3.5 w-3.5" />}
          {sibuk ? "Mencari kajian…" : "Cari kajian terdahulu"}
        </button>
        <button
          type="button"
          onClick={susunTeks}
          disabled={status.jumlah === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-900/15 px-3 py-2 text-[12px] font-semibold text-ink-800 hover:border-ink-900/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconCheck className="h-3.5 w-3.5" /> Susun teks dirasah dari kajian terpilih
        </button>
        <button
          type="button"
          onClick={() => setTampilManual((t) => !t)}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-900/15 px-3 py-2 text-[12px] font-semibold text-ink-800 hover:border-ink-900/30"
        >
          <IconPlus className="h-3.5 w-3.5" /> Tambah kajian manual
        </button>
      </div>
      {!(p.judulAr ?? "").trim() && (
        <p className="mt-2 text-[11.5px] text-amber-800">
          Isi dulu judul penelitian pada wizard atau data proyek: pencarian memakai judul sebagai kueri semantiknya.
        </p>
      )}

      {pesan && (
        <div className="mt-3">
          <Note jenis="aman">{pesan}</Note>
        </div>
      )}
      {galat && (
        <div className="mt-3">
          <Note jenis="warn">{galat}</Note>
        </div>
      )}

      {terpilih.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[12px] font-bold text-ink-900">Kajian terpilih ({terpilih.length})</h4>
          <ul className="mt-2 space-y-2">
            {terpilih.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ink-900/10 bg-parchment-100/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-arabic text-[13px] font-semibold text-ink-900" dir="rtl">
                    {s.judul}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-600">
                    {s.penulis}
                    {s.tahun ? ` · ${s.tahun}` : ""}
                    {s.jurnal ? ` · ${s.jurnal}` : s.penerbit ? ` · ${s.penerbit}` : ""}
                    {s.dirasah && !s.dirasah.temuan ? " · hasil kajian belum tersedia di data sumber" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => lepas(s.id, s.judul)}
                  className="shrink-0 rounded-lg border border-ink-900/15 px-2 py-1.5 text-[10.5px] font-semibold text-ink-600 hover:border-ink-900/30"
                >
                  Lepas dari dirasah
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tampilManual && (
        <div className="mt-4 rounded-xl border border-dashed border-ink-900/20 bg-parchment-100/50 p-3">
          <h4 className="text-[12px] font-bold text-ink-900">Tambah kajian manual</h4>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-600">
            Untuk kajian yang Anda baca sendiri di luar indeks (misalnya risalah di perpustakaan kampus).
            Penulis, judul, dan tahun wajib; abstrak bila ada akan menjadi dasar isinya di susunan teks.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Peneliti / penulis">
              <input className="input" value={manual.penulis} onChange={(e) => setManual({ ...manual, penulis: e.target.value })} />
            </Field>
            <Field label="Tahun">
              <input className="input" value={manual.tahun} onChange={(e) => setManual({ ...manual, tahun: e.target.value })} />
            </Field>
            <Field label="Judul kajian" className="sm:col-span-2">
              <input className="input" value={manual.judul} onChange={(e) => setManual({ ...manual, judul: e.target.value })} />
            </Field>
            <Field label="Nama jurnal (bila artikel)">
              <input className="input" value={manual.jurnal} onChange={(e) => setManual({ ...manual, jurnal: e.target.value })} />
            </Field>
            <Field label="Penerbit / universitas (bila risalah atau buku)">
              <input className="input" value={manual.penerbit} onChange={(e) => setManual({ ...manual, penerbit: e.target.value })} />
            </Field>
            <Field label="DOI (bila ada)">
              <input className="input" value={manual.doi} onChange={(e) => setManual({ ...manual, doi: e.target.value })} />
            </Field>
            <Field label="Tautan sumber (bila ada)">
              <input className="input" value={manual.tautan} onChange={(e) => setManual({ ...manual, tautan: e.target.value })} />
            </Field>
            <Field label="Abstrak kajian (bila ada)" className="sm:col-span-2">
              <textarea
                className="input min-h-20"
                value={manual.abstrak}
                onChange={(e) => setManual({ ...manual, abstrak: e.target.value })}
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={tambahManual}
            className="mt-3 rounded-lg bg-ink-900 px-3 py-2 text-[12px] font-semibold text-parchment-100 hover:bg-ink-800"
          >
            Tambahkan sebagai kajian terpilih
          </button>
        </div>
      )}

      {hasil && (
        <div className="mt-4">
          <h4 className="text-[12px] font-bold text-ink-900">
            Hasil pencarian ({hasil.kajian.length} kajian)
          </h4>
          {hasil.catatan.length > 0 && (
            <div className="mt-2 space-y-2">
              {hasil.catatan.map((c, i) => (
                <Note key={i} jenis="warn">
                  {c}
                </Note>
              ))}
            </div>
          )}
          <ul className="mt-3 space-y-3">
            {hasil.kajian.map((k) => {
              const inti = k.sumber.dirasah;
              const dipilih = sudahDipilih(k);
              const tertahanKeras = k.gerbang?.statusPenilaian === "aturan-keras" && !k.gerbang.lolos;
              return (
                <li key={k.sumber.id} className="rounded-xl border border-ink-900/10 bg-white/80 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-arabic text-[13.5px] font-semibold leading-relaxed text-ink-900" dir="rtl">
                        {k.sumber.judul}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-600">
                        {k.sumber.penulis}
                        {k.sumber.tahun ? ` · ${k.sumber.tahun}` : ""}
                        {k.sumber.jurnal ? ` · ${k.sumber.jurnal}` : k.sumber.penerbit ? ` · ${k.sumber.penerbit}` : ""}
                        {k.terverifikasi ? " · identifier terverifikasi" : " · identifier belum terverifikasi"}
                        {` · skor pencarian ${Math.round(k.skor * 100)}%`}
                      </p>
                      {k.tautan && (
                        <a
                          href={k.tautan}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-block text-[11.5px] font-medium text-gold-700 underline"
                        >
                          Buka sumber di indeksnya
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={dipilih || !bisaPilih(k)}
                      onClick={() => pilih(k)}
                      className="shrink-0 rounded-lg bg-ink-900 px-3 py-2 text-[11.5px] font-semibold text-parchment-100 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {dipilih ? "Sudah dipilih" : tertahanKeras ? "Tidak dapat dipilih" : "Pilih kajian ini"}
                    </button>
                  </div>

                  <div className="mt-2">
                    {!k.gerbang && (
                      <Note>Aturan keras bidang bersih. Penilaian model tidak berjalan untuk akun Anda, jadi kesesuaian isi belum dinilai model; periksa abstraknya sebelum memilih.</Note>
                    )}
                    {k.gerbang?.lolos && (
                      <Note jenis="aman">
                        Lolos gerbang bidang{k.gerbang.skorModel ? ` (skor model ${k.gerbang.skorModel}/100)` : ""}. {k.gerbang.alasan}
                      </Note>
                    )}
                    {k.gerbang && !k.gerbang.lolos && tertahanKeras && (
                      <Note jenis="warn">
                        Tertahan gerbang bidang: {k.gerbang.bidangSumber}. {k.gerbang.alasan} Kajian lintas bidang tidak dapat dipilih.
                      </Note>
                    )}
                    {k.gerbang && !k.gerbang.lolos && !tertahanKeras && (
                      <div className="space-y-2">
                        <Note jenis="warn">
                          {k.gerbang.statusPenilaian === "tidak-dinilai"
                            ? `Belum dinilai model. ${k.gerbang.alasan}`
                            : `Tertahan penilaian gerbang${k.gerbang.skorModel ? ` (skor model ${k.gerbang.skorModel}/100)` : ""}. ${k.gerbang.alasan}`}
                        </Note>
                        <label className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-700">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={Boolean(konfirmasi[k.sumber.id])}
                            onChange={(e) =>
                              setKonfirmasi((m) => ({ ...m, [k.sumber.id]: e.target.checked }))
                            }
                          />
                          Saya sudah memeriksa sendiri abstrak dan kesesuaian kajian ini dengan penelitian saya, dan tetap memilihnya dengan tanggung jawab saya.
                        </label>
                      </div>
                    )}
                  </div>

                  {(inti?.masalah || inti?.tujuan || inti?.metode || inti?.temuan) && (
                    <dl className="mt-3 space-y-1.5 rounded-lg bg-parchment-100/70 px-3 py-2.5 text-[12px] leading-relaxed text-ink-800">
                      {inti?.masalah && (
                        <div>
                          <dt className="inline font-bold">Masalah: </dt>
                          <dd className="inline">{inti.masalah}</dd>
                        </div>
                      )}
                      {inti?.tujuan && (
                        <div>
                          <dt className="inline font-bold">Tujuan: </dt>
                          <dd className="inline">{inti.tujuan}</dd>
                        </div>
                      )}
                      {inti?.metode && (
                        <div>
                          <dt className="inline font-bold">Metode: </dt>
                          <dd className="inline">{inti.metode}</dd>
                        </div>
                      )}
                      {inti?.temuan && (
                        <div>
                          <dt className="inline font-bold">Hasil: </dt>
                          <dd className="inline">{inti.temuan}</dd>
                        </div>
                      )}
                      <p className="text-[11px] text-ink-500">
                        {k.intiDariModel
                          ? "Inti disusun model hanya dari abstrak sumber di bawah ini."
                          : "Inti di atas berasal dari data kandidat."}
                      </p>
                    </dl>
                  )}
                  {k.abstrak ? (
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-600">
                      <span className="font-bold text-ink-800">Abstrak dari indeks: </span>
                      {k.abstrak.slice(0, 420)}
                      {k.abstrak.length > 420 ? "…" : ""}
                    </p>
                  ) : (
                    <p className="mt-2 text-[12px] text-ink-500">
                      Indeks tidak menyediakan abstrak untuk kajian ini; intinya tidak dapat disusun dari abstrak dan susunan teks akan menyatakan hasil kajiannya belum tersedia.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
