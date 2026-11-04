/**
 * Uji penerimaan Pembangunan Ulang Tahap 1: struktur bab terikat
 * isykaliyat per pedoman (poin A1, A2 di DAFTAR-CACAT.md).
 * TANPA jaringan dan TANPA model: memakai jalur yang sama dengan wizard
 * (newProject + strukturKeDaftarIsi dari TEMPLATE_PEDOMAN), strukturProyek
 * untuk konteks generasi, cekKesesuaian, dan migrasiProyek untuk fixture
 * proyek lama berformat template lama.
 * Jalankan: npx tsx scripts/test-tahap1-struktur.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { TEMPLATE_PEDOMAN } from "../lib/pedoman/template-pedoman";
import { strukturKeDaftarIsi } from "../lib/pedoman/skema-struktur";
import { cekKesesuaian } from "../lib/pedoman/cek-kesesuaian";
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

/* ---------- Mangkoso: data template dari SPEC ---------- */
cek("Mangkoso: penomoran footnote bersambung", mangkoso.penomoranFootnote === "bersambung");
cek(
  "Mangkoso: ikatan data bab 2/3/4 ke isykal 1/2/3",
  mangkoso.bab[1]!.menjawabIsykal === 1 && mangkoso.bab[2]!.menjawabIsykal === 2 && mangkoso.bab[3]!.menjawabIsykal === 3,
);
const subBab1 = mangkoso.bab[0]!.subBab.map((s) => s.namaAr ?? "");
cek(
  "Mangkoso: Bab 1 memuat التعريف بالموضوع وحدود البحث",
  subBab1.some((a) => a.includes("التعريف بالموضوع وحدود البحث")),
);
cek("Mangkoso: Bab 1 memuat الإطار المفهومي", subBab1.some((a) => a.includes("الإطار المفهومي")));
cek(
  "Mangkoso: Bab 1 memuat definisi istilah pada judul (bukan تعريف العنوان)",
  subBab1.some((a) => a.includes("التعريف بالمصطلحات")),
);
const aturanBab1 = mangkoso.bab[0]!.aturan.map((a) => a.teks).join("\n");
cek("Mangkoso: khalfiyah empat unsur pedoman", aturanBab1.includes("أهمية الموضوع") && aturanBab1.includes("الفائدة منه"));
cek("Mangkoso: khalfiyah tanpa unsur karangan lama", !aturanBab1.includes("pengantar topik, batasan penelitian"));
cek("Mangkoso: dirasah tanpa syarat alasan pemilihan karangan", !aturanBab1.includes("alasan pemilihannya"));
cek("Mangkoso: metode memuat pengujian keabsahan data", aturanBab1.includes("pengujian keabsahan data"));
const semuaAturanMk = mangkoso.bab.flatMap((b) => b.aturan.map((a) => a.teks)).join("\n");
cek("Mangkoso: risalah minimal 150 halaman", semuaAturanMk.includes("tidak kurang dari 150 halaman"));
cek("Mangkoso: proposal minimal 20 halaman", semuaAturanMk.includes("tidak kurang dari 20 halaman"));
cek("Mangkoso: angka 100-150 karangan lama hilang", !semuaAturanMk.includes("tidak lebih dari 150 halaman"));
cek("Mangkoso: aturan bab 4 cadangan karangan hilang", !semuaAturanMk.includes("menjadi pendalaman analisis dan perbandingan"));

/* ---------- Mangkoso: proyek baru lewat jalur wizard ---------- */
const RUMUSAN = [
  "ما مفهوم التكامل المعرفي عند أمبو دالي؟",
  "كيف يطبق التكامل بين علوم القرآن وأصول الفقه في مرشد الطلاب؟",
  "ما أثر التكامل المعرفي في تعليم العلوم الشرعية؟",
];
const pMk = newProject({
  bidangId: "fiqh-ushul",
  judulAr: "التكامل المعرفي بين علوم القرآن وأصول الفقه",
  rumusan: RUMUSAN,
  strukturPedoman: mangkoso,
  daftarIsi: strukturKeDaftarIsi(mangkoso),
});
cek("Proyek Mangkoso: daftar isi 5 bab", pMk.daftarIsi?.length === 5, `${pMk.daftarIsi?.length}`);
cek(
  "Proyek Mangkoso: bab 2/3/4 tercatat menjawab isykal 1/2/3",
  pMk.daftarIsi?.[1]?.isykalKe === 1 && pMk.daftarIsi?.[2]?.isykalKe === 2 && pMk.daftarIsi?.[3]?.isykalKe === 3,
);
cek(
  "Proyek Mangkoso: tujuan dan aturan bab ikut terproyeksi",
  !!pMk.daftarIsi?.[1]?.tujuan && (pMk.daftarIsi?.[1]?.aturan?.length ?? 0) > 0,
);

const strukturMk = strukturProyek(pMk);
const bab2 = strukturMk.chapters.find((c) => c.id === "bab-pedoman-2");
const bab3 = strukturMk.chapters.find((c) => c.id === "bab-pedoman-3");
cek(
  "Generasi: panduan bab 2 memuat teks isykal 1 proyek",
  !!bab2 && bab2.sections.every((s) => s.panduan.includes(RUMUSAN[0]!)),
);
cek(
  "Generasi: panduan bab 3 memuat teks isykal 2 proyek",
  !!bab3 && bab3.sections.every((s) => s.panduan.includes(RUMUSAN[1]!)),
);
const bab1 = strukturMk.chapters.find((c) => c.id === "bab-pedoman-1");
cek(
  "Generasi: bab tanpa ikatan tidak disuntik konteks isykal",
  !!bab1 && bab1.sections.every((s) => !s.panduan.includes("Konteks wajib bab ini")),
);

// Mengganti satu isykal mengubah konteks jawaban bab pasangannya.
const pMkUbah = { ...pMk, rumusan: ["ما حقيقة الإشكال المعدل كليا؟", RUMUSAN[1]!, RUMUSAN[2]!] };
const bab2Ubah = strukturProyek(pMkUbah).chapters.find((c) => c.id === "bab-pedoman-2");
cek(
  "Generasi: isykal 1 diganti, konteks bab 2 ikut berubah",
  !!bab2Ubah && bab2Ubah.sections.every((s) => s.panduan.includes("الإشكال المعدل كليا")),
);

const tandaSehat = cekKesesuaian(pMk);
cek(
  "Cek kesesuaian: proyek template utuh tanpa tanda wajib ikatan",
  !tandaSehat.some((t) => t.tingkat === "wajib" && t.pesan.includes("menjawab isykal")),
  tandaSehat.map((t) => t.pesan).join(" | ").slice(0, 200),
);
const pMkRusak: Project = {
  ...pMk,
  daftarIsi: pMk.daftarIsi!.map((b) => (b.id === "bab-pedoman-3" ? { ...b, isykalKe: undefined } : b)),
};
const tandaRusak = cekKesesuaian(pMkRusak);
cek(
  "Cek kesesuaian: ikatan hilang pada bab 3 tertandai wajib",
  tandaRusak.some((t) => t.tingkat === "wajib" && t.pesan.includes("menjawab isykal 2")),
);
const pMkDua: Project = { ...pMk, rumusan: RUMUSAN.slice(0, 2) };
cek(
  "Cek kesesuaian: rumusan kurang dari ikatan hanya info",
  cekKesesuaian(pMkDua).some((t) => t.tingkat === "info" && t.pesan.includes("terikat pada isykal 3")),
);

/* ---------- As'adiyah: bangun ulang total dari panduan ---------- */
cek("As'adiyah: lima bab", asadiyah.bab.length === 5, `${asadiyah.bab.length}`);
cek(
  "As'adiyah: nama bab persis panduan",
  asadiyah.bab.map((b) => b.namaAr).join("|") ===
    "المقدمة|الإطار النظري والمناقشة الأكاديمية|مجالات الرسالة|الدراسة|الخاتمة",
  asadiyah.bab.map((b) => b.namaAr).join(", "),
);
cek("As'adiyah: penomoran footnote per-bab", asadiyah.penomoranFootnote === "per-bab");
cek(
  "As'adiyah: Bab 1 delapan unsur termasuk المصادر والمراجع",
  asadiyah.bab[0]!.subBab.length === 8 &&
    asadiyah.bab[0]!.subBab.some((s) => (s.namaAr ?? "").includes("المصادر والمراجع")),
);
const aturanAs1 = asadiyah.bab[0]!.aturan.map((a) => a.teks).join("\n");
cek("As'adiyah: dirasah wajib memuat HASIL penelitian terdahulu", aturanAs1.includes("HASIL penelitiannya"));
cek("As'adiyah: tujuan sebanding jumlah pertanyaan", aturanAs1.includes("jumlahnya harus sebanding"));
cek(
  "As'adiyah: tanpa pemetaan satu bab satu isykal karangan",
  asadiyah.bab.every((b) => b.menjawabIsykal === undefined),
);
cek(
  "As'adiyah: bab 3 adalah profil bidang, bukan pembahasan",
  (asadiyah.bab[2]!.tujuan ?? "").includes("bukan tempat menjawab rumusan masalah"),
);
cek(
  "As'adiyah: bab 4 adalah inti risalah",
  (asadiyah.bab[3]!.tujuan ?? "").includes("لب الرسالة"),
);
const semuaAturanAs = asadiyah.bab.flatMap((b) => b.aturan.map((a) => a.teks)).join("\n");
cek("As'adiyah: minimal 40 halaman dan komposisi rujukan 70/30 tercatat", semuaAturanAs.includes("40 halaman") && semuaAturanAs.includes("70 persen"));

const pAs = newProject({
  bidangId: "tafsir",
  rumusan: RUMUSAN.slice(0, 2),
  strukturPedoman: asadiyah,
  daftarIsi: strukturKeDaftarIsi(asadiyah),
});
cek(
  "Proyek As'adiyah: daftar isi 5 bab dengan bab 2/3/4 sesuai panduan",
  pAs.daftarIsi?.length === 5 &&
    pAs.daftarIsi?.[1]?.labelAr === "الإطار النظري والمناقشة الأكاديمية" &&
    pAs.daftarIsi?.[2]?.labelAr === "مجالات الرسالة" &&
    pAs.daftarIsi?.[3]?.labelAr === "الدراسة",
);
cek(
  "Proyek As'adiyah: struktur generasi 5 bab",
  strukturProyek(pAs).chapters.length === 5,
);

/* ---------- Proyek lama: format template lama tetap terbuka ---------- */
// Fixture meniru proyek tersimpan SEBELUM pembangunan ulang: template
// As'adiyah 4 bab karangan lama tanpa penomoranFootnote, daftar isi tanpa
// tujuan/aturan, draf terisi. Harus termigrasi tanpa kehilangan apa pun.
const fixtureLama = {
  id: "p-fixture-lama",
  versiSkema: 2,
  dibuat: "2026-11-01T00:00:00.000Z",
  diperbarui: "2026-11-01T00:00:00.000Z",
  jenis: "skripsi",
  metode: "kualitatif",
  bidangId: "tafsir",
  bahasa: "ar",
  judulAr: "تفسير آيات الأحكام عند الزحيلي",
  topikAr: "",
  lokasi: "",
  populasi: "",
  fenomenaAr: "",
  rumusan: RUMUSAN.slice(0, 2),
  tujuan: [],
  istilah: [],
  jawaban: {},
  draf: { khalfiya: "نص قديم مكتوب من الطالب لا يجوز أن يضيع عند فتح المشروع من جديد." },
  sumber: [],
  catatan: "",
  strukturPedoman: {
    versiSkema: "pedoman-struktur-v1",
    namaPedoman: "Pedoman Penulisan Risalah Ma'had Aly As'adiyah Sengkang",
    bab: [
      { nomor: 1, nama: "Pendahuluan", namaAr: "المقدمة", tujuan: "", subBab: [{ nama: "Latar Belakang", namaAr: "خلفية الرسالة", wajib: true }], aturan: [] },
      { nomor: 4, nama: "Penutup", namaAr: "الخاتمة", tujuan: "", subBab: [{ nama: "Kesimpulan", namaAr: "الخلاصة", wajib: true }], aturan: [] },
    ],
  },
  daftarIsi: [
    {
      id: "bab-pedoman-1", labelId: "Pendahuluan", labelAr: "المقدمة", babAr: "الأول",
      sections: [{ id: "khalfiya", labelId: "Latar Belakang", labelAr: "خلفية الرسالة" }],
    },
    {
      id: "bab-pedoman-2", labelId: "Pembahasan I: Paparan dan Analisis", labelAr: "عرض الموضوع وتحليله", babAr: "الثاني",
      sections: [{ id: "bab-pedoman-2-sub-1", labelId: "Pengantar Bab", labelAr: "تمهيد" }],
    },
    {
      id: "bab-pedoman-4", labelId: "Penutup", labelAr: "الخاتمة", babAr: "الرابع",
      sections: [{ id: "khulasah", labelId: "Kesimpulan", labelAr: "الخلاصة" }],
    },
  ],
};
let migrasiOk = true;
let pLama: Project | null = null;
try {
  pLama = migrasiProyek(JSON.parse(JSON.stringify(fixtureLama)));
} catch {
  migrasiOk = false;
}
cek("Proyek lama: migrasi tidak melempar", migrasiOk);
cek("Proyek lama: daftar isi format lama (bab karangan) tetap utuh", pLama?.daftarIsi?.length === 3 && pLama.daftarIsi[1]?.labelId.includes("Pembahasan I"), `${pLama?.daftarIsi?.length}`);
cek("Proyek lama: draf mahasiswa tidak hilang", (pLama?.draf.khalfiya ?? "").includes("لا يجوز أن يضيع"));
cek("Proyek lama: cek kesesuaian tidak runtuh", (() => { try { return Array.isArray(cekKesesuaian(pLama!)); } catch { return false; } })());
cek("Proyek lama: struktur generasi tetap terbentuk", (() => { try { return strukturProyek(pLama!).chapters.length === 3; } catch { return false; } })());

// Putaran simpan-muat proyek BARU: bidang tambahan tidak boleh dibuang sanitasi.
const pPutaran = migrasiProyek(JSON.parse(JSON.stringify(pMk)));
cek(
  "Putaran simpan-muat: isykalKe, tujuan, aturan bertahan",
  pPutaran.daftarIsi?.[1]?.isykalKe === 1 &&
    !!pPutaran.daftarIsi?.[1]?.tujuan &&
    (pPutaran.daftarIsi?.[1]?.aturan?.length ?? 0) > 0,
);

/* ---------- Penguatan R5 + penanda R3 (tahap verifikasi menyeluruh) ----------
 * Telaah Tahap 1 mencatat sebagian pemeriksaan lama hanya memeriksa
 * keberadaan frasa pada string template. Kelompok ini memeriksa
 * PERILAKU data: bendera wajib, urutan sub-bab, aturan Bab 5, aturan
 * format As'adiyah, dan proyeksi As'adiyah ke proyek. */
cek(
  "R5 Mangkoso: sub-bab jawaban isykal Bab 2/3/4 berstatus wajib false (pagar S1)",
  [1, 2, 3].every((i) => mangkoso.bab[i]!.subBab.every((s) => s.wajib === false)),
);
cek(
  "R5 Mangkoso: seluruh sub-bab Bab 1 dan Bab 5 wajib true",
  mangkoso.bab[0]!.subBab.every((s) => s.wajib === true) &&
    mangkoso.bab[4]!.subBab.every((s) => s.wajib === true),
);
cek(
  "R5 Mangkoso: urutan sub-bab Bab 1 persis urutan template pedoman",
  JSON.stringify(mangkoso.bab[0]!.subBab.map((s) => s.nama)) ===
    JSON.stringify([
      "Latar Belakang Masalah",
      "Pengenalan Topik dan Batasan Penelitian",
      "Rumusan Masalah",
      "Penelitian Terdahulu",
      "Tujuan Penelitian",
      "Manfaat Penelitian",
      "Definisi Istilah pada Judul",
      "Metode Penelitian",
      "Kerangka Konseptual",
      "Sistematika Pembahasan",
    ]),
);
const aturanBab5Mk = mangkoso.bab[4]!.aturan;
cek(
  "R5 Mangkoso Bab 5: aturan footnote bersambung dan kelompok wawancara wajib true",
  aturanBab5Mk.some((a) => a.teks.includes("BERSAMBUNG") && a.wajib === true) &&
    aturanBab5Mk.some((a) => a.teks.includes("wawancara") && a.wajib === true),
);
cek(
  "R5 As'adiyah: lima bab, seluruh sub-bab wajib true, urutan Bab 1 tetap",
  asadiyah.bab.length === 5 &&
    asadiyah.bab.every((b) => b.subBab.every((s) => s.wajib === true)) &&
    asadiyah.bab[0]!.subBab[0]!.nama === "Latar Belakang" &&
    asadiyah.bab[0]!.subBab[7]!.nama === "Sumber dan Rujukan",
);
const aturanAsdSemua = asadiyah.bab.flatMap((b) => b.aturan);
cek(
  "R5 As'adiyah: aturan format Sakkal Majalla 16 Exactly 24 pt hadir dan wajib",
  aturanAsdSemua.some(
    (a) =>
      a.teks.includes("Sakkal Majalla 16") &&
      a.teks.includes("Exactly 24 pt") &&
      a.teks.includes("margin kanan 4 cm") &&
      a.wajib === true,
  ),
);
const proyeksiAsd = strukturKeDaftarIsi(asadiyah);
cek(
  "R5 As'adiyah: proyeksi membawa tujuan dan aturan tiap bab ke daftar isi proyek",
  proyeksiAsd.length === 5 &&
    proyeksiAsd.every((b) => !!b.tujuan && (b.aturan?.length ?? 0) > 0) &&
    proyeksiAsd.every((b) => b.labelAplikasi !== true),
);
cek(
  "R3 Mangkoso: penanda labelAplikasi hanya pada bab isi 2/3/4 di data template",
  [1, 2, 3].every((i) => mangkoso.bab[i]!.labelAplikasi === true) &&
    mangkoso.bab[0]!.labelAplikasi !== true &&
    mangkoso.bab[4]!.labelAplikasi !== true,
);
const proyeksiMk = strukturKeDaftarIsi(mangkoso);
cek(
  "R3 Mangkoso: penanda labelAplikasi terproyeksi ke BabKustom dan bertahan simpan-muat",
  proyeksiMk[1]!.labelAplikasi === true &&
    proyeksiMk[0]!.labelAplikasi !== true &&
    migrasiProyek(JSON.parse(JSON.stringify({ ...pMk, daftarIsi: proyeksiMk }))).daftarIsi?.[1]
      ?.labelAplikasi === true,
);
{
  const sumberPanel = readFileSync(
    path.join(process.cwd(), "components/workspace/struktur-pedoman-panel.tsx"),
    "utf8",
  );
  const sumberStrukturTab = readFileSync(
    path.join(process.cwd(), "components/workspace/struktur-tab.tsx"),
    "utf8",
  );
  cek(
    "R3 tampilan: penanda label aplikasi dirender di panel pratinjau dan tab Struktur",
    sumberPanel.includes("labelAplikasi") &&
      sumberPanel.includes("label aplikasi, bukan nama tetap pedoman") &&
      sumberStrukturTab.includes("labelAplikasi") &&
      sumberStrukturTab.includes("label aplikasi"),
  );
}

console.log(gagal === 0 ? "\nSEMUA PASS" : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
