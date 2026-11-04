/**
 * Uji penerimaan Pembangunan Ulang Tahap 9: Tab Istilah sadar isi
 * draf (butir B11).
 *
 * Yang dibuktikan:
 * - Hitungan kemunculan membaca gabungan SEMUA bagian draf proyek
 *   itu sendiri, per kata utuh, dengan normalisasi dasar yang sama
 *   untuk padanan Arab dan label: draf berharakat terhitung, bagian
 *   kata lain tidak terhitung, kata dengan alif lam tidak cocok
 *   dengan frasa tanpa alif lam.
 * - Kasus B11 persis: teori bidang pertama (padanannya menyimpan
 *   rincian dalam kurung pada data bidang) yang bentuk intinya
 *   tertanam di draf muncul sebagai saran DARI draf dengan hitungan
 *   yang sama dengan hitungan manual, dan sesudah ditambah menjadi
 *   istilah, tab melaporkan hitungan itu (bukan 0). Istilah yang
 *   tidak ada di draf terbaca 0 dan tidak masuk saran dari draf.
 * - Ketidakkonsistenan terbukti dari data: padanan yang hanya muncul
 *   sebagai varian penulisan (ta marbuta ditulis ha, kursi hamzah
 *   berbeda) dilaporkan sebagai varian dengan kutipan drafnya, bukan
 *   sebagai terpakai dan bukan sebagai 0 senyap; label yang muncul
 *   tanpa padanannya berstatus label-saja; konflik padanan lama tetap
 *   terdeteksi dan beda harakat tidak dianggap beda padanan.
 * - Analisis murni: data istilah lama tidak berubah.
 * - Rantai komponen: istilah-tab.tsx memakai mesin yang sama
 *   (analisisIstilahProyek, saranDariDraf, bentukIntiAr), penghitung
 *   regex lama tidak ada lagi, kelompok usulan bidang berlabel jujur
 *   "(belum terdeteksi di draf)".
 *
 * Jalankan: npx tsx scripts/test-tahap9-istilah.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

/** Hitungan manual independen untuk pembanding silang: buang harakat
 *  dari seluruh teks, satukan alif, lalu hitung frasa sebagai kata
 *  utuh yang diapit spasi pada teks yang dirapikan spasinya. */
function hitungManual(teks: string, frasa: string): number {
  const bersih = (s: string) =>
    ` ${s
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .toLowerCase()
      .trim()} `;
  const t = bersih(teks);
  const f = bersih(frasa).trim();
  if (!f) return 0;
  let n = 0;
  let i = t.indexOf(` ${f} `);
  while (i >= 0) {
    n++;
    i = t.indexOf(` ${f} `, i + 1);
  }
  return n;
}

async function main() {
  const { newProject } = await import("../lib/engine/project");
  type Project = import("../lib/engine/project").Project;
  type Istilah = import("../lib/engine/project").Istilah;
  const {
    teksDrafProyek,
    hitungFrasa,
    analisisIstilahProyek,
    statusIstilah,
    konflikPadanan,
    bentukIntiAr,
    saranDariDraf,
  } = await import("../lib/engine/istilah");
  const { getBidang } = await import("../lib/content/bidang");

  const DRAF_BAB1 =
    "يتناول هذا البحث التَّفْسِيرَ الْمَوْضُوعِيَّ في القرآن الكريم، ويبين أن التفسير الموضوعي منهج معاصر في الدراسات القرآنية. كما يعرض المدرسه النبوية في التربية، ويذكر المسئولية العلمية في البحث.";
  const DRAF_BAB2 =
    "Metode tafsir tematik atau penafsiran tematik dipakai di sini. Istilah penafsiran tematik muncul lagi dalam bab ini.";

  const istilahFixture: Istilah[] = [
    { id: "ist-1", id_label: "penafsiran tematik", ar: "التفسير الموضوعي" },
    { id: "ist-2", id_label: "sekolah kenabian", ar: "المدرسة النبوية" },
    { id: "ist-3", id_label: "tanggung jawab ilmiah", ar: "المسؤولية العلمية" },
    { id: "ist-4", id_label: "nasakh mansukh", ar: "الناسخ والمنسوخ" },
    { id: "ist-5", id_label: "metode tafsir", ar: "مناهج التفسير" },
  ];

  const proyek = newProject({
    bidangId: "quran",
    istilah: istilahFixture.map((t) => ({ ...t })),
    draf: { "bab-2": DRAF_BAB2, "bab-1": DRAF_BAB1 },
  }) as Project;

  // A. Teks draf yang dibaca adalah gabungan semua bagian.
  const teks = teksDrafProyek(proyek);
  cek("A1 teks draf memuat semua bagian", teks.includes(DRAF_BAB1) && teks.includes(DRAF_BAB2));
  cek(
    "A2 urutan gabungan deterministik menurut kunci bagian",
    teks.indexOf(DRAF_BAB1) < teks.indexOf(DRAF_BAB2),
  );

  // B. Hitungan padanan dan label terhadap fixture.
  const analisis = analisisIstilahProyek(proyek);
  const per = new Map(analisis.map((a) => [a.istilah.id, a]));
  cek(
    "B1 padanan berharakat dan polos terhitung semua",
    per.get("ist-1")?.munculAr === 2,
    `munculAr=${per.get("ist-1")?.munculAr}`,
  );
  cek(
    "B2 hitungan mesin sama dengan hitungan manual independen",
    per.get("ist-1")?.munculAr === hitungManual(teks, "التفسير الموضوعي"),
    `manual=${hitungManual(teks, "التفسير الموضوعي")}`,
  );
  cek(
    "B3 label Latin tidak peka huruf besar terhitung",
    per.get("ist-1")?.munculLabel === 2,
    `munculLabel=${per.get("ist-1")?.munculLabel}`,
  );
  cek(
    "B4 istilah yang tidak ada di draf terbaca 0 secara jujur",
    per.get("ist-4")?.munculAr === 0 && per.get("ist-4")?.munculLabel === 0,
  );
  cek(
    "B5 label muncul tanpa padanan terhitung pada labelnya saja",
    per.get("ist-5")?.munculLabel === 1 && per.get("ist-5")?.munculAr === 0,
  );

  // C. Batas kata utuh: bagian kata dan beda alif lam tidak terhitung.
  cek(
    "C1 frasa yang hanya menjadi bagian kata lain tidak terhitung",
    hitungFrasa("المعلومات كثيرة في هذا الباب", "علم").dasar === 0,
  );
  cek(
    "C2 kata ber-alif lam tidak cocok dengan frasa tanpa alif lam",
    hitungFrasa("العلم نور والجهل ظلام", "علم").dasar === 0,
  );
  cek(
    "C3 frasa kosong tidak menghasilkan hitungan",
    hitungFrasa(DRAF_BAB1, "  ").dasar === 0 && hitungFrasa("", "التفسير").dasar === 0,
  );

  // D. Varian penulisan: terbukti dari data, dengan kutipan.
  cek(
    "D1 ta marbuta yang ditulis ha terdeteksi sebagai varian, bukan terpakai",
    per.get("ist-2")?.munculAr === 0 && per.get("ist-2")?.varianAr === 1,
    `dasar=${per.get("ist-2")?.munculAr} varian=${per.get("ist-2")?.varianAr}`,
  );
  cek(
    "D2 kutipan varian adalah potongan draf sebenarnya",
    per.get("ist-2")?.kutipanVarian === "المدرسه النبوية",
    `kutipan=${per.get("ist-2")?.kutipanVarian}`,
  );
  cek(
    "D3 kursi hamzah berbeda (ؤ lawan ئ) terdeteksi sebagai varian",
    per.get("ist-3")?.munculAr === 0 && per.get("ist-3")?.varianAr === 1,
    `dasar=${per.get("ist-3")?.munculAr} varian=${per.get("ist-3")?.varianAr}`,
  );
  cek(
    "D4 varian tidak bocor ke hitungan bentuk tetap istilah lain",
    per.get("ist-1")?.varianAr === 0,
  );

  // E. Status turunan untuk penanda ketidakkonsistenan.
  cek("E1 status dipakai", statusIstilah(per.get("ist-1")!) === "dipakai");
  cek("E2 status varian", statusIstilah(per.get("ist-2")!) === "varian");
  cek("E3 status label-saja", statusIstilah(per.get("ist-5")!) === "label-saja");
  cek("E4 status tidak-muncul", statusIstilah(per.get("ist-4")!) === "tidak-muncul");

  // F. Konflik padanan lama, dengan normalisasi yang sama.
  const konflik = konflikPadanan([
    { id: "k1", id_label: "Tafsir", ar: "التفسير" },
    { id: "k2", id_label: "tafsir", ar: "التأويل" },
    { id: "k3", id_label: "Hadis", ar: "الحديث" },
  ]);
  cek("F1 satu label dua padanan terdeteksi sebagai konflik", konflik.length === 1 && konflik[0].length === 2);
  const bukanKonflik = konflikPadanan([
    { id: "k4", id_label: "Tafsir", ar: "التفسير" },
    { id: "k5", id_label: "Tafsir", ar: "التَّفْسِير" },
  ]);
  cek("F2 beda harakat pada padanan yang sama bukan konflik", bukanKonflik.length === 0);

  // G. Kasus B11 persis: saran dari draf untuk teori bidang quran.
  const teoriQuran = getBidang("quran").teori;
  cek(
    "G1 data bidang memang menyimpan rincian kurung pada padanan teori pertama",
    teoriQuran[0].ar.includes("("),
    teoriQuran[0].ar,
  );
  cek(
    "G2 bentuk inti membuang rincian kurung",
    bentukIntiAr(teoriQuran[0].ar) === "مناهج التفسير",
    bentukIntiAr(teoriQuran[0].ar),
  );
  const proyek2 = newProject({
    bidangId: "quran",
    istilah: [],
    draf: {
      "bab-1":
        "يعتمد هذا البحث مناهج التفسير في جمع الآيات وترتيبها، وتعد مناهج التفسير أساس هذه الدراسة. كما يراجع قواعد التفسير وأصوله عند المتقدمين.",
    },
  }) as Project;
  const saran = saranDariDraf(proyek2, teoriQuran);
  cek(
    "G3 saran utama hanya berisi teori yang benar-benar muncul di draf",
    saran.length === 2 && saran.every((s) => s.munculAr + s.munculLabel > 0),
    `jumlah=${saran.length}`,
  );
  cek(
    "G4 saran teratas adalah istilah paling sering muncul dengan hitungan manual yang sama",
    saran[0]?.ar === "مناهج التفسير" && saran[0]?.munculAr === 2 &&
      saran[0].munculAr === hitungManual(teksDrafProyek(proyek2), "مناهج التفسير"),
    `ar=${saran[0]?.ar} munculAr=${saran[0]?.munculAr}`,
  );
  cek(
    "G5 teori tanpa kemunculan tidak masuk saran dari draf",
    !saran.some((s) => s.ar === "الإعجاز القرآني"),
  );
  const proyek3 = newProject({
    bidangId: "quran",
    istilah: [{ id: "ist-baru", id_label: saran[0].id, ar: saran[0].ar }],
    draf: { ...proyek2.draf },
  }) as Project;
  const analisis3 = analisisIstilahProyek(proyek3);
  cek(
    "G6 istilah yang baru ditambah dari saran draf langsung terbaca hitungan sebenarnya, bukan 0",
    analisis3[0]?.munculAr === 2,
    `munculAr=${analisis3[0]?.munculAr}`,
  );
  cek(
    "G7 teori yang sudah menjadi istilah tidak disarankan ulang",
    !saranDariDraf(proyek3, teoriQuran).some((s) => s.ar === "مناهج التفسير"),
  );

  // H. Analisis murni: data lama utuh.
  const sebelum = JSON.stringify(proyek.istilah);
  analisisIstilahProyek(proyek);
  saranDariDraf(proyek, teoriQuran);
  konflikPadanan(proyek.istilah);
  cek("H1 data istilah proyek tidak berubah oleh analisis", JSON.stringify(proyek.istilah) === sebelum);
  cek(
    "H2 analisis mengembalikan objek istilah yang sama (tanpa salinan bermutasi)",
    analisis.every((a, i) => a.istilah === proyek.istilah[i]),
  );

  // I. Rantai komponen: tab memakai mesin yang sama.
  const sumberTab = readFileSync(
    path.join(process.cwd(), "components/workspace/istilah-tab.tsx"),
    "utf8",
  );
  cek(
    "I1 tab mengimpor penghitung dari lib/engine/istilah",
    sumberTab.includes('from "@/lib/engine/istilah"') &&
      sumberTab.includes("analisisIstilahProyek") &&
      sumberTab.includes("saranDariDraf"),
  );
  cek(
    "I2 penghitung regex mentah lama sudah tidak ada di tab",
    !sumberTab.includes("new RegExp") && !sumberTab.includes("draf.match"),
  );
  cek(
    "I3 kelompok saran dari draf dan label jujur usulan bidang tampil di tab",
    sumberTab.includes("Terdeteksi di draf Anda") &&
      sumberTab.includes("(belum terdeteksi di draf)"),
  );
  cek(
    "I4 chip menambah istilah dengan bentuk inti padanan",
    sumberTab.includes("bentukIntiAr(t.ar)") && sumberTab.includes("ar: s.ar"),
  );
  cek(
    "I5 penanda ketidakkonsistenan tampil di tab",
    sumberTab.includes("Padanan belum dipakai di draf") &&
      sumberTab.includes("Bentuk lain dari padanan tetap"),
  );

  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
