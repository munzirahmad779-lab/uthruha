import Link from "next/link";

export function Hero() {
  return (
    <section className="wrap pt-16 pb-12 sm:pt-20 sm:pb-16">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
          <span className="font-arabic text-gold-600" dir="rtl">
            عُثْرُهَ
          </span>
          <br />
          Alat bantu menyusun skripsi & makalah berbahasa Arab
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-700">
          Kerangka lima bab, bank frasa akademik, penyusun sitasi gaya kitab, dan ekspor .docx —
          dalam satu ruang kerja yang bisa dipakai sekarang.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/mulai" className="btn-primary">
            Mulai proyek
          </Link>
          <Link href="/khalfiyah" className="btn-secondary">
            🆕 Susun Khalfiyah Al-Bahts
          </Link>
          <Link href="/alat" className="btn-secondary">
            Lihat alat gratis
          </Link>
        </div>
      </div>
    </section>
  );
}
