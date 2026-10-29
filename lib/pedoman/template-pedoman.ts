/**
 * TEMPLATE PEDOMAN PERMANEN (perintah pemilik, 29 Okt 2026): dua pedoman
 * kampus yang diringkas MANUAL dari dokumen resminya ke skema tetap
 * pedoman-struktur-v1, agar mahasiswa cukup mengeklik nama kampusnya —
 * tanpa paket prompt AI luar dan tanpa tempel JSON.
 *
 * Sumber (dibaca utuh sebelum diringkas, bukan karangan):
 *  - Mangkoso: "PEDOMAN PENULISAN RISALAH 2.pdf" — Dalil Ma'had Aly
 *    Darud Da'wah wal-Irsyad Mangkoso (2025), dari Drive pemilik folder
 *    Skripsi. Struktur khasnya: risalah LIMA bab; Bab 1 merangkum seluruh
 *    unsur proposal; Bab 2–4 menjawab rumusan masalah satu per satu;
 *    Bab 5 khotimah ringkas.
 *  - As'adiyah: "PEDOMAN PENULISAN RISALAH BAHASA ARAB" — Ma'had Aly
 *    As'adiyah Sengkang (September 2025), PDF yang diserahkan pemilik.
 *    Struktur khasnya: rencana sepuluh unsur (khalfiyah tiga unsur,
 *    definisi judul berdiri sendiri, metodologi empat unsur); metode
 *    yang diakui: التحليلي، الموضوعي، النقدي، المقارن، تحقيق المخطوطات.
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
  bab: [
    {
      nomor: 1,
      nama: "Pendahuluan",
      namaAr: "المقدمة",
      tujuan:
        "Bab pembuka berisi gambaran umum penelitian: seluruh unsur proposal (latar belakang sampai metodologi) diringkas di sini mengikuti urutan محتويات الرسالة pada pedoman.",
      subBab: [
        { nama: "Latar Belakang Masalah", namaAr: "خلفية البحث", wajib: true },
        { nama: "Rumusan Masalah", namaAr: "مشكلات البحث", wajib: true },
        { nama: "Tujuan Penelitian", namaAr: "أهداف البحث", wajib: true },
        { nama: "Manfaat Penelitian", namaAr: "فوائد البحث", wajib: true },
        { nama: "Penelitian Terdahulu", namaAr: "الدراسات السابقة", wajib: true },
        { nama: "Definisi Judul", namaAr: "تعريف العنوان", wajib: true },
        { nama: "Metode Penelitian", namaAr: "منهج البحث", wajib: true },
        { nama: "Sistematika Pembahasan", namaAr: "محتويات البحث", wajib: true },
      ],
      aturan: [
        { teks: "Latar belakang wajib memuat: pengantar topik, batasan penelitian, alasan memilih topik, tujuan, dan manfaatnya.", wajib: true },
        { teks: "Rumusan masalah adalah pokok persoalan yang menjadi fokus peneliti, dirumuskan dari latar belakang.", wajib: true },
        { teks: "Metode penelitian wajib menyebutkan jenis penelitian, sumber data, cara dan alat pengumpulan data, serta teknik pengolahan dan analisis data.", wajib: true },
        { teks: "Penelitian terdahulu yang dicantumkan adalah yang relevan, disertai alasan pemilihannya oleh peneliti.", wajib: true },
        { teks: "Format naskah: huruf Calibri 16 untuk isi dan Calibri 12 untuk catatan kaki serta kata berbahasa Indonesia, spasi 1,5, kertas A4 HVS 70 gram.", wajib: true },
        { teks: "Jumlah halaman risalah tidak kurang dari 100 halaman dan tidak lebih dari 150 halaman.", wajib: true },
        { teks: "Naskah ditulis dalam bahasa Arab fusha dengan memperhatikan kaidahnya; istilah asing ditulis dalam huruf Arab dan Latin.", wajib: true },
        { teks: "Abstrak ditulis dalam tiga bahasa (Arab, Indonesia, Inggris) sebanyak empat paragraf (masalah dan tujuan; metode; pengolahan data dan hasil; kesimpulan dan rekomendasi), tidak lebih dari 250 kata dalam satu halaman, disertai kata kunci.", wajib: true },
      ],
    },
    {
      nomor: 2,
      nama: "Pembahasan I: Jawaban Rumusan Masalah Pertama",
      namaAr: "الإجابة عن السؤال الأول",
      tujuan:
        "Bab isi pertama (badan risalah): memuat hasil kerja peneliti untuk menjawab pertanyaan pertama dalam rumusan masalah.",
      subBab: [{ nama: "Pengantar Bab", namaAr: "تمهيد", wajib: false }],
      aturan: [
        { teks: "Isi bab adalah jawaban atas pertanyaan pertama pada rumusan masalah, hasil analisis peneliti sendiri.", wajib: true },
        { teks: "Kutipan langsung kurang dari enam baris ditulis menyatu dengan teks dalam tanda kutip; enam baris atau lebih ditulis terpisah sejajar awal paragraf. Aturan yang sama berlaku untuk teks terjemahan.", wajib: true },
        { teks: "Sub-bab bab ini disusun mengikuti materi jawaban; jangan menyalin susunan Bab 1 ke sini.", wajib: false },
      ],
    },
    {
      nomor: 3,
      nama: "Pembahasan II: Jawaban Rumusan Masalah Kedua",
      namaAr: "الإجابة عن السؤال الثاني",
      tujuan: "Bab isi kedua: menjawab pertanyaan kedua dalam rumusan masalah.",
      subBab: [{ nama: "Pengantar Bab", namaAr: "تمهيد", wajib: false }],
      aturan: [
        { teks: "Isi bab adalah jawaban atas pertanyaan kedua pada rumusan masalah, dengan kedalaman analisis yang sama seperti bab sebelumnya.", wajib: true },
      ],
    },
    {
      nomor: 4,
      nama: "Pembahasan III: Jawaban Rumusan Masalah Ketiga",
      namaAr: "الإجابة عن السؤال الثالث",
      tujuan: "Bab isi ketiga: menjawab pertanyaan ketiga dalam rumusan masalah bila ada.",
      subBab: [{ nama: "Pengantar Bab", namaAr: "تمهيد", wajib: false }],
      aturan: [
        { teks: "Bab ini mengikuti jumlah rumusan masalah. Bila rumusan masalah hanya dua, bab ini menjadi pendalaman analisis dan perbandingan sebelum penutup.", wajib: false },
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
        { teks: "Catatan kaki mengikuti format pedoman: nama pengarang tanpa gelar akademik (yang paling dikenal), judul buku, jilid/juz, kota terbit, penerbit, tahun, halaman; penomoran catatan kaki berlanjut antar-bab.", wajib: true },
        { teks: "Daftar pustaka: nama pengarang yang paling dikenal, judul dicetak miring, kota terbit, penerbit, tahun; disusun alfabetis dan dikelompokkan menurut jenis sumber (buku, jurnal, artikel, internet).", wajib: true },
        { teks: "Jumlah rujukan tidak kurang dari 30 sumber.", wajib: true },
        { teks: "Nama pengarang ditulis tanpa gelar akademik; nama asing ditulis dalam huruf Arab dan Latin.", wajib: true },
      ],
    },
  ],
});

const ASADIYAH: StrukturPedoman = SkemaStrukturPedoman.parse({
  versiSkema: "pedoman-struktur-v1",
  namaPedoman: "Pedoman Penulisan Risalah Ma'had Aly As'adiyah Sengkang",
  bab: [
    {
      nomor: 1,
      nama: "Pendahuluan",
      namaAr: "المقدمة",
      tujuan:
        "Bab pembuka mengikuti unsur rencana (khiththah) resmi pedoman As'adiyah: latar belakang, rumusan masalah, definisi judul, penelitian terdahulu, metodologi, tujuan, dan urgensi.",
      subBab: [
        { nama: "Latar Belakang", namaAr: "خلفية الرسالة", wajib: true },
        { nama: "Rumusan Masalah", namaAr: "مشكلات الرسالة", wajib: true },
        { nama: "Definisi Judul", namaAr: "تعريف عنوان الرسالة", wajib: true },
        { nama: "Penelitian Terdahulu", namaAr: "الدراسات السابقة", wajib: true },
        { nama: "Metodologi Penelitian", namaAr: "منهجية الرسالة", wajib: true },
        { nama: "Tujuan Penelitian", namaAr: "أهداف الرسالة", wajib: true },
        { nama: "Urgensi Penelitian", namaAr: "أهمية الرسالة", wajib: true },
      ],
      aturan: [
        { teks: "Latar belakang terdiri dari tiga unsur wajib: pengantar yang menjelaskan latar topik, pernyataan motivasi dan alasan memilih judul, serta titik tolak dari penelitian terdahulu.", wajib: true },
        { teks: "Rumusan masalah berbentuk pertanyaan (kata tanya seperti ما، كيف، لماذا): satu soal pokok yang boleh bercabang menjadi dua atau tiga pertanyaan, dan setiap pertanyaan dijawab di bab-bab isi.", wajib: true },
        { teks: "Definisi judul berdiri sendiri: judul harus jelas dan mencerminkan isi serta batas penelitian; bedakan judul (lebih khusus) dari topik (lebih umum).", wajib: true },
        { teks: "Penelitian terdahulu wajib menyebut nama peneliti, judul, dan tujuannya, serta titik persamaan dan perbedaan dengan penelitian ini agar tidak terjadi pengulangan karya.", wajib: true },
        { teks: "Metodologi menyebut empat unsur: metode penelitian, data, pendekatan studi, dan cara penulisan.", wajib: true },
        { teks: "Metode yang diakui pedoman: analitis (التحليلي), tematik-terapan (الموضوعي/التطبيقي), kritis (النقدي), perbandingan (المقارن), dan tahqiq manuskrip (تحقيق المخطوطات).", wajib: true },
        { teks: "Risalah ditulis dalam bahasa Arab fusha; bidang kajian Ma'had Aly As'adiyah adalah tafsir dan ulumul Qur'an.", wajib: true },
      ],
    },
    {
      nomor: 2,
      nama: "Pembahasan I: Paparan dan Analisis",
      namaAr: "عرض الموضوع وتحليله",
      tujuan:
        "Bab isi pertama: memaparkan dan menganalisis materi untuk menjawab rumusan masalah pertama, mengikuti metode yang dipilih di Bab 1.",
      subBab: [{ nama: "Pengantar Bab", namaAr: "تمهيد", wajib: false }],
      aturan: [
        { teks: "Bila memakai metode analitis: analisis mencakup sisi bahasa dan balaghah, konteks (siyaq), sisi sejarah termasuk sebab nuzul, dan sisi syariat, ditutup perbandingan pendapat mufasir untuk memilih yang terkuat.", wajib: false },
        { teks: "Bila memakai metode tematik: kumpulkan ayat-ayat satu tema, telaah konteksnya satu per satu, analisis, susun gambaran Qur'ani yang utuh, lalu terapkan pada persoalan masa kini.", wajib: false },
        { teks: "Bila memakai metode kritis atau perbandingan: sajikan pendapat dan riwayat berdampingan, periksa sanad dan matannya, lalu tarjihkan dengan menyebutkan hasilnya.", wajib: false },
      ],
    },
    {
      nomor: 3,
      nama: "Pembahasan II: Pendalaman dan Diskusi",
      namaAr: "استكمال الدراسة والمناقشة",
      tujuan:
        "Bab isi lanjutan: menjawab rumusan masalah berikutnya dan mendiskusikan hasil analisis sampai tuntas.",
      subBab: [{ nama: "Pengantar Bab", namaAr: "تمهيد", wajib: false }],
      aturan: [
        { teks: "Perbedaan pendapat disajikan secara berdampingan dengan titik sepakat dan titik selisihnya beserta sebab perbedaan (bahasa, riwayat, ijtihad, atau metode).", wajib: true },
        { teks: "Hasil pembahasan bab ini harus kembali menjawab rumusan masalah yang ditetapkan pada Bab 1.", wajib: true },
      ],
    },
    {
      nomor: 4,
      nama: "Penutup",
      namaAr: "الخاتمة",
      tujuan:
        "Bab penutup berisi kesimpulan dan saran; sesudahnya daftar sumber dan rujukan lalu lampiran (struktur risalah tiga bagian: depan, tengah, akhir).",
      subBab: [
        { nama: "Kesimpulan", namaAr: "الخلاصة", wajib: true },
        { nama: "Saran", namaAr: "التوصيات", wajib: true },
      ],
      aturan: [
        { teks: "Daftar sumber mengikuti model pedoman: nama pengarang, judul, jilid, kota terbit, penerbit, tahun terbit, dan halaman untuk catatan kaki; daftar akhir disusun mengikuti tabel contoh pedoman.", wajib: true },
        { teks: "Rujukan tafsir dan ulumul Qur'an yang dicontohkan pedoman: Tafsir al-Munir karya az-Zuhaili, at-Tahrir wat-Tanwir karya Ibnu Asyur, al-Itqan karya as-Suyuthi, Manahil al-Irfan karya az-Zarqani, Mabahits fi Ulum al-Qur'an karya al-Qaththan, at-Tafsir wal-Mufassirun karya adz-Dzahabi, dan Jami' al-Bayan karya ath-Thabari.", wajib: false },
        { teks: "Etika peneliti wajib dijaga: pedoman melarang plagiarisme (السرقة العلمية), kebohongan (الكذب), dan manipulasi (التدليس) dalam penulisan.", wajib: true },
        { teks: "Bagian depan risalah: sampul, surat penetapan, surat pengesahan, kata pengantar direktur, pengantar penulis, dan daftar isi.", wajib: true },
      ],
    },
  ],
});

/** Dua template permanen, urutan tampil = urutan array ini. */
export const TEMPLATE_PEDOMAN: StrukturPedoman[] = [MANGKOSO, ASADIYAH];
