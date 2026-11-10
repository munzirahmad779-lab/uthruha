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
 *
 * Aturan Pencarian Valid (putusan pemilik 5 Nov 2026 15:57, blokir
 * keras penuh): MEMILIH kajian kini syaratnya putusan "terverifikasi"
 * dari endpoint verifikasi yang sama dengan tambah jurnal (metadata
 * Crossref hidup + bidang, POST /api/refs/verifikasi-jurnal). Jalur
 * konfirmasi sadar untuk kandidat tertahan yang dulu ada di panel ini
 * DICABUT: kandidat gagal atau belum terverifikasi tampil berlabel
 * putusannya dan tombol pilihnya mati, tanpa kecuali. Entri manual pun
 * dicatat dulu lalu diperiksa dengan endpoint yang sama; yang tidak
 * lulus tetap tampil sebagai catatan berlabel, tidak bisa dipilih.
 */

/** Status putusan verifikasi satu kandidat (cermin StatusVerifikasi
 *  server di lib/server/verifikasi-rujukan.ts, ditambah "memeriksa"
 *  untuk keadaan sebelum putusan tiba). */
type StatusPutusan =
  | "terverifikasi"
  | "gagal-metadata"
  | "gagal-bidang"
  | "belum-terverifikasi"
  | "memeriksa";

interface PutusanKandidat {
  status: StatusPutusan;
  alasan: string;
}

const LENCANA_PUTUSAN: Record<StatusPutusan, { label: string; kelas: string }> = {
  terverifikasi: { label: "Terverifikasi", kelas: "bg-emerald-100 text-emerald-800" },
  "gagal-metadata": { label: "Gagal periksa metadata", kelas: "bg-red-100 text-red-800" },
  "gagal-bidang": { label: "Tidak sesuai bidang", kelas: "bg-red-100 text-red-800" },
  "belum-terverifikasi": { label: "Belum terverifikasi", kelas: "bg-amber-100 text-amber-800" },
  memeriksa: { label: "Memeriksa", kelas: "bg-ink-900/10 text-ink-600" },
};

/** Lencana putusan verifikasi + alasannya, satu bentuk untuk kartu
 *  hasil pencarian dan catatan manual. */
function LencanaPutusan({ put }: { put?: PutusanKandidat }) {
  const status: StatusPutusan = put?.status ?? "memeriksa";
  const lencana = LENCANA_PUTUSAN[status];
  return (
    <p className="text-[11.5px] leading-relaxed">
      <span className={`rounded-full px-2 py-0.5 font-semibold ${lencana.kelas}`}>{lencana.label}</span>{" "}
      <span className="text-ink-600">
        {put?.alasan ?? "Sedang diperiksa ke Crossref dan gerbang bidang."}
      </span>
    </p>
  );
}
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
  /** Putusan verifikasi per kandidat (hasil pencarian dan catatan
   *  manual), dikunci id sumber. Hanya "terverifikasi" yang boleh
   *  dipilih; keadaan awal tiap kandidat adalah "memeriksa". */
  const [putusan, setPutusan] = useState<Record<string, PutusanKandidat>>({});
  /** Catatan kajian manual yang sudah dicatat dan sedang/sudah
   *  diperiksa. Entri yang tidak lulus tetap tinggal di sini sebagai
   *  catatan berlabel; ia BUKAN kajian terpilih. */
  const [entriManual, setEntriManual] = useState<Sumber[]>([]);
  const [tampilManual, setTampilManual] = useState(false);
  const [manual, setManual] = useState({ penulis: "", judul: "", tahun: "", jurnal: "", penerbit: "", doi: "", tautan: "", abstrak: "" });

  const terpilih = useMemo(() => kajianDirasah(p), [p]);
  const status = useMemo(() => statusDirasah(p), [p]);

  async function cari() {
    if (sibuk) return;
    setSibuk(true);
    setGalat("");
    setPesan("");
    // Batas waktu klien 30 detik (perbaikan P0.1, laporan perekaman
    // tutorial macro 10 Nov 2026): dulu pencarian yang lambat berakhir
    // diam tanpa pesan apa pun. Kini lewat 30 detik pencarian dibatalkan
    // dan pengguna menerima pesan yang jelas, bukan tombol yang kembali
    // normal dalam senyap.
    const pengendali = new AbortController();
    const batasWaktu = window.setTimeout(() => pengendali.abort(), 30_000);
    try {
      const res = await fetch("/api/dirasah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judulProyek: p.judulAr ?? "",
          bidangId: p.bidangId,
          topikAr: p.judulAr || p.topikAr,
        }),
        signal: pengendali.signal,
      });
      const data = (await res.json().catch(() => null)) as HasilCariDirasah & { error?: string } | null;
      if (!res.ok || !data || !Array.isArray(data.kajian)) {
        setGalat(data?.error ?? "Pencarian dirasah gagal. Periksa koneksi lalu coba lagi.");
        return;
      }
      setHasil(data);
      // Setiap kandidat WAJIB diperiksa endpoint verifikasi sebelum
      // bisa dipilih (Aturan Pencarian Valid): metadata Crossref
      // hidup + bidang proyek, standar yang sama dengan tambah jurnal.
      void periksaKandidat(
        data.kajian.map((k) => ({
          id: k.sumber.id,
          doi: k.sumber.doi,
          judul: k.sumber.judul,
          jurnal: k.sumber.jurnal,
          tahun: k.sumber.tahun,
        })),
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setGalat("Pencarian melewati batas 30 detik, coba lagi.");
      } else {
        setGalat("Pencarian dirasah gagal tersambung ke server. Periksa koneksi lalu coba lagi.");
      }
    } finally {
      window.clearTimeout(batasWaktu);
      setSibuk(false);
    }
  }

  /**
   * Periksa sekumpulan kandidat ke POST /api/refs/verifikasi-jurnal
   * (maks 15 per panggilan, dipotong di sini). Status awal "memeriksa";
   * panggilan yang gagal membuat kandidatnya "belum-terverifikasi"
   * (tertahan), bukan lolos karena pemeriksanya tidak jalan.
   */
  async function periksaKandidat(
    daftar: { id: string; doi?: string; judul: string; jurnal?: string; tahun?: string }[],
  ) {
    if (daftar.length === 0) return;
    setPutusan((m) => {
      const n = { ...m };
      for (const d of daftar) {
        n[d.id] = { status: "memeriksa", alasan: "Sedang diperiksa ke Crossref dan gerbang bidang." };
      }
      return n;
    });
    for (let i = 0; i < daftar.length; i += 15) {
      const potong = daftar.slice(i, i + 15);
      try {
        const res = await fetch("/api/refs/verifikasi-jurnal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kandidat: potong,
            bidangId: p.bidangId,
            judulProyek: p.judulAr ?? "",
            topikAr: p.judulAr || p.topikAr,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          hasil?: { id: string; status: StatusPutusan; alasan: string }[];
          error?: string;
        } | null;
        if (!res.ok || !data || !Array.isArray(data.hasil)) {
          throw new Error(data?.error ?? "verifikasi gagal");
        }
        const hasilServer = data.hasil;
        setPutusan((m) => {
          const n = { ...m };
          for (const h of hasilServer) n[h.id] = { status: h.status, alasan: h.alasan };
          for (const d of potong) {
            if (!n[d.id] || n[d.id]!.status === "memeriksa") {
              n[d.id] = {
                status: "belum-terverifikasi",
                alasan: "Kandidat ini tidak mendapat putusan dari server verifikasi.",
              };
            }
          }
          return n;
        });
      } catch {
        setPutusan((m) => {
          const n = { ...m };
          for (const d of potong) {
            n[d.id] = {
              status: "belum-terverifikasi",
              alasan: "Pemeriksaan tidak dapat berjalan; cari atau catat lagi untuk memeriksanya ulang.",
            };
          }
          return n;
        });
      }
    }
  }

  /** Kandidat hanya bisa dipilih bila putusan verifikasinya
   *  "terverifikasi". Dulu kandidat tertahan penilaian masih bisa
   *  dipilih lewat centang konfirmasi sadar; jalur itu dicabut oleh
   *  putusan pemilik 5 Nov 2026 15:57 (blokir keras, tanpa celah). */
  function bisaPilih(k: KandidatDirasah): boolean {
    return putusan[k.sumber.id]?.status === "terverifikasi";
  }

  function sudahDipilih(k: KandidatDirasah): boolean {
    return p.sumber.some(
      (s) =>
        s.dirasah &&
        (s.id === k.sumber.id || normalisasiJudul(s.judul) === normalisasiJudul(k.sumber.judul)),
    );
  }

  function pilih(k: KandidatDirasah) {
    // Penjaga kedua di luar keadaan tombol: yang putusannya bukan
    // terverifikasi tidak pernah tertanam, apa pun keadaan tampilannya.
    if (!bisaPilih(k)) {
      setPesan(
        `Kajian "${k.sumber.judul}" belum bisa dipilih: ${putusan[k.sumber.id]?.alasan ?? "pemeriksaannya belum selesai."}`,
      );
      return;
    }
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

  /**
   * Tambah kajian manual: entri DICATAT dulu sebagai catatan panel,
   * lalu diperiksa endpoint verifikasi yang sama dengan kandidat
   * pencarian (DOI bila diisi; tanpa DOI judulnya dicari persis ke
   * Crossref, lalu bidangnya dinilai). Kemampuan mencatat entri manual
   * TIDAK dihapus; yang dikunci hanya pemilihannya: hanya catatan
   * berputusan "terverifikasi" yang bisa menjadi kajian terpilih.
   */
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
    const sudahAda =
      entriManual.some(
        (e) => e.id === sumber.id || normalisasiJudul(e.judul) === normalisasiJudul(sumber.judul),
      ) ||
      p.sumber.some(
        (s) => s.id === sumber.id || normalisasiJudul(s.judul) === normalisasiJudul(sumber.judul),
      );
    if (sudahAda) {
      setPesan(`Kajian "${judul}" sudah ada di catatan atau proyek Anda.`);
      return;
    }
    setEntriManual((m) => [...m, sumber]);
    setManual({ penulis: "", judul: "", tahun: "", jurnal: "", penerbit: "", doi: "", tautan: "", abstrak: "" });
    setPesan(
      `Kajian manual "${judul}" dicatat dan sedang diperiksa. Hanya yang putusannya terverifikasi yang bisa dipilih menjadi kajian terpilih.`,
    );
    void periksaKandidat([
      { id: sumber.id, doi: sumber.doi, judul: sumber.judul, jurnal: sumber.jurnal, tahun: sumber.tahun },
    ]);
  }

  /** Pilih satu catatan manual yang sudah terverifikasi menjadi
   *  kajian terpilih proyek (penanaman memakai penjaga yang sama). */
  function pilihManual(s: Sumber) {
    if (putusan[s.id]?.status !== "terverifikasi") {
      setPesan(
        `Kajian manual "${s.judul}" belum bisa dipilih: ${putusan[s.id]?.alasan ?? "pemeriksaannya belum selesai."}`,
      );
      return;
    }
    const { proyek, status: st } = tanamKajian(p, s);
    if (st === "sudah-ada" && proyek === p) {
      setPesan(`Kajian "${s.judul}" sudah termasuk kajian terpilih Anda.`);
      return;
    }
    ubah({ sumber: proyek.sumber });
    setPesan(
      st === "penanda-ditempel"
        ? `Kajian manual "${s.judul}" sudah ada di daftar rujukan Anda; kini ditandai sebagai kajian dirasah terpilih.`
        : `Kajian manual "${s.judul}" terverifikasi dan ditambahkan sebagai kajian terpilih.`,
    );
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
            Entri dicatat dulu lalu diperiksa: judulnya (atau DOI-nya) dicocokkan ke rekod Crossref dan
            bidangnya dinilai. Hanya entri yang terverifikasi yang bisa dipilih menjadi kajian terpilih;
            yang tidak lulus tetap tampil di bawah sebagai catatan berlabel putusannya.
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
            Catat &amp; periksa kajian
          </button>
        </div>
      )}

      {entriManual.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[12px] font-bold text-ink-900">Catatan kajian manual ({entriManual.length})</h4>
          <ul className="mt-2 space-y-2">
            {entriManual.map((s) => {
              const dipilihManual = p.sumber.some(
                (x) =>
                  x.dirasah &&
                  (x.id === s.id || normalisasiJudul(x.judul) === normalisasiJudul(s.judul)),
              );
              const bolehPilihManual = putusan[s.id]?.status === "terverifikasi";
              return (
                <li key={s.id} className="rounded-xl border border-ink-900/10 bg-white/80 px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-arabic text-[13px] font-semibold text-ink-900" dir="rtl">
                        {s.judul}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-600">
                        {s.penulis}
                        {s.tahun ? ` · ${s.tahun}` : ""}
                        {s.jurnal ? ` · ${s.jurnal}` : s.penerbit ? ` · ${s.penerbit}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        disabled={dipilihManual || !bolehPilihManual}
                        onClick={() => pilihManual(s)}
                        className="rounded-lg bg-ink-900 px-3 py-2 text-[11.5px] font-semibold text-parchment-100 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {dipilihManual ? "Sudah dipilih" : "Pilih kajian ini"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntriManual((m) => m.filter((e) => e.id !== s.id))}
                        className="rounded-lg border border-ink-900/15 px-2 py-1.5 text-[10.5px] font-semibold text-ink-600 hover:border-ink-900/30"
                      >
                        Buang catatan
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <LencanaPutusan put={putusan[s.id]} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasil && (
        <div className="mt-4">
          <h4 className="text-[12px] font-bold text-ink-900">
            Hasil pencarian ({hasil.kajian.length} kajian)
          </h4>
          {hasil.kajian.length === 0 && (
            <p className="mt-2 text-[12px] leading-relaxed text-ink-700">
              Tidak ditemukan kajian terdahulu untuk judul ini.
            </p>
          )}
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
              const put = putusan[k.sumber.id];
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
                      {dipilih
                        ? "Sudah dipilih"
                        : !put || put.status === "memeriksa"
                          ? "Menunggu pemeriksaan"
                          : put.status === "terverifikasi"
                            ? "Pilih kajian ini"
                            : "Tidak dapat dipilih"}
                    </button>
                  </div>

                  <div className="mt-2">
                    <LencanaPutusan put={put} />
                    {k.gerbang && !k.gerbang.lolos && k.gerbang.statusPenilaian === "aturan-keras" && (
                      <p className="mt-1 text-[11.5px] leading-relaxed text-red-700">
                        Aturan keras bidang pada pencarian juga menahan kajian ini: {k.gerbang.bidangSumber}. {k.gerbang.alasan}
                      </p>
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
