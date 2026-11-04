/**
 * Uji penerimaan Pembangunan Ulang Tahap 10: target panjang yang
 * nyata + estimasi halaman terkalibrasi (A10; butir 8, 9, 10
 * perintah user), PLUS paket bernama warisan telaah Tahap 3:
 * (i) pemangkas satu halaman membuang blok ithar secara senyap,
 * (ii) penyisipan fenomena di tengah frasa pada fawaid dan ithar.
 *
 * TANPA jaringan dan TANPA model. Angka kalibrasi yang diuji di
 * sini adalah angka yang benar-benar terukur pada 5 Nov 2026 dari
 * dokumen uji yang dirender LibreOffice (berkas dan naskahnya di
 * ~/workspace/kitabah-rebuild-10/kalibrasi-tahap10/): format standar
 * 1.652 kata menjadi 8 halaman, 3.134 menjadi 14, 6.100 menjadi 26;
 * format As'adiyah 3.134 menjadi 14 dan 6.100 menjadi 26.
 *
 * Jalankan: npx tsx scripts/test-tahap10-target.ts
 */
import { TEMPLATE_PEDOMAN } from "../lib/pedoman/template-pedoman";
import { SkemaStrukturPedoman } from "../lib/pedoman/skema-struktur";
import { strukturProyek, ringkasanPanjangProyek } from "../lib/content/struktur";
import { getBidang } from "../lib/content/bidang";
import { newProject, type Project } from "../lib/engine/project";
import {
  FORMAT_ASADIYAH,
  FORMAT_STANDAR,
  TARGET_PEMILIK,
  estimasiHalamanDariKata,
  formatHalamanProyek,
  halamanMinimalPedoman,
  halamanMentahDariKata,
  hitungKataNaskah,
  kataUntukHalaman,
} from "../lib/engine/estimasi-halaman";
import { KATA_PER_HALAMAN } from "../lib/refs/footnote";
import { periksaOrtografi } from "../lib/engine/orthografi";
import { periksaGerbang } from "../lib/engine/gerbang-mutu";
import { buatPromptKembangkan } from "../lib/engine/ai-handoff";
import {
  composeSection,
  fenomenaBerbentukKalimat,
} from "../lib/engine/compose";
import { pangkasSatuHalaman, BATAS_HALAMAN } from "../lib/engine/auto-ref";
import { susunDaftarIsiOtomatis } from "../lib/engine/daftar-isi-pedoman";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (!ok) gagal++;
};

/* ================= A. Penaksir dan kalibrasinya ================= */

cek(
  "A1 konstanta kalibrasi format standar 235 kata per halaman",
  FORMAT_STANDAR.kataPerHalaman === 235,
  String(FORMAT_STANDAR.kataPerHalaman),
);
cek(
  "A2 konstanta kalibrasi format As'adiyah 235 kata per halaman",
  FORMAT_ASADIYAH.kataPerHalaman === 235,
  String(FORMAT_ASADIYAH.kataPerHalaman),
);

// Pasangan kata dan halaman yang BENAR-BENAR terukur dari render
// dokumen uji; penaksir wajib menghasilkan kembali ketiganya.
const UKUR_STANDAR: [number, number][] = [
  [1652, 8],
  [3134, 14],
  [6100, 26],
];
for (const [kata, halaman] of UKUR_STANDAR) {
  const taksir = estimasiHalamanDariKata(kata, FORMAT_STANDAR);
  cek(
    `A3 standar ${kata} kata tertaksir ${halaman} halaman (terukur)`,
    taksir === halaman && Math.abs(taksir - halaman) / halaman <= 0.1,
    `taksir ${taksir}`,
  );
}
const UKUR_ASADIYAH: [number, number][] = [
  [3134, 14],
  [6100, 26],
];
for (const [kata, halaman] of UKUR_ASADIYAH) {
  const taksir = estimasiHalamanDariKata(kata, FORMAT_ASADIYAH);
  cek(
    `A4 asadiyah ${kata} kata tertaksir ${halaman} halaman (terukur)`,
    taksir === halaman && Math.abs(taksir - halaman) / halaman <= 0.1,
    `taksir ${taksir}`,
  );
}

cek(
  "A5 konstanta batas strip footnote sama dengan konstanta penaksir standar",
  KATA_PER_HALAMAN === FORMAT_STANDAR.kataPerHalaman,
  `${KATA_PER_HALAMAN} vs ${FORMAT_STANDAR.kataPerHalaman}`,
);
cek(
  "A5b alat ortografi mandiri memakai pembagi terkalibrasi yang sama (tutup L2 telaah Tahap 10)",
  periksaOrtografi(Array.from({ length: 6100 }, () => "كلمة").join(" ")).statistik
    .halamanPerkiraan === Math.round(6100 / FORMAT_STANDAR.kataPerHalaman),
  `6100 kata -> ${periksaOrtografi(Array.from({ length: 6100 }, () => "كلمة").join(" ")).statistik.halamanPerkiraan} halaman`,
);
cek(
  "A6 nol kata tertaksir nol halaman, bukan satu",
  estimasiHalamanDariKata(0, FORMAT_STANDAR) === 0 &&
    halamanMentahDariKata(0, FORMAT_STANDAR) === 0,
);
cek(
  "A7 kata untuk halaman: 2 hal = 470, 20 hal = 4700, 100 hal = 23500",
  kataUntukHalaman(2, FORMAT_STANDAR) === 470 &&
    kataUntukHalaman(20, FORMAT_STANDAR) === 4700 &&
    kataUntukHalaman(100, FORMAT_STANDAR) === 23500,
);
cek(
  "A8 target pemilik tercatat apa adanya (2, 20, 100)",
  TARGET_PEMILIK.khalfiyahHalaman === 2 &&
    TARGET_PEMILIK.bab2Halaman === 20 &&
    TARGET_PEMILIK.totalHalaman === 100,
);

// Penghitung kata: penanda sitasi dan markdown tidak dihitung,
// token angka murni tidak dihitung, huruf Arab dan Latin dihitung.
cek(
  "A9 hitung kata membersihkan penanda sitasi dan judul markdown",
  hitungKataNaskah(
    "## عنوان البحث\n\nيدرس الطالب أصول الفقه [[ref:src-1|hlm:3]] في المعهد [^1] كل يوم.",
  ) === 10,
  String(
    hitungKataNaskah(
      "## عنوان البحث\n\nيدرس الطالب أصول الفقه [[ref:src-1|hlm:3]] في المعهد [^1] كل يوم.",
    ),
  ),
);
cek(
  "A10 hitung kata mengabaikan token angka murni",
  hitungKataNaskah("في سنة 2024 صدر الكتاب 123 مرة") === 5,
  String(hitungKataNaskah("في سنة 2024 صدر الكتاب 123 مرة")),
);

/* ================= B. Data pedoman: syaratnya sendiri ================= */

const mangkoso = TEMPLATE_PEDOMAN.find((t) => /mangkoso/i.test(t.namaPedoman))!;
const asadiyah = TEMPLATE_PEDOMAN.find((t) => /as'adiyah/i.test(t.namaPedoman))!;
cek("B1 kedua template permanen ada", !!mangkoso && !!asadiyah);
cek(
  "B2 halaman minimal risalah Mangkoso 150 dari data template (pedoman)",
  mangkoso.halamanMinimalRisalah === 150,
  String(mangkoso.halamanMinimalRisalah),
);
cek(
  "B3 halaman minimal risalah As'adiyah 40 dari data template (pedoman)",
  asadiyah.halamanMinimalRisalah === 40,
  String(asadiyah.halamanMinimalRisalah),
);
cek(
  "B4 skema struktur pedoman menerima bidang halaman minimal",
  SkemaStrukturPedoman.safeParse(mangkoso).success &&
    SkemaStrukturPedoman.safeParse(asadiyah).success,
);

/* ================= C. Target masuk struktur dan generasi ================= */

const JUDUL = "أثر أصول الفقه في الحياة المعاصرة";
const RUMUSAN = [
  "ما مفهوم أصول الفقه عند العلماء؟",
  "كيف يظهر أثر أصول الفقه في الحياة المعاصرة؟",
  "ما العوامل المؤثرة في ذلك الأثر؟",
];

const pSkripsi = newProject({ jenis: "skripsi", bidangId: "quran", judulAr: JUDUL, rumusan: RUMUSAN });
const stSkripsi = strukturProyek(pSkripsi);
const khalfiyaSkripsi = stSkripsi.chapters
  .flatMap((c) => c.sections)
  .find((s) => s.id === "khalfiya")!;
cek(
  "C1 skripsi: khalfiyah bertarget 2 halaman aturan pemilik",
  khalfiyaSkripsi.targetHalaman === 2 && khalfiyaSkripsi.sumberTarget === "pemilik",
);
cek(
  "C2 skripsi: target kata khalfiyah diturunkan dari halaman (470), bukan generik 900",
  khalfiyaSkripsi.targetKata === 470,
  String(khalfiyaSkripsi.targetKata),
);
cek(
  "C3 skripsi: Bab 2 (bab posisi kedua) bertarget 20 halaman aturan pemilik",
  stSkripsi.chapters[1]?.targetHalaman === 20 &&
    stSkripsi.chapters[1]?.sumberTarget === "pemilik",
  stSkripsi.chapters[1]?.labelId,
);
cek(
  "C4 bab selain Bab 2 tidak menerima target bab pemilik",
  stSkripsi.chapters.every((c, i) => i === 1 || c.targetHalaman === undefined),
);

const pJurnal = newProject({ jenis: "jurnal", bidangId: "quran", judulAr: JUDUL });
const stJurnal = strukturProyek(pJurnal);
cek(
  "C5 jurnal: tidak ada target halaman pemilik di bagian maupun bab",
  stJurnal.chapters.every(
    (c) =>
      c.targetHalaman === undefined &&
      c.sections.every((s) => s.targetHalaman === undefined),
  ),
);

function proyekTemplate(tpl: typeof mangkoso): Project {
  return newProject({
    bidangId: "quran",
    judulAr: JUDUL,
    rumusan: RUMUSAN,
    strukturPedoman: tpl,
    daftarIsi: susunDaftarIsiOtomatis(tpl, JUDUL).daftar,
  });
}
const pMk = proyekTemplate(mangkoso);
const stMk = strukturProyek(pMk);
const khalfiyaMk = stMk.chapters
  .flatMap((c) => c.sections)
  .find((s) => s.id === "khalfiya");
cek(
  "C6 proyek template Mangkoso: khalfiyah terpetakan dan bertarget halaman pemilik",
  !!khalfiyaMk && khalfiyaMk.targetHalaman === 2 && khalfiyaMk.targetKata === 470,
);
cek(
  "C7 format proyek Mangkoso adalah format standar, As'adiyah formatnya sendiri",
  formatHalamanProyek(pMk).id === "standar" &&
    formatHalamanProyek(proyekTemplate(asadiyah)).id === "asadiyah",
);

// Target yang hidup di struktur benar-benar dibaca jalur generasi:
// prompt pengembangan Tahap 8 menerima targetKata dari struktur
// proyek (jalur yang sama dengan yang diserahkan tulis-tab).
const promptTarget = buatPromptKembangkan({
  judul: JUDUL,
  namaBagian: "خلفية البحث",
  teks: "نص قصير قيد التطوير.",
  targetKata: khalfiyaSkripsi.targetKata,
});
cek(
  "C8 prompt pengembangan menyebut target kata turunan halaman (470)",
  !!promptTarget && promptTarget.includes("المستهدف") && promptTarget.includes("470"),
);

/* ================= D. Ringkasan capaian yang jujur ================= */

const rKosong = ringkasanPanjangProyek(pSkripsi);
cek(
  "D1 proyek kosong: baris pemilik khalfiyah, bab2, total; semua belum tercapai",
  rKosong.baris.map((b) => b.kunci).join(",") === "khalfiyah,bab2,total-pemilik" &&
    rKosong.baris.every((b) => !b.tercapai) &&
    rKosong.halamanTotal === 0 &&
    rKosong.kataTotal === 0,
  rKosong.baris.map((b) => b.kunci).join(","),
);

const kataN = (n: number) => Array.from({ length: n }, () => "كلمة").join(" ");
const pKhalfiyahPenuh: Project = {
  ...pSkripsi,
  draf: { ...pSkripsi.draf, khalfiya: kataN(470) },
};
const rPenuh = ringkasanPanjangProyek(pKhalfiyahPenuh);
const barisKhalfiyah = rPenuh.baris.find((b) => b.kunci === "khalfiyah")!;
cek(
  "D2 khalfiyah 470 kata dinyatakan tercapai pada target 2 halaman",
  barisKhalfiyah.tercapai && barisKhalfiyah.halamanMentah >= 2,
  `${barisKhalfiyah.halamanMentah} halaman`,
);
cek(
  "D3 total 470 kata tetap belum tercapai pada target 100 halaman",
  rPenuh.baris.find((b) => b.kunci === "total-pemilik")!.tercapai === false,
);

const pTotalPenuh: Project = {
  ...pSkripsi,
  draf: { ...pSkripsi.draf, khalfiya: kataN(23500) },
};
const rTotal = ringkasanPanjangProyek(pTotalPenuh);
cek(
  "D4 total 23500 kata dinyatakan tercapai pada target pemilik 100 halaman",
  rTotal.baris.find((b) => b.kunci === "total-pemilik")!.tercapai &&
    rTotal.halamanTotal >= 100,
  `${rTotal.halamanTotal} halaman`,
);

const rMk = ringkasanPanjangProyek(pMk);
const barisPemilik = rMk.baris.find((b) => b.kunci === "total-pemilik");
const barisPedoman = rMk.baris.find((b) => b.kunci === "total-pedoman");
cek(
  "D5 label sumber tidak tercampur: total pemilik 100 dan total pedoman 150 berdiri sendiri",
  !!barisPemilik &&
    !!barisPedoman &&
    barisPemilik.targetHalaman === 100 &&
    barisPemilik.sumber === "pemilik" &&
    barisPemilik.labelSumber === "aturan pemilik web" &&
    barisPedoman.targetHalaman === 150 &&
    barisPedoman.sumber === "pedoman" &&
    barisPedoman.labelSumber === "pedoman kampus",
);
const rAs = ringkasanPanjangProyek(proyekTemplate(asadiyah));
cek(
  "D6 proyek As'adiyah: baris pedoman bertarget 40",
  rAs.baris.find((b) => b.kunci === "total-pedoman")?.targetHalaman === 40,
);
cek(
  "D7 proyek tanpa template: tidak ada baris pedoman yang dikarang",
  !rKosong.baris.some((b) => b.kunci === "total-pedoman") &&
    halamanMinimalPedoman(pSkripsi) === null,
);

// Proyek lama: salinan template tersimpan mendahului bidang halaman
// minimal; angka pedoman tetap terbaca dari template bawaannya.
const { halamanMinimalRisalah: _dibuang, ...mangkosoWarisan } = mangkoso;
const pWarisan: Project = { ...pMk, strukturPedoman: mangkosoWarisan as typeof mangkoso };
cek(
  "D8 proyek warisan tanpa bidang baru tetap membaca minimal pedoman 150",
  halamanMinimalPedoman(pWarisan) === 150,
  String(halamanMinimalPedoman(pWarisan)),
);

/* ================= E. Gerbang mutu membaca target ================= */

const gKosong = periksaGerbang(pSkripsi);
const syaratHalaman = gKosong.syarat.find((s) => s.id === "halaman");
cek(
  "E1 gerbang skripsi memuat syarat halaman pemilik dan menyatakannya belum terpenuhi",
  !!syaratHalaman && !syaratHalaman.terpenuhi && syaratHalaman.label.includes("100"),
);
cek(
  "E2 gerbang proyek Mangkoso menyebut syarat pedoman 150 terpisah di rincian",
  (periksaGerbang(pMk).syarat.find((s) => s.id === "halaman")?.detail ?? "").includes(
    "150",
  ),
);
cek(
  "E3 gerbang jurnal tidak memuat syarat halaman pemilik",
  !periksaGerbang(pJurnal).syarat.some((s) => s.id === "halaman"),
);

/* ============ F. Paket Tahap 3 (i): ithar utuh lewat composeSection ============ */

const JUDUL_PANJANG =
  "أثر تطبيق منهج أصول الفقه في تنمية مهارات التفكير النقدي لدى طلبة المعاهد العالية الإسلامية في معالجة قضايا الحياة اليومية المعاصرة";
const bidangQuran = getBidang("quran");
const pKaya = newProject({
  bidangId: "quran",
  judulAr: JUDUL_PANJANG,
  rumusan: RUMUSAN,
  lokasi: "معهد دار الدعوة والإرشاد الإسلامي في منجكوسو بمحافظة سولاويسي الجنوبية",
  populasi: "طلبة المعهد العالي في المستويات الدراسية الأربعة جميعها بلا استثناء",
  fenomenaAr:
    "ضعف توظيف طلبة المعهد العالي لأصول الفقه في معالجة قضايا الحياة اليومية والاجتماعية والمدرسية في بيئتهم المحلية والمجتمعية على حد سواء وبصورة متزايدة عاما بعد عام",
});
const mdIthar = composeSection(pKaya, "ithar").markdown;
cek(
  "F1 fixture ithar kaya benar-benar melewati batas satu halaman lama",
  mdIthar.length > BATAS_HALAMAN,
  `${mdIthar.length} karakter, batas ${BATAS_HALAMAN}`,
);
cek(
  "F2 blok penutup التأصيل النظري sampai utuh lewat composeSection",
  mdIthar.includes("### التأصيل النظري في المصادر الأصلية"),
);
cek(
  "F3 seluruh rujukan kunci bidang sampai di blok penutup ithar",
  bidangQuran.rujukanKunci.every((r) => mdIthar.includes(r)),
  `${bidangQuran.rujukanKunci.length} rujukan kunci`,
);
cek(
  "F4 keempat sub-bab teori bidang sampai utuh di ithar",
  bidangQuran.teori.slice(0, 4).every((t) => mdIthar.includes(t.ar)),
);
cek(
  "F5 pemangkas lama terbukti akan membuang isi yang kini selamat (kelas cacatnya nyata)",
  pangkasSatuHalaman(mdIthar).length < mdIthar.length &&
    bidangQuran.rujukanKunci.some((r) => !pangkasSatuHalaman(mdIthar).includes(r)),
);

/* ====== G. Paket Tahap 3 (ii): fenomena fawaid dan ithar ====== */

const F_KALIMAT =
  "يلاحظ الباحث أن طلبة المعهد يدرسون أصول الفقه نظريا ولا يوظفونه في حياتهم اليومية";
const F_FRASA = "ضعف توظيف أصول الفقه في معالجة قضايا الحياة اليومية لدى الطلبة";
cek(
  "G1 penggolong Tahap 3: fixture kalimat berbentuk kalimat, fixture frasa berbentuk frasa",
  fenomenaBerbentukKalimat(F_KALIMAT) && !fenomenaBerbentukKalimat(F_FRASA),
);

const bersihRef = (teks: string) => teks.replace(/\[\[ref:[^\]]+\]\]/g, "");
const blokProsa = (md: string): string[] =>
  bersihRef(md)
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));

function proyekFenomena(fenomena: string): Project {
  return newProject({
    bidangId: "quran",
    judulAr: JUDUL,
    rumusan: RUMUSAN,
    lokasi: "معهد دار الدعوة والإرشاد",
    populasi: "طلبة المعهد العالي",
    fenomenaAr: fenomena,
  });
}

for (const bagian of ["fawaid", "ithar"] as const) {
  let semuaBerdiriSendiri = true;
  let adaBlokSendiri = true;
  for (let seed = 0; seed < 12; seed++) {
    const md = composeSection(proyekFenomena(F_KALIMAT), bagian, seed).markdown;
    const blok = blokProsa(md);
    // Fenomena wajib hadir sebagai blok kalimatnya sendiri.
    if (!blok.some((b) => b === `${F_KALIMAT}.`)) adaBlokSendiri = false;
    // Dan tidak boleh muncul tersemat di dalam blok lain mana pun.
    for (const b of blok) {
      if (b !== `${F_KALIMAT}.` && b.includes("يلاحظ الباحث أن")) {
        semuaBerdiriSendiri = false;
      }
    }
    // Pola rusak persis temuan telaah tidak boleh muncul.
    if (md.includes("في يلاحظ الباحث") || md.includes("لتحسين يلاحظ الباحث")) {
      semuaBerdiriSendiri = false;
    }
  }
  cek(
    `G2 ${bagian}: fenomena berbentuk kalimat berdiri sebagai kalimat sendiri (12 benih)`,
    adaBlokSendiri,
  );
  cek(
    `G3 ${bagian}: fenomena berbentuk kalimat tidak tersemat rusak di tengah frasa (12 benih)`,
    semuaBerdiriSendiri,
  );

  let adaTersematWajar = false;
  let adaBlokPaksa = false;
  for (let seed = 0; seed < 12; seed++) {
    const md = composeSection(proyekFenomena(F_FRASA), bagian, seed).markdown;
    const blok = blokProsa(md);
    if (blok.some((b) => b === `${F_FRASA}.`)) adaBlokPaksa = true;
    // Tersemat wajar: fenomena frasa muncul di dalam blok yang lebih
    // panjang darinya (di dalam kalimat bank), bukan berdiri sendiri.
    if (blok.some((b) => b.includes(F_FRASA) && b.length > F_FRASA.length + 10)) {
      adaTersematWajar = true;
    }
  }
  cek(
    `G4 ${bagian}: fenomena berbentuk frasa tetap tersemat wajar di dalam frasa bank`,
    adaTersematWajar,
  );
  cek(
    `G5 ${bagian}: fenomena berbentuk frasa tidak dipaksa berdiri sendiri`,
    !adaBlokPaksa,
  );
}

console.log(
  gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`,
);
if (gagal > 0) process.exit(1);
