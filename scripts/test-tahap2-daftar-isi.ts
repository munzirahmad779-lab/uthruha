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
  susunDaftarIsiOtomatis,
  validasiDaftarIsiOtomatis,
} from "../lib/engine/daftar-isi-pedoman";
import { migrasiProyek, newProject, type Project } from "../lib/engine/project";
import { strukturProyek } from "../lib/content/struktur";

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

console.log(gagal === 0 ? "\nSEMUA PASS" : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
