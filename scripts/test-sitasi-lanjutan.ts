// Uji lanjutan sitasi: pangkas slot kosong, bentuk singkat, pemeriksa sitasi.
import { footnotePedoman, daftarPustakaPedoman } from "../lib/engine/citation";
import { kompilasiMarker } from "../lib/engine/marker";
import { composeNaskah } from "../lib/engine/compose";
import { periksaSitasi } from "../lib/engine/periksa-sitasi";
import { newProject, type Project } from "../lib/engine/project";
import { sumberBaru } from "../lib/engine/cite";
import { pedomanDefault } from "../lib/refs/pedoman";
import { getStruktur } from "../lib/content/struktur";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (!ok) gagal++;
};

const pedoman = pedomanDefault();
const nawawi = { ...sumberBaru("kitab"), id: "src-a", penulis: "النووي، يحيى بن شرف", judul: "المجموع شرح المهذب", kota: "بيروت", penerbit: "دار الفكر", tahun: "1997" };

// #1 slot kosong
const fnTanpaJilid = footnotePedoman(nawawi, pedoman, { halaman: "137" });
cek("#1 footnote tanpa jilid: tidak ada label ج menggantung", !/ج\s*[،.]/.test(fnTanpaJilid), fnTanpaJilid);
const fnLengkap = footnotePedoman({ ...nawawi, jilid: "2" }, pedoman, { halaman: "137" });
cek("#1 footnote berjilid tetap memuat ج ٢", fnLengkap.includes("ج ٢"), fnLengkap);
const pusTanpaJilid = daftarPustakaPedoman([nawawi], pedoman)[0] ?? "";
cek("#1 pustaka tanpa jilid bersih", !/\sج\s*[،.]/.test(pusTanpaJilid) && !/\.\./.test(pusTanpaJilid) && pusTanpaJilid.endsWith("١٩٩٧."), pusTanpaJilid);
const fnTanpaKota = footnotePedoman({ ...nawawi, kota: "", penerbit: "" }, pedoman, { halaman: "5" });
cek("#1 kurung kosong hilang", !fnTanpaKota.includes("()") && !fnTanpaKota.includes("(:") , fnTanpaKota);

// #4 bentuk singkat lewat kompilasi
const p: Project = newProject({ jenis: "skripsi", metode: "kualitatif", bidangId: "bahasa", judulAr: "بحث" });
p.pedoman = pedoman;
const s2 = { ...sumberBaru("kitab"), id: "src-b", penulis: "ابن حجر، أحمد بن علي", judul: "فتح الباري", kota: "القاهرة", penerbit: "دار الحديث", tahun: "2001", perluVerifikasi: true };
p.sumber = [nawawi, s2];
const secs = getStruktur("skripsi").chapters.flatMap((c) => c.sections);
p.draf = {
  [secs[0].id]: `نص يستند إلى النووي.[[ref:src-a|hlm:137]]`,
  [secs[1].id]: `نص آخر يعود إلى النووي.[[ref:src-a|hlm:200]] ويستند إلى ابن حجر.[[ref:src-b]] ويشير إلى hilang.[[ref:src-xxx|hlm:1]]`,
};
const hasil = kompilasiMarker(composeNaskah(p), p);
const defs = [...hasil.markdown.matchAll(/^\[\^(\d+)\]: (.*)$/gm)].map((m) => m[2]);
cek("#4 tiga footnote untuk tiga kemunculan dikenal", defs.length >= 3, `${defs.length}`);
cek("#4 kemunculan pertama penuh", (defs[0] ?? "").includes("دار الفكر"), defs[0]);
cek("#4 kemunculan kedua SINGKAT (tanpa penerbit, halaman baru)", (defs[1] ?? "").includes("المجموع") && !(defs[1] ?? "").includes("دار الفكر") && (defs[1] ?? "").includes("٢٠٠"), defs[1]);

// #2 pemeriksa
const periksa = periksaSitasi(p);
const jenis = periksa.masalah.map((m) => m.jenis);
cek("#2 penanda tak dikenal terdeteksi", jenis.includes("tak-dikenal"));
cek("#2 tanpa halaman terdeteksi (src-b)", periksa.masalah.some((m) => m.jenis === "tanpa-halaman" && m.pesan.includes("فتح الباري")));
cek("#2 belum verifikasi terdeteksi (src-b terpakai)", periksa.masalah.some((m) => m.jenis === "belum-verifikasi" && m.pesan.includes("فتح الباري")));
cek("#2 jumlah sitasi dikenal = 3", periksa.jumlahSitasi === 3, String(periksa.jumlahSitasi));
cek("#2 masalah membawa label bagian", periksa.masalah.every((m) => (m.labelBagian ?? "").length > 0));

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
