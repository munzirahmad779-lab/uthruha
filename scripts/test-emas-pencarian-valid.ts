/**
 * Set uji emas v1 — Aturan Pencarian Valid (Tahap G1, 6 Nov 2026;
 * diperluas Tahap G2 di bagian 7-8).
 *
 * Regresi TETAP untuk kasus-kasus nyata yang pernah membuktikan
 * bocor atau gerbang bekerja, dijalankan LURING dan deterministik:
 * gerbang kategori kitab bermesin sembilan aturan (kasus uang panai
 * + kasus leksikon takamul dari bahan resmi pemilik), periksa
 * metadata (bandingkanDenganRekod), dan penanda bidang jurnal.
 * Bagian 7 (G2): gerbangJurnal deterministik + labelCabangDariTeks
 * dengan label persis seperti rekod OpenAlex nyata keempat fixture
 * wajib. Bagian 8 (G2): validator skema ketat keluaran pencarian
 * (kasus wajib tolak + wajib sah dari contoh bahan resmi), kamus
 * ambiguitas takamul, dan pengerasan parser lama. Pasangan hidupnya
 * (adapter nyata, endpoint, jembatan model) ada di
 * scripts/test-emas-hidup.ts.
 *
 * Kasus intinya diambil dari bukti uji nyata di
 * ~/workspace/your_files/Uji-Kitabah/: proyek fikih berjudul
 * "حكم uang panai في الشريعة الاسلامية: دراسة مقاصدية" yang pada
 * 6 Nov 2026 02:50 sempat memasang dan menyimpan kitab tauhid
 * القواعد في توحيد العبادة (kategori sumber العقيدة) lewat skor
 * model — gerbang kategori kitab di sini wajib menggagalkannya
 * dengan kode CAB_BERTENTANGAN tanpa model sama sekali.
 *
 * Pemetaan status yang dijaga set ini: LOLOS mesin = "lolos";
 * GUGUR = "gagal-bidang"; KONFIRMASI = "belum-terverifikasi" dengan
 * alasan berawalan "Perlu konfirmasi: " (tertahan tanpa sidik,
 * tanpa jalan instal — putusan pemilik 5 Nov 2026 15:57).
 *
 * Jalankan: npx tsx scripts/test-emas-pencarian-valid.ts
 * Keluar dengan kode non-nol bila ada butir GAGAL.
 */
import {
  gerbangJurnal,
  gerbangKategoriKitab,
  labelCabangDariTeks,
  namaKategoriSumber,
  normalisasiKategoriKitab,
} from "../lib/engine/kategori-kitab";
import {
  kamusAmbiguitasUntuk,
  validasiKeluaranPencarian,
} from "../lib/engine/skema-pencarian";
import { parseKalimat, parseKata } from "../lib/engine/kata-kunci-server";
import {
  bandingkanDenganRekod,
  type KandidatVerifikasi,
  type RekodCrossref,
} from "../lib/server/verifikasi-rujukan";
import {
  bidangMilikProyek,
  deteksiBidangSumber,
  type KonteksProyek,
} from "../lib/server/gerbang-relevansi";

let lulus = 0;
let gagal = 0;
function cek(nama: string, ok: boolean, rincian = "") {
  console.log(`${ok ? "PASS" : "GAGAL"} ${nama}${rincian ? " :: " + rincian : ""}`);
  if (ok) lulus += 1;
  else gagal += 1;
}

const JUDUL_UANG_PANAI = "حكم uang panai في الشريعة الاسلامية: دراسة مقاصدية";
const PARAGRAF_UANG_PANAI =
  "uang panai adalah sejumlah harta yang diserahkan pihak laki-laki kepada pihak perempuan dalam adat pernikahan Bugis Makassar, dan para ulama berbeda pendapat tentang kedudukannya dalam akad nikah.";
const JUDUL_TAKAMUL = "التكامل المعرفي بين علوم القرآن وأصول الفقه";

/* ── 1. Kasus kunci resmi: topik fikih munakahat (uang panai) ─────── */

// Kitab tauhid rekod nyata (Turath 604, kategori العقيدة) pada
// proyek uang panai: cabang bertentangan → GUGUR keras.
{
  const h = gerbangKategoriKitab(
    {
      judul: "القواعد في توحيد العبادة",
      kategoriKitab: "العقيدة",
      teksParagraf: PARAGRAF_UANG_PANAI,
      judulProyek: JUDUL_UANG_PANAI,
    },
    "fiqh",
  );
  cek("kunci: القواعد في توحيد العبادة vs uang panai: gagal-bidang", h.putusan === "gagal-bidang", h.alasan);
  cek("kunci: kode CAB_BERTENTANGAN", h.kode === "CAB_BERTENTANGAN", h.kode);
  cek("kunci: topik fikih_munakahat", h.topik === "fikih_munakahat", h.topik);
  cek("kunci: label kitab terbaca akidah", h.labelKitab === "akidah");
  cek("kunci: alasan menyebut kategori sumbernya", h.alasan.includes("العقيدة"));
}

// Bentuk persis bahan resmi: كتاب التوحيد berkategori العقيدة.
{
  const h = gerbangKategoriKitab(
    { judul: "كتاب التوحيد", kategoriKitab: "العقيدة", judulProyek: JUDUL_UANG_PANAI },
    "fiqh",
  );
  cek("kunci: كتاب التوحيد (العقيدة) vs munakahat: GUGUR CAB_BERTENTANGAN",
    h.putusan === "gagal-bidang" && h.kode === "CAB_BERTENTANGAN", h.alasan);
}

// Kategori menggugurkan SEBELUM istilah diperiksa: kitab akidah yang
// judulnya menyebut الزواج tetap GUGUR.
{
  const h = gerbangKategoriKitab(
    { judul: "التوحيد وأثره في الزواج", kategoriKitab: "العقيدة", judulProyek: JUDUL_UANG_PANAI },
    "fiqh",
  );
  cek("kunci: kitab akidah berjudul الزواج tetap GUGUR (kategori lebih dulu)",
    h.putusan === "gagal-bidang" && h.kode === "CAB_BERTENTANGAN", h.alasan);
}

// الأم (fikih) yang daftar isinya memuat كتاب النكاح → LOLOS.
{
  const h = gerbangKategoriKitab(
    {
      judul: "الأم",
      kategoriKitab: "الفقه",
      daftarIsi: "كتاب النكاح، كتاب الطلاق، كتاب البيوع",
      judulProyek: JUDUL_UANG_PANAI,
    },
    "fiqh",
  );
  cek("kunci: الأم + daftar isi كتاب النكاح: LOLOS", h.putusan === "lolos", h.alasan);
}

// المغني (fikih) TANPA daftar isi → KONFIRMASI tertahan (aturan 5).
{
  const h = gerbangKategoriKitab(
    { judul: "المغني", kategoriKitab: "الفقه", judulProyek: JUDUL_UANG_PANAI },
    "fiqh",
  );
  cek("kunci: المغني tanpa daftar isi: KONFIRMASI tertahan",
    h.putusan === "belum-terverifikasi" && h.alasan.startsWith("Perlu konfirmasi:"), h.alasan);
}

// فتح الباري (syuruh hadis, cabang bersebelahan) dengan كتاب النكاح
// di daftar isi → KONFIRMASI tertahan (aturan 6), bukan lolos.
{
  const h = gerbangKategoriKitab(
    {
      judul: "فتح الباري شرح صحيح البخاري",
      kategoriKitab: "شروح الحديث",
      daftarIsi: "كتاب النكاح، كتاب الطلاق",
      judulProyek: JUDUL_UANG_PANAI,
    },
    "fiqh",
  );
  cek("kunci: فتح الباري + كتاب النكاح di daftar isi: KONFIRMASI tertahan",
    h.putusan === "belum-terverifikasi" && h.kode === "KONF_SEBELAHAN_INTI", h.alasan);
}

/* ── 2. Kasus leksikon takamul (integrasi_keilmuan) ────────────────── */

{
  const h = gerbangKategoriKitab(
    { judul: "التكامل الاقتصادي العربي", kategoriKitab: "الفقه", judulProyek: JUDUL_TAKAMUL },
    "quran",
  );
  cek("takamul: التكامل الاقتصادي العربي GUGUR (penolak)",
    h.putusan === "gagal-bidang", `${h.kode} :: ${h.alasan}`);
}
{
  const h = gerbangKategoriKitab(
    {
      judul: "التكامل بين العلوم الشرعية والعلوم الكونية",
      kategoriKitab: "أصول الفقه",
      judulProyek: JUDUL_TAKAMUL,
    },
    "quran",
  );
  cek("takamul: التكامل بين العلوم الشرعية والعلوم الكونية LOLOS",
    h.putusan === "lolos", `${h.kode} :: ${h.alasan}`);
}
{
  const h = gerbangKategoriKitab(
    { judul: "حساب التفاضل والتكامل", kategoriKitab: "علوم أخرى", judulProyek: JUDUL_TAKAMUL },
    "quran",
  );
  cek("takamul: حساب التفاضل والتكامل GUGUR (penolak kalkulus)",
    h.putusan === "gagal-bidang", `${h.kode} :: ${h.alasan}`);
}

/* ── 3. Relativitas, irisan, dan mode cadangan ─────────────────────── */

// Kitab tauhid yang sama LOLOS pada bidang yang memuat kalam
// (falsafah → topik akidah_tauhid; توحيد adalah istilah intinya),
// dan pada baris kustom "akidah" (mode cadangan).
{
  const h = gerbangKategoriKitab(
    { judul: "القواعد في توحيد العبادة", kategoriKitab: "العقيدة" },
    "falsafah",
  );
  cek("relativitas: kitab tauhid vs falsafah (kalam): lolos", h.putusan === "lolos", h.alasan);
  const h2 = gerbangKategoriKitab(
    { judul: "القواعد في توحيد العبادة", kategoriKitab: "العقيدة" },
    "akidah",
  );
  cek("relativitas: kitab tauhid vs bidang akidah (cadangan): lolos", h2.putusan === "lolos");
}

// Kitab fikih umum vs bidang fiqh TANPA konteks topik (mode
// cadangan, tabel ketetapan awal): lolos. Dengan konteks uang
// panai (topik munakahat) kitab fikih umum tanpa istilah nikah
// pada judulnya turun menjadi KONFIRMASI (aturan 5) — perilaku
// yang sama dengan kasus المغني di atas, dijaga di sini sebagai
// kontras yang disengaja.
{
  const h = gerbangKategoriKitab(
    { judul: "الفقه الإسلامي وأدلته", kategoriKitab: "الفقه" },
    "fiqh",
  );
  cek("cadangan: kitab fiqh vs fiqh tanpa topik: lolos", h.putusan === "lolos", h.alasan);
  const h2 = gerbangKategoriKitab(
    {
      judul: "الفقه الإسلامي وأدلته",
      kategoriKitab: "الفقه",
      teksParagraf: PARAGRAF_UANG_PANAI,
      judulProyek: JUDUL_UANG_PANAI,
    },
    "fiqh",
  );
  cek("kontras: kitab fiqh umum pada topik munakahat: KONFIRMASI",
    h2.putusan === "belum-terverifikasi" && h2.kode === "KONF_SESUAI_TANPA_INTI", h2.alasan);
}

// Kategori tidak dikenal + tanpa bukti apa pun → GUGUR fail-closed
// (aturan 9). Ini MENGGANTIKAN ekspektasi brief awal
// "belum-terverifikasi" untuk kasus (d): bahan resmi 9 aturan yang
// menang, dan perubahan ini dinyatakan terbuka di laporan G1.
{
  const h = gerbangKategoriKitab(
    {
      judul: "كتاب غامض بلا تصنيف معروف",
      kategoriKitab: "علوم أخرى",
      teksParagraf: PARAGRAF_UANG_PANAI,
      judulProyek: JUDUL_UANG_PANAI,
    },
    "fiqh",
  );
  cek("aturan 9: kategori tidak dikenal tanpa bukti: GUGUR gagal-bidang",
    h.putusan === "gagal-bidang" && h.kode === "GUGUR_TAKJELAS_KOSONG", h.alasan);
  const tanpaKategori = gerbangKategoriKitab(
    { judul: "كتاب غامض بلا تصنيف معروف", teksParagraf: PARAGRAF_UANG_PANAI, judulProyek: JUDUL_UANG_PANAI },
    "fiqh",
  );
  cek("aturan 9: tanpa kategori sama sekali: GUGUR", tanpaKategori.putusan === "gagal-bidang");
}

// Kategori tidak dikenal, tetapi judul kitab disebut persis pada
// judul proyek (kitab yang memang diteliti): lolos lewat bukti
// sebutan persis (kasus (e) brief awal tetap dijaga).
{
  const h = gerbangKategoriKitab(
    {
      judul: "القواعد في توحيد العبادة",
      judulProyek: "دراسة تحليلية لكتاب القواعد في توحيد العبادة",
    },
    "fiqh",
  );
  cek("persis: kategori kosong + judul disebut persis di judul proyek: lolos",
    h.putusan === "lolos" && h.kode === "SEBUT_PERSIS", h.alasan);
}

// Paket B (keputusan pemilik, 6 Nov 2026): buku dari pencarian web
// kini melewati gerbang yang sama SEBELUM skor model, dengan bentuk
// masukan persis seperti yang diberikan loop generate untuk kelas
// buku (kategoriKitab kosong, tanpa daftar isi). Fixture di bawah
// meniru kandidat yang pada jalur lama hanya dinilai model: skor
// model setinggi apa pun tidak lagi bisa meloloskan yang tertahan
// gerbang, karena loop berhenti pada putusan gerbang.
{
  // Kembaran web dari kasus uang panai: kitab tauhid TANPA kategori
  // tercatat pada proyek munakahat. Jalur lama menyerahkannya ke
  // skor model; kini gugur deterministik sebelum model dipanggil.
  const h = gerbangKategoriKitab(
    {
      judul: "القواعد في توحيد العبادة",
      teksParagraf:
        "يتناول هذا البحث حكم العرف المالي المعروف بالuang panai في أعراس البوغيس من جهة مشروعيته وآثاره على عقد النكاح.",
      judulProyek: "حكم uang panai في الشريعة الإسلامية: دراسة مقاصدية",
    },
    "fiqh",
  );
  cek("paketB: buku web tauhid tanpa kategori vs uang panai: GUGUR sebelum model",
    h.putusan === "gagal-bidang" && h.kode === "GUGUR_TAKJELAS_KOSONG", h.alasan);
}
{
  // Tanpa kategori dan tanpa sebutan persis, tetapi judul memuat
  // istilah inti topik: tertahan belum-terverifikasi (bukan lolos),
  // apa pun skor model yang akan diberikan tahap berikutnya.
  const h = gerbangKategoriKitab(
    {
      judul: "كتاب الأصول في الفقه المقارن",
      teksParagraf:
        "تُعدّ زكاة المهنة من النوازل الفقهية المعاصرة التي اختلف فيها المعاصرون، إذ لم يرد فيها نص صريح من الكتاب أو السنة.",
      judulProyek: "أثر أصول الفقه في الحياة المعاصرة",
    },
    "fiqh",
  );
  cek("paketB: buku web tanpa kategori + tanpa sebutan persis: tertahan belum-terverifikasi",
    h.putusan === "belum-terverifikasi" && h.kode === "KONF_TAKJELAS_INTI", h.alasan);
}
{
  // Satu-satunya jalan lolos buku web tak berkategori: judulnya
  // disebut persis pada paragraf. Sesudah gerbang ini barulah tahap
  // model boleh menilai.
  const h = gerbangKategoriKitab(
    {
      judul: "القياس عند الأصوليين: دراسة تأصيلية مقارنة",
      teksParagraf:
        "يُعدّ القياس من أهم مصادر التشريع عند الأصوليين، إذ يُلحق الفرع بالأصل في الحكم لعلة جامعة بينهما.",
      judulProyek: "أثر أصول الفقه في الحياة المعاصرة",
    },
    "fiqh",
  );
  cek("paketB: buku web yang judulnya disebut persis di paragraf: lolos gerbang ke tahap model",
    h.putusan === "lolos" && h.kode === "SEBUT_PERSIS", h.alasan);
}

// Irisan tabel: kitab ushul fiqh pada proyek fikih generik lolos;
// pada bidang quran (topik tafsir) gugur.
{
  const h = gerbangKategoriKitab(
    { judul: "المستصفى في أصول الفقه", kategoriKitab: "أصول الفقه" },
    "fiqh",
  );
  cek("irisan: kitab أصول الفقه vs fiqh: lolos", h.putusan === "lolos" && h.labelKitab === "ushul-fiqh", h.alasan);
  const h2 = gerbangKategoriKitab(
    { judul: "المستصفى في أصول الفقه", kategoriKitab: "أصول الفقه" },
    "quran",
  );
  cek("irisan: kitab أصول الفقه vs quran: gagal-bidang", h2.putusan === "gagal-bidang");
}

// Bidang proyek kosong: tidak ada tabel, tidak ada topik → gugur
// fail-closed (aturan 9 mode cadangan).
{
  const h = gerbangKategoriKitab(
    { judul: "الفقه الإسلامي وأدلته", kategoriKitab: "الفقه" },
    "",
  );
  cek("bidang kosong: gagal-bidang fail-closed", h.putusan === "gagal-bidang", h.alasan);
}

/* ── 4. Pemetaan kategori mentah → label ───────────────────────────── */

cek("peta: العقيدة → akidah", normalisasiKategoriKitab("العقيدة") === "akidah");
cek("peta: كتب التوحيد → akidah", normalisasiKategoriKitab("كتب التوحيد") === "akidah");
cek("peta: أصول الفقه → ushul-fiqh (bukan fiqh)", normalisasiKategoriKitab("أصول الفقه") === "ushul-fiqh");
cek("peta: التفسير وعلوم القرآن → tafsir", normalisasiKategoriKitab("التفسير وعلوم القرآن") === "tafsir");
cek("peta: علوم القرآن وأصول التفسير (string nyata) → tafsir", normalisasiKategoriKitab("علوم القرآن وأصول التفسير") === "tafsir");
cek("peta: الحديث وعلومه → hadis", normalisasiKategoriKitab("الحديث وعلومه") === "hadis");
cek("peta: شروح الحديث (string nyata) → hadis", normalisasiKategoriKitab("شروح الحديث") === "hadis");
cek("peta: فقه المعاملات → fiqh", normalisasiKategoriKitab("فقه المعاملات") === "fiqh");
cek("peta: الفقه وأصوله (string bahan) → fiqh", normalisasiKategoriKitab("الفقه وأصوله") === "fiqh");
cek("peta: علوم الفقه والقواعد الفقهية (string nyata) → fiqh", normalisasiKategoriKitab("علوم الفقه والقواعد الفقهية") === "fiqh");
cek("peta: مسائل فقهية (string nyata cat 19) → fiqh", normalisasiKategoriKitab("مسائل فقهية") === "fiqh");
cek("peta: السيرة والتاريخ → sirah-tarikh", normalisasiKategoriKitab("السيرة والتاريخ") === "sirah-tarikh");
cek("peta: الأخلاق والتصوف والرقائق → akhlak-tasawuf", normalisasiKategoriKitab("الأخلاق والتصوف والرقائق") === "akhlak-tasawuf");
cek("peta: اللغة والأدب → lughah-adab", normalisasiKategoriKitab("اللغة والأدب") === "lughah-adab");
cek("peta: التربية والتعليم → tarbiyah", normalisasiKategoriKitab("التربية والتعليم") === "tarbiyah");
cek("peta: الاقتصاد الإسلامي → iqtishad", normalisasiKategoriKitab("الاقتصاد الإسلامي") === "iqtishad");
cek("peta: المنطق → null (alat bantu, bukan bidang)", normalisasiKategoriKitab("المنطق") === null);
cek("peta: علوم أخرى → null", normalisasiKategoriKitab("علوم أخرى") === null);
cek("katalog: cat 1 = العقيدة (kitab tauhid uang panai)", namaKategoriSumber(1) === "العقيدة");
cek("katalog: cat 11 = أصول الفقه (المستصفى)", namaKategoriSumber(11) === "أصول الفقه");
cek(
  "katalog: cat 1 terpetakan akidah ujung ke ujung",
  normalisasiKategoriKitab(namaKategoriSumber(1)) === "akidah",
);

/* ── 5. Periksa metadata: kartu fiktif gugur ───────────────────────── */

const REKOD_IHYA: RekodCrossref = {
  judul:
    "Kaidah Fiqh dan Ushul Fiqh Tentang Produk Halal, Metode Istinbath dan Ijtihad dalam Menetapkan Hukum Produk Halal",
  jurnal: "International Journal Ihya' 'Ulum al-Din",
  tahun: "2018",
  doi: "10.21580/ihya.20.2.4048",
};
{
  const fiktif: KandidatVerifikasi = {
    id: "emas-fiktif",
    doi: "10.9999/fiktif.123",
    judul: "Kitab dan Artikel yang Tidak Pernah Ada di Muka Bumi",
    jurnal: "Jurnal Rekayasa Internasional",
    tahun: "2024",
  };
  const h = bandingkanDenganRekod(fiktif, REKOD_IHYA);
  cek("metadata: kartu fiktif vs rekod asli: gagal-metadata", h.status === "gagal-metadata", h.alasan);
  const cocok: KandidatVerifikasi = { ...fiktif, ...REKOD_IHYA, id: "emas-cocok" };
  cek("metadata: kartu persis rekod: lolos", bandingkanDenganRekod(cocok, REKOD_IHYA).status === "lolos");
}

/* ── 6. Penanda bidang jurnal pada konteks fikih ───────────────────── */

const KONTEKS_FIQH: KonteksProyek = {
  bidangId: "fiqh",
  bidangLabel: "Fiqh & Ushul Fiqh",
  judulProyek: JUDUL_UANG_PANAI,
  topik: "",
};
{
  const b = deteksiBidangSumber("إميل دوركايم ونظرية الانتحار في علم الاجتماع");
  cek("penanda: judul Durkheim terdeteksi Sosiologi", b === "Sosiologi", b ?? "(null)");
  cek("penanda: Sosiologi bukan milik proyek fiqh", b !== null && bidangMilikProyek(b, KONTEKS_FIQH) === false);
}
{
  const b = deteksiBidangSumber("الشرعية التنظيمية وعلاقتها بالالتزام التنظيمي لدى العاملين");
  cek("penanda: الشرعية التنظيمية terdeteksi Manajemen", b === "Manajemen dan administrasi", b ?? "(null)");
  cek("penanda: Manajemen bukan milik proyek fiqh", b !== null && bidangMilikProyek(b, KONTEKS_FIQH) === false);
}

/* ── 7. Gerbang jurnal deterministik (Tahap G2, luring) ──────────────
 * Label cabang diberikan manual persis seperti yang dibaca
 * lib/server/label-sumber.ts dari rekod OpenAlex nyata keempat
 * fixture (diperiksa hidup 6 Nov 2026): Ihya {tafsir, fiqh};
 * maqashid {tafsir}; ekonomi {iqtishad}; الشرعية التنظيمية
 * {iqtishad}. Pasangan hidupnya ada di test-emas-hidup.ts bagian E. */

cek("label teks: Qur'anic Interpretation Studies → tafsir",
  labelCabangDariTeks("Qur'anic Interpretation Studies") === "tafsir");
cek("label teks: Qur’anic (kutip lengkung) → tafsir",
  labelCabangDariTeks("Qur’anic Interpretation Studies") === "tafsir");
cek("label teks: Fiqh (konsep OpenAlex) → fiqh", labelCabangDariTeks("Fiqh") === "fiqh");
cek("label teks: Global trade and economics → iqtishad",
  labelCabangDariTeks("Global trade and economics") === "iqtishad");
cek("label teks: Islamic Finance and Banking Studies → iqtishad",
  labelCabangDariTeks("Islamic Finance and Banking Studies") === "iqtishad");
cek("label teks: التكامل الاقتصادي (nama jurnal) → iqtishad",
  labelCabangDariTeks("التكامل الاقتصادي") === "iqtishad");
cek("label teks: مجلة الإحياء → null (nama jurnal bukan cabang)",
  labelCabangDariTeks("مجلة الإحياء") === null);
cek("label teks: nama jurnal Ihya → null",
  labelCabangDariTeks("International Journal Ihya' 'Ulum al-Din") === null);
cek("label teks: Islamic Thought and Society Studies → null (domain saja, bukan cabang)",
  labelCabangDariTeks("Islamic Thought and Society Studies") === null);
cek("label teks: Education and Islamic Studies → null (education telanjang bukan tarbiyah)",
  labelCabangDariTeks("Education and Islamic Studies") === null);
cek("label teks: Workplace Spirituality and Leadership → null",
  labelCabangDariTeks("Workplace Spirituality and Leadership") === null);

const JUDUL_TAKAMUL_EMAS = "التكامل المعرفي بين علوم القرآن وأصول الفقه";
const JUDUL_IHYA =
  "Kaidah Fiqh dan Ushul Fiqh Tentang Produk Halal, Metode Istinbath dan Ijtihad dalam Menetapkan Hukum Produk Halal";
{
  const h = gerbangJurnal(
    {
      judul: JUDUL_IHYA,
      jurnal: "International Journal Ihya' 'Ulum al-Din",
      isi: "The purpose of the discovery of Islamic law must be understood by the mujtahid in order to develop legal thinking in Islam and answer contemporary legal issues, especially those related to the field of muamalah, based on the Qur'an and Sunnah.",
      labelSumber: ["tafsir", "fiqh"],
      judulProyek: JUDUL_TAKAMUL_EMAS,
    },
    "quran",
  );
  cek("jurnal: Ihya vs takamul: LOLOS deterministik", h.putusan === "lolos", `${h.kode} :: ${h.alasan}`);
  const h2 = gerbangJurnal(
    {
      judul: JUDUL_IHYA,
      jurnal: "International Journal Ihya' 'Ulum al-Din",
      isi: "Islamic law and muamalah.",
      labelSumber: ["tafsir", "fiqh"],
      judulProyek: JUDUL_UANG_PANAI,
    },
    "fiqh",
  );
  cek("jurnal: Ihya vs uang panai (munakahat): LOLOS", h2.putusan === "lolos", `${h2.kode} :: ${h2.alasan}`);
}
{
  const h = gerbangJurnal(
    {
      judul:
        "التكامل المعرفي بين مقاصد القرآن ومقاصد الشريعة في تفسير أطوار العمران من خلال مقدمة ابن خلدون",
      jurnal: "مجلة الإحياء",
      labelSumber: ["tafsir"],
      judulProyek: JUDUL_TAKAMUL_EMAS,
    },
    "quran",
  );
  cek("jurnal: maqashid (label tafsir, tanpa abstrak) vs takamul: LOLOS",
    h.putusan === "lolos", `${h.kode} :: ${h.alasan}`);
}
{
  const kandidatEkonomi = {
    judul: "التكامل مع الجيران: دراسة في اتفاقية التجارة الحرة العربية الكبرى ومنطقة التبادل الحر",
    jurnal: "التكامل الاقتصادي",
    labelSumber: ["iqtishad"] as const,
  };
  const gugur = gerbangJurnal(
    { ...kandidatEkonomi, labelSumber: [...kandidatEkonomi.labelSumber], judulProyek: JUDUL_UANG_PANAI },
    "fiqh",
  );
  cek("jurnal: ekonomi vs uang panai: GUGUR gagal-bidang",
    gugur.putusan === "gagal-bidang", `${gugur.kode} :: ${gugur.alasan}`);
  const lolos = gerbangJurnal(
    {
      ...kandidatEkonomi,
      labelSumber: [...kandidatEkonomi.labelSumber],
      judulProyek: "التكامل الاقتصادي بين الدول العربية والإسلامية",
    },
    "iqtishad",
  );
  cek("jurnal: ekonomi vs iqtishad (penolak ekonomi diskop keluar): LOLOS",
    lolos.putusan === "lolos", `${lolos.kode} :: ${lolos.alasan}`);
}
{
  const h = gerbangJurnal(
    {
      judul: "الشرعية التنظيمية بين النظرية والتطبيق",
      jurnal: "مجلة أبحاث",
      labelSumber: ["iqtishad"],
      judulProyek: JUDUL_UANG_PANAI,
    },
    "fiqh",
  );
  cek("jurnal: الشرعية التنظيمية (label iqtishad) vs uang panai: GUGUR CAB_BERTENTANGAN",
    h.putusan === "gagal-bidang" && h.kode === "CAB_BERTENTANGAN", `${h.kode} :: ${h.alasan}`);
}
{
  // Aturan 2 jurnal: label bertentangan menggugurkan SEBELUM istilah
  // inti menolong — cermin kasus kitab akidah berjudul الزواج.
  const h = gerbangJurnal(
    {
      judul: "التوحيد وأثره في الزواج",
      labelSumber: ["akidah"],
      judulProyek: JUDUL_UANG_PANAI,
    },
    "fiqh",
  );
  cek("jurnal: artikel akidah berjudul الزواج tetap GUGUR (label lebih dulu)",
    h.putusan === "gagal-bidang" && h.kode === "CAB_BERTENTANGAN", `${h.kode} :: ${h.alasan}`);
}
{
  // Aturan 5 versi artikel pada mode cadangan (bidang fiqh generik):
  // label sesuai tanpa inti — BERABSTRAK gugur, TANPA abstrak tertahan.
  const dasar = {
    judul: "دراسة تحليلية في موضوعات معاصرة متنوعة",
    jurnal: "مجلة الدراسات المعاصرة",
    labelSumber: ["fiqh"] as const,
  };
  const berabstrak = gerbangJurnal(
    { ...dasar, labelSumber: [...dasar.labelSumber], isi: "يتناول هذا البحث موضوعات عامة متنوعة في الدراسات المعاصرة من جوانب متعددة دون تركيز على مسألة بعينها." },
    "fiqh",
  );
  cek("jurnal aturan 5: sesuai tanpa inti + abstrak terbaca: GUGUR",
    berabstrak.putusan === "gagal-bidang" && berabstrak.kode === "GUGUR_SESUAI_TANPA_INTI",
    `${berabstrak.kode} :: ${berabstrak.alasan}`);
  const tanpaAbstrak = gerbangJurnal({ ...dasar, labelSumber: [...dasar.labelSumber] }, "fiqh");
  cek("jurnal aturan 5: sesuai tanpa inti + tanpa abstrak: KONFIRMASI tertahan",
    tanpaAbstrak.putusan === "belum-terverifikasi" && tanpaAbstrak.alasan.startsWith("Perlu konfirmasi:"),
    `${tanpaAbstrak.kode} :: ${tanpaAbstrak.alasan}`);
}
{
  // Aturan 8: label kosong + istilah inti leksikon → tertahan, BUKAN
  // lolos (model tidak bisa menaikkan; deterministiknya tertahan).
  const h = gerbangJurnal(
    {
      judul: "التكامل بين العلوم الشرعية والعلوم الكونية",
      labelSumber: [],
      judulProyek: JUDUL_TAKAMUL_EMAS,
    },
    "quran",
  );
  cek("jurnal aturan 8: label kosong + inti leksikon: KONFIRMASI tertahan",
    h.putusan === "belum-terverifikasi" && h.kode === "KONF_TAKJELAS_INTI", `${h.kode} :: ${h.alasan}`);
  // Aturan 6: cabang bersebelahan (hadis pada munakahat) + inti → tertahan.
  const h6 = gerbangJurnal(
    {
      judul: "أحاديث النكاح في صحيح البخاري دراسة تحليلية",
      labelSumber: ["hadis"],
      judulProyek: JUDUL_UANG_PANAI,
    },
    "fiqh",
  );
  cek("jurnal aturan 6: hadis bersebelahan + inti نكاح: KONFIRMASI tertahan",
    h6.putusan === "belum-terverifikasi" && h6.kode === "KONF_SEBELAHAN_INTI", `${h6.kode} :: ${h6.alasan}`);
  // Aturan 3: domain sains keras → GUGUR.
  const h3 = gerbangJurnal(
    { judul: "A randomized trial of a new drug compound", labelSumber: [], domainAsingKeras: true },
    "fiqh",
  );
  cek("jurnal aturan 3: domainAsingKeras: GUGUR DOMAIN_ASING",
    h3.putusan === "gagal-bidang" && h3.kode === "DOMAIN_ASING", `${h3.kode} :: ${h3.alasan}`);
}

/* ── 8. Skema ketat keluaran pencarian (Tahap G2) ──────────────────── */

const SKEMA_SIAP_KHULU = {
  status: "siap",
  kata_kunci_inti: [
    { istilah: "خلع", bahasa: "ar", pendamping_konteks: ["فقه الأسرة", "أحكام النكاح"] },
    { istilah: "khulu", bahasa: "en", pendamping_konteks: ["Islamic family law"] },
  ],
  perluasan_kueri: [
    { teks: "حكم الخلع في الفقه الإسلامي", bahasa: "ar", jenis: "inti", sumber_target: ["shamela", "turath"] },
    { teks: "khulu in Islamic family law", bahasa: "en", jenis: "inti", sumber_target: ["crossref", "openalex"] },
  ],
  bidang_utama: "fikih_munakahat",
  bidang_pendukung: ["ushul_fikih"],
};
cek("skema: contoh siap khulu' munakahat SAH", validasiKeluaranPencarian(SKEMA_SIAP_KHULU).sah === true);

const SKEMA_DISAMBIGUASI_TAKAMUL = {
  status: "perlu_disambiguasi",
  ambiguitas: {
    istilah_ambigu: "التكامل",
    kemungkinan_makna: [
      { makna: "Integrasi keilmuan", bidang: "integrasi_keilmuan" },
      { makna: "Integrasi ekonomi", bidang: "di_luar_studi_islam" },
      { makna: "Kalkulus", bidang: "di_luar_studi_islam" },
    ],
  },
};
cek("skema: contoh perlu_disambiguasi takamul SAH",
  validasiKeluaranPencarian(SKEMA_DISAMBIGUASI_TAKAMUL).sah === true);
cek("skema: tidak_ditemukan bersih SAH",
  validasiKeluaranPencarian({ status: "tidak_ditemukan", alasan_tidak_ditemukan: "topik_tidak_spesifik" }).sah === true);

cek("skema tolak: field kandidat berisi judul/DOI fiktif",
  validasiKeluaranPencarian({
    ...SKEMA_SIAP_KHULU,
    kandidat: [{ judul: "Artikel Fiktif tentang Khulu", doi: "10.9999/fiktif.123" }],
  }).sah === false);
cek("skema tolak: field judul bibliografis di tingkat atas",
  validasiKeluaranPencarian({ ...SKEMA_SIAP_KHULU, judul: "Judul karangan model" }).sah === false);
cek("skema tolak: kueri satu kata تكامل",
  validasiKeluaranPencarian({
    ...SKEMA_SIAP_KHULU,
    perluasan_kueri: [
      { teks: "تكامل", bahasa: "ar", jenis: "inti", sumber_target: ["shamela"] },
    ],
  }).sah === false);
cek("skema tolak: tidak_ditemukan membawa kueri",
  validasiKeluaranPencarian({
    status: "tidak_ditemukan",
    alasan_tidak_ditemukan: "tidak_cukup_informasi",
    perluasan_kueri: [
      { teks: "حكم الخلع في الفقه", bahasa: "ar", jenis: "inti", sumber_target: ["shamela"] },
    ],
  }).sah === false);
cek("skema tolak: tidak_ditemukan tanpa alasan enum",
  validasiKeluaranPencarian({ status: "tidak_ditemukan" }).sah === false);
cek("skema tolak: pola DOI di dalam teks kueri",
  validasiKeluaranPencarian({
    ...SKEMA_SIAP_KHULU,
    perluasan_kueri: [
      { teks: "khulu sebagaimana doi 10.1234/abcd.5678 dibahas", bahasa: "en", jenis: "inti", sumber_target: ["crossref"] },
    ],
  }).sah === false);
cek("skema tolak: bidang di luar enum",
  validasiKeluaranPencarian({ ...SKEMA_SIAP_KHULU, bidang_utama: "kedokteran" }).sah === false);

{
  const kamus = kamusAmbiguitasUntuk("التكامل المعرفي بين علوم القرآن وأصول الفقه");
  cek("kamus: takamul tercatat dengan 4 makna", kamus !== null && kamus.makna.length === 4,
    kamus ? kamus.makna.map((m) => m.bidang).join(",") : "(null)");
  cek("kamus: makna integrasi_keilmuan membawa konteks wajib العلوم الشرعية",
    kamus?.makna.find((m) => m.bidang === "integrasi_keilmuan")?.konteks.includes("العلوم الشرعية") === true);
  cek("kamus: khulu' tidak ambigu di kamus", kamusAmbiguitasUntuk("حكم الخلع في الفقه") === null);
}
cek("parser lama dikeraskan: parseKalimat menolak keluaran berfield doi",
  parseKalimat(JSON.stringify({ kalimat: [{ teks: "حكم الخلع في الفقه الإسلامي", arti: "hukum khulu", alasan: "uji", peran: "taswir" }], doi: "10.9999/fiktif.123" })) === null);
cek("parser lama dikeraskan: parseKalimat bersih tetap lolos",
  parseKalimat(JSON.stringify({ kalimat: [{ teks: "حكم الخلع في الفقه الإسلامي", arti: "hukum khulu", alasan: "uji", peran: "taswir" }] })) !== null);
cek("parser lama dikeraskan: parseKata menolak keluaran berfield judul",
  parseKata(JSON.stringify({ kata: [{ ar: "الخلع", id: "khulu" }], judul: "Karangan" })) === null);

console.log(`\nHASIL: ${lulus} PASS, ${gagal} GAGAL`);
if (gagal > 0) process.exit(1);
