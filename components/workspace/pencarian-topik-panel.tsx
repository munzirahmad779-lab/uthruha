"use client";

import { useEffect, useMemo, useState } from "react";
import type { KalimatKunci, Project, SetKunci } from "@/lib/engine/project";
import { sumberBaru, type Sumber } from "@/lib/engine/cite";
import { cariDuplikat } from "@/lib/engine/referensi";
import { strukturProyek } from "@/lib/content/struktur";
import {
  cariJurnalTopik,
  cariKitabKalimat,
  cariLokalBM25,
  ekstrakKataKunci,
  ketatkanKunciJurnal,
  parseTempelanSitasi,
  type HasilLokal,
  type HitKitabMentah,
  type KataKunci,
} from "@/lib/engine/pencarian-topik";
import { CopyButton, Field, Note } from "@/components/ui";
import {
  penjelasanTidakDitemukan,
  type AlasanTidakDitemukan,
} from "@/lib/engine/skema-pencarian";
import { TAUTAN_BOT_TELEGRAM } from "@/lib/engine/lugawi";
import { PetunjukCtrlF, TombolSalinCtrlF } from "@/components/workspace/ctrl-f";
import { PasangFootnote } from "@/components/workspace/pasang-footnote";
import { LugawiPanel } from "@/components/workspace/lugawi-panel";

type Mode = "jurnal" | "kitab" | "lokal" | "lugawi";
type HitKitab = HitKitabMentah;

/** Pilihan makna pada status perlu_disambiguasi skema pencarian
 *  (Tahap G2): memilih satu makna menjalankan ulang penyusunan
 *  kalimat kunci dengan pendamping konteks makna itu dipaksakan. */
interface MaknaPilihan {
  makna: string;
  bidang: string;
  konteks: string[];
}
interface AmbiguitasPilihan {
  istilah_ambigu: string;
  kemungkinan_makna: MaknaPilihan[];
}

/** Status verifikasi satu kartu hasil pencarian jurnal (Aturan
 *  Pencarian Valid): hanya "terverifikasi" yang boleh dipindah ke
 *  draf; status lain menahan semua tombol pada kartu itu. */
type StatusKartuJurnal =
  | "memeriksa"
  | "terverifikasi"
  | "gagal-metadata"
  | "gagal-bidang"
  | "belum-terverifikasi";

interface PutusanKartuJurnal {
  status: StatusKartuJurnal;
  alasan: string;
}

const LENCANA_JURNAL: Record<StatusKartuJurnal, { label: string; kelas: string }> = {
  terverifikasi: { label: "Terverifikasi", kelas: "bg-emerald-100 text-emerald-800" },
  "gagal-metadata": { label: "Gagal periksa metadata", kelas: "bg-red-100 text-red-800" },
  "gagal-bidang": { label: "Tidak sesuai bidang", kelas: "bg-red-100 text-red-800" },
  "belum-terverifikasi": { label: "Belum terverifikasi", kelas: "bg-amber-100 text-amber-800" },
  memeriksa: { label: "Memeriksa", kelas: "bg-ink-900/10 text-ink-600" },
};

/** Peringkat tampil kartu jurnal sesudah putusan tiba: yang sahih di
 *  atas, yang gagal paling bawah (penegasan pemilik: ditandai dan
 *  diturunkan, bukan dicampur setara). */
function peringkatKartuJurnal(status: StatusKartuJurnal): number {
  if (status === "terverifikasi") return 0;
  if (status === "memeriksa") return 1;
  if (status === "belum-terverifikasi") return 2;
  return 3;
}

const PERAN_LABEL: Record<KalimatKunci["peran"], string> = {
  taswir: "Gambaran masalah",
  aqwal: "Pendapat & dalil",
  tarjih: "Analisis & jawaban",
};
const URUT_PERAN: KalimatKunci["peran"][] = ["taswir", "aqwal", "tarjih"];

const SET_KOSONG: SetKunci = { kata: [], kataDipakai: [], kalimat: [] };

function hitKeSumber(h: HitKitab): Sumber {
  return {
    ...sumberBaru("kitab"),
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    penulis: h.penulis ?? "",
    judul: h.kitab,
    jilid: h.jilid ? String(h.jilid) : undefined,
    halaman: h.halaman_cetak ? String(h.halaman_cetak) : undefined,
    url: h.url_sumber,
    sumberImpor: h.source,
    perluVerifikasi: true,
  };
}

function catatanHit(h: HitKitab): string {
  if (h.source === "archive") return "Dari scan Archive.org: metadata tidak terstandar — cocokkan dengan Ctrl+F dan verifikasi edisinya sebelum memakai.";
  if (h.perluVerifikasi) return "Indeks menemukan frasa ini, tetapi nomor halamannya bisa bergeser — cocokkan teksnya dengan Ctrl+F.";
  return "Frasa ditemukan di indeks kitab — tetap cocokkan nomor halamannya dengan Ctrl+F sebelum mengutip.";
}

export function PencarianTopikPanel({ p, ubah }: { p: Project; ubah: (patch: Partial<Project>) => void }) {
  const [mode, setMode] = useState<Mode>("jurnal");
  const [teks, setTeks] = useState(p.topikAr || p.judulAr || "");
  const [judul, setJudul] = useState(p.judulAr || p.topikAr || "");
  const [kk, setKk] = useState<KataKunci | null>(null);
  const [hasilJurnal, setHasilJurnal] = useState<Sumber[]>([]);
  const [putusanJurnal, setPutusanJurnal] = useState<Record<string, PutusanKartuJurnal>>({});
  const [labelHasil, setLabelHasil] = useState("");
  const [statusJurnal, setStatusJurnal] = useState<{ sumber: string; ok: boolean; pesan?: string }[]>([]);
  const [hasilKitab, setHasilKitab] = useState<HitKitab[]>([]);
  const [hasilLokal, setHasilLokal] = useState<HasilLokal[]>([]);
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState("");
  const [tempel, setTempel] = useState("");
  const [online, setOnline] = useState(true);
  const [kataArti, setKataArti] = useState<Record<string, string>>({});
  const [kataBaru, setKataBaru] = useState("");
  const [pasangTarget, setPasangTarget] = useState<{ sumber: Sumber; kutipan?: string } | null>(null);
  // Disambiguasi skema pencarian (G2): pilihan makna yang sedang
  // menunggu keputusan mahasiswa + konteks wajib makna terpilih
  // (dipaksakan ke kunci pencarian jurnal selama sesi panel ini).
  const [pilihanMakna, setPilihanMakna] = useState<AmbiguitasPilihan | null>(null);
  const [konteksWajib, setKonteksWajib] = useState<string[]>([]);

  const babPilihan = useMemo(() => {
    const st = strukturProyek(p);
    const petaIsykal = new Map((p.daftarIsi ?? []).map((b) => [b.id, b.isykalKe]));
    return [
      ...st.chapters.map((c) => ({ id: c.id, label: c.labelId, isykalKe: petaIsykal.get(c.id) })),
      { id: "umum", label: "Umum (tidak per bab)", isykalKe: undefined },
    ];
  }, [p]);
  const [babKey, setBabKey] = useState<string>(() => {
    const babIsykal = (p.daftarIsi ?? []).find((b) => b.isykalKe != null);
    if (babIsykal) return babIsykal.id;
    const st = strukturProyek(p);
    return st.chapters[0]?.id ?? "umum";
  });
  const setKunci: SetKunci = p.kunciPencarian?.[babKey] ?? SET_KOSONG;
  const babAktif = babPilihan.find((b) => b.id === babKey);
  const bagianAwalId = useMemo(() => {
    const st = strukturProyek(p);
    const bab = st.chapters.find((c) => c.id === babKey);
    return bab?.sections[0]?.id;
  }, [p, babKey]);

  function simpanSet(setBaru: SetKunci) {
    ubah({ kunciPencarian: { ...(p.kunciPencarian ?? {}), [babKey]: setBaru } });
  }

  useEffect(() => {
    const perbarui = () => setOnline(navigator.onLine);
    perbarui();
    window.addEventListener("online", perbarui);
    window.addEventListener("offline", perbarui);
    return () => {
      window.removeEventListener("online", perbarui);
      window.removeEventListener("offline", perbarui);
    };
  }, []);

  /**
   * Periksa satu set hasil jurnal ke server verifikasi (Aturan
   * Pencarian Valid 2+3): status awal tiap kartu "memeriksa", lalu
   * putusan per kartu disimpan pada peta id. Bila panggilan itu sendiri
   * gagal, SEMUA kartu menjadi "belum-terverifikasi" (tertahan), bukan
   * lolos karena pemeriksanya tidak jalan.
   */
  async function periksaHasilJurnal(entri: Sumber[]) {
    if (entri.length === 0) {
      setPutusanJurnal({});
      return;
    }
    setPutusanJurnal(
      Object.fromEntries(
        entri.map((s) => [
          s.id,
          { status: "memeriksa" as const, alasan: "Sedang diperiksa ke Crossref dan gerbang bidang." },
        ]),
      ),
    );
    try {
      const res = await fetch("/api/refs/verifikasi-jurnal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kandidat: entri.map((s) => ({
            id: s.id,
            doi: s.doi,
            judul: s.judul,
            jurnal: s.jurnal,
            tahun: s.tahun,
            sumberImpor: s.sumberImpor,
          })),
          bidangId: p.bidangId,
          judulProyek: p.judulAr ?? "",
          topikAr: p.judulAr || p.topikAr,
        }),
      });
      const data = (await res.json()) as {
        hasil?: Array<{ id: string; status: StatusKartuJurnal; alasan: string }>;
        error?: string;
      };
      if (!res.ok || !Array.isArray(data.hasil)) throw new Error(data.error ?? "gagal");
      const peta: Record<string, PutusanKartuJurnal> = {};
      for (const h of data.hasil) peta[h.id] = { status: h.status, alasan: h.alasan };
      for (const s of entri) {
        if (!peta[s.id]) {
          peta[s.id] = {
            status: "belum-terverifikasi",
            alasan: "Kartu ini tidak mendapat putusan dari server verifikasi.",
          };
        }
      }
      setPutusanJurnal(peta);
    } catch {
      setPutusanJurnal(
        Object.fromEntries(
          entri.map((s) => [
            s.id,
            {
              status: "belum-terverifikasi" as const,
              alasan: "Pemeriksaan tidak dapat berjalan; coba cari lagi.",
            },
          ]),
        ),
      );
    }
  }

  function tambah(s: Sumber) {
    // Penjaga verifikasi jurnal (Aturan Pencarian Valid): kartu hasil
    // pencarian jurnal hanya boleh masuk draf bila putusannya
    // "terverifikasi". Penjaga ini khusus kartu jurnal panel ini; jalur
    // kitab dan tempelan tidak melewati peta putusan jurnal.
    if (hasilJurnal.some((h) => h.id === s.id)) {
      const put = putusanJurnal[s.id];
      if (!put || put.status !== "terverifikasi") {
        setPesan(
          put
            ? `Belum bisa ditambahkan: ${put.alasan}`
            : "Belum bisa ditambahkan: kartu ini belum selesai diperiksa.",
        );
        return;
      }
    }
    if (cariDuplikat(s, p.sumber)) {
      setPesan(`"${s.judul}" tampaknya sudah ada di referensi Anda — dilewati.`);
      return;
    }
    ubah({ sumber: [...p.sumber, s] });
    setPesan(`Ditambahkan sebagai draf: ${s.judul}${s.perluVerifikasi ? " (bertanda perlu verifikasi)" : ""}`);
  }

  function simpanTemuan(s: Sumber, kutipan: string) {
    ubah({
      temuan: [
        ...(p.temuan ?? []),
        {
          id: `temuan-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
          babId: babKey,
          sumber: s,
          kutipan,
          dibuat: new Date().toISOString(),
        },
      ],
    });
    setPesan(`Tersimpan di kotak temuan ${babAktif?.label ?? ""}: ${s.judul}`);
  }

  /* ── Tahap 1: generate kata kunci ─────────────────────────────────────── */
  async function generateKata() {
    setSibuk("kata");
    setPesan("");
    try {
      const rumusanBab =
        babAktif?.isykalKe != null ? (p.rumusan[babAktif.isykalKe - 1] ?? "") : "";
      const bahan = [judul.trim(), rumusanBab, teks.trim()].filter(Boolean).join("\n");
      const res = await fetch("/api/kata-kunci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tahap: "kata", teks: bahan }),
      });
      const data = await res.json();
      // Galat berkode dari server (mis. kunci pribadi ditolak
      // penyedia, Paket C) tampil apa adanya, bukan tertelan pesan
      // umum "gagal, coba lagi" di penangkap bawah.
      if (!res.ok && typeof data?.error === "string" && data.error) {
        setPesan(data.error);
        return;
      }
      const kata: Array<{ ar: string; id: string }> = Array.isArray(data.kata) ? data.kata : [];
      if (kata.length === 0) throw new Error("kosong");
      const ars = [...new Set(kata.map((k) => k.ar))];
      setKataArti((lama) => ({ ...lama, ...Object.fromEntries(kata.map((k) => [k.ar, k.id])) }));
      simpanSet({ kata: ars, kataDipakai: ars, kalimat: setKunci.kalimat });
      setPesan(
        data.sumber === "tanpa-ai"
          ? "Kata kunci disaring dari teks Anda sendiri (AI tidak tersedia) — periksa dan edit dulu."
          : `${ars.length} kata kunci tersusun. Pilih yang dipakai, hapus yang tidak cocok, tambah yang kurang.`,
      );
    } catch {
      setPesan("Generate kata kunci gagal — periksa koneksi lalu coba lagi, atau tulis kata kunci manual lewat kolom tambah.");
    } finally {
      setSibuk("");
    }
  }

  /* ── Tahap 2: susun tepat 3 kalimat kunci ───────────────────────────────
   * Sejak Tahap G2 route menjawab dengan status skema pencarian:
   * "perlu_disambiguasi" menampilkan pilihan makna (memilih satu
   * menjalankan ulang susun dengan konteks makna itu dipaksakan),
   * dan "tidak_ditemukan" menampilkan alasan jujurnya — tidak ada
   * kalimat cadangan karangan. */
  async function susunKalimat(maknaDipilih?: MaknaPilihan) {
    const kataDipakai = setKunci.kataDipakai.length > 0 ? setKunci.kataDipakai : setKunci.kata;
    // Prasyarat dijelaskan, bukan tombol mati tanpa suara (audit Joseph
    // 30 Okt 2026: tombol yang nonaktif diam-diam terbaca sebagai macet).
    if (kataDipakai.length === 0 && judul.trim().length < 8 && teks.trim().length < 8) {
      setPesan(
        "Belum bisa menyusun kalimat kunci: susun dulu kata kuncinya lewat tombol Generate kata kunci di Langkah 1 atau kolom tambah kata, atau isi judul/teks topik yang lebih lengkap, lalu klik Susun lagi.",
      );
      return;
    }
    setSibuk("kalimat");
    setPesan("");
    try {
      const res = await fetch("/api/kata-kunci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tahap: "kalimat",
          teks: judul.trim() || teks.trim(),
          judul: judul.trim(),
          kata: kataDipakai,
          ...(maknaDipilih ? { makna: maknaDipilih } : {}),
        }),
      });
      const data = await res.json();
      // Sama seperti generateKata: galat berkode server tampil apa
      // adanya (Paket C), tidak jatuh ke pesan umum penangkap.
      if (!res.ok && typeof data?.error === "string" && data.error) {
        setPesan(data.error);
        return;
      }
      if (data.status === "perlu_disambiguasi" && data.ambiguitas) {
        setPilihanMakna(data.ambiguitas as AmbiguitasPilihan);
        setPesan(
          `Istilah "${(data.ambiguitas as AmbiguitasPilihan).istilah_ambigu}" punya beberapa makna yang bidangnya berbeda. Pilih maksud Anda di bawah Langkah 2, lalu kalimat kunci disusun ulang dengan konteks makna itu.`,
        );
        return;
      }
      if (data.status === "tidak_ditemukan") {
        setPilihanMakna(null);
        const alasan = (data.alasan_tidak_ditemukan ?? "tidak_cukup_informasi") as AlasanTidakDitemukan;
        setPesan(
          [penjelasanTidakDitemukan(alasan), typeof data.catatan === "string" ? data.catatan : ""]
            .filter(Boolean)
            .join(" "),
        );
        return;
      }
      const hasil: Array<{ teks: string; arti: string; alasan: string; peran: string }> = Array.isArray(data.kalimat) ? data.kalimat : [];
      if (hasil.length === 0) throw new Error("kosong");
      setPilihanMakna(null);
      setKonteksWajib(Array.isArray(data.konteksWajib) ? (data.konteksWajib as string[]) : []);
      const kalimat: KalimatKunci[] = URUT_PERAN.map((peran, i) => {
        const terkunci = setKunci.kalimat.find((k) => k.peran === peran && k.dikunci);
        if (terkunci) return terkunci;
        const dari = hasil.find((h) => h.peran === peran) ?? hasil[i];
        return {
          teks: dari?.teks ?? "",
          arti: dari?.arti ?? "",
          alasan: dari?.alasan ?? "",
          peran,
          ...(setKunci.kalimat.find((k) => k.peran === peran)?.dikunci ? { dikunci: true } : {}),
        };
      });
      simpanSet({ ...setKunci, kalimat });
      setPesan(
        maknaDipilih
          ? "3 kalimat kunci tersusun untuk makna yang Anda pilih; konteks maknanya ikut dipaksakan pada pencarian jurnal. Baca, edit bila perlu, kunci yang sudah pas."
          : "3 kalimat kunci tersusun dengan alasannya. Baca, edit bila perlu, kunci yang sudah pas.",
      );
    } catch {
      setPesan("Menyusun kalimat kunci gagal — periksa koneksi lalu coba lagi, atau tulis manual.");
    } finally {
      setSibuk("");
    }
  }

  function ubahKalimat(i: number, patch: Partial<KalimatKunci>) {
    simpanSet({
      ...setKunci,
      kalimat: setKunci.kalimat.map((k, j) => (j === i ? { ...k, ...patch } : k)),
    });
  }

  const kataBelumTerwakili = useMemo(() => {
    const dipakai = setKunci.kataDipakai.length > 0 ? setKunci.kataDipakai : setKunci.kata;
    if (setKunci.kalimat.length === 0) return [];
    const gabungan = setKunci.kalimat.map((k) => k.teks.replace(/\s+/g, " ")).join(" ");
    return dipakai.filter((k) => !gabungan.includes(k));
  }, [setKunci]);

  /* ── Pencarian memakai set kurasi ─────────────────────────────────────── */
  async function jalankanJurnal() {
    setSibuk("jurnal");
    setPesan("");
    try {
      let kunci: KataKunci;
      let pesanAwal = "";
      if (setKunci.kalimat.length > 0) {
        kunci = {
          // Konteks wajib dari makna terpilih (disambiguasi G2)
          // dipaksakan ikut sebagai kunci Arab pendamping.
          arab: [...setKunci.kalimat.map((k) => k.teks), ...konteksWajib],
          indonesia: setKunci.kalimat.map((k) => k.arti).filter(Boolean),
          inggris: [],
          sumber: "kurasi Anda",
        };
      } else {
        kunci = await ekstrakKataKunci(teks);
        pesanAwal =
          "Belum ada kalimat kunci kurasi: pencarian memakai ekstrak otomatis dari teks. Lebih baik susun kalimat kunci dulu di atas.";
      }
      // Aturan 1: kunci diketatkan ke frasa topik penuh sebelum dicari;
      // catatan koreksinya digabung ke pesan, tidak ditelan.
      const ketat = ketatkanKunciJurnal(kunci, judul);
      kunci = ketat.kk;
      if (ketat.catatan.length > 0) {
        pesanAwal = [pesanAwal, ...ketat.catatan].filter(Boolean).join(" ");
      }
      setKk(kunci);
      setLabelHasil(setKunci.kalimat.length > 0 ? "gabungan semua kalimat kunci" : "ekstrak teks topik");
      const hasil = await cariJurnalTopik(kunci);
      setHasilJurnal(hasil.entri);
      setStatusJurnal(hasil.status);
      void periksaHasilJurnal(hasil.entri);
      if (hasil.entri.length === 0) {
        // Pesan menyebut sumber yang gagal DENGAN NAMANYA beserta
        // pesan kegagalannya (perbaikan P0.2, laporan perekaman
        // tutorial macro 10 Nov 2026) — bukan lagi "periksa koneksi"
        // generik yang menyalahkan jaringan pengguna.
        const gagal = hasil.status.filter((s) => !s.ok);
        const pesanKosong =
          gagal.length > 0
            ? gagal.length === hasil.status.length
              ? `Pencarian jurnal daring gagal: semua sumber tidak menjawab (${gagal
                  .map((g) => `${g.sumber}: ${g.pesan ?? "gagal"}`)
                  .join("; ")}). Coba lagi sebentar. Pencarian lokal tetap bisa dipakai.`
              : `Tidak ditemukan, dan sumber ini gagal menjawab: ${gagal.map((g) => g.sumber).join(", ")}. Coba lagi sebentar, atau ubah kalimat kunci kurasi Anda. Pencarian lokal tetap bisa dipakai.`
            : "Tidak ditemukan. Coba ubah kalimat kunci kurasi Anda.";
        setPesan([pesanKosong, pesanAwal].filter(Boolean).join(" "));
      } else if (pesanAwal) {
        setPesan(pesanAwal);
      }
    } catch (e) {
      setPesan(
        `Pencarian jurnal gagal dijalankan${e instanceof Error && e.message ? ` (${e.message})` : ""}. Tahap yang berhenti sebelum sumber daring (Crossref, OpenAlex, Semantic Scholar, DOAJ) sempat ditanya adalah penyusunan kata kunci. Coba lagi sebentar. Pencarian lokal tetap bisa dipakai.`,
      );
    } finally {
      setSibuk("");
    }
  }

  async function jalankanKitab() {
    setSibuk("kitab");
    setPesan("");
    try {
      const frasaArab =
        setKunci.kalimat.length > 0 ? setKunci.kalimat.map((k) => k.teks) : [];
      if (frasaArab.length === 0) {
        setPesan("Belum ada kalimat kunci kurasi — pencarian memakai teks topik apa adanya. Lebih baik susun kalimat kunci dulu di atas.");
      }
      const { hits, frasaDipakai } = await cariKitabKalimat(frasaArab, teks);
      setHasilKitab(hits);
      setLabelHasil(frasaArab.length > 0 ? "gabungan semua kalimat kunci" : "teks topik");
      if (hits.length === 0) {
        setPesan(
          `Tidak ada kecocokan frasa di kitab untuk kalimat kunci: ${frasaDipakai.join(" · ")}. Coba kalimat kunci lain, atau minta bot bantu cari di bawah.`,
        );
      }
    } catch {
      setPesan("Pencarian kitab gagal — server tidak menjawab. Coba lagi sebentar.");
    } finally {
      setSibuk("");
    }
  }

  function gulirKeHasil() {
    setTimeout(() => document.getElementById("hasil-topik")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  /** Cari jurnal LANGSUNG dari satu kalimat kunci — tanpa menyalin ulang. */
  async function jalankanJurnalSatu(k: KalimatKunci, i: number) {
    setMode("jurnal");
    setSibuk("jurnal");
    setPesan("");
    try {
      // Aturan 1 berlaku juga untuk pencarian dari satu kalimat: kalimat
      // yang menyempit menjadi kata telanjang diganti frasa judul.
      const ketat = ketatkanKunciJurnal(
        {
          arab: [k.teks],
          indonesia: k.arti ? [k.arti] : [],
          inggris: [],
          sumber: "kurasi Anda",
        },
        judul,
      );
      const kunci: KataKunci = ketat.kk;
      setKk(kunci);
      setLabelHasil(`kalimat ${i + 1} — ${PERAN_LABEL[k.peran]}`);
      const hasil = await cariJurnalTopik(kunci);
      setHasilJurnal(hasil.entri);
      setStatusJurnal(hasil.status);
      void periksaHasilJurnal(hasil.entri);
      if (hasil.entri.length === 0) {
        const gagal = hasil.status.filter((s) => !s.ok);
        setPesan(
          [
            "Tidak ditemukan untuk kalimat ini. Coba kalimat lain, atau perbaiki padanan Indonesianya.",
            ...(gagal.length > 0
              ? [
                  `Sumber ini gagal menjawab: ${gagal
                    .map((g) => `${g.sumber}: ${g.pesan ?? "gagal"}`)
                    .join("; ")}. Pencarian lokal tetap bisa dipakai.`,
                ]
              : []),
            ...ketat.catatan,
          ].join(" "),
        );
      } else if (ketat.catatan.length > 0) {
        setPesan(ketat.catatan.join(" "));
      }
      gulirKeHasil();
    } catch (e) {
      setPesan(
        `Pencarian jurnal untuk kalimat ini gagal dijalankan${e instanceof Error && e.message ? ` (${e.message})` : ""}. Sumber daring yang biasa ditanya: Crossref, OpenAlex, Semantic Scholar, DOAJ. Pencarian lokal tetap bisa dipakai.`,
      );
    } finally {
      setSibuk("");
    }
  }

  /** Cari kitab LANGSUNG dari satu kalimat kunci — tanpa menyalin ulang. */
  async function jalankanKitabSatu(k: KalimatKunci, i: number) {
    setMode("kitab");
    setSibuk("kitab");
    setPesan("");
    try {
      setLabelHasil(`kalimat ${i + 1} — ${PERAN_LABEL[k.peran]}`);
      const { hits } = await cariKitabKalimat([k.teks], "");
      setHasilKitab(hits);
      if (hits.length === 0) setPesan(`Tidak ada kecocokan frasa di kitab untuk kalimat ini: ${k.teks}`);
      gulirKeHasil();
    } catch {
      setPesan("Pencarian kitab gagal — server tidak menjawab. Coba lagi sebentar.");
    } finally {
      setSibuk("");
    }
  }

  function jalankanLokal() {
    setHasilLokal(cariLokalBM25(teks, p));
  }

  const teksUntukTautan = (setKunci.kalimat[0]?.teks || teks).slice(0, 180);
  const tautanTurath = `https://app.turath.io/search?q=${encodeURIComponent(teksUntukTautan)}`;
  const tautanShamela = `https://shamela.ws/search?query=${encodeURIComponent(teksUntukTautan)}`;
  const tautanGaruda = `https://garuda.kemdiktisaintek.go.id/?s=${encodeURIComponent(teksUntukTautan)}`;
  const teksMintaBot = [
    `Tolong carikan di kitab untuk penelitian saya.`,
    `Judul: ${judul || p.judulAr || "-"}`,
    setKunci.kalimat.length > 0
      ? `Kalimat kunci: ${setKunci.kalimat.map((k) => k.teks).join("؛ ")}`
      : `Topik: ${teks}`,
    `Balas dengan kutipan persisnya, nama kitab, jilid, dan halaman. Jika kamu tidak yakin ada, katakan terus terang tidak tahu — jangan mengarang. Saya akan memverifikasi dengan Ctrl+F sebelum disitasi.`,
  ].join("\n");

  const temuanBabIni = (p.temuan ?? []).filter((t) => t.babId === babKey);

  // Urutan tampil kartu jurnal: sesudah putusan verifikasi tiba, kartu
  // diurutkan ulang per peringkat status (stabil di dalam kelompoknya);
  // sebelum putusan tiba semua kartu berstatus "memeriksa".
  const hasilJurnalTerurut = [...hasilJurnal].sort(
    (a, b) =>
      peringkatKartuJurnal(putusanJurnal[a.id]?.status ?? "memeriksa") -
      peringkatKartuJurnal(putusanJurnal[b.id]?.status ?? "memeriksa"),
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-bold text-ink-900">Cari referensi dari topik</h3>
        <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-ink-600">
          Alurnya: <b>judul → kata kunci → 3 kalimat kunci kurasi Anda → pencarian</b>. Yang menjalankan
          pencarian adalah kalimat kunci yang sudah Anda periksa — bukan ekstrak otomatis. Hasil masuk
          sebagai draf berlabel sumber; tidak ada yang ditambahkan tanpa Anda menekan tombolnya.
          Panel ini mencari dari <b>topik untuk satu bab</b> (bahan bacaan dan rujukan bab). Bila Anda
          sudah menulis paragraf dan ingin rujukan untuk kalimat tertentu, pakai tombol{" "}
          <b>Cari Rujukan</b> di tab Tulis — panel itu bekerja per paragraf.
        </p>
      </div>

      {/* ── Kurasi kalimat kunci ─────────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl border border-gold-600/30 bg-gold-500/5 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] font-semibold text-ink-800">
            Bab tujuan{" "}
            <select className="input ms-1 !w-auto !py-1 text-[12px]" value={babKey} onChange={(e) => setBabKey(e.target.value)}>
              {babPilihan.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>
          <span className="text-[10.5px] text-ink-500">Set kalimat kunci tersimpan per bab di proyek ini.</span>
        </div>

        <Field label="Judul penelitian (wajib — jangkar kata & kalimat kunci)">
          <input
            className="input w-full font-naskh text-[13px]"
            dir="auto"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="cth: حكم شرب بول الفرس في الفقه الإسلامي"
          />
        </Field>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-ink-800">Langkah 1 · Kata kunci</span>
            <button type="button" className="btn-quiet !py-1 !text-[11.5px]" disabled={!online || sibuk !== "" || judul.trim().length < 8} onClick={generateKata}>
              {sibuk === "kata" ? "Menyusun…" : "Generate kata kunci"}
            </button>
          </div>
          {setKunci.kata.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {setKunci.kata.map((k) => {
                const dipakai = setKunci.kataDipakai.length === 0 || setKunci.kataDipakai.includes(k);
                return (
                  <span key={k} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11.5px] ${dipakai ? "border-gold-600 bg-white text-ink-900" : "border-ink-900/15 bg-white/50 text-ink-400 line-through"}`}>
                    <button
                      type="button"
                      onClick={() => {
                        const dasar = setKunci.kataDipakai.length > 0 ? setKunci.kataDipakai : [...setKunci.kata];
                        simpanSet({ ...setKunci, kataDipakai: dipakai ? dasar.filter((x) => x !== k) : [...dasar, k] });
                      }}
                      className="font-naskh"
                      dir="rtl"
                      title={dipakai ? "Klik untuk tidak memakai" : "Klik untuk memakai"}
                    >
                      {k}
                    </button>
                    {kataArti[k] && kataArti[k] !== k && <span className="text-[10px] text-ink-500">{kataArti[k]}</span>}
                    <button
                      type="button"
                      aria-label={`Hapus kata ${k}`}
                      onClick={() => simpanSet({ ...setKunci, kata: setKunci.kata.filter((x) => x !== k), kataDipakai: setKunci.kataDipakai.filter((x) => x !== k) })}
                      className="text-ink-400 hover:text-ink-800"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            <input
              className="input !w-52 !py-1 text-[12px]"
              dir="auto"
              value={kataBaru}
              onChange={(e) => setKataBaru(e.target.value)}
              placeholder="Tambah kata kunci sendiri…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && kataBaru.trim()) {
                  e.preventDefault();
                  const k = kataBaru.trim();
                  if (!setKunci.kata.includes(k)) simpanSet({ ...setKunci, kata: [...setKunci.kata, k], kataDipakai: [...(setKunci.kataDipakai.length > 0 ? setKunci.kataDipakai : setKunci.kata), k] });
                  setKataBaru("");
                }
              }}
            />
            <span className="self-center text-[10.5px] text-ink-500">Enter untuk menambah. Klik chip untuk memakai/melepas.</span>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-ink-800">Langkah 2 · Kalimat kunci (tepat 3, berperan)</span>
            <button type="button" className="btn-quiet !py-1 !text-[11.5px]" disabled={!online || sibuk !== ""} onClick={() => void susunKalimat()}>
              {sibuk === "kalimat" ? "Menyusun…" : "Susun 3 kalimat kunci"}
            </button>
            {setKunci.kalimat.length < 3 && (
              <button
                type="button"
                className="btn-quiet !py-1 !text-[11.5px]"
                onClick={() => {
                  const peranKurang = URUT_PERAN.find((r) => !setKunci.kalimat.some((k) => k.peran === r)) ?? "taswir";
                  simpanSet({ ...setKunci, kalimat: [...setKunci.kalimat, { teks: "", arti: "", alasan: "Ditulis manual oleh mahasiswa.", peran: peranKurang, dikunci: true }] });
                }}
              >
                + Tulis manual
              </button>
            )}
          </div>
          {setKunci.kata.length === 0 && judul.trim().length < 8 && teks.trim().length < 8 && (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
              Tombol Susun menyusun dari kata kunci Langkah 1 atau dari judul/teks topik. Bila
              keduanya masih kosong, klik tombolnya untuk melihat penjelasannya.
            </p>
          )}
          {pilihanMakna && (
            <div className="mt-2 rounded-xl border border-amber-300/60 bg-amber-50 p-2.5">
              <p className="text-[11.5px] leading-relaxed text-amber-900">
                Istilah <span className="font-naskh font-semibold" dir="rtl">{pilihanMakna.istilah_ambigu}</span>{" "}
                punya beberapa makna. Maksud Anda yang mana? Kalimat kunci akan disusun ulang
                dengan konteks makna pilihan Anda.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pilihanMakna.kemungkinan_makna.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn-quiet !py-1 !text-[11px]"
                    disabled={!online || sibuk !== ""}
                    onClick={() => {
                      setPilihanMakna(null);
                      void susunKalimat(m);
                    }}
                  >
                    {m.makna}
                  </button>
                ))}
              </div>
            </div>
          )}
          {setKunci.kalimat.length > 0 && (
            <div className="mt-2 space-y-2">
              {setKunci.kalimat.map((k, i) => (
                <div key={i} className="rounded-xl border border-ink-900/10 bg-white/80 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-ink-900/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-600">
                      {i + 1} · {PERAN_LABEL[k.peran]}
                    </span>
                    <div className="flex gap-1">
                      <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[10.5px]" onClick={() => ubahKalimat(i, { dikunci: !k.dikunci })}>
                        {k.dikunci ? "🔒 Dikunci" : "🔓 Kunci"}
                      </button>
                      <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[10.5px]" onClick={() => simpanSet({ ...setKunci, kalimat: setKunci.kalimat.filter((_, j) => j !== i) })}>
                        Hapus
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="input mt-1.5 min-h-10 w-full text-right font-naskh text-[13px]"
                    dir="rtl"
                    value={k.teks}
                    onChange={(e) => ubahKalimat(i, { teks: e.target.value })}
                    placeholder="Kalimat kunci Arab…"
                  />
                  <input
                    className="input mt-1.5 w-full !py-1 text-[11.5px]"
                    value={k.arti}
                    onChange={(e) => ubahKalimat(i, { arti: e.target.value })}
                    placeholder="Padanan Bahasa Indonesia (untuk pencarian jurnal)"
                  />
                  {k.alasan && <p className="mt-1 text-[10.5px] italic leading-relaxed text-ink-500">Kenapa begini: {k.alasan}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-ink-900/5 pt-2">
                    <button type="button" className="btn-quiet !py-1 !text-[11px]" disabled={!online || sibuk !== ""} onClick={() => jalankanJurnalSatu(k, i)}>
                      Cari jurnal dari kalimat ini
                    </button>
                    <button type="button" className="btn-quiet !py-1 !text-[11px]" disabled={!online || sibuk !== ""} onClick={() => jalankanKitabSatu(k, i)}>
                      Cari kitab dari kalimat ini
                    </button>
                    <span className="text-[10.5px] text-ink-500">Langsung memakai kalimat ini — tanpa menyalin ulang.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {kataBelumTerwakili.length > 0 && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">
              Kata terpilih yang belum terwakili di kalimat kunci:{" "}
              <span className="font-naskh" dir="rtl">{kataBelumTerwakili.join(" · ")}</span> — pertimbangkan
              memasukkannya atau melepasnya dari pilihan.
            </p>
          )}
        </div>
      </div>

      {/* ── Mode & jalankan pencarian ────────────────────────────────────── */}
      <div className="flex gap-1" role="tablist" aria-label="Mode pencarian">
        {(
          [
            { id: "jurnal", label: "Jurnal ilmiah" },
            { id: "kitab", label: "Kitab & scan" },
            { id: "lokal", label: "Di referensi saya" },
            { id: "lugawi", label: "Lugawi & Istilahi" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
              mode === t.id ? "bg-ink-900 text-parchment-100" : "text-ink-600 hover:bg-ink-900/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "lugawi" && <LugawiPanel online={online} bidangId={p.bidangId} judulProyek={p.judulAr} />}

      {mode !== "lugawi" && (
      <div className="flex flex-wrap items-start gap-2">
        <textarea
          className="input min-h-16 flex-1 text-[13px]"
          dir="auto"
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="Topik / paragraf yang sedang dibahas (bahan cadangan & pencarian lokal)"
        />
        {mode === "jurnal" && (
          <button type="button" className="btn-primary !py-2.5" disabled={!online || sibuk !== ""} onClick={jalankanJurnal}>
            {sibuk === "jurnal" ? "Mencari…" : "Cari jurnal"}
          </button>
        )}
        {mode === "kitab" && (
          <button type="button" className="btn-primary !py-2.5" disabled={!online || sibuk !== ""} onClick={jalankanKitab}>
            {sibuk === "kitab" ? "Mencari…" : "Cari di kitab"}
          </button>
        )}
        {mode === "lokal" && (
          <button type="button" className="btn-primary !py-2.5" disabled={teks.trim().length < 3} onClick={jalankanLokal}>
            Cari lokal
          </button>
        )}
      </div>

      )}

      {!online && mode !== "lokal" && mode !== "lugawi" && (
        <Note>Anda sedang offline. Mode ini butuh internet — pencarian &quot;Di referensi saya&quot; tetap bekerja penuh.</Note>
      )}
      {mode === "kitab" && (
        <Note>
          Pencarian kitab mencocokkan frasa di isi kitab (Turath/Shamela) dan metadata scan tidak
          terstandar. Anggap hasil sebagai petunjuk lokasi — periksa edisi &amp; halaman cetaknya
          dengan Ctrl+F sebelum memakai.
        </Note>
      )}

      {kk && (mode === "jurnal" || mode === "kitab") && (
        <div className="rounded-xl bg-parchment-100/70 px-3 py-2 text-[11.5px] text-ink-700">
          <span className="font-semibold">Kalimat kunci terpakai</span> (sumber: {kk.sumber}) — Arab:{" "}
          <span dir="rtl" className="font-naskh">{kk.arab.join(" · ")}</span>
          {statusJurnal.length > 0 && (
            <span className="block pt-0.5 text-ink-500">
              Status sumber: {statusJurnal.map((s) => `${s.sumber} ${s.ok ? "✓" : `✗ ${s.pesan ?? ""}`}`).join(" · ")}
            </span>
          )}
        </div>
      )}

      <div id="hasil-topik" />
      {pesan && <p className="text-[12px] text-ink-700">{pesan}</p>}

      {mode === "jurnal" && hasilJurnal.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11.5px] font-semibold text-ink-700">
            {hasilJurnal.length} jurnal{labelHasil ? ` — hasil untuk: ${labelHasil}` : ""} <span className="font-normal text-ink-500">(ditampung maks 15)</span>
          </p>
          {hasilJurnalTerurut.map((s) => {
            // Blokir keras Aturan Pencarian Valid: ketiga tombol
            // pindah-draf kartu jurnal ini hanya hidup bila putusannya
            // "terverifikasi"; selagi "memeriksa" tombol nonaktif.
            const put = putusanJurnal[s.id];
            const statusKartu: StatusKartuJurnal = put?.status ?? "memeriksa";
            const bolehPindah = statusKartu === "terverifikasi";
            const lencana = LENCANA_JURNAL[statusKartu];
            return (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-900/10 bg-white/70 p-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink-900">{s.judul}</p>
                <p className="mt-1">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${lencana.kelas}`}>
                    {lencana.label}
                  </span>
                </p>
                {put?.alasan ? (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{put.alasan}</p>
                ) : null}
                <p className="mt-0.5 text-[11.5px] text-ink-600">
                  {s.penulis} — {s.jurnal} ({s.tahun}){s.doi ? ` · DOI ${s.doi}` : ""}
                </p>
                <span className="mt-1 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-700">
                  dari {s.sumberImpor}
                </span>
                {!bolehPindah && statusKartu !== "memeriksa" ? (
                  <p className="mt-1 text-[10.5px] text-ink-500">Tidak bisa dipilih: {lencana.label.toLowerCase()}.</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" className="btn-quiet disabled:cursor-not-allowed disabled:opacity-40" disabled={!bolehPindah} onClick={() => tambah(s)}>{statusKartu === "memeriksa" ? "Memeriksa…" : "Tambah"}</button>
                <button type="button" className="btn-quiet disabled:cursor-not-allowed disabled:opacity-40" disabled={!bolehPindah} onClick={() => setPasangTarget({ sumber: s })}>Pasang footnote</button>
                <button type="button" className="btn-quiet disabled:cursor-not-allowed disabled:opacity-40" disabled={!bolehPindah} onClick={() => simpanTemuan(s, "")}>Simpan temuan</button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {mode === "kitab" && (
        <div className="space-y-3">
          {hasilKitab.length > 0 && (
            <p className="text-[11.5px] font-semibold text-ink-700">
              {hasilKitab.length} hasil kitab{labelHasil ? ` — hasil untuk: ${labelHasil}` : ""} <span className="font-normal text-ink-500">(ditampung maks 20)</span>
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <a className="btn-quiet" href={tautanTurath} target="_blank" rel="noreferrer">Pencarian mendalam di Turath.io ↗</a>
            <a className="btn-quiet" href={tautanShamela} target="_blank" rel="noreferrer">Buka di Shamela ↗</a>
            <a className="btn-quiet" href={tautanGaruda} target="_blank" rel="noreferrer">Buka di Garuda ↗</a>
            <CopyButton teks={teksMintaBot} label="Salin pesan untuk bot" />
            <a className="btn-quiet" href={TAUTAN_BOT_TELEGRAM} target="_blank" rel="noreferrer">Buka bot Telegram ↗</a>
          </div>
          {hasilKitab.map((h) => {
            const sHit = hitKeSumber(h);
            return (
              <div key={h.id} className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-right font-naskh text-[14px] font-semibold text-ink-900" dir="rtl">{h.kitab}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-600">
                      {h.penulis ?? ""}{h.jilid ? ` · jilid ${h.jilid}` : ""}{h.halaman_cetak ? ` · hlm. cetak ${h.halaman_cetak}` : ""} · sumber: {h.source}
                    </p>
                    <p className="mt-1 line-clamp-2 text-right font-naskh text-[12.5px] leading-relaxed text-ink-700" dir="rtl">
                      {h.teks_kutipan}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-ink-500">{catatanHit(h)}</p>
                    <PetunjukCtrlF />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <a className="btn-quiet text-center" href={h.url_sumber} target="_blank" rel="noreferrer">Buka ↗</a>
                    <TombolSalinCtrlF teks={h.teks_kutipan} />
                    <button type="button" className="btn-quiet" onClick={() => tambah(sHit)}>Tambah draf</button>
                    <button type="button" className="btn-quiet" onClick={() => setPasangTarget({ sumber: sHit, kutipan: h.teks_kutipan })}>Pasang footnote</button>
                    <button type="button" className="btn-quiet" onClick={() => simpanTemuan(sHit, h.teks_kutipan)}>Simpan temuan</button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="rounded-xl border border-dashed border-ink-900/15 bg-white/50 p-3">
            <Field label="Sudah menemukan sitasi di situs sumber? Tempel di sini">
              <textarea
                className="input min-h-14 w-full font-naskh text-[12.5px]"
                dir="auto"
                value={tempel}
                onChange={(e) => setTempel(e.target.value)}
                placeholder="cth: ابن حجر العسقلاني، فتح الباري، ج 6، ص 274"
              />
            </Field>
            <button
              type="button"
              className="btn-quiet mt-2"
              disabled={tempel.trim().length < 8}
              onClick={() => tambah(parseTempelanSitasi(tempel))}
            >
              Buat draf dari tempelan
            </button>
            <span className="ml-2 text-[10.5px] text-ink-500">Hasil tempel selalu bertanda perlu verifikasi.</span>
          </div>
        </div>
      )}

      {mode === "lokal" && hasilLokal.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-ink-500">Pencarian kata kunci (BM25) di data Anda sendiri — bukan pencarian semantik.</p>
          {hasilLokal.map((h, i) => (
            <div key={i} className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
              <p className="text-[12.5px] font-semibold text-ink-900">
                {h.sumber ? h.sumber.judul : `Bagian naskah: ${h.sectionId}`}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-600">{h.cuplikan}</p>
              <p className="mt-0.5 text-[10.5px] text-ink-400">skor kata kunci {h.skor}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Kotak temuan bab ini ─────────────────────────────────────────── */}
      {temuanBabIni.length > 0 && (
        <div className="rounded-2xl border border-ink-900/10 bg-white/70 p-3.5">
          <h4 className="text-[12.5px] font-bold text-ink-900">
            Kotak temuan — {babAktif?.label} ({temuanBabIni.length})
          </h4>
          <div className="mt-2 space-y-1.5">
            {temuanBabIni.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-parchment-100/60 px-2.5 py-1.5">
                <p className="min-w-0 truncate font-naskh text-[12px] text-ink-800" dir="rtl">{t.sumber.judul}</p>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[11px]" onClick={() => setPasangTarget({ sumber: t.sumber, kutipan: t.kutipan || undefined })}>
                    Pasang footnote
                  </button>
                  <button
                    type="button"
                    className="btn-quiet !px-2 !py-0.5 !text-[11px]"
                    onClick={() => ubah({ temuan: (p.temuan ?? []).filter((x) => x.id !== t.id) })}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pasangTarget && (
        <PasangFootnote
          p={p}
          ubah={ubah}
          sumber={pasangTarget.sumber}
          kutipan={pasangTarget.kutipan}
          babAwalId={bagianAwalId}
          onTutup={() => setPasangTarget(null)}
          onTerpasang={(m) => setPesan(m)}
        />
      )}
    </div>
  );
}
