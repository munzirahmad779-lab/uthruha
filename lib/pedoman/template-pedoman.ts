/**
 * TEMPLATE PEDOMAN PERMANEN (perintah pemilik, 29 Okt 2026): dua pedoman
 * kampus yang diringkas MANUAL dari dokumen resminya ke skema tetap
 * pedoman-struktur-v1, agar mahasiswa cukup mengeklik nama kampusnya —
 * tanpa paket prompt AI luar dan tanpa tempel JSON.
 *
 * Sumber (dibaca utuh sebelum diringkas, bukan karangan):
 *  - Mangkoso: دليل كتابة الرسالة العلمية لطالب المعهد العالي لدار الدعوة
 *    والإرشاد منجكوسو (2025). Struktur khasnya: risalah LIMA bab; Bab 1
 *    merangkum seluruh unsur proposal; Bab 2–4 menjawab pertanyaan
 *    rumusan masalah SATU PER SATU (bab 2 pertanyaan 1, bab 3 pertanyaan
 *    2, bab 4 pertanyaan 3); Bab 5 khotimah.
 *  - As'adiyah: المبادئ التوجيهية لكتابة الرسائل العلمية باللغة العربية —
 *    Ma'had Aly As'adiyah Sengkang Wajo (September 2025). Struktur
 *    khasnya: rencana sepuluh unsur (khalfiyah tiga unsur, definisi judul
 *    berdiri sendiri, metodologi empat unsur); metode yang diakui:
 *    التحليلي، التطبيقي (الموضوعي)، النقدي، المقارن، تحقيق المخطوطات.
 *
 * DIBANGUN ULANG 4 Nov 2026 (Pembangunan Ulang Tahap 1) dari
 * SPEC-PEDOMAN.md, hasil verifikasi kata per kata ke kedua PDF resmi:
 *  - Mangkoso: Bab 1 dilengkapi التعريف بالموضوع وحدود البحث dan
 *    الإطار المفهومي; isi khalfiyah dibetulkan menjadi empat unsur;
 *    ikatan bab isi ke isykal kini bidang DATA (menjawabIsykal), bukan
 *    sekadar nama; angka halaman dibetulkan (risalah minimal 150,
 *    proposal minimal 20); aturan karangan lama (bab 4 cadangan bila
 *    rumusan hanya dua; alasan pemilihan dirasah) dibuang karena tidak
 *    ada di pedoman. Nama "Pembahasan I/II/III: Jawaban Rumusan Masalah
 *    ..." adalah LABEL APLIKASI: pedoman tidak memberi nama tetap untuk
 *    bab isi, judul bab mengikuti topik jawaban risalah.
 *  - As'adiyah: DIBANGUN ULANG TOTAL menjadi LIMA bab sesuai panduannya
 *    (المقدمة، الإطار النظري والمناقشة الأكاديمية، مجالات الرسالة،
 *    الدراسة، الخاتمة), menggantikan empat bab karangan lama. Bab 1
 *    dilengkapi المصادر والمراجع; aturan dirasah wajib memuat HASIL
 *    penelitian terdahulu; langkah-langkah metode pindah ke aturan
 *    metodologi Bab 1 (di pedoman ia uraian metode, bukan isi bab).
 *  - Penomoran footnote dicatat sebagai data template
 *    (penomoranFootnote): Mangkoso bersambung antar-bab, As'adiyah mulai
 *    dari 1 tiap bab. Mesin footnote-nya dikerjakan tahap lain.
 *
 * Aturan kejujuran data: yang dimasukkan HANYA struktur dan aturan yang
 * terbaca nyata di kedua dokumen itu. Angka/format yang tidak terbaca
 * utuh dari ekstraksi PDF tidak ditebak. Bila kampus menerbitkan edisi
 * baru, perbarui berkas ini dari dokumen barunya.
 */
import {
  SkemaStrukturPedoman,
  type StrukturPedoman,
} from "@/lib/pedoman/skema-struktur";

const MANGKOSO: StrukturPedoman = SkemaStrukturPedoman.parse({
  versiSkema: "pedoman-struktur-v1",
  namaPedoman: "Pedoman Penulisan Risalah Ma'had Aly DDI Mangkoso",
  penomoranFootnote: "bersambung",
  bab: [
    {
      nomor: 1,
      nama: "Pendahuluan",
      namaAr: "المقدمة",
      tujuan:
        "Bab pembuka berisi gambaran umum penelitian: seluruh unsur proposal (latar belakang sampai metodologi dan kerangka konseptual) diringkas di sini mengikuti urutan محتويات الرسالة pada pedoman.",
      subBab: [
        { nama: "Latar Belakang Masalah", namaAr: "خلفية البحث", wajib: true },
        { nama: "Pengenalan Topik dan Batasan Penelitian", namaAr: "التعريف بالموضوع وحدود البحث", wajib: true },
        { nama: "Rumusan Masalah", namaAr: "مشكلات البحث", wajib: true },
        { nama: "Penelitian Terdahulu", namaAr: "الدراسات السابقة", wajib: true },
        { nama: "Tujuan Penelitian", namaAr: "أهداف البحث", wajib: true },
        { nama: "Manfaat Penelitian", namaAr: "فوائد البحث", wajib: true },
        { nama: "Definisi Istilah pada Judul", namaAr: "التعريف بالمصطلحات المذكورة في عنوان الرسالة", wajib: true },
        { nama: "Metode Penelitian", namaAr: "منهج البحث", wajib: true },
        { nama: "Kerangka Konseptual", namaAr: "الإطار المفهومي", wajib: true },
        { nama: "Sistematika Pembahasan", namaAr: "محتويات البحث", wajib: true },
      ],
      aturan: [
        { teks: "Latar belakang wajib memuat empat hal: pentingnya topik (أهمية الموضوع), alasan memilih topik itu (أسباب اختياره), tujuannya (أهدافه), dan manfaatnya (الفائدة منه).", wajib: true },
        { teks: "Pengenalan topik dan batasan penelitian (التعريف بالموضوع وحدود البحث) adalah unsur tersendiri sesudah latar belakang, bukan bagian dari latar belakang.", wajib: true },
        { teks: "Rumusan masalah adalah pokok persoalan yang menjadi fokus peneliti, dirumuskan dari latar belakang.", wajib: true },
        { teks: "Penelitian terdahulu yang dicantumkan adalah yang berkaitan dengan topik risalah (الدراسات السابقة التي تتعلق بموضوع الرسالة).", wajib: true },
        { teks: "Metode penelitian wajib menyebutkan jenis penelitian, sumber data, cara dan alat pengumpulan data, teknik pengolahan dan analisis data, serta pengujian keabsahan data.", wajib: true },
        { teks: "Format naskah: huruf Calibri 16 untuk isi, Calibri 18 untuk judul risalah, dan Calibri 12 untuk catatan kaki serta kata berbahasa Indonesia, spasi 1,5, kertas A4 HVS 70 gram.", wajib: true },
        { teks: "Jumlah halaman: risalah tidak kurang dari 150 halaman dan proposal (الأطروحة) tidak kurang dari 20 halaman; pedoman tidak memberi batas atas.", wajib: true },
        { teks: "Naskah ditulis dalam bahasa Arab fusha dengan memperhatikan kaidahnya; istilah asing ditulis dalam huruf Arab dan Latin.", wajib: true },
        { teks: "Abstrak ditulis dalam tiga bahasa (Arab, Indonesia, Inggris) sebanyak empat paragraf berurutan: tujuan penelitian lalu masalahnya; jenis penelitian dan metode pengumpulan, analisis, dan verifikasi data; hasil yang dicapai; rekomendasi. Tidak lebih dari 250 kata dalam satu halaman, disertai kata kunci 3 sampai 5 istilah.", wajib: true },
      ],
    },
    {
      nomor: 2,
      nama: "Pembahasan I: Jawaban Rumusan Masalah Pertama",
      namaAr: "الإجابة عن السؤال الأول",
      tujuan:
        "Bab isi pertama (من صلب الرسالة): memuat hasil kerja peneliti untuk menjawab pertanyaan pertama yang ada dalam rumusan masalah. Pedoman tidak memberi nama tetap untuk bab isi; judul bab mengikuti topik jawabannya.",
      menjawabIsykal: 1,
      subBab: [{ nama: "Jawaban Isykal Pertama", namaAr: "الإجابة عن السؤال الأول", wajib: true }],
      aturan: [
        { teks: "Isi bab adalah jawaban atas pertanyaan pertama pada rumusan masalah, hasil analisis peneliti sendiri.", wajib: true },
        { teks: "Kutipan langsung kurang dari enam baris ditulis menyatu dengan teks dalam tanda kutip; enam baris atau lebih ditulis terpisah dengan jarak satu sejajar awal paragraf; kutipan tidak langsung ditulis menyatu tanpa tanda kutip. Terjemahan ayat dan hadis ditulis terpisah sejajar awal paragraf.", wajib: true },
        { teks: "Sub-bab (فصل dan مبحث) bab ini disusun mengikuti materi jawaban; jangan menyalin susunan Bab 1 ke sini.", wajib: false },
      ],
    },
    {
      nomor: 3,
      nama: "Pembahasan II: Jawaban Rumusan Masalah Kedua",
      namaAr: "الإجابة عن السؤال الثاني",
      tujuan:
        "Bab isi kedua (من صلب الرسالة): memuat hasil kerja peneliti untuk menjawab pertanyaan kedua yang ada dalam rumusan masalah. Pedoman tidak memberi nama tetap untuk bab isi; judul bab mengikuti topik jawabannya.",
      menjawabIsykal: 2,
      subBab: [{ nama: "Jawaban Isykal Kedua", namaAr: "الإجابة عن السؤال الثاني", wajib: true }],
      aturan: [
        { teks: "Isi bab adalah jawaban atas pertanyaan kedua pada rumusan masalah, dengan kedalaman analisis yang sama seperti bab sebelumnya.", wajib: true },
        { teks: "Sub-bab (فصل dan مبحث) bab ini disusun mengikuti materi jawaban; jangan menyalin susunan Bab 1 ke sini.", wajib: false },
      ],
    },
    {
      nomor: 4,
      nama: "Pembahasan III: Jawaban Rumusan Masalah Ketiga",
      namaAr: "الإجابة عن السؤال الثالث",
      tujuan:
        "Bab isi ketiga (من صلب الرسالة): memuat hasil kerja peneliti untuk menjawab pertanyaan ketiga yang ada dalam rumusan masalah. Pedoman tidak memberi nama tetap untuk bab isi; judul bab mengikuti topik jawabannya.",
      menjawabIsykal: 3,
      subBab: [{ nama: "Jawaban Isykal Ketiga", namaAr: "الإجابة عن السؤال الثالث", wajib: true }],
      aturan: [
        { teks: "Isi bab adalah jawaban atas pertanyaan ketiga pada rumusan masalah, hasil analisis peneliti sendiri.", wajib: true },
        { teks: "Pedoman mengikat bab ini pada pertanyaan ketiga dan tidak mengatur keadaannya bila rumusan masalah berjumlah lain; keadaan seperti itu disesuaikan dengan pembimbing.", wajib: false },
        { teks: "Sub-bab (فصل dan مبحث) bab ini disusun mengikuti materi jawaban; jangan menyalin susunan Bab 1 ke sini.", wajib: false },
      ],
    },
    {
      nomor: 5,
      nama: "Penutup",
      namaAr: "الخاتمة",
      tujuan: "Bab terakhir berisi kesimpulan dan saran dalam halaman yang sedikit, diikuti daftar pustaka dan lampiran.",
      subBab: [
        { nama: "Kesimpulan", namaAr: "الخلاصة", wajib: true },
        { nama: "Saran", namaAr: "التوصيات", wajib: true },
      ],
      aturan: [
        { teks: "Penomoran halaman: bagian awal memakai huruf abjad Arab (أ ب ج د هـ و ز), isi memakai angka Arab mulai Bab 1; nomor pada halaman pertama setiap bab disembunyikan.", wajib: true },
        { teks: "Catatan kaki mengikuti format pedoman: nama pengarang tanpa gelar akademik (yang paling dikenal), judul buku, jilid/juz, kota terbit, penerbit, tahun, halaman; penomoran catatan kaki BERSAMBUNG dari bab sebelumnya, tidak mulai dari 1 tiap bab.", wajib: true },
        { teks: "Daftar pustaka: nama pengarang yang paling dikenal, judul dicetak miring, kota terbit, penerbit, tahun; disusun alfabetis menurut abjad hijaiyah dan dikelompokkan menurut jenis sumber (buku, majalah/jurnal, internet, wawancara).", wajib: true },
        { teks: "Jumlah rujukan tidak kurang dari 30 sumber.", wajib: true },
        { teks: "Nama pengarang ditulis tanpa gelar akademik; nama asing ditulis dalam huruf Arab dan Latin.", wajib: true },
      ],
    },
  ],
});

const ASADIYAH: StrukturPedoman = SkemaStrukturPedoman.parse({
  versiSkema: "pedoman-struktur-v1",
  namaPedoman: "Pedoman Penulisan Risalah Ma'had Aly As'adiyah Sengkang",
  penomoranFootnote: "per-bab",
  bab: [
    {
      nomor: 1,
      nama: "Pendahuluan",
      namaAr: "المقدمة",
      tujuan:
        "Bab pembuka memuat delapan unsur resmi pedoman As'adiyah: latar belakang, rumusan masalah, definisi judul, penelitian terdahulu, metodologi, tujuan, urgensi, dan sumber beserta rujukan.",
      subBab: [
        { nama: "Latar Belakang", namaAr: "خلفية الرسالة", wajib: true },
        { nama: "Rumusan Masalah", namaAr: "مشكلات الرسالة", wajib: true },
        { nama: "Definisi Judul", namaAr: "تعريف عنوان الرسالة", wajib: true },
        { nama: "Penelitian Terdahulu", namaAr: "الدراسات السابقة", wajib: true },
        { nama: "Metodologi Penelitian", namaAr: "منهجية الرسالة", wajib: true },
        { nama: "Tujuan Penelitian", namaAr: "أهداف الرسالة", wajib: true },
        { nama: "Urgensi Penelitian", namaAr: "أهمية الرسالة", wajib: true },
        { nama: "Sumber dan Rujukan", namaAr: "المصادر والمراجع", wajib: true },
      ],
      aturan: [
        { teks: "Latar belakang terdiri dari tiga unsur wajib: pengantar yang menunjukkan gambaran topik beserta kebaruan dan orisinalitasnya; motivasi dan alasan memilih judul, berupa persoalan teoretis maupun faktual yang diperkuat pendapat ulama atau pakar; serta titik tolak dari komentar, tindak lanjut, atau kritik atas karya sebelumnya yang terkait, untuk menemukan masalah yang perlu diteliti.", wajib: true },
        { teks: "Rumusan masalah berbentuk pertanyaan (kata tanya seperti ما، ماذا، لماذا، كيف): satu soal pokok yang boleh bercabang menjadi dua atau tiga pertanyaan, atau langsung dua sampai tiga soal. Setiap pertanyaan diuraikan, dijawab, dan dianalisis di bab, fashl, dan mabhats risalah; pedoman tidak memetakan satu bab untuk satu pertanyaan.", wajib: true },
        { teks: "Definisi judul berdiri sendiri: judul dirumuskan terbatas, jelas, dan mencerminkan isi serta batas penelitian; bedakan judul (العنوان, lebih khusus) dari topik (الموضوع, lebih umum). Pembatasan masalah lewat tiga jalan: pembatasan topik, waktu, dan tempat.", wajib: true },
        { teks: "Penelitian terdahulu wajib menyebut nama peneliti sebelumnya, judul, tujuan, dan HASIL penelitiannya, lalu titik persamaan dan perbedaan dengan penelitian ini, agar tidak terjadi pengulangan; peneliti juga wajib menunjukkan kebaruan risalahnya.", wajib: true },
        { teks: "Metodologi menyebut empat unsur: metode penelitian (jenis menurut cara pengumpulan data, analisis, dan tujuan), data (sumber primer dan sekunder serta cara pengumpulannya), pendekatan studi (منهج الدراسة), dan cara penulisan mengikuti panduan kampus.", wajib: true },
        { teks: "Rencana risalah (الخطة) yang memuat unsur-unsur bab ini panjangnya tidak kurang dari 15 halaman di luar sampul.", wajib: true },
        { teks: "Tujuan penelitian adalah jawaban atas pertanyaan rumusan masalah dan jumlahnya harus sebanding dengannya (tiga pertanyaan berarti tiga tujuan), dirumuskan dengan kata kerja seperti لمعرفة، لتبيين، لتحليل.", wajib: true },
        { teks: "Metode analitis (المنهج التحليلي), bila dipilih: analisis bahasa dan balaghah, konteks (siyaq), sejarah termasuk sebab nuzul, dan syariat, ditutup perbandingan pendapat mufasir untuk memilih yang terkuat.", wajib: false },
        { teks: "Metode tematik-terapan (المنهج التطبيقي/الموضوعي), bila dipilih: memilih topik, mengumpulkan ayat terkait, mempelajari konteks tiap ayat, menganalisis per ayat, merangkai gambaran Qur'ani yang utuh, lalu menerapkannya pada realitas.", wajib: false },
        { teks: "Metode kritis (المنهج النقدي), bila dipilih: mengumpulkan bahan, meneliti sanad riwayat, menganalisis matan, membandingkan pendapat (titik sepakat dan titik selisih), tarjih, dan menonjolkan hasil.", wajib: false },
        { teks: "Metode perbandingan (المنهج المقارن), bila dipilih: menentukan topik banding, mengumpulkan dan mempelajari pendapat, membandingkan titik sepakat, titik selisih, dan sebab perbedaan (bahasa, riwayat, ijtihad, atau metode), lalu tarjih dan menarik hasil.", wajib: false },
        { teks: "Metode tahqiq manuskrip (منهج تحقيق المخطوطات), bila dipilih: mengumpulkan naskah, membandingkan untuk memilih yang paling sahih, menetapkan teks dengan catatan perbedaan, verifikasi sumber, dan komentar seperlunya; bagian isinya umumnya tiga: studi pengarang, studi manuskrip, dan teks manuskrip itu sendiri.", wajib: false },
        { teks: "Risalah ditulis dalam bahasa Arab fusha; bidang kajian Ma'had Aly As'adiyah adalah tafsir dan ulumul Qur'an (تخصص التفسير وعلومه).", wajib: true },
      ],
    },
    {
      nomor: 2,
      nama: "Kerangka Teoretis dan Diskusi Akademik",
      namaAr: "الإطار النظري والمناقشة الأكاديمية",
      tujuan:
        "Bab ini memaparkan prinsip dan teori (kajian teoretis) serta studi kepustakaan dalam bentuk diskusi ilmiah akademik yang menyeluruh sesuai judul risalah; teori-teori itu menjadi alat dan rujukan untuk mengolah dan menganalisis data pada bab inti (الدراسة).",
      subBab: [
        { nama: "Prinsip dan Teori", namaAr: "المبادئ والنظريات", wajib: true },
        { nama: "Diskusi Akademik Studi Kepustakaan", namaAr: "المناقشة الأكاديمية", wajib: true },
      ],
      aturan: [
        { teks: "Isi bab adalah paparan teori dan studi kepustakaan yang relevan dengan judul, disajikan sebagai diskusi akademik yang menyeluruh, bukan sekadar daftar kutipan.", wajib: true },
        { teks: "Teori yang dipaparkan di bab ini menjadi alat dan rujukan pengolahan serta analisis data pada bab الدراسة.", wajib: true },
      ],
    },
    {
      nomor: 3,
      nama: "Bidang dan Lingkup Risalah",
      namaAr: "مجالات الرسالة",
      tujuan:
        "Bab ini memberi paparan deskriptif yang ringkas dan teliti tentang bidang risalah, tempat risalah, lapangan risalah, dan objek (عين) risalah, yakni profil identitas bidang yang akan diteliti. Bab ini bukan bab pembahasan dan bukan tempat menjawab rumusan masalah.",
      subBab: [
        { nama: "Bidang dan Lokasi Risalah", namaAr: "مجال الرسالة ومحلها", wajib: true },
        { nama: "Lapangan dan Objek Risalah", namaAr: "ميدان الرسالة وعينها", wajib: true },
      ],
      aturan: [
        { teks: "Paparan bersifat deskriptif: bidang, lokasi, lapangan, dan objek risalah digambarkan apa adanya secara ringkas dan teliti.", wajib: true },
      ],
    },
    {
      nomor: 4,
      nama: "Penelitian (Bab Inti)",
      namaAr: "الدراسة",
      tujuan:
        "Bab inti risalah (لب الرسالة): peneliti menguraikan masalah atau القضايا yang diusulkan dalam rencana risalah secara terperinci, disertai cara pengolahan data dengan menganalisis, mengkritik, atau membandingkannya, mengikuti metodologi yang dipilih. Di sinilah jawaban rumusan masalah dikerjakan.",
      subBab: [
        { nama: "Uraian Masalah Penelitian", namaAr: "عرض المشكلات المقترحة", wajib: true },
        { nama: "Pengolahan dan Analisis Data", namaAr: "معالجة البيانات وتحليلها", wajib: true },
      ],
      aturan: [
        { teks: "Pengolahan data mengikuti pendekatan studi (منهج الدراسة) yang ditetapkan di Bab 1: analisis, kritik, atau perbandingan, dengan menyebutkan cara dan langkahnya.", wajib: true },
        { teks: "Hasil uraian bab ini menjadi bahan hasil dan jawaban yang disampaikan pada Bab 5 (الخاتمة).", wajib: false },
      ],
    },
    {
      nomor: 5,
      nama: "Penutup",
      namaAr: "الخاتمة",
      tujuan:
        "Bab penutup memuat hasil risalah, saran, dan jawaban atas pertanyaan serta tujuan risalah, baik yang bersifat teoretis (bidang masih terbuka untuk dikaji) maupun aplikatif (dapat diterapkan pihak terkait di masyarakat).",
      subBab: [
        { nama: "Kesimpulan: Hasil dan Jawaban Rumusan", namaAr: "الخلاصة ونتائج الرسالة", wajib: true },
        { nama: "Saran", namaAr: "الاقتراحات", wajib: true },
      ],
      aturan: [
        { teks: "Penomoran catatan kaki dimulai dari 1 pada setiap bab baru; karena itu data rujukan ditulis lengkap pada kemunculan pertamanya di tiap bab.", wajib: true },
        { teks: "Daftar sumber dan rujukan akhir berbeda formatnya dari catatan kaki: dimulai dari nama lengkap pengarang, lalu judul kitab, tempat terbit, percetakan, dan tahun; diurutkan menurut abjad dengan urutan bahasa Arab, lalu Inggris, lalu bahasa lain, lalu Indonesia.", wajib: true },
        { teks: "Risalah tidak kurang dari 40 halaman (Bab 1 sampai Bab 5); rujukan tidak kurang dari 30 dengan komposisi 70 persen rujukan primer dan 30 persen rujukan sekunder; jumlah halaman antar-bab dijaga seimbang.", wajib: true },
        { teks: "Format naskah: kertas HVS 80 gram ukuran A4; huruf Sakkal Majalla 16 untuk teks (spasi Exactly 24 pt) dan 12 untuk catatan kaki (Exactly 18 pt); margin kanan 4 cm, kiri 3 cm, atas 3 cm, bawah 3 cm.", wajib: true },
        { teks: "Rujukan tafsir dan ulumul Qur'an yang dicontohkan pedoman: Tafsir al-Munir karya az-Zuhaili, Jami' al-Bayan karya ath-Thabari, at-Tahrir wat-Tanwir karya Ibnu Asyur, al-Itqan karya as-Suyuthi, Manahil al-Irfan karya az-Zarqani, Mabahits fi Ulum al-Qur'an karya al-Qaththan, dan at-Tafsir wal-Mufassirun karya adz-Dzahabi.", wajib: false },
        { teks: "Etika peneliti wajib dijaga: pedoman melarang plagiarisme (السرقة العلمية), kebohongan (الكذب), dan manipulasi (التدليس) dalam penulisan.", wajib: true },
        { teks: "Bagian depan risalah: sampul, lembar pernyataan orisinalitas bermeterai Rp10.000, lembar persetujuan pembimbing, lembar pengesahan, kata pengantar (التمهيد), daftar isi, dan abstrak (memuat minimal tujuan, metode, dan hasil terpenting).", wajib: true },
      ],
    },
  ],
});

/** Dua template permanen, urutan tampil = urutan array ini. */
export const TEMPLATE_PEDOMAN: StrukturPedoman[] = [MANGKOSO, ASADIYAH];
