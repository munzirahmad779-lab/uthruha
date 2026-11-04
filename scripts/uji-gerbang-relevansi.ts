/**
 * Uji gerbang relevansi bidang (Kelompok A, perbaikan dari laporan
 * koreksi rekaman tutorial). TANPA jaringan dan TANPA model: yang diuji
 * hanya fungsi murni deteksi bidang, jalur aturan keras nilaiRelevansi
 * (yang memang tidak memanggil model), dan penyaring adapter jurnal.
 * Jalankan: npx tsx scripts/uji-gerbang-relevansi.ts
 */
import {
  deteksiBidangSumber,
  nilaiRelevansi,
  type KonteksProyek,
} from "../lib/server/gerbang-relevansi";
import {
  apakahJudulPerangkatLunak,
  hitungSkorJurnal,
} from "../lib/refs/adapters/jurnal";

let gagal = 0;
function cek(nama: string, lulus: boolean, info = "") {
  console.log(`${lulus ? "PASS" : "GAGAL"} ${nama}${info ? ` - ${info}` : ""}`);
  if (!lulus) gagal++;
}

const KONTEKS_FIQH: KonteksProyek = {
  bidangId: "fiqh",
  bidangLabel: "Fiqh & Ushul Fiqh (الفقه وأصوله)",
  judulProyek: "التكامل المعرفي في الفقه وأصوله",
  topik: "التكامل المعرفي",
};

async function utama() {
  // 1) Kasus Durkheim: artikel sosiologi pada jurnal sosiologi harus
  //    terdeteksi sebagai bidang Sosiologi.
  const bidangDurkheim = deteksiBidangSumber(
    "Pemikiran Emile Durkheim tentang Fakta Sosial dan Agama",
    "Majalah Sosiologi",
  );
  cek("Durkheim terdeteksi Sosiologi (judul + jurnal Latin)", bidangDurkheim === "Sosiologi", String(bidangDurkheim));

  const bidangDurkheimAr = deteksiBidangSumber(
    "نظرية دوركايم في علم الاجتماع الديني",
    "مجلة الدراسات الاجتماعية",
  );
  cek("Durkheim terdeteksi Sosiologi (judul + jurnal Arab)", bidangDurkheimAr === "Sosiologi", String(bidangDurkheimAr));

  // 2) Artikel takamul ma'rifi pada jurnal studi Islam TIDAK terdeteksi
  //    asing untuk bidang fiqh.
  const bidangTakamul = deteksiBidangSumber(
    "التكامل المعرفي عند أمين الخولي وأثره في الدراسات الفقهية",
    "مجلة الدراسات الإسلامية",
  );
  cek("takamul ma'rifi tidak terdeteksi asing", bidangTakamul === null, String(bidangTakamul));

  // 3) Gerbang penuh lewat aturan keras: Durkheim tertahan walau model
  //    tidak dipanggil sama sekali (jalur aturan keras nilaiRelevansi
  //    mengembalikan keputusan sebelum menyentuh kolam).
  const nilaiDurkheim = await nilaiRelevansi(
    {
      judul: "Pemikiran Emile Durkheim tentang Fakta Sosial dan Agama",
      wadah: "Majalah Sosiologi",
      jenis: "jurnal",
    },
    KONTEKS_FIQH,
    "يبين الباحث أن التكامل المعرفي ضرورة في دراسة الفقه وأصوله",
  );
  cek(
    "gerbang menahan Durkheim tanpa model",
    nilaiDurkheim.lolos === false &&
      nilaiDurkheim.perluKonfirmasi === true &&
      nilaiDurkheim.statusPenilaian === "aturan-keras" &&
      nilaiDurkheim.skorModel === undefined,
    JSON.stringify(nilaiDurkheim),
  );

  // 4) Bidang asing lain yang disebut laporan ikut tertangkap.
  cek(
    "legitimasi organisasi terdeteksi Manajemen",
    deteksiBidangSumber("الشرعية التنظيمية في المؤسسات التعليمية", "مجلة الإدارة") === "Manajemen dan administrasi",
  );
  cek(
    "pendidikan jasmani terdeteksi",
    deteksiBidangSumber("أثر التربية البدنية في التحصيل الدراسي", "مجلة علوم الرياضة") ===
      "Pendidikan jasmani dan olahraga",
  );

  // 5) Entri perangkat lunak tertolak penyaring judul adapter jurnal.
  cek(
    "perangkat lunak المكتبة الشاملة tertolak",
    apakahJudulPerangkatLunak("المكتبة الشاملة الإصدار 5") === true,
  );
  cek(
    "judul artikel biasa tidak tertuduh perangkat lunak",
    apakahJudulPerangkatLunak("التكامل المعرفي في الدراسات الإسلامية المعاصرة") === false,
  );

  // 6) Skor jurnal nyata dan berbeda antar item, bukan konstan 0,88.
  const kueri = "التكامل المعرفي الدراسات الإسلامية";
  const skorKuat = hitungSkorJurnal("التكامل المعرفي في الدراسات الإسلامية", kueri, 80);
  const skorLemah = hitungSkorJurnal("دراسة في موضوع آخر بعيد", kueri, 5);
  const skorTanpaCrossref = hitungSkorJurnal("التكامل المعرفي في الدراسات الإسلامية", kueri);
  cek("skor jurnal dalam rentang 0..1", skorKuat >= 0 && skorKuat <= 1 && skorLemah >= 0 && skorLemah <= 1);
  cek("skor jurnal berbeda antar item", skorKuat > skorLemah, `kuat=${skorKuat} lemah=${skorLemah}`);
  cek(
    "tanpa skor Crossref, skor dari tumpang-tindih token murni",
    skorTanpaCrossref > 0.9,
    String(skorTanpaCrossref),
  );

  console.log(gagal === 0 ? "SEMUA PASS" : `${gagal} GAGAL`);
  process.exit(gagal === 0 ? 0 : 1);
}

void utama();
