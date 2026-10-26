// Uji logika murni panel Lugawi & Istilahi.
import {
  mengandungArab, padananArabDari, etimologiDari, simpulkanLugawi, promptMuseLugawi,
} from "../lib/engine/lugawi";

let gagal = 0;
const cek = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!ok) gagal++; };

cek("deteksi Arab", mengandungArab("بوفية") && !mengandungArab("bufiyah"));
const mentah = [
  "== Arabic ==", "", "=== Etymology ===", "From French buffet (“sideboard”).",
  "=== Noun ===", "بُوفِيَّة • (būfiyya) f", "", "==== Translations ====", "buffet: Arabic: بوفية (būfiyya)",
].join("\n");
cek("etimologi terpotong rapi", etimologiDari(mentah).includes("French buffet"), etimologiDari(mentah));
cek("padanan Arab tertangkap", padananArabDari(mentah) === "بوفية", String(padananArabDari(mentah)));
cek("tanpa padanan → null", padananArabDari("tidak ada terjemahan") === null);
cek("simpulan di-kitab", simpulkanLugawi({ adaKitab: true, adaKamus: false, adaPadanan: false, adaJurnal: false }).tingkat === "di-kitab");
cek("simpulan padanan", simpulkanLugawi({ adaKitab: false, adaKamus: false, adaPadanan: true, adaJurnal: false }).tingkat === "ada-padanan");
cek("simpulan jurnal saja → padanan", simpulkanLugawi({ adaKitab: false, adaKamus: false, adaPadanan: false, adaJurnal: true }).tingkat === "ada-padanan");
cek("simpulan kosong", simpulkanLugawi({ adaKitab: false, adaKamus: false, adaPadanan: false, adaJurnal: false }).tingkat === "tidak-ditemukan");
const pr = promptMuseLugawi("bufiyah");
cek("prompt memuat kata + lugawi/istilahi + kitab klasik", pr.includes("bufiyah") && pr.includes("LUGHAWI") && pr.includes("لسان العرب"));

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
