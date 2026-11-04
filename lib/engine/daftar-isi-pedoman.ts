// lib/engine/daftar-isi-pedoman.ts
// Mengubah daftar isi / sistematika penulisan dari pedoman kampus menjadi
// daftar isi proyek (BabKustom[]). Tiga sumber:
//   1. Bagian "Daftar Isi / Sistematika / Struktur" di dalam pedoman .md
//      (parseOutlinePedoman — hanya membaca bagian itu).
//   2. Tempelan bebas dari mahasiswa (parseOutlineTempelan — semua baris
//      dianggap outline).
//   3. Susunan OTOMATIS dari judul + template pedoman terpilih
//      (susunDaftarIsiOtomatis — Pembangunan Ulang Tahap 2, poin A6:
//      perintah pemilik "topik ndak usah ada lagi, cukup judul; daftar
//      isi tersusun sendiri menyesuaikan judul dan pedoman").
// Format outline yang dipahami:
//   - BAB I Pendahuluan            <- bab (tanpa indentasi / diawali BAB|الباب)
//     - Latar Belakang             <- sub-bab (indentasi 2 spasi / penomoran 1.1)
//       - Pengertian               <- fasal/matlab (indentasi 4 spasi / 1.1.1)
// Penomoran desimal (1, 1.1, 1.1.1) juga dipahami dan mengalahkan indentasi.

import { z } from "zod";
import type { BabKustom, SubBabKustom } from "@/lib/engine/project";
import { angkaArabKeLatin } from "@/lib/refs/pedoman";
import {
  strukturKeDaftarIsi,
  type StrukturPedoman,
} from "@/lib/pedoman/skema-struktur";

const BAB_AR = [
  "الأول", "الثاني", "الثالث", "الرابع", "الخامس",
  "السادس", "السابع", "الثامن", "التاسع", "العاشر",
];

const mengandungArab = (s: string) => /[\u0600-\u06FF]/.test(s);

interface BarisOutline {
  tingkat: number; // 0 bab, 1 sub-bab, 2 fasal
  teks: string;
}

function bersihkanBaris(raw: string): { tingkat: number; teks: string } | null {
  const tanpaKanan = raw.replace(/\s+$/, "");
  if (!tanpaKanan.trim()) return null;
  if (/^-{3,}$/.test(tanpaKanan.trim())) return null;

  let isi = tanpaKanan.replace(/^\s+/, "");
  const indentMentah = tanpaKanan.slice(0, tanpaKanan.length - isi.length);
  const indent = indentMentah.replace(/\t/g, "  ").length;

  // Penanda daftar markdown / penomoran.
  isi = isi.replace(/^[-*•]\s+/, "");
  isi = angkaArabKeLatin(isi);
  let tingkatDesimal: number | null = null;
  const desimal = isi.match(/^(\d+(?:\.\d+){0,2})[.)]?\s+(.+)$/);
  if (desimal) {
    tingkatDesimal = desimal[1].split(".").length - 1;
    isi = desimal[2];
  } else {
    isi = isi.replace(/^\d+[.)]\s+/, "");
  }
  const teks = angkaArabKeLatin(isi.replace(/\*\*/g, "").trim());
  if (!teks) return null;

  const babTegas = /^(BAB\s|الباب\s|Bab\s)/.test(teks);
  let tingkat: number;
  if (babTegas) tingkat = 0;
  else if (tingkatDesimal !== null) tingkat = Math.min(tingkatDesimal, 2);
  else if (indent >= 4) tingkat = 2;
  else if (indent >= 2) tingkat = 1;
  else tingkat = 0;
  return { tingkat, teks };
}

function barisKeDaftarIsi(baris: BarisOutline[]): BabKustom[] {
  const hasil: BabKustom[] = [];
  let bab: BabKustom | null = null;
  let sub: SubBabKustom | null = null;
  for (const b of baris) {
    if (b.tingkat === 0) {
      const n = hasil.length + 1;
      bab = {
        id: `ped-bab-${n}`,
        labelId: b.teks,
        labelAr: mengandungArab(b.teks) ? b.teks : "",
        babAr: `الباب ${BAB_AR[n - 1] ?? n}`,
        sections: [],
      };
      hasil.push(bab);
      sub = null;
    } else if (b.tingkat === 1) {
      if (!bab) continue;
      sub = {
        id: `ped-bab-${hasil.length}-${bab.sections.length + 1}`,
        labelId: b.teks,
        labelAr: mengandungArab(b.teks) ? b.teks : "",
      };
      bab.sections.push(sub);
    } else {
      if (!bab || !sub) continue;
      const anak: SubBabKustom = {
        id: `${sub.id}-${(sub.anak?.length ?? 0) + 1}`,
        labelId: b.teks,
        labelAr: mengandungArab(b.teks) ? b.teks : "",
      };
      sub.anak = [...(sub.anak ?? []), anak];
    }
  }
  return hasil;
}

function kumpulkan(teks: string): BarisOutline[] {
  const hasil: BarisOutline[] = [];
  for (const raw of teks.split(/\r?\n/)) {
    const b = bersihkanBaris(raw);
    if (b) hasil.push(b);
  }
  return hasil;
}

/**
 * Baca daftar isi dari teks pedoman .md — HANYA dari bagian berjudul
 * Daftar Isi / Sistematika / Struktur. Null bila bagian itu tidak ada atau
 * isinya kosong, supaya pemanggil bisa memberi petunjuk yang benar.
 */
export function parseOutlinePedoman(mentah: string): BabKustom[] | null {
  if (!mentah) return null;
  const lines = mentah.split(/\r?\n/);
  let mulai = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,4}\s/.test(lines[i]) && /(daftar isi|sistematika|struktur|المحتويات|فهرس المحتويات|نظام الكتابة|هيكل البحث|خطة البحث|ترتيب الأبواب|منهجية الكتابة|نظام البحث)/i.test(lines[i])) {
      mulai = i + 1;
      break;
    }
  }
  if (mulai < 0) return null;
  let akhir = lines.length;
  for (let i = mulai; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) {
      akhir = i;
      break;
    }
  }
  const potongan = lines.slice(mulai, akhir).join("\n");
  if (/(tidak disebut|غير مذكور|غير موجود|لا يوجد|غير متوفر)/i.test(potongan) && potongan.replace(/(tidak disebut|غير مذكور|غير موجود|لا يوجد|غير متوفر)/gi, "").trim().length < 10) return null;
  const baris = kumpulkan(potongan);
  if (baris.length === 0) return null;
  const daftar = barisKeDaftarIsi(baris);
  return daftar.length > 0 ? daftar : null;
}

/** Baca daftar isi dari tempelan bebas mahasiswa (semua baris = outline). */
export function parseOutlineTempelan(teks: string): BabKustom[] | null {
  if (!teks || teks.trim().length < 5) return null;
  const baris = kumpulkan(teks);
  if (baris.length < 2) return null;
  const daftar = barisKeDaftarIsi(baris);
  return daftar.length > 0 && daftar.some((b) => b.sections.length > 0) ? daftar : null;
}

/* ==========================================================================
   DAFTAR ISI OTOMATIS DARI JUDUL + PEDOMAN (Pembangunan Ulang Tahap 2, A6)

   Perintah pemilik: field topik dihapus; cukup judul. Daftar isi tiap bab
   tersusun otomatis dari dua sumber saja: kerangka template pedoman
   terpilih (strukturKeDaftarIsi — membawa ikatan menjawabIsykal, tujuan,
   aturan, dan seluruh sub-bab wajib pedoman) dan dekonstruksi konsep
   judul. Pola contoh pemilik: judul "pengaruh ushul fiqh dalam
   kehidupan" menghasilkan Bab 2 yang membuka dengan sub-bab "Ushul Fiqh
   bahasa dan istilah" beserta rincian di bawahnya.

   Keputusan jalur (dicatat juga di laporan Tahap 2): generasi berjalan
   DETERMINISTIK di klien, bukan panggilan model. Wizard Kitabah bersifat
   lokal (proyek tetap tercipta walau sesi server belum ada atau jaringan
   gagal), jadi pembuatan proyek tidak boleh bergantung pada kolam LLM.
   Pola KATALOG-REPO Tema 6 (vercel/ai generateObject + zod) diadopsi
   sebagai ARSITEKTUR VALIDASINYA: kandidat daftar isi adalah data
   terstruktur yang wajib lolos SkemaDaftarIsiOtomatis (Zod) dan
   validasiDaftarIsiOtomatis (ikatan isykal + unsur wajib pedoman)
   sebelum dipasang; gagal di gerbang mana pun, hasilnya jatuh ke
   proyeksi template murni. Hasil yang lolos tetap TITIK AWAL: mahasiswa
   menyuntingnya bebas di editor daftar isi.
   ========================================================================== */

/** Skema bentuk kandidat daftar isi otomatis (gerbang bentuk pola generateObject). */
const SkemaAnakDaftarIsi = z.object({
  id: z.string().min(1),
  labelId: z.string(),
  labelAr: z.string(),
});
const SkemaSubBabDaftarIsi = SkemaAnakDaftarIsi.extend({
  anak: z.array(SkemaAnakDaftarIsi).optional(),
});
export const SkemaDaftarIsiOtomatis = z.array(
  z.object({
    id: z.string().min(1),
    labelId: z.string().min(1),
    labelAr: z.string(),
    babAr: z.string(),
    isykalKe: z.number().int().min(1).optional(),
    tujuan: z.string().optional(),
    aturan: z.array(z.string()).optional(),
    sections: z.array(SkemaSubBabDaftarIsi).min(1),
  }),
);

export interface KonsepJudul {
  /** Frasa konsep persis dari judul (bahasa judul itu sendiri). */
  teks: string;
  /** Judul berbahasa Arab: frasa ini bisa dipakai pada label Arab. */
  arab: boolean;
}

export interface HasilKonsepJudul {
  konsep: KonsepJudul[];
  /** Label sub-bab relasi antar konsep (Arab), "" bila pola relasi tidak terbaca. */
  relasiAr: string;
  /** Label sub-bab relasi antar konsep (Indonesia), "" bila tidak ada. */
  relasiId: string;
}

const KEPALA_RELASI_AR: Record<string, string> = {
  "أثر": "Pengaruh",
  "تأثير": "Pengaruh",
  "دور": "Peran",
  "فاعلية": "Efektivitas",
  "فعالية": "Efektivitas",
  "أهمية": "Urgensi",
  "علاقة": "Hubungan",
  "انعكاسات": "Dampak",
  "إسهام": "Kontribusi",
  "تطبيق": "Penerapan",
  "تطبيقات": "Penerapan",
  "تنمية": "Pengembangan",
  "تطوير": "Pengembangan",
  "واقع": "Realitas",
  "مستوى": "Tingkat",
};
const PREPOSISI_AR = [" في ", " على ", " لدى ", " عند "];

function bersihFrasa(s: string): string {
  return s.replace(/^["«“]+|["»”]+$/g, "").replace(/[.:؛،]+$/g, "").trim().replace(/\s+/g, " ");
}

/**
 * Dekonstruksi konsep dari judul: frasa-frasa konsep yang menjadi bahan
 * sub-bab materi, mengikuti pola dekonstruksi judul mesin khalfiyah
 * (belah pada kata relasi dan preposisi batas), diperluas untuk judul
 * Arab (relasi أثر/دور/…, pola بين … و …, belah في/على/لدى/عند).
 * Murni deterministik dan tanpa jaringan; judul yang tidak terbaca
 * polanya menghasilkan satu konsep = judul utuh, atau kosong bila judul
 * terlalu pendek.
 */
export function dekonstruksiKonsepJudul(judul: string): HasilKonsepJudul {
  const kosong: HasilKonsepJudul = { konsep: [], relasiAr: "", relasiId: "" };
  const j = bersihFrasa(judul ?? "");
  if (j.length < 3) return kosong;
  const arab = /[\u0600-\u06FF]/.test(j);
  const hasil: HasilKonsepJudul = { konsep: [], relasiAr: "", relasiId: "" };
  const tambah = (teks: string) => {
    const t = bersihFrasa(teks);
    if (t.length < 2) return;
    if (hasil.konsep.some((k) => k.teks.toLowerCase() === t.toLowerCase())) return;
    if (hasil.konsep.length >= 3) return;
    hasil.konsep.push({ teks: t, arab });
  };

  if (arab) {
    let sisa = j.replace(/^دراسة\s+/, "");
    // Pola "X بين A و B": X adalah konsep payung, A dan B dua domainnya.
    const idxBayna = sisa.indexOf(" بين ");
    if (idxBayna > 0) {
      const payung = bersihFrasa(sisa.slice(0, idxBayna));
      const ekor = sisa.slice(idxBayna + " بين ".length);
      const domain = ekor.split(/\s+و/).map(bersihFrasa).filter((s) => s.length >= 2);
      if (domain.length >= 2) {
        tambah(domain[0]!);
        tambah(domain[1]!);
        if (payung.length >= 2) {
          hasil.relasiAr = `${payung} بين ${domain[0]} و${domain[1]}`;
          hasil.relasiId = `Hubungan ${domain[0]} dan ${domain[1]}`;
        }
        return hasil;
      }
    }
    // Kepala relasi di awal judul: "أثر X في Y", "دور X في Y", dst.
    const kataPertama = sisa.split(/\s+/)[0] ?? "";
    const kepalaId = KEPALA_RELASI_AR[kataPertama];
    if (kepalaId) {
      sisa = bersihFrasa(sisa.slice(kataPertama.length));
      let terbelah = false;
      for (const prep of PREPOSISI_AR) {
        const i = sisa.indexOf(prep);
        if (i > 1) {
          const utama = bersihFrasa(sisa.slice(0, i));
          const konteks = bersihFrasa(sisa.slice(i + prep.length));
          tambah(utama);
          tambah(konteks);
          if (hasil.konsep.length >= 2) {
            hasil.relasiAr = `${kataPertama} ${utama}${prep}${konteks}`;
            hasil.relasiId = `${kepalaId} ${utama} dalam ${konteks}`;
          }
          terbelah = true;
          break;
        }
      }
      if (!terbelah) tambah(sisa);
      return hasil;
    }
    // Belah tunggal pada preposisi batas.
    for (const prep of PREPOSISI_AR) {
      const i = sisa.indexOf(prep);
      if (i > 1) {
        tambah(sisa.slice(0, i));
        tambah(sisa.slice(i + prep.length));
        return hasil;
      }
    }
    tambah(sisa);
    return hasil;
  }

  // Judul Latin/Indonesia: belah pada preposisi batas; kata relasi di
  // awal menjadi kepala sub-bab relasi, bukan bagian dari konsep.
  const KEPALA_ID = /^(pengaruh|hubungan|efektivitas|efektifitas|peran|penerapan|implementasi|kontribusi|dampak|korelasi|analisis|studi|kajian)\s+/i;
  let sisa = j;
  let kepala = "";
  const mKepala = sisa.match(KEPALA_ID);
  if (mKepala) {
    kepala = mKepala[1]!;
    sisa = bersihFrasa(sisa.slice(mKepala[0].length));
  }
  // Pola "Hubungan antara X dengan Y": pasangan antara...dengan adalah
  // pembelah konsepnya. Tanpa penanganan khusus, seluruh sisa judul
  // menjadi satu konsep (temuan telaah Tahap 2, S3).
  const mAntara = sisa.match(/^antara\s+(.+?)\s+dengan\s+(.+)$/i);
  if (mAntara) {
    tambah(mAntara[1]!);
    tambah(mAntara[2]!);
    if (kepala && hasil.konsep.length >= 2) {
      const kap = kepala.charAt(0).toUpperCase() + kepala.slice(1).toLowerCase();
      hasil.relasiId = `${kap} ${hasil.konsep[0]!.teks} dengan ${hasil.konsep[1]!.teks}`;
    }
    return hasil;
  }
  // Pola metode-di-lokasi: "… di <institusi/tempat>" yang MENUTUP judul
  // adalah batas lokasi penelitian, bukan konsep. Dibuang dari bahan
  // konsep agar objek kajian sebelumnya tidak tertutup nama tempat dan
  // nama tempat tidak diberi sub-bab definisi (temuan telaah Tahap 2,
  // S3). Ekor yang masih memuat preposisi lain tidak disentuh; itu di
  // luar pola yang terbukti.
  const mLokasi = sisa.match(
    /^(.+?)\s+di\s+((?:madrasah|sekolah|universitas|institut|pondok|pesantren|ma'had|mahad|sma|smk|smp|mtsn|mts|min|mi|sd|stai|stain|iain|uin|stkip|politeknik|akademi|kelas|kecamatan|kabupaten|kota|desa|provinsi)\b.*)$/i,
  );
  if (mLokasi && !/\s+(?:dalam|pada|terhadap|untuk|melalui)\s+/i.test(mLokasi[2]!)) {
    sisa = bersihFrasa(mLokasi[1]!);
  }
  const bagian = sisa
    .split(/\s+(?:dalam|pada|terhadap|di|untuk|melalui)\s+/i)
    .map(bersihFrasa)
    .filter((s) => s.length >= 2);
  if (bagian.length >= 2) {
    tambah(bagian[0]!);
    tambah(bagian[bagian.length - 1]!);
    if (kepala && hasil.konsep.length >= 2) {
      const kap = kepala.charAt(0).toUpperCase() + kepala.slice(1).toLowerCase();
      hasil.relasiId = `${kap} ${hasil.konsep[0]!.teks} dalam ${hasil.konsep[1]!.teks}`;
    }
  } else {
    tambah(sisa);
  }
  return hasil;
}

function seksiDefinisi(konsep: KonsepJudul, id: string): SubBabKustom {
  return {
    id,
    labelId: `Definisi ${konsep.teks} menurut bahasa dan istilah`,
    labelAr: konsep.arab ? `${konsep.teks} لغةً واصطلاحًا` : "",
    anak: [
      { id: `${id}-bahasa`, labelId: "Pengertian menurut bahasa", labelAr: "المعنى اللغوي" },
      { id: `${id}-istilah`, labelId: "Pengertian menurut istilah", labelAr: "المعنى الاصطلاحي" },
    ],
  };
}

function normLabel(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/**
 * Validator daftar isi otomatis (gerbang pola KATALOG Tema 6): hasil
 * generasi TIDAK BOLEH (1) mengubah jumlah/urutan/nama bab template,
 * (2) memutus ikatan bab ke isykal, (3) membuang ATAU mengganti isi
 * tujuan/aturan bab template (dibandingkan persis, bukan jumlahnya),
 * (4) membuang sub-bab WAJIB pedoman atau perancah jawaban bab yang
 * terikat isykal, (5) menyimpang dari bentuk BabKustom. Mengembalikan
 * daftar pelanggaran; kosong = lolos.
 */
export function validasiDaftarIsiOtomatis(daftar: BabKustom[], tpl: StrukturPedoman): string[] {
  const galat: string[] = [];
  if (!SkemaDaftarIsiOtomatis.safeParse(daftar).success) {
    galat.push("bentuk daftar isi tidak sesuai skema BabKustom");
  }
  const babTpl = [...tpl.bab].sort((a, b) => a.nomor - b.nomor);
  if (daftar.length !== babTpl.length) {
    galat.push(`jumlah bab ${daftar.length} tidak sama dengan template (${babTpl.length})`);
    return galat;
  }
  const proyeksi = strukturKeDaftarIsi(tpl);
  babTpl.forEach((b, i) => {
    const db = daftar[i]!;
    if (db.id !== `bab-pedoman-${b.nomor}`) {
      galat.push(`bab ke-${i + 1} bukan bab pedoman nomor ${b.nomor}`);
      return;
    }
    const pb = proyeksi[i]!;
    if (db.labelId !== pb.labelId || db.labelAr !== pb.labelAr || db.babAr !== pb.babAr) {
      galat.push(`bab ${b.nomor} berganti nama dari pedoman`);
    }
    if (typeof b.menjawabIsykal === "number" && db.isykalKe !== b.menjawabIsykal) {
      galat.push(`bab ${b.nomor} kehilangan ikatan isykal ${b.menjawabIsykal}`);
    }
    if (typeof b.menjawabIsykal !== "number" && typeof db.isykalKe === "number") {
      galat.push(`bab ${b.nomor} mendapat ikatan isykal karangan (${db.isykalKe})`);
    }
    if (b.tujuan && db.tujuan !== b.tujuan) galat.push(`bab ${b.nomor} kehilangan tujuan pedoman`);
    if (b.aturan.length > 0) {
      // Isi aturan dibandingkan PERSIS seperti tujuan (perbaikan telaah
      // Tahap 2, S4): membandingkan jumlah saja membiarkan teks aturan
      // yang diganti karangan lolos selama hitungannya sama.
      const teksTpl = b.aturan.map((a) => a.teks);
      const teksDb = db.aturan ?? [];
      if (teksDb.length !== teksTpl.length || teksTpl.some((t, j) => teksDb[j] !== t)) {
        galat.push(`bab ${b.nomor} kehilangan aturan pedoman`);
      }
    }
    const labelProyek = new Set(
      db.sections.flatMap((s) => [normLabel(s.labelId), normLabel(s.labelAr)]),
    );
    for (const sub of b.subBab) {
      // Sub-bab wajib selalu diperiksa. Pada bab terikat isykal, perancah
      // jawaban dari template (satu-satunya sub-bab bab isi Mangkoso,
      // wajib=false sebagai perancah aplikasi) ikut diperiksa: membuangnya
      // tidak boleh lolos senyap (temuan telaah Tahap 2, R2).
      if (!sub.wajib && typeof b.menjawabIsykal !== "number") continue;
      if (!labelProyek.has(normLabel(sub.nama)) && !labelProyek.has(normLabel(sub.namaAr ?? ""))) {
        galat.push(
          sub.wajib
            ? `bab ${b.nomor} membuang sub-bab wajib pedoman "${sub.nama}"`
            : `bab ${b.nomor} membuang perancah pedoman "${sub.nama}"`,
        );
      }
    }
  });
  return galat;
}

/**
 * Susun daftar isi proyek dari judul + template pedoman. Kerangka selalu
 * dari template (strukturKeDaftarIsi); yang diturunkan dari judul hanya
 * sub-bab MATERI pada bab isi:
 *  - bab terikat isykal PERTAMA (menjawabIsykal): membuka dengan sub-bab
 *    definisi bahasa dan istilah bagi konsep-konsep judul (pola contoh
 *    pemilik), sub-bab relasi antar konsep bila polanya terbaca, dan
 *    ditutup perancah jawaban isykal dari template. Bab terikat
 *    berikutnya TIDAK mengulang blok definisi itu (definisi istilah
 *    judul tempatnya di Bab 1 dan di bab terikat pertama); ia membuka
 *    langsung dengan perancah jawaban isykalnya dari template
 *    (perbaikan telaah Tahap 2, S2);
 *  - bab kedua tanpa ikatan (mis. الإطار النظري As'adiyah yang isinya
 *    memang teori sesuai judul): satu sub-bab definisi konsep utama
 *    ditambahkan di depan, sub-bab wajib template tidak digeser;
 *  - bab lain (pendahuluan, penutup, bab profil/analisis) tidak diubah.
 * Judul kosong/tidak terbaca atau hasil gagal validasi: kembalikan
 * proyeksi template murni dengan dariJudul = false.
 */
export function susunDaftarIsiOtomatis(
  tpl: StrukturPedoman,
  judul: string,
): { daftar: BabKustom[]; dariJudul: boolean } {
  const dasar = strukturKeDaftarIsi(tpl);
  const { konsep, relasiAr, relasiId } = dekonstruksiKonsepJudul(judul ?? "");
  if (konsep.length === 0) return { daftar: dasar, dariJudul: false };
  const utama = konsep[0]!;
  // Blok definisi konsep judul hanya untuk bab terikat isykal pertama
  // (nomor bab terkecil yang terikat); bab terikat lain tidak mengulang.
  const babTerikatPertama = [...tpl.bab]
    .sort((a, b) => a.nomor - b.nomor)
    .find((b) => typeof b.menjawabIsykal === "number");
  const idBabDefinisi = babTerikatPertama ? `bab-pedoman-${babTerikatPertama.nomor}` : null;

  let berubah = false;
  const hasil = dasar.map((db) => {
    const bTpl = tpl.bab.find((b) => db.id === `bab-pedoman-${b.nomor}`);
    if (!bTpl) return db;
    if (typeof bTpl.menjawabIsykal === "number") {
      if (db.id !== idBabDefinisi) return db;
      const awalan = `bab-pedoman-${bTpl.nomor}-judul`;
      const sections: SubBabKustom[] = [seksiDefinisi(utama, `${awalan}-1`)];
      if (konsep[1]) sections.push(seksiDefinisi(konsep[1], `${awalan}-2`));
      if (relasiAr || relasiId) {
        sections.push({
          id: `${awalan}-relasi`,
          labelId: relasiId || relasiAr,
          labelAr: relasiAr,
        });
      }
      berubah = true;
      return { ...db, sections: [...sections, ...db.sections] };
    }
    if (bTpl.nomor === 2) {
      berubah = true;
      return {
        ...db,
        sections: [seksiDefinisi(utama, `bab-pedoman-${bTpl.nomor}-judul-1`), ...db.sections],
      };
    }
    return db;
  });
  if (!berubah) return { daftar: dasar, dariJudul: false };
  if (validasiDaftarIsiOtomatis(hasil, tpl).length > 0) return { daftar: dasar, dariJudul: false };
  return { daftar: hasil, dariJudul: true };
}
