/**
 * Set uji emas v1 — Aturan Pencarian Valid (Tahap G1, 6 Nov 2026).
 *
 * Regresi TETAP untuk kasus-kasus nyata yang pernah membuktikan
 * bocor atau gerbang bekerja, dijalankan LURING dan deterministik:
 * gerbang kategori kitab bermesin sembilan aturan (kasus uang panai
 * + kasus leksikon takamul dari bahan resmi pemilik), periksa
 * metadata (bandingkanDenganRekod), dan penanda bidang jurnal.
 * Pasangan hidupnya (adapter nyata, endpoint, jembatan model) ada
 * di scripts/test-emas-hidup.ts.
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
  gerbangKategoriKitab,
  namaKategoriSumber,
  normalisasiKategoriKitab,
} from "../lib/engine/kategori-kitab";
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

console.log(`\nHASIL: ${lulus} PASS, ${gagal} GAGAL`);
if (gagal > 0) process.exit(1);
