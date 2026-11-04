/**
 * Uji penerimaan Pembangunan Ulang Tahap 2: hapus field topik dan
 * daftar isi otomatis dari judul + pedoman (poin A6, sisa B10).
 * TANPA jaringan dan TANPA model: memakai jalur yang sama dengan wizard
 * (newProject + susunDaftarIsiOtomatis dari TEMPLATE_PEDOMAN),
 * validator gerbangnya, cekKesesuaian, strukturProyek, dan
 * migrasiProyek untuk fixture proyek lama yang masih menyimpan topik.
 * Sebagian pemeriksaan bersifat statis (membaca sumber wizard dan
 * ringkasan) karena penghapusan field adalah fakta kode, bukan
 * perilaku; pemeriksaan itu diberi label [statis] agar tidak terbaca
 * sebagai uji perilaku.
 * Jalankan: npx tsx scripts/test-tahap2-daftar-isi.ts
 */
import { readFileSync } from "node:fs";
import { TEMPLATE_PEDOMAN } from "../lib/pedoman/template-pedoman";
import { strukturKeDaftarIsi } from "../lib/pedoman/skema-struktur";
import { cekKesesuaian } from "../lib/pedoman/cek-kesesuaian";
import {
  dekonstruksiKonsepJudul,
  parseOutlineTempelan,
  susunDaftarIsiOtomatis,
  validasiDaftarIsiOtomatis,
} from "../lib/engine/daftar-isi-pedoman";
import { migrasiProyek, newProject, sanitasiDaftarIsi, type Project } from "../lib/engine/project";
import { strukturProyek } from "../lib/content/struktur";
import { composeSection } from "../lib/engine/compose";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (!ok) gagal++;
};

const mangkoso = TEMPLATE_PEDOMAN.find((t) => /mangkoso/i.test(t.namaPedoman))!;
const asadiyah = TEMPLATE_PEDOMAN.find((t) => /as'adiyah/i.test(t.namaPedoman))!;
cek("kedua template permanen ada", !!mangkoso && !!asadiyah);

const RUMUSAN = [
  "ما مفهوم التكامل المعرفي عند أمبو دالي؟",
  "كيف يطبق التكامل بين علوم القرآن وأصول الفقه في مرشد الطلاب؟",
  "ما أثر التكامل المعرفي في تعليم العلوم الشرعية؟",
];

/* ---------- Dekonstruksi konsep judul ---------- */
const JUDUL_USER_AR = "أثر أصول الفقه في الحياة المعاصرة";
const JUDUL_USER_ID = "Pengaruh Ushul Fiqh dalam Kehidupan";
const konsepAr = dekonstruksiKonsepJudul(JUDUL_USER_AR);
cek(
  "Dekonstruksi Arab: konsep utama أصول الفقه, konteks الحياة المعاصرة",
  konsepAr.konsep[0]?.teks === "أصول الفقه" && konsepAr.konsep[1]?.teks === "الحياة المعاصرة",
  konsepAr.konsep.map((k) => k.teks).join(" | "),
);
cek(
  "Dekonstruksi Arab: label relasi terbaca dari judul",
  konsepAr.relasiAr === "أثر أصول الفقه في الحياة المعاصرة" && konsepAr.relasiId.startsWith("Pengaruh"),
  konsepAr.relasiAr,
);
const konsepId = dekonstruksiKonsepJudul(JUDUL_USER_ID);
cek(
  "Dekonstruksi Indonesia: konsep Ushul Fiqh + Kehidupan dari judul contoh pemilik",
  konsepId.konsep[0]?.teks === "Ushul Fiqh" && konsepId.konsep[1]?.teks === "Kehidupan",
  konsepId.konsep.map((k) => k.teks).join(" | "),
);
const konsepBayna = dekonstruksiKonsepJudul("التكامل المعرفي بين علوم القرآن وأصول الفقه");
cek(
  "Dekonstruksi pola بين: dua domain terbaca",
  konsepBayna.konsep.some((k) => k.teks === "علوم القرآن") &&
    konsepBayna.konsep.some((k) => k.teks === "أصول الفقه"),
  konsepBayna.konsep.map((k) => k.teks).join(" | "),
);
cek("Dekonstruksi judul kosong: tanpa konsep, tanpa lempar", dekonstruksiKonsepJudul("").konsep.length === 0);
cek("Dekonstruksi judul satu kata: satu konsep utuh", dekonstruksiKonsepJudul("البلاغة").konsep[0]?.teks === "البلاغة");

/* ---------- Mangkoso + judul contoh pemilik (Arab) ---------- */
const hasilMk = susunDaftarIsiOtomatis(mangkoso, JUDUL_USER_AR);
cek("Mangkoso: generasi dari judul terpasang (dariJudul)", hasilMk.dariJudul === true);
cek("Mangkoso: daftar isi tetap 5 bab", hasilMk.daftar.length === 5, `${hasilMk.daftar.length}`);
cek(
  "Mangkoso: ikatan bab 2/3/4 ke isykal 1/2/3 utuh",
  hasilMk.daftar[1]?.isykalKe === 1 && hasilMk.daftar[2]?.isykalKe === 2 && hasilMk.daftar[3]?.isykalKe === 3,
);
const bab2Mk = hasilMk.daftar[1]!;
cek(
  "Mangkoso: Bab 2 membuka dengan definisi bahasa dan istilah konsep judul (pola contoh pemilik)",
  (bab2Mk.sections[0]?.labelAr ?? "").includes("أصول الفقه") &&
    (bab2Mk.sections[0]?.labelAr ?? "").includes("اصطلاحًا") &&
    (bab2Mk.sections[0]?.labelId ?? "").includes("bahasa dan istilah"),
  bab2Mk.sections[0]?.labelAr,
);
cek(
  "Mangkoso: sub-bab definisi membawa rincian bahasa dan istilah (anak)",
  (bab2Mk.sections[0]?.anak?.length ?? 0) === 2 &&
    bab2Mk.sections[0]!.anak!.some((a) => a.labelAr.includes("اللغوي")) &&
    bab2Mk.sections[0]!.anak!.some((a) => a.labelAr.includes("الاصطلاحي")),
);
cek(
  "Mangkoso: sub-bab relasi antar konsep hadir di bab isi",
  bab2Mk.sections.some((s) => s.labelAr === "أثر أصول الفقه في الحياة المعاصرة"),
);
cek(
  "Mangkoso: perancah jawaban isykal template dipertahankan di ujung bab isi",
  bab2Mk.sections[bab2Mk.sections.length - 1]?.labelId === "Jawaban Isykal Pertama",
);
cek(
  "Mangkoso: validator gerbang bersih",
  validasiDaftarIsiOtomatis(hasilMk.daftar, mangkoso).length === 0,
  validasiDaftarIsiOtomatis(hasilMk.daftar, mangkoso).join(" | "),
);

const pMk = newProject({
  bidangId: "fiqh-ushul",
  judulAr: JUDUL_USER_AR,
  rumusan: RUMUSAN,
  strukturPedoman: mangkoso,
  daftarIsi: hasilMk.daftar,
  daftarIsiDariJudul: true,
});
cek("Proyek Mangkoso: proyek baru tanpa topik (topikAr kosong)", pMk.topikAr === "");
cek(
  "Cek kesesuaian: hasil generasi tanpa tanda WAJIB",
  !cekKesesuaian(pMk).some((t) => t.tingkat === "wajib"),
  cekKesesuaian(pMk).filter((t) => t.tingkat === "wajib").map((t) => t.pesan).join(" | ").slice(0, 200),
);
const bab2Gen = strukturProyek(pMk).chapters.find((c) => c.id === "bab-pedoman-2");
cek(
  "Generasi isi: sub-bab definisi Bab 2 ikut struktur dan membaca isykal 1",
  !!bab2Gen && bab2Gen.sections.some((s) => s.labelAr.includes("لغةً واصطلاحًا") && s.panduan.includes(RUMUSAN[0]!)),
);

/* ---------- Mangkoso + judul contoh pemilik (Indonesia persis) ---------- */
const hasilId = susunDaftarIsiOtomatis(mangkoso, JUDUL_USER_ID);
cek(
  "Judul Indonesia pemilik: Bab 2 memuat sub-bab definisi Ushul Fiqh bahasa dan istilah",
  hasilId.dariJudul === true &&
    (hasilId.daftar[1]?.sections[0]?.labelId ?? "").includes("Ushul Fiqh") &&
    (hasilId.daftar[1]?.sections[0]?.labelId ?? "").includes("bahasa dan istilah"),
  hasilId.daftar[1]?.sections[0]?.labelId,
);
cek(
  "Judul Indonesia pemilik: validator bersih dan ikatan utuh",
  validasiDaftarIsiOtomatis(hasilId.daftar, mangkoso).length === 0 && hasilId.daftar[1]?.isykalKe === 1,
);

/* ---------- As'adiyah: unsur wajib panduan tidak bergeser ---------- */
const JUDUL_AS = "تفسير آيات الأحكام عند الزحيلي";
const hasilAs = susunDaftarIsiOtomatis(asadiyah, JUDUL_AS);
const dasarAs = strukturKeDaftarIsi(asadiyah);
cek("As'adiyah: generasi dari judul terpasang", hasilAs.dariJudul === true);
cek(
  "As'adiyah: Bab 2 membuka dengan definisi konsep judul, sub-bab wajib panduan menyusul utuh",
  (hasilAs.daftar[1]?.sections[0]?.labelAr ?? "").includes("اصطلاحًا") &&
    hasilAs.daftar[1]?.sections.some((s) => s.labelId === "Prinsip dan Teori") &&
    hasilAs.daftar[1]?.sections.some((s) => s.labelId === "Diskusi Akademik Studi Kepustakaan"),
  hasilAs.daftar[1]?.sections.map((s) => s.labelId).join(" | "),
);
cek(
  "As'adiyah: Bab 1, 3, 4, 5 persis template (tidak ditambah-tambahi)",
  [0, 2, 3, 4].every((i) =>
    hasilAs.daftar[i]!.sections.every(
      (s, j) => s.id === dasarAs[i]!.sections[j]?.id && s.labelId === dasarAs[i]!.sections[j]?.labelId,
    ) && hasilAs.daftar[i]!.sections.length === dasarAs[i]!.sections.length,
  ),
);
cek("As'adiyah: validator bersih", validasiDaftarIsiOtomatis(hasilAs.daftar, asadiyah).length === 0);
const pAs = newProject({
  bidangId: "tafsir",
  judulAr: JUDUL_AS,
  rumusan: RUMUSAN.slice(0, 2),
  strukturPedoman: asadiyah,
  daftarIsi: hasilAs.daftar,
  daftarIsiDariJudul: true,
});
cek(
  "As'adiyah: cek kesesuaian tanpa tanda WAJIB",
  !cekKesesuaian(pAs).some((t) => t.tingkat === "wajib"),
  cekKesesuaian(pAs).filter((t) => t.tingkat === "wajib").map((t) => t.pesan).join(" | ").slice(0, 200),
);

/* ---------- Keadaan gagal: jatuh ke template, pembuatan proyek tidak gagal ---------- */
const hasilKosong = susunDaftarIsiOtomatis(mangkoso, "");
cek(
  "Judul kosong: proyeksi template murni, dariJudul false",
  hasilKosong.dariJudul === false &&
    JSON.stringify(hasilKosong.daftar) === JSON.stringify(strukturKeDaftarIsi(mangkoso)),
);
const hasilAneh = susunDaftarIsiOtomatis(mangkoso, "123 !?");
cek(
  "Judul tak terbaca: tidak melempar, hasil lolos validator",
  validasiDaftarIsiOtomatis(hasilAneh.daftar, mangkoso).length === 0,
);

/* ---------- Validator menolak pelanggaran (gerbang bekerja dua arah) ---------- */
const rusakWajib: Project["daftarIsi"] = hasilAs.daftar.map((b) =>
  b.id === "bab-pedoman-2"
    ? { ...b, sections: b.sections.filter((s) => s.labelId !== "Prinsip dan Teori") }
    : b,
);
cek(
  "Validator: sub-bab wajib yang dibuang tertangkap",
  validasiDaftarIsiOtomatis(rusakWajib!, asadiyah).some((g) => g.includes("Prinsip dan Teori")),
);
const rusakIkatan: Project["daftarIsi"] = hasilMk.daftar.map((b) =>
  b.id === "bab-pedoman-3" ? { ...b, isykalKe: undefined } : b,
);
cek(
  "Validator: ikatan isykal yang putus tertangkap",
  validasiDaftarIsiOtomatis(rusakIkatan!, mangkoso).some((g) => g.includes("ikatan isykal 2")),
);
const rusakAturan: Project["daftarIsi"] = hasilMk.daftar.map((b) =>
  b.id === "bab-pedoman-2" ? { ...b, aturan: [] } : b,
);
cek(
  "Validator: aturan pedoman yang dibuang tertangkap",
  validasiDaftarIsiOtomatis(rusakAturan!, mangkoso).some((g) => g.includes("aturan pedoman")),
);

/* ---------- Field topik: hilang dari wizard dan ringkasan [statis] ---------- */
const sumberWizard = readFileSync(new URL("../app/mulai/page.tsx", import.meta.url), "utf8");
cek("[statis] Wizard: tidak ada lagi rujukan topikAr", !sumberWizard.includes("topikAr"));
cek(
  "[statis] Wizard: gerbang langkah data terikat pada judul",
  sumberWizard.includes("judulAr.trim().length > 2") && sumberWizard.includes("Isi judul penelitian dulu"),
);
const sumberOverview = readFileSync(
  new URL("../components/workspace/overview.tsx", import.meta.url),
  "utf8",
);
cek("[statis] Ringkasan: kolom edit topik hilang", !sumberOverview.includes("topikAr"));

/* ---------- Proyek lama bertopik: terbuka utuh, nilai tidak dibuang ---------- */
const fixtureTopik = {
  id: "p-fixture-topik",
  versiSkema: 2,
  dibuat: "2026-11-02T00:00:00.000Z",
  diperbarui: "2026-11-02T00:00:00.000Z",
  jenis: "skripsi",
  metode: "kualitatif",
  bidangId: "lughah",
  bahasa: "ar",
  judulAr: "",
  topikAr: "تعليم اللغة العربية في المعاهد الإسلامية",
  lokasi: "معهد دار المعارف",
  populasi: "",
  fenomenaAr: "",
  rumusan: RUMUSAN.slice(0, 2),
  tujuan: [],
  istilah: [],
  jawaban: {},
  draf: { khalfiya: "Draf lama bertopik yang tidak boleh hilang atau berubah saat proyek dibuka." },
  sumber: [],
  catatan: "",
};
let pTopik: Project | null = null;
let migrasiOk = true;
try {
  pTopik = migrasiProyek(JSON.parse(JSON.stringify(fixtureTopik)));
} catch {
  migrasiOk = false;
}
cek("Proyek lama bertopik: migrasi tidak melempar", migrasiOk);
cek(
  "Proyek lama bertopik: nilai topikAr warisan dipertahankan (tidak dibuang diam-diam)",
  pTopik?.topikAr === "تعليم اللغة العربية في المعاهد الإسلامية",
);
cek(
  "Proyek lama bertopik: draf utuh dan struktur bawaan terbentuk",
  (pTopik?.draf.khalfiya ?? "").includes("tidak boleh hilang") &&
    strukturProyek(pTopik!).chapters.length > 0,
);

/* ---------- Putaran simpan-muat hasil generasi ---------- */
const pPutaran = migrasiProyek(JSON.parse(JSON.stringify(pMk)));
cek(
  "Putaran simpan-muat: penanda dariJudul dan sub-bab definisi beserta anaknya bertahan",
  pPutaran.daftarIsiDariJudul === true &&
    (pPutaran.daftarIsi?.[1]?.sections[0]?.anak?.length ?? 0) === 2 &&
    pPutaran.daftarIsi?.[1]?.isykalKe === 1,
);

/* ---------- Perbaikan telaah Tahap 2: S1 (compose tanpa placeholder) ---------- */
const hududBaru = composeSection(pMk, "hudud").markdown;
cek(
  "S1: batasan objektif proyek baru memakai judul, bukan placeholder topik",
  !hududBaru.includes("[موضوع البحث]") && hududBaru.includes(JUDUL_USER_AR),
);
const itharFikriBaru = composeSection(pMk, "itharFikri").markdown;
cek(
  "S1: variabel kerangka proyek baru memakai judul, bukan placeholder topik",
  !itharFikriBaru.includes("[موضوع البحث]") && itharFikriBaru.includes(JUDUL_USER_AR),
);
const farudhBaru = composeSection(pMk, "farudhiyat").markdown;
cek(
  "S1: hipotesis proyek baru memakai judul, bukan placeholder variabel",
  !farudhBaru.includes("[المتغير المستقل]") && farudhBaru.includes(JUDUL_USER_AR),
);

/* ---------- Perbaikan telaah Tahap 2: S2 (definisi hanya di bab terikat pertama) ---------- */
cek(
  "S2: Bab 3 dan 4 membuka dengan perancah jawaban isykalnya, bukan blok definisi",
  hasilId.daftar[2]?.sections[0]?.labelId === "Jawaban Isykal Kedua" &&
    hasilId.daftar[3]?.sections[0]?.labelId === "Jawaban Isykal Ketiga",
  `${hasilId.daftar[2]?.sections[0]?.labelId} | ${hasilId.daftar[3]?.sections[0]?.labelId}`,
);
cek(
  "S2: tidak ada sub-bab definisi konsep di Bab 3 dan 4",
  ![...(hasilId.daftar[2]?.sections ?? []), ...(hasilId.daftar[3]?.sections ?? [])].some((s) =>
    s.labelId.startsWith("Definisi"),
  ),
);
cek(
  "S2: tiga bab terikat tidak lagi berawalan identik",
  new Set([
    hasilId.daftar[1]?.sections[0]?.labelId,
    hasilId.daftar[2]?.sections[0]?.labelId,
    hasilId.daftar[3]?.sections[0]?.labelId,
  ]).size === 3,
);
cek(
  "S2: Bab 2 tetap membawa blok definisi dan sub-bab relasi judul",
  (hasilId.daftar[1]?.sections[0]?.labelId ?? "").includes("Definisi Ushul Fiqh") &&
    hasilId.daftar[1]!.sections.some((s) => s.labelId === "Pengaruh Ushul Fiqh dalam Kehidupan"),
);
cek(
  "S2: hasil susunan judul Indonesia tetap lolos validator",
  validasiDaftarIsiOtomatis(hasilId.daftar, mangkoso).length === 0,
  validasiDaftarIsiOtomatis(hasilId.daftar, mangkoso).join(" | "),
);

/* ---------- Perbaikan telaah Tahap 2: S3 (dua pola judul Indonesia) ---------- */
const JUDUL_METODE = "Penerapan Metode Diskusi dalam Pembelajaran Bahasa Arab di Madrasah Aliyah Negeri 1 Barru";
const konsepMetode = dekonstruksiKonsepJudul(JUDUL_METODE);
cek(
  "S3: metode-di-lokasi: konsepnya Metode Diskusi + Pembelajaran Bahasa Arab, lokasi bukan konsep",
  konsepMetode.konsep[0]?.teks === "Metode Diskusi" &&
    konsepMetode.konsep[1]?.teks === "Pembelajaran Bahasa Arab" &&
    !konsepMetode.konsep.some((k) => /madrasah/i.test(k.teks)),
  konsepMetode.konsep.map((k) => k.teks).join(" | "),
);
cek(
  "S3: metode-di-lokasi: label relasi memakai objek kajian, bukan lokasi",
  konsepMetode.relasiId === "Penerapan Metode Diskusi dalam Pembelajaran Bahasa Arab",
  konsepMetode.relasiId,
);
const JUDUL_HUBUNGAN = "Hubungan antara Kecerdasan Emosional dengan Prestasi Belajar Santri";
const konsepHub = dekonstruksiKonsepJudul(JUDUL_HUBUNGAN);
cek(
  "S3: pola antara...dengan terbelah menjadi dua konsep",
  konsepHub.konsep[0]?.teks === "Kecerdasan Emosional" &&
    konsepHub.konsep[1]?.teks === "Prestasi Belajar Santri",
  konsepHub.konsep.map((k) => k.teks).join(" | "),
);
cek(
  "S3: pola antara...dengan: label relasi setia pada redaksi judul",
  konsepHub.relasiId === "Hubungan Kecerdasan Emosional dengan Prestasi Belajar Santri",
  konsepHub.relasiId,
);
const hasilMetode = susunDaftarIsiOtomatis(mangkoso, JUDUL_METODE);
cek(
  "S3: daftar isi judul metode: definisi kedua adalah objek kajian, tidak ada definisi nama sekolah",
  hasilMetode.dariJudul === true &&
    (hasilMetode.daftar[1]?.sections[1]?.labelId ?? "").includes("Pembelajaran Bahasa Arab") &&
    !hasilMetode.daftar.flatMap((b) => b.sections).some((s) => s.labelId.includes("Madrasah Aliyah")),
  hasilMetode.daftar[1]?.sections.map((s) => s.labelId).join(" | "),
);
cek(
  "S3: daftar isi judul metode lolos validator",
  validasiDaftarIsiOtomatis(hasilMetode.daftar, mangkoso).length === 0,
  validasiDaftarIsiOtomatis(hasilMetode.daftar, mangkoso).join(" | "),
);

/* ---------- Perbaikan telaah Tahap 2: S4 + ringan R1/R2 (validator) ---------- */
const rusakAturanIsi: Project["daftarIsi"] = hasilMk.daftar.map((b) =>
  b.id === "bab-pedoman-2"
    ? { ...b, aturan: (b.aturan ?? []).map(() => "ATURAN PALSU TANPA DASAR PEDOMAN") }
    : b,
);
cek(
  "S4: aturan yang diganti isinya dengan jumlah sama tertangkap validator",
  validasiDaftarIsiOtomatis(rusakAturanIsi!, mangkoso).some((g) => g.includes("aturan pedoman")),
);
const rusakNama: Project["daftarIsi"] = hasilMk.daftar.map((b) =>
  b.id === "bab-pedoman-2" ? { ...b, labelId: "BAB KARANGAN BEBAS" } : b,
);
cek(
  "R1: nama bab yang diganti tertangkap validator",
  validasiDaftarIsiOtomatis(rusakNama!, mangkoso).some((g) => g.includes("berganti nama")),
);
const rusakPerancah: Project["daftarIsi"] = hasilMk.daftar.map((b) =>
  b.id === "bab-pedoman-2"
    ? { ...b, sections: b.sections.filter((s) => s.labelId !== "Jawaban Isykal Pertama") }
    : b,
);
cek(
  "R2: perancah jawaban isykal yang dibuang dari bab terikat tertangkap validator",
  validasiDaftarIsiOtomatis(rusakPerancah!, mangkoso).some((g) => g.includes("Jawaban Isykal Pertama")),
);

/* ---------- Perbaikan telaah Tahap 2: R5 (penanda editor) [statis] ---------- */
const sumberEditor = readFileSync(
  new URL("../components/workspace/daftar-isi-editor.tsx", import.meta.url),
  "utf8",
);
cek(
  "[statis] R5: jalur edit manual editor menurunkan penanda dariJudul",
  sumberEditor.includes("ubah({ daftarIsi: next, daftarIsiDariJudul: false })"),
);
cek(
  "[statis] R5: tombol struktur bawaan editor menurunkan penanda dariJudul",
  sumberEditor.includes("daftarIsi: susunDaftarIsiBawaan(p), daftarIsiDariJudul: false"),
);

/* ---------- Tahap 2 S5: kedalaman daftar isi tiga tingkat (A / 1 / a) ---------- */
const defMk = hasilMk.daftar[1]!.sections[0]!;
const anakBahasaMk = defMk.anak?.find((a) => a.id.endsWith("-bahasa"));
const anakIstilahMk = defMk.anak?.find((a) => a.id.endsWith("-istilah"));
cek(
  "S5: generasi Arab: rincian istilah membawa dua sub-rincian (para ahli + kesimpulan)",
  (anakIstilahMk?.anak?.length ?? 0) === 2 &&
    anakIstilahMk!.anak!.some((c) => c.labelId.includes("para ahli")) &&
    anakIstilahMk!.anak!.some((c) => c.labelId.includes("Kesimpulan")),
  anakIstilahMk?.anak?.map((c) => c.labelId).join(" | "),
);
cek(
  "S5: generasi Arab: rincian bahasa dipecah per kata penyusun konsep (أصول + الفقه)",
  (anakBahasaMk?.anak?.length ?? 0) === 2 &&
    anakBahasaMk!.anak!.some((c) => c.labelAr.includes("أصول")) &&
    anakBahasaMk!.anak!.some((c) => c.labelAr.includes("الفقه")),
  anakBahasaMk?.anak?.map((c) => c.labelAr).join(" | "),
);
const defIdS5 = hasilId.daftar[1]!.sections[0]!;
cek(
  "S5: generasi Indonesia contoh pemilik: sub-rincian bahasa per kata (Ushul + Fiqh), istilah lengkap",
  (defIdS5.anak?.[0]?.anak?.length ?? 0) === 2 &&
    defIdS5.anak![0]!.anak!.some((c) => c.labelId.includes("Ushul")) &&
    defIdS5.anak![0]!.anak!.some((c) => c.labelId.includes("Fiqh")) &&
    (defIdS5.anak?.[1]?.anak?.length ?? 0) === 2,
  defIdS5.anak?.map((a) => `${a.labelId}[${a.anak?.length ?? 0}]`).join(" | "),
);
const hasilSatuKata = susunDaftarIsiOtomatis(mangkoso, "البلاغة");
const defSatuKata = hasilSatuKata.daftar[1]?.sections[0];
cek(
  "S5: konsep satu kata: bahasa tidak dipecah, istilah tetap membawa dua sub-rincian",
  hasilSatuKata.dariJudul === true &&
    (defSatuKata?.anak?.[0]?.anak?.length ?? 0) === 0 &&
    (defSatuKata?.anak?.[1]?.anak?.length ?? 0) === 2,
);
cek(
  "S5: hasil generasi bertingkat tiga lolos validator (skema rekursif + penjagaan tingkat)",
  validasiDaftarIsiOtomatis(hasilMk.daftar, mangkoso).length === 0 &&
    validasiDaftarIsiOtomatis(hasilId.daftar, mangkoso).length === 0,
  validasiDaftarIsiOtomatis(hasilMk.daftar, mangkoso).join(" | "),
);
const rusakTingkat4: Project["daftarIsi"] = hasilMk.daftar.map((b) =>
  b.id === "bab-pedoman-2"
    ? {
        ...b,
        sections: b.sections.map((s, si) =>
          si === 0
            ? {
                ...s,
                anak: (s.anak ?? []).map((a) =>
                  a.id.endsWith("-istilah")
                    ? {
                        ...a,
                        anak: (a.anak ?? []).map((c, ci) =>
                          ci === 0
                            ? { ...c, anak: [{ id: "selundupan-4", labelId: "Tingkat Keempat", labelAr: "" }] }
                            : c,
                        ),
                      }
                    : a,
                ),
              }
            : s,
        ),
      }
    : b,
);
cek(
  "S5: validator menolak tingkat keempat yang diselundupkan lewat sub-rincian",
  validasiDaftarIsiOtomatis(rusakTingkat4!, mangkoso).some((g) => g.includes("tingkat keempat")),
  validasiDaftarIsiOtomatis(rusakTingkat4!, mangkoso).join(" | "),
);
const rusakIdGanda: Project["daftarIsi"] = hasilMk.daftar.map((b) =>
  b.id === "bab-pedoman-2"
    ? {
        ...b,
        sections: b.sections.map((s, si) =>
          si === 0
            ? {
                ...s,
                anak: (s.anak ?? []).map((a) =>
                  a.id.endsWith("-istilah")
                    ? { ...a, anak: (a.anak ?? []).map((c) => ({ ...c, id: "id-sama" })) }
                    : a,
                ),
              }
            : s,
        ),
      }
    : b,
);
cek(
  "S5: validator menolak id sub-rincian ganda",
  validasiDaftarIsiOtomatis(rusakIdGanda!, mangkoso).some((g) => g.includes("ganda")),
);
const dataTigaTingkat = [
  {
    id: "bab-uji",
    labelId: "BAB II",
    labelAr: "",
    babAr: "الباب الثاني",
    sections: [
      {
        id: "s1",
        labelId: "Definisi Konsep",
        labelAr: "",
        anak: [
          {
            id: "s1-1",
            labelId: "Pengertian menurut istilah",
            labelAr: "",
            anak: [{ id: "s1-1-a", labelId: "Menurut para ahli", labelAr: "" }],
          },
        ],
      },
    ],
  },
];
cek(
  "S5: sanitasi mempertahankan sub-rincian data sah persis (tidak ada potong senyap)",
  JSON.stringify(sanitasiDaftarIsi(JSON.parse(JSON.stringify(dataTigaTingkat)))) ===
    JSON.stringify(dataTigaTingkat),
);
const dataDuaTingkat = [
  {
    id: "bab-uji",
    labelId: "BAB II",
    labelAr: "",
    babAr: "الباب الثاني",
    sections: [
      {
        id: "s1",
        labelId: "Definisi Konsep",
        labelAr: "",
        anak: [{ id: "s1-1", labelId: "Pengertian menurut istilah", labelAr: "" }],
      },
    ],
  },
];
cek(
  "S5: data lama dua tingkat termuat tanpa perubahan bentuk",
  JSON.stringify(sanitasiDaftarIsi(JSON.parse(JSON.stringify(dataDuaTingkat)))) ===
    JSON.stringify(dataDuaTingkat),
);
const pPutaran3 = migrasiProyek(JSON.parse(JSON.stringify(pMk)));
const defPutaran = pPutaran3.daftarIsi?.[1]?.sections[0];
cek(
  "S5: putaran simpan-muat proyek baru: sub-rincian definisi Bab 2 bertahan utuh",
  (defPutaran?.anak?.[0]?.anak?.length ?? 0) === 2 && (defPutaran?.anak?.[1]?.anak?.length ?? 0) === 2,
  `bahasa ${defPutaran?.anak?.[0]?.anak?.length ?? 0} / istilah ${defPutaran?.anak?.[1]?.anak?.length ?? 0}`,
);
cek(
  "S5: struktur proyek memuat bagian tingkat 3 yang membaca konteks isykal babnya",
  !!bab2Gen &&
    bab2Gen.sections.some(
      (s) => s.tingkat === 3 && s.labelId.includes("para ahli") && s.panduan.includes(RUMUSAN[0]!),
    ),
);
const mdCucu = composeSection(pMk, defMk.anak![1]!.anak![0]!.id).markdown;
cek(
  "S5: susunan naskah memberi judul tingkat #### pada sub-rincian",
  mdCucu.startsWith("####"),
  mdCucu.split("\n")[0]?.slice(0, 40),
);
const tempelDalam = parseOutlineTempelan(
  ["BAB II PEMBAHASAN", "  Definisi Ushul Fiqh", "    Pengertian menurut bahasa", "      Makna kata ushul"].join("\n"),
);
cek(
  "S5: parser tempelan: indentasi 6 spasi menjadi sub-rincian",
  tempelDalam?.[0]?.sections[0]?.anak?.[0]?.anak?.[0]?.labelId === "Makna kata ushul",
  tempelDalam?.[0]?.sections[0]?.anak?.[0]?.anak?.map((c) => c.labelId).join(" | "),
);
const tempelNomor = parseOutlineTempelan(
  [
    "BAB II PEMBAHASAN",
    "  2.1 Definisi Ushul Fiqh",
    "    2.1.1 Pengertian menurut bahasa",
    "      a. Makna kata ushul",
    "      b. Makna kata fiqh",
    "      2.1.1.1 Makna terdalam",
  ].join("\n"),
);
cek(
  "S5: parser tempelan: penanda a./b. dan penomoran 2.1.1.1 menjadi sub-rincian",
  (tempelNomor?.[0]?.sections[0]?.anak?.[0]?.anak?.length ?? 0) === 3 &&
    tempelNomor![0]!.sections[0]!.anak![0]!.anak!.some((c) => c.labelId === "Makna terdalam"),
  tempelNomor?.[0]?.sections[0]?.anak?.[0]?.anak?.map((c) => c.labelId).join(" | "),
);
cek(
  "[statis] S5: editor menyediakan tambah/sunting/pindah/hapus sub-rincian lewat jalur terapkan",
  sumberEditor.includes("function tambahCucu") &&
    sumberEditor.includes("function ubahCucu") &&
    sumberEditor.includes("function pindahCucu") &&
    sumberEditor.includes("function hapusCucu") &&
    sumberEditor.includes("+ Rincian"),
);

console.log(gagal === 0 ? "\nSEMUA PASS" : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
