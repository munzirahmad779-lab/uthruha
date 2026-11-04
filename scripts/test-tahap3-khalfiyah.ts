/**
 * Uji penerimaan Pembangunan Ulang Tahap 3: khalfiyah tersusun sebagai
 * paragraf utuh yang mengalir (poin A3 bagian khalfiyah).
 * TANPA jaringan dan TANPA model: jalur compose memakai fixture proyek
 * yang sama dengan wizard (newProject + TEMPLATE_PEDOMAN + daftar isi
 * otomatis), jalur panel /api/khalfiyah diuji pada fungsi susunnya
 * (susunParagrafKhalfiyah + susunKasus + narasiKasusArab) dengan bahan
 * artikel fixture.
 * Jalankan: npx tsx scripts/test-tahap3-khalfiyah.ts
 */
import { readFileSync } from "node:fs";
import { TEMPLATE_PEDOMAN } from "../lib/pedoman/template-pedoman";
import { susunDaftarIsiOtomatis } from "../lib/engine/daftar-isi-pedoman";
import { newProject, type Project } from "../lib/engine/project";
import { composeSection, fenomenaBerbentukKalimat } from "../lib/engine/compose";
import { pangkasSatuHalaman, BATAS_HALAMAN } from "../lib/engine/auto-ref";
import {
  dekonstruksiHeuristik,
  susunParagrafKhalfiyah,
  susunNarasiLengkap,
  ekstrakResearchGap,
  type ArtikelJurnal,
} from "../lib/engine/khalfiyah";
import { narasiKasusArab, susunKasus } from "../lib/engine/kasus-latar-belakang";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (!ok) gagal++;
};

/** Buang penanda footnote otomatis agar pemeriksaan prosa murni teks. */
const bersihRef = (teks: string) => teks.replace(/\[\[ref:[^\]]+\]\]/g, "");

/** Blok prosa markdown: pecah per baris kosong, buang judul. */
const paragrafProsa = (md: string): string[] =>
  bersihRef(md)
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));

/** Hitung kalimat: segmen berakhir . atau ؟ yang memuat huruf. */
const jumlahKalimat = (teks: string): number =>
  (teks.match(/[^.!؟]+[.!؟]/g) ?? []).filter((s) => /[A-Za-z\u0600-\u06FF]{3,}/.test(s)).length;

const PENGGANTI_KURUNG = [
  "[موضوع البحث]",
  "[صِف الظاهرة التي تلاحظها في الميدان هنا]",
  "[المجتمع أو العينة البحثية]",
  "[مكان تنفيذ البحث]",
  "[النظرية الأساسية]",
];

/** Keluaran bersih: tanpa variabel templat, mojibake, dan pengganti kurung. */
const cekBersih = (nama: string, teks: string) => {
  cek(
    `${nama}: tanpa sisa variabel templat dan mojibake`,
    !teks.includes("{{") && !/\?{2,}/.test(teks) && !teks.includes("\uFFFD"),
  );
  cek(
    `${nama}: tanpa pengganti kurung yang bocor`,
    !PENGGANTI_KURUNG.some((p) => teks.includes(p)),
  );
};

/* ---------------- Fixture proyek (jalur wizard) ---------------- */

const mangkoso = TEMPLATE_PEDOMAN.find((t) => /mangkoso/i.test(t.namaPedoman))!;
const asadiyah = TEMPLATE_PEDOMAN.find((t) => /as'adiyah/i.test(t.namaPedoman))!;
cek("kedua template permanen ada", !!mangkoso && !!asadiyah);

const JUDUL = "أثر أصول الفقه في الحياة المعاصرة";
const RUMUSAN = [
  "ما مفهوم أصول الفقه عند العلماء؟",
  "كيف يظهر أثر أصول الفقه في الحياة المعاصرة؟",
  "ما العوامل المؤثرة في ذلك الأثر؟",
];

function proyekTemplate(tpl: typeof mangkoso, lengkap: boolean): Project {
  return newProject({
    bidangId: "fiqh-ushul",
    judulAr: JUDUL,
    rumusan: RUMUSAN,
    strukturPedoman: tpl,
    daftarIsi: susunDaftarIsiOtomatis(tpl, JUDUL).daftar,
    ...(lengkap
      ? {
          lokasi: "معهد دار الدعوة والإرشاد منجكوسو",
          populasi: "طلبة المعهد العالي",
          fenomenaAr: "ضعف توظيف أصول الفقه في معالجة قضايا الحياة اليومية لدى الطلبة",
        }
      : {}),
  });
}

/* ---------------- Jalur compose: Mangkoso ---------------- */

const mdMk = composeSection(proyekTemplate(mangkoso, true), "khalfiya").markdown;
const parMk = paragrafProsa(mdMk);
cek("Mangkoso: khalfiyah terdiri dari 3 paragraf", parMk.length === 3, `${parMk.length} paragraf`);
cek(
  "Mangkoso: tidak ada paragraf berisi satu kalimat",
  parMk.every((p) => jumlahKalimat(p) >= 2),
  parMk.map((p) => jumlahKalimat(p)).join(","),
);
cek(
  "Mangkoso: paragraf 1 mengembangkan pentingnya topik",
  parMk[0]!.includes(JUDUL) && /أهمية|تستحق النظر|تبرز الحاجة|ضرورة/.test(parMk[0]!),
);
cek(
  "Mangkoso: paragraf 2 menyatakan alasan memilih topik secara eksplisit",
  parMk[1]!.includes("اختار الباحث هذا الموضوع"),
);
cek(
  "Mangkoso: paragraf 3 memuat tujuan dan manfaat (teori + praktik) sebagai prosa",
  parMk[2]!.includes("ويهدف هذا البحث إلى") &&
    parMk[2]!.includes("فائدته النظرية") &&
    parMk[2]!.includes("فائدته العملية"),
);
cek(
  "Mangkoso: paragraf penutup sampai utuh lewat composeSection (jalur pengguna asli)",
  parMk.length === 3 && parMk[2]!.includes("ويهدف هذا البحث إلى"),
  `${mdMk.length} karakter`,
);
cek(
  "Mangkoso R2 verifikasi: kalimat tujuan merangkai dua tujuan pertama proyek",
  parMk[2]!.includes("الكشف عن واقع") && parMk[2]!.includes("تحليل العوامل المؤثرة"),
);
cekBersih("Mangkoso lengkap", mdMk);
cek(
  "Mangkoso: susun ulang deterministik (benih stabil)",
  composeSection(proyekTemplate(mangkoso, true), "khalfiya").markdown === mdMk,
);

/* --------- Jalur compose: Mangkoso dengan data proyek minim --------- */

const mdMkMinim = composeSection(proyekTemplate(mangkoso, false), "khalfiya").markdown;
const parMkMinim = paragrafProsa(mdMkMinim);
cek(
  "Mangkoso minim: tetap 3 paragraf utuh tanpa kalimat tunggal",
  parMkMinim.length === 3 && parMkMinim.every((p) => jumlahKalimat(p) >= 2),
  parMkMinim.map((p) => jumlahKalimat(p)).join(","),
);
cek(
  "Mangkoso minim: manfaat praktik memakai kalimat umum utuh, bukan kurung",
  parMkMinim[2]!.includes("المؤسسات ذات الصلة"),
);
cekBersih("Mangkoso minim", mdMkMinim);

/* ---------------- Jalur compose: As'adiyah ---------------- */

const mdAs = composeSection(proyekTemplate(asadiyah, true), "khalfiya").markdown;
const parAs = paragrafProsa(mdAs);
cek("As'adiyah: khalfiyah terdiri dari 3 paragraf", parAs.length === 3, `${parAs.length} paragraf`);
cek(
  "As'adiyah: tidak ada paragraf berisi satu kalimat",
  parAs.every((p) => jumlahKalimat(p) >= 2),
  parAs.map((p) => jumlahKalimat(p)).join(","),
);
cek(
  "As'adiyah: paragraf 1 (temhid) memuat gambaran topik dan posisi kebaruan",
  parAs[0]!.includes(JUDUL) &&
    /جديد|أصالة|لم يقف الباحث|لم تتناول|موقع هذا البحث من الدراسات السابقة|يحظَ بالعناية|ندرة الدراسات/.test(parAs[0]!),
);
cek(
  "As'adiyah: paragraf 2 (motivasi) menyebut persoalan teoretis dan faktual",
  parAs[1]!.includes("أسباب اختيار هذا العنوان") &&
    parAs[1]!.includes("إشكال نظري") &&
    parAs[1]!.includes("إشكال واقعي"),
);
cek(
  "As'adiyah: paragraf 3 berangkat dari karya sebelumnya (titik tolak)",
  parAs[2]!.includes("تنطلق هذه الدراسة"),
);
cekBersih("As'adiyah lengkap", mdAs);

/* ------------- R1: penanda pendapat ulama/pakar As'adiyah ------------- */

cek(
  "R1 As'adiyah: komponen pendapat ulama/pakar DITANDAI di paragraf motivasi",
  parAs[1]!.includes("تنبيه للباحث") && parAs[1]!.includes("عالم أو خبير"),
);
cek(
  "R1 As'adiyah: penanda tidak mengarang nama atau pendapat siapa pun",
  !/قال (الشيخ|الإمام|الأستاذ|الدكتور)/.test(parAs[1]!),
);
cek(
  "R1 Mangkoso: tidak ada penanda As'adiyah pada khalfiyah Mangkoso",
  !mdMk.includes("تنبيه للباحث"),
);

/* ------------- S1: pangkas tidak lagi membuang paragraf wajib ------------- */
/* Fixture kaya/panjang yang keluaran mentahnya terbukti melewati batas
 * 1800 pada instrumentasi telaah; paragraf penutup wajib sampai utuh
 * lewat composeSection, jalur yang sama dengan benih wizard dan tombol
 * susun ulang. */

const JUDUL_PANJANG =
  "أثر تطبيق منهج أصول الفقه في تنمية مهارات التفكير النقدي لدى طلبة المعاهد العالية الإسلامية في معالجة قضايا الحياة اليومية المعاصرة";
const FENOMENA_PANJANG =
  "ضعف توظيف طلبة المعهد العالي لأصول الفقه في معالجة قضايا الحياة اليومية والاجتماعية والمدرسية في بيئتهم المحلية والمجتمعية على حد سواء وبصورة متزايدة عاما بعد عام";

function proyekKaya(tpl: typeof mangkoso): Project {
  return newProject({
    bidangId: "fiqh-ushul",
    judulAr: JUDUL_PANJANG,
    rumusan: RUMUSAN,
    strukturPedoman: tpl,
    daftarIsi: susunDaftarIsiOtomatis(tpl, JUDUL_PANJANG).daftar,
    lokasi: "معهد دار الدعوة والإرشاد الإسلامي في منجكوسو بمحافظة سولاويسي الجنوبية",
    populasi: "طلبة المعهد العالي في المستويات الدراسية الأربعة جميعها بلا استثناء",
    fenomenaAr: FENOMENA_PANJANG,
  });
}

const mdKayaMk = composeSection(proyekKaya(mangkoso), "khalfiya").markdown;
const parKayaMk = paragrafProsa(mdKayaMk);
cek(
  "S1 Mangkoso panjang: fixture benar-benar melewati batas lama 1800",
  mdKayaMk.length > BATAS_HALAMAN,
  `${mdKayaMk.length} karakter`,
);
cek(
  "S1 Mangkoso panjang: ketiga paragraf utuh, paragraf penutup tidak hilang",
  parKayaMk.length === 3,
  `${parKayaMk.length} paragraf`,
);
cek(
  "S1 Mangkoso panjang: tujuan dan manfaat (unsur wajib 3-4) tetap sampai",
  parKayaMk[2]!.includes("ويهدف هذا البحث إلى") &&
    parKayaMk[2]!.includes("فائدته النظرية") &&
    parKayaMk[2]!.includes("فائدته العملية"),
);
cekBersih("S1 Mangkoso panjang", mdKayaMk);

const mdKayaAs = composeSection(proyekKaya(asadiyah), "khalfiya").markdown;
const parKayaAs = paragrafProsa(mdKayaAs);
cek(
  "S1 As'adiyah panjang: ketiga paragraf utuh",
  parKayaAs.length === 3,
  `${parKayaAs.length} paragraf`,
);
cek(
  "S1 As'adiyah panjang: titik tolak (unsur wajib 3) tetap sampai",
  parKayaAs[2]!.includes("تنطلق هذه الدراسة"),
);
cekBersih("S1 As'adiyah panjang", mdKayaAs);

cek(
  "S1: pemangkas satu halaman sendiri tetap berlaku untuk bagian lain",
  (() => {
    const blok = "أ".repeat(900);
    const hasilPangkas = pangkasSatuHalaman([blok, blok, blok].join("\n\n"));
    return hasilPangkas.length <= BATAS_HALAMAN && hasilPangkas.split(/\n\n+/).length === 1;
  })(),
);

/* ------------- S2: fenomena berbentuk kalimat ------------- */
/* Bentuk masukan yang justru diminta wizard ("satu-dua kalimat") tidak
 * boleh disematkan ke tengah kalimat frasa bank; ia berdiri sebagai
 * kalimat tersendiri, dan probe tata bahasa telaah berbalik hasil. */

const F_KALIMAT_1 =
  "يلاحظ الباحث أن طلبة المعهد يدرسون أصول الفقه نظريا ولا يوظفونه في حياتهم اليومية";
const F_KALIMAT_2 =
  "طلبة المعهد العالي يدرسون أصول الفقه دراسة نظرية ولا يوظفونه في حياتهم اليومية.";
const F_KALIMAT_3 = "يعاني كثير من طلبة المعهد من ضعف توظيف أصول الفقه في حياتهم اليومية";
const F_FRASA = "ضعف توظيف أصول الفقه في معالجة قضايا الحياة اليومية لدى الطلبة";

cek("S2 klasifikasi: contoh telaah (klausa أن) berbentuk kalimat", fenomenaBerbentukKalimat(F_KALIMAT_1));
cek("S2 klasifikasi: kalimat nominal bertanda titik berbentuk kalimat", fenomenaBerbentukKalimat(F_KALIMAT_2));
cek("S2 klasifikasi: kalimat berawalan kata kerja berbentuk kalimat", fenomenaBerbentukKalimat(F_KALIMAT_3));
cek("S2 klasifikasi: frasa benda fixture tetap frasa", !fenomenaBerbentukKalimat(F_FRASA));
cek("S2 klasifikasi: frasa pendek tetap frasa", !fenomenaBerbentukKalimat("ضعف التوظيف اليومي"));
cek(
  "S2 klasifikasi: frasa benda berklausa relatif tetap frasa",
  !fenomenaBerbentukKalimat("ضعف متابعة الطلبة التي يظهر أثرها في تأخر كتابة الرسائل"),
);
cek("S2 klasifikasi: frasa panjang S1 tetap frasa", !fenomenaBerbentukKalimat(FENOMENA_PANJANG));

function proyekFenomena(tpl: typeof mangkoso, fenomena: string): Project {
  return newProject({
    bidangId: "fiqh-ushul",
    judulAr: JUDUL,
    rumusan: RUMUSAN,
    strukturPedoman: tpl,
    daftarIsi: susunDaftarIsiOtomatis(tpl, JUDUL).daftar,
    lokasi: "معهد دار الدعوة والإرشاد منجكوسو",
    populasi: "طلبة المعهد العالي",
    fenomenaAr: fenomena,
  });
}

/** Sematan rusak: fenomena didahului kata penyemat frasa bank di tengah kalimat. */
const tersematRusak = (md: string, fenomena: string): boolean => {
  const awal = fenomena.replace(/[.!؟]$/, "").slice(0, 18);
  return ["في ", "تنامي ", "تفاقم ", "تولي ", "موضوع ", "أن "].some((p) =>
    md.includes(p + awal),
  );
};

for (const [label, f] of [
  ["klausa-an", F_KALIMAT_1],
  ["nominal-titik", F_KALIMAT_2],
  ["kata-kerja", F_KALIMAT_3],
] as const) {
  const mdF = composeSection(proyekFenomena(mangkoso, f), "khalfiya").markdown;
  const parF = paragrafProsa(mdF);
  const fBersih = f.replace(/[.]$/, "");
  cek(`S2 Mangkoso ${label}: tetap 3 paragraf`, parF.length === 3, `${parF.length} paragraf`);
  cek(
    `S2 Mangkoso ${label}: fenomena hadir utuh sebagai kalimat tersendiri di paragraf pembuka`,
    parF[0]!.includes(fBersih),
  );
  cek(
    `S2 Mangkoso ${label}: tidak ada sematan klausa di tengah kalimat frasa`,
    !tersematRusak(mdF, f),
  );
  cek(
    `S2 Mangkoso ${label}: paragraf alasan tidak memuat sematan rusak`,
    !tersematRusak(parF[1]!, f),
  );
  cekBersih(`S2 Mangkoso ${label}`, mdF);
}

const mdFAs = composeSection(proyekFenomena(asadiyah, F_KALIMAT_1), "khalfiya").markdown;
const parFAs = paragrafProsa(mdFAs);
cek(
  "S2 As'adiyah klausa-an: fenomena tersendiri dan tidak tersemat rusak",
  parFAs.length === 3 && parFAs[0]!.includes(F_KALIMAT_1) && !tersematRusak(mdFAs, F_KALIMAT_1),
);
cekBersih("S2 As'adiyah klausa-an", mdFAs);

cek(
  "S2 regresi frasa: fenomena frasa tetap tersemat sah di dalam kalimat prosa",
  mdMk.includes("ضعف توظيف أصول الفقه في معالجة قضايا الحياة اليومية لدى الطلبة"),
);

/* ------------- Jalur compose: tanpa template kampus ------------- */

const proyekUmum = newProject({
  bidangId: "quran",
  judulAr: JUDUL,
  rumusan: RUMUSAN,
  lokasi: "منجكوسو",
  populasi: "الطلبة",
  fenomenaAr: "ضعف التوظيف اليومي",
});
const mdUmum = composeSection(proyekUmum, "khalfiya").markdown;
const parUmum = paragrafProsa(mdUmum);
cek(
  "Umum: paragraf-paragraf utuh tanpa kalimat tunggal",
  parUmum.length >= 3 && parUmum.every((p) => jumlahKalimat(p) >= 2),
  parUmum.map((p) => jumlahKalimat(p)).join(","),
);
cek("Umum: memuat kalimat tujuan dari rumusan proyek", mdUmum.includes("ويهدف هذا البحث إلى"));
cek(
  "Umum: susun ulang deterministik",
  composeSection(proyekUmum, "khalfiya").markdown === mdUmum,
);
cekBersih("Umum lengkap", mdUmum);

/* ------------- Regresi: draf lama mahasiswa tidak disentuh ------------- */

const DRAF_LAMA = "## خلفية البحث\n\nنص قديم كتبه الطالب بنفسه قبل pembangunan ulang.";
const proyekLama = proyekTemplate(mangkoso, true);
proyekLama.draf = { ...proyekLama.draf, khalfiya: DRAF_LAMA };
composeSection(proyekLama, "khalfiya");
cek("Regresi: compose tidak mengubah draf khalfiyah tersimpan", proyekLama.draf.khalfiya === DRAF_LAMA);

/* ------------- Jalur panel: susunParagrafKhalfiyah ------------- */

const klaster = dekonstruksiHeuristik(
  "Pengaruh Pembelajaran Berbasis Masalah terhadap Hasil Belajar Siswa Sekolah Dasar",
);

const artikel: ArtikelJurnal[] = [
  {
    judul: "Problem Based Learning in Primary Schools",
    penulis: ["Ahmad Fauzi", "Siti Rahma"],
    tahun: 2021,
    namaJurnal: "Jurnal Pendidikan Dasar",
    abstrak:
      "This study examines classroom practice in primary schools. However, little is known about how problem based learning shapes daily instruction in rural classrooms. The research gap remains significant for teachers who need practical guidance.",
    doi: "10.1000/xyz1",
    url: "https://doi.org/10.1000/xyz1",
    klaster: 1,
  },
  {
    judul: "Learning Outcomes and Classroom Problems",
    penulis: ["Budi Santoso"],
    tahun: 2022,
    namaJurnal: "Jurnal Ilmu Pendidikan",
    abstrak:
      "The main problem is that learning outcomes remain low because instruction lacks variation and feedback for students in many schools across the region.",
    url: "https://example.org/k2",
    klaster: 1,
  },
  {
    judul: "Methods of Classroom Inquiry",
    penulis: ["Dewi Lestari"],
    tahun: 2020,
    namaJurnal: "Jurnal Metode",
    abstrak:
      "Existing studies lack a consistent method for observing classroom interaction, and this limited evidence makes comparison across schools very difficult for researchers.",
    url: "https://example.org/k3",
    klaster: 2,
  },
  {
    judul: "School Context and Learning in Eastern Indonesia",
    penulis: ["Eko Prasetyo"],
    tahun: 2023,
    namaJurnal: "Jurnal Konteks",
    url: "https://example.org/k4",
    klaster: 3,
  },
];

const paragraf = susunParagrafKhalfiyah(klaster, artikel, []);
cek("Panel: hasil 4 paragraf (3 klaster + sintesis)", paragraf.length === 4, `${paragraf.length}`);
for (const p of paragraf) {
  cekBersih(`Panel ${p.bagian}`, p.konten);
  if (p.bagian === "sintesis") continue;
  cek(
    `Panel ${p.bagian}: konten satu blok prosa tanpa daftar bernomor`,
    !/(^|\n)\s*\d+\.\s/.test(p.konten) && !p.konten.includes("\n"),
  );
  cek(
    `Panel ${p.bagian}: konten paragraf mengalir (minimal 3 kalimat)`,
    jumlahKalimat(p.konten) >= 3,
    `${jumlahKalimat(p.konten)} kalimat`,
  );
}
cek(
  "Panel klaster1: kasus terjalin sebagai prosa ber-atribusi sumber",
  paragraf[0]!.konten.includes("(دراسة"),
);
cek(
  "Panel klaster2: kasus terjalin sebagai prosa ber-atribusi sumber",
  paragraf[1]!.konten.includes("(دراسة"),
);

const narasi = susunNarasiLengkap(paragraf);
cekBersih("Panel narasiLengkap", narasi);
cek(
  "Panel: narasi lengkap mempertahankan format judul bagian yang sama",
  narasi.includes("# خلفية البحث") && narasi.includes("**المراجع العلمية:**"),
);
cek(
  "Panel: ekstrak research gap tetap bekerja dari sintesis",
  ekstrakResearchGap(paragraf).includes("فجوة بحثية"),
);

/* ------- Jalur panel tanpa bahan artikel sama sekali ------- */

const paragrafKosong = susunParagrafKhalfiyah(klaster, [], []);
for (const p of paragrafKosong) {
  cekBersih(`Panel kosong ${p.bagian}`, p.konten);
  if (p.bagian === "sintesis") continue;
  cek(
    `Panel kosong ${p.bagian}: tetap paragraf utuh dan peringatan jujur tampil`,
    jumlahKalimat(p.konten) >= 2 && typeof p.peringatan === "string" && p.peringatan.length > 0,
    `${jumlahKalimat(p.konten)} kalimat`,
  );
}

/* ------- narasiKasusArab: prosa, bukan daftar ------- */

const kasusK1 = susunKasus(artikel, 1, 4);
const narasiK1 = narasiKasusArab(kasusK1, 1);
cek("Kasus: dua kasus tersusun dari abstrak fixture", kasusK1.length === 2, `${kasusK1.length}`);
cek(
  "Kasus: narasi satu paragraf mengalir tanpa nomor daftar dan tanpa baris baru",
  !narasiK1.includes("\n") && !/(^|\s)\d+\.\s/.test(narasiK1) && jumlahKalimat(narasiK1) >= 3,
  `${jumlahKalimat(narasiK1)} kalimat`,
);

/* ------- Pemeriksaan statis: mojibake hilang dari sumber ------- */

const sumberKhalfiyah = readFileSync(new URL("../lib/engine/khalfiyah.ts", import.meta.url), "utf8");
const sumberKasus = readFileSync(
  new URL("../lib/engine/kasus-latar-belakang.ts", import.meta.url),
  "utf8",
);
cek(
  "[statis] khalfiyah.ts bebas rangkaian tanda tanya mojibake",
  !/\?{3,}/.test(sumberKhalfiyah),
);
cek(
  "[statis] kasus-latar-belakang.ts bebas rangkaian tanda tanya mojibake",
  !/\?{3,}/.test(sumberKasus),
);

console.log(gagal === 0 ? "\nSEMUA PASS" : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
