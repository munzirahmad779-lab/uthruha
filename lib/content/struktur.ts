import type { ChapterDef, KaryaType, SectionDef, StrukturDef } from "./types";

/**
 * Struktur naskah mengikuti konvensi penulisan karya ilmiah berbahasa Arab
 * yang lazim dipakai di perguruan tinggi keislaman (الباب الأول … الباب الخامس)
 * dan konvensi artikel jurnal (IMRaD versi Arab).
 */

const s = (
  section: SectionDef,
  skala: number,
): SectionDef => ({ ...section, targetKata: Math.round(section.targetKata * skala) });

const bab1 = (skala: number): ChapterDef => ({
  id: "bab1",
  labelId: "BAB I — Pendahuluan",
  labelAr: "الباب الأول: المقدمة",
  babAr: "الباب الأول",
  sections: [
    s(
      {
        id: "khalfiya",
        labelId: "Latar Belakang",
        labelAr: "خلفية البحث",
        headingAr: "خلفية البحث",
        panduan:
          "Turunkan pembaca dari masalah besar ke masalah yang Anda teliti: fenomena, data pendukung, kesenjangan riset, lalu celah yang Anda isi.",
        pemicu: [
          "Fenomena apa yang Anda amati dan membuat tema ini penting sekarang?",
          "Data atau angka apa yang bisa mendukung urgensi tema ini?",
          "Apa yang sudah diteliti orang lain, dan apa yang belum terjawab?",
        ],
        targetKata: 900,
      },
      skala,
    ),
    s(
      {
        id: "masalah",
        labelId: "Rumusan Masalah",
        labelAr: "تحديد المشكلة",
        headingAr: "تحديد المشكلة",
        panduan:
          "Rumuskan 2–4 pertanyaan penelitian yang bisa dijawab dengan data, bukan retorika. Setiap rumusan harus punya pasangan di tujuan dan kesimpulan.",
        pemicu: [
          "Apa pertanyaan pokok yang harus terjawab oleh penelitian ini?",
          "Apakah setiap pertanyaan dapat dijawab dengan metode yang Anda pilih?",
          "Adakah batasan masalah yang perlu dinyatakan agar penelitian tidak melebar?",
        ],
        targetKata: 220,
      },
      skala,
    ),
    s(
      {
        id: "ahdaf",
        labelId: "Tujuan Penelitian",
        labelAr: "أهداف البحث",
        headingAr: "أهداف البحث",
        panduan:
          "Tulis tujuan sejajar satu-satu dengan rumusan masalah — jumlah dan urutannya sama.",
        pemicu: [
          "Apa yang ingin Anda ketahui, jelaskan, atau uji?",
          "Apakah tujuan dinyatakan dengan kata kerja yang terukur?",
        ],
        targetKata: 180,
      },
      skala,
    ),
    s(
      {
        id: "fawaid",
        labelId: "Manfaat Penelitian",
        labelAr: "فوائد البحث",
        headingAr: "فوائد البحث",
        panduan:
          "Pisahkan manfaat teoretis (sumbangan ilmu) dan praktis (pembaca nyata: lembaga, guru, peneliti berikutnya).",
        pemicu: [
          "Siapa yang akan memakai hasil penelitian ini?",
          "Sumbangan apa yang diberikan pada teori atau praktik?",
        ],
        targetKata: 220,
      },
      skala,
    ),
    s(
      {
        id: "hudud",
        labelId: "Batasan Penelitian",
        labelAr: "حدود البحث",
        headingAr: "حدود البحث",
        panduan:
          "Nyatakan batas objek, lokasi, waktu, dan populasi. Batasan yang jujur justru memperkuat naskah.",
        pemicu: [
          "Apa yang sengaja tidak diteliti, dan mengapa?",
          "Pada ruang dan waktu mana penelitian ini berlaku?",
        ],
        targetKata: 200,
      },
      skala,
    ),
    s(
      {
        id: "mustalahat",
        labelId: "Definisi Istilah",
        labelAr: "تحديد المصطلحات",
        headingAr: "تحديد المصطلحات",
        panduan:
          "Definisikan istilah kunci secara operasional: makna etimologis singkat, lalu makna yang Anda pakai dalam penelitian ini.",
        pemicu: [
          "Istilah mana yang sering disalahpahami pembaca?",
          "Apa makna istilah tersebut dalam konteks penelitian Anda?",
        ],
        targetKata: 260,
      },
      skala,
    ),
  ],
});

const bab2 = (skala: number): ChapterDef => ({
  id: "bab2",
  labelId: "BAB II — Kerangka Teori",
  labelAr: "الباب الثاني: الإطار النظري",
  babAr: "الباب الثاني",
  sections: [
    s(
      {
        id: "ithar",
        labelId: "Kerangka Teori",
        labelAr: "الإطار النظري",
        headingAr: "الإطار النظري",
        panduan:
          "Susun teori dari yang paling umum ke yang paling dekat dengan variabel Anda. Setiap sub-bab harus berujung pada konsep yang akan Anda pakai di bab III–IV.",
        pemicu: [
          "Teori utama mana yang menjadi lensa penelitian ini?",
          "Siapa tokoh kuncinya dan bagaimana definisinya?",
          "Bagaimana teori itu menjelaskan fenomena Anda?",
        ],
        targetKata: 1100,
      },
      skala,
    ),
    s(
      {
        id: "dirasat",
        labelId: "Penelitian Terdahulu",
        labelAr: "الدراسات السابقة",
        headingAr: "الدراسات السابقة",
        panduan:
          "Bukan daftar ringkasan, tapi perbandingan: apa persamaan, apa perbedaan, dan di mana posisi kebaruan Anda.",
        pemicu: [
          "Studi mana yang paling dekat dengan penelitian Anda?",
          "Apa perbedaan pada objek, metode, atau konteks?",
          "Apa yang belum dijawab studi-studi tersebut?",
        ],
        targetKata: 900,
      },
      skala,
    ),
    s(
      {
        id: "itharFikri",
        labelId: "Kerangka Berpikir",
        labelAr: "الإطار الفكري",
        headingAr: "الإطار الفكري",
        panduan:
          "Gambarkan alur logika: variabel/fenomena → hubungan → dugaan hasil. Bisa dilengkapi bagan sederhana.",
        pemicu: [
          "Bagaimana variabel atau konsep Anda saling berhubungan?",
          "Apa yang Anda duga terjadi, dan mengapa?",
        ],
        targetKata: 400,
      },
      skala,
    ),
    s(
      {
        id: "farudhiyat",
        labelId: "Hipotesis",
        labelAr: "الفرضيات",
        headingAr: "الفرضيات",
        panduan:
          "Tuliskan Ha dan H0 dalam bentuk yang bisa diuji statistik. Satu pasang hipotesis untuk satu rumusan masalah.",
        pemicu: [
          "Apa dugaan arah hubungan atau perbedaan?",
          "Uji statistik apa yang akan memutuskan Ha diterima atau ditolak?",
        ],
        targetKata: 300,
        metode: ["kuantitatif", "mixed"],
      },
      skala,
    ),
  ],
});

const bab3 = (skala: number): ChapterDef => ({
  id: "bab3",
  labelId: "BAB III — Metode Penelitian",
  labelAr: "الباب الثالث: منهج البحث",
  babAr: "الباب الثالث",
  sections: [
    s(
      {
        id: "manhajNau",
        labelId: "Jenis & Pendekatan",
        labelAr: "نوع البحث ومدخله",
        headingAr: "نوع البحث ومدخله",
        panduan:
          "Sebutkan jenis penelitian (lapangan/kepustakaan) dan pendekatannya, lalu alasan memilihnya — bukan sekadar definisi.",
        pemicu: [
          "Apakah data Anda lahir dari lapangan atau teks?",
          "Mengapa pendekatan ini, bukan pendekatan lain?",
        ],
        targetKata: 350,
      },
      skala,
    ),
    s(
      {
        id: "masadir",
        labelId: "Sumber & Subjek Data",
        labelAr: "مصادر البيانات",
        headingAr: "مصادر البيانات",
        panduan:
          "Bedakan data primer dan sekunder. Untuk penelitian lapangan, jelaskan populasi, sampel, dan teknik pengambilannya.",
        pemicu: [
          "Dari siapa atau dari dokumen apa data diambil?",
          "Bagaimana sampel ditentukan dan berapa jumlahnya?",
        ],
        targetKata: 500,
      },
      skala,
    ),
    s(
      {
        id: "adawat",
        labelId: "Teknik & Instrumen",
        labelAr: "أدوات جمع البيانات",
        headingAr: "أدوات جمع البيانات",
        panduan:
          "Jelaskan observasi, wawancara, angket, atau dokumentasi yang dipakai, beserta uji validitas dan reliabilitas instrumen.",
        pemicu: [
          "Alat apa yang dipakai untuk mengambil data?",
          "Bagaimana Anda memastikan alat itu sah dan konsisten?",
        ],
        targetKata: 600,
      },
      skala,
    ),
    s(
      {
        id: "tahlil",
        labelId: "Analisis Data",
        labelAr: "تحليل البيانات",
        headingAr: "تحليل البيانات",
        panduan:
          "Sebutkan prosedur analisis langkah demi langkah, termasuk uji prasyarat untuk penelitian kuantitatif.",
        pemicu: [
          "Bagaimana data mentah diubah menjadi temuan?",
          "Uji atau tahapan analisis apa yang dijalankan, berurutan?",
        ],
        targetKata: 550,
      },
      skala,
    ),
  ],
});

const bab4 = (skala: number): ChapterDef => ({
  id: "bab4",
  labelId: "BAB IV — Hasil & Pembahasan",
  labelAr: "الباب الرابع: نتائج البحث",
  babAr: "الباب الرابع",
  sections: [
    s(
      {
        id: "wasf",
        labelId: "Deskripsi Data",
        labelAr: "وصف البيانات",
        headingAr: "وصف البيانات",
        panduan:
          "Gambarkan objek penelitian dan data yang terkumpul sebelum masuk analisis. Sajikan tabel sebaran data, bukan interpretasi.",
        pemicu: [
          "Bagaimana gambaran umum lokasi atau objek penelitian?",
          "Bagaimana sebaran data yang berhasil dikumpulkan?",
        ],
        targetKata: 700,
        butuhData: true,
      },
      skala,
    ),
    s(
      {
        id: "tahlilNataij",
        labelId: "Analisis & Pengujian",
        labelAr: "تحليل النتائج",
        headingAr: "تحليل النتائج",
        panduan:
          "Jawab rumusan masalah satu per satu dengan data. Untuk kuantitatif, tampilkan hasil uji beserta nilai statistiknya.",
        pemicu: [
          "Apa jawaban data untuk setiap rumusan masalah?",
          "Apakah hipotesis diterima atau ditolak, dengan nilai apa?",
        ],
        targetKata: 900,
        butuhData: true,
      },
      skala,
    ),
    s(
      {
        id: "munazara",
        labelId: "Pembahasan",
        labelAr: "مناقشة النتائج",
        headingAr: "مناقشة النتائج",
        panduan:
          "Bandingkan temuan Anda dengan teori di bab II dan studi di bab II. Jelaskan mengapa hasilnya bisa demikian.",
        pemicu: [
          "Apakah temuan ini mendukung, menolak, atau menyempurnakan teori?",
          "Apa penjelasan yang masuk akal atas hasil yang tidak terduga?",
        ],
        targetKata: 800,
        butuhData: true,
      },
      skala,
    ),
  ],
});

const bab5 = (skala: number): ChapterDef => ({
  id: "bab5",
  labelId: "BAB V — Penutup",
  labelAr: "الباب الخامس: الخاتمة",
  babAr: "الباب الخامس",
  sections: [
    s(
      {
        id: "khulasah",
        labelId: "Kesimpulan",
        labelAr: "الخلاصة",
        headingAr: "الخلاصة",
        panduan:
          "Jawab setiap rumusan masalah secara ringkas dan tegas — tanpa data baru, tanpa sitasi baru.",
        pemicu: [
          "Apa jawaban akhir untuk setiap rumusan masalah?",
          "Apa kontribusi utama penelitian ini dalam satu paragraf?",
        ],
        targetKata: 400,
      },
      skala,
    ),
    s(
      {
        id: "iqtirahat",
        labelId: "Saran",
        labelAr: "الاقتراحات",
        headingAr: "الاقتراحات",
        panduan:
          "Beri saran yang dapat dikerjakan: untuk peneliti berikutnya, lembaga, dan praktisi. Hindari saran klise.",
        pemicu: [
          "Apa yang sebaiknya diteliti lanjut oleh orang lain?",
          "Apa tindakan nyata yang disarankan bagi pemangku kepentingan?",
        ],
        targetKata: 300,
      },
      skala,
    ),
  ],
});

const jurnal: ChapterDef[] = [
  {
    id: "j1",
    labelId: "Abstrak",
    labelAr: "الملخص",
    babAr: "الملخص",
    sections: [
      {
        id: "mulakhkhas",
        labelId: "Abstrak",
        labelAr: "الملخص",
        headingAr: "الملخص",
        panduan:
          "Satu paragraf: tujuan, metode, temuan utama, implikasi. Lalu kata kunci (الكلمات المفتاحية) 3–5 kata.",
        pemicu: [
          "Apa temuan paling penting yang harus terbaca dalam 30 detik?",
          "Kata kunci apa yang dipakai orang untuk mencari topik ini?",
        ],
        targetKata: 200,
      },
      {
        id: "abstrakEn",
        labelId: "Abstrak Bahasa Inggris (Abstract)",
        labelAr: "Abstract",
        headingAr: "Abstract",
        panduan:
          "Terjemahan setia abstrak Arab ke bahasa Inggris akademik — jurnal bereputasi menolak naskah tanpa abstract berbahasa Inggris. Istilah kunci diterjemahkan konsisten dengan kata kunci.",
        pemicu: ["Apakah abstract ini terbaca natural bagi penutur akademik Inggris?"],
        targetKata: 200,
      },
      {
        id: "kataKunciArtikel",
        labelId: "Kata Kunci",
        labelAr: "الكلمات المفتاحية",
        headingAr: "الكلمات المفتاحية",
        panduan:
          "3–5 kata kunci dalam tiga bahasa bila jurnal memintanya (Arab, Inggris, Indonesia), dipilih dari istilah yang benar-benar dicari pembaca di basis data.",
        pemicu: ["Istilah apa yang dipakai peneliti lain untuk menemukan topik ini?"],
        targetKata: 40,
      },
    ],
  },
  {
    id: "j2",
    labelId: "Pendahuluan",
    labelAr: "المقدمة",
    babAr: "المقدمة",
    sections: [
      {
        id: "muqaddima",
        labelId: "Pendahuluan Artikel",
        labelAr: "المقدمة",
        headingAr: "المقدمة",
        panduan:
          "Pola funnel: konteks → penelitian sebelumnya → celah → tujuan & kebaruan artikel. Tanpa sub-judul. Pendahuluan artikel jurnal bereputasi wajib memuat pernyataan kebaruan (novelty) yang eksplisit dan posisi terhadap literatur mutakhir — tanpa itu, naskah ditolak sebelum dinilai isinya.",
        pemicu: [
          "Mengapa artikel ini perlu dibaca sekarang?",
          "Apa celah yang diisi artikel ini dibanding studi terdahulu?",
        ],
        targetKata: 1300,
      },
    ],
  },
  {
    id: "j3",
    labelId: "Metode",
    labelAr: "الطريقة",
    babAr: "الطريقة",
    sections: [
      {
        id: "tariqa",
        labelId: "Metode",
        labelAr: "الطريقة",
        headingAr: "الطريقة",
        panduan:
          "Ringkas tapi cukup untuk direplikasi: desain, data, instrumen, prosedur analisis, dan alat bantu.",
        pemicu: [
          "Apakah pembaca bisa mengulang penelitian ini dari uraian Anda?",
          "Perangkat lunak atau alat bantu apa yang dipakai?",
        ],
        targetKata: 600,
      },
    ],
  },
  {
    id: "j4",
    labelId: "Hasil & Pembahasan",
    labelAr: "النتائج والمناقشة",
    babAr: "النتائج والمناقشة",
    sections: [
      {
        id: "nataij",
        labelId: "Hasil & Pembahasan",
        labelAr: "النتائج والمناقشة",
        headingAr: "النتائج والمناقشة",
        panduan:
          "Sajikan temuan lalu tafsirkan: bandingkan dengan literatur, jelaskan mekanismenya, akui batasnya.",
        pemicu: [
          "Apa pola utama dalam data?",
          "Bagaimana temuan ini berbicara dengan literatur yang Anda kutip?",
        ],
        targetKata: 3200,
        butuhData: true,
      },
    ],
  },
  {
    id: "j5",
    labelId: "Penutup",
    labelAr: "الخاتمة",
    babAr: "الخاتمة",
    sections: [
      {
        id: "khatima",
        labelId: "Kesimpulan Artikel",
        labelAr: "الخاتمة",
        headingAr: "الخاتمة",
        panduan:
          "Temuan inti, implikasi teoretis/praktis, dan agenda riset lanjutan. Maksimal tiga paragraf.",
        pemicu: [
          "Apa satu kalimat yang harus diingat pembaca?",
          "Riset lanjutan apa yang paling logis?",
        ],
        targetKata: 400,
      },
      {
        id: "keterbatasan",
        labelId: "Keterbatasan Penelitian",
        labelAr: "حدود البحث",
        headingAr: "حدود البحث",
        panduan:
          "Nyatakan keterbatasan secara jujur dan spesifik — cakupan data, metode, generalisasi — beserta dampaknya pada kesimpulan. Jurnal bereputasi menilai kejujuran ini sebagai tanda kematangan, bukan kelemahan.",
        pemicu: ["Apa yang tidak bisa dijawab penelitian ini, dan mengapa?"],
        targetKata: 300,
      },
      {
        id: "pendanaan",
        labelId: "Ucapan Terima Kasih & Pendanaan",
        labelAr: "شكر وتقدير والتمويل",
        headingAr: "شكر وتقدير",
        panduan:
          "Sebutkan sumber pendanaan (atau nyatakan tidak ada pendanaan khusus) dan pihak yang membantu secara substansial tetapi tidak memenuhi syarat penulis.",
        pemicu: ["Siapa yang mendanai atau membantu tanpa menjadi penulis?"],
        targetKata: 80,
      },
      {
        id: "pernyataanEtik",
        labelId: "Pernyataan Konflik Kepentingan & Ketersediaan Data",
        labelAr: "الإفصاح عن تضارب المصالح",
        headingAr: "الإفصاح",
        panduan:
          "Satu-dua kalimat baku: penulis menyatakan tidak ada konflik kepentingan; data tersedia dari penulis atas permintaan yang wajar (atau sebutkan repositorinya). Banyak jurnal Scopus menolak naskah tanpa pernyataan ini.",
        pemicu: ["Apakah ada kepentingan apa pun yang bisa memengaruhi penilaian pembaca?"],
        targetKata: 60,
      },
      {
        id: "maraji",
        labelId: "Daftar Rujukan",
        labelAr: "المراجع",
        headingAr: "المراجع",
        panduan:
          "Standar jurnal bereputasi: minimal 25 referensi, minimal 70% berupa artikel jurnal, dan dominan terbit dalam 10 tahun terakhir. Referensi di luar standar ini harus punya alasan kuat (sumber primer/turats).",
        pemicu: [
          "Apakah semua rujukan di badan teks muncul di daftar ini?",
          "Apakah nama penulis, tahun, dan penerbit sudah benar?",
        ],
        targetKata: 150,
      },
    ],
  },
];


/** Bagian khas jenjang — membedakan skripsi/tesis/disertasi secara SUBSTANSI,
 * bukan sekadar pengali kata. Disisipkan ke bab bawaan oleh babJenjang(). */
const SEC_KONTRIBUSI = (target: number): SectionDef => ({
  id: "kontribusi",
  labelId: "Kontribusi Penelitian",
  labelAr: "إسهام البحث",
  headingAr: "إسهام البحث",
  panduan:
    "Nyatakan dengan tegas sumbangan penelitian ini: bagi teori (konsep/kerangka yang diperkuat atau dibangun), bagi praktik, dan bagi kajian keislaman/turats. Satu paragraf per jenis kontribusi, masing-masing ditopang temuan Bab IV — bukan janji umum.",
  pemicu: [
    "Apa yang berubah dalam pemahaman bidang ini sesudah penelitian Anda?",
    "Siapa yang terbantu secara praktik, dan bagaimana?",
  ],
  targetKata: target,
});

const SEC_SINTESIS = (target: number): SectionDef => ({
  id: "sintesisTeori",
  labelId: "Sintesis & Kritik Teori",
  labelAr: "تركيب النظرية ونقدها",
  headingAr: "تركيب النظرية ونقدها",
  panduan:
    "Jangan berhenti memaparkan teori: bandingkan antar-teori, tunjukkan ketegangan dan keterbatasannya, lalu nyatakan posisi teoritis yang Anda ambil beserta alasannya. Bagian inilah yang membedakan tesis/disertasi dari skripsi.",
  pemicu: [
    "Di mana dua teori utama topik ini saling bertentangan?",
    "Posisi mana yang Anda ambil, dan apa buktinya?",
  ],
  targetKata: target,
});

const SEC_KEBARUAN: SectionDef = {
  id: "kebaruan",
  labelId: "Kebaruan & Orisinalitas",
  labelAr: "جدة البحث وأصالته",
  headingAr: "جدة البحث وأصالته",
  panduan:
    "Bagian WAJIB disertasi: rumuskan kebaruan (novelty) secara eksplisit — apa yang belum pernah dikaji atau dijawab sebelumnya — dan buktikan dari peta penelitian terdahulu. Kebaruan yang tidak menunjuk celah literatur yang konkret akan runtuh di ruang ujian.",
  pemicu: [
    "Apa persisnya yang baru: objek, metode, sudut pandang, atau jawaban?",
    "Studi terdekat apa yang membuktikan celah itu masih kosong?",
  ],
  targetKata: 900,
};

const SEC_PETA_JALAN: SectionDef = {
  id: "petaJalan",
  labelId: "Peta Jalan & Posisi Penelitian",
  labelAr: "خارطة البحث وموقعه",
  headingAr: "خارطة البحث وموقعه",
  panduan:
    "Petakan perkembangan kajian topik ini dari masa ke masa — aliran, periode, tokoh kunci — lalu tandai persis di mana penelitian Anda berdiri dan ke mana ia menggerakkan bidang ini.",
  pemicu: [
    "Bagaimana kajian topik ini berubah dari generasi ke generasi?",
    "Di titik mana peta itu Anda masuk, dan apa yang bergeser karenanya?",
  ],
  targetKata: 800,
};

function sisipSesudah(chapters: ChapterDef[], babId: string, sesudahId: string, section: SectionDef) {
  const bab = chapters.find((c) => c.id === babId);
  if (!bab) return;
  const i = bab.sections.findIndex((x) => x.id === sesudahId);
  bab.sections.splice(i >= 0 ? i + 1 : bab.sections.length, 0, section);
}

function gantiPanduan(chapters: ChapterDef[], id: string, panduan: string) {
  for (const c of chapters) for (const x of c.sections) if (x.id === id) x.panduan = panduan;
}

function tambahPanduan(chapters: ChapterDef[], id: string, tambahan: string) {
  for (const c of chapters) for (const x of c.sections) if (x.id === id) x.panduan = `${x.panduan} ${tambahan}`;
}

/** Rakit bab per jenjang: bab bawaan yang sama di permukaan, aturan berbeda di dalamnya. */
function babJenjang(karya: Exclude<KaryaType, "jurnal">, skala: number): ChapterDef[] {
  const chapters = [bab1(skala), bab2(skala), bab3(skala), bab4(skala), bab5(skala)];
  if (karya === "tesis" || karya === "disertasi") {
    sisipSesudah(chapters, "bab1", "fawaid", SEC_KONTRIBUSI(karya === "tesis" ? 450 : 700));
    sisipSesudah(chapters, "bab2", "ithar", SEC_SINTESIS(karya === "tesis" ? 800 : 1200));
    gantiPanduan(
      chapters,
      "dirasat",
      karya === "tesis"
        ? "Standar tesis: minimal 15 studi terdahulu dibandingkan secara kritis — persamaan, perbedaan, dan kelemahannya — bukan diringkas satu per satu. Akhiri dengan posisi yang tegas: celah apa yang tersisa untuk penelitian Anda."
        : "Standar disertasi: petakan state of the art dari minimal 25 studi — termasuk literatur internasional dan sumber turats primer — secara kronologis-tematis, kritik keterbatasan tiap arus, dan tunjukkan celah yang hanya bisa diisi penelitian Anda. Bagian ini fondasi klaim kebaruan di Bab I.",
    );
  }
  if (karya === "disertasi") {
    sisipSesudah(chapters, "bab1", "hudud", SEC_KEBARUAN);
    sisipSesudah(chapters, "bab2", "dirasat", SEC_PETA_JALAN);
    tambahPanduan(chapters, "khalfiya", "Untuk disertasi, latar belakang wajib ditutup dengan pernyataan celah kebaruan yang tegas: apa yang belum terjawab oleh seluruh kajian sebelumnya.");
    tambahPanduan(chapters, "ithar", "Untuk disertasi, teori tidak cukup dipinjam: tunjukkan bagaimana penelitian ini menguji, memperluas, atau membangun teori.");
  }
  return chapters;
}

const akademik = (karya: Exclude<KaryaType, "jurnal">, skala: number): StrukturDef => ({
  karya,
  labelId:
    karya === "skripsi" ? "Skripsi" : karya === "tesis" ? "Tesis" : "Disertasi",
  labelAr:
    karya === "skripsi"
      ? "البحث الجامعي"
      : karya === "tesis"
        ? "الرسالة العلمية"
        : "الأطروحة",
  deskripsi:
    karya === "skripsi"
      ? "Lima bab, satu fenomena, satu metode. Fokus pada ketuntasan dan kejelasan."
      : karya === "tesis"
        ? "Lima bab dengan kedalaman teori dan pembahasan yang lebih luas daripada skripsi."
        : "Lima bab dengan kontribusi teoretis orisinal, uji ketat, dan kebaruan yang harus dipertahankan.",
  rentang:
    karya === "skripsi" ? "60–120 halaman" : karya === "tesis" ? "100–180 halaman" : "180–350 halaman",
  chapters: babJenjang(karya, skala),
  frontMatter: [
    "صفحة العنوان",
    "ملخص البحث",
    "كلمة الشكر والتقدير",
    "قائمة المحتويات",
    "قائمة الجداول",
    "قائمة الأشكال",
    "قائمة الملاحق",
  ],
  backMatter: ["قائمة المراجع", "الملاحق", "السيرة الذاتية للباحث"],
});

export const STRUKTUR: Record<KaryaType, StrukturDef> = {
  skripsi: akademik("skripsi", 1.7),
  tesis: akademik("tesis", 2.8),
  disertasi: akademik("disertasi", 5.2),
  jurnal: {
    karya: "jurnal",
    labelId: "Artikel Jurnal",
    labelAr: "المقال العلمي",
    deskripsi:
      "Format IMRaD versi Arab: الملخص، المقدمة، الطريقة، النتائج والمناقشة، الخاتمة، المراجع.",
    rentang: "4.000–8.000 kata",
    chapters: jurnal,
    frontMatter: ["عنوان المقال", "بيانات المؤلف", "الملخص", "الكلمات المفتاحية"],
    backMatter: ["شكر وتقدير (إن وجد)", "الإفصاح عن تضارب المصالح", "المراجع", "الملاحق"],
  },
};

export function getStruktur(karya: KaryaType): StrukturDef {
  return STRUKTUR[karya] ?? STRUKTUR.skripsi;
}

export function sectionsFor(karya: KaryaType, metode: string): SectionDef[] {
  return getStruktur(karya)
    .chapters.flatMap((c) => c.sections)
    .filter((sec) => !sec.metode || sec.metode.includes(metode as never));
}

export function findSection(karya: KaryaType, sectionId: string) {
  for (const chapter of getStruktur(karya).chapters) {
    const found = chapter.sections.find((sec) => sec.id === sectionId);
    if (found) return { chapter, section: found };
  }
  return null;
}

/* ==========================================================================
   Daftar isi dari isykaliyyat (pola Ma'had Aly DDI Mangkoso)
   Setiap bab isi mewakili SATU rumusan masalah/isykal:
   isykal 1 → bab II, isykal 2 → bab III, isykal 3 → bab IV (analisis akhir
   yang merinci jawaban/judul dari analisis bab-bab sebelumnya).
   Bab I (pendahuluan) dan bab penutup mengikuti kerangka bawaan pedoman.
   Hasil susunan menjadi daftar isi MILIK proyek dan bebas diedit mahasiswa.
   ========================================================================== */

import type { BabKustom, Project, SubBabKustom } from "@/lib/engine/project";

const ORDINAL_AR = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Sub-bab bab pengurai isykal (semua bab isykal kecuali yang terakhir). */
const SEKSI_EKSPLORASI: Array<{ akhiran: string; labelId: string; labelAr: string }> = [
  { akhiran: "taswir", labelId: "Gambaran Masalah", labelAr: "تصوير المسألة" },
  { akhiran: "aqwal", labelId: "Pendapat Ulama", labelAr: "أقوال العلماء في المسألة" },
  { akhiran: "adilla", labelId: "Dalil-dalil Pendapat", labelAr: "أدلة الأقوال" },
  { akhiran: "munaqasha", labelId: "Pembahasan Dalil", labelAr: "مناقشة الأدلة" },
];

/** Sub-bab bab analisis akhir (bab isykal terakhir): merinci jawaban akhir. */
const SEKSI_ANALISIS: Array<{ akhiran: string; labelId: string; labelAr: string }> = [
  { akhiran: "talkhis", labelId: "Ringkasan Bab Sebelumnya", labelAr: "تلخيص ما تقدم" },
  { akhiran: "muwazana", labelId: "Analisis & Penimbangan", labelAr: "التحليل والموازنة بين الأدلة" },
  { akhiran: "tarjih", labelId: "Penetapan Jawaban Akhir", labelAr: "الترجيح والجواب النهائي" },
  { akhiran: "atsar", labelId: "Penerapan & Dampaknya", labelAr: "تطبيق الجواب وآثاره" },
];

function potongTeks(s: string, maks: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > maks ? `${t.slice(0, maks - 1)}…` : t;
}

/**
 * Susun daftar isi dari rumusan masalah proyek (pola Ma'had).
 * Mengembalikan null bila jenis karya bukan akademik 5-bab atau rumusan kosong.
 */
export function susunDaftarIsiIsykal(p: Project): BabKustom[] | null {
  if (p.jenis === "jurnal") return null;
  const rumusan = (p.rumusan ?? []).map((r) => r.trim()).filter(Boolean);
  if (rumusan.length === 0) return null;
  const tpl = getStruktur(p.jenis);
  const keKustom = (c: ChapterDef): BabKustom => ({
    id: c.id,
    labelId: c.labelId,
    labelAr: c.labelAr,
    babAr: c.babAr,
    sections: c.sections.map((s) => ({ id: s.id, labelId: s.labelId, labelAr: s.labelAr })),
  });

  const hasil: BabKustom[] = [];
  const babAwal = tpl.chapters[0];
  if (babAwal) hasil.push(keKustom(babAwal));

  rumusan.forEach((r, i) => {
    const n = i + 1;
    const nomorBab = i + 2; // bab II, III, IV, …
    const terakhir = i === rumusan.length - 1;
    const pola = terakhir && rumusan.length > 1 ? SEKSI_ANALISIS : SEKSI_EKSPLORASI;
    const babAr = `الباب ${ORDINAL_AR[nomorBab - 1] ?? nomorBab}`;
    hasil.push({
      id: `bab-isykal-${n}`,
      labelId: `BAB ${ROMAWI[nomorBab - 1] ?? nomorBab} — Isykal ${n}${terakhir && rumusan.length > 1 ? " (Analisis Akhir)" : ""}`,
      labelAr: `${babAr}: ${potongTeks(r, 90)}`,
      babAr,
      isykalKe: n,
      sections: pola.map((s) => ({
        id: `isykal${n}-${s.akhiran}`,
        labelId: s.labelId,
        labelAr: s.labelAr,
      })),
    });
  });

  const babAkhir = tpl.chapters[tpl.chapters.length - 1];
  if (babAkhir && tpl.chapters.length > 1) {
    const penutup = keKustom(babAkhir);
    // Nomor ulang bab penutup mengikuti jumlah bab isi yang baru.
    const nomorBab = rumusan.length + 2;
    penutup.babAr = `الباب ${ORDINAL_AR[nomorBab - 1] ?? nomorBab}`;
    penutup.labelId = `BAB ${ROMAWI[nomorBab - 1] ?? nomorBab} — Penutup`;
    penutup.labelAr = `${penutup.babAr}: الخاتمة`;
    hasil.push(penutup);
  }
  return hasil;
}

/**
 * Struktur efektif proyek: daftar isi kustom bila ada, bawaan jenis karya bila tidak.
 * Sub-bab yang id-nya dikenal dari templat mewarisi panduan/pemicu/target templat;
 * sub-bab baru mendapat panduan umum bab isykal. Fasal/matlab (anak sub-bab)
 * diratakan tepat di bawah induknya dengan tingkat 2.
 */
export function strukturProyek(p: Project): StrukturDef {
  const tpl = getStruktur(p.jenis);
  if (!p.daftarIsi || p.daftarIsi.length === 0) return tpl;
  const dikenal = new Map<string, SectionDef>();
  for (const c of tpl.chapters) for (const s of c.sections) dikenal.set(s.id, s);

  const keSectionDef = (s: SubBabKustom, tingkat: number): SectionDef => {
    const dasar = dikenal.get(s.id);
    if (dasar) return { ...dasar, labelId: s.labelId, labelAr: s.labelAr, headingAr: s.labelAr || dasar.headingAr, tingkat };
    const analisis = /-(talkhis|muwazana|tarjih|atsar)$/.test(s.id);
    return {
      id: s.id,
      labelId: s.labelId,
      labelAr: s.labelAr,
      headingAr: s.labelAr,
      panduan: analisis
        ? "Bab analisis akhir: kumpulkan hasil bab-bab sebelumnya, timbang dalil dan pendapatnya, lalu tetapkan jawaban/judul akhir secara terperinci beserta penerapannya."
        : tingkat === 2
          ? "Fasal/matlab di bawah sub-bab induknya: uraikan satu aspek khusus sub-bab itu dari kitab dan sumber primer, dengan kalimat kunci yang bisa diverifikasi."
          : "Uraikan bagian isykal ini dari kitab dan sumber primer: gambarkan masalahnya, tampilkan pendapat ulama beserta dalilnya, lalu bahas dengan kalimat kunci yang bisa diverifikasi.",
      pemicu: [],
      targetKata: analisis ? 650 : tingkat === 2 ? 350 : 500,
      tingkat,
    };
  };

  const chapters: ChapterDef[] = p.daftarIsi.map((b) => ({
    id: b.id,
    labelId: b.labelId,
    labelAr: b.labelAr,
    babAr: b.babAr,
    sections: b.sections.flatMap((s) => [
      keSectionDef(s, 1),
      ...(s.anak ?? []).map((a) => keSectionDef(a, 2)),
    ]),
  }));
  return { ...tpl, chapters };
}

/**
 * Salin struktur bawaan jenis karya menjadi daftar isi milik proyek —
 * agar judul bab/sub-bab bisa diganti dan isi bisa ditambah/kurangi
 * walaupun proyek tidak memakai pola isykaliyyat.
 */
export function susunDaftarIsiBawaan(p: Project): BabKustom[] {
  return getStruktur(p.jenis).chapters.map((c) => ({
    id: c.id,
    labelId: c.labelId,
    labelAr: c.labelAr,
    babAr: c.babAr,
    sections: c.sections.map((s) => ({ id: s.id, labelId: s.labelId, labelAr: s.labelAr })),
  }));
}

/** Cari section dalam struktur EFEKTIF proyek (termasuk daftar isi kustom). */
export function findSectionProyek(p: Project, sectionId: string) {
  for (const chapter of strukturProyek(p).chapters) {
    const found = chapter.sections.find((sec) => sec.id === sectionId);
    if (found) return { chapter, section: found };
  }
  return null;
}
