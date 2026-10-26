// Uji strip footnote bagian: penomoran global cocok kompilasi & teks pedoman.
import { footnoteBagian } from "../components/workspace/footnote-bagian";
import { newProject, type Project } from "../lib/engine/project";
import { sumberBaru } from "../lib/engine/cite";
import { pedomanDefault } from "../lib/refs/pedoman";
import { getStruktur } from "../lib/content/struktur";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (!ok) gagal++;
};

const p: Project = newProject({ jenis: "skripsi", metode: "kualitatif", bidangId: "bahasa", judulAr: "بحث" });
p.pedoman = pedomanDefault();
const s1 = { ...sumberBaru("kitab"), id: "src-a", penulis: "النووي، يحيى بن شرف", judul: "المجموع شرح المهذب", kota: "بيروت", penerbit: "دار الفكر", tahun: "1997" };
const s2 = { ...sumberBaru("kitab"), id: "src-b", penulis: "ابن حجر، أحمد بن علي", judul: "فتح الباري", kota: "القاهرة", penerbit: "دار الحديث", tahun: "2001" };
p.sumber = [s1, s2];
const secs = getStruktur("skripsi").chapters.flatMap((c) => c.sections);
const secA = secs[0].id;
const secB = secs[1].id;
p.draf = {
  [secA]: `نص أول في هذا الباب يستند إلى شرح النووي.[[ref:src-a|hlm:137]]`,
  [secB]: `نص ثان يستند إلى فتح الباري.[[ref:src-b|hlm:55]] ويعود إلى النووي أيضا.[[ref:src-a|hlm:137]]`,
};

const daftarA = footnoteBagian(p, secA);
cek("bagian A: 1 footnote", daftarA.length === 1, `${daftarA.length}`);
cek("bagian A: nomor 1 & format pedoman", daftarA[0]?.nomor === "1" && (daftarA[0]?.teks.includes("المجموع شرح المهذب") ?? false), daftarA[0]?.teks);
const daftarB = footnoteBagian(p, secB);
cek("bagian B: 2 footnote (baru + ulangan)", daftarB.length === 2, `${daftarB.length}`);
cek("bagian B: فتح الباري nomor 2", daftarB.find((d) => d.teks.includes("فتح الباري"))?.nomor === "2");
cek("bagian B: ulangan النووي tetap nomor 1", daftarB.find((d) => d.teks.includes("المجموع"))?.nomor === "1");
cek("tanpa penanda mentah di teks strip", daftarB.every((d) => !d.teks.includes("[[ref:")));

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
