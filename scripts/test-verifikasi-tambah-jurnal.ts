/**
 * Uji murni Aturan Pencarian Valid untuk tambah jurnal (5 Nov 2026):
 * tanpa jaringan, tanpa server. Dua fungsi yang diuji:
 *
 *  1. ketatkanKunciJurnal (lib/engine/pencarian-topik): kata ambigu
 *     telanjang pada komponen kueri jurnal harus terganti frasa penuh,
 *     frasa yang sudah penuh tidak berubah, dan tanpa pengganti fungsi
 *     memberi peringatan (bukan membuang diam-diam). Objek masukan
 *     tidak boleh berubah (murni).
 *  2. bandingkanDenganRekod (lib/server/verifikasi-rujukan): kartu yang
 *     cocok persis dengan rekod Crossref lulus; judul dipalsukan,
 *     jurnal berbeda, dan tahun berbeda gugur sebagai gagal-metadata;
 *     tahun yang hilang berstatus belum-terverifikasi (tertahan).
 *
 * Jalankan: npx tsx scripts/test-verifikasi-tambah-jurnal.ts
 * Keluar dengan kode non-nol bila ada butir GAGAL.
 */
import { ketatkanKunciJurnal, type KataKunci } from "../lib/engine/pencarian-topik";
import {
  bandingkanDenganRekod,
  type KandidatVerifikasi,
  type RekodCrossref,
} from "../lib/server/verifikasi-rujukan";

let lulus = 0;
let gagal = 0;
function cek(nama: string, ok: boolean, rincian = "") {
  console.log(`${ok ? "PASS" : "GAGAL"} ${nama}${rincian ? " :: " + rincian : ""}`);
  if (ok) lulus += 1;
  else gagal += 1;
}

/* ── 1. ketatkanKunciJurnal ─────────────────────────────────────────── */

const FRASA_TAKAMUL = "التكامل المعرفي بين علوم القرآن وأصول الفقه";

// Kata telanjang pada arab[0] diganti frasa penuh dari daftar yang sama.
{
  const masuk: KataKunci = {
    arab: ["التكامل", FRASA_TAKAMUL],
    indonesia: ["integrasi pengetahuan antara Ulum al-Qur'an dan Ushul Fiqh"],
    inggris: [],
    sumber: "uji",
  };
  const salinan = JSON.parse(JSON.stringify(masuk)) as KataKunci;
  const { kk, catatan } = ketatkanKunciJurnal(masuk);
  cek("kata telanjang arab[0] terganti frasa penuh", kk.arab[0] === FRASA_TAKAMUL, kk.arab[0]);
  cek("penggantian dicatat", catatan.length === 1 && catatan[0]!.includes("التكامل"), catatan[0]);
  cek("objek masukan tidak berubah (murni)", JSON.stringify(masuk) === JSON.stringify(salinan));
}

// Frasa yang sudah penuh tidak berubah dan tanpa catatan.
{
  const masuk: KataKunci = {
    arab: [FRASA_TAKAMUL],
    indonesia: ["integrasi pengetahuan antara Ulum al-Qur'an dan Ushul Fiqh"],
    inggris: ["integration of knowledge between Quranic sciences and ushul fiqh"],
    sumber: "uji",
  };
  const { kk, catatan } = ketatkanKunciJurnal(masuk);
  cek(
    "frasa penuh utuh tidak berubah",
    kk.arab[0] === FRASA_TAKAMUL &&
      kk.indonesia[0] === masuk.indonesia[0] &&
      kk.inggris[0] === masuk.inggris[0],
  );
  cek("frasa penuh tanpa catatan koreksi", catatan.length === 0);
}

// Kata telanjang tanpa frasa sejenis: frasa cadangan (judul) yang menolong.
{
  const masuk: KataKunci = { arab: ["التكامل"], indonesia: [], inggris: [], sumber: "uji" };
  const { kk, catatan } = ketatkanKunciJurnal(masuk, FRASA_TAKAMUL);
  cek("tanpa frasa sejenis, cadangan dipakai", kk.arab[0] === FRASA_TAKAMUL, kk.arab[0]);
  cek("pemakaian cadangan dicatat", catatan.length === 1);
}

// Kata telanjang tanpa pengganti apa pun: dipertahankan + peringatan.
{
  const masuk: KataKunci = { arab: ["التكامل"], indonesia: [], inggris: [], sumber: "uji" };
  const { kk, catatan } = ketatkanKunciJurnal(masuk, "التكامل");
  cek("tanpa pengganti, komponen dipertahankan", kk.arab[0] === "التكامل");
  cek(
    "tanpa pengganti, ada peringatan",
    catatan.length === 1 && catatan[0]!.includes("tidak ada frasa penuh pengganti"),
    catatan[0],
  );
}

// Komponen Indonesia dua kata juga diketatkan dari daftar Indonesianya.
{
  const masuk: KataKunci = {
    arab: [],
    indonesia: ["integrasi pengetahuan", "integrasi pengetahuan antara Ulum al-Qur'an dan Ushul Fiqh"],
    inggris: [],
    sumber: "uji",
  };
  const { kk } = ketatkanKunciJurnal(masuk);
  cek(
    "komponen indonesia pendek terganti frasa penuh",
    kk.indonesia[0] === "integrasi pengetahuan antara Ulum al-Qur'an dan Ushul Fiqh",
    kk.indonesia[0],
  );
}

/* ── 2. bandingkanDenganRekod ───────────────────────────────────────── */

const KARTU_IHYA: KandidatVerifikasi = {
  id: "uji-ihya",
  doi: "10.21580/ihya.20.2.4048",
  judul: "Kaidah Fiqh dan Ushul Fiqh Tentang Produk Halal, Metode Istinbath dan Ijtihad dalam Menetapkan Hukum Produk Halal",
  jurnal: "International Journal Ihya' 'Ulum al-Din",
  tahun: "2018",
};
const REKOD_IHYA: RekodCrossref = {
  judul: KARTU_IHYA.judul,
  jurnal: "International Journal Ihya' 'Ulum al-Din",
  tahun: "2018",
  doi: "10.21580/ihya.20.2.4048",
};

cek("kartu cocok persis dengan rekod: lolos", bandingkanDenganRekod(KARTU_IHYA, REKOD_IHYA).status === "lolos");

{
  const palsu: KandidatVerifikasi = { ...KARTU_IHYA, judul: "Sejarah Perang Dunia Kedua di Eropa dan Pasifik" };
  const h = bandingkanDenganRekod(palsu, REKOD_IHYA);
  cek("judul kartu dipalsukan: gagal-metadata", h.status === "gagal-metadata", h.alasan);
  cek("alasan menyebut judul rekod asli", h.alasan.includes(REKOD_IHYA.judul.slice(0, 30)));
}

{
  const beda: KandidatVerifikasi = { ...KARTU_IHYA, jurnal: "Jurnal Ekonomi Syariah Nusantara" };
  const h = bandingkanDenganRekod(beda, REKOD_IHYA);
  cek("nama jurnal berbeda: gagal-metadata", h.status === "gagal-metadata", h.alasan);
  cek("alasan menyebut jurnal rekod asli", h.alasan.includes("Ihya' 'Ulum al-Din"));
}

{
  const beda: KandidatVerifikasi = { ...KARTU_IHYA, tahun: "2021" };
  const h = bandingkanDenganRekod(beda, REKOD_IHYA);
  cek("tahun berbeda: gagal-metadata", h.status === "gagal-metadata", h.alasan);
  cek("alasan menyebut tahun rekod", h.alasan.includes("2018"));
}

{
  const hilang: KandidatVerifikasi = { ...KARTU_IHYA, tahun: undefined };
  cek(
    "tahun kartu hilang: belum-terverifikasi",
    bandingkanDenganRekod(hilang, REKOD_IHYA).status === "belum-terverifikasi",
  );
  const hilangRekod: RekodCrossref = { ...REKOD_IHYA, tahun: undefined };
  cek(
    "tahun rekod hilang: belum-terverifikasi",
    bandingkanDenganRekod(KARTU_IHYA, hilangRekod).status === "belum-terverifikasi",
  );
}

{
  // Kartu tanpa nama jurnal (indeks tidak mengirimnya): perbandingan
  // jurnal dilewati, metadata tetap bisa lolos dengan catatan.
  const tanpaJurnal: KandidatVerifikasi = { ...KARTU_IHYA, jurnal: undefined };
  const h = bandingkanDenganRekod(tanpaJurnal, REKOD_IHYA);
  cek("kartu tanpa jurnal: lolos dengan catatan", h.status === "lolos" && h.alasan.includes("tidak membawa nama jurnal"), h.alasan);
  // Rekod tanpa nama jurnal padahal kartu membawanya: belum terverifikasi.
  const rekodPolos: RekodCrossref = { ...REKOD_IHYA, jurnal: undefined };
  cek(
    "rekod tanpa jurnal: belum-terverifikasi",
    bandingkanDenganRekod(KARTU_IHYA, rekodPolos).status === "belum-terverifikasi",
  );
}

console.log(`\nHASIL: ${lulus} PASS, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
