"use client";

import { useMemo, useState } from "react";
import {
  JENIS_LABEL,
  bersihkanJudul,
  catatanKaki,
  entriIndonesia,
  kutipanDalamTeks,
  putusanPasangSumber,
  sumberBaru,
  type JenisSumber,
  type Sumber,
} from "@/lib/engine/cite";
import { gerbangKategoriKitab } from "@/lib/engine/kategori-kitab";
import type { Project } from "@/lib/engine/project";
import { cariDuplikat, parseImpor } from "@/lib/engine/referensi";
import { GAYA_LABEL, gayaSah, type GayaSitasi } from "@/lib/engine/citation";
import { daftarPustakaProyek, entriPustakaProyek } from "@/lib/engine/daftar-pustaka";
import { kompilasiDokumen } from "@/components/workspace/footnote-bagian";
import { IconPlus, IconTrash } from "@/components/icons";
import { CopyButton, Field, Note } from "@/components/ui";
import { PedomanPanel } from "@/components/workspace/pedoman-panel";
import { verifikasiDoi } from "@/lib/engine/validasi-ref";
import {
  ambilMetadataDoi,
  keteranganAsalKolom,
  type AsalKolomDoi,
  type KolomMetadataDoi,
} from "@/lib/engine/doi-metadata";
import { PencarianTopikPanel } from "@/components/workspace/pencarian-topik-panel";

const KOSONG: Sumber = sumberBaru("kitab");

/** Label asal satu kolom formulir sesudah pengambilan DOI
 *  (kejujuran metadata DOI): kolom yang terisi menyebut rekod
 *  pemasoknya; kolom yang kosong dinyatakan tidak ada di rekod,
 *  supaya nilai bawaan tampilan (mis. placeholder) tidak pernah
 *  terbaca sebagai data dari rekod. */
function CatatanAsalKolom({ asal, nilai }: { asal: AsalKolomDoi | undefined; nilai: string }) {
  return (
    <p className="mt-1 text-[10px] leading-relaxed text-ink-500">
      {keteranganAsalKolom(asal, Boolean(nilai.trim()))}
    </p>
  );
}

export function RefTab({ p, ubah }: { p: Project; ubah: (patch: Partial<Project>) => void }) {
  const [baru, setBaru] = useState<Sumber>(KOSONG);
  const [buka, setBuka] = useState<string | null>(null);
  const [sub, setSub] = useState<"sumber" | "cari" | "pedoman">("sumber");
  const [imporTeks, setImporTeks] = useState("");
  const [pesanImpor, setPesanImpor] = useState("");
  const [doiAmbil, setDoiAmbil] = useState("");
  const [sibukDoi, setSibukDoi] = useState(false);
  const [pesanDoi, setPesanDoi] = useState("");
  /** Asal per kolom dari pengambilan DOI terakhir; null berarti
   *  belum ada pengambilan pada formulir ini (label tidak tampil). */
  const [asalDoi, setAsalDoi] = useState<Partial<Record<KolomMetadataDoi, AsalKolomDoi>> | null>(null);
  const [pesanVerif, setPesanVerif] = useState("");
  /** Putusan verifikasi (bidang) untuk isian formulir ber-DOI,
   *  terikat kunci isian yang diperiksa: suntingan pada DOI, judul,
   *  jurnal, atau tahun membatalkan putusan lama. */
  const [putusanForm, setPutusanForm] = useState<{ kunci: string; status: string; alasan: string } | null>(null);
  const [memeriksaForm, setMemeriksaForm] = useState(false);
  const [isbnAmbil, setIsbnAmbil] = useState("");
  const [sibukIsbn, setSibukIsbn] = useState(false);
  const [pesanIsbn, setPesanIsbn] = useState("");

  /** Kunci isian yang mengikat putusan bidang formulir: putusan hanya
   *  berlaku untuk gabungan DOI, judul, jurnal, tahun yang persis ini. */
  function kunciIsian(doi: string, judul: string, jurnal: string, tahun: string): string {
    return [doi.trim(), judul.trim(), jurnal.trim(), tahun.trim()].join("|");
  }

  const kunciFormKini = kunciIsian(baru.doi ?? "", baru.judul, baru.jurnal ?? "", baru.tahun);
  const putusanFormAktif = putusanForm && putusanForm.kunci === kunciFormKini ? putusanForm : null;

  /**
   * Periksa bidang satu isian ber-DOI lewat endpoint verifikasi
   * bersama (POST /api/refs/verifikasi-jurnal). Kegagalan panggilan
   * dibaca sebagai "belum-terverifikasi" (gagal tertutup): formulir
   * ber-DOI tidak boleh tersimpan tanpa putusan.
   */
  async function periksaBidangForm(kandidat: {
    doi: string;
    judul: string;
    jurnal?: string;
    tahun?: string;
  }): Promise<{ status: string; alasan: string }> {
    try {
      const res = await fetch("/api/refs/verifikasi-jurnal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kandidat: [
            {
              id: "form-doi",
              doi: kandidat.doi,
              judul: kandidat.judul,
              jurnal: kandidat.jurnal,
              tahun: kandidat.tahun,
            },
          ],
          bidangId: p.bidangId,
          judulProyek: p.judulAr ?? "",
          topikAr: p.judulAr || p.topikAr,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        hasil?: { status: string; alasan: string }[];
      } | null;
      const h = data?.hasil?.[0];
      if (!res.ok || !h) {
        return {
          status: "belum-terverifikasi",
          alasan: "Server verifikasi tidak memberi putusan, jadi referensi ini belum bisa disimpan.",
        };
      }
      return { status: h.status, alasan: h.alasan };
    } catch {
      return {
        status: "belum-terverifikasi",
        alasan: "Pemeriksaan bidang tidak dapat berjalan (koneksi), jadi referensi ini belum bisa disimpan.",
      };
    }
  }

  /** Ambil metadata jurnal dari DOI via Crossref dan OpenAlex, mengisi formulir manual. */
  async function ambilDariDoi() {
    const doi = doiAmbil.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    if (doi.length < 6) return;
    setSibukDoi(true);
    setPesanDoi("");
    setAsalDoi(null);
    try {
      const hasil = await ambilMetadataDoi(doi);
      const d = hasil.data;
      setAsalDoi(hasil.asal);
      setBaru((b) => {
        const next = { ...b, jenis: "artikel" as const, doi: d.doi || doi };
        if (d.penulis) next.penulis = d.penulis;
        if (d.judul) next.judul = d.judul;
        if (d.jurnal) next.jurnal = d.jurnal;
        if (d.penerbit) next.penerbit = d.penerbit;
        if (d.tahun) next.tahun = d.tahun;
        if (d.volume) next.volume = d.volume;
        if (d.nomor) next.nomor = d.nomor;
        if (d.halaman) next.halaman = d.halaman;
        if (d.url) next.url = d.url;
        if (hasil.kurang.length > 0) next.perluVerifikasi = true;
        else next.perluVerifikasi = undefined;
        return next;
      });
      if (hasil.kurang.length > 0) {
        const tambahanCatatan = hasil.catatan.length > 0 ? ` ${hasil.catatan.join(" ")}` : "";
        setPesanDoi(
          `Metadata terisi sebagian. Yang belum ada dari sumber: ${hasil.kurang.join(", ")}. Isi dari catatan jurnal atau periksa manual.${tambahanCatatan}`,
        );
      } else {
        const tambahanCatatan = hasil.catatan.length > 0 ? ` ${hasil.catatan.join(" ")}` : "";
        setPesanDoi(`Metadata DOI ${doi} terisi lengkap ke formulir. Periksa, lalu tambahkan referensinya.${tambahanCatatan}`);
      }
      // Sesudah metadata terisi, bidangnya diperiksa lewat endpoint
      // verifikasi bersama: tombol simpan untuk isian dari DOI ini
      // hanya hidup bila putusannya "terverifikasi" (Aturan Pencarian
      // Valid, pintu ambil-dari-DOI).
      const isianBerikut = {
        doi: d.doi || doi,
        judul: d.judul || baru.judul,
        jurnal: d.jurnal || baru.jurnal || "",
        tahun: d.tahun || baru.tahun,
      };
      setMemeriksaForm(true);
      const putusan = await periksaBidangForm(isianBerikut);
      setPutusanForm({
        kunci: kunciIsian(isianBerikut.doi, isianBerikut.judul, isianBerikut.jurnal, isianBerikut.tahun),
        status: putusan.status,
        alasan: putusan.alasan,
      });
      setMemeriksaForm(false);
    } catch {
      setPesanDoi("DOI tidak ditemukan di Crossref maupun OpenAlex atau koneksi gagal. Periksa penulisannya, atau isi manual.");
    } finally {
      setSibukDoi(false);
    }
  }
  const [peringatanDuplikat, setPeringatanDuplikat] = useState("");
  const [tampilPetunjuk, setTampilPetunjuk] = useState(
    () => typeof window !== "undefined" && !window.localStorage.getItem("uthruha:petunjuk:referensi"),
  );

  function tutupPetunjuk() {
    setTampilPetunjuk(false);
    try {
      window.localStorage.setItem("uthruha:petunjuk:referensi", "1");
    } catch {
      /* abaikan */
    }
  }

  // Daftar pustaka SATU JALUR (Tahap 6): perumus yang sama dengan
  // tab Ekspor (daftarPustakaProyek) — hawamisy kampus, pedoman
  // unggahan, gaya proyek, atau arab klasik. Dulu tab ini memilih
  // perumus sendiri dan mengabaikan gaya proyek, jadi satu sumber
  // bisa tampil berbeda antara dua tab.
  const daftar = useMemo(() => daftarPustakaProyek(p), [p]);

  // Footnote yang benar-benar terpakai di naskah, SUDAH bernomor mengikuti
  // urutan sitasi dan terformat pedoman/gaya — siap salin ke dokumen mahasiswa
  // tanpa kode penanda [[ref:…]] sama sekali.
  const footnoteNaskah = useMemo(() => {
    const hasil = kompilasiDokumen(p);
    return [...hasil.markdown.matchAll(/^\[\^(\d+)\]: (.*)$/gm)].map((m) => ({
      nomor: m[1] ?? "",
      teks: m[2] ?? "",
    }));
  }, [p]);
  const teksDaftar = useMemo(
    () =>
      daftar
        .map((g) => `### ${g.judul}\n\n${g.entri.map((e, i) => `${i + 1}. ${e}`).join("\n")}`)
        .join("\n\n"),
    [daftar],
  );

  async function simpan(paksa = false) {
    if (!baru.penulis.trim() || !baru.judul.trim()) return;
    if (!paksa) {
      const dup = cariDuplikat(baru, p.sumber);
      if (dup) {
        setPeringatanDuplikat(
          `Kemungkinan duplikat dari "${dup.duplikat.judul}" — ${dup.alasan}. Periksa dulu, atau tetap simpan bila memang edisi berbeda.`,
        );
        return;
      }
    }
    setPeringatanDuplikat("");
    // Judul dibersihkan dari tag jenis di titik simpan ini (Tahap 6):
    // tag seperti [مجلة] tidak boleh masuk data tersimpan lagi.
    let entri: Sumber = {
      ...baru,
      judul: bersihkanJudul(baru.judul),
      id: baru.id || `src-${Date.now().toString(36)}`,
    };
    if (baru.doi?.trim()) {
      // GERBANG SIMPAN ber-DOI (Aturan Pencarian Valid, putusan
      // pemilik 5 Nov 2026 15:57): DOI yang diketik pada formulir
      // manual WAJIB (1) cocok dengan judulnya di Crossref lewat
      // verifikasiDoi dan (2) lolos bidang lewat endpoint verifikasi
      // bersama. Gagal salah satu = referensi TIDAK disimpan. Ini
      // menggantikan perilaku lama yang tetap menyimpan dengan tanda
      // perlu verifikasi, karena tanda itu terbukti menjadi celah
      // rujukan palsu masuk daftar.
      const h = await verifikasiDoi(baru.doi, entri.judul);
      if (h.status !== "cocok") {
        setPesanVerif(`Simpan ditolak: ${h.pesan} Betulkan DOI atau judulnya; referensi tidak disimpan.`);
        return;
      }
      setMemeriksaForm(true);
      const putusan = await periksaBidangForm({
        doi: baru.doi,
        judul: entri.judul,
        jurnal: baru.jurnal,
        tahun: baru.tahun,
      });
      setMemeriksaForm(false);
      setPutusanForm({
        kunci: kunciIsian(baru.doi, baru.judul, baru.jurnal ?? "", baru.tahun),
        status: putusan.status,
        alasan: putusan.alasan,
      });
      if (putusan.status !== "terverifikasi") {
        setPesanVerif(`Simpan ditolak: ${putusan.alasan}`);
        return;
      }
      entri = { ...entri, perluVerifikasi: undefined, statusVerifikasi: "terverifikasi" };
      setPesanVerif(`DOI referensi terakhir terverifikasi: cocok dengan judulnya di Crossref dan sesuai bidang proyek.`);
    } else {
      // Tanpa DOI: batas yang dinyatakan pemilik. Sitasi yang ditulis
      // sendiri dari sumber cetak (mis. kitab yang dibaca langsung)
      // adalah karya tulis pengguna, bukan hasil pencarian aplikasi,
      // jadi tetap tersimpan — tetapi selalu bertanda perlu
      // verifikasi karena tidak ada rekod hidup yang memeriksanya.
      // Sejak perbaikan laporan QA 6 Nov 2026 tanda itu kini punya
      // konsekuensi: entri dicap "belum" dan tertahan dari pemasangan
      // footnote (gerbang pasang putusanPasangSumber) sampai
      // diverifikasi lewat tombol Verifikasi pada entrinya di daftar
      // bawah, memakai mesin yang sama dengan gerbang simpan ini.
      // Wawancara dikecualikan dari cap: ia sumber primer pengguna
      // sendiri dan tidak punya registri untuk memeriksanya.
      entri = {
        ...entri,
        perluVerifikasi: true,
        ...(baru.jenis === "wawancara" ? {} : { statusVerifikasi: "belum" as const }),
      };
    }
    ubah({ sumber: [...p.sumber, entri] });
    setBaru({ ...KOSONG, id: "" });
    setAsalDoi(null);
    setPutusanForm(null);
  }

  /** Periksa DOI di kotak DOI terhadap JUDUL formulir: DOI harus milik judul itu. */
  async function periksaDoiForm() {
    if (!baru.judul.trim() || doiAmbil.trim().length < 6) return;
    setSibukDoi(true);
    setPesanVerif("");
    try {
      const h = await verifikasiDoi(doiAmbil, baru.judul);
      setPesanVerif(h.pesan);
    } finally {
      setSibukDoi(false);
    }
  }

  /** Ambil metadata kitab/buku dari ISBN via Google Books — mengisi formulir manual. */
  async function ambilDariIsbn() {
    const isbn = isbnAmbil.replace(/[\s-]/g, "");
    if (isbn.length < 10) return;
    setSibukIsbn(true);
    setPesanIsbn("");
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const v = data?.items?.[0]?.volumeInfo;
      if (!v) throw new Error("kosong");
      setBaru((b) => ({
        ...b,
        jenis: "kitab",
        judul: v.title || b.judul,
        penulis: Array.isArray(v.authors) ? v.authors.join("; ") : b.penulis,
        penerbit: v.publisher ?? b.penerbit,
        tahun: v.publishedDate ? String(v.publishedDate).slice(0, 4) : b.tahun,
        halaman: v.pageCount ? String(v.pageCount) : b.halaman,
        isbn,
      }));
      setPesanIsbn(`Metadata ISBN ${isbn} terisi ke formulir — periksa kota & edisinya (Google Books jarang memuat kota terbit), lalu tambahkan.`);
    } catch {
      setPesanIsbn("ISBN tidak ditemukan di Google Books atau koneksi gagal. Periksa penulisannya, atau isi manual.");
    } finally {
      setSibukIsbn(false);
    }
  }

  async function impor() {
    const hasil = parseImpor(imporTeks);
    if (!hasil || hasil.entri.length === 0) {
      setPesanImpor("Tidak ada entri yang terbaca. Pastikan teksnya BibTeX (diawali @article/@book) atau RIS (diawali TY - ).");
      return;
    }
    const diterima: Sumber[] = [];
    let ditolak = 0;
    let terverifikasiDoi = 0;
    for (const e of hasil.entri) {
      let bersih: Sumber = { ...e, judul: bersihkanJudul(e.judul) };
      if (bersih.doi?.trim()) {
        // Entri impor ber-DOI melewati pemeriksaan yang SAMA seperti
        // entri manual ber-DOI pada gerbang simpan (perbaikan laporan
        // QA 6 Nov 2026, memakai ulang gerbang yang ada, bukan jalur
        // baru): verifikasiDoi ke Crossref lalu endpoint verifikasi
        // jurnal. Lolos keduanya berarti cap terverifikasi dan boleh
        // dipasang; gagal berarti entri tetap masuk sebagai "belum"
        // (impor tidak membuang data pengguna) dan tertahan dari
        // pemasangan sampai diverifikasi dari daftar rujukan.
        try {
          const cocok = await verifikasiDoi(bersih.doi, bersih.judul);
          if (cocok.status === "cocok") {
            const putusan = await periksaBidangForm({
              doi: bersih.doi,
              judul: bersih.judul,
              jurnal: bersih.jurnal,
              tahun: bersih.tahun,
            });
            if (putusan.status === "terverifikasi") {
              bersih = { ...bersih, statusVerifikasi: "terverifikasi", perluVerifikasi: false };
              terverifikasiDoi++;
            }
          }
        } catch {
          /* pemeriksaan gagal dijalankan: entri tetap "belum" */
        }
      }
      if (cariDuplikat(bersih, [...p.sumber, ...diterima])) ditolak++;
      else diterima.push(bersih);
    }
    if (diterima.length > 0) ubah({ sumber: [...p.sumber, ...diterima] });
    setPesanImpor(
      `Impor ${hasil.format.toUpperCase()}: ${diterima.length} entri ditambahkan${ditolak ? `, ${ditolak} dilewati karena terdeteksi duplikat` : ""}${terverifikasiDoi ? `, ${terverifikasiDoi} di antaranya terverifikasi lewat DOI` : ""}. Periksa kembali tiap entri — data impor tidak diverifikasi aplikasi kecuali yang disebut terverifikasi lewat DOI. Entri yang belum terverifikasi belum bisa dipasang sebagai footnote; jalankan Verifikasi pada entrinya di daftar rujukan.`,
    );
    setImporTeks("");
  }

  const [memeriksaEntriId, setMemeriksaEntriId] = useState<string | null>(null);
  const [hasilVerifEntri, setHasilVerifEntri] = useState<Record<string, string>>({});

  /**
   * Jalan verifikasi untuk entri tersimpan yang tertahan gerbang
   * pasang (perbaikan laporan QA 6 Nov 2026), memakai mesin yang
   * sudah ada, bukan jalur baru:
   *  - entri jurnaliah (ber-DOI, berjenis artikel, atau bernama
   *    jurnal): DOI-nya lewat verifikasiDoi, lalu endpoint
   *    verifikasi jurnal yang sama dengan gerbang simpan; tanpa DOI,
   *    endpoint itu mencocokkan rekodnya dari judul.
   *  - entri web: rekodnya adalah tautannya sendiri.
   *  - entri kitab dan keluarga buku lain: gerbang kategori kitab
   *    yang sama dengan jalur pencarian, ditambah bukti tautan
   *    rekod sumber bila ada.
   * Lolos berarti cap berubah menjadi "terverifikasi" dan entri bisa
   * dipasang; tidak ditemukan rekodnya berarti cap tetap "belum",
   * entri tetap tertahan, dan alasannya tampil apa adanya.
   */
  async function verifikasiEntri(s: Sumber) {
    setMemeriksaEntriId(s.id);
    const catat = (pesan: string) =>
      setHasilVerifEntri((h) => ({ ...h, [s.id]: pesan }));
    const cap = (status: "terverifikasi" | "belum", pesan: string) => {
      ubahSumber(s.id, {
        statusVerifikasi: status,
        ...(status === "terverifikasi" ? { perluVerifikasi: undefined } : {}),
      });
      catat(pesan);
      setMemeriksaEntriId(null);
    };
    try {
      const jurnaliah = Boolean(s.doi?.trim()) || s.jenis === "artikel" || Boolean(s.jurnal?.trim());
      if (jurnaliah) {
        if (s.doi?.trim()) {
          const cocok = await verifikasiDoi(s.doi, s.judul);
          if (cocok.status !== "cocok") {
            cap("belum", `Belum terverifikasi: ${cocok.pesan}`);
            return;
          }
        }
        const putusan = await periksaBidangForm({
          doi: s.doi ?? "",
          judul: s.judul,
          jurnal: s.jurnal,
          tahun: s.tahun,
        });
        if (putusan.status === "terverifikasi") {
          cap("terverifikasi", `Terverifikasi: ${putusan.alasan}`);
        } else {
          cap("belum", `Belum terverifikasi: ${putusan.alasan}`);
        }
        return;
      }
      if (s.jenis === "web" && s.url) {
        cap("terverifikasi", "Terverifikasi: entri web ini membawa tautan rekodnya sendiri.");
        return;
      }
      const gerbang = gerbangKategoriKitab(
        {
          judul: s.judul,
          kategoriKitab: s.kategoriKitab,
          daftarIsi: s.daftarIsi,
          judulProyek: p.judulAr ?? "",
        },
        p.bidangId ?? "",
      );
      if (gerbang.putusan === "gagal-bidang") {
        cap("belum", `Belum terverifikasi: ${gerbang.alasan}`);
        return;
      }
      if (gerbang.putusan === "lolos" || s.url) {
        cap(
          "terverifikasi",
          gerbang.putusan === "lolos"
            ? `Terverifikasi: ${gerbang.alasan}`
            : "Terverifikasi: entri ini membawa tautan rekod sumbernya.",
        );
        return;
      }
      cap(
        "belum",
        `Belum terverifikasi: ${gerbang.alasan} Yang bisa membuatnya bisa dipasang adalah DOI yang terverifikasi atau rujukan hasil pencarian yang terverifikasi.`,
      );
    } catch {
      catat("Pemeriksaan gagal dijalankan (jaringan atau layanan). Coba lagi sebentar.");
      setMemeriksaEntriId(null);
    }
  }

  function ubahSumber(id: string, patch: Partial<Sumber>) {
    ubah({ sumber: p.sumber.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }

  function hapus(id: string) {
    ubah({ sumber: p.sumber.filter((s) => s.id !== id) });
  }

  function sisipkanKeMaraji() {
    const maraji = p.draf.maraji ?? "";
    const blok = teksDaftar.replace(/^### /gm, "### ");
    ubah({
      draf: {
        ...p.draf,
        maraji: `${maraji.trim() ? `${maraji.trim()}\n\n` : "## المراجع\n\n"}${blok}`,
      },
    });
  }

  const handoffKembangkan = (() => {
    const mentah = p.jawaban["kembangkan:khalfiya"];
    if (!mentah) return null;
    try {
      return JSON.parse(mentah) as { jumlahParagraf: number; jumlahRefTersimpan: number; jumlahSumber: number; pada: string };
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-5">
      {handoffKembangkan && (
        <div className="rounded-xl border border-gold-600/30 bg-gold-500/5 px-3 py-2.5">
          <p className="text-[12px] leading-relaxed text-ink-700">
            <b>Panel Kembangkan:</b> {handoffKembangkan.jumlahParagraf} paragraf khalfiyah terbawa
            dari tab Tulis ({new Date(handoffKembangkan.pada).toLocaleString("id-ID")}), beserta{" "}
            {handoffKembangkan.jumlahRefTersimpan} rujukan tersimpan & {handoffKembangkan.jumlahSumber}{" "}
            sumber proyek. Tambahkan rujukan sebanyak yang dibutuhkan di sini, lalu kembangkan
            kalimatnya di tab Tulis.
          </p>
        </div>
      )}
      <div>
        <h2 className="text-[15px] font-bold text-ink-900">Rujukan & sitasi</h2>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-600">
          Masukkan data sumber sekali, lalu salin format yang Anda butuhkan. Semua format di
          bawah dihitung dari data Anda — aplikasi tidak menambahkan sumber yang tidak ada.
        </p>
      </div>

      {tampilPetunjuk && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-gold-600/30 bg-gold-100/40 px-3 py-2.5">
          <p className="text-[12px] leading-relaxed text-ink-700">
            <b>Mulai dari sini:</b> tambahkan rujukan manual, tempel DOI/BibTeX lewat panel
            impor, atau buka sub-tab <b>Cari online &amp; lokal</b>. Di tab Tulis, tombol
            Sisip sitasi menanam penanda [[ref:…]] yang menjadi footnote otomatis saat ekspor.
            Penjelasan lengkap ada di <a className="underline" href="/panduan#referensi">Panduan — Rujukan &amp; sitasi</a>.
          </p>
          <button type="button" onClick={tutupPetunjuk} className="btn-quiet shrink-0 !py-0.5">
            Mengerti
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Bagian rujukan" className="flex gap-1 border-b border-ink-900/10 pb-2">
        {([
          { id: "sumber" as const, label: "Sumber & daftar pustaka" },
          { id: "cari" as const, label: "Cari online & lokal" },
          { id: "pedoman" as const, label: "Pedoman kampus" },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={sub === tab.id}
            onClick={() => setSub(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
              sub === tab.id ? "bg-ink-900 text-parchment-100" : "text-ink-600 hover:bg-ink-900/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {sub === "pedoman" && <PedomanPanel p={p} ubah={ubah} />}

      {sub === "cari" && <PencarianTopikPanel p={p} ubah={ubah} />}

      {sub === "sumber" && (
      <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-900/10 bg-white/60 px-3 py-2">
        <span className="text-[12px] font-semibold text-ink-800">Gaya sitasi proyek:</span>
        <select
          className="input !w-auto !py-1 text-[12px]"
          value={gayaSah(p.gayaSitasi)}
          onChange={(e) => ubah({ gayaSitasi: e.target.value as GayaSitasi })}
          aria-label="Gaya sitasi"
        >
          {(Object.keys(GAYA_LABEL) as GayaSitasi[]).map((g) => (
            <option key={g} value={g}>
              {GAYA_LABEL[g]}
            </option>
          ))}
        </select>
        <span className="text-[10.5px] text-ink-500">
          Berlaku untuk penanda sitasi [[ref:…]] saat ekspor. Daftar pustaka & footnote siap salin
          di bawah mengikuti pedoman kampus bila proyek ini punya pedoman.
        </span>
      </div>
      <div className="rounded-2xl border border-ink-900/10 bg-white/70 p-4">
        <div className="mb-3 rounded-xl bg-parchment-100/70 px-3 py-2.5">
          <p className="text-[12px] font-semibold text-ink-900">Punya DOI jurnal? Ambil metadatanya otomatis</p>
          <p className="mt-0.5 text-[11px] text-ink-600">
            Jurnal Indonesia &amp; Inggris yang ber-DOI terisi lengkap (penulis, jurnal, volume,
            halaman) tanpa mengetik ulang — tinggal periksa dan tambahkan.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className="input w-72 !py-1.5 text-[12px]"
              dir="ltr"
              value={doiAmbil}
              onChange={(e) => setDoiAmbil(e.target.value)}
              placeholder="10.xxxx/xxxxx atau https://doi.org/…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void ambilDariDoi(); } }}
            />
            <button type="button" className="btn-quiet" disabled={sibukDoi || doiAmbil.trim().length < 6} onClick={() => void ambilDariDoi()}>
              {sibukDoi ? "Mengambil…" : "Ambil dari DOI"}
            </button>
            {pesanDoi && <span className="text-[11px] text-ink-600">{pesanDoi}</span>}
          </div>
          {(memeriksaForm || putusanFormAktif) && (
            <p className="mt-2 text-[11px] leading-relaxed">
              {memeriksaForm ? (
                <span className="rounded-full bg-ink-900/10 px-2 py-0.5 font-semibold text-ink-600">
                  Memeriksa bidang…
                </span>
              ) : putusanFormAktif ? (
                <>
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      putusanFormAktif.status === "terverifikasi"
                        ? "bg-emerald-100 text-emerald-800"
                        : putusanFormAktif.status === "belum-terverifikasi"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {putusanFormAktif.status === "terverifikasi"
                      ? "Terverifikasi"
                      : putusanFormAktif.status === "gagal-metadata"
                        ? "Gagal periksa metadata"
                        : putusanFormAktif.status === "gagal-bidang"
                          ? "Tidak sesuai bidang"
                          : "Belum terverifikasi"}
                  </span>{" "}
                  <span className="text-ink-600">{putusanFormAktif.alasan}</span>
                </>
              ) : null}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-ink-900/5 pt-2">
            <button type="button" className="btn-quiet" disabled={sibukDoi || doiAmbil.trim().length < 6 || !baru.judul.trim()} onClick={() => void periksaDoiForm()}>
              Periksa kecocokan DOI
            </button>
            <span className="text-[11px] text-ink-500">
              Membandingkan DOI dengan judul yang Anda ketik di formulir — DOI tertukar atau asal tempel akan ketahuan.
            </span>
            {pesanVerif && <span className="w-full text-[11px] font-medium text-ink-700">{pesanVerif}</span>}
          </div>
        </div>
        <div className="mb-3 rounded-xl bg-parchment-100/70 px-3 py-2.5">
          <p className="text-[12px] font-semibold text-ink-900">Punya ISBN kitab/buku? Ambil metadatanya otomatis</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className="input w-72 !py-1.5 text-[12px]"
              dir="ltr"
              value={isbnAmbil}
              onChange={(e) => setIsbnAmbil(e.target.value)}
              placeholder="978-… atau 979-…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void ambilDariIsbn(); } }}
            />
            <button type="button" className="btn-quiet" disabled={sibukIsbn || isbnAmbil.replace(/[\s-]/g, "").length < 10} onClick={() => void ambilDariIsbn()}>
              {sibukIsbn ? "Mengambil…" : "Ambil dari ISBN"}
            </button>
            {pesanIsbn && <span className="text-[11px] text-ink-600">{pesanIsbn}</span>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Jenis sumber">
            <select
              className="input"
              value={baru.jenis}
              onChange={(e) => setBaru({ ...baru, jenis: e.target.value as JenisSumber })}
            >
              {(Object.keys(JENIS_LABEL) as JenisSumber[]).map((j) => (
                <option key={j} value={j}>
                  {JENIS_LABEL[j].id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Penulis (Arab)" hint="Format: اللقب، الاسم — mis. القرطبي، أبو عبد الله">
            <input
              dir="rtl"
              className="input text-right font-naskh"
              value={baru.penulis}
              onChange={(e) => setBaru({ ...baru, penulis: e.target.value })}
              placeholder="القرطبي، أبو عبد الله محمد"
            />
            {asalDoi && <CatatanAsalKolom asal={asalDoi.penulis} nilai={baru.penulis} />}
          </Field>
          <Field label="Tahun">
            <input
              className="input"
              value={baru.tahun}
              onChange={(e) => setBaru({ ...baru, tahun: e.target.value })}
              placeholder="1964"
            />
            {asalDoi && <CatatanAsalKolom asal={asalDoi.tahun} nilai={baru.tahun} />}
          </Field>
          <Field label="Judul (Arab)" className="sm:col-span-3">
            <input
              dir="rtl"
              className="input text-right font-naskh text-[15px]"
              value={baru.judul}
              onChange={(e) => setBaru({ ...baru, judul: e.target.value })}
              placeholder="الجامع لأحكام القرآن"
            />
            {asalDoi && <CatatanAsalKolom asal={asalDoi.judul} nilai={baru.judul} />}
          </Field>
          <Field label="Kota">
            <input
              dir="rtl"
              className="input text-right font-naskh"
              value={baru.kota ?? ""}
              onChange={(e) => setBaru({ ...baru, kota: e.target.value })}
              placeholder="القاهرة"
            />
          </Field>
          <Field label="Penerbit">
            <input
              dir="rtl"
              className="input text-right font-naskh"
              value={baru.penerbit ?? ""}
              onChange={(e) => setBaru({ ...baru, penerbit: e.target.value })}
              placeholder="دار الكتب المصرية"
            />
            {asalDoi && <CatatanAsalKolom asal={asalDoi.penerbit} nilai={baru.penerbit ?? ""} />}
          </Field>
          <Field label="تحقيق">
            <input
              dir="rtl"
              className="input text-right font-naskh"
              value={baru.tahqiq ?? ""}
              onChange={(e) => setBaru({ ...baru, tahqiq: e.target.value })}
              placeholder="أحمد البردوني"
            />
          </Field>
          <Field label="Jilid">
            <input
              className="input"
              value={baru.jilid ?? ""}
              onChange={(e) => setBaru({ ...baru, jilid: e.target.value })}
              placeholder="1"
            />
          </Field>
          <Field label="Halaman">
            <input
              className="input"
              value={baru.halaman ?? ""}
              onChange={(e) => setBaru({ ...baru, halaman: e.target.value })}
              placeholder="23"
            />
            {asalDoi && <CatatanAsalKolom asal={asalDoi.halaman} nilai={baru.halaman ?? ""} />}
          </Field>
          {(baru.jenis === "kitab" || baru.jenis === "artikel") && (
            <Field
              label="DOI"
              hint="Isi bila sumber ini punya DOI; DOI diperiksa kecocokannya dengan judul di Crossref dan bidangnya terverifikasi sebelum entri tersimpan."
            >
              <input
                dir="ltr"
                className="input"
                value={baru.doi ?? ""}
                onChange={(e) => setBaru({ ...baru, doi: e.target.value })}
                placeholder="10.xxxx/xxxxx"
              />
            </Field>
          )}
          {baru.jenis === "artikel" && (
            <>
              <Field label="Nama jurnal">
                <input
                  dir="rtl"
                  className="input text-right font-naskh"
                  value={baru.jurnal ?? ""}
                  onChange={(e) => setBaru({ ...baru, jurnal: e.target.value })}
                  placeholder="مجلة الدراسات الإسلامية"
                />
                {asalDoi && <CatatanAsalKolom asal={asalDoi.jurnal} nilai={baru.jurnal ?? ""} />}
              </Field>
              <Field label="Volume / Nomor">
                <div className="flex gap-2">
                  <input
                    className="input"
                    value={baru.volume ?? ""}
                    onChange={(e) => setBaru({ ...baru, volume: e.target.value })}
                    placeholder="12"
                  />
                  <input
                    className="input"
                    value={baru.nomor ?? ""}
                    onChange={(e) => setBaru({ ...baru, nomor: e.target.value })}
                    placeholder="2"
                  />
                </div>
                {asalDoi && (
                  <p className="mt-1 text-[10px] leading-relaxed text-ink-500">
                    Volume: {keteranganAsalKolom(asalDoi.volume, Boolean((baru.volume ?? "").trim()))}
                    {" · "}Nomor: {keteranganAsalKolom(asalDoi.nomor, Boolean((baru.nomor ?? "").trim()))}
                  </p>
                )}
              </Field>
            </>
          )}
          {baru.jenis === "web" && (
            <Field label="URL" className="sm:col-span-2">
              <input
                className="input"
                value={baru.url ?? ""}
                onChange={(e) => setBaru({ ...baru, url: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-500">
            Wajib: penulis dan judul. Selebihnya mengikuti gaya sitasi yang Anda pakai.
            {baru.doi?.trim()
              ? " Isian ber-DOI hanya tersimpan bila DOI cocok dengan judulnya di Crossref dan bidangnya terverifikasi."
              : ""}
          </p>
          <button
            type="button"
            onClick={() => simpan()}
            disabled={
              memeriksaForm ||
              (Boolean(baru.doi?.trim()) && putusanFormAktif !== null && putusanFormAktif.status !== "terverifikasi")
            }
            className="btn-primary !py-2.5 disabled:opacity-40"
          >
            <IconPlus className="h-4 w-4" /> Simpan rujukan
          </button>
        </div>
        {/* Penjelasan gerbang pasang (P1.1 opsi pemilik): perilaku
            simpan sebagai draf PERLU VERIFIKASI tidak berubah; yang
            ditambah hanya kalimat penjelasnya di sini, berlaku sama
            untuk jenis Kitab dan Artikel jurnal. */}
        <p className="mt-3 rounded-lg bg-parchment-100/70 px-3 py-2 text-[11.5px] leading-relaxed text-ink-600">
          Rujukan yang belum terverifikasi tidak bisa dipasang ke draf sampai diverifikasi. Entri
          manual tanpa DOI tersimpan sebagai draf berlabel PERLU VERIFIKASI; periksa lewat tombol
          Verifikasi pada entrinya di daftar rujukan di bawah.
        </p>
        {peringatanDuplikat && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <span>{peringatanDuplikat}</span>
            <button type="button" onClick={() => simpan(true)} className="btn-quiet shrink-0">
              Tetap simpan
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-ink-900/10 bg-white/70 p-4">
        <h3 className="text-[13px] font-bold text-ink-900">Impor dari BibTeX / RIS</h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600">
          Tempel ekspor dari Zotero, Mendeley, atau Google Scholar. Entri yang terdeteksi
          duplikat (DOI sama atau judul hampir sama) dilewati otomatis.
        </p>
        <textarea
          className="input mt-2 min-h-24 w-full font-mono text-[11px]"
          value={imporTeks}
          onChange={(e) => setImporTeks(e.target.value)}
          placeholder={"@article{...}\natau\nTY  - JOUR"}
          dir="ltr"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-500">{pesanImpor}</p>
          <button type="button" onClick={impor} disabled={!imporTeks.trim()} className="btn-quiet shrink-0">
            Impor entri
          </button>
        </div>
      </div>

      {p.sumber.length === 0 ? (
        <Note>
          Belum ada rujukan. Tambahkan minimal satu untuk melihat format kutipan dalam teks,
          catatan kaki, dan daftar pustaka Arab.
        </Note>
      ) : (
        <div className="space-y-2">
          {p.sumber.map((s) => {
            const terbuka = buka === s.id;
            const putS = putusanPasangSumber(s);
            return (
              <div key={s.id} className="rounded-xl border border-ink-900/10 bg-white/70">
                <div className="flex items-start justify-between gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => setBuka(terbuka ? null : s.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-ink-900/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-600">
                        {JENIS_LABEL[s.jenis].ar}
                      </span>
                      {s.sumberImpor && s.sumberImpor !== "manual" && (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-700">
                          dari {s.sumberImpor}
                        </span>
                      )}
                      {s.perluVerifikasi && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700">
                          perlu verifikasi
                        </span>
                      )}
                      {!putS.boleh ? (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-rose-700">
                          belum terverifikasi · belum bisa dipasang
                        </span>
                      ) : s.statusVerifikasi === "terverifikasi" ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700">
                          terverifikasi
                        </span>
                      ) : null}
                      <span className="truncate text-[12.5px] font-semibold text-ink-900">
                        {bersihkanJudul(s.judul) || "(tanpa judul)"}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-right font-naskh text-[13px] text-ink-600" dir="rtl">
                      {s.penulis}
                      {s.tahun ? ` — ${s.tahun}` : ""}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton teks={kutipanDalamTeks(s)} label="Sitasi" />
                    <button
                      type="button"
                      onClick={() => hapus(s.id)}
                      className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-red-50 hover:text-red-600"
                      title="Hapus"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {terbuka && (
                  <div className="space-y-2 border-t border-dashed border-ink-900/10 px-3 py-3">
                    {s.doi?.trim() && (
                      <div className="flex items-start gap-2 rounded-lg bg-parchment-100/70 px-2.5 py-2">
                        <span className="w-28 shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                          DOI
                        </span>
                        <a
                          href={`https://doi.org/${s.doi.trim()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="ltr"
                          className="flex-1 text-[12.5px] leading-relaxed text-gold-700 underline underline-offset-2"
                        >
                          {s.doi.trim()}
                        </a>
                      </div>
                    )}
                    {[
                      { label: "Dalam teks", nilai: kutipanDalamTeks(s) },
                      { label: "Catatan kaki", nilai: catatanKaki(s) },
                      { label: "Daftar pustaka", nilai: entriPustakaProyek(p, s) },
                      { label: "Gaya Indonesia (APA)", nilai: entriIndonesia(s) },
                    ].map((f) => (
                      <div key={f.label} className="flex items-start gap-2 rounded-lg bg-parchment-100/70 px-2.5 py-2">
                        <span className="w-28 shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                          {f.label}
                        </span>
                        <span className="flex-1 text-[12.5px] leading-relaxed text-ink-800" dir="auto">
                          {f.nilai}
                        </span>
                        <CopyButton teks={f.nilai} label="" className="btn-quiet shrink-0 !px-1.5" />
                      </div>
                    ))}
                    {/* Jalan verifikasi entri tertahan gerbang pasang:
                        memakai mesin yang sama dengan gerbang simpan
                        (lihat verifikasiEntri). Hasilnya tampil apa
                        adanya; entri yang tidak ditemukan rekodnya
                        tetap belum terverifikasi dan tertahan. */}
                    {!putS.boleh && (
                      <div className="rounded-lg bg-rose-50 px-2.5 py-2">
                        <p className="text-[11.5px] leading-relaxed text-rose-800">{putS.alasan}</p>
                        <button
                          type="button"
                          onClick={() => void verifikasiEntri(s)}
                          disabled={memeriksaEntriId === s.id}
                          className="btn-quiet mt-1.5 !px-2.5 !py-1 !text-[11px] disabled:opacity-40"
                        >
                          {memeriksaEntriId === s.id ? "Memeriksa…" : "Verifikasi entri ini"}
                        </button>
                      </div>
                    )}
                    {hasilVerifEntri[s.id] && (
                      <p className="rounded-lg bg-parchment-100/70 px-2.5 py-2 text-[11.5px] leading-relaxed text-ink-700">
                        {hasilVerifEntri[s.id]}
                      </p>
                    )}
                    <div className="grid gap-2 pt-1 sm:grid-cols-3">
                      {(
                        [
                          { kunci: "temuan", label: "Temuan utama" },
                          { kunci: "metodeSumber", label: "Metode sumber" },
                          { kunci: "relevansi", label: "Relevansi bagi penelitian saya" },
                        ] as const
                      ).map((f) => (
                        <Field key={f.kunci} label={f.label}>
                          <textarea
                            className="input min-h-16 w-full text-[12px]"
                            value={s[f.kunci] ?? ""}
                            onChange={(e) => ubahSumber(s.id, { [f.kunci]: e.target.value })}
                            placeholder="Tulis ringkas…"
                          />
                        </Field>
                      ))}
                    </div>
                    <p className="text-[10.5px] text-ink-500">
                      Tiga kolom ini adalah pengganti matriks tinjauan pustaka — isi seperlunya,
                      tampilkan sebagai tabel dari daftar rujukan Anda.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {footnoteNaskah.length > 0 && (
        <div className="rounded-2xl border border-ink-900/10 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold text-ink-900">
              Footnote di naskah ini — bernomor & sesuai {p.pedoman?.formatFootnote ? "pedoman kampus" : "gaya proyek"} ({footnoteNaskah.length})
            </h3>
            <CopyButton
              teks={footnoteNaskah.map((f) => `${f.nomor}. ${f.teks}`).join("\n")}
              label="Salin semua footnote"
            />
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
            Inilah footnote persis seperti yang tampil di dokumen akhir — lengkap dengan nomornya,
            tanpa kode penanda. Salin satu per satu atau semuanya, lalu tempel ke dokumen Anda.
            Nomor mengikuti urutan sitasi pertama di naskah dan berubah otomatis bila naskah berubah.
          </p>
          <ol className="mt-3 space-y-2">
            {footnoteNaskah.map((f) => (
              <li key={f.nomor} className="flex items-start justify-between gap-2 rounded-lg bg-parchment-100/60 px-2.5 py-2">
                <p className="min-w-0 text-[12px] leading-relaxed text-ink-800">
                  <span className="me-1.5 font-bold text-ink-900">{f.nomor}.</span>
                  <span className="font-naskh" dir="rtl">{f.teks}</span>
                </p>
                <CopyButton teks={`${f.nomor}. ${f.teks}`} label="Salin" className="btn-quiet shrink-0 !px-2 !py-1 !text-[11px]" />
              </li>
            ))}
          </ol>
        </div>
      )}

      {daftar.length > 0 && (
        <div className="rounded-2xl border border-ink-900/10 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold text-ink-900">
              Daftar rujukan tersusun ({p.sumber.length} entri)
            </h3>
            <div className="flex gap-1.5">
              <CopyButton teks={teksDaftar} label="Salin daftar" />
              <button type="button" onClick={sisipkanKeMaraji} className="btn-quiet">
                Sisipkan ke bagian المراجع
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-4">
            {daftar.map((g) => (
              <div key={g.judul}>
                <p className="font-arabic text-[13px] font-semibold text-gold-700" dir="rtl">
                  {g.judul}
                </p>
                <ol className="mt-1 space-y-1">
                  {g.entri.map((e, i) => (
                    <li
                      key={i}
                      className="rounded-md bg-parchment-100/60 px-2 py-1.5 text-right font-naskh text-[13.5px] leading-relaxed text-ink-800"
                      dir="rtl"
                    >
                      {i + 1}. {e}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            Urutan memakai kaidah alfabet Arab. Format mengikuti gaya catatan kaki kitab —
            sesuaikan dengan pedoman kampus atau jurnal target Anda.
          </p>
        </div>
      )}
      </>
      )}
    </div>
  );
}
