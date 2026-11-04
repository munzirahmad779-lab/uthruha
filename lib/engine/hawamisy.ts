/**
 * Mesin footnote hawamisy pedoman kampus (Tahap 6) — ditulis tangan dari
 * SPEC-PEDOMAN, BUKAN Turabian umum dan bukan CSL/citeproc:
 *
 * - Mangkoso: 12 format sumber (SPEC-PEDOMAN §2.5, pedoman PDF hal.
 *   11-12) dipilih dari JENIS sumber sebagai data terstruktur, plus
 *   aturan pengulangan butir 3 (langsung, tanpa sumber lain di antara)
 *   dan butir 4 (sesudah diselingi sumber lain), singkatan ketiadaan
 *   data butir 5 (د.ت. tahun tak diketahui, د.ن. penerbit tak
 *   diketahui), dan daftar pustaka §2.6 (nama masyhur, judul miring,
 *   kota: penerbit, tahun; abjad hijaiyah; kelompok الكتب والمجلات
 *   والشبكة والمقابلة).
 * - As'adiyah: format Bab 4 panduan (SPEC-PEDOMAN §3.6): kitab lengkap
 *   dengan cetakan dalam kurung (kota: penerbit، ط n، tahun Hijriah/
 *   Masehi), pengulangan cukup pengarang + judul + jilid + halaman,
 *   jurnal Arab (العدد، رقم، ص.) dan pola Latin (Vol., No., Th., h.),
 *   takhrij hadis rinci, wawancara "مقابلة شخصية مع", dan catatan
 *   sumber salinan Syamilah. Penomoran mulai dari 1 tiap bab diatur
 *   kompilator (marker.ts), bukan di sini.
 *
 * Keputusan perumus yang tidak tertulis persis di SPEC (dinyatakan
 * jujur, bukan karangan diam-diam):
 * - Jenis "bab" tidak punya butir sendiri di Mangkoso; dirumuskan
 *   mengikuti format 1 dengan pola "في" (judul bab tegak dalam kutip,
 *   judul buku miring). Di As'adiyah mengikuti contoh tabel nomor 5
 *   pedoman (patron "dalam ... (eds.)").
 * - Jenis "koran" di Mangkoso mengikuti format 6 (artikel) tanpa
 *   volume; di As'adiyah mengikuti pola artikel koran tabel nomor 8.
 * - Keterangan derajat risalah memakai frasa persis pedoman Mangkoso
 *   "رسالة ماجستير أو دكتوراه" karena tingkat risalah orang lain
 *   tidak tersimpan sebagai data.
 * - Judul hadis (format 12 Mangkoso) tidak dimiringkan karena butir
 *   12 tidak menyebut cetak miring, berbeda dengan format 1.
 * - DOI tidak dicetak pada format hawamisy karena template SPEC
 *   tidak memuatnya; DOI tetap tersimpan di data sumber.
 * - Daftar pustaka Mangkoso untuk artikel/web/wawancara/skripsi
 *   dirumuskan dari kerangka §2.6 (pengarang. judul. kota: penerbit,
 *   tahun) karena SPEC hanya mencontohkan bentuk kitab di sana.
 * - Kelompok daftar pustaka Mangkoso menambah "الرسائل العلمية"
 *   untuk skripsi di luar empat kelompok bernama SPEC, supaya tidak
 *   ada sumber yang hilang dari daftar.
 * - Urutan bahasa daftar pustaka As'adiyah (Arab, Inggris, bahasa
 *   lain, Indonesia): bahasa sumber tidak tersimpan sebagai data,
 *   jadi kelompok tengah (Inggris + bahasa lain) dikenali dari
 *   penulisDaftar Latin hasil impor, dan nama Latin tanpa
 *   penulisDaftar diperlakukan sebagai Indonesia.
 *
 * Lisensi: tidak ada kode pihak ketiga yang disalin. Pola CSL
 * Chicago Notes + locales-ar dari KATALOG-REPO tema sitasi hanya
 * menjadi rujukan banding; mesin ini implementasi tangan dari teks
 * pedoman, jadi tidak ada kewajiban CPAL/AGPL/CC BY-SA yang melekat.
 */
import { bersihkanJudul, type Sumber } from "@/lib/engine/cite";
import { judulSingkat, miring, penulisSingkat, type OpsiFootnote } from "@/lib/engine/citation";
import type { Project } from "@/lib/engine/project";
import { TEMPLATE_PEDOMAN } from "@/lib/pedoman/template-pedoman";

export type KampusPedoman = "mangkoso" | "asadiah";

/** Kampus pemilik template pedoman proyek, dari nama pedoman persis
 *  milik template bawaan. Proyek tanpa template (atau template kampus
 *  lain dari unggahan/ AI) mengembalikan null: mesin hawamisy tidak
 *  menebak kampus dari teks bebas. */
export function kampusProyek(
  p: Pick<Project, "strukturPedoman">,
): KampusPedoman | null {
  const nama = p.strukturPedoman?.namaPedoman ?? "";
  if (!nama) return null;
  const mk = TEMPLATE_PEDOMAN.find((t) => /mangkoso/i.test(t.namaPedoman));
  const as = TEMPLATE_PEDOMAN.find((t) => /as'adiyah/i.test(t.namaPedoman));
  if (mk && nama === mk.namaPedoman) return "mangkoso";
  if (as && nama === as.namaPedoman) return "asadiah";
  return null;
}

/** Mode penomoran per-bab dari template pedoman proyek (Tahap 1). */
export function modePerBab(p: Pick<Project, "strukturPedoman">): boolean {
  return p.strukturPedoman?.penomoranFootnote === "per-bab";
}

export interface KonteksFootnote {
  /** Kemunculan pertama sumber ini dalam lingkup penomoran aktif
   *  (dokumen utuh untuk mode bersambung; bab aktif untuk per-bab). */
  pertama: boolean;
  /** Kemunculan ini tepat sesudah kemunculan sumber yang sama, tanpa
   *  sumber lain di antaranya (syarat format 3 Mangkoso). */
  langsungBerulang: boolean;
}

const ADA_ARAB = /[\u0600-\u06FF]/;

function kutip(teks: string): string {
  return `“${teks}”`;
}

/** Gabung segmen tak-kosong dengan koma Arab dan tutup dengan titik. */
function gabungArab(segmen: (string | undefined | null | false)[]): string {
  const isi = segmen.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  return isi.length > 0 ? `${isi.join("، ")}.` : "";
}

/** Gabung segmen tak-kosong dengan koma Latin dan tutup dengan titik. */
function gabungLatin(segmen: (string | undefined | null | false)[]): string {
  const isi = segmen.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  return isi.length > 0 ? `${isi.join(", ")}.` : "";
}

function halamanDari(s: Sumber, opsi: OpsiFootnote): string {
  return (opsi.halaman ?? s.halaman ?? "").trim();
}

function jilidDari(s: Sumber, opsi: OpsiFootnote): string {
  return (opsi.jilid ?? s.jilid ?? "").trim();
}

/** Edisi cetakan gaya Mangkoso: "الطبعة الثانية" (frasa utuh). */
function edisiMangkoso(edisi: string): string {
  const e = edisi.trim();
  if (!e) return "";
  if (e.startsWith("الطبعة")) return e;
  if (e.startsWith("ط")) return `الطبعة ${e.slice(1).trim()}`.trim();
  return `الطبعة ${e}`;
}

/** Edisi cetakan gaya As'adiyah: "ط 1" (di dalam kurung cetakan). */
function edisiAsadiyah(edisi: string): string {
  const e = edisi.trim();
  if (!e) return "";
  if (e.startsWith("ط")) return e;
  if (e.startsWith("الطبعة")) return `ط ${e.slice("الطبعة".length).trim()}`.trim();
  return `ط ${e}`;
}

/**
 * Segmen tempat terbit Mangkoso dengan singkatan ketiadaan data
 * (format 5): penerbit tak diketahui ditulis د.ن. pada slotnya.
 * Mengembalikan segmen tempat SAJA; tahun dirumuskan terpisah karena
 * pada contoh format 1 keterangan cetakan menyela di antara penerbit
 * dan tahun.
 */
function tempatMangkoso(s: Sumber): string {
  const kota = (s.kota ?? "").trim();
  const penerbit = (s.penerbit ?? "").trim();
  if (kota && penerbit) return `${kota}: ${penerbit}`;
  if (kota) return `${kota}: د.ن.`;
  if (penerbit) return penerbit;
  return "د.ن.";
}

/** Segmen tahun Mangkoso: cetakan mendahului tahun dengan titik dua
 *  ("الطبعة الثانية: 2006"); tahun tak diketahui ditulis د.ت. */
function tahunMangkoso(s: Sumber): string {
  const tahun = (s.tahun ?? "").trim();
  const edisi = edisiMangkoso(s.edisi ?? "");
  const t = tahun || "د.ت.";
  return edisi ? `${edisi}: ${t}` : t;
}

/** Tahun gabungan As'adiyah: "1411هـ/1991م" bila keduanya ada;
 *  tahun Masehi tunggal ditulis polos seperti contoh takhrij
 *  pedoman "(بيروت: دار إحياء التراث العربي، 1954)". */
function tahunAsadiyah(s: Sumber): string {
  const h = (s.tahunHijriah ?? "").trim();
  const m = (s.tahun ?? "").trim();
  if (h && m) return `${h}هـ/${m}م`;
  if (m) return m;
  if (h) return `${h}هـ`;
  return "";
}

/** Kurung cetakan As'adiyah: (kota: penerbit، ط n، tahun gabungan). */
function kurungCetakanAsadiyah(s: Sumber): string {
  const kotaPenerbit = [s.kota, s.penerbit].filter((x) => (x ?? "").trim()).join(": ");
  const bag = [kotaPenerbit, edisiAsadiyah(s.edisi ?? ""), tahunAsadiyah(s)].filter(Boolean);
  return bag.length > 0 ? `(${bag.join("، ")})` : "";
}

function catatanSyamilah(s: Sumber): string {
  return s.sumberImpor === "shamela" ? "(المكتبة الشاملة)" : "";
}

/* ------------------------------------------------------------------ */
/* Mangkoso (SPEC-PEDOMAN §2.5)                                        */
/* ------------------------------------------------------------------ */

function footnoteMangkoso(s: Sumber, opsi: OpsiFootnote, konteks: KonteksFootnote): string {
  const judul = bersihkanJudul(s.judul);
  const hal = halamanDari(s, opsi);
  const jilid = jilidDari(s, opsi);

  if (!konteks.pertama) {
    // Format 3 & 4: nama masyhur pengarang saja; format 3 tanpa
    // judul (pengulangan langsung), format 4 dengan singkatan judul.
    const nomorHadis = (s.nomorHadis ?? "").trim();
    const ekor =
      s.jenis === "hadis"
        ? nomorHadis || hal
          ? `رقم الحديث: ${nomorHadis || hal}`
          : ""
        : s.jenis === "web"
          ? hal
            ? `ص. ${hal}`
            : (s.url ?? "")
          : hal
            ? `ص. ${hal}`
            : "";
    return gabungArab([
      penulisSingkat(s.penulis),
      konteks.langsungBerulang ? "" : judulSingkat(judul),
      ekor,
    ]);
  }

  switch (s.jenis) {
    case "artikel": {
      // Format 6: pengarang tanpa gelar, judul artikel tegak dalam
      // kutip, nama majalah miring, jilid/juz, kota: penerbit, tahun,
      // halaman.
      const volume = (s.volume ?? "").trim() || jilid;
      const tempat = [s.kota, s.penerbit].filter((x) => (x ?? "").trim()).join(": ");
      return gabungArab([
        s.penulis,
        kutip(judul),
        s.jurnal ? miring(s.jurnal) : "",
        volume ? `ج. ${volume}` : "",
        tempat,
        (s.tahun ?? "").trim(),
        hal ? `ص. ${hal}` : "",
      ]);
    }
    case "koran": {
      return gabungArab([
        s.penulis,
        kutip(judul),
        s.jurnal ? miring(s.jurnal) : "",
        (s.tanggal ?? "").trim(),
        hal ? `ص. ${hal}` : "",
      ]);
    }
    case "web": {
      // Format 7: pengarang, judul tegak dalam kutip, tanggal terbit
      // (تم نشره في تاريخ), lalu tautan. Tanpa kota/penerbit/tahun/
      // halaman, dan tanpa titik penutup sesudah tautan agar tautan
      // tidak rusak saat disalin.
      const bag = [
        s.penulis,
        kutip(judul),
        (s.tanggal ?? "").trim() ? `تم نشره في تاريخ ${(s.tanggal ?? "").trim()}` : "",
        (s.url ?? "").trim(),
      ].filter(Boolean);
      return bag.join("، ") + ((s.url ?? "").trim() ? "" : ".");
    }
    case "skripsi": {
      // Format 8: keterangan risalah di dalam kurung.
      const keterangan = [
        "رسالة ماجستير أو دكتوراه",
        (s.penerbit ?? "").trim(),
        (s.tahun ?? "").trim(),
      ].filter(Boolean);
      return gabungArab([
        s.penulis,
        kutip(judul),
        keterangan.length > 1 ? `(${keterangan.join("، ")})` : "",
        hal ? `ص. ${hal}` : "",
      ]);
    }
    case "ensiklopedia": {
      // Format 10: huruf "ت" dalam kurung adalah penanda entri.
      return gabungArab([
        s.penulis,
        "(ت)",
        miring(judul),
        jilid ? `ج. ${jilid}` : "",
        tempatMangkoso(s),
        tahunMangkoso(s),
        hal ? `ص. ${hal}` : "",
      ]);
    }
    case "wawancara": {
      // Format 11: narasumber, topik tegak, media, tanggal.
      return gabungArab([s.penulis, judul, (s.media ?? "").trim(), (s.tanggal ?? "").trim()]);
    }
    case "hadis": {
      // Format 12: mukhrij dan nama kitabnya, kota: penerbit, tahun,
      // lalu NOMOR hadis (bukan halaman).
      const nomor = (s.nomorHadis ?? "").trim() || hal;
      const tempat = [s.kota, s.penerbit].filter((x) => (x ?? "").trim()).join(": ");
      return gabungArab([
        s.penulis,
        judul,
        tempat,
        (s.tahun ?? "").trim(),
        nomor ? `رقم الحديث: ${nomor}` : "",
      ]);
    }
    case "bab": {
      const buku = (s.jurnal ?? "").trim();
      return gabungArab([
        s.penulis,
        buku ? kutip(judul) : miring(judul),
        buku ? `في ${miring(buku)}` : "",
        s.muhaqqiq || s.tahqiq ? `تحقيق: ${(s.muhaqqiq ?? s.tahqiq ?? "").trim()}` : "",
        jilid ? `ج. ${jilid}` : "",
        tempatMangkoso(s),
        tahunMangkoso(s),
        hal ? `ص. ${hal}` : "",
      ]);
    }
    default: {
      // Format 1 (kitab) dan format 2 (terjemahan: kata ترجمة + nama
      // penerjemah sesudah judul). Format 9: terjemahan Al-Qur'an
      // mengikuti format kitab ini juga.
      return gabungArab([
        s.penulis,
        miring(judul),
        s.penerjemah ? `ترجمة ${s.penerjemah.trim()}` : "",
        s.muhaqqiq || s.tahqiq ? `تحقيق: ${(s.muhaqqiq ?? s.tahqiq ?? "").trim()}` : "",
        jilid ? `ج. ${jilid}` : "",
        tempatMangkoso(s),
        tahunMangkoso(s),
        hal ? `ص. ${hal}` : "",
      ]);
    }
  }
}

/* ------------------------------------------------------------------ */
/* As'adiyah (SPEC-PEDOMAN §3.6)                                       */
/* ------------------------------------------------------------------ */

function footnoteAsadiyah(s: Sumber, opsi: OpsiFootnote, konteks: KonteksFootnote): string {
  const judul = bersihkanJudul(s.judul);
  const hal = halamanDari(s, opsi);
  const jilid = jilidDari(s, opsi);
  const arab = ADA_ARAB.test(s.penulis) || ADA_ARAB.test(judul);
  const halLabel = arab ? "ص." : "h.";

  if (!konteks.pertama) {
    // Pengulangan kitab: cukup pengarang, judul, jilid, halaman
    // (berlaku juga untuk pengulangan langsung). Jenis lain ditulis
    // utuh kembali, meniru tabel contoh pedoman untuk pengulangan
    // yang diselingi rujukan lain.
    if (s.jenis === "kitab" || s.jenis === "terjemahan" || s.jenis === "ensiklopedia") {
      return arab
        ? gabungArab([s.penulis, judul, jilid ? `ج ${jilid}` : "", hal ? `ص. ${hal}` : "", catatanSyamilah(s)])
        : gabungLatin([s.penulis, judul, jilid ? `Jilid ${jilid}` : "", hal ? `h. ${hal}` : ""]);
    }
    return footnoteAsadiyah(s, opsi, { pertama: true, langsungBerulang: false });
  }

  switch (s.jenis) {
    case "artikel": {
      if (arab) {
        return gabungArab([
          s.penulis,
          kutip(judul),
          (s.jurnal ?? "").trim(),
          (s.volume ?? "").trim() ? `العدد ${(s.volume ?? "").trim()}` : "",
          (s.nomor ?? "").trim() ? `رقم ${(s.nomor ?? "").trim()}` : "",
          (s.tahun ?? "").trim(),
          hal ? `ص. ${hal}` : "",
        ]);
      }
      return gabungLatin([
        s.penulis,
        kutip(judul),
        (s.jurnal ?? "").trim(),
        (s.volume ?? "").trim() ? `Vol. ${(s.volume ?? "").trim()}` : "",
        (s.nomor ?? "").trim() ? `No. ${(s.nomor ?? "").trim()}` : "",
        (s.tahun ?? "").trim() ? `Th. ${(s.tahun ?? "").trim()}` : "",
        hal ? `h. ${hal}` : "",
      ]);
    }
    case "koran": {
      return arab
        ? gabungArab([s.penulis, kutip(judul), (s.jurnal ?? "").trim(), (s.tanggal ?? "").trim(), hal ? `ص. ${hal}` : ""])
        : gabungLatin([s.penulis, kutip(judul), (s.jurnal ?? "").trim(), (s.tanggal ?? "").trim(), hal ? `h. ${hal}` : ""]);
    }
    case "web": {
      const bag = [
        s.penulis,
        kutip(judul),
        (s.tanggal ?? "").trim() ? `تاريخ تصفح المقالة ${(s.tanggal ?? "").trim()}` : "",
        (s.url ?? "").trim(),
      ].filter(Boolean);
      return bag.join(arab ? "، " : ", ") + ((s.url ?? "").trim() ? "" : ".");
    }
    case "skripsi": {
      const keterangan = arab
        ? ["رسالة ماجستير أو دكتوراه", (s.penerbit ?? "").trim(), (s.tahun ?? "").trim()].filter(Boolean)
        : [(s.penerbit ?? "").trim(), (s.tahun ?? "").trim()].filter(Boolean);
      return arab
        ? gabungArab([s.penulis, kutip(judul), keterangan.length > 0 ? `(${keterangan.join("، ")})` : "", hal ? `ص. ${hal}` : ""])
        : gabungLatin([s.penulis, kutip(judul), keterangan.length > 0 ? `(${keterangan.join(", ")})` : "", hal ? `h. ${hal}` : ""]);
    }
    case "wawancara": {
      const tempatTanggal = [
        (s.kota ?? "").trim(),
        (s.tanggal ?? "").trim() ? `في تاريخ ${(s.tanggal ?? "").trim()}` : "",
      ].filter(Boolean);
      return gabungArab([`مقابلة شخصية مع ${s.penulis}`.trim(), tempatTanggal.join(" ")]);
    }
    case "hadis": {
      // Takhrij rinci: pengarang/mukhrij, kitab, nomor hadis, cetakan
      // dalam kurung, kitab tematis, bab, juz, halaman, derajat.
      // Kurung cetakan menempel pada segmen nomor hadis dengan satu
      // spasi, persis contoh pedoman: "رقم: 2218 (بيروت: …، 1954)".
      const nomorDanKurung = [
        (s.nomorHadis ?? "").trim() ? `رقم: ${(s.nomorHadis ?? "").trim()}` : "",
        kurungCetakanAsadiyah(s),
      ]
        .filter(Boolean)
        .join(" ");
      return gabungArab([
        s.penulis,
        judul,
        nomorDanKurung,
        (s.bagianTematis ?? "").trim(),
        (s.babTematis ?? "").trim(),
        jilid ? `ج ${jilid}` : "",
        hal ? `ص. ${hal}` : "",
        (s.derajatHadis ?? "").trim(),
        catatanSyamilah(s),
      ]);
    }
    case "bab": {
      const editor = (s.catatan ?? "").trim();
      const buku = (s.jurnal ?? "").trim();
      const terbit = [s.kota, s.penerbit].filter((x) => (x ?? "").trim()).join(": ");
      const kurung = [terbit, (s.tahun ?? "").trim()].filter(Boolean).join(", ");
      return gabungLatin([
        s.penulis,
        kutip(judul),
        buku || editor ? `dalam ${editor ? `${editor} (eds.)` : ""}${editor && buku ? ", " : ""}${buku}` : "",
        kurung ? `(${kurung})` : "",
        hal ? `h. ${hal}` : "",
      ]);
    }
    default: {
      // Kitab (dan ensiklopedia sebagai kitab, meniru contoh
      // موسوعة فقهية كويتية): pengarang, judul, tahqiq, kurung
      // cetakan, jilid, halaman. Kurung cetakan menempel pada judul
      // (atau pada segmen tahqiq) dengan satu spasi, persis contoh
      // pedoman: "…، تحقيق: نور الهادي رملان (بيروت: …)، ج 1، ص. 113".
      if (arab) {
        const segJudul = [
          judul,
          s.muhaqqiq || s.tahqiq ? `تحقيق: ${(s.muhaqqiq ?? s.tahqiq ?? "").trim()}` : "",
          s.penerjemah ? `ترجمة: ${s.penerjemah.trim()}` : "",
        ]
          .filter(Boolean)
          .join("، ");
        const segJudulKurung = [segJudul, kurungCetakanAsadiyah(s)].filter(Boolean).join(" ");
        return gabungArab([
          s.penulis,
          segJudulKurung,
          jilid ? `ج ${jilid}` : "",
          hal ? `ص. ${hal}` : "",
          catatanSyamilah(s),
        ]);
      }
      const terbit = [s.kota, s.penerbit].filter((x) => (x ?? "").trim()).join(": ");
      const kurung = [terbit, (s.tahun ?? "").trim()].filter(Boolean).join(", ");
      const segJudulLatin = [
        judul,
        s.muhaqqiq || s.tahqiq ? `disunting oleh ${(s.muhaqqiq ?? s.tahqiq ?? "").trim()}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      return gabungLatin([
        s.penulis,
        [segJudulLatin, kurung ? `(${kurung})` : ""].filter(Boolean).join(" "),
        jilid ? `Jilid ${jilid}` : "",
        hal ? `h. ${hal}` : "",
      ]);
    }
  }
}

/** Footnote satu sumber menurut hawamisy kampus proyek. */
export function footnoteKampus(
  s: Sumber,
  kampus: KampusPedoman,
  opsi: OpsiFootnote = {},
  konteks: KonteksFootnote = { pertama: true, langsungBerulang: false },
): string {
  return kampus === "mangkoso" ? footnoteMangkoso(s, opsi, konteks) : footnoteAsadiyah(s, opsi, konteks);
}

/* ------------------------------------------------------------------ */
/* Daftar pustaka kampus                                               */
/* ------------------------------------------------------------------ */

export interface GrupPustakaKampus {
  judul: string;
  entri: string[];
}

const collatorAr = new Intl.Collator("ar");

function urutHijaiyah(items: Sumber[]): Sumber[] {
  return [...items].sort(
    (a, b) =>
      collatorAr.compare(a.penulis, b.penulis) ||
      (a.tahun || "").localeCompare(b.tahun || "") ||
      collatorAr.compare(bersihkanJudul(a.judul), bersihkanJudul(b.judul)),
  );
}

/** Entri daftar pustaka Mangkoso (§2.6): pengarang. judul miring.
 *  kota: penerbit, tahun. */
export function entriPustakaMangkoso(s: Sumber): string {
  const judul = bersihkanJudul(s.judul);
  switch (s.jenis) {
    case "artikel":
    case "koran": {
      const vol = [
        (s.volume ?? "").trim() ? `مج ${(s.volume ?? "").trim()}` : "",
        (s.nomor ?? "").trim() ? `ع ${(s.nomor ?? "").trim()}` : "",
      ].filter(Boolean);
      const bag = [
        `${s.penulis}.`,
        `${kutip(judul)}.`,
        s.jurnal ? `${miring(s.jurnal)}${vol.length > 0 ? `، ${vol.join("، ")}` : ""}${(s.tahun ?? "").trim() ? `، ${(s.tahun ?? "").trim()}` : ""}.` : "",
      ].filter(Boolean);
      return bag.join(" ");
    }
    case "web": {
      const bag = [`${s.penulis}.`, `${kutip(judul)}.`];
      if ((s.url ?? "").trim()) bag.push((s.url ?? "").trim());
      return bag.join(" ");
    }
    case "wawancara": {
      return [`${s.penulis}.`, `${judul}.`, (s.tanggal ?? "").trim() ? `${(s.tanggal ?? "").trim()}.` : ""]
        .filter(Boolean)
        .join(" ");
    }
    case "skripsi": {
      const keterangan = ["رسالة ماجستير أو دكتوراه", (s.penerbit ?? "").trim(), (s.tahun ?? "").trim()].filter(Boolean);
      return [`${s.penulis}.`, `${kutip(judul)}.`, keterangan.length > 1 ? `(${keterangan.join("، ")}).` : ""]
        .filter(Boolean)
        .join(" ");
    }
    default: {
      const tempat = tempatMangkoso(s);
      const tahun = (s.tahun ?? "").trim() || "د.ت.";
      return [`${s.penulis}.`, `${miring(judul)}.`, `${tempat}، ${tahun}.`].join(" ");
    }
  }
}

/** Entri daftar pustaka As'adiyah (butir ي): nama lengkap pengarang.
 *  judul. kota: penerbit, tahun — dengan ط dan tahun Hijriah seperti
 *  contoh resmi pedoman. */
export function entriPustakaAsadiyah(s: Sumber): string {
  const judul = bersihkanJudul(s.judul);
  switch (s.jenis) {
    case "artikel":
    case "koran": {
      const arab = ADA_ARAB.test(s.penulis) || ADA_ARAB.test(judul);
      const vol = arab
        ? [
            (s.volume ?? "").trim() ? `العدد ${(s.volume ?? "").trim()}` : "",
            (s.nomor ?? "").trim() ? `رقم ${(s.nomor ?? "").trim()}` : "",
          ]
        : [
            (s.volume ?? "").trim() ? `Vol. ${(s.volume ?? "").trim()}` : "",
            (s.nomor ?? "").trim() ? `No. ${(s.nomor ?? "").trim()}` : "",
          ];
      const bag = [
        `${s.penulis}.`,
        `${kutip(judul)}.`,
        s.jurnal
          ? `${s.jurnal}${vol.length > 0 ? `${arab ? "، " : ", "}${vol.join(arab ? "، " : ", ")}` : ""}${(s.tahun ?? "").trim() ? `${arab ? "، " : ", "}${(s.tahun ?? "").trim()}` : ""}.`
          : "",
      ].filter(Boolean);
      return bag.join(" ");
    }
    case "web": {
      const bag = [`${s.penulis}.`, `${kutip(judul)}.`];
      if ((s.url ?? "").trim()) bag.push((s.url ?? "").trim());
      return bag.join(" ");
    }
    case "wawancara": {
      const bag = [`مقابلة شخصية مع ${s.penulis}`.trim() + ".", (s.kota ?? "").trim() ? `${(s.kota ?? "").trim()}.` : "", (s.tanggal ?? "").trim() ? `${(s.tanggal ?? "").trim()}.` : ""];
      return bag.filter(Boolean).join(" ");
    }
    case "skripsi": {
      const bag = [`${s.penulis}.`, `${kutip(judul)}.`, [(s.penerbit ?? "").trim(), (s.tahun ?? "").trim()].filter(Boolean).join("، ") + "."];
      return bag.filter((b) => b !== ".").join(" ");
    }
    default: {
      const tempat = [s.kota, s.penerbit].filter((x) => (x ?? "").trim()).join(": ");
      const bagTempat = [tempat, edisiAsadiyah(s.edisi ?? ""), tahunAsadiyah(s)].filter(Boolean);
      return [`${s.penulis}.`, `${judul}.`, bagTempat.length > 0 ? `${bagTempat.join("، ")}.` : ""]
        .filter(Boolean)
        .join(" ");
    }
  }
}

/** Peringkat bahasa untuk urutan daftar pustaka As'adiyah: Arab,
 *  lalu Latin impor (Inggris/bahasa lain), lalu Indonesia. */
function peringkatBahasa(s: Sumber): number {
  if (ADA_ARAB.test(s.penulis)) return 0;
  if (s.penulisDaftar && s.penulisDaftar.length > 0) return 1;
  return 2;
}

/** Daftar pustaka terkelompok menurut kaidah kampus. */
export function daftarPustakaKampus(items: Sumber[], kampus: KampusPedoman): GrupPustakaKampus[] {
  if (kampus === "asadiah") {
    const urut = [...items].sort(
      (a, b) =>
        peringkatBahasa(a) - peringkatBahasa(b) ||
        collatorAr.compare(a.penulis, b.penulis) ||
        (a.tahun || "").localeCompare(b.tahun || "") ||
        collatorAr.compare(bersihkanJudul(a.judul), bersihkanJudul(b.judul)),
    );
    return [{ judul: "المصادر والمراجع", entri: urut.map(entriPustakaAsadiyah) }];
  }
  const grup: { judul: string; jenis: Sumber["jenis"][] }[] = [
    { judul: "الكتب", jenis: ["kitab", "terjemahan", "bab", "ensiklopedia", "hadis"] },
    { judul: "المجلات", jenis: ["artikel", "koran"] },
    { judul: "الرسائل العلمية", jenis: ["skripsi"] },
    { judul: "الشبكة", jenis: ["web"] },
    { judul: "المقابلة", jenis: ["wawancara"] },
  ];
  return grup
    .map((g) => ({
      judul: g.judul,
      entri: urutHijaiyah(items.filter((s) => g.jenis.includes(s.jenis))).map(entriPustakaMangkoso),
    }))
    .filter((g) => g.entri.length > 0);
}
