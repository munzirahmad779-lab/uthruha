/**
 * Uji penerimaan Pembangunan Ulang Tahap 6: mesin footnote hawamisy
 * Mangkoso + As'adiyah dan sanitasi sitasi.
 *
 * Yang dibuktikan:
 * - Ke-12 format Mangkoso (SPEC-PEDOMAN §2.5) keluar persis dari
 *   sumber uji per jenis, termasuk contoh verbatim pedoman (format
 *   1, 3) dan singkatan ketiadaan data د.ت./د.ن. (format 5).
 * - Format As'adiyah (§3.6): kitab lengkap contoh verbatim pedoman,
 *   pengulangan ringkas, jurnal Arab contoh verbatim, pola jurnal
 *   Latin, takhrij hadis contoh verbatim, wawancara, web.
 * - Tag jenis dibunuh struktural: adapter tidak lagi menagih judul,
 *   kandidat jurnal menjadi Sumber berjenis artikel ber-DOI,
 *   proyek warisan bertajuk "[مجلة] …" bersih di footnote, daftar
 *   pustaka, dan tampilan; bersihkanJudul tidak mengubah judul sah.
 * - Daftar pustaka satu jalur: kelompok Mangkoso sesuai §2.6,
 *   urutan bahasa As'adiyah, entri kartu detail == entri daftar,
 *   cabang gaya umum tidak berubah dari perumus lamanya.
 * - Penomoran per-bab PENUH (syarat REVIEW-TAHAP-5): kompilasi
 *   dokumen, kompilasi bagian, chip editor, dan DOCX semuanya mulai
 *   dari 1 di Bab 2 dengan bentuk penuh terulang; Mangkoso pada
 *   naskah yang sama bersambung dan byte-identik dengan jalur datar
 *   lama.
 * - Duplikat lintas jalur: id Generate == id dialog untuk karya yang
 *   sama; penjaga judul ternormalisasi mengenali judul warisan
 *   tercemar sebagai karya yang sama.
 * - Bagian A: kepala patah bersarang ganda tidak lagi menelan
 *   penanda sah (L1); token ref: di URL/prosa tidak ditulis ulang
 *   (L3); pasang-footnote tidak lagi memuat pola longgar (L2, statis).
 * - Turabian umum untuk proyek tanpa template tidak berubah.
 * - Perbaikan telaah Tahap 6 (REVIEW-TAHAP-6): S1 halaman tidak
 *   pernah berlabel رقم الحديث bila nomorHadis kosong (tiga
 *   posisi); R1 frasa derajat risalah tidak lenyap bila universitas
 *   dan tahun kosong; R2 gelar akademik disaring di lapisan format
 *   tanpa mengubah data nama tersimpan.
 *
 * Jalankan: npx tsx scripts/test-tahap6-hawamisy.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { bersihkanJudul, type Sumber } from "../lib/engine/cite";
import { footnoteGaya, susunDaftarPustakaGaya } from "../lib/engine/citation";
import { composeNaskah } from "../lib/engine/compose";
import { daftarPustakaProyek, entriPustakaProyek } from "../lib/engine/daftar-pustaka";
import { buatDocx, markdownKeWord, setelDokumen } from "../lib/engine/export";
import {
  entriPustakaMangkoso,
  footnoteKampus,
  kampusProyek,
  modePerBab,
  penulisTanpaGelar,
} from "../lib/engine/hawamisy";
import { cariMarker, kompilasiMarker, pecahSegmen, teksPenandaRusak } from "../lib/engine/marker";
import { normalisasiJudul } from "../lib/engine/referensi";
import { newProject, type Project } from "../lib/engine/project";
import { strukturProyek } from "../lib/content/struktur";
import { TEMPLATE_PEDOMAN } from "../lib/pedoman/template-pedoman";
import { idStabilDariIdentitas, kandidatKeSumber } from "../lib/refs/footnote";
import type { RefCandidate } from "../lib/refs/types";
import { rujukanKeSumber } from "../lib/server/generate-footnote";
import type { RujukanTamu } from "../lib/server/rujukan";
import {
  footnoteBagian,
  kemunculanBagian,
  kompilasiBagian,
  kompilasiDokumen,
} from "../components/workspace/footnote-bagian";

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};
const sama = (nama: string, didapat: string, diharapkan: string) =>
  cek(nama, didapat === diharapkan, didapat === diharapkan ? "" : `\n  didapat:    ${didapat}\n  diharapkan: ${diharapkan}`);

const mangkoso = TEMPLATE_PEDOMAN.find((t) => /mangkoso/i.test(t.namaPedoman))!;
const asadiyah = TEMPLATE_PEDOMAN.find((t) => /as'adiyah/i.test(t.namaPedoman))!;

function sumber(sebagian: Partial<Sumber>): Sumber {
  return {
    id: "src-uji",
    jenis: "kitab",
    penulis: "",
    tahun: "",
    judul: "",
    ...sebagian,
  };
}

/* ---------------- 12 format Mangkoso ---------------- */

const kitabSampler = sumber({
  penulis: "فاضل صالح السامرائي",
  judul: "بلاغة الكلمة في التعبير القرآني",
  jilid: "1",
  kota: "القاهرة",
  penerbit: "شركة العاتك لصناعة الكتاب",
  edisi: "الثانية",
  tahun: "2006",
});
sama(
  "Mangkoso F1 kitab = contoh verbatim pedoman",
  footnoteKampus(kitabSampler, "mangkoso", { halaman: "10-11" }),
  "فاضل صالح السامرائي، *بلاغة الكلمة في التعبير القرآني*، ج. 1، القاهرة: شركة العاتك لصناعة الكتاب، الطبعة الثانية: 2006، ص. 10-11.",
);
sama(
  "Mangkoso F2 terjemahan = format 1 + ترجمة sesudah judul",
  footnoteKampus({ ...kitabSampler, jenis: "terjemahan", penerjemah: "أحمد صاحب" }, "mangkoso", { halaman: "10-11" }),
  "فاضل صالح السامرائي، *بلاغة الكلمة في التعبير القرآني*، ترجمة أحمد صاحب، ج. 1، القاهرة: شركة العاتك لصناعة الكتاب، الطبعة الثانية: 2006، ص. 10-11.",
);
const kitabLaqab = sumber({
  penulis: "السامرائي، فاضل صالح",
  judul: "بلاغة الكلمة في التعبير القرآني",
  kota: "القاهرة",
  penerbit: "شركة العاتك",
  tahun: "2006",
});
sama(
  "Mangkoso F3 pengulangan langsung = contoh verbatim pedoman",
  footnoteKampus(kitabLaqab, "mangkoso", { halaman: "32" }, { pertama: false, langsungBerulang: true }),
  "السامرائي، ص. 32.",
);
sama(
  "Mangkoso F4 pengulangan terselingi = nama masyhur + judul singkat + halaman",
  footnoteKampus(kitabLaqab, "mangkoso", { halaman: "32" }, { pertama: false, langsungBerulang: false }),
  "السامرائي، بلاغة الكلمة في التعبير، ص. 32.",
);
{
  const tanpa = footnoteKampus(
    sumber({ penulis: "مؤلف مجهول الناشر", judul: "كتاب قديم", kota: "بغداد" }),
    "mangkoso",
    { halaman: "7" },
  );
  cek("Mangkoso F5 penerbit hilang = د.ن. dan tahun hilang = د.ت.", tanpa.includes("بغداد: د.ن.") && tanpa.includes("د.ت."), tanpa);
}
sama(
  "Mangkoso F6 artikel jurnal sesuai urutan butir 6",
  footnoteKampus(
    sumber({
      jenis: "artikel",
      penulis: "محمد عبد الله",
      judul: "أثر أصول الفقه في الحياة",
      jurnal: "مجلة الأبحاث",
      volume: "4",
      kota: "الجزائر",
      penerbit: "جامعة زيان عاشور",
      tahun: "2019",
    }),
    "mangkoso",
    { halaman: "29" },
  ),
  "محمد عبد الله، “أثر أصول الفقه في الحياة”، *مجلة الأبحاث*، ج. 4، الجزائر: جامعة زيان عاشور، 2019، ص. 29.",
);
sama(
  "Mangkoso F7 web: tanggal terbit + tautan, tanpa kota/penerbit/halaman",
  footnoteKampus(
    sumber({
      jenis: "web",
      penulis: "أحمد يوسف",
      judul: "مقال عن التعليم",
      tanggal: "5 يناير 2024",
      url: "https://example.com/artikel",
    }),
    "mangkoso",
    {},
  ),
  "أحمد يوسف، “مقال عن التعليم”، تم نشره في تاريخ 5 يناير 2024، https://example.com/artikel",
);
sama(
  "Mangkoso F8 risalah: keterangan dalam kurung",
  footnoteKampus(
    sumber({
      jenis: "skripsi",
      penulis: "خالد محمد",
      judul: "دراسة في التربية",
      penerbit: "جامعة القاهرة",
      tahun: "2020",
    }),
    "mangkoso",
    { halaman: "45" },
  ),
  "خالد محمد، “دراسة في التربية”، (رسالة ماجستير أو دكتوراه، جامعة القاهرة، 2020)، ص. 45.",
);
{
  const quran = sumber({
    penulis: "وزارة الشؤون الدينية",
    judul: "ترجمة معاني القرآن الكريم",
    kota: "جاكرتا",
    penerbit: "المطابع الحكومية",
    tahun: "2019",
  });
  sama(
    "Mangkoso F9 terjemahan Al-Qur'an mengikuti format kitab (F1)",
    footnoteKampus(quran, "mangkoso", { halaman: "3" }),
    footnoteKampus({ ...quran, jenis: "kitab" }, "mangkoso", { halaman: "3" }),
  );
}
sama(
  "Mangkoso F10 ensiklopedia: penanda entri (ت)",
  footnoteKampus(
    sumber({
      jenis: "ensiklopedia",
      penulis: "ابن منظور",
      judul: "لسان العرب",
      jilid: "3",
      kota: "بيروت",
      penerbit: "دار صادر",
      tahun: "1990",
    }),
    "mangkoso",
    { halaman: "112" },
  ),
  "ابن منظور، (ت)، *لسان العرب*، ج. 3، بيروت: دار صادر، 1990، ص. 112.",
);
sama(
  "Mangkoso F11 wawancara: narasumber, topik, media, tanggal",
  footnoteKampus(
    sumber({
      jenis: "wawancara",
      penulis: "الشيخ محمد",
      judul: "حكم التعليم الإلكتروني",
      media: "الهاتف",
      tanggal: "10 أكتوبر 2021",
    }),
    "mangkoso",
    {},
  ),
  "الشيخ محمد، حكم التعليم الإلكتروني، الهاتف، 10 أكتوبر 2021.",
);
sama(
  "Mangkoso F12 hadis: nomor hadis, bukan halaman",
  footnoteKampus(
    sumber({
      jenis: "hadis",
      penulis: "مسلم بن الحجاج النيسابوري",
      judul: "صحيح مسلم",
      kota: "بيروت",
      penerbit: "دار إحياء التراث العربي",
      tahun: "1954",
      nomorHadis: "2218",
    }),
    "mangkoso",
    {},
  ),
  "مسلم بن الحجاج النيسابوري، صحيح مسلم، بيروت: دار إحياء التراث العربي، 1954، رقم الحديث: 2218.",
);

/* ---------------- Format As'adiyah ---------------- */

const kitabAs = sumber({
  penulis: "وهبة الزحيلي",
  judul: "التفسير المنير في العقيدة والشريعة والمنهج",
  muhaqqiq: "نور الهادي رملان",
  kota: "بيروت",
  penerbit: "دار الفكر المعاصر",
  edisi: "1",
  tahunHijriah: "1411",
  tahun: "1991",
  jilid: "1",
});
sama(
  "As'adiyah kitab lengkap = contoh verbatim pedoman",
  footnoteKampus(kitabAs, "asadiah", { halaman: "113" }),
  "وهبة الزحيلي، التفسير المنير في العقيدة والشريعة والمنهج، تحقيق: نور الهادي رملان (بيروت: دار الفكر المعاصر، ط 1، 1411هـ/1991م)، ج 1، ص. 113.",
);
sama(
  "As'adiyah pengulangan kitab = pengarang, judul, jilid, halaman",
  footnoteKampus(kitabAs, "asadiah", { halaman: "113" }, { pertama: false, langsungBerulang: true }),
  "وهبة الزحيلي، التفسير المنير في العقيدة والشريعة والمنهج، ج 1، ص. 113.",
);
sama(
  "As'adiyah jurnal Arab = contoh verbatim pedoman",
  footnoteKampus(
    sumber({
      jenis: "artikel",
      penulis: "محمد خير المستغفرين",
      judul: "تفعيل مادة الدفاع عن السنة المطهرة في مواجهة تيارات الراديكالية وظاهرة الإسلاموفوبيا",
      jurnal: "مجلة الزهراء",
      volume: "20",
      nomor: "2",
    }),
    "asadiah",
    { halaman: "10" },
  ),
  "محمد خير المستغفرين، “تفعيل مادة الدفاع عن السنة المطهرة في مواجهة تيارات الراديكالية وظاهرة الإسلاموفوبيا”، مجلة الزهراء، العدد 20، رقم 2، ص. 10.",
);
sama(
  "As'adiyah jurnal Latin = pola Vol./No./Th./h.",
  footnoteKampus(
    sumber({
      jenis: "artikel",
      penulis: "Oman Fathurrahman",
      judul: "The Roots of The Writing Tradition of Hadith Works in Nusantara",
      jurnal: "Studia Islamika",
      volume: "19",
      nomor: "1",
      tahun: "2012",
    }),
    "asadiah",
    { halaman: "48" },
  ),
  "Oman Fathurrahman, “The Roots of The Writing Tradition of Hadith Works in Nusantara”, Studia Islamika, Vol. 19, No. 1, Th. 2012, h. 48.",
);
sama(
  "As'adiyah takhrij hadis = contoh verbatim pedoman",
  footnoteKampus(
    sumber({
      jenis: "hadis",
      penulis: "مسلم بن الحجاج النيسابوري",
      judul: "صحيح مسلم",
      nomorHadis: "2218",
      kota: "بيروت",
      penerbit: "دار إحياء التراث العربي",
      tahun: "1954",
      bagianTematis: "كتاب السلام",
      babTematis: "باب الطاعون والطيرة والكهانة ونحوها",
      jilid: "4",
    }),
    "asadiah",
    { halaman: "1738" },
  ),
  "مسلم بن الحجاج النيسابوري، صحيح مسلم، رقم: 2218 (بيروت: دار إحياء التراث العربي، 1954)، كتاب السلام، باب الطاعون والطيرة والكهانة ونحوها، ج 4، ص. 1738.",
);
sama(
  "As'adiyah wawancara = مقابلة شخصية مع + kota + tanggal",
  footnoteKampus(
    sumber({
      jenis: "wawancara",
      penulis: "رئيس لجنة الفتوى مجلس العلماء الإندونيسي",
      judul: "مقابلة",
      kota: "جاكرتا",
      tanggal: "10 أكتوبر 2021",
    }),
    "asadiah",
    {},
  ),
  "مقابلة شخصية مع رئيس لجنة الفتوى مجلس العلماء الإندونيسي، جاكرتا في تاريخ 10 أكتوبر 2021.",
);
sama(
  "As'adiyah web = تاريخ تصفح المقالة + URL",
  footnoteKampus(
    sumber({
      jenis: "web",
      penulis: "أحمد يوسف",
      judul: "مقال على الشبكة",
      tanggal: "12 نوفمبر 2024",
      url: "https://example.com/x",
    }),
    "asadiah",
    {},
  ),
  "أحمد يوسف، “مقال على الشبكة”، تاريخ تصفح المقالة 12 نوفمبر 2024، https://example.com/x",
);

/* ---------------- Sanitasi tag ---------------- */

sama("bersihkanJudul membuang tag [مجلة]", bersihkanJudul("[مجلة] الشرعية التنظيمية بين النظرية والتطبيق"), "الشرعية التنظيمية بين النظرية والتطبيق");
sama("bersihkanJudul membuang tag bertumpuk", bersihkanJudul("[كتاب] [مقال] عنوان البحث"), "عنوان البحث");
sama("bersihkanJudul tidak menyentuh judul sah", bersihkanJudul("دراسة في [أصول] الفقه"), "دراسة في [أصول] الفقه");
sama("bersihkanJudul tidak membuang kurung berisi spasi", bersihkanJudul("[دراسة تحليلية] عنوان"), "[دراسة تحليلية] عنوان");

const kandidatJurnal: RefCandidate = {
  source: "turath",
  kitab: "الشرعية التنظيمية بين النظرية والتطبيق",
  jenis: "artikel",
  jurnal: "مجلة أبحاث",
  doi: "10.54528/1549-004-001-003",
  volume: "4",
  nomor: "1",
  penulis: "باحث جزائري",
  tahun: 2019,
  teks_kutipan: "نص",
  url_sumber: "https://doi.org/10.54528/1549-004-001-003",
  skor: 0.9,
  mode: "api",
  perluVerifikasi: false,
};
{
  const s = kandidatKeSumber(kandidatJurnal);
  cek("kandidat jurnal → Sumber berjenis artikel", s.jenis === "artikel");
  cek("kandidat jurnal → nama jurnal di bidang jurnal", s.jurnal === "مجلة أبحاث");
  cek("kandidat jurnal → DOI di bidang doi", s.doi === "10.54528/1549-004-001-003");
  cek("kandidat jurnal → judul bersih", s.judul === "الشرعية التنظيمية بين النظرية والتطبيق");
  const sTercemar = kandidatKeSumber({ ...kandidatJurnal, kitab: "[مجلة] الشرعية التنظيمية بين النظرية والتطبيق" });
  cek(
    "kandidat warisan bertag → id sama dengan kandidat bersih",
    sTercemar.id === s.id,
    `${sTercemar.id} vs ${s.id}`,
  );
}

/* ---------------- Daftar pustaka satu jalur ---------------- */

const pMkBib: Project = newProject({
  strukturPedoman: mangkoso,
  sumber: [
    sumber({ id: "s1", penulis: "السامرائي، فاضل صالح", judul: "بلاغة الكلمة", kota: "القاهرة", penerbit: "شركة العاتك", tahun: "2006" }),
    sumber({ id: "s2", jenis: "artikel", penulis: "محمد عبد الله", judul: "أثر أصول الفقه", jurnal: "مجلة الأبحاث", volume: "4", nomor: "1", tahun: "2019", doi: "10.1/abc" }),
    sumber({ id: "s3", jenis: "web", penulis: "أحمد يوسف", judul: "مقال شبكي", url: "https://example.com/a" }),
    sumber({ id: "s4", jenis: "wawancara", penulis: "الشيخ محمد", judul: "حكم التعليم", tanggal: "10 أكتوبر 2021" }),
    sumber({ id: "s5", jenis: "skripsi", penulis: "خالد محمد", judul: "دراسة في التربية", penerbit: "جامعة القاهرة", tahun: "2020" }),
  ],
});
{
  const grup = daftarPustakaProyek(pMkBib);
  sama(
    "Daftar Mangkoso: kelompok sesuai §2.6 (+ الرسائل العلمية untuk skripsi)",
    grup.map((g) => g.judul).join("|"),
    "الكتب|المجلات|الرسائل العلمية|الشبكة|المقابلة",
  );
  cek(
    "Daftar Mangkoso: entri kitab berbentuk pengarang. judul miring. kota: penerbit, tahun.",
    grup[0]!.entri[0] === "السامرائي، فاضل صالح. *بلاغة الكلمة*. القاهرة: شركة العاتك، 2006.",
    grup[0]!.entri[0],
  );
  cek(
    "Entri kartu detail == entri di daftar lengkap (satu jalur)",
    grup.every((g) => g.entri.every((e) => pMkBib.sumber.some((s) => entriPustakaProyek(pMkBib, s) === e))),
  );
  cek(
    "Daftar Mangkoso: tidak ada tag jenis di entri mana pun",
    !grup.some((g) => g.entri.some((e) => /\[(مجلة|كتاب|مقال)\]/.test(e))),
  );
}
{
  const pAsBib: Project = newProject({
    strukturPedoman: asadiyah,
    sumber: [
      sumber({ id: "a1", penulis: "Budi Santoso", judul: "Buku Indonesia", kota: "Jakarta", penerbit: "Gramedia", tahun: "2020" }),
      sumber({ id: "a2", penulis: "وهبة الزحيلي", judul: "التفسير المنير", kota: "بيروت", penerbit: "دار الفكر المعاصر", edisi: "1", tahunHijriah: "1411", tahun: "1991" }),
      sumber({ id: "a3", penulis: "John Smith", penulisDaftar: ["Smith, John"], judul: "English Book", kota: "London", penerbit: "Routledge", tahun: "2015" }),
    ],
  });
  const grup = daftarPustakaProyek(pAsBib);
  cek("Daftar As'adiyah: satu kelompok المصادر والمراجع", grup.length === 1 && grup[0]!.judul === "المصادر والمراجع");
  cek(
    "Daftar As'adiyah: urutan bahasa Arab → Inggris/lain → Indonesia",
    grup[0]!.entri[0]!.startsWith("وهبة الزحيلي.") &&
      grup[0]!.entri[1]!.startsWith("John Smith.") &&
      grup[0]!.entri[2]!.startsWith("Budi Santoso."),
    grup[0]!.entri.join(" || "),
  );
  cek(
    "Daftar As'adiyah: entri kitab memuat ط dan tahun Hijriah/Masehi",
    grup[0]!.entri[0] === "وهبة الزحيلي. التفسير المنير. بيروت: دار الفكر المعاصر، ط 1، 1411هـ/1991م.",
    grup[0]!.entri[0],
  );
}
{
  const pUmum: Project = newProject({
    gayaSitasi: "turabian9",
    sumber: [
      sumber({ id: "u1", penulis: "Aziz, Abdul", penulisDaftar: ["Aziz, Abdul"], judul: "Fiqh Muamalah", kota: "Jakarta", penerbit: "Rajawali", tahun: "2020" }),
    ],
  });
  const grup = daftarPustakaProyek(pUmum);
  cek(
    "Proyek gaya umum: daftar pustaka identik dengan perumus gaya lama",
    grup.length === 1 && grup[0]!.entri.join("\n") === susunDaftarPustakaGaya(pUmum.sumber, "turabian9").join("\n"),
  );
}

/* ---------------- Proyek warisan tercemar: semua permukaan bersih ---------------- */

const pWarisan: Project = newProject({
  strukturPedoman: mangkoso,
  daftarIsi: [
    {
      id: "bab-1",
      labelId: "Bab 1",
      labelAr: "الباب الأول",
      babAr: "الأول",
      sections: [{ id: "b1s1", labelId: "Satu", labelAr: "المبحث الأول" }],
    },
  ],
  sumber: [
    sumber({
      id: "src-warisan",
      jenis: "artikel",
      penulis: "باحث جزائري",
      judul: "[مجلة] الشرعية التنظيمية بين النظرية والتطبيق",
      jurnal: "مجلة أبحاث",
      volume: "4",
      nomor: "1",
      tahun: "2019",
      doi: "10.54528/1549-004-001-003",
    }),
  ],
  draf: {
    b1s1: "نص عربي طويل بما يكفي ليكون فقرة حقيقية في البحث العلمي المعاصر هنا [[ref:src-warisan|hlm:29]] ونكمل النص.",
  },
});
{
  const hasil = kompilasiDokumen(pWarisan);
  cek("Proyek warisan: kompilasi tanpa tag [مجلة]", !hasil.markdown.includes("[مجلة]"), hasil.markdown);
  cek(
    "Proyek warisan: footnote memakai format artikel Mangkoso",
    hasil.markdown.includes("“الشرعية التنظيمية بين النظرية والتطبيق”"),
  );
  const grup = daftarPustakaProyek(pWarisan);
  cek("Proyek warisan: daftar pustaka tanpa tag", !grup.some((g) => g.entri.some((e) => e.includes("[مجلة]"))));
  cek("kampusProyek mengenali template Mangkoso", kampusProyek(pWarisan) === "mangkoso");
  cek("modePerBab Mangkoso = false", modePerBab(pWarisan) === false);
}

/* ---------------- Penomoran per-bab penuh ---------------- */

function proyekDuaBab(strukturPedoman: Project["strukturPedoman"]): Project {
  return newProject({
    strukturPedoman,
    daftarIsi: [
      {
        id: "bab-1",
        labelId: "Bab 1",
        labelAr: "الباب الأول",
        babAr: "الأول",
        sections: [{ id: "b1s1", labelId: "Satu", labelAr: "المبحث الأول" }],
      },
      {
        id: "bab-2",
        labelId: "Bab 2",
        labelAr: "الباب الثاني",
        babAr: "الثاني",
        sections: [{ id: "b2s1", labelId: "Satu", labelAr: "المبحث الأول" }],
      },
    ],
    sumber: [
      sumber({ id: "src-x", penulis: "وهبة الزحيلي", judul: "التفسير المنير", kota: "بيروت", penerbit: "دار الفكر المعاصر", tahun: "1991", jilid: "1" }),
      sumber({ id: "src-y", penulis: "ابن كثير", judul: "تفسير القرآن العظيم", kota: "الرياض", penerbit: "دار طيبة", tahun: "1999" }),
      sumber({ id: "src-z", penulis: "الطبري", judul: "جامع البيان", kota: "القاهرة", penerbit: "دار هجر", tahun: "2001" }),
    ],
    draf: {
      b1s1: "فقرة الباب الأول الطويلة بما يكفي لتكون نصا حقيقيا في البحث [[ref:src-x|hlm:10]] ثم قول آخر [[ref:src-y|hlm:20]] ونختم الفقرة هنا.",
      b2s1: "فقرة الباب الثاني الطويلة بما يكفي لتكون نصا حقيقيا في البحث [[ref:src-x|hlm:99]] ثم قول آخر [[ref:src-z|hlm:30]] ونختم الفقرة هنا.",
    },
  });
}

const pAsBab = proyekDuaBab(asadiyah);
{
  cek("modePerBab As'adiyah = true", modePerBab(pAsBab) === true);
  const hasil = kompilasiDokumen(pAsBab);
  const defs = [...hasil.markdown.matchAll(/^\[\^(\d+)\]: (.*)$/gm)].map((m) => ({ n: m[1], t: m[2] }));
  cek("Per-bab: empat definisi terbit (2 per bab)", defs.length === 4, JSON.stringify(defs.map((d) => d.n)));
  cek(
    "Per-bab: urutan nomor 1,2 lalu mulai lagi 1,2",
    defs.map((d) => d.n).join(",") === "1,2,1,2",
    defs.map((d) => d.n).join(","),
  );
  cek(
    "Per-bab: footnote pertama Bab 2 bentuk PENUH (data terbit ikut lagi)",
    (defs[2]!.t ?? "").includes("دار الفكر المعاصر"),
    defs[2]!.t,
  );
  cek(
    "Per-bab: definisi Bab 2 berada sesudah teks Bab 2 (di akhir babnya)",
    hasil.markdown.indexOf("[^1]: وهبة الزحيلي، التفسير المنير، تحقيق") === -1 &&
      hasil.markdown.lastIndexOf("الباب الثاني") < hasil.markdown.indexOf(defs[2]!.t ?? " mustahil "),
  );
  const kompB2 = kompilasiBagian(pAsBab, "b2s1");
  cek(
    "Per-bab: kompilasi bagian Bab 2 bernomor 1,2 dengan bentuk penuh",
    kompB2.entri.length === 2 && kompB2.entri[0]!.nomor === 1 && kompB2.entri[0]!.teks.includes("دار الفكر المعاصر"),
    JSON.stringify(kompB2.entri),
  );
  const muncul = kemunculanBagian(pAsBab, "b2s1");
  cek(
    "Per-bab: nomor chip editor Bab 2 mulai dari 1",
    muncul.length === 2 && muncul[0]!.nomor === 1 && muncul[1]!.nomor === 2,
    JSON.stringify(muncul),
  );
  const strip = footnoteBagian(pAsBab, "b2s1");
  cek(
    "Per-bab: strip footnote Bab 2 sepakat dengan chip (1,2)",
    strip.map((f) => f.nomor).join(",") === "1,2",
    strip.map((f) => f.nomor).join(","),
  );
}

const pMkBab = proyekDuaBab(mangkoso);
{
  const viaDokumen = kompilasiDokumen(pMkBab).markdown;
  const viaDatar = kompilasiMarker(composeNaskah(pMkBab), pMkBab).markdown;
  cek("Mangkoso: kompilasi per-bab == jalur datar lama (byte-identik)", viaDokumen === viaDatar);
  const defs = [...viaDokumen.matchAll(/^\[\^(\d+)\]:/gm)].map((m) => m[1]);
  cek("Mangkoso: penomoran bersambung antar-bab (1,2,3,4)", defs.join(",") === "1,2,3,4", defs.join(","));
  cek(
    "Mangkoso: pengulangan di bab lain = bentuk singkat F4, bukan penuh",
    viaDokumen.includes("الزحيلي، التفسير المنير، ص. ٩٩") || viaDokumen.includes("الزحيلي، التفسير المنير، ص. 99"),
    viaDokumen,
  );
}

/* ---------------- DOCX per-bab ---------------- */

async function ujiDocx() {
  const st = strukturProyek(pAsBab);
  const labelBab = st.chapters.map((c) => c.labelAr);
  const md = kompilasiDokumen(pAsBab).markdown;
  const blob = buatDocx("Uji", md, { footnotePerBab: true, labelBab });
  const teks = new TextDecoder("utf-8", { fatal: false }).decode(await blob.arrayBuffer());
  const jumlahRestart = (teks.match(/numRestart w:val="eachSection"/g) ?? []).length;
  cek("DOCX per-bab: numRestart eachSection pada seksi antara + seksi akhir", jumlahRestart === 2, `${jumlahRestart}`);
  const fn3 = teks.match(/<w:footnote w:id="3">[\s\S]*?<\/w:footnote>/)?.[0] ?? "";
  cek(
    "DOCX per-bab: footnote id 3 = footnote pertama Bab 2 (teks penuh الزحيلي)",
    fn3.includes("الزحيلي") && fn3.includes("دار الفكر"),
    fn3.slice(0, 160),
  );
  const fn1 = teks.match(/<w:footnote w:id="1">[\s\S]*?<\/w:footnote>/)?.[0] ?? "";
  cek("DOCX per-bab: footnote id 1 = footnote pertama Bab 1 (teks penuh juga)", fn1.includes("الزحيلي"), fn1.slice(0, 120));

  setelDokumen(undefined);
  const blobUmum = buatDocx("Uji", kompilasiDokumen(pMkBab).markdown);
  const teksUmum = new TextDecoder("utf-8", { fatal: false }).decode(await blobUmum.arrayBuffer());
  cek(
    "DOCX mode umum: tidak ada numRestart (perilaku lama utuh)",
    !teksUmum.includes("numRestart"),
  );
  const bodyUmum = markdownKeWord(kompilasiDokumen(pMkBab).markdown);
  cek("DOCX mode umum: markdownKeWord tetap menghasilkan body", bodyUmum.includes("footnoteReference"));
}

/* ---------------- Duplikat lintas jalur ---------------- */

{
  const rujukan: RujukanTamu = {
    id: "ref-crossref",
    jenis: "jurnal",
    judul: "الشرعية التنظيمية بين النظرية والتطبيق",
    penulis: ["باحث جزائري"],
    tahun: "2019",
    wadah: "مجلة أبحاث",
    doi: "10.54528/1549-004-001-003",
    isbn: null,
    tautan: "https://doi.org/10.54528/1549-004-001-003",
    terverifikasi: true,
    skor: 0.9,
    kecocokan: 1,
    inti: true,
    umum: false,
  };
  const dariGenerate = rujukanKeSumber(rujukan);
  const dariDialog = kandidatKeSumber(kandidatJurnal);
  cek(
    "Duplikat lintas jalur: id Generate == id dialog untuk karya yang sama",
    dariGenerate.id === dariDialog.id,
    `${dariGenerate.id} vs ${dariDialog.id}`,
  );
  cek(
    "Duplikat lintas jalur: id stabil murni dari identitas kanonis",
    dariGenerate.id === idStabilDariIdentitas(rujukan.judul, "باحث جزائري", "2019"),
  );
  cek(
    "Penjaga judul: judul warisan tercemar dikenali sama dengan judul bersih",
    normalisasiJudul("[مجلة] الشرعية التنظيمية بين النظرية والتطبيق") ===
      normalisasiJudul("الشرعية التنظيمية بين النظرية والتطبيق"),
  );
  cek("Generate: judul tersimpan bersih dari tag", dariGenerate.judul === rujukan.judul && !dariGenerate.judul.includes("["));
  cek("Generate: jenis jurnal → artikel + jurnal + DOI terpetakan", dariGenerate.jenis === "artikel" && dariGenerate.jurnal === "مجلة أبحاث" && dariGenerate.doi === rujukan.doi);
}

/* ---------------- Bagian A: L1, L3, L2 ---------------- */

{
  const teksSarang = "رأس [[patah [[juga-patah [[ref:src-a|hlm:1]] بعده";
  const segs = pecahSegmen(teksSarang);
  const jumlahPenanda = segs.filter((s) => s.jenis === "penanda").length;
  cek(
    "L1: kepala patah bersarang ganda tidak menelan penanda sah",
    jumlahPenanda === 1 && cariMarker(teksSarang).length === 1,
    JSON.stringify(segs.map((s) => s.jenis)),
  );
  cek(
    "L1: gabungan segmen tetap round-trip persis",
    segs.map((s) => s.mentah).join("") === teksSarang,
  );

  const pUrl: Project = newProject({
    sumber: [sumber({ id: "src-a", penulis: "مؤلف", judul: "كتاب", kota: "القاهرة", penerbit: "دار", tahun: "2000" })],
    draf: {},
  });
  const hasilUrl = kompilasiMarker(
    "انظر الرابط https://example.com/ref:abc123 هنا، وانظر ref: pada buku itu. [[ref:src-a|hlm:5]]",
    pUrl,
  );
  cek(
    "L3: URL berisi ref: tidak ditulis ulang menjadi peringatan",
    hasilUrl.markdown.includes("https://example.com/ref:abc123") && !hasilUrl.markdown.includes(teksPenandaRusak()),
    hasilUrl.markdown,
  );
  cek(
    "L3: prosa 'ref:' biasa tidak ditulis ulang",
    hasilUrl.markdown.includes("ref: pada buku itu"),
  );
  const hasilPuing = kompilasiMarker("نص انقطع ref:src-b|hlm:55]] هنا [[ref:src-a|hlm:5]]", pUrl);
  cek(
    "L3: puing penanda sungguhan tetap menjadi peringatan",
    hasilPuing.markdown.includes(teksPenandaRusak()),
    hasilPuing.markdown,
  );

  const isiPasang = readFileSync(path.join(process.cwd(), "components/workspace/pasang-footnote.tsx"), "utf8");
  cek(
    "L2: pasang-footnote memakai cariMarker dan tanpa pola longgar",
    isiPasang.includes("cariMarker") && !/\[\^\\\]|\[\^\\\]\|/.test(isiPasang) && !isiPasang.includes("[^\\]|]+)(?:|"),
  );
}

/* ---------------- Turabian umum tidak berubah ---------------- */

{
  const pUmum: Project = newProject({
    gayaSitasi: "turabian9",
    sumber: [
      sumber({
        id: "src-t",
        penulis: "Aziz, Abdul",
        penulisDaftar: ["Aziz, Abdul"],
        judul: "Fiqh Muamalah",
        kota: "Jakarta",
        penerbit: "Rajawali",
        tahun: "2020",
      }),
    ],
  });
  const hasil = kompilasiMarker("Teks [[ref:src-t|hlm:45]] selesai.", pUmum);
  cek(
    "Turabian: footnote proyek tanpa template persis seperti sebelum Tahap 6",
    hasil.markdown.includes("[^1]: Abdul Aziz, *Fiqh Muamalah* (Jakarta: Rajawali, 2020), 45."),
    hasil.markdown,
  );
  cek(
    "Turabian: footnoteGaya langsung tetap sama",
    footnoteGaya(pUmum.sumber[0]!, "turabian9", { halaman: "45" }) ===
      "Abdul Aziz, *Fiqh Muamalah* (Jakarta: Rajawali, 2020), 45.",
  );
  cek("Proyek tanpa template: kampusProyek = null", kampusProyek(pUmum) === null);
}

/* ---------------- Perbaikan telaah Tahap 6: S1, R1, R2 ---------------- */

{
  // S1: sumber hadis TANPA nomorHadis; angka 77/78/79 adalah nomor
  // HALAMAN (fixture persis probe telaah) dan tidak boleh tercetak
  // berlabel رقم الحديث di ketiga posisi.
  const hadisPolos = sumber({
    jenis: "hadis",
    penulis: "مسلم",
    judul: "صحيح مسلم",
    kota: "بيروت",
    penerbit: "دار إحياء التراث",
    tahun: "1954",
  });
  sama(
    "S1: kemunculan pertama tanpa nomorHadis: halaman berlabel ص. (77)",
    footnoteKampus(hadisPolos, "mangkoso", { halaman: "77" }),
    "مسلم، صحيح مسلم، بيروت: دار إحياء التراث، 1954، ص. 77.",
  );
  sama(
    "S1: pengulangan langsung tanpa nomorHadis: halaman berlabel ص. (78)",
    footnoteKampus(hadisPolos, "mangkoso", { halaman: "78" }, { pertama: false, langsungBerulang: true }),
    "مسلم، ص. 78.",
  );
  sama(
    "S1: pengulangan terselingi tanpa nomorHadis: halaman berlabel ص. (79)",
    footnoteKampus(hadisPolos, "mangkoso", { halaman: "79" }, { pertama: false, langsungBerulang: false }),
    "مسلم، صحيح مسلم، ص. 79.",
  );
  const fnBernomor = footnoteKampus(
    { ...hadisPolos, nomorHadis: "2218" },
    "mangkoso",
    { halaman: "1738" },
  );
  cek(
    "S1: kontrol positif: nomorHadis ada → tercetak رقم الحديث, halaman tidak menyamar",
    fnBernomor.includes("رقم الحديث: 2218") && !fnBernomor.includes("1738"),
    fnBernomor,
  );
  sama(
    "S1: kontrol positif pengulangan: nomorHadis tetap رقم الحديث",
    footnoteKampus({ ...hadisPolos, nomorHadis: "2218" }, "mangkoso", { halaman: "55" }, { pertama: false, langsungBerulang: true }),
    "مسلم، رقم الحديث: 2218.",
  );
}

{
  // R1: risalah tanpa universitas dan tanpa tahun: frasa derajat
  // adalah unsur bernama format 8 dan tidak boleh lenyap.
  const risalahPolos = sumber({ jenis: "skripsi", penulis: "عمر فاروق", judul: "أثر القراءة" });
  sama(
    "R1: footnote risalah tanpa penerbit+tahun tetap memuat frasa derajat dalam kurung",
    footnoteKampus(risalahPolos, "mangkoso", { halaman: "88" }),
    "عمر فاروق، “أثر القراءة”، (رسالة ماجستير أو دكتوراه)، ص. 88.",
  );
  sama(
    "R1: entri pustaka risalah tanpa penerbit+tahun tetap memuat frasa derajat dalam kurung",
    entriPustakaMangkoso(risalahPolos),
    "عمر فاروق. “أثر القراءة”. (رسالة ماجستير أو دكتوراه).",
  );
}

{
  // R2: gelar akademik disaring di lapisan format; data tidak berubah.
  sama("R2: penulisTanpaGelar membuang أ. د.", penulisTanpaGelar("أ. د. حسن الشافعي"), "حسن الشافعي");
  sama("R2: penulisTanpaGelar membuang د.", penulisTanpaGelar("د. فاضل صالح السامرائي"), "فاضل صالح السامرائي");
  sama("R2: penulisTanpaGelar membuang Prof. Dr.", penulisTanpaGelar("Prof. Dr. John Smith"), "John Smith");
  sama("R2: penulisTanpaGelar membuang Drs.", penulisTanpaGelar("Drs. Budi Santoso"), "Budi Santoso");
  sama("R2: nama berawalan huruf mirip gelar tidak terpotong (أحمد)", penulisTanpaGelar("أحمد الشافعي"), "أحمد الشافعي");
  sama("R2: nama Latin mirip token gelar tidak terpotong (Drake)", penulisTanpaGelar("Drake Bell"), "Drake Bell");
  sama("R2: nama yang hanya berisi gelar tidak dikosongkan", penulisTanpaGelar("د."), "د.");
  const artikelBergelar = sumber({
    jenis: "artikel",
    penulis: "أ. د. حسن الشافعي",
    judul: "منهج البحث",
    jurnal: "مجلة الأبحاث",
    volume: "4",
    kota: "القاهرة",
    penerbit: "جامعة القاهرة",
    tahun: "2019",
  });
  sama(
    "R2: format 6 (probe telaah): gelar أ. د. tidak tercetak",
    footnoteKampus(artikelBergelar, "mangkoso", { halaman: "29" }),
    "حسن الشافعي، “منهج البحث”، *مجلة الأبحاث*، ج. 4، القاهرة: جامعة القاهرة، 2019، ص. 29.",
  );
  sama(
    "R2: keluaran nama bergelar == keluaran nama bersih (byte-identik sesudah saring)",
    footnoteKampus({ ...kitabSampler, penulis: "د. فاضل صالح السامرائي" }, "mangkoso", { halaman: "10-11" }),
    footnoteKampus(kitabSampler, "mangkoso", { halaman: "10-11" }),
  );
  const sGelar = sumber({ jenis: "artikel", penulis: "أ. د. حسن الشافعي", judul: "منهج البحث", jurnal: "مجلة الأبحاث", tahun: "2019" });
  footnoteKampus(sGelar, "mangkoso", { halaman: "29" });
  cek("R2: data nama tersimpan tidak diubah oleh penyaringan format", sGelar.penulis === "أ. د. حسن الشافعي");
}

void ujiDocx().then(() => {
  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  if (gagal > 0) process.exit(1);
});
