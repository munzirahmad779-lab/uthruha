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
 * - Perbaikan telaah Tahap 9: (S1) kemunculan berpartikel menempel
 *   (و/ف/ب/ل/ك) terhitung, dibuktikan pada fixture prosa realistis
 *   dengan pembanding manual sadar partikel yang ditulis ulang
 *   dengan cara berbeda dari mesin, plus kontrol kata berakar و
 *   yang tidak boleh termakan pelucutan; (S2) istilah warisan chip
 *   lama (ar penuh berketerangan kurung) terhitung dari bentuk
 *   intinya di lapis baca tanpa mengubah data, dan pengelompokan
 *   konflik memakai kunci inti yang sama; (R1) entri berpadanan
 *   kosong tidak membentuk konflik semu.
 * - Perbaikan telaah ulang Tahap 9: (S1-b) partikel tumpuk dua
 *   lapis tanpa alif lam (وبمناهج، وبسبب، فبسبب، ولسبب) terhitung
 *   dasar, dengan pagar yang sama dan pengecualian token berawalan
 *   لل terasimilasi yang tidak berubah; (R1 sisa) anggota grup
 *   konflik yang dikembalikan tidak lagi memuat entri berpadanan
 *   kosong.
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

/** Pembanding manual sadar partikel, ditulis dengan cara yang
 *  BERBEDA dari mesin: seluruh teks ditulis ulang kata demi kata
 *  (tiap kata dilucuti partikel depannya dengan putaran huruf di
 *  sini: maks dua lapis, lapis kedua hanya untuk preposisi ب/ل/ك
 *  dan tidak untuk token berawalan لل terasimilasi, sisa kata
 *  minimal 3 huruf), lalu frasa dihitung sebagai substring
 *  berlapis spasi pada teks hasil tulisan ulang itu. Mesin tidak
 *  menulis ulang teks; ia membandingkan jendela token terhadap
 *  himpunan bentuk tiap token, jadi kesepakatan keduanya bukan
 *  kesepakatan kode yang sama dengan dirinya. */
function hitungManualPartikel(teks: string, frasa: string): number {
  const norm = (s: string) =>
    s
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .toLowerCase();
  const lucuti = (k: string): string => {
    if (k.length >= 4 && "وفبلك".includes(k[0])) {
      const sisa = k.slice(1);
      if (
        sisa.length >= 4 &&
        "بلك".includes(sisa[0]) &&
        !(k[0] === "ل" && sisa[0] === "ل")
      ) {
        return sisa.slice(1);
      }
      return sisa;
    }
    return k;
  };
  const kataTeks = norm(teks).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(lucuti);
  const kataFrasa = norm(frasa).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (kataFrasa.length === 0 || kataTeks.length === 0) return 0;
  const t = ` ${kataTeks.join(" ")} `;
  const f = ` ${kataFrasa.join(" ")} `;
  let n = 0;
  let i = t.indexOf(f);
  while (i >= 0) {
    n++;
    i = t.indexOf(f, i + 1);
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

  // J. Perbaikan telaah S1: partikel menempel tidak melenyapkan kemunculan.
  cek(
    "J1 kemunculan tunggal berawalan و terhitung (kasus probe Q2)",
    hitungFrasa("والعلم نور", "العلم").dasar === 1,
  );
  const teksQ6 = "المدرسة النبوية أصل، والمدرسة النبوية فرع، والمدرسه النبوية ثالثة";
  const hitQ6 = hitungFrasa(teksQ6, "المدرسة النبوية");
  cek(
    "J2 tiga kemunculan realistis: 2 dasar + 1 varian, tidak ada yang lenyap (kasus probe Q6)",
    hitQ6.dasar === 2 && hitQ6.varian === 1 && hitQ6.dasar + hitQ6.varian === 3,
    `dasar=${hitQ6.dasar} varian=${hitQ6.varian}`,
  );
  cek(
    "J3 hitungan dasar Q6 sama dengan pembanding manual sadar partikel",
    hitQ6.dasar === hitungManualPartikel(teksQ6, "المدرسة النبوية"),
    `manual=${hitungManualPartikel(teksQ6, "المدرسة النبوية")}`,
  );
  cek(
    "J4 partikel pada token tengah frasa terhitung",
    hitungFrasa("أدرس مناهج والتفسير في هذا الباب", "مناهج التفسير").dasar === 1,
  );
  cek(
    "J5 awalan ب dan ف terhitung",
    hitungFrasa("بالعلم يسمو الإنسان، فالعلم غايته", "العلم").dasar === 2,
  );
  const DRAF_PROSA =
    "والعلم نور يهدي الباحث، وسبب النزول معروف في بابه، وقد بيّن ومناهج التفسير ذلك. وكان العلم أساسا متينا، وبالعلم يتقدم البحث، فالعلم غاية كل طالب. والوحدة أصل في الجماعة.";
  for (const [frasa, harap] of [
    ["العلم", 4],
    ["سبب النزول", 1],
    ["مناهج التفسير", 1],
  ] as const) {
    cek(
      `J6 prosa realistis: "${frasa}" terhitung ${harap} dan sama dengan manual partikel`,
      hitungFrasa(DRAF_PROSA, frasa).dasar === harap &&
        hitungFrasa(DRAF_PROSA, frasa).dasar === hitungManualPartikel(DRAF_PROSA, frasa),
      `mesin=${hitungFrasa(DRAF_PROSA, frasa).dasar} manual=${hitungManualPartikel(DRAF_PROSA, frasa)}`,
    );
  }
  const DRAF_AKAR = "وضع الباحث منهجه ووصف الظاهرة وورد الخبر في النص. الوحدة أصل في هذا الباب.";
  cek(
    "J7 kontrol akar و: وضع terhitung persis 1 (bentuk polosnya sendiri)",
    hitungFrasa(DRAF_AKAR, "وضع").dasar === 1 &&
      hitungManualPartikel(DRAF_AKAR, "وضع") === 1,
  );
  cek(
    "J8 pelucutan tidak memakan huruf akar: صف dan رد tetap 0 dari ووصف وورد",
    hitungFrasa(DRAF_AKAR, "صف").dasar === 0 && hitungFrasa(DRAF_AKAR, "رد").dasar === 0,
  );
  cek(
    "J9 kontrol probe Q5: الوحدة terhitung persis 1",
    hitungFrasa(DRAF_AKAR, "الوحدة").dasar === 1,
  );
  const proyek4 = newProject({
    bidangId: "quran",
    istilah: [],
    draf: {
      "bab-1": "تناول البحث وسبب النزول أولا، ثم عاد وسبب النزول ثانيا في الباب نفسه.",
    },
  }) as Project;
  const saranPartikel = saranDariDraf(proyek4, [
    { ar: "سبب النزول", id: "asbab al-nuzul" },
    { ar: "قواعد التفسير", id: "qawaid al-tafsir" },
  ]);
  cek(
    "J10 kandidat yang hanya muncul berpartikel tetap disarankan dengan hitungan sebenarnya (kasus probe Q7)",
    saranPartikel.length === 1 && saranPartikel[0].ar === "سبب النزول" && saranPartikel[0].munculAr === 2,
    `jumlah=${saranPartikel.length} munculAr=${saranPartikel[0]?.munculAr}`,
  );
  const proyek5 = newProject({
    bidangId: "quran",
    istilah: [{ id: "ist-p", id_label: "metode tafsir", ar: "مناهج التفسير" }],
    draf: { "bab-1": "ومناهج التفسير أساس هذا البحث ومنهجه." },
  }) as Project;
  const analisis5 = analisisIstilahProyek(proyek5);
  cek(
    "J11 istilah terdaftar yang hanya muncul berpartikel terbaca dipakai, bukan 0 (kasus probe Q8)",
    analisis5[0]?.munculAr === 1 && statusIstilah(analisis5[0]) === "dipakai",
    `munculAr=${analisis5[0]?.munculAr}`,
  );
  cek(
    "J12 batas dinyatakan: alif lam terasimilasi (للعلم) tidak dilucuti ke bentuk tetap",
    hitungFrasa("للعلم أثر كبير في النفوس", "العلم").dasar === 0,
  );

  // K. Perbaikan telaah S2: data warisan chip lama terhitung dari intinya.
  const AR_WARISAN = "مناهج التفسير (التحليلي، الإجمالي، المقارن، الموضوعي)";
  const proyekWaris = newProject({
    bidangId: "quran",
    istilah: [{ id: "war-1", id_label: "metode tafsir", ar: AR_WARISAN }],
    draf: {
      "bab-1":
        "يعتمد البحث مناهج التفسير في الجمع، ويذكر مَنَاهِجَ التَّفْسِيرِ ثانيا، ومناهج التفسير ثالثا.",
    },
  }) as Project;
  const analisisWaris = analisisIstilahProyek(proyekWaris);
  cek(
    "K1 istilah warisan berketerangan kurung terhitung dari intinya pada draf berharakat (kasus probe P2)",
    analisisWaris[0]?.munculAr === 3 &&
      analisisWaris[0].munculAr === hitungManualPartikel(teksDrafProyek(proyekWaris), "مناهج التفسير"),
    `munculAr=${analisisWaris[0]?.munculAr} manual=${hitungManualPartikel(teksDrafProyek(proyekWaris), "مناهج التفسير")}`,
  );
  cek(
    "K2 data warisan tersimpan tidak diubah oleh hitungan lapis baca",
    proyekWaris.istilah[0].ar === AR_WARISAN,
  );
  cek(
    "K3 entri warisan dan entri inti berlabel sama bukan konflik semu dan tidak luput pengelompokan",
    konflikPadanan([
      { id: "w1", id_label: "Metode", ar: AR_WARISAN },
      { id: "w2", id_label: "metode", ar: "مناهج التفسير" },
    ]).length === 0,
  );
  cek(
    "K4 konflik nyata tetap terdeteksi bila satu sisi entri warisan",
    konflikPadanan([
      { id: "w3", id_label: "Tafsir", ar: "التفسير (الموضوعي)" },
      { id: "w4", id_label: "tafsir", ar: "التأويل" },
    ]).length === 1,
  );

  // L. Perbaikan telaah R1: padanan kosong tidak membentuk konflik semu.
  cek(
    "L1 satu padanan nyata + satu padanan kosong bukan konflik (kasus probe P8)",
    konflikPadanan([
      { id: "r1", id_label: "Tafsir", ar: "التفسير" },
      { id: "r2", id_label: "tafsir", ar: "" },
    ]).length === 0,
  );
  cek(
    "L2 konflik dua padanan nyata tetap terdeteksi di samping entri berpadanan kosong",
    konflikPadanan([
      { id: "r3", id_label: "Tafsir", ar: "التفسير" },
      { id: "r4", id_label: "tafsir", ar: "التأويل" },
      { id: "r5", id_label: "Tafsir", ar: "" },
    ]).length === 1,
  );

  // M. Perbaikan telaah ulang S1-b: partikel tumpuk tanpa alif lam.
  cek(
    "M1 tumpuk و + ب tanpa alif lam terhitung dasar (fixture penelaah وبمناهج التفسير)",
    hitungFrasa("اعتمد البحث وبمناهج التفسير في الجمع والترتيب", "مناهج التفسير").dasar === 1 &&
      hitungManualPartikel("اعتمد البحث وبمناهج التفسير في الجمع والترتيب", "مناهج التفسير") === 1,
  );
  cek(
    "M2 tumpuk و + ب pada kata pertama frasa terhitung dasar (fixture وبسبب النزول)",
    hitungFrasa("وبسبب النزول ألف العلماء كتبا كثيرة", "سبب النزول").dasar === 1 &&
      hitungManualPartikel("وبسبب النزول ألف العلماء كتبا كثيرة", "سبب النزول") === 1,
  );
  cek(
    "M3 tumpuk ف + ب terhitung dasar (fixture فبسبب)",
    hitungFrasa("فبسبب ذلك اختلف المتقدمون في الحكم", "سبب").dasar === 1 &&
      hitungManualPartikel("فبسبب ذلك اختلف المتقدمون في الحكم", "سبب") === 1,
  );
  const PROSA_TUMPUK =
    "إن سبب النزول مهم، وسبب النزول عند الزركشي مشهور، ولسبب النزول كتب خاصة";
  cek(
    "M4 fixture prosa penelaah: 3 dari 3 kemunculan سبب النزول terhitung (termasuk ولسبب)",
    hitungFrasa(PROSA_TUMPUK, "سبب النزول").dasar === 3 &&
      hitungManualPartikel(PROSA_TUMPUK, "سبب النزول") === 3,
    `mesin=${hitungFrasa(PROSA_TUMPUK, "سبب النزول").dasar}`,
  );
  cek(
    "M5 و akar pada posisi kedua tidak dilucuti: ووحدة terhitung sebagai وحدة, bukan حدة",
    hitungFrasa("ووحدة الأمة مطلب أهلها", "وحدة").dasar === 1 &&
      hitungFrasa("ووحدة الأمة مطلب أهلها", "حدة").dasar === 0 &&
      hitungManualPartikel("ووحدة الأمة مطلب أهلها", "حدة") === 0,
  );
  cek(
    "M5b batas dinyatakan (keputusan verifikasi menyeluruh): وحدة berdiri sendiri melahirkan calon حدة lapis pertama, وحدة sendiri tetap tepat",
    hitungFrasa("وحدة الأمة هدف سام", "حدة").dasar === 1 &&
      hitungFrasa("وحدة الأمة هدف سام", "وحدة").dasar === 1,
  );
  cek(
    "M6 batas terasimilasi tidak berubah: للمدرسة tetap 0 untuk bentuk tetap dan bentuk polosnya",
    hitungFrasa("للمدرسة دور كبير في التربية", "المدرسة").dasar === 0 &&
      hitungFrasa("للمدرسة دور كبير في التربية", "مدرسة").dasar === 0,
  );
  cek(
    "M7 pola lama partikel + alif lam tetap terhitung (وبالعلم)",
    hitungFrasa("وبالعلم يتقدم البحث", "العلم").dasar === 1,
  );
  const proyekTumpuk = newProject({
    bidangId: "quran",
    istilah: [{ id: "ist-t", id_label: "metode tafsir", ar: "مناهج التفسير" }],
    draf: { "bab-1": "اعتمد البحث وبمناهج التفسير في الجمع والترتيب." },
  }) as Project;
  const analisisTumpuk = analisisIstilahProyek(proyekTumpuk);
  cek(
    "M8 istilah terdaftar yang hanya muncul bertumpuk partikel terbaca dipakai, bukan 0",
    analisisTumpuk[0]?.munculAr === 1 && statusIstilah(analisisTumpuk[0]) === "dipakai",
    `munculAr=${analisisTumpuk[0]?.munculAr}`,
  );

  // N. Perbaikan telaah ulang R1 sisa: anggota grup konflik bersih.
  const grupR1 = konflikPadanan([
    { id: "n1", id_label: "Tafsir", ar: "التفسير" },
    { id: "n2", id_label: "tafsir", ar: "التأويل" },
    { id: "n3", id_label: "Tafsir", ar: "" },
  ]);
  cek(
    "N1 grup konflik yang dikembalikan tidak memuat anggota berpadanan kosong",
    grupR1.length === 1 && grupR1[0].length === 2 && grupR1[0].every((x) => (x.ar ?? "").trim()),
    `grup=${grupR1.length} anggota=${grupR1[0]?.length}`,
  );
  const grupR1b = konflikPadanan([
    { id: "n4", id_label: "Tafsir", ar: "التفسير (الموضوعي)" },
    { id: "n5", id_label: "tafsir", ar: "التأويل" },
    { id: "n6", id_label: "Tafsir", ar: "   " },
  ]);
  cek(
    "N2 anggota berpadanan spasi saja juga tersaring, termasuk di samping entri warisan",
    grupR1b.length === 1 && grupR1b[0].length === 2,
    `grup=${grupR1b.length} anggota=${grupR1b[0]?.length}`,
  );

  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
