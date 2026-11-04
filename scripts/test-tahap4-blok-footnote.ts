/**
 * Uji penerimaan Pembangunan Ulang Tahap 4: footnote dari teks yang
 * diblok, panel kandidat dengan kalimat isi, dan penutupan tiga lubang
 * gerbang relevansi (gagal tertutup, pasang persis lewat sidik, Cari
 * Rujukan dan masadir melewati gerbang yang sama).
 *
 * TANPA jaringan luar: kolam diarahkan ke stub lokal OpenAI-compatible
 * (UTH_MODE_UJI + KOLAM_UJI_BASE) yang menjawab penilaian gerbang dan
 * analisis makna dari penanda judul fixture; kandidat datang dari bank
 * rujukan bersama yang diisi fixture lewat simpanKeBank (jalur fungsi
 * yang sama dengan produksi). Kunci penyedia asli dikosongkan dari env
 * proses uji agar failover tidak pernah menyentuh internet.
 *
 * Jalankan: npx tsx scripts/test-tahap4-blok-footnote.ts
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/* ---------- Lingkungan uji: env diatur SEBELUM modul server dimuat ---------- */
for (const k of [
  "GEMINI_API_KEY", "GEMINI_API_KEYS", "GEMINI_API_KEYS_PREMIUM", "GOOGLE_API_KEY",
  "GROQ_API_KEY", "GROQ_API_KEYS", "CLOUDFLARE_API_TOKEN", "CF_API_TOKEN",
  "DEEPSEEK_API_KEY", "DEEPSEEK_API_KEYS", "META_MODEL_API_KEY", "META_MODEL_API_KEYS",
]) {
  delete process.env[k];
}
const dirUji = mkdtempSync(path.join(tmpdir(), "uth-tahap4-"));
process.env.UTH_DATA_FILE = path.join(dirUji, "db.json");
process.env.UTH_MODE_UJI = "1";

/* ---------- Stub kolam: penilai gerbang + pemaham makna ---------- */
const MAKNA_FIXTURE = {
  topikParagraf: "حجية القياس عند الأصوليين",
  klaim: "القياس مصدر من مصادر التشريع يلحق الفرع بالأصل لعلة جامعة",
  kebutuhan: "مصدر أصولي يثبت حجية القياس وحدوده",
  arab: ["القياس في أصول الفقه", "حجية القياس عند الأصوليين"],
  indonesia: ["kias dalam usul fikih"],
  inggris: ["qiyas in usul al-fiqh"],
};

const stub = createServer((req, res) => {
  let badan = "";
  req.on("data", (c) => (badan += c));
  req.on("end", () => {
    let pesan: { role?: string; content?: string }[] = [];
    try {
      pesan = (JSON.parse(badan) as { messages?: { role?: string; content?: string }[] }).messages ?? [];
    } catch {
      /* badan tidak terbaca: jawab kosong */
    }
    const sistem = pesan.find((m) => m.role === "system")?.content ?? "";
    const pengguna = pesan.find((m) => m.role === "user")?.content ?? "";
    const jawab = (isi: string) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: isi } }] }));
    };
    if (sistem.includes("pemaham makna naskah akademik")) {
      jawab(JSON.stringify(MAKNA_FIXTURE));
      return;
    }
    if (sistem.includes("penilai relevansi rujukan akademik")) {
      if (pengguna.includes("MODEL-MATI")) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "stub: penilai mati" }));
        return;
      }
      if (pengguna.includes("TERTAHAN-UJI")) {
        jawab(JSON.stringify({
          sesuai: false,
          skor: 25,
          bidangSumber: "Sosiologi",
          alasan: "Stub uji: kandidat ditandai tidak sesuai bidang proyek.",
        }));
        return;
      }
      jawab(JSON.stringify({
        sesuai: true,
        skor: 88,
        bidangSumber: "",
        alasan: "Stub uji: kandidat sesuai bidang dan kalimat tujuan.",
      }));
      return;
    }
    jawab("{}");
  });
});

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

async function main() {
  await new Promise<void>((resolve) => stub.listen(0, "127.0.0.1", resolve));
  const alamat = stub.address();
  if (!alamat || typeof alamat === "string") throw new Error("stub tidak mendapat port");
  process.env.KOLAM_UJI_BASE = `http://127.0.0.1:${alamat.port}`;

  const { generateFootnoteUntukParagraf, pasangFootnoteDisetujui, pilihKalimatIsi } =
    await import("../lib/server/generate-footnote");
  const { nilaiUntukCariRujukan } = await import("../lib/server/gerbang-relevansi");
  const { simpanKeBank, simpanSidikParagraf } = await import("../lib/server/bank-rujukan");
  type RujukanTamu = import("../lib/server/rujukan").RujukanTamu;

  const JUDUL_PROYEK = "أثر أصول الفقه في الحياة المعاصرة";
  let nomor = 0;
  const ruj = (sebagian: Partial<RujukanTamu> & { judul: string }): RujukanTamu => ({
    id: `uji-t4-${++nomor}`,
    jenis: "buku",
    penulis: ["أحمد الباحث"],
    tahun: "2020",
    wadah: "دار النشر العلمية",
    doi: null,
    isbn: null,
    tautan: "https://example.org/uji",
    terverifikasi: true,
    skor: 0.8,
    kecocokan: 3,
    inti: true,
    umum: false,
    ...sebagian,
  });

  /* ================= Skenario A: mode seleksi ================= */
  const paragrafA =
    "يُعدّ القياس من أهم مصادر التشريع عند الأصوليين، إذ يُلحق الفرع بالأصل في الحكم لعلة جامعة بينهما. " +
    "وقد اختلف العلماء في حجية القياس وحدوده اختلافا واسعا عبر العصور. " +
    "ويظهر أثر القياس في كثير من النوازل المعاصرة التي لم يرد فيها نص صريح.";
  const seleksiA =
    "يُعدّ القياس من أهم مصادر التشريع عند الأصوليين، إذ يُلحق الفرع بالأصل في الحكم لعلة جامعة بينهما.";
  const frasaA = [...MAKNA_FIXTURE.arab, ...MAKNA_FIXTURE.indonesia, ...MAKNA_FIXTURE.inggris];
  const cuplikanA1 =
    "تصدر هذه المجلة العلمية المحكمة عن كلية الشريعة والدراسات الإسلامية منذ سنوات طويلة وتنشر بحوثا محكمة في الدراسات الإسلامية بمختلف فروعها وتخصصاتها العلمية المتنوعة داخل الجامعة وخارجها على حد سواء. " +
    "يثبت هذا البحث أن القياس يلحق الفرع بالأصل في الحكم لعلة جامعة بينهما كما قرره الأصوليون في كتبهم المعتمدة عند التحقيق. " +
    "وتشكر هيئة التحرير الباحثين الكرام على التزامهم الدقيق بشروط النشر العلمي وضوابط التحكيم المعمول بها في المؤسسات الأكاديمية المعاصرة كلها داخل البلاد وخارجها.";
  await simpanKeBank(frasaA, [
    ruj({
      jenis: "jurnal",
      judul: "حجية القياس في أصول الفقه المعاصر",
      wadah: "مجلة الدراسات الأصولية",
      halaman: "45",
      skor: 0.95,
      cuplikan: cuplikanA1,
    }),
    ruj({
      asal: "turath",
      judul: "المستصفى في أصول الفقه",
      penulis: ["أبو حامد الغزالي"],
      tahun: "505هـ",
      skor: 0.9,
      cuplikan: "قال الغزالي: القياس إلحاق فرع بأصل في حكمه لعلة جامعة بينهما عند القائس.",
    }),
    ruj({
      judul: "القياس عند الأصوليين: دراسة تأصيلية مقارنة",
      skor: 0.85,
      cuplikan: "يتناول هذا الكتاب القياس عند الأصوليين من جهة تعريفه وأركانه وشروطه وحجيته عند الجمهور.",
    }),
    ruj({
      judul: "دراسة TERTAHAN-UJI في مناهج التأصيل الأصولي",
      skor: 0.8,
    }),
    ruj({
      judul: "مصادر التشريع الإسلامي ومراتبها عند الأصوليين",
      skor: 0.75,
    }),
    ruj({
      jenis: "jurnal",
      judul: "أثر القياس في النوازل المعاصرة",
      wadah: "مجلة البحوث الفقهية",
      skor: 0.7,
    }),
  ]);
  const hasilA = await generateFootnoteUntukParagraf({
    paragraf: paragrafA,
    seleksi: seleksiA,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("A1 unit pencarian adalah teks seleksi utuh, bukan ekstrak kalimat kunci",
    hasilA.kalimatKunci[0] === seleksiA, `kunci[0]=${(hasilA.kalimatKunci[0] ?? "").slice(0, 40)}…`);
  cek("A2 analisis makna dari model berjalan", hasilA.makna?.dariModel === true);
  cek("A3 hasil datang dari bank fixture (tanpa jaringan)", hasilA.dariBank === true);
  cek("A4 panel menawarkan minimal 3 kandidat lolos",
    (hasilA.kandidat?.length ?? 0) >= 3, `kandidat=${hasilA.kandidat?.length ?? 0}`);
  cek("A5 kandidat jurnal berhalaman membawa kalimat isi yang cocok dari cuplikannya",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("حجية القياس") && (k.kalimatIsi ?? "").includes("يلحق الفرع بالأصل")) === true);
  cek("A6 kalimat isi yang tampil adalah kalimat yang cocok, bukan kalimat lain dari cuplikan",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("حجية القياس") && !(k.kalimatIsi ?? "").includes("هيئة التحرير")) === true);
  cek("A7 kandidat masadir melewati gerbang yang sama dan tampil dengan kalimat isinya",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("المستصفى") && (k.kalimatIsi ?? "").includes("الغزالي")) === true);
  cek("A8 kandidat tanpa cuplikan ditandai tanpa kalimat isi, tidak diisi karangan",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("مصادر التشريع") && k.tanpaKalimatIsi === true && !k.kalimatIsi) === true);
  cek("A9 jurnal tanpa halaman tertahan dengan tanda halaman kosong",
    hasilA.tertahan?.some((t) => t.sumber.judul.includes("أثر القياس") && t.halamanKosong === true) === true);
  cek("A10 kandidat yang ditolak model tertahan dengan sidik, tidak ikut terpasang",
    hasilA.tertahan?.some((t) => t.sumber.judul.includes("TERTAHAN-UJI") && t.sidik.length === 32) === true &&
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("TERTAHAN-UJI")) !== true);
  cek("A11 ketemu karena ada kandidat yang bisa dipilih", hasilA.ketemu === true);

  /* ============ Skenario B: gerbang gagal tertutup (alur kursor) ============ */
  const paragrafB =
    "تُعدّ زكاة المهنة من النوازل الفقهية المعاصرة التي اختلف فيها المعاصرون، إذ لم يرد فيها نص صريح من الكتاب أو السنة. " +
    "ويرى جمهور المعاصرين وجوب الزكاة في رواتب الموظفين قياسا على زكاة المال المستفاد عند حولان الحول.";
  const frasaB = ["زكاة المهنة والرواتب", "zakat profesi", "professional zakat"];
  await simpanSidikParagraf(paragrafB, frasaB);
  await simpanKeBank(frasaB, [
    ruj({ judul: "زكاة المهنة MODEL-MATI دراسة فقهية معاصرة", skor: 0.9 }),
    ruj({ judul: "زكاة الرواتب MODEL-MATI بين المؤيدين والمعارضين", skor: 0.85 }),
  ]);
  const hasilB = await generateFootnoteUntukParagraf({
    paragraf: paragrafB,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("B1 penilai mati: tidak ada kandidat yang terpasang senyap", hasilB.ketemu === false);
  cek("B2 penilai mati: kandidat ditahan sebagai belum dinilai, bukan diloloskan",
    Boolean(hasilB.perluKonfirmasi) && /BELUM dinilai/.test(hasilB.perluKonfirmasi?.alasan ?? ""),
    (hasilB.perluKonfirmasi?.alasan ?? "").slice(0, 60));
  cek("B3 penilai mati: kandidat tertahan membawa sidik persetujuan",
    (hasilB.perluKonfirmasi?.sidik ?? "").length === 32);

  /* ============ Skenario E: pasang persis lewat sidik ============ */
  const sumberB = hasilB.perluKonfirmasi?.sumber;
  const sidikB = hasilB.perluKonfirmasi?.sidik ?? "";
  cek("E0 prasyarat skenario sidik tersedia", Boolean(sumberB) && sidikB.length === 32);
  if (sumberB) {
    const salahIsi = await pasangFootnoteDisetujui({
      sidik: sidikB,
      kandidat: { ...sumberB, judul: `${sumberB.judul} (diubah)` },
      paragraf: paragrafB,
      pemilik: "uji-pemilik",
    });
    cek("E1 sidik menolak data kandidat yang diubah dari yang ditampilkan", salahIsi.ketemu === false);
    const salahPemilik = await pasangFootnoteDisetujui({
      sidik: sidikB,
      kandidat: sumberB,
      paragraf: paragrafB,
      pemilik: "orang-lain",
    });
    cek("E2 sidik tidak berlaku untuk pemilik lain", salahPemilik.ketemu === false);
    const sidikAsing = await pasangFootnoteDisetujui({
      sidik: "f".repeat(32),
      kandidat: sumberB,
      paragraf: paragrafB,
      pemilik: "uji-pemilik",
    });
    cek("E3 sidik yang tidak pernah diterbitkan ditolak", sidikAsing.ketemu === false);
    const pasangPas = await pasangFootnoteDisetujui({
      sidik: sidikB,
      kandidat: sumberB,
      paragraf: paragrafB,
      pemilik: "uji-pemilik",
    });
    cek("E4 sidik memasang PERSIS kandidat yang disetujui",
      pasangPas.ketemu === true && pasangPas.sumber?.judul === sumberB.judul,
      pasangPas.sumber?.judul ?? "");
    cek("E5 kandidat lewat sidik ditandai perlu verifikasi", pasangPas.sumber?.perluVerifikasi === true);
  }

  /* ============ Skenario C: regresi alur kursor lama ============ */
  const paragrafC =
    "تُعدّ الشورى مبدأ أصيلا في النظرية السياسية الإسلامية، وقد ورد الأمر بها في القرآن الكريم في مواضع عدة من كتاب الله. " +
    "واختلف الفقهاء في كون الشورى ملزمة للحاكم أو معلمة له على أقوال معروفة في كتب الفقه السياسي.";
  const frasaC = ["الشورى في الإسلام", "shura dalam islam", "shura in islam"];
  await simpanSidikParagraf(paragrafC, frasaC);
  await simpanKeBank(frasaC, [
    ruj({
      jenis: "jurnal",
      judul: "الشورى في الفقه السياسي الإسلامي المعاصر",
      wadah: "مجلة الشريعة والدراسات الإسلامية",
      halaman: "112",
      skor: 0.9,
      cuplikan: "يقرر هذا البحث أن الشورى مبدأ أصيل في النظرية السياسية الإسلامية بدلالة النصوص الشرعية.",
    }),
  ]);
  const hasilC = await generateFootnoteUntukParagraf({
    paragraf: paragrafC,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("C1 alur kursor lama tetap menemukan dan memasang kandidat lolos",
    hasilC.ketemu === true && (hasilC.sumber?.judul ?? "").includes("الشورى في الفقه السياسي"));
  cek("C2 alur kursor lama memberi indeks kalimat numerik", typeof hasilC.kalimatIdx === "number");

  /* ============ Skenario D: masadir melewati gerbang ============ */
  const paragrafD =
    "قال الشافعي رحمه الله في الرسالة: القياس ما طلب الدليل عليه من إجماع أو خبر ثابت عن رسول الله صلى الله عليه وسلم. " +
    "وهذا النص أصل معتمد في باب الاحتجاج عند الأصوليين جميعا من بعده.";
  const frasaD = ["القياس عند الشافعي", "qiyas menurut syafii", "qiyas according to shafii"];
  await simpanSidikParagraf(paragrafD, frasaD);
  await simpanKeBank(frasaD, [
    ruj({
      asal: "turath",
      judul: "الرسالة في أصول الفقه TERTAHAN-UJI",
      penulis: ["محمد بن إدريس الشافعي"],
      skor: 0.9,
      konsepCocok: 3,
      cuplikan: "قال الشافعي: القياس ما طلب الدليل عليه من إجماع أو خبر.",
    }),
  ]);
  const hasilD = await generateFootnoteUntukParagraf({
    paragraf: paragrafD,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("D1 masadir yang ditolak gerbang TIDAK terpasang senyap seperti dulu",
    hasilD.ketemu === false && (hasilD.perluKonfirmasi?.sumber.judul ?? "").includes("الرسالة"),
    hasilD.perluKonfirmasi?.sumber.judul ?? "(tanpa perluKonfirmasi)");

  const paragrafE =
    "قال الغزالي في المستصفى: القياس حمل معلوم على معلوم في إثبات حكم لهما أو نفيه عنهما بأمر جامع بينهما. " +
    "فجعل القياس بذلك أصلا من أصول الاستنباط عند جمهور الأصوليين.";
  const frasaE = ["المستصفى والقياس", "mustasfa dan kias", "mustasfa qiyas"];
  await simpanSidikParagraf(paragrafE, frasaE);
  await simpanKeBank(frasaE, [
    ruj({
      asal: "turath",
      judul: "المستصفى من علم الأصول",
      penulis: ["أبو حامد الغزالي"],
      skor: 0.9,
      konsepCocok: 3,
      cuplikan: "القياس حمل معلوم على معلوم في إثبات حكم لهما أو نفيه عنهما.",
    }),
  ]);
  const hasilE = await generateFootnoteUntukParagraf({
    paragraf: paragrafE,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("D2 masadir lolos gerbang tetap terpasang", hasilE.ketemu === true &&
    (hasilE.sumber?.judul ?? "").includes("المستصفى من علم الأصول"));
  cek("D3 masadir tanpa halaman cetak membawa catatan jujur, bukan halaman karangan",
    /nomor halaman cetak/.test(hasilE.catatan ?? "") && !(hasilE.sumber?.halaman ?? "").trim(),
    (hasilE.catatan ?? "").slice(0, 60));

  /* ============ Skenario F: gerbang untuk Cari Rujukan ============ */
  const konteksF = {
    bidangId: "fiqh",
    bidangLabel: "Fiqh dan Ushul Fiqh (الفقه وأصول الفقه)",
    judulProyek: JUDUL_PROYEK,
    topik: "",
  };
  const kandidatCari = [
    { kunci: "durkheim", judul: "نظرية الانتحار عند دوركايم في علم الاجتماع", wadah: "مجلة علم الاجتماع", jenis: "jurnal", kalimat: "القياس عند الأصوليين" },
    ...[1, 2, 3, 4, 5, 6, 7].map((i) => ({
      kunci: `n${i}`,
      judul: `دراسات في أصول الفقه المعاصر الجزء ${i}`,
      wadah: "دار النشر العلمية",
      jenis: "buku",
      kalimat: "القياس عند الأصوليين",
    })),
    { kunci: "n1", judul: "دراسات في أصول الفقه المعاصر الجزء 1", wadah: "دار النشر العلمية", jenis: "buku", kalimat: "نسخة duplikat kunci yang sama" },
  ];
  const { putusan, belumDinilai } = await nilaiUntukCariRujukan(kandidatCari, konteksF, undefined);
  cek("F1 kandidat Durkheim tertahan aturan keras tanpa memanggil model",
    putusan.get("durkheim")?.lolos === false && putusan.get("durkheim")?.statusPenilaian === "aturan-keras",
    putusan.get("durkheim")?.bidangSumber ?? "");
  cek("F2 kandidat seBidang lolos penilaian model", putusan.get("n1")?.lolos === true);
  cek("F3 kunci duplikat berbagi satu putusan (dedupe)",
    putusan.size === 7, `putusan=${putusan.size}`);
  cek("F4 kandidat di luar batas penilaian dihitung belum dinilai, bukan diloloskan",
    belumDinilai === 1 && !putusan.has("n7"), `belumDinilai=${belumDinilai}`);

  /* ============ Skenario G: pemilih kalimat isi ============ */
  const cuplikanPanjang =
    "The history of printing presses in medieval European towns shows how book production slowly changed hands from monasteries to urban workshops over several centuries of craft development. " +
    "يثبت هذا البحث أن القياس يلحق الفرع بالأصل في الحكم لعلة جامعة بينهما كما قرره الأصوليون في كتبهم المعتمدة عند التحقيق والتدقيق. " +
    "Guild records from the same period describe paper prices, ink suppliers, and the seasonal rhythms of binders who served university students in northern cities far from the sea.";
  cek("G1 kalimat isi dipilih yang tumpang-tindih dengan acuan",
    (pilihKalimatIsi(cuplikanPanjang, seleksiA) ?? "").includes("يلحق الفرع بالأصل"));
  cek("G2 tanpa cuplikan berarti tanpa kalimat isi", pilihKalimatIsi(undefined, seleksiA) === undefined);
  const cuplikanAsing =
    "The history of printing presses in medieval European towns shows how book production slowly changed hands from monasteries to urban workshops over several centuries of craft development and trade. " +
    "Guild records from the same period describe paper prices, ink suppliers, and the seasonal rhythms of binders who served university students in northern cities far from the sea and rivers. " +
    "Later chapters follow maritime trade routes, customs ledgers, and the correspondence of merchants who financed voyages across the Mediterranean basin during the fifteenth century alone.";
  cek("G3 cuplikan panjang tanpa tumpang-tindih tidak dipaksakan menjadi kalimat isi",
    pilihKalimatIsi(cuplikanAsing, seleksiA) === undefined);
  cek("G4 cuplikan pendek tampil utuh apa adanya",
    pilihKalimatIsi("نص قصير عن القياس عند الأصوليين.", seleksiA) === "نص قصير عن القياس عند الأصوليين.");

  /* ============ Skenario H: pengawatan statis ============ */
  const baca = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  const ruteGenerate = baca("app/api/footnote/generate/route.ts");
  cek("H1 rute generate menerima seleksi dan cabang sidik",
    ruteGenerate.includes("seleksi") && ruteGenerate.includes("sidikDisetujui") && ruteGenerate.includes("pasangFootnoteDisetujui"));
  const ruteCari = baca("app/api/refs/search/route.ts");
  cek("H2 rute Cari Rujukan menilai gerbang bidang yang sama",
    ruteCari.includes("nilaiUntukCariRujukan") && ruteCari.includes("deteksiBidangSumber"));
  const refFinder = baca("components/workspace/ref-finder.tsx");
  cek("H3 RefFinder mengirim konteks bidang dan menampilkan putusan gerbang",
    refFinder.includes("bidangId: p.bidangId") && refFinder.includes("Tertahan gerbang bidang"));
  const tulisTab = baca("components/workspace/tulis-tab.tsx");
  cek("H4 tab Tulis punya alur seleksi, panel kandidat, dan pasang lewat sidik",
    tulisTab.includes("generateSeleksi") && tulisTab.includes("panelKandidat") && tulisTab.includes("pasangLewatSidik"));
  const dialogPasang = baca("components/workspace/pasang-footnote.tsx");
  cek("H5 dialog pasang meminta konfirmasi sadar untuk sumber tertahan gerbang",
    dialogPasang.includes("gerbangTertahan") && dialogPasang.includes("konfirmasiGerbang"));

  stub.close();
  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  process.exit(gagal > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("UJI TAHAP 4 GAGAL JALAN:", e);
  stub.close();
  process.exit(2);
});
