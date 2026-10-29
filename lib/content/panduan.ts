/** Ringkasan hal yang perlu disiapkan sebelum sidang/munaqasyah. */
export const SPRINT: { judul: string; isi: string }[] = [
  {
    judul: "Bawa peta naskah, bukan hafalan",
    isi: "Siapkan satu lembar berisi rumusan masalah, tujuan, metode, dan kesimpulan. Penguji biasanya menguji konsistensi antara keempatnya.",
  },
  {
    judul: "Hafalkan alasan metodologis",
    isi: "Untuk setiap pilihan — desain, sampel, instrumen, analisis — siapkan satu alasan berbasis tujuan penelitian, bukan kebiasaan.",
  },
  {
    judul: "Kenali sumber utama Anda",
    isi: "Minimal lima rujukan inti harus bisa Anda jelaskan isinya tanpa membuka naskah, termasuk edisi dan halaman yang Anda kutip.",
  },
  {
    judul: "Siapkan tabel hasil",
    isi: "Bawa cetakan tabel dan gambar yang Anda bahas. Pertanyaan tentang angka hampir selalu muncul lebih dulu daripada pertanyaan teori.",
  },
  {
    judul: "Terima batasan dengan terbuka",
    isi: "Mengakui batasan penelitian justru menunjukkan penguasaan. Jawab dengan batasan, penyebab, dan saran penelitian lanjutan.",
  },
  {
    judul: "Periksa ortografi dan istilah terakhir",
    isi: "Kesalahan ة/ه, hamzah, dan istilah yang berubah bentuk mudah terlihat di halaman yang dibuka penguji secara acak.",
  },
];

/** Daftar periksa mandiri sebelum menyerahkan draf ke pembimbing. */
export const PERIKSA: { label: string; ar: string }[] = [
  { label: "Rumusan masalah dan tujuan berjumlah sama dan berurutan", ar: "تطابق الأسئلة والأهداف" },
  { label: "Setiap istilah kunci memakai satu bentuk Arab yang konsisten", ar: "اتساق المصطلحات" },
  { label: "Tidak ada penanda [ … ] yang tersisa", ar: "لا توجد فراغات" },
  { label: "Setiap kutipan ada di daftar rujukan dan sebaliknya", ar: "تطابق التوثيق" },
  { label: "Nomor halaman, tabel, dan gambar berurutan", ar: "ترقيم الصفحات والجداول" },
  { label: "Format mengikuti pedoman program studi", ar: "مطابقة الدليل" },
  { label: "Naskah sudah dibaca ulang untuk nahwu dan sharaf", ar: "المراجعة النحوية" },
  { label: "Tidak ada kalimat hasil salin-tempel tanpa sitasi", ar: "السلامة من الانتحال" },
];

/** Panduan fitur referensi (Fase 2, C.10) — dirender di /panduan#referensi. */
export const REFERENSI_PANDUAN: { judul: string; isi: string[] }[] = [
  {
    judul: "Menambah rujukan: manual, impor, atau cari online",
    isi: [
      "Manual: isi formulir di tab Rujukan — wajib hanya penulis dan judul.",
      "Impor: tempel BibTeX/RIS dari Zotero, Mendeley, atau Google Scholar; entri duplikat (DOI sama / judul hampir sama) dilewati otomatis.",
      "Cari online: semua hasil pencarian masuk sebagai draf berlabel sumber. Tidak ada yang ditambahkan tanpa Anda menekan Tambah.",
    ],
  },
  {
    judul: "Kenapa ada penanda [[ref:…]] di naskah Anda",
    isi: [
      "Penanda itu jangkar sitasi: ia terikat ke satu entri rujukan, bukan ke nomor footnote.",
      "Nomor footnote boleh berubah saat naskah disusun ulang; jangkar tidak — jadi tidak ada sitasi yang diam-diam menunjuk sumber yang salah.",
      "Saat ekspor, penanda berubah menjadi footnote bernomor dengan gaya proyek Anda (bawaan: Turabian 9). Jangan menghapus penanda manual; gunakan tombol Sisip sitasi di tab Tulis.",
    ],
  },
  {
    judul: "Cari Jurnal tidak sama dengan Cari Kitab",
    isi: [
      "Jurnal dicari lewat metadata resmi (CrossRef & DOAJ): ada DOI, nama jurnal, volume — hasilnya siap dipakai setelah Anda periksa sekilas.",
      "Kitab klasik tidak punya metadata se-standar itu. Pencarian kitab mencocokkan frasa di dalam isi kitab (Turath/Shamela), dan scan di Archive.org metadata-nya tidak terkurasi.",
      "Karena itu hasil kitab bertanda perlu verifikasi: periksa edisi dan halaman cetaknya sebelum mengutip. Anggap hasil kitab sebagai petunjuk lokasi, bukan sitasi final.",
    ],
  },
  {
    judul: "Kitabah tidak mengarang sumber",
    isi: [
      "AI di Kitabah hanya membantu menyusun kalimat kunci pencarian dari topik Anda — ia tidak pernah menulis judul, penulis, atau DOI.",
      "Setiap referensi di daftar Anda berasal dari data yang Anda isi, impor, atau pilih sendiri dari hasil pencarian.",
      "Gunakan Cross-check sitasi di tab Periksa untuk memastikan setiap penanda menunjuk rujukan yang masih ada.",
    ],
  },
];
