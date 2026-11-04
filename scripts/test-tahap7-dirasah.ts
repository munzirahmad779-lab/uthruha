/**
 * Uji penerimaan Pembangunan Ulang Tahap 7: dirasah sabiqoh nyata.
 *
 * Yang dibuktikan:
 * - Susunan teks الدراسات السابقة dibangun dari kajian yang
 *   benar-benar dipilih: nama peneliti, judul, tahun, tujuan, dan
 *   HASIL tampil sebagai prosa mengalir per kajian untuk kedua
 *   kampus; unsur As'adiyah (termasuk persamaan/perbedaan per entri)
 *   lengkap; unsur yang datanya tidak ada dinyatakan tidak tersedia,
 *   tidak dikarang; tanpa kajian terpilih tidak ada studi rekaan.
 * - Tabel placeholder lama hilang tuntas: tidak ada "[اسم الباحث]"
 *   dan kawanannya di keluaran maupun di sumber compose.ts.
 * - Cacat paket Tahap 3 butir (ii) porsi dirasat tertutup: fenomena
 *   berbentuk kalimat berdiri sebagai kalimat tersendiri di sintesis,
 *   tidak disematkan di tengah frasa.
 * - Bagian dirasat dikecualikan dari pemangkas satu halaman (kelas
 *   cacat S1 Tahap 3): tiga kajian panjang tampil utuh + sintesis.
 * - Pencarian server memakai gerbang yang sama: kajian lintas bidang
 *   tertahan aturan keras, kajian tertahan model berstatus dinilai,
 *   metadata tidak memadai dibuang dengan catatan, inti disusun model
 *   HANYA dari abstrak (telusur lewat token unik abstrak), id sumber
 *   stabil sama dengan jalur Generate.
 * - Tanpa penilaian model: aturan keras tetap bekerja, inti kosong
 *   jujur, tidak ada label lolos karangan.
 * - Penanaman kajian memakai penjaga duplikat jalur sumber yang sah.
 *
 * TANPA jaringan luar: pencarian diberi penyedia fixture, kolam
 * diarahkan ke stub lokal (UTH_MODE_UJI + KOLAM_UJI_BASE), kunci
 * penyedia asli dikosongkan dari env proses uji.
 *
 * Jalankan: npx tsx scripts/test-tahap7-dirasah.ts
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
const dirUji = mkdtempSync(path.join(tmpdir(), "uth-tahap7-"));
process.env.UTH_DATA_FILE = path.join(dirUji, "db.json");
process.env.UTH_MODE_UJI = "1";

/* ---------- Stub kolam: penilai gerbang + penyusun inti ---------- */
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
    const mati = () => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "stub: model mati" }));
    };
    if (sistem.includes("penilai relevansi rujukan akademik")) {
      if (pengguna.includes("MODEL-MATI")) return mati();
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
        alasan: "Stub uji: kandidat sesuai bidang dan judul proyek.",
      }));
      return;
    }
    if (sistem.includes("penyusun inti kajian terdahulu")) {
      if (pengguna.includes("INTI-MATI")) return mati();
      // Inti dibangun dari token unik abstrak tiap blok bernomor, jadi
      // ketertelusurannya ke abstrak sumbernya bisa dibuktikan uji.
      const inti: { i: number; masalah: string; tujuan: string; metode: string; temuan: string }[] = [];
      const blok = pengguna.split(/\n\n(?=\[\d+\])/);
      for (const b of blok) {
        const kepala = /^\[(\d+)\]/.exec(b.trim());
        if (!kepala) continue;
        const token = /NILAI-UNIK-\d+/.exec(b)?.[0] ?? "";
        inti.push({
          i: Number(kepala[1]),
          masalah: `مشكلة موثقة بعلامة ${token}`,
          tujuan: `الكشف عن الأبعاد الموثقة بعلامة ${token}`,
          metode: "",
          temuan: `خلصت الدراسة إلى نتيجة موثقة بعلامة ${token} كما وردت في ملخصها المنشور`,
        });
      }
      jawab(JSON.stringify({ inti }));
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

const PLACEHOLDER_LAMA = ["[اسم الباحث]", "[السنة]", "[موضوع الدراسة]", "[المنهج]", "[الفرق]"];
const JUDUL = "أثر أصول الفقه في الحياة المعاصرة";

async function main() {
  await new Promise<void>((resolve) => stub.listen(0, "127.0.0.1", resolve));
  const alamat = stub.address();
  if (!alamat || typeof alamat === "string") throw new Error("stub tidak mendapat port");
  process.env.KOLAM_UJI_BASE = `http://127.0.0.1:${alamat.port}`;

  const { newProject } = await import("../lib/engine/project");
  type Project = import("../lib/engine/project").Project;
  const { TEMPLATE_PEDOMAN } = await import("../lib/pedoman/template-pedoman");
  const { susunDaftarIsiOtomatis } = await import("../lib/engine/daftar-isi-pedoman");
  const { composeSection } = await import("../lib/engine/compose");
  const {
    kajianDirasah,
    lepasKajian,
    rangkaiDirasah,
    statusDirasah,
    tanamKajian,
    MIN_KAJIAN_DIRASAH,
  } = await import("../lib/engine/dirasah");
  const { idStabilDariIdentitas } = await import("../lib/refs/footnote");
  const { rujukanKeSumber } = await import("../lib/server/generate-footnote");
  const { cariKajianDirasah, metadataMemadai } = await import("../lib/server/dirasah");
  type Sumber = import("../lib/engine/cite").Sumber;
  type RujukanTamu = import("../lib/server/rujukan").RujukanTamu;

  const mangkoso = TEMPLATE_PEDOMAN.find((t) => /mangkoso/i.test(t.namaPedoman))!;
  const asadiyah = TEMPLATE_PEDOMAN.find((t) => /as'adiyah/i.test(t.namaPedoman))!;

  function proyekKampus(tpl: typeof mangkoso, tambahan: Partial<Project> = {}): Project {
    return newProject({
      bidangId: "fiqh",
      judulAr: JUDUL,
      rumusan: ["ما أثر أصول الفقه في الحياة المعاصرة؟"],
      tujuan: ["الكشف عن أثر أصول الفقه في الحياة المعاصرة"],
      strukturPedoman: tpl,
      daftarIsi: susunDaftarIsiOtomatis(tpl, JUDUL).daftar,
      ...tambahan,
    });
  }

  let nomorSumber = 0;
  const kajianPenuh = (sebagian: Partial<Sumber>): Sumber => ({
    id: `src-uji-t7-${++nomorSumber}`,
    jenis: "artikel",
    penulis: "أحمد الباحث",
    tahun: "2021",
    judul: "حجية القياس في أصول الفقه المعاصر",
    jurnal: "مجلة الدراسات الأصولية",
    dirasah: {
      abstrak: "ملخص الدراسة الأولى الكامل كما نشره فهرس المجلة العلمية المحكمة.",
      masalah: "حدود حجية القياس عند الأصوليين في النوازل المعاصرة",
      tujuan: "الكشف عن حدود حجية القياس وضوابطه عند الأصوليين",
      metode: "المنهج الاستقرائي التحليلي",
      temuan: "أن القياس حجة عند الجمهور بشروط محددة تضبط إلحاق الفرع بالأصل",
      dariAbstrak: true,
    },
    ...sebagian,
  });

  const tigaKajian: Sumber[] = [
    kajianPenuh({}),
    kajianPenuh({
      penulis: "فاطمة الزهراء",
      tahun: "2019",
      judul: "القياس عند الأصوليين وتطبيقاته المعاصرة",
      jurnal: "مجلة الشريعة والقانون",
      dirasah: {
        abstrak: "ملخص الدراسة الثانية.",
        masalah: "تطبيقات القياس في النوازل المالية المعاصرة",
        tujuan: "بيان تطبيقات القياس في المعاملات المالية المعاصرة",
        metode: "المنهج الوصفي التحليلي",
        temuan: "أن تطبيقات القياس المعاصرة تحتاج إلى ضوابط مؤسسية جماعية",
        dariAbstrak: true,
      },
    }),
    kajianPenuh({
      jenis: "kitab",
      penulis: "محمد الباحث",
      tahun: "2018",
      judul: "أصول الفقه في الحياة المعاصرة",
      jurnal: undefined,
      penerbit: "دار النشر العلمية",
      dirasah: {
        abstrak: "ملخص الدراسة الثالثة.",
        masalah: "غياب التفعيل المؤسسي لأصول الفقه",
        tujuan: "إبراز مواضع تفعيل أصول الفقه في الحياة المعاصرة",
        metode: "المنهج الاستقرائي",
        temuan: "أن أثر أصول الفقه يظهر في الفتوى الجماعية والتشريع المعاصر",
        dariAbstrak: true,
      },
    }),
  ];

  /* ============ A: susunan As'adiyah, unsur wajib lengkap ============ */
  const pAs = proyekKampus(asadiyah, { sumber: tigaKajian });
  const mdAs = composeSection(pAs, "dirasat").markdown;
  cek("A1 As'adiyah: nama ketiga peneliti tampil", ["أحمد الباحث", "فاطمة الزهراء", "محمد الباحث"].every((n) => mdAs.includes(n)));
  cek("A2 As'adiyah: judul ketiga kajian tampil dalam kutip", tigaKajian.every((s) => mdAs.includes(`«${s.judul}»`)));
  cek("A3 As'adiyah: tujuan tiap kajian tampil (unsur wajib)", tigaKajian.every((s) => mdAs.includes(s.dirasah!.tujuan!)));
  cek("A4 As'adiyah: HASIL tiap kajian tampil (unsur النتائج wajib)", tigaKajian.every((s) => mdAs.includes(s.dirasah!.temuan!)));
  cek("A5 As'adiyah: persamaan dan perbedaan per entri hadir", mdAs.includes("وتفترق عنها في موضوعها وحدودها"));
  cek("A6 As'adiyah: sintesis penutup hadir", mdAs.includes("وبالمقارنة بين هذه الدراسات ودراسة الباحث"));
  cek("A7 As'adiyah: tanpa penanda kekurangan (3 kajian cukup)", !mdAs.includes("الحد الأدنى المقرر في هذا الموقع"));
  cek("A8 As'adiyah: nol placeholder lama dan nol tabel", PLACEHOLDER_LAMA.every((x) => !mdAs.includes(x)) && !mdAs.includes("|"));

  /* ============ B: susunan Mangkoso ============ */
  const pMk = proyekKampus(mangkoso, { sumber: tigaKajian });
  const mdMk = composeSection(pMk, "dirasat").markdown;
  cek("B1 Mangkoso: nama, judul, tujuan, hasil tampil", ["أحمد الباحث", "فاطمة الزهراء", "محمد الباحث"].every((n) => mdMk.includes(n)) && tigaKajian.every((s) => mdMk.includes(s.dirasah!.temuan!)));
  cek("B2 Mangkoso: sintesis penutup hadir", mdMk.includes("وبالمقارنة بين هذه الدراسات ودراسة الباحث"));
  cek("B3 Mangkoso: nol placeholder lama dan nol tabel", PLACEHOLDER_LAMA.every((x) => !mdMk.includes(x)) && !mdMk.includes("|"));

  /* ============ C: unsur tak tersedia dinyatakan, tidak dikarang ============ */
  const kajianKurang: Sumber = kajianPenuh({
    penulis: "سارة الباحثة",
    tahun: "2022",
    judul: "مناهج التأصيل الأصولي عند المعاصرين",
    dirasah: { dariAbstrak: false },
  });
  const mdKurang = rangkaiDirasah(proyekKampus(asadiyah, { sumber: [kajianKurang, ...tigaKajian.slice(0, 2)] }));
  cek("C1 HASIL tak tersedia dinyatakan terus terang di prosa", mdKurang.includes("أما نتائجها فلم تُتح في ملخصها المنشور"));
  cek("C2 tujuan tak tersedia dinyatakan terus terang di prosa", mdKurang.includes("ولم يصرّح ملخص هذه الدراسة المنشور بهدف محدد"));
  cek("C3 kajian kurang data tidak meminjam hasil kajian lain", !mdKurang.split("سارة الباحثة")[1]?.split("\n\n")[0]?.includes("حجة عند الجمهور"));

  /* ============ D: tanpa inti model, isi ditelusur ke abstrak ============ */
  const ABSTRAK_D =
    "يتناول هذا البحث حجية القياس عند الأصوليين من جهة تعريفه وأركانه وشروطه. ويخلص إلى أن القياس معتبر عند جمهور الأصوليين بشروط تضبطه وتمنع التوسع فيه بلا ضابط.";
  const kajianAbstrak: Sumber = kajianPenuh({
    penulis: "خالد الباحث",
    tahun: "2020",
    judul: "القياس عند الأصوليين: دراسة تأصيلية",
    dirasah: { abstrak: ABSTRAK_D, dariAbstrak: true },
  });
  const mdAbs = rangkaiDirasah(proyekKampus(mangkoso, { sumber: [kajianAbstrak, ...tigaKajian.slice(0, 2)] }));
  cek("D1 abstrak dikutip harfiah sebagai isi kajian", mdAbs.includes("وجاء في ملخصها المنشور") && mdAbs.includes("يتناول هذا البحث حجية القياس عند الأصوليين"));

  /* ============ E: nol kajian dan di bawah minimal ============ */
  const mdNol = composeSection(proyekKampus(mangkoso), "dirasat").markdown;
  cek("E1 tanpa kajian: penanda editorial jujur, bukan studi rekaan",
    mdNol.includes("لم تُختر بعد دراسات سابقة موثقة") && !mdNol.includes("أولًا: دراسة") && PLACEHOLDER_LAMA.every((x) => !mdNol.includes(x)) && !mdNol.includes("|"));
  const mdDua = rangkaiDirasah(proyekKampus(mangkoso, { sumber: tigaKajian.slice(0, 2) }));
  cek("E2 dua kajian: penanda kekurangan menyebut aturan minimal pemilik web",
    mdDua.includes("دراستان فقط") && mdDua.includes(`الحد الأدنى المقرر في هذا الموقع ${MIN_KAJIAN_DIRASAH}`));
  cek("E3 MIN_KAJIAN_DIRASAH adalah 3", MIN_KAJIAN_DIRASAH === 3);

  /* ============ F: fenomena kalimat vs frasa (paket Tahap 3 ii) ============ */
  const FENOMENA_KALIMAT = "يلاحظ الباحث أن كثيرا من الطلاب يعانون من ضعف مهارة الكلام في دروس اللغة العربية";
  const mdFenKal = composeSection(
    proyekKampus(mangkoso, { sumber: tigaKajian, fenomenaAr: FENOMENA_KALIMAT }),
    "dirasat",
  ).markdown;
  cek("F1 fenomena kalimat tampil sebagai kalimat tersendiri di sintesis",
    mdFenKal.includes(FENOMENA_KALIMAT) && !mdFenKal.includes("في يلاحظ") && !mdFenKal.includes("يظهر في يلاحظ"),
    mdFenKal.slice(mdFenKal.indexOf("وبالمقارنة"), mdFenKal.indexOf("وبالمقارنة") + 400));
  const FENOMENA_FRASA = "ضعف مهارة الكلام لدى طلاب المدارس الثانوية";
  const mdFenFra = composeSection(
    proyekKampus(mangkoso, { sumber: tigaKajian, fenomenaAr: FENOMENA_FRASA }),
    "dirasat",
  ).markdown;
  cek("F2 fenomena frasa tetap masuk sebagai kalimat utuh",
    mdFenFra.includes(`يظهر ما سبق جليًّا في ${FENOMENA_FRASA}.`));

  /* ============ G: pengecualian pemangkas satu halaman ============ */
  const intiPanjang = "نتيجة موثقة مطولة ".repeat(60).trim();
  const tigaPanjang = tigaKajian.map((s, i) => ({
    ...s,
    penulis: `باحث طويل ${i + 1}`,
    dirasah: { ...s.dirasah!, temuan: `${intiPanjang} علامة-${i + 1}`, tujuan: `${intiPanjang} هدف-${i + 1}` },
  }));
  const mdPanjang = composeSection(proyekKampus(asadiyah, { sumber: tigaPanjang }), "dirasat").markdown;
  cek("G1 tiga kajian panjang tidak terpotong senyap (>1800 karakter)",
    mdPanjang.length > 1800, `${mdPanjang.length} karakter`);
  cek("G2 kajian ketiga dan sintesis selamat dari pemangkas",
    mdPanjang.includes("باحث طويل 3") && mdPanjang.includes("وبالمقارنة بين هذه الدراسات"));

  /* ============ H: tanam, duplikat, lepas, status ============ */
  const pKosong = proyekKampus(mangkoso);
  const t1 = tanamKajian(pKosong, tigaKajian[0]!);
  cek("H1 tanam kajian baru menambah sumber berpenanda", t1.status === "baru" && kajianDirasah(t1.proyek).length === 1);
  const t2 = tanamKajian(t1.proyek, tigaKajian[0]!);
  cek("H2 tanam kajian yang sama dua kali dikenali duplikat", t2.status === "sudah-ada" && t2.proyek.sumber.length === 1);
  const sumberBiasa: Sumber = { ...tigaKajian[1]!, dirasah: undefined };
  const pBiasa = proyekKampus(mangkoso, { sumber: [sumberBiasa] });
  const t3 = tanamKajian(pBiasa, tigaKajian[1]!);
  cek("H3 karya yang sudah jadi sumber biasa ditempeli penanda, bukan digandakan",
    t3.status === "penanda-ditempel" && t3.proyek.sumber.length === 1 && kajianDirasah(t3.proyek).length === 1);
  const pLepas = lepasKajian(t1.proyek, tigaKajian[0]!.id);
  cek("H4 lepas kajian membuang penanda, sumber tetap ada", kajianDirasah(pLepas).length === 0 && pLepas.sumber.length === 1);
  const stH = statusDirasah(t1.proyek);
  cek("H5 status menghitung kekurangan terhadap minimal", stH.jumlah === 1 && stH.cukup === false && stH.kurang === 2);

  /* ============ I: pencarian server, gerbang, inti ============ */
  let nomorRuj = 0;
  const ruj = (sebagian: Partial<RujukanTamu> & { judul: string }): RujukanTamu => ({
    id: `uji-t7-${++nomorRuj}`,
    jenis: "jurnal",
    penulis: ["أحمد الباحث"],
    tahun: "2021",
    wadah: "مجلة الدراسات الأصولية",
    doi: null,
    isbn: null,
    tautan: "https://example.org/uji",
    terverifikasi: true,
    skor: 0.85,
    kecocokan: 3,
    inti: true,
    umum: false,
    ...sebagian,
  });
  const fixtureCari: RujukanTamu[] = [
    ruj({ judul: "حجية القياس في أصول الفقه المعاصر", doi: "10.1000/uji-t7-1", skor: 0.9, cuplikan: "ملخص الدراسة الأولى NILAI-UNIK-1 عن حجية القياس عند الأصوليين وحدودها." }),
    ruj({ judul: "القياس عند الأصوليين وتطبيقاته المعاصرة", penulis: ["فاطمة الزهراء"], tahun: "2019", wadah: "مجلة الشريعة والقانون", skor: 0.85, cuplikan: "ملخص الدراسة الثانية NILAI-UNIK-2 عن تطبيقات القياس المعاصرة." }),
    ruj({ jenis: "buku", judul: "أصول الفقه في الحياة المعاصرة", penulis: ["محمد الباحث"], tahun: "2018", wadah: "دار النشر العلمية", skor: 0.8, cuplikan: "ملخص الدراسة الثالثة NILAI-UNIK-3 عن تفعيل أصول الفقه." }),
    ruj({ judul: "نظرية دوركايم في علم الاجتماع الديني", penulis: ["إميل دوركايم"], tahun: "2020", wadah: "مجلة الدراسات الاجتماعية", skor: 0.95, cuplikan: "دراسة في علم الاجتماع الديني عند دوركايم." }),
    ruj({ judul: "مناهج التأصيل الأصولي عند المعاصرين", penulis: ["سارة الباحثة"], tahun: "2022", skor: 0.7, cuplikan: "TERTAHAN-UJI نص هذا الملخص يخالف مجال المشروع مخالفة صريحة." }),
    ruj({ judul: "دراسة بلا سنة نشر موثقة", penulis: ["مجهول الباحث"], tahun: "", skor: 0.99 }),
  ];
  const hasilI = await cariKajianDirasah({
    judulProyek: JUDUL,
    bidangId: "fiqh",
    bisaNilaiModel: true,
    penyedia: async () => fixtureCari,
  });
  const perJudul = new Map(hasilI.kajian.map((k) => [k.sumber.judul, k]));
  cek("I1 metadata tak memadai dibuang dengan catatan jujur",
    hasilI.kajian.length === 5 && !perJudul.has("دراسة بلا سنة نشر موثقة") && hasilI.catatan.some((c) => c.includes("metadata tidak memadai")),
    `${hasilI.kajian.length} kajian`);
  cek("I2 Durkheim tertahan aturan keras bidang Sosiologi",
    perJudul.get("نظرية دوركايم في علم الاجتماع الديني")?.gerbang?.lolos === false &&
    perJudul.get("نظرية دوركايم في علم الاجتماع الديني")?.gerbang?.statusPenilaian === "aturan-keras" &&
    perJudul.get("نظرية دوركايم في علم الاجتماع الديني")?.gerbang?.bidangSumber === "Sosiologi");
  cek("I3 kajian sebidang lolos penilaian model",
    perJudul.get("حجية القياس في أصول الفقه المعاصر")?.gerbang?.lolos === true);
  cek("I4 kajian tertahan model berstatus dinilai dan perlu konfirmasi",
    perJudul.get("مناهج التأصيل الأصولي عند المعاصرين")?.gerbang?.lolos === false &&
    perJudul.get("مناهج التأصيل الأصولي عند المعاصرين")?.gerbang?.perluKonfirmasi === true &&
    perJudul.get("مناهج التأصيل الأصولي عند المعاصرين")?.gerbang?.statusPenilaian === "dinilai");
  cek("I5 urutan tampil: yang lolos lebih dulu dari yang tertahan",
    hasilI.kajian.slice(0, 3).every((k) => k.gerbang?.lolos === true) && hasilI.kajian.slice(3).every((k) => k.gerbang?.lolos === false));
  cek("I6 inti temuan tertelusur ke token unik abstraknya sendiri",
    perJudul.get("حجية القياس في أصول الفقه المعاصر")?.sumber.dirasah?.temuan?.includes("NILAI-UNIK-1") === true &&
    perJudul.get("القياس عند الأصوليين وتطبيقاته المعاصرة")?.sumber.dirasah?.temuan?.includes("NILAI-UNIK-2") === true &&
    perJudul.get("أصول الفقه في الحياة المعاصرة")?.sumber.dirasah?.temuan?.includes("NILAI-UNIK-3") === true);
  cek("I7 inti dari abstrak ditandai jujur (dariAbstrak + intiDariModel)",
    perJudul.get("حجية القياس في أصول الفقه المعاصر")?.sumber.dirasah?.dariAbstrak === true &&
    perJudul.get("حجية القياس في أصول الفقه المعاصر")?.intiDariModel === true);
  cek("I8 metode yang tidak dinyatakan abstrak tetap kosong, tidak dikarang model",
    perJudul.get("حجية القياس في أصول الفقه المعاصر")?.sumber.dirasah?.metode === undefined);
  const sumberI = perJudul.get("حجية القياس في أصول الفقه المعاصر")!.sumber;
  cek("I9 id sumber stabil sama dengan jalur Generate Footnote",
    sumberI.id === rujukanKeSumber(fixtureCari[0]!).id &&
    sumberI.id === idStabilDariIdentitas(fixtureCari[0]!.judul, fixtureCari[0]!.penulis.join("، "), fixtureCari[0]!.tahun),
    sumberI.id);
  cek("I10 semua kandidat unik dinilai (belumDinilai 0)", hasilI.belumDinilai === 0, `${hasilI.belumDinilai}`);

  /* ============ J: tanpa penilaian model ============ */
  const hasilJ = await cariKajianDirasah({
    judulProyek: JUDUL,
    bidangId: "fiqh",
    bisaNilaiModel: false,
    penyedia: async () => fixtureCari,
  });
  const perJudulJ = new Map(hasilJ.kajian.map((k) => [k.sumber.judul, k]));
  cek("J1 tanpa model: Durkheim tetap tertahan aturan keras",
    perJudulJ.get("نظرية دوركايم في علم الاجتماع الديني")?.gerbang?.statusPenilaian === "aturan-keras");
  cek("J2 tanpa model: kajian bersih tidak diberi label lolos karangan",
    perJudulJ.get("حجية القياس في أصول الفقه المعاصر")?.gerbang === undefined);
  cek("J3 tanpa model: inti kosong, dasar abstrak tetap tercatat jujur",
    perJudulJ.get("حجية القياس في أصول الفقه المعاصر")?.sumber.dirasah?.temuan === undefined &&
    perJudulJ.get("حجية القياس في أصول الفقه المعاصر")?.sumber.dirasah?.dariAbstrak === true &&
    perJudulJ.get("حجية القياس في أصول الفقه المعاصر")?.intiDariModel === false);

  /* ============ K: kegagalan model jujur ============ */
  const hasilK = await cariKajianDirasah({
    judulProyek: JUDUL,
    bidangId: "fiqh",
    bisaNilaiModel: true,
    penyedia: async () => [
      ruj({ judul: "دراسة MODEL-MATI في أصول الفقه", cuplikan: "MODEL-MATI ملخص لا يصل إليه النموذج." }),
      ruj({ judul: "دراسة INTI-MATI في أصول الفقه", penulis: ["باحث آخر"], tahun: "2020", cuplikan: "INTI-MATI ملخص يفشل تلخيصه." }),
    ],
  });
  const perJudulK = new Map(hasilK.kajian.map((k) => [k.sumber.judul, k]));
  cek("K1 model penilai mati: kandidat tertahan sebagai tidak-dinilai (gagal tertutup)",
    perJudulK.get("دراسة MODEL-MATI في أصول الفقه")?.gerbang?.lolos === false &&
    perJudulK.get("دراسة MODEL-MATI في أصول الفقه")?.gerbang?.statusPenilaian === "tidak-dinilai");
  cek("K2 model inti mati: kegagalan dicatat dan temuan tidak dikarang",
    hasilK.catatan.some((c) => c.includes("Inti kajian")) &&
    hasilK.kajian.every((k) => !k.sumber.dirasah?.temuan));

  /* ============ M: luapan batas penilaian (tutup R1 telaah Tahap 7) ============ */
  // Sepuluh kandidat unik sebidang, batas penilaian gerbang 8: dua
  // terakhir tidak terjangkau nilaiUntukCariRujukan. Untuk akun
  // penilai model keduanya WAJIB membawa putusan gagal tertutup
  // "tidak-dinilai", bukan tampil tanpa putusan.
  const hasilM = await cariKajianDirasah({
    judulProyek: JUDUL,
    bidangId: "fiqh",
    bisaNilaiModel: true,
    penyedia: async () =>
      Array.from({ length: 10 }, (_, i) =>
        ruj({
          judul: `دراسة LUAPAN-${i + 1} في أصول الفقه`,
          penulis: [`باحث رقم ${i + 1}`],
          tahun: `${2010 + i}`,
          cuplikan: `ملخص الدراسة LUAPAN-${i + 1} NILAI-UNIK-${i + 1}`,
        }),
      ),
  });
  const tanpaPutusanM = hasilM.kajian.filter((k) => !k.gerbang);
  const tertahanM = hasilM.kajian.filter(
    (k) => k.gerbang && !k.gerbang.lolos && k.gerbang.statusPenilaian === "tidak-dinilai",
  );
  cek(
    "M1 luapan penilaian: tidak ada kandidat akun penilai model tanpa putusan",
    hasilM.kajian.length === 10 && tanpaPutusanM.length === 0,
    `${hasilM.kajian.length} kajian, ${tanpaPutusanM.length} tanpa putusan`,
  );
  cek(
    "M2 luapan penilaian: yang di luar jatah tertahan tidak-dinilai dan perlu konfirmasi",
    tertahanM.length === 2 && tertahanM.every((k) => k.gerbang?.perluKonfirmasi),
    `${tertahanM.length} tertahan dari 10`,
  );
  cek(
    "M3 luapan penilaian: belumDinilai tercatat 2 dengan jujur",
    hasilM.belumDinilai === 2,
    `${hasilM.belumDinilai}`,
  );

  /* ============ L: metadata dan penjaga statis ============ */
  cek("L1 metadataMemadai menuntut judul, penulis, tahun",
    metadataMemadai(ruj({ judul: "دراسة كاملة" })) === true &&
    metadataMemadai(ruj({ judul: "دراسة بلا Tahun", tahun: "" })) === false &&
    metadataMemadai(ruj({ judul: "دراسة بلا Penulis", penulis: [] })) === false);
  const composeTs = readFileSync(path.join(process.cwd(), "lib/engine/compose.ts"), "utf8");
  cek("L2 placeholder tabel lama hilang dari sumber compose.ts", PLACEHOLDER_LAMA.every((x) => !composeTs.includes(x)));
  const panelTs = readFileSync(path.join(process.cwd(), "components/workspace/dirasah-panel.tsx"), "utf8");
  cek("L3 panel memanggil rute pencarian dirasah server", panelTs.includes("/api/dirasah"));
  const ruteTs = readFileSync(path.join(process.cwd(), "app/api/dirasah/route.ts"), "utf8");
  cek("L4 rute menjaga sesi, asal, dan kunci BYOK seperti rute generate",
    ruteTs.includes("tolakTanpaSesi") && ruteTs.includes("asalSah") && ruteTs.includes("perluIsiKunci"));

  stub.close();
  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  process.exit(gagal > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("UJI TAHAP 7 GAGAL JALAN:", e);
  stub.close();
  process.exit(2);
});
