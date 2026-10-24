import type { SidangItem } from "./types";

/**
 * Bank pertanyaan sidang/مناقشة untuk karya ilmiah berbahasa Arab.
 *
 * - `pertanyaanId` meniru ucapan penguji dalam sidang berbahasa Indonesia.
 * - `pertanyaanAr` adalah versi Arab formal (fusha) tanpa harakat kecuali yang
 *   diperlukan untuk membedakan bacaan.
 * - `tipsId` menunjuk bukti konkret yang bisa ditunjukkan mahasiswa di naskah.
 * - `metode` hanya penanda saringan; entri tanpa `metode` berlaku untuk semua.
 */
export const SIDANG: SidangItem[] = [
  // ── metode ─────────────────────────────────────────────────────────────
  {
    id: "sidang-01",
    kategori: "metode",
    pertanyaanId:
      "Mengapa Anda memilih purposive sampling, bukan random sampling, padahal jumlah populasi Anda cukup besar?",
    pertanyaanAr:
      "لماذا اخترت العينة القصدية بدلا من العينة العشوائية مع أن مجتمع البحث كبير؟",
    tipsId:
      "Tunjukkan kriteria inklusi pada subbab populasi dan sampel, lalu jelaskan bahwa tidak semua anggota populasi memenuhi syarat substantif penelitian Anda.",
    metode: ["kuantitatif", "mixed"],
  },
  {
    id: "sidang-02",
    kategori: "metode",
    pertanyaanId:
      "Bagaimana Anda menguji validitas instrumen sebelum angket disebar ke responden?",
    pertanyaanAr: "كيف تحققت من صدق الأداة قبل توزيع الاستبانة على المستجيبين؟",
    tipsId:
      "Sebut hasil validitas isi dari dua dosen penelaah dan tunjukkan nilai korelasi butir-total pada tabel uji coba instrumen.",
    metode: ["kuantitatif"],
  },
  {
    id: "sidang-03",
    kategori: "metode",
    pertanyaanId:
      "Berapa nilai Cronbach alpha tiap dimensi, dan apa arti angka itu bagi Anda?",
    pertanyaanAr:
      "ما قيمة معامل ألفا كرونباخ في كل بُعد، وما دلالة هذه القيمة عندك؟",
    tipsId:
      "Bawa tabel reliabilitas per dimensi dan sebutkan ambang 0,70 yang Anda pakai beserta rujukannya di bab tiga.",
    metode: ["kuantitatif"],
  },
  {
    id: "sidang-04",
    kategori: "metode",
    pertanyaanId:
      "Mengapa memakai Miles dan Huberman, bukan analisis tematik Braun dan Clarke?",
    pertanyaanAr:
      "لماذا استخدمت تحليل مايلز وهوبرمان بدلا من التحليل الموضوعي عند براون وكلارك؟",
    tipsId:
      "Bandingkan tahap reduksi data, penyajian data, dan penarikan simpulan yang Anda pakai dengan enam fase Braun dan Clarke, lalu tunjukkan matriks kode Anda.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-05",
    kategori: "metode",
    pertanyaanId:
      "Uji asumsi klasik apa saja yang Anda jalankan, dan bagaimana hasilnya?",
    pertanyaanAr:
      "ما اختبارات الافتراضات الكلاسيكية التي أجريتها، وما نتائجها؟",
    tipsId:
      "Siapkan tabel normalitas, multikolinearitas, dan heteroskedastisitas beserta nilai VIF serta tingkat signifikansinya.",
    metode: ["kuantitatif"],
  },
  {
    id: "sidang-06",
    kategori: "metode",
    pertanyaanId:
      "Berapa jumlah informan Anda, dan atas dasar apa Anda menyatakan data sudah jenuh?",
    pertanyaanAr:
      "كم عدد المخبرين، وعلى أي أساس حكمت بأن البيانات قد بلغت حد التشبع؟",
    tipsId:
      "Tunjukkan catatan lapangan yang memperlihatkan informasi berulang sejak informan kedelapan sampai kesebelas.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-07",
    kategori: "metode",
    pertanyaanId:
      "Bagaimana Anda menerapkan triangulasi sumber dan triangulasi teknik di lapangan?",
    pertanyaanAr:
      "كيف طبقت التثليث في المصادر والتثليث في الأساليب أثناء العمل الميداني؟",
    tipsId:
      "Sebut pasangan data yang Anda silangkan, misalnya hasil wawancara guru dengan dokumen kurikulum dan catatan observasi kelas.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-08",
    kategori: "metode",
    pertanyaanId:
      "Desain mixed methods Anda yang mana: explanatory sequential atau convergent parallel?",
    pertanyaanAr:
      "ما تصميم البحث المختلط الذي اعتمدته: التتابعي التفسيري أم المتقارب المتوازي؟",
    tipsId:
      "Gambarkan diagram desain di bab tiga dan jelaskan urutan serta bobot tiap tahap kuantitatif dan kualitatif.",
    metode: ["mixed"],
  },
  {
    id: "sidang-09",
    kategori: "metode",
    pertanyaanId:
      "Dengan 60 responden, apakah sampel Anda cukup untuk regresi berganda?",
    pertanyaanAr:
      "بعينة من ستين مستجيبا، هل تكفي لتحليل الانحدار المتعدد؟",
    tipsId:
      "Hitung rasio jumlah responden terhadap jumlah prediktor dan sebut aturan sepuluh sampai lima belas kasus per variabel bebas.",
    metode: ["kuantitatif"],
  },
  {
    id: "sidang-10",
    kategori: "metode",
    pertanyaanId: "Bagaimana Anda memperlakukan kuesioner yang tidak terisi lengkap?",
    pertanyaanAr: "كيف تعاملت مع الاستبانات غير المكتملة؟",
    tipsId:
      "Jelaskan jumlah kuesioner yang gugur, kriteria penggugurannya, dan apakah Anda memakai penghapusan daftar atau imputasi.",
    metode: ["kuantitatif", "mixed"],
  },
  {
    id: "sidang-11",
    kategori: "metode",
    pertanyaanId:
      "Apakah wawancara direkam, dan siapa yang mentranskrip serta memeriksa ketelitian transkrip?",
    pertanyaanAr:
      "هل سجلت المقابلات، ومن فرّغها نصًّا وراجع دقتها؟",
    tipsId:
      "Tunjukkan berkas transkrip bertanda waktu dan bukti pemeriksaan ulang oleh informan (member checking) yang ditandatangani.",
    metode: ["kualitatif"],
  },

  // ── teori ──────────────────────────────────────────────────────────────
  {
    id: "sidang-12",
    kategori: "teori",
    pertanyaanId:
      "Mengapa memakai kerangka maqashid asy-Syathibi, bukan maqashid Ibnu Asyur?",
    pertanyaanAr: "لماذا اعتمدت مقاصد الشاطبي دون مقاصد ابن عاشور؟",
    tipsId:
      "Tunjukkan subbab kerangka teori dan jelaskan bahwa objek Anda teks klasik sehingga kategorisasi Syathibi lebih dekat dengan bahan yang dikaji.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-13",
    kategori: "teori",
    pertanyaanId:
      "Apa definisi operasional variabel Anda, dan mengapa memilih definisi itu?",
    pertanyaanAr:
      "ما التعريف الإجرائي لمتغير البحث، ولماذا اخترت هذا التعريف؟",
    tipsId:
      "Kutip definisi operasional di bab tiga dan tunjukkan butir angket yang lahir dari setiap indikator.",
    metode: ["kuantitatif", "mixed"],
  },
  {
    id: "sidang-14",
    kategori: "teori",
    pertanyaanId:
      "Apakah teori Anda benar-benar menjelaskan temuan, atau hanya dipakai untuk menamai fenomena?",
    pertanyaanAr:
      "هل يفسر إطارك النظري النتائج فعلًا، أم أنه مجرد تسمية للظاهرة؟",
    tipsId:
      "Ambil satu temuan dan tunjukkan mekanisme kausal atau interpretatif yang hanya dapat dijelaskan oleh teori tersebut.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-15",
    kategori: "teori",
    pertanyaanId: "Kalau teori itu dihapus, apa yang hilang dari analisis Anda?",
    pertanyaanAr: "لو حذفنا هذا الإطار النظري، فما الذي يفقده تحليلك؟",
    tipsId:
      "Tunjukkan paragraf pembahasan yang bergantung pada konsep teori dan bukan sekadar deskripsi data lapangan.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-16",
    kategori: "teori",
    pertanyaanId:
      "Siapa pencetus teori yang Anda pakai, dan pada karya mana Anda bersandar?",
    pertanyaanAr: "من صاحب النظرية التي اعتمدتها، وعلى أي مؤلف اعتمدت؟",
    tipsId:
      "Sebut karya asli beserta tahun terbitnya, dan hindari bersandar hanya pada buku ajar atau artikel pengantar.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-17",
    kategori: "teori",
    pertanyaanId: "Mengapa memakai teori resepsi Al-Qur'an, bukan tafsir tematik?",
    pertanyaanAr:
      "لماذا استخدمت نظرية تلقي القرآن بدلا من التفسير الموضوعي؟",
    tipsId:
      "Jelaskan bahwa pertanyaan penelitian Anda menyangkut pembaca dan praktik sosial, bukan makna teks, lalu tunjukkan datanya di bab empat.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-18",
    kategori: "teori",
    pertanyaanId:
      "Anda memakai tiga teori sekaligus. Bagaimana Anda menghindari eklektisisme?",
    pertanyaanAr:
      "استخدمت ثلاث نظريات في وقت واحد، فكيف تجنبت الانتقائية؟",
    tipsId:
      "Tunjukkan hierarki teori pada bagan kerangka berpikir: satu teori payung dan dua konsep pendukung dengan batas peran masing-masing.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-19",
    kategori: "teori",
    pertanyaanId:
      "Apakah teori itu cocok dengan konteks Indonesia, atau hanya dipinjam dari kajian Timur Tengah?",
    pertanyaanAr:
      "هل تلائم هذه النظرية السياق الإندونيسي، أم أنها مستعارة من دراسات الشرق الأوسط؟",
    tipsId:
      "Tunjukkan bagian yang Anda modifikasi beserta alasan empiris dari lokasi penelitian, bukan sekadar penyesuaian istilah.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-20",
    kategori: "teori",
    pertanyaanId:
      "Apa beda kerangka teori dengan kerangka konseptual di bab dua Anda?",
    pertanyaanAr:
      "ما الفرق بين الإطار النظري والإطار المفاهيمي في الفصل الثاني؟",
    tipsId:
      "Tunjukkan bagan kerangka konseptual dan jelaskan bahwa ia merupakan turunan operasional dari teori, bukan ringkasan ulang.",
    metode: ["mixed", "kuantitatif"],
  },
  {
    id: "sidang-21",
    kategori: "teori",
    pertanyaanId:
      "Apakah Anda menguji teori atau memakainya sebagai lensa? Mana yang Anda klaim?",
    pertanyaanAr:
      "هل اختبرت النظرية أم استخدمتها كعدسة تحليل، وأي الأمرين تعلنه؟",
    tipsId:
      "Selaraskan klaim itu dengan rumusan tujuan dan hipotesis di bab satu agar tidak muncul klaim yang berlebihan.",
    metode: ["kuantitatif", "kualitatif"],
  },
  {
    id: "sidang-22",
    kategori: "teori",
    pertanyaanId:
      "Apakah ada teori lain yang bisa menjelaskan temuan Anda lebih baik? Mengapa Anda menolaknya?",
    pertanyaanAr:
      "هل توجد نظرية أخرى قد تفسر نتائجك على نحو أفضل، ولماذا رفضتها؟",
    tipsId:
      "Sebut satu teori alternatif, tunjukkan bukti empiris yang tidak cocok dengannya, dan akui batas daya penjelasannya.",
    metode: ["kualitatif", "kuantitatif"],
  },

  // ── sumber ─────────────────────────────────────────────────────────────
  {
    id: "sidang-23",
    kategori: "sumber",
    pertanyaanId:
      "Kitab edisi mana yang Anda pakai, tahqiq siapa, dan mengapa bukan edisi lain?",
    pertanyaanAr:
      "أي طبعة اعتمدت، وبتحقيق مَن، ولماذا تركت الطبعات الأخرى؟",
    tipsId:
      "Cantumkan data edisi lengkap di daftar pustaka dan jelaskan alasan memilih edisi itu, misalnya kelengkapan catatan kaki dan indeksnya.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-24",
    kategori: "sumber",
    pertanyaanId:
      "Apakah Anda membaca sumber primer, atau hanya mengutip dari kajian sekunder?",
    pertanyaanAr:
      "هل قرأت المصادر الأولية، أم اكتفيت بالنقل عن دراسات ثانوية؟",
    tipsId:
      "Tunjukkan halaman sumber primer yang Anda kutip langsung dan bandingkan dengan cara rujukan sekunder menyebutnya.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-25",
    kategori: "sumber",
    pertanyaanId:
      "Bagaimana Anda melakukan takhrij hadis yang Anda kutip, dan apa statusnya?",
    pertanyaanAr: "كيف خرجت الأحاديث التي استشهدت بها، وما درجتها؟",
    tipsId:
      "Bawa tabel takhrij berisi mukharrij, nomor hadis, dan penilaian ulama hadis yang Anda pakai sebagai sandaran.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-26",
    kategori: "sumber",
    pertanyaanId:
      "Berapa rujukan berbahasa Arab Anda, dan berapa yang terbit dalam sepuluh tahun terakhir?",
    pertanyaanAr:
      "كم عدد مراجعك العربية، وكم منها صدر في السنوات العشر الأخيرة؟",
    tipsId:
      "Hitung langsung dari daftar pustaka dan tunjukkan bahwa literatur mutakhir tetap Anda pakai bersama sumber klasik.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-27",
    kategori: "sumber",
    pertanyaanId:
      "Mengapa Anda bersandar pada kitab abad ke-19 untuk membahas fenomena tahun 2024?",
    pertanyaanAr:
      "لماذا استندت إلى كتاب من القرن التاسع عشر لبحث ظاهرة حديثة؟",
    tipsId:
      "Jelaskan fungsi kitab itu sebagai kerangka konsep, lalu tunjukkan data lapangan atau literatur baru yang menjembatani konteks.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-28",
    kategori: "sumber",
    pertanyaanId:
      "Naskah yang Anda pakai sudah ditahqiq? Bagaimana Anda menilai kualitas edisinya?",
    pertanyaanAr:
      "هل المخطوط الذي اعتمدته محقق، وكيف قومت جودة تحقيقه؟",
    tipsId:
      "Sebut perbandingan dua edisi dan tunjukkan satu bagian yang berbeda bacaan agar terlihat Anda memeriksa sendiri.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-29",
    kategori: "sumber",
    pertanyaanId:
      "Anda mengutip beberapa situs dan blog. Bagaimana Anda menilai kredibilitasnya?",
    pertanyaanAr: "استشهدت بمواقع ومدونات، فكيف قومت مصداقيتها؟",
    tipsId:
      "Tunjukkan kriteria yang Anda pakai: penulis bernama, lembaga penerbit, dan rujukan yang tercantum di dalamnya.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-30",
    kategori: "sumber",
    pertanyaanId:
      "Apakah Anda menafsirkan ayat sendiri, atau bersandar pada tafsir tertentu?",
    pertanyaanAr: "هل فسرت الآيات بنفسك، أم اعتمدت على تفسير معين؟",
    tipsId:
      "Sebut tafsir yang Anda pakai dan tunjukkan bahwa penafsiran Anda tidak melampaui batas yang telah dibahas mufasir.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-31",
    kategori: "sumber",
    pertanyaanId:
      "Ada kutipan yang Anda ambil dari kutipan orang lain. Mengapa tidak langsung ke sumber aslinya?",
    pertanyaanAr:
      "هناك اقتباسات نقلتها عن ناقل آخر، فلماذا لم ترجع إلى المصدر الأصلي؟",
    tipsId:
      "Tandai kutipan tidak langsung dengan frasa yang jelas dan usahakan melacak sumber aslinya sebelum sidang.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-32",
    kategori: "sumber",
    pertanyaanId:
      "Anda memakai al-Maktaba asy-Syamila. Bagaimana Anda memastikan teksnya sesuai cetakan?",
    pertanyaanAr:
      "استخدمت المكتبة الشاملة، فكيف تأكدت من مطابقة النص للطبعة المطبوعة؟",
    tipsId:
      "Bandingkan satu halaman dengan citra cetakan PDF dan cantumkan nomor jilid serta halaman cetak, bukan penomoran aplikasi.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-33",
    kategori: "sumber",
    pertanyaanId:
      "Apakah Anda membaca semua sumber Arab itu sendiri, atau ada yang diterjemahkan orang lain?",
    pertanyaanAr:
      "هل قرأت تلك المصادر العربية بنفسك، أم بعضها منقول عن ترجمة؟",
    tipsId:
      "Sebutkan sumber yang Anda baca langsung dan buktikan dengan menjelaskan satu istilah kunci pada teks itu.",
    metode: ["kualitatif"],
  },

  // ── etika ──────────────────────────────────────────────────────────────
  {
    id: "sidang-34",
    kategori: "etika",
    pertanyaanId:
      "Apakah semua informan menandatangani persetujuan, dan di mana buktinya?",
    pertanyaanAr:
      "هل وقع جميع المخبرين على الموافقة، وأين تحفظ وثائقها؟",
    tipsId:
      "Tunjukkan formulir persetujuan dan jelaskan cara penyimpanan berkas agar identitas informan tetap terlindungi.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-35",
    kategori: "etika",
    pertanyaanId:
      "Bagaimana Anda menjaga kerahasiaan identitas informan, terutama pejabat pesantren?",
    pertanyaanAr:
      "كيف حافظت على سرية هوية المخبرين، ولا سيما مسؤولي المعهد؟",
    tipsId:
      "Jelaskan pemakaian inisial atau kode pada transkrip dan sebutkan siapa saja yang memiliki akses ke data mentah.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-36",
    kategori: "etika",
    pertanyaanId:
      "Apakah Anda meminta izin tertulis kepada lembaga sebelum penelitian?",
    pertanyaanAr: "هل حصلت على إذن مكتوب من المؤسسة قبل بدء البحث؟",
    tipsId:
      "Bawa surat izin penelitian dan tunjukkan nomor serta tanggal penerbitannya pada bagian lampiran.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-37",
    kategori: "etika",
    pertanyaanId: "Bagaimana Anda memastikan bab dua bebas plagiarisme?",
    pertanyaanAr: "كيف ضمنت خلو الفصل الثاني من السرقة العلمية؟",
    tipsId:
      "Tunjukkan laporan kemiripan dan jelaskan bagian yang Anda parafrasekan beserta sumber aslinya.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-38",
    kategori: "etika",
    pertanyaanId:
      "Apakah Anda memakai kecerdasan buatan dalam menyusun naskah? Bagian mana?",
    pertanyaanAr:
      "هل استعنت بالذكاء الاصطناعي في إعداد البحث، وفي أي جزء؟",
    tipsId:
      "Nyatakan penggunaannya secara jujur, batasi pada penyuntingan bahasa, dan tunjukkan bahwa analisis serta simpulan tetap milik Anda.",
    metode: ["kuantitatif", "kualitatif"],
  },
  {
    id: "sidang-39",
    kategori: "etika",
    pertanyaanId: "Pernahkah Anda mengubah atau membuang data yang tidak sesuai harapan?",
    pertanyaanAr: "هل سبق أن عدلت بيانات أو حذفتها لأنها لم توافق توقعك؟",
    tipsId:
      "Jawab dengan menunjukkan catatan keputusan analisis dan alasan metodologis bila memang ada data yang dikeluarkan.",
    metode: ["kuantitatif", "mixed"],
  },
  {
    id: "sidang-40",
    kategori: "etika",
    pertanyaanId:
      "Bagaimana Anda memperlakukan informan yang menarik diri di tengah penelitian?",
    pertanyaanAr: "كيف تعاملت مع المخبر الذي انسحب في منتصف البحث؟",
    tipsId:
      "Tegaskan bahwa data informan itu tidak dianalisis dan tunjukkan pasal hak menarik diri pada lembar persetujuan.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-41",
    kategori: "etika",
    pertanyaanId:
      "Apakah responden Anda diberi imbalan? Bagaimana Anda menghindari unsur paksaan?",
    pertanyaanAr:
      "هل منحت المستجيبين مقابلا، وكيف تجنبت إرغامهم على المشاركة؟",
    tipsId:
      "Tegaskan bahwa partisipasi bersifat sukarela dan tunjukkan kalimat yang menyatakan hal itu pada lembar persetujuan.",
    metode: ["kuantitatif", "mixed"],
  },
  {
    id: "sidang-42",
    kategori: "etika",
    pertanyaanId:
      "Ada tiga karya Anda sendiri di daftar pustaka. Apakah itu memang perlu?",
    pertanyaanAr:
      "أدرجت ثلاثة من مؤلفاتك في قائمة المراجع، فهل كان ذلك ضروريًّا؟",
    tipsId:
      "Tunjukkan keterkaitan substantif karya tersebut dengan variabel penelitian dan pastikan porsinya tidak mendominasi rujukan.",
    metode: ["kuantitatif", "kualitatif"],
  },
  {
    id: "sidang-43",
    kategori: "etika",
    pertanyaanId: "Siapa pemilik data mentah Anda, dan berapa lama akan disimpan?",
    pertanyaanAr: "مَن يملك بياناتك الخام، وإلى متى ستحفظ؟",
    tipsId:
      "Sebut lokasi penyimpanan, jangka waktu penyimpanan, dan mekanisme pemusnahan data setelah penelitian selesai.",
    metode: ["kuantitatif", "kualitatif"],
  },
  {
    id: "sidang-44",
    kategori: "etika",
    pertanyaanId:
      "Bagaimana Anda memastikan kutipan Arab Anda tidak salah nukil atau bahkan tidak ada?",
    pertanyaanAr:
      "كيف تأكدت من أن الاقتباسات العربية منقولة بدقة ولم تختلق؟",
    tipsId:
      "Tunjukkan salinan halaman sumber asli untuk setiap kutipan Arab dan periksa kesesuaian harakat serta tanda bacanya.",
    metode: ["kualitatif"],
  },

  // ── kebaruan ───────────────────────────────────────────────────────────
  {
    id: "sidang-45",
    kategori: "kebaruan",
    pertanyaanId:
      "Apa kebaruan penelitian Anda dibanding lima artikel terakhir di jurnal yang sama?",
    pertanyaanAr:
      "ما الجديد في بحثك مقارنة بآخر خمس مقالات في المجلة نفسها؟",
    tipsId:
      "Siapkan tabel penelitian terdahulu yang memuat kolom temuan dan kolom celah yang Anda isi.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-46",
    kategori: "kebaruan",
    pertanyaanId:
      "Judul Anda sangat mirip dengan tesis yang terbit tahun 2019 di kampus ini. Apa bedanya?",
    pertanyaanAr:
      "عنوانك قريب جدا من رسالة نوقشت عام 2019 في هذه الجامعة، فما الفرق؟",
    tipsId:
      "Tunjukkan perbedaan pada objek, periode, atau unit analisis, dan sebutkan tesis itu di kajian terdahulu.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-47",
    kategori: "kebaruan",
    pertanyaanId:
      "Apa kontribusi Anda pada khazanah ilmu, bukan hanya pada lembaga yang Anda teliti?",
    pertanyaanAr:
      "ما إسهامك في المعرفة العلمية، لا في المؤسسة التي درستها فحسب؟",
    tipsId:
      "Rumuskan satu kontribusi teoretis atau konseptual dan letakkan pada simpulan, bukan hanya pada rekomendasi praktis.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-48",
    kategori: "kebaruan",
    pertanyaanId:
      "Kalau yang berubah hanya lokasi penelitian, di mana letak kebaruannya?",
    pertanyaanAr: "إذا كان التغيير في موقع البحث وحده، فأين تكمن الجدّة؟",
    tipsId:
      "Tunjukkan kekhasan lokal yang mengubah hasil, misalnya praktik yang tidak ditemukan pada penelitian sebelumnya.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-49",
    kategori: "kebaruan",
    pertanyaanId:
      "Kebaruan Anda teoretis, metodologis, atau empiris? Sebutkan satu saja.",
    pertanyaanAr:
      "أي نوع من الجدّة تدعي في بحثك: النظري أم المنهجي أم التجريبي، ولماذا؟",
    tipsId:
      "Pilih satu jenis kebaruan dan hubungkan dengan bukti spesifik di bab empat atau bab tiga.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-50",
    kategori: "kebaruan",
    pertanyaanId:
      "Temuan Anda mendukung atau menolak penelitian sebelumnya? Tunjukkan buktinya.",
    pertanyaanAr:
      "هل تؤيد نتائجك الدراسات السابقة أم تنقضها؟ وأين الدليل؟",
    tipsId:
      "Bandingkan nilai atau kategori temuan Anda dengan dua penelitian terdahulu secara eksplisit di bagian pembahasan.",
    metode: ["kuantitatif", "mixed"],
  },
  {
    id: "sidang-51",
    kategori: "kebaruan",
    pertanyaanId:
      "Apakah ada temuan yang bertentangan dengan asumsi umum? Mengapa itu penting?",
    pertanyaanAr:
      "هل ظهرت نتيجة تخالف الافتراض الشائع، ولماذا هي مهمة؟",
    tipsId:
      "Sebut satu temuan kontraintuitif dan jelaskan kemungkinan penjelasannya beserta batas data Anda.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-52",
    kategori: "kebaruan",
    pertanyaanId: "Apa yang bisa dilakukan praktisi dengan hasil Anda besok pagi?",
    pertanyaanAr: "ما الذي يستطيع الممارس أن يفعله بنتائجك غدا؟",
    tipsId:
      "Turunkan satu rekomendasi operasional yang benar-benar bersandar pada temuan, bukan saran umum.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-53",
    kategori: "kebaruan",
    pertanyaanId:
      "Bagaimana Anda memastikan topik ini belum pernah diteliti? Basis data apa yang Anda pakai?",
    pertanyaanAr:
      "كيف تأكدت من أن الموضوع لم يبحث من قبل؟ وما قواعد البيانات التي استخدمتها؟",
    tipsId:
      "Sebut kata kunci, basis data, dan rentang tahun pencarian yang Anda dokumentasikan.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-54",
    kategori: "kebaruan",
    pertanyaanId:
      "Apa batas penelitian Anda, dan persoalan apa yang sengaja tidak Anda jawab?",
    pertanyaanAr: "ما حدود بحثك، وما المسائل التي تعمدت عدم الإجابة عنها؟",
    tipsId:
      "Tulis subbab keterbatasan yang jujur dan hubungkan dengan saran penelitian lanjutan.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-55",
    kategori: "kebaruan",
    pertanyaanId:
      "Kalau peneliti lain mengulang penelitian Anda di tempat lain, apa yang paling mungkin berbeda?",
    pertanyaanAr:
      "لو أعاد باحث آخر بحثك في مكان آخر، فما الذي يرجح اختلافه؟",
    tipsId:
      "Tunjukkan variabel kontekstual yang Anda anggap khas dan jelaskan implikasinya bagi generalisasi.",
    metode: ["kuantitatif", "kualitatif"],
  },

  // ── penulisan ──────────────────────────────────────────────────────────
  {
    id: "sidang-56",
    kategori: "penulisan",
    pertanyaanId:
      "Transliterasi Anda tidak konsisten: di halaman 12 tertulis Shalat, di halaman 30 Salat. Mana yang Anda pakai?",
    pertanyaanAr:
      "كتابة الكلمات العربية بالحروف اللاتينية عندك مضطربة: وردت «Shalat» في الصفحة 12 و«Salat» في الصفحة 30، فأيهما تعتمد؟",
    tipsId:
      "Pilih satu pedoman transliterasi kampus lalu perbaiki seluruh naskah, bukan hanya halaman yang ditunjuk penguji.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-57",
    kategori: "penulisan",
    pertanyaanId:
      "Kutipan Arab Anda tidak berharakat, padahal pedoman kampus mewajibkannya. Mengapa?",
    pertanyaanAr:
      "اقتباساتك العربية خالية من التشكيل مع أن دليل الجامعة يوجبه، فلماذا؟",
    tipsId:
      "Tunjukkan pedoman penulisan yang Anda ikuti dan siapkan versi berharakat untuk kutipan yang rawan salah baca.",
    metode: ["kualitatif"],
  },
  {
    id: "sidang-58",
    kategori: "penulisan",
    pertanyaanId:
      "Ada kesalahan i'rab pada kutipan di halaman 45. Bisakah Anda membacakannya dengan benar?",
    pertanyaanAr:
      "ثمة خطأ إعرابي في الاقتباس الوارد في الصفحة 45، فهل تقرؤه قراءة صحيحة؟",
    tipsId:
      "Baca ulang kutipan dengan tenang, sebutkan kedudukan kata yang salah, dan bawa catatan perbaikannya.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-59",
    kategori: "penulisan",
    pertanyaanId:
      "Gaya sitasi Anda bercampur antara APA dan Chicago. Mana yang sebenarnya Anda pakai?",
    pertanyaanAr:
      "أسلوب التوثيق عندك مختلط بين APA وشيكاغو، فأيهما تعتمد فعلًا؟",
    tipsId:
      "Seragamkan seluruh sitasi dan daftar pustaka pada satu gaya, lalu tunjukkan contoh perbaikannya.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-60",
    kategori: "penulisan",
    pertanyaanId: "Daftar pustaka Anda memuat sumber yang tidak pernah dikutip. Mengapa?",
    pertanyaanAr: "تضم قائمة المراجع مصادر لم تقتبس في المتن، فلماذا؟",
    tipsId:
      "Bersihkan daftar pustaka agar hanya memuat karya yang benar-benar dikutip, dan periksa ulang dengan menelusuri nama setiap penulis.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-61",
    kategori: "penulisan",
    pertanyaanId: "Apakah judul bab tiga sudah mencerminkan isinya?",
    pertanyaanAr: "هل يعبر عنوان الفصل الثالث عن مضمونه؟",
    tipsId:
      "Bandingkan judul dengan rumusan masalah nomor dua dan usulkan judul yang lebih tepat bila perlu.",
    metode: ["kuantitatif", "mixed"],
  },
  {
    id: "sidang-62",
    kategori: "penulisan",
    pertanyaanId:
      "Paragraf pertama bab empat tidak punya kalimat topik. Bagaimana Anda memperbaikinya?",
    pertanyaanAr:
      "الفقرة الأولى من الفصل الرابع تخلو من جملة موضوع، فكيف تصححها؟",
    tipsId:
      "Tulis ulang paragraf itu dengan kalimat topik di awal yang menyatakan temuan utama, lalu tunjukkan versi barunya.",
    metode: ["kualitatif", "mixed"],
  },
  {
    id: "sidang-63",
    kategori: "penulisan",
    pertanyaanId: "Mengapa banyak istilah asing ditulis tanpa terjemahan?",
    pertanyaanAr: "لماذا كتبت كثيرا من المصطلحات الأجنبية دون ترجمة؟",
    tipsId:
      "Tambahkan padanan istilah pada kemunculan pertama dan konsisten sesudahnya, termasuk untuk istilah Arab.",
    metode: ["kuantitatif", "kualitatif"],
  },
  {
    id: "sidang-64",
    kategori: "penulisan",
    pertanyaanId: "Tabel 4.3 tidak diberi sumber. Dari mana angka itu Anda peroleh?",
    pertanyaanAr: "الجدول 4.3 بلا مصدر، فمن أين حصلت على أرقامه؟",
    tipsId:
      "Cantumkan sumber di bawah tabel, apakah data primer Anda sendiri atau data yang Anda olah dari sumber tertentu.",
    metode: ["kuantitatif", "mixed"],
  },
  {
    id: "sidang-65",
    kategori: "penulisan",
    pertanyaanId:
      "Abstrak Anda 320 kata, padahal batasnya 250. Apa yang akan Anda potong?",
    pertanyaanAr: "ملخصك يبلغ 320 كلمة والحد الأقصى 250، فماذا ستحذف منه؟",
    tipsId:
      "Pangkas latar belakang dan pertahankan tujuan, metode, temuan utama, serta simpulan secara berurutan.",
    metode: ["kualitatif", "kuantitatif"],
  },
  {
    id: "sidang-66",
    kategori: "penulisan",
    pertanyaanId:
      "Abstrak berbahasa Arab Anda terasa hasil terjemahan mesin. Siapa yang memeriksanya?",
    pertanyaanAr: "يبدو ملخصك العربي ترجمة آلية، فمن راجعه لغويا؟",
    tipsId:
      "Minta penutur atau dosen bahasa Arab memeriksa abstrak dan tunjukkan bukti revisi beserta nama pemeriksanya.",
    metode: ["kuantitatif", "mixed"],
  },
];
