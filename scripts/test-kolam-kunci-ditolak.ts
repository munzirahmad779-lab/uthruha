// Uji Paket C (perbaikan laporan QA agen penguji 6 Nov 2026):
// kunci pribadi mahasiswa yang tidak sah harus menghasilkan galat
// yang JELAS (kode KUNCI_PRIBADI_DITOLAK + pesan mengarahkan ke
// /kunci), bukan permintaan mencoba lagi. Yang diuji di sini adalah
// pengklasifikasi murni di lib/server/kolam.ts dan keberadaan
// penjagaan pada rute serta jalur Generate; panggilan penyedia
// sungguhan tidak dijalankan (suite repo berjalan tanpa jaringan).
import { readFileSync } from "node:fs";
import {
  adalahPenolakanKunci,
  galatKunciPribadiDitolak,
  labelPinjaman,
  KODE_KUNCI_PRIBADI_DITOLAK,
  PESAN_KUNCI_PRIBADI_DITOLAK,
} from "../lib/server/kolam";

let lulus = 0;
let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

// Pengklasifikasi penolakan kunci.
cek("401 adalah penolakan kunci", adalahPenolakanKunci(401) === true);
cek("403 adalah penolakan kunci", adalahPenolakanKunci(403) === true);
cek(
  "400 + API_KEY_INVALID (bentuk Gemini) adalah penolakan kunci",
  adalahPenolakanKunci(400, "API_KEY_INVALID") === true,
);
cek("API_KEY_INVALID tanpa status tetap penolakan", adalahPenolakanKunci(undefined, "API_KEY_INVALID") === true);
cek("429 kuota BUKAN penolakan kunci", adalahPenolakanKunci(429) === false);
cek("400 tanpa kode penyedia BUKAN penolakan kunci", adalahPenolakanKunci(400) === false);
cek("500 gangguan BUKAN penolakan kunci", adalahPenolakanKunci(500) === false);

// Penanda pinjaman: sukses pinjaman tidak menyamar sebagai kunci sendiri.
cek("label mahasiswa lain adalah pinjaman", labelPinjaman("gemini-pribadi-u2", "u1") === true);
cek("label sendiri bukan pinjaman", labelPinjaman("gemini-pribadi-u1", "u1") === false);
cek("label kolam biasa bukan pinjaman", labelPinjaman("gemini#1", "u1") === false);
cek("label premium bukan pinjaman", labelPinjaman("groq-premium#1", "u1") === false);
cek("label pinjaman groq terbaca", labelPinjaman("groq-pribadi-u9", "u1") === true);

// Bentuk galat berkode dan pesannya.
const galatBerkode = Object.assign(new Error("uji"), { kode: KODE_KUNCI_PRIBADI_DITOLAK });
cek("galat berkode dikenali penjaga rute", galatKunciPribadiDitolak(galatBerkode) === true);
cek("galat biasa tidak dikenali sebagai penolakan kunci", galatKunciPribadiDitolak(new Error("lain")) === false);
cek("null bukan galat penolakan kunci", galatKunciPribadiDitolak(null) === false);
cek(
  "pesan penolakan menunjuk halaman /kunci",
  PESAN_KUNCI_PRIBADI_DITOLAK.includes("/kunci") && PESAN_KUNCI_PRIBADI_DITOLAK.includes("ditolak"),
);

// Penjagaan terpasang pada jalurnya (pola telaah sumber yang sama
// dengan suite tahap lain di repo ini).
const baca = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const ruteGenerate = baca("../app/api/footnote/generate/route.ts");
cek(
  "rute Generate menjawab 403 berkode untuk kunci ditolak",
  ruteGenerate.includes("galatKunciPribadiDitolak") && ruteGenerate.includes("KODE_KUNCI_PRIBADI_DITOLAK"),
);
const ruteKataKunci = baca("../app/api/kata-kunci/route.ts");
cek(
  "rute kata kunci menjawab 403 berkode dan menandai sumber pinjaman",
  ruteKataKunci.includes("KODE_KUNCI_PRIBADI_DITOLAK") && ruteKataKunci.includes("kolam:pinjaman"),
);
const generate = baca("../lib/server/generate-footnote.ts");
cek(
  "jalur Generate membawa jejak kunci dan melempar galat berkode",
  generate.includes("jejak.kunciDitolak") && generate.includes("lemparKunciDitolak") && generate.includes("lewatPinjaman"),
);
const kolam = baca("../lib/server/kolam.ts");
cek(
  "kolam membaca kode API_KEY_INVALID dari badan galat Gemini",
  kolam.includes("API_KEY_INVALID") && kolam.includes("kodePenyedia"),
);

console.log(`\nHASIL: ${lulus} PASS, ${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
