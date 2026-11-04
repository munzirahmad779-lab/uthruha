"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { strukturProyek } from "@/lib/content/struktur";
import { BIDANG, getBidang } from "@/lib/content/bidang";
import { composeSection } from "@/lib/engine/compose";
import type { Project } from "@/lib/engine/project";
import { IconArrowRight, IconCheck, IconDownload, IconPen, IconSearch, IconSparkle } from "@/components/icons";
import { CopyButton, Note } from "@/components/ui";
import { Manuscript } from "@/components/manuscript";
import { RefFinder } from "@/components/workspace/ref-finder";
import {
  PasangFootnote,
  ambilParagraf,
  penandaUntuk,
  sisipPenandaKeDraf,
  targetDariKursor,
} from "@/components/workspace/pasang-footnote";
import type { Sumber } from "@/lib/engine/cite";
import { FootnoteBagian } from "@/components/workspace/footnote-bagian";
import { BatasStrip } from "@/components/workspace/batas-strip";

const POLA_PENANDA = /\[\[ref:([^\]|]+)(?:\|hlm:([^\]|]*))?(?:\|jilid:([^\]]*))?\]\]/g;

type PerluKonfirmasi = {
  sumber: Sumber;
  kalimatIdx?: number;
  bidangSumber?: string;
  bidangProyek?: string;
  alasan?: string;
  /** Sidik kandidat terbitan server (Tahap 4): pemasangan paksa hanya
   *  memasang persis kandidat ini lewat sidiknya. */
  sidik?: string;
};

/** Kandidat lolos gerbang dari Generate Footnote mode seleksi. */
type KandidatPanel = {
  sumber: Sumber;
  kalimatIsi?: string;
  tanpaKalimatIsi?: boolean;
  skorModel?: number;
  halamanKosong?: boolean;
};

/** Kandidat tertahan gerbang dari Generate Footnote mode seleksi. */
type TertahanPanel = {
  sumber: Sumber;
  sidik: string;
  bidangSumber: string;
  alasan: string;
  kalimatIsi?: string;
  tanpaKalimatIsi?: boolean;
  halamanKosong?: boolean;
};

type PanelKandidat = {
  kandidat: KandidatPanel[];
  tertahan: TertahanPanel[];
  makna?: { topikParagraf: string; klaim: string; kebutuhan: string; dariModel: boolean };
  catatan?: string;
  paragrafIdx: number;
  kalimatIdx: number;
  /** Posisi seleksi pada teks saat generate diminta, untuk penanaman
   *  penanda tepat sesudah teks yang diblok. */
  posisi: { awal: number; akhir: number; teks: string };
};

/** Hapus fragmen penanda rusak, penanda valid dipertahankan utuh. */
function bersihkanFragmen(teks: string): string {
  let hasil = "";
  let i = 0;
  const validDi = new RegExp(POLA_PENANDA.source, "y");
  while (i < teks.length) {
    if (teks.startsWith("[[", i)) {
      validDi.lastIndex = i;
      const cocok = validDi.exec(teks);
      if (cocok && cocok.index === i) {
        hasil += cocok[0];
        i += cocok[0].length;
        continue;
      }
      const tutup = teks.indexOf("]]", i);
      if (tutup !== -1 && tutup - i < 100) {
        i = tutup + 2;
      } else {
        let j = i;
        while (j < teks.length && !/\s/.test(teks[j] ?? "")) j++;
        i = j;
      }
      continue;
    }
    if (teks.startsWith("ref:", i)) {
      let j = i;
      while (j < teks.length && !/[\s\]]/.test(teks[j] ?? "")) j++;
      if (teks.slice(j, j + 2) === "]]") j += 2;
      else if (teks[j] === "]") j++;
      i = j;
      continue;
    }
    hasil += teks[i];
    i++;
  }
  return hasil;
}

export function TulisTab({
  p,
  ubah,
  bagian,
  setBagian,
  onSusun,
  onKembangkan,
}: {
  p: Project;
  ubah: (patch: Partial<Project>) => void;
  bagian: string;
  setBagian: (id: string) => void;
  onSusun: (id: string) => void;
  /** Fase 3 (G): pindah ke panel Kembangkan (tab Rujukan) membawa paragraf + rujukan. */
  onKembangkan?: () => void;
}) {
  const st = strukturProyek(p);
  const semua = st.chapters.flatMap((c) => c.sections.map((s) => ({ ...s, bab: c.labelAr })));
  const aktif = semua.find((s) => s.id === bagian) ?? semua[0];
  const [teks, setTeks] = useState(p.draf[bagian] ?? "");
  const [pratinjau, setPratinjau] = useState(false);
  const [cariRujukan, setCariRujukan] = useState(false);
  const [pasangTarget, setPasangTarget] = useState<{ sumber: import("@/lib/engine/cite").Sumber; kutipan?: string; paragrafIdx?: number; kalimatIdx?: number; gerbang?: { bidangSumber: string; alasan: string } } | null>(null);
  const [seleksi, setSeleksi] = useState<{ teks: string; awal: number; akhir: number } | null>(null);
  const [panelKandidat, setPanelKandidat] = useState<PanelKandidat | null>(null);
  const [kursor, setKursor] = useState<number | null>(null);
  const [pesanPasang, setPesanPasang] = useState("");
  const [sibukGenerate, setSibukGenerate] = useState(false);
  const [pesanGenerate, setPesanGenerate] = useState<{
    jenis: "ok" | "info" | "galat";
    teks: string;
  } | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<{
    perlu: PerluKonfirmasi;
    paragraf: string;
    paragrafIdx: number;
    kalimatIdx: number;
  } | null>(null);
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
  const penandaDraf = useMemo(
    () =>
      [...teks.matchAll(POLA_PENANDA)].map((m) => ({
        id: (m[1] ?? "").trim(),
        hlm: (m[2] ?? "").trim(),
        jilid: (m[3] ?? "").trim(),
      })),
    [teks],
  );
  const adaFragmenRusak = useMemo(() => {
    const sisa = teks.replace(POLA_PENANDA, "");
    return sisa.includes("[[") || sisa.includes("ref:");
  }, [teks]);

  function bersihkanFragmenDraf() {
    const bersih = bersihkanFragmen(teks);
    setTeks(bersih);
    sinkron.current = bersih;
    ubah({ draf: { ...p.draf, [bagian]: bersih } });
  }

  const selesai = semua.filter((s) => (p.draf[s.id] ?? "").trim().length > 80).length;

  function susunUlang() {
    const hasil = composeSection(p, bagian, Date.now() % 100000);
    setTeks(hasil.markdown);
    sinkron.current = hasil.markdown;
    ubah({ draf: { ...p.draf, [bagian]: hasil.markdown } });
  }

  /**
   * Generate Footnote otomatis (Premium): paragraf tempat kursor berada
   * dikirim ke server; AI menyusun kalimat kunci, mencari rujukan di web
   * (atau memakai bank rujukan bersama), memilih kalimat tempat menempel.
   * Di sini tinggal tanam penandanya — tanpa dialog sama sekali.
   */
  async function generateOtomatis(opsi?: {
    paragraf?: string;
    paragrafIdx?: number;
    kalimatIdx?: number;
  }) {
    if (sibukGenerate) return;
    // Samakan dulu draf proyek dengan isi editor, lalu tentukan paragraf
    // dan kalimat dari posisi kursor terakhir yang tercatat.
    sinkron.current = teks;
    ubah({ draf: { ...p.draf, [bagian]: teks } });
    const targetKursor = kursor != null ? targetDariKursor(teks, kursor) : null;
    const target =
      opsi?.paragraf && typeof opsi.paragrafIdx === "number"
        ? { paragrafIdx: opsi.paragrafIdx, kalimatIdx: opsi.kalimatIdx ?? targetKursor?.kalimatIdx ?? 0 }
        : targetKursor;
    const paragraf = opsi?.paragraf ?? (target ? ambilParagraf(teks, target.paragrafIdx) : null);
    if (!target || !paragraf) {
      setPesanGenerate({
        jenis: "info",
        teks: "Taruh kursor dulu di dalam paragraf yang mau diberi footnote, lalu klik Generate footnote lagi.",
      });
      return;
    }
    setSibukGenerate(true);
    setPesanGenerate(null);
    try {
      const res = await fetch("/api/footnote/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paragraf,
          judulProyek: p.judulAr ?? "",
          kalimatKursor: target.kalimatIdx,
          bidangId: p.bidangId,
          // Sinyal konteks gerbang relevansi: sejak Tahap 2 judul adalah
          // masukan tema satu-satunya; topikAr warisan hanya cadangan
          // untuk proyek lama yang judulnya masih kosong. Nama field
          // topikAr dipertahankan sebagai kontrak server; nilainya
          // judul lebih dulu (perbaikan telaah ulang Tahap 2, R4).
          topikAr: p.judulAr || p.topikAr,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ketemu?: boolean;
        sumber?: Sumber;
        kalimatIdx?: number;
        dariBank?: boolean;
        catatan?: string;
        error?: string;
        perluKonfirmasi?: PerluKonfirmasi;
      } | null;
      if (!res.ok) {
        setPesanGenerate({
          jenis: "galat",
          teks: data?.error ?? "Generate footnote gagal. Coba lagi sebentar.",
        });
        return;
      }
      if (data?.perluKonfirmasi?.sumber) {
        setKonfirmasi({
          perlu: data.perluKonfirmasi,
          paragraf,
          paragrafIdx: target.paragrafIdx,
          kalimatIdx: target.kalimatIdx,
        });
        return;
      }
      if (!data?.ketemu || !data.sumber) {
        setPesanGenerate({
          jenis: "info",
          teks: data?.catatan ?? "Belum ditemukan rujukan yang cocok untuk paragraf ini.",
        });
        return;
      }
      const sumberBaru = data.sumber;
      // Rujukan yang sama sudah tersimpan? Pakai yang lama agar sitasi
      // berulang mendapat nomor dan bentuk singkat yang benar.
      const sudahAda = p.sumber.find(
        (s) =>
          (sumberBaru.doi && s.doi && s.doi.toLowerCase() === sumberBaru.doi.toLowerCase()) ||
          s.judul.trim().toLowerCase() === sumberBaru.judul.trim().toLowerCase(),
      );
      const sumberFinal = sudahAda ?? sumberBaru;
      if (
        sudahAda &&
        (teks.includes(`[[ref:${sumberFinal.id}]]`) || teks.includes(`[[ref:${sumberFinal.id}|`))
      ) {
        setKonfirmasi(null);
        setPesanGenerate({
          jenis: "info",
          teks: `Sumber ini sudah terpasang di bagian ini: ${sumberFinal.judul}. Penanda yang sama tidak dipasang lagi.`,
        });
        return;
      }
      // Gerbang lapis server, sama seperti dialog manual (403 = tolak).
      try {
        const gerbang = await fetch("/api/lapis/footnote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proyekId: p.id, paragrafId: `${bagian}:${target.paragrafIdx}` }),
        });
        if (gerbang.status === 403) {
          const g = (await gerbang.json().catch(() => null)) as { error?: string } | null;
          setPesanGenerate({
            jenis: "galat",
            teks: g?.error ?? "Pemasangan footnote ditolak oleh aturan lapis akun Anda.",
          });
          return;
        }
      } catch {
        /* lanjut lokal, sama seperti dialog */
      }
      const kalimatIdx = typeof data.kalimatIdx === "number" ? data.kalimatIdx : target.kalimatIdx;
      const drafBaru = sisipPenandaKeDraf(teks, target.paragrafIdx, kalimatIdx, penandaUntuk(sumberFinal));
      ubah({
        sumber: sudahAda ? p.sumber : [...p.sumber, sumberBaru],
        draf: { ...p.draf, [bagian]: drafBaru },
      });
      setTeks(drafBaru);
      sinkron.current = drafBaru;
      setKonfirmasi(null);
      setPesanGenerate({
        jenis: "ok",
        teks: `Footnote terpasang otomatis di paragraf ${target.paragrafIdx + 1}, setelah kalimat ${kalimatIdx + 1}: ${sumberFinal.judul}${data.dariBank ? " (dari bank rujukan bersama, tanpa pencarian baru)" : ""}`,
      });
    } catch {
      setPesanGenerate({
        jenis: "galat",
        teks: "Generate footnote gagal tersambung ke server. Periksa koneksi lalu coba lagi.",
      });
    } finally {
      setSibukGenerate(false);
    }
  }

  /**
   * Catat seleksi teks di editor (Tahap 4). Seleksi sah untuk Generate
   * Footnote bila panjangnya minimal 20 karakter dan tidak melintasi
   * batas paragraf: unit pencariannya adalah teks yang diblok itu utuh.
   */
  function catatSeleksi(el: HTMLTextAreaElement) {
    setKursor(el.selectionStart);
    const awal = el.selectionStart ?? 0;
    const akhir = el.selectionEnd ?? 0;
    const potongan = el.value.slice(awal, akhir);
    if (akhir - awal >= 20 && !potongan.includes("\n\n") && potongan.trim().length >= 20) {
      setSeleksi({ teks: potongan.replace(/\s+/g, " ").trim(), awal, akhir });
    } else {
      setSeleksi(null);
    }
  }

  /**
   * Tanam penanda untuk satu sumber pada draf bagian ini, dipakai alur
   * seleksi dan pemasangan lewat sidik. Bila posisi seleksi masih utuh
   * pada teks, penanda ditanam tepat sesudah teks yang diblok; selain
   * itu jatuh ke penanaman per kalimat seperti alur lama. Duplikat
   * sumber yang sama pada bagian ini ditolak dengan pesan (penjaga B2).
   */
  async function tanamSumber(
    sumberBaru: Sumber,
    target: {
      paragrafIdx: number;
      kalimatIdx: number;
      posisi?: { awal: number; akhir: number; teks: string };
    },
  ): Promise<boolean> {
    const sudahAda = p.sumber.find(
      (s) =>
        (sumberBaru.doi && s.doi && s.doi.toLowerCase() === sumberBaru.doi.toLowerCase()) ||
        s.judul.trim().toLowerCase() === sumberBaru.judul.trim().toLowerCase(),
    );
    const sumberFinal = sudahAda ?? sumberBaru;
    if (
      sudahAda &&
      (teks.includes(`[[ref:${sumberFinal.id}]]`) || teks.includes(`[[ref:${sumberFinal.id}|`))
    ) {
      setPesanGenerate({
        jenis: "info",
        teks: `Sumber ini sudah terpasang di bagian ini: ${sumberFinal.judul}. Penanda yang sama tidak dipasang lagi.`,
      });
      return false;
    }
    try {
      const gerbang = await fetch("/api/lapis/footnote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyekId: p.id, paragrafId: `${bagian}:${target.paragrafIdx}` }),
      });
      if (gerbang.status === 403) {
        const g = (await gerbang.json().catch(() => null)) as { error?: string } | null;
        setPesanGenerate({
          jenis: "galat",
          teks: g?.error ?? "Pemasangan footnote ditolak oleh aturan lapis akun Anda.",
        });
        return false;
      }
    } catch {
      /* lanjut lokal, sama seperti dialog */
    }
    const penanda = penandaUntuk(sumberFinal);
    const drafBaru =
      target.posisi && teks.slice(target.posisi.awal, target.posisi.akhir) !== "" &&
      teks.slice(target.posisi.akhir - target.posisi.teks.length, target.posisi.akhir) === target.posisi.teks
        ? `${teks.slice(0, target.posisi.akhir)}${penanda}${teks.slice(target.posisi.akhir)}`
        : sisipPenandaKeDraf(teks, target.paragrafIdx, target.kalimatIdx, penanda);
    ubah({
      sumber: sudahAda ? p.sumber : [...p.sumber, sumberBaru],
      draf: { ...p.draf, [bagian]: drafBaru },
    });
    setTeks(drafBaru);
    sinkron.current = drafBaru;
    setPesanGenerate({
      jenis: "ok",
      teks: `Footnote terpasang untuk teks yang diblok: ${sumberFinal.judul}`,
    });
    return true;
  }

  /**
   * Generate Footnote mode seleksi (Tahap 4): teks yang diblok dikirim
   * utuh sebagai unit pencarian beserta paragraf konteksnya. Server
   * mengembalikan daftar kandidat; mahasiswa memilih sendiri di panel.
   */
  async function generateSeleksi() {
    if (sibukGenerate || !seleksi) return;
    sinkron.current = teks;
    ubah({ draf: { ...p.draf, [bagian]: teks } });
    const target = targetDariKursor(teks, seleksi.awal);
    const paragraf = target ? ambilParagraf(teks, target.paragrafIdx) : null;
    if (!target || !paragraf) {
      setPesanGenerate({
        jenis: "info",
        teks: "Teks yang diblok tidak berada di paragraf isi. Blok kalimat di dalam paragraf naskah, lalu coba lagi.",
      });
      return;
    }
    setSibukGenerate(true);
    setPesanGenerate(null);
    setPanelKandidat(null);
    try {
      const res = await fetch("/api/footnote/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paragraf,
          seleksi: seleksi.teks,
          judulProyek: p.judulAr ?? "",
          bidangId: p.bidangId,
          topikAr: p.judulAr || p.topikAr,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        kandidat?: KandidatPanel[];
        tertahan?: TertahanPanel[];
        makna?: PanelKandidat["makna"];
        catatan?: string;
        kalimatIdx?: number;
        error?: string;
      } | null;
      if (!res.ok) {
        setPesanGenerate({
          jenis: "galat",
          teks: data?.error ?? "Generate footnote gagal. Coba lagi sebentar.",
        });
        return;
      }
      setPanelKandidat({
        kandidat: data?.kandidat ?? [],
        tertahan: data?.tertahan ?? [],
        makna: data?.makna,
        catatan: data?.catatan,
        paragrafIdx: target.paragrafIdx,
        kalimatIdx: typeof data?.kalimatIdx === "number" ? data.kalimatIdx : target.kalimatIdx,
        posisi: { awal: seleksi.awal, akhir: seleksi.akhir, teks: seleksi.teks },
      });
    } catch {
      setPesanGenerate({
        jenis: "galat",
        teks: "Generate footnote gagal tersambung ke server. Periksa koneksi lalu coba lagi.",
      });
    } finally {
      setSibukGenerate(false);
    }
  }

  /**
   * Pasang PERSIS kandidat tertahan yang disetujui (Tahap 4): server
   * memverifikasi sidiknya dan mengembalikan kandidat itu sendiri;
   * tidak ada pencarian atau penilaian ulang. Dipakai panel kandidat
   * mode seleksi dan panel konfirmasi alur kursor lama.
   */
  async function pasangLewatSidik(opsiPasang: {
    sidik: string;
    kandidat: Sumber;
    paragraf: string;
    paragrafIdx: number;
    kalimatIdx: number;
    posisi?: { awal: number; akhir: number; teks: string };
  }) {
    if (sibukGenerate) return;
    setSibukGenerate(true);
    setPesanGenerate(null);
    try {
      const res = await fetch("/api/footnote/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paragraf: opsiPasang.paragraf,
          sidikDisetujui: opsiPasang.sidik,
          kandidatDisetujui: opsiPasang.kandidat,
          kalimatKursor: opsiPasang.kalimatIdx,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ketemu?: boolean;
        sumber?: Sumber;
        kalimatIdx?: number;
        catatan?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.ketemu || !data.sumber) {
        setPesanGenerate({
          jenis: "info",
          teks: data?.catatan ?? data?.error ?? "Pemasangan kandidat yang disetujui gagal. Minta generate ulang.",
        });
        return;
      }
      const ok = await tanamSumber(data.sumber, {
        paragrafIdx: opsiPasang.paragrafIdx,
        kalimatIdx: typeof data.kalimatIdx === "number" ? data.kalimatIdx : opsiPasang.kalimatIdx,
        posisi: opsiPasang.posisi,
      });
      if (ok) {
        setKonfirmasi(null);
        setPanelKandidat(null);
      }
    } catch {
      setPesanGenerate({
        jenis: "galat",
        teks: "Pemasangan gagal tersambung ke server. Periksa koneksi lalu coba lagi.",
      });
    } finally {
      setSibukGenerate(false);
    }
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

        {bagian === "khalfiya" && (
          <div className="mt-3 rounded-xl border border-gold-600/30 bg-gold-500/5 px-3 py-2.5">
            {(() => {
              const jumlahParagraf = teks.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean).length;
              const refsBab = (p.temuan ?? []).length;
              return (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[12px] leading-relaxed text-ink-700">
                    <span className="font-semibold text-ink-900">Khalfiyah: {jumlahParagraf} paragraf.</span>{" "}
                    Draf awal bagian ini tersusun otomatis dari data proyek Anda (judul, topik,
                    fenomena). Sunting dan padatkan sesuai alur pedoman: pengantar & konteks topik,
                    masalah/fenomena, lalu kesenjangan dari penelitian terdahulu & urgensi
                    penelitian Anda. Footnote dipasang sesudahnya per kalimat lewat strip Footnote
                    bagian ini di bawah editor.
                  </p>
                  <button
                    type="button"
                    disabled={jumlahParagraf === 0}
                    onClick={() => {
                      ubah({
                        jawaban: {
                          ...p.jawaban,
                          "kembangkan:khalfiya": JSON.stringify({
                            teks,
                            jumlahParagraf,
                            jumlahRefTersimpan: refsBab,
                            jumlahSumber: p.sumber.length,
                            pada: new Date().toISOString(),
                          }),
                        },
                      });
                      onKembangkan?.();
                    }}
                    className="btn-quiet shrink-0 disabled:opacity-40"
                  >
                    Kembangkan → <IconArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[11px] text-ink-500">
                    Paragraf + {refsBab} rujukan tersimpan terbawa otomatis ke panel Kembangkan (tab Rujukan).
                  </span>
                </div>
              );
            })()}
          </div>
        )}

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
              onSelect={(e) => catatSeleksi(e.currentTarget)}
              onClick={(e) => catatSeleksi(e.currentTarget)}
              onKeyUp={(e) => catatSeleksi(e.currentTarget)}
              dir="rtl"
              spellCheck={false}
              className="doc-scroll min-h-[26rem] w-full rounded-xl border border-ink-900/15 bg-white p-4 text-right font-naskh text-[15.5px] leading-[2.1] text-ink-900 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
              placeholder="اكتب هنا، أو اضغط «Susun draf» لتوليد هيكل أولي…"
            />
          )}
        </div>

        {!pratinjau && seleksi && (
          <div className="mt-2 rounded-xl border border-gold-500/50 bg-gold-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              Teks diblok untuk footnote
            </p>
            <p className="mt-0.5 line-clamp-2 font-naskh text-[13px] leading-relaxed text-ink-900" dir="rtl">
              {seleksi.teks}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void generateSeleksi()}
                disabled={sibukGenerate}
                className="btn-primary !py-1.5 !text-[12px] disabled:opacity-40"
              >
                {sibukGenerate ? "Mencari kandidat…" : "Generate footnote untuk teks ini"}
              </button>
              <span className="text-[11px] text-ink-600">
                Unit pencarian = teks yang diblok ini utuh, bukan potongan kalimat kunci. Hasilnya berupa kandidat;
                Anda yang memilih mana yang dipasang.
              </span>
            </div>
          </div>
        )}

        {panelKandidat && (
          <div className="mt-3 rounded-xl border border-ink-900/15 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-ink-900">Kandidat footnote untuk teks yang diblok</p>
              <button type="button" onClick={() => setPanelKandidat(null)} className="btn-ghost !py-1 !text-[11px]">
                Tutup panel
              </button>
            </div>
            {panelKandidat.makna &&
              (panelKandidat.makna.dariModel ? (
                <p className="mt-1 text-[12px] leading-relaxed text-ink-700">
                  Yang dipahami sistem dari paragraf ini: <strong>{panelKandidat.makna.topikParagraf || "—"}</strong>
                  {panelKandidat.makna.klaim ? <> · klaim kalimat yang diblok: {panelKandidat.makna.klaim}</> : null}
                  {panelKandidat.makna.kebutuhan ? <> · kebutuhan rujukan: {panelKandidat.makna.kebutuhan}</> : null}
                </p>
              ) : (
                <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                  Analisis makna oleh model tidak berhasil pada percobaan ini, jadi pencarian memakai teks yang
                  diblok itu sendiri apa adanya. Kandidat di bawah tetap melewati gerbang penilaian.
                </p>
              ))}
            {panelKandidat.catatan && (
              <p className="mt-1 text-[12px] leading-relaxed text-ink-700">{panelKandidat.catatan}</p>
            )}
            {panelKandidat.kandidat.length === 0 && panelKandidat.tertahan.length === 0 && (
              <p className="mt-2 text-[12px] leading-relaxed text-ink-700">
                Tidak ada kandidat yang lolos gerbang untuk teks ini. Coba blok kalimat lain, atau pakai Cari
                Rujukan manual.
              </p>
            )}
            <div className="mt-2 space-y-2.5">
              {panelKandidat.kandidat.map((k, i) => (
                <div key={`kand-${i}`} className="rounded-lg border border-ink-900/10 bg-cream-50 px-3 py-2.5">
                  <p className="font-naskh text-[13.5px] font-semibold leading-relaxed text-ink-900" dir="rtl">
                    {k.sumber.judul}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-600">
                    {k.sumber.penulis || "penulis tidak tercantum"}
                    {k.sumber.tahun ? ` · ${k.sumber.tahun}` : ""}
                    {k.sumber.jurnal ?? k.sumber.penerbit ? ` · ${k.sumber.jurnal ?? k.sumber.penerbit}` : ""}
                    {k.sumber.doi ? ` · DOI ${k.sumber.doi}` : ""}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {k.halamanKosong ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                        Tanpa nomor halaman
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                        Halaman {k.sumber.halaman}
                      </span>
                    )}
                    {typeof k.skorModel === "number" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                        Skor relevansi {k.skorModel}
                      </span>
                    )}
                  </p>
                  {k.kalimatIsi ? (
                    <blockquote className="mt-1.5 rounded-md bg-white px-2.5 py-2 font-naskh text-[12.5px] leading-relaxed text-ink-800" dir="rtl">
                      {k.kalimatIsi}
                    </blockquote>
                  ) : (
                    <p className="mt-1.5 text-[11.5px] italic leading-relaxed text-ink-500">
                      Sumber ini tidak menyediakan cuplikan isi, jadi tidak ada kalimat isi yang bisa ditampilkan.
                      Periksa sumbernya langsung sebelum memasang.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={sibukGenerate}
                    onClick={() =>
                      panelKandidat &&
                      void tanamSumber(k.sumber, {
                        paragrafIdx: panelKandidat.paragrafIdx,
                        kalimatIdx: panelKandidat.kalimatIdx,
                        posisi: panelKandidat.posisi,
                      }).then((ok) => {
                        if (ok) setPanelKandidat(null);
                      })
                    }
                    className="btn-primary mt-2 !py-1.5 !text-[12px] disabled:opacity-40"
                  >
                    Pasang yang ini
                  </button>
                </div>
              ))}
            </div>
            {panelKandidat.tertahan.length > 0 && (
              <div className="mt-3">
                <p className="text-[12px] font-semibold text-red-800">
                  Tertahan gerbang relevansi bidang (belum terpasang; pasang hanya bila Anda sudah memeriksa isinya):
                </p>
                <div className="mt-1.5 space-y-2.5">
                  {panelKandidat.tertahan.map((t, i) => (
                    <div key={`thn-${i}`} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5">
                      <p className="font-naskh text-[13.5px] font-semibold leading-relaxed text-ink-900" dir="rtl">
                        {t.sumber.judul}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-red-800">
                        Bidang sumber: {t.bidangSumber || "tidak terdeteksi"}. {t.alasan}
                      </p>
                      {t.halamanKosong && (
                        <p className="mt-1">
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                            Tanpa nomor halaman
                          </span>
                        </p>
                      )}
                      {t.kalimatIsi ? (
                        <blockquote className="mt-1.5 rounded-md bg-white px-2.5 py-2 font-naskh text-[12.5px] leading-relaxed text-ink-800" dir="rtl">
                          {t.kalimatIsi}
                        </blockquote>
                      ) : (
                        t.tanpaKalimatIsi && (
                          <p className="mt-1.5 text-[11.5px] italic leading-relaxed text-ink-500">
                            Sumber ini tidak menyediakan cuplikan isi.
                          </p>
                        )
                      )}
                      <button
                        type="button"
                        disabled={sibukGenerate}
                        onClick={() =>
                          void pasangLewatSidik({
                            sidik: t.sidik,
                            kandidat: t.sumber,
                            paragraf: ambilParagraf(teks, panelKandidat.paragrafIdx) ?? "",
                            paragrafIdx: panelKandidat.paragrafIdx,
                            kalimatIdx: panelKandidat.kalimatIdx,
                            posisi: panelKandidat.posisi,
                          })
                        }
                        className="btn-ghost mt-2 !py-1.5 !text-[12px] disabled:opacity-40"
                      >
                        Tetap pasang kandidat ini
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(penandaDraf.length > 0 || adaFragmenRusak) && (
          <div className="mt-2 space-y-2">
            {penandaDraf.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Penanda sitasi di draf ini">
                {penandaDraf.map((pen, i) => {
                  const sumberPen = p.sumber.find((s) => s.id === pen.id);
                  return (
                    <span
                      key={`${pen.id}-${i}`}
                      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                        sumberPen
                          ? "border-ink-900/15 bg-white/70 text-ink-800"
                          : "border-red-300 bg-red-50 font-semibold text-red-700"
                      }`}
                    >
                      <span className="truncate">{sumberPen ? sumberPen.judul : "rujukan hilang"}</span>
                      {pen.hlm && <span className="shrink-0 text-ink-500">hlm. {pen.hlm}</span>}
                      {pen.jilid && <span className="shrink-0 text-ink-500">jilid {pen.jilid}</span>}
                    </span>
                  );
                })}
              </div>
            )}
            {adaFragmenRusak && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <span>Ada fragmen penanda sitasi rusak di draf ini</span>
                <button type="button" onClick={bersihkanFragmenDraf} className="btn-quiet !py-0.5 !text-[11px]">
                  Bersihkan fragmen
                </button>
              </div>
            )}
          </div>
        )}

        {cariRujukan && (
          <RefFinder
            p={p}
            tutup={() => setCariRujukan(false)}
            onPasang={(sumber, kutipan, gerbang) => {
              setCariRujukan(false);
              setPasangTarget({ sumber, kutipan, gerbang });
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
            gerbangTertahan={pasangTarget.gerbang ?? null}
            babAwalId={bagian}
            paragrafAwal={pasangTarget.paragrafIdx}
            kalimatAwal={pasangTarget.kalimatIdx}
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
        {pesanGenerate && (
          <p
            className={`mt-2 rounded-lg px-3 py-2 text-[12px] ${
              pesanGenerate.jenis === "ok"
                ? "bg-emerald-50 text-emerald-900"
                : pesanGenerate.jenis === "galat"
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-900"
            }`}
          >
            {pesanGenerate.teks}
          </p>
        )}

        {konfirmasi && (
          <div className="mt-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3" role="alert">
            <p className="text-[13px] font-bold text-red-900">Konfirmasi pemasangan sumber</p>
            <p className="mt-1 font-naskh text-[13px] leading-relaxed text-ink-900" dir="rtl">
              {konfirmasi.perlu.sumber.judul}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-800">
              Bidang sumber:{" "}
              <strong>
                {(() => {
                  const cocok = BIDANG.find((b) => b.id === konfirmasi.perlu.bidangSumber);
                  return cocok ? cocok.labelId : konfirmasi.perlu.bidangSumber || "tidak diketahui";
                })()}
              </strong>{" "}
              · Bidang proyek: <strong>{getBidang(p.bidangId).labelId}</strong>
              {getBidang(p.bidangId).labelAr ? ` (${getBidang(p.bidangId).labelAr})` : ""}
            </p>
            {konfirmasi.perlu.alasan && (
              <p className="mt-1 text-[12px] leading-relaxed text-ink-700">Alasan ditahan: {konfirmasi.perlu.alasan}</p>
            )}
            <p className="mt-1 text-[12px] leading-relaxed text-ink-700">
              Sumber ini belum dipasang. Pilih apakah tetap dipasang atau tidak.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sibukGenerate || !konfirmasi.perlu.sidik}
                onClick={() =>
                  konfirmasi.perlu.sidik &&
                  void pasangLewatSidik({
                    sidik: konfirmasi.perlu.sidik,
                    kandidat: konfirmasi.perlu.sumber,
                    paragraf: konfirmasi.paragraf,
                    paragrafIdx: konfirmasi.paragrafIdx,
                    kalimatIdx: konfirmasi.perlu.kalimatIdx ?? konfirmasi.kalimatIdx,
                  })
                }
                className="btn-primary !py-1.5 !text-[12px] disabled:opacity-40"
              >
                Tetap pasang kandidat ini
              </button>
              <button type="button" onClick={() => setKonfirmasi(null)} className="btn-ghost !py-1.5 !text-[12px]">
                Jangan pasang
              </button>
            </div>
            {!konfirmasi.perlu.sidik && (
              <p className="mt-2 text-[12px] leading-relaxed text-ink-700">
                Kandidat ini tidak membawa sidik persetujuan dari server, jadi tidak bisa dipasang paksa. Minta
                generate ulang agar kandidat terbit dengan sidiknya.
              </p>
            )}
          </div>
        )}

        <FootnoteBagian
          p={p}
          bagian={bagian}
          onCariRujukan={() => setCariRujukan(true)}
          onPasang={(sumber) => setPasangTarget({ sumber })}
          onGenerate={() => void generateOtomatis()}
          sibukGenerate={sibukGenerate}
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
