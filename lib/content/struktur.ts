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
          "Pola funnel: konteks → penelitian sebelumnya → celah → tujuan & kebaruan artikel. Tanpa sub-judul.",
        pemicu: [
          "Mengapa artikel ini perlu dibaca sekarang?",
          "Apa celah yang diisi artikel ini dibanding studi terdahulu?",
        ],
        targetKata: 900,
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
        targetKata: 1400,
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
        targetKata: 350,
      },
      {
        id: "maraji",
        labelId: "Daftar Rujukan",
        labelAr: "المراجع",
        headingAr: "المراجع",
        panduan:
          "Rujukan yang benar-benar disitasi, format konsisten, judul kitab/artikel tidak diterjemahkan. Periksa setiap entri pada sumber aslinya.",
        pemicu: [
          "Apakah semua rujukan di badan teks muncul di daftar ini?",
          "Apakah nama penulis, tahun, dan penerbit sudah benar?",
        ],
        targetKata: 120,
      },
    ],
  },
];

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
  chapters: [bab1(skala), bab2(skala), bab3(skala), bab4(skala), bab5(skala)],
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
  skripsi: akademik("skripsi", 1),
  tesis: akademik("tesis", 1.45),
  disertasi: akademik("disertasi", 1.95),
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
