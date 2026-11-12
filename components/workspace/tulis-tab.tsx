"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { strukturProyek } from "@/lib/content/struktur";
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
import { bersihkanJudul, type Sumber } from "@/lib/engine/cite";
import { normalisasiDoi, normalisasiJudul } from "@/lib/engine/referensi";
import { FootnoteBagian, kemunculanBagian, kompilasiBagian } from "@/components/workspace/footnote-bagian";
import { EditorPenanda, type FokusPenanda } from "@/components/workspace/editor-penanda";
import { pecahSegmen } from "@/lib/engine/marker";
import { BatasStrip } from "@/components/workspace/batas-strip";
import { DRAF_DEMO_BAB1, SUMBER_DEMO_BAB1, kataDemo } from "@/lib/demo/draf-bab1";
import { SerahAiPanel } from "@/components/workspace/serah-ai-panel";
import type { KonteksKembangkan } from "@/lib/engine/ai-handoff";

// Kelas id sama dengan POLA di marker.ts (tanpa spasi/kurung/pipa).
const POLA_PENANDA = /\[\[ref:([^\s\]|[]+)(?:\|hlm:([^\]|]*))?(?:\|jilid:([^\]]*))?\]\]/g;

/** Kandidat lolos semua periksa dari Generate Footnote mode seleksi.
 *  Sidiknya diterbitkan server; pemasangan berjalan lewat endpoint
 *  pasang yang memeriksa ulang kelulusannya (Tahap C). */
type KandidatPanel = {
  sumber: Sumber;
  sidik: string;
  kalimatIsi?: string;
  tanpaKalimatIsi?: boolean;
  skorModel?: number;
  halamanKosong?: boolean;
};

/** Kandidat yang TIDAK lulus periksa dari Generate Footnote mode
 *  seleksi (Tahap C): tampil berlabel putusan, tanpa jalan pasang. */
type DitolakPanel = {
  sumber: Sumber;
  status: "gagal-metadata" | "gagal-bidang" | "belum-terverifikasi";
  alasan: string;
  bidangSumber: string;
  kalimatIsi?: string;
  tanpaKalimatIsi?: boolean;
  halamanKosong?: boolean;
};

/** Label putusan periksa untuk kartu kandidat yang ditolak. */
function labelStatusDitolak(status: DitolakPanel["status"]): string {
  switch (status) {
    case "gagal-metadata":
      return "Gagal periksa metadata";
    case "gagal-bidang":
      return "Tidak sesuai bidang";
    case "belum-terverifikasi":
      return "Belum terverifikasi";
  }
}

type PanelKandidat = {
  kandidat: KandidatPanel[];
  ditolak: DitolakPanel[];
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
  const [pasangTarget, setPasangTarget] = useState<{ sumber: import("@/lib/engine/cite").Sumber; kutipan?: string; paragrafIdx?: number; kalimatIdx?: number } | null>(null);
  const [seleksi, setSeleksi] = useState<{ teks: string; awal: number; akhir: number } | null>(null);
  const [fokusPenanda, setFokusPenanda] = useState<FokusPenanda | null>(null);
  const [panelKandidat, setPanelKandidat] = useState<PanelKandidat | null>(null);
  const [serahTerbuka, setSerahTerbuka] = useState(false);
  const [kursor, setKursor] = useState<number | null>(null);
  const [pesanPasang, setPesanPasang] = useState("");
  const [menuFootnote, setMenuFootnote] = useState(false);
  const [pesanDemo, setPesanDemo] = useState("");
  const [sibukGenerate, setSibukGenerate] = useState(false);
  const [pesanGenerate, setPesanGenerate] = useState<{
    jenis: "ok" | "info" | "galat";
    teks: string;
  } | null>(null);
  const sinkron = useRef(p.draf[bagian] ?? "");

  // Ganti bagian: muat draf bagian tersebut.
  useEffect(() => {
    const isi = p.draf[bagian] ?? "";
    setTeks(isi);
    sinkron.current = isi;
    setFokusPenanda(null);
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
  // Tahap 5: segmen tampil editor (teks / penanda / fragmen) dan nomor
  // footnote dokumen tiap penanda, dari teks editor langsung.
  const segmenDraf = useMemo(() => pecahSegmen(teks), [teks]);
  const kemunculanDraf = useMemo(() => kemunculanBagian(p, bagian, teks), [p, bagian, teks]);
  const nomorSegmen = useMemo(() => kemunculanDraf.map((k) => k.nomor), [kemunculanDraf]);
  const adaFragmenRusak = useMemo(() => segmenDraf.some((s) => s.jenis === "fragmen"), [segmenDraf]);
  const adaPenandaTakDikenal = useMemo(
    () => kemunculanDraf.some((k) => k.nomor === null),
    [kemunculanDraf],
  );

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
      } | null;
      if (!res.ok) {
        setPesanGenerate({
          jenis: "galat",
          teks: data?.error ?? "Generate footnote gagal. Coba lagi sebentar.",
        });
        return;
      }
      // Tahap C: server tidak lagi menawarkan kandidat yang tidak
      // lolos periksa untuk dipasang; ketemu false berarti tidak ada
      // kandidat lolos, dan catatan server menjelaskannya.
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
      // Pencocokan memakai identitas ternormalisasi (Tahap 6): id
      // stabil, DOI bersih, atau judul ternormalisasi yang kebal tag
      // jenis warisan — karya yang sama dari jalur Generate dan dari
      // dialog Cari Rujukan kini saling dikenali (L1 Tahap 4).
      const sudahAda = p.sumber.find(
        (s) =>
          s.id === sumberBaru.id ||
          (sumberBaru.doi && s.doi && normalisasiDoi(s.doi) === normalisasiDoi(sumberBaru.doi)) ||
          normalisasiJudul(s.judul) === normalisasiJudul(sumberBaru.judul),
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
   * Catat seleksi teks di editor (Tahap 4). Offset yang dilaporkan
   * EditorPenanda adalah offset pada string draf serial — semantik yang
   * sama dengan selectionStart textarea lama. Seleksi sah untuk
   * Generate Footnote bila panjangnya minimal 20 karakter dan tidak
   * melintasi batas paragraf: unit pencariannya adalah teks yang
   * diblok itu utuh.
   */
  function catatSeleksi(awal: number, akhir: number, nilaiKini: string) {
    setKursor(awal);
    const potongan = nilaiKini.slice(awal, akhir);
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
    // Judul dibersihkan di titik tanam (Tahap 6): sumber yang masuk
    // daftar proyek tidak boleh membawa tag jenis pada judulnya.
    sumberBaru = { ...sumberBaru, judul: bersihkanJudul(sumberBaru.judul) };
    // Penjaga duplikat lintas jalur (Tahap 6): id stabil, DOI bersih,
    // atau judul ternormalisasi — sumber warisan bertajuk tercemar
    // tag tetap dikenali sebagai karya yang sama.
    const sudahAda = p.sumber.find(
      (s) =>
        s.id === sumberBaru.id ||
        (sumberBaru.doi && s.doi && normalisasiDoi(s.doi) === normalisasiDoi(sumberBaru.doi)) ||
        normalisasiJudul(s.judul) === normalisasiJudul(sumberBaru.judul),
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
        ditolak?: DitolakPanel[];
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
        ditolak: data?.ditolak ?? [],
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
   * Pasang PERSIS kandidat lolos yang dipilih (Tahap C): server
   * memverifikasi sidiknya DAN memeriksa ulang kelulusan kandidat
   * (metadata + bidang, segar) sebelum mengembalikannya untuk
   * ditanam. Penolakan periksa ulang datang sebagai 403 + alasan dan
   * ditampilkan apa adanya. Hanya kandidat lolos dari panel yang
   * punya sidik; kandidat yang ditolak tidak memanggil fungsi ini.
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
          bidangId: p.bidangId,
          judulProyek: p.judulAr ?? "",
          topikAr: p.judulAr || p.topikAr,
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
          teks: data?.error ?? data?.catatan ?? "Pemasangan kandidat gagal. Minta generate ulang.",
        });
        return;
      }
      const ok = await tanamSumber(data.sumber, {
        paragrafIdx: opsiPasang.paragrafIdx,
        kalimatIdx: typeof data.kalimatIdx === "number" ? data.kalimatIdx : opsiPasang.kalimatIdx,
        posisi: opsiPasang.posisi,
      });
      if (ok) {
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

  /**
   * Muat contoh draf Bab I penuh (data demo): mengisi seluruh sub-bab
   * Bab I + kajian terdahulu + metodologi dari lib/demo/draf-bab1.ts
   * (±4.500 kata Arab, footnote terpasang), dan menambahkan rujukan
   * contohnya ke daftar rujukan proyek. Bagian yang sudah berisi
   * tulisan mahasiswa tidak ditimpa tanpa konfirmasi.
   */
  function muatContohBab1() {
    const idTarget = Object.keys(DRAF_DEMO_BAB1).filter((id) =>
      semua.some((s) => s.id === id),
    );
    const sudahTerisi = idTarget.filter((id) => (p.draf[id] ?? "").trim().length > 80);
    if (
      sudahTerisi.length > 0 &&
      !window.confirm(
        `${sudahTerisi.length} bagian contoh akan menimpa draf yang sudah terisi di proyek ini. Lanjutkan memuat contoh draf Bab I?`,
      )
    ) {
      return;
    }
    const drafBaru = { ...p.draf };
    for (const id of idTarget) drafBaru[id] = DRAF_DEMO_BAB1[id];
    const sumberBaru = SUMBER_DEMO_BAB1.filter(
      (b) =>
        !p.sumber.some(
          (s) => s.id === b.id || normalisasiJudul(s.judul) === normalisasiJudul(b.judul),
        ),
    );
    ubah({ draf: drafBaru, sumber: [...p.sumber, ...sumberBaru] });
    if (idTarget.includes(bagian)) {
      setTeks(drafBaru[bagian] ?? "");
      sinkron.current = drafBaru[bagian] ?? "";
    }
    const total = idTarget.reduce((n, id) => n + kataDemo(DRAF_DEMO_BAB1[id]), 0);
    setPesanDemo(
      `Contoh draf Bab I dimuat: ${idTarget.length} bagian terisi ${total.toLocaleString("id-ID")} kata, ` +
        `${sumberBaru.length} rujukan contoh ditambahkan dan footnote terpasang di bagian Latar Belakang, Penelitian Terdahulu, dan Metode. ` +
        `Ini contoh bertopik Ta'lim al-Muta'allim — sunting dan ganti menjadi tulisan Anda sendiri.`,
    );
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuFootnote((v) => !v)}
                disabled={p.sumber.length === 0}
                title={
                  p.sumber.length === 0
                    ? "Belum ada rujukan tersimpan di proyek ini — tambahkan dulu lewat tab Rujukan atau tombol Muat contoh draf Bab I"
                    : "Sisipkan footnote dari rujukan tersimpan ke posisi yang Anda pilih di draf"
                }
                className="btn-quiet disabled:opacity-40"
              >
                <IconPen className="h-3.5 w-3.5" /> + Footnote dari Rujukan
              </button>
              {menuFootnote && p.sumber.length > 0 && (
                <div className="absolute right-0 z-30 mt-1 max-h-72 w-80 overflow-y-auto rounded-xl border border-ink-900/15 bg-white p-1.5 shadow-xl doc-scroll">
                  <p className="px-2 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">
                    Pilih rujukan — dialog pasang footnote terbuka
                  </p>
                  {p.sumber.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setMenuFootnote(false);
                        setPasangTarget({ sumber: s });
                      }}
                      className="block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-ink-900/5"
                    >
                      <span className="block truncate font-arabic text-[13px] text-ink-900" dir="rtl">
                        {s.judul}
                      </span>
                      <span className="block truncate text-[11px] text-ink-500">
                        {s.penulis} · {s.tahun}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={susunUlang} className="btn-quiet">
              <IconSparkle className="h-3.5 w-3.5" /> Variasi
            </button>
            <button
              type="button"
              onClick={() => setSerahTerbuka((v) => !v)}
              disabled={!seleksi && !teks.trim()}
              title={
                seleksi
                  ? "Susun prompt pengembangan untuk teks yang Anda blok, siap disalin ke AI luar"
                  : "Susun prompt pengembangan untuk draf bagian ini, siap disalin ke AI luar"
              }
              className={`btn-quiet disabled:opacity-40 ${serahTerbuka ? "!bg-ink-900 !text-parchment-100" : ""}`}
            >
              <IconSparkle className="h-3.5 w-3.5" /> Kembangkan di AI luar
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

        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-gold-600/30 bg-gold-500/5 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-700">
            <span className="font-semibold text-ink-900">Butuh contoh naskah utuh?</span>{" "}
            Muat contoh draf Bab I lengkap (±4.500 kata: latar belakang ±2 halaman, rumusan,
            tujuan, manfaat, batasan, definisi istilah, kajian terdahulu, dan metodologi)
            dengan footnote yang sudah terpasang, lalu sunting menjadi tulisan Anda sendiri.
          </p>
          <button
            type="button"
            onClick={muatContohBab1}
            className="btn-quiet shrink-0 !border-gold-600/40 font-semibold"
          >
            <IconSparkle className="h-3.5 w-3.5" /> Muat contoh draf Bab I
          </button>
        </div>
        {pesanDemo && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] leading-relaxed text-emerald-900">
            {pesanDemo}
          </p>
        )}

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
              <Manuscript md={kompilasiBagian(p, bagian, teks).markdown} angkaArab={p.pedoman?.angkaArab ?? true} />
            </div>
          ) : (
            <EditorPenanda
              nilai={teks}
              segmen={segmenDraf}
              nomorSegmen={nomorSegmen}
              angkaArab={p.pedoman?.angkaArab ?? true}
              placeholder="اكتب هنا، أو اضغط «Susun draf» لتوليد هيكل أولي…"
              onUbah={(t) => setTeks(t)}
              onSeleksi={catatSeleksi}
              onFokus={setFokusPenanda}
            />
          )}
        </div>

        {!pratinjau && fokusPenanda && (
          <div className="mt-2 flex flex-wrap items-start justify-between gap-2 rounded-lg border border-ink-900/15 bg-white px-3 py-2 text-[12px] leading-relaxed">
            {fokusPenanda.jenis === "fragmen" ? (
              <p className="min-w-0 text-amber-900">
                <strong>Fragmen penanda rusak.</strong> Potongan ini sisa penanda sitasi yang patah; ia tidak
                membentuk footnote. Perbaiki teksnya, atau hapus chip-nya, atau bersihkan semua fragmen lewat
                peringatan fragmen di bawah editor.
              </p>
            ) : fokusPenanda.nomor !== null ? (
              <p className="min-w-0 text-ink-800">
                <strong>Footnote {fokusPenanda.nomor}.</strong>{" "}
                <span className="font-naskh text-[13px]" dir="rtl">
                  {p.sumber.find((s) => s.id === fokusPenanda.id)?.judul ?? fokusPenanda.id}
                </span>
                {fokusPenanda.halaman && <span className="text-ink-500"> · hlm. {fokusPenanda.halaman}</span>}
                {fokusPenanda.jilid && <span className="text-ink-500"> · jilid {fokusPenanda.jilid}</span>}
                <span className="block text-[11px] text-ink-500">
                  Teks footnote lengkapnya ada di strip Footnote bagian ini di bawah editor.
                </span>
              </p>
            ) : (
              <p className="min-w-0 text-red-800">
                <strong>Rujukan tidak ditemukan.</strong> Penanda ini menunjuk{" "}
                <code className="rounded bg-red-50 px-1 font-mono text-[11px]">{fokusPenanda.id}</code> yang sudah
                tidak ada di daftar referensi proyek, jadi footnote-nya tidak terbentuk dan hasil ekspor
                menandainya sebagai rujukan tidak ditemukan. Tambahkan lagi sumbernya di tab Rujukan, atau hapus
                chip penanda ini.
              </p>
            )}
            <button type="button" onClick={() => setFokusPenanda(null)} className="btn-quiet shrink-0 !py-0.5 !text-[11px]">
              Tutup
            </button>
          </div>
        )}

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
            {panelKandidat.kandidat.length === 0 && panelKandidat.ditolak.length === 0 && (
              <p className="mt-2 text-[12px] leading-relaxed text-ink-700">
                Tidak ada kandidat yang lolos periksa untuk teks ini. Coba blok kalimat lain, atau pakai Cari
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
                      void pasangLewatSidik({
                        sidik: k.sidik,
                        kandidat: k.sumber,
                        paragraf: ambilParagraf(teks, panelKandidat.paragrafIdx) ?? "",
                        paragrafIdx: panelKandidat.paragrafIdx,
                        kalimatIdx: panelKandidat.kalimatIdx,
                        posisi: panelKandidat.posisi,
                      })
                    }
                    className="btn-primary mt-2 !py-1.5 !text-[12px] disabled:opacity-40"
                  >
                    Pasang yang ini
                  </button>
                </div>
              ))}
            </div>
            {panelKandidat.ditolak.length > 0 && (
              <div className="mt-3">
                <p className="text-[12px] font-semibold text-red-800">
                  Tidak lolos periksa (tidak bisa dipasang):
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-600">
                  Kandidat di bawah gagal periksa metadata, tidak sesuai bidang proyek, atau belum
                  terverifikasi. Sesuai aturan pencarian valid, kandidat seperti ini tidak mempunyai jalan
                  untuk dipasang; jalankan Generate lagi atau pakai Cari Rujukan untuk kandidat lain.
                </p>
                <div className="mt-1.5 space-y-2.5">
                  {panelKandidat.ditolak.map((t, i) => (
                    <div key={`tolak-${i}`} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5">
                      <p className="font-naskh text-[13.5px] font-semibold leading-relaxed text-ink-900" dir="rtl">
                        {t.sumber.judul}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10.5px] font-semibold text-red-800">
                          {labelStatusDitolak(t.status)}
                        </span>
                        {t.halamanKosong && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                            Tanpa nomor halaman
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-red-800">
                        {t.bidangSumber ? `Bidang sumber: ${t.bidangSumber}. ` : ""}
                        {t.alasan}
                      </p>
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(adaPenandaTakDikenal || adaFragmenRusak) && (
          <div className="mt-2 space-y-2">
            {adaPenandaTakDikenal && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] leading-relaxed text-red-800">
                Ada penanda sitasi yang rujukannya sudah tidak ada di daftar referensi. Di dalam teks ia tampil
                sebagai chip peringatan merah; klik chip-nya untuk rincian. Hasil ekspor akan menandainya sebagai
                rujukan tidak ditemukan, bukan kode mentah.
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

        {serahTerbuka &&
          (() => {
            // Tahap 8: teks yang diserahkan adalah pilihan mahasiswa —
            // teks yang diblok bila ada seleksi, selain itu draf bagian
            // aktif ini; tidak pernah seluruh naskah diam-diam.
            const konteksSerah: KonteksKembangkan = {
              judul: p.judulAr,
              namaBagian: aktif ? aktif.headingAr || aktif.labelId : bagian,
              teks: seleksi ? seleksi.teks : teks,
              namaPedoman: p.strukturPedoman?.namaPedoman,
              targetKata: aktif?.targetKata,
              bahasa: p.bahasa,
            };
            return (
              <SerahAiPanel
                konteks={konteksSerah}
                labelTeks={
                  seleksi
                    ? "teks yang Anda blok di editor"
                    : `seluruh draf bagian aktif ini (${aktif?.labelId ?? bagian})`
                }
                onTutup={() => setSerahTerbuka(false)}
              />
            );
          })()}

        {cariRujukan && (
          <RefFinder
            p={p}
            tutup={() => setCariRujukan(false)}
            onPasang={(sumber, kutipan) => {
              setCariRujukan(false);
              setPasangTarget({ sumber, kutipan });
            }}
            onSisip={(blok, sumberBaru) => {
              const gabung = `${teks.trim()}\n\n${blok}`;
              setTeks(gabung);
              sinkron.current = gabung;
              // Sumber sisipan yang identitasnya sudah ada di proyek
              // (id stabil / DOI / judul ternormalisasi) tidak digandakan
              // (Tahap 6, duplikat lintas jalur L1 Tahap 4).
              const segar = sumberBaru.filter(
                (b) =>
                  !p.sumber.some(
                    (s) =>
                      s.id === b.id ||
                      (b.doi && s.doi && normalisasiDoi(s.doi) === normalisasiDoi(b.doi)) ||
                      normalisasiJudul(s.judul) === normalisasiJudul(b.judul),
                  ),
              );
              ubah({ draf: { ...p.draf, [bagian]: gabung }, sumber: [...p.sumber, ...segar] });
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
