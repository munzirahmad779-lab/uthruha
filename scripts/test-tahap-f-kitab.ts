/**
 * Uji Tahap F (Aturan Pencarian Valid, lapis kitab): penjaga statis
 * panel Lugawi & Istilahi sesudah standar tunggal ditanam.
 *
 * Yang dijaga (putusan pemilik 5 Nov 2026 15:57, blokir keras penuh):
 *  - F1 panel memeriksa hits "Pemakaian di jurnal" lewat endpoint
 *    verifikasi yang sama dengan jalur jurnal lain
 *    (POST /api/refs/verifikasi-jurnal), bukan saringan lokal saja.
 *  - F2 hanya putusan "terverifikasi" yang membentuk kelompok
 *    pemakaian sah, dan judul kelompok menghitung kelompok itu.
 *  - F3 temuan yang tidak lulus turun ke kelompok terpisah berlabel
 *    putusan (gagal metadata / tidak sesuai bidang / belum
 *    terverifikasi) beserta alasannya.
 *  - F4 panggilan verifikasi yang gagal berarti "belum-terverifikasi"
 *    (gagal tertutup), bukan lolos.
 *  - F5 kesimpulan lugawi hanya menghitung pemakaian jurnal yang
 *    terverifikasi sebagai bukti (adaJurnal dari adaJurnalSah).
 *  - F6 entri "Di kitab" menampilkan keadaan rekod sumbernya:
 *    "Terverifikasi ke rekod sumber" hanya bila tautan rekod bisa
 *    dibuka dan entri tidak bertanda perluVerifikasi; selain itu
 *    berlabel "Belum terverifikasi".
 *  - F7 kueri istilah tunggal Lugawi TIDAK disentuh pengunci frasa
 *    (panel tidak memanggil ketatkanKunciJurnal; itu memang fungsi
 *    panel ini, yang dikunci standarnya adalah hasilnya).
 *
 * TANPA jaringan: suite ini hanya membaca sumber komponen.
 *
 * Jalankan: npx tsx scripts/test-tahap-f-kitab.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

const panel = readFileSync(
  path.join(process.cwd(), "components/workspace/lugawi-panel.tsx"),
  "utf8",
);

cek(
  "F1 panel memeriksa hits jurnal lewat endpoint verifikasi bersama",
  panel.includes('fetch("/api/refs/verifikasi-jurnal"') &&
    panel.includes("periksaJurnalLugawi(jurnalRes.entri)"),
);

cek(
  "F2 kelompok pemakaian sah hanya dari putusan terverifikasi",
  panel.includes('d.status === "terverifikasi"') &&
    panel.includes("Pemakaian di jurnal ({jurnalSah.length})"),
);

cek(
  "F3 temuan tidak lulus periksa turun ke kelompok terpisah berlabel putusan + alasan",
  panel.includes("Temuan jurnal yang tidak lulus periksa") &&
    panel.includes('"gagal-metadata"') &&
    panel.includes('"gagal-bidang"') &&
    panel.includes("Gagal periksa metadata") &&
    panel.includes("Tidak sesuai bidang"),
);

cek(
  "F4 verifikasi yang gagal berjalan = belum-terverifikasi (gagal tertutup)",
  panel.includes("Pemeriksaan tidak dapat berjalan") &&
    panel.includes('status: "belum-terverifikasi"'),
);

cek(
  "F5 kesimpulan hanya menghitung pemakaian jurnal yang terverifikasi",
  panel.includes("adaJurnalSah") && panel.includes("adaJurnal: adaJurnalSah"),
);

cek(
  "F6 label kitab jujur: terverifikasi ke rekod sumber bersyarat tautan + tanpa tanda perlu verifikasi",
  panel.includes("Terverifikasi ke rekod sumber") &&
    panel.includes("kitabTerverifikasi = !h.perluVerifikasi && !!urlSah") &&
    panel.includes("Belum terverifikasi"),
);

cek(
  "F7 kueri istilah tunggal Lugawi tidak disentuh pengunci frasa jurnal",
  !panel.includes("ketatkanKunciJurnal") &&
    panel.includes('sumber: "lugawi-istilahi"'),
);

console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
process.exit(gagal > 0 ? 1 : 0);
