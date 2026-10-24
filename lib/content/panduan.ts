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
