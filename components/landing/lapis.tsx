import Link from "next/link";

/**
 * Ringkasan lapis di beranda publik. Isi HARUS sejalan dengan penegakan
 * server di lib/server/lapis.ts dan panel Premium di ruang kerja —
 * jangan menjanjikan fitur yang belum aktif: pembayaran QRIS masih
 * "segera" selama gerbang pembayaran belum diaktifkan pemilik.
 */
export function LapisSection() {
  return (
    <section id="lapis" className="wrap scroll-mt-24 pb-16 sm:pb-20">
      <div className="max-w-3xl">
        <span className="eyebrow">Gratis &amp; Premium</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.4rem]">
          Mulai gratis. Naik kelas bila perlu.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-700">
          Dua lapis pemakaian dengan aturan yang ditulis apa adanya di halaman
          ini, termasuk batas-batasnya, dan ditegakkan sama di server.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-ink-900/10 bg-white/70 p-6 shadow-sm sm:p-8">
          <h3 className="text-lg font-extrabold text-ink-900">Gratis</h3>
          <p className="mt-1 text-sm font-semibold text-ink-500">Rp0 — dengan kunci akses gratis</p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-700">
            <li>✓ 1 proyek penulisan</li>
            <li>✓ Pencarian rujukan kitab &amp; jurnal tanpa batas</li>
            <li>✓ Maksimal 3 footnote dalam satu paragraf (batas lapis gratis; pedoman penulisan kampus dapat menetapkan batas lebih ketat, misalnya 2, dan batas pedoman itulah yang ditampilkan di ruang kerja)</li>
            <li>✓ Ruang lingkup terkunci setelah footnote pertama (satu kali ganti kategori sebelum itu)</li>
            <li>✓ Ekspor naskah ke Word (.docx)</li>
            <li>✓ Uji coba tamu tanpa akun, satu kali per perangkat</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-gold-300/60 bg-white/70 p-6 shadow-sm sm:p-8">
          <h3 className="text-lg font-extrabold text-ink-900">Premium</h3>
          <p className="mt-1 text-sm font-semibold text-ink-500">
            Rp10.000 / bulan (harga promo pembuka) — 30 hari per aktivasi
          </p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-700">
            <li>✓ Proyek dan footnote tanpa batas</li>
            <li>✓ Google Doc per proyek di Drive Anda sendiri</li>
            <li>✓ Chat agen AI di dalam web</li>
            <li>✓ Proyek gratis lama Anda ikut terbuka fitur premiumnya</li>
            <li>✓ Jaminan admin: laporan kendala distandarkan beres ≤ 6 jam; kegagalan sistem yang terbukti berarti dana kembali penuh secara manual</li>
          </ul>
          <p className="mt-4 rounded-xl bg-parchment-100 px-4 py-3 text-[13px] leading-relaxed text-ink-700">
            Premium saat ini diaktifkan melalui <strong>kunci premium</strong> dari pemilik.
            Pembayaran QRIS sedang disiapkan dan akan diumumkan di halaman ini begitu aktif —
            selama belum aktif, tidak ada dana yang bisa diambil dari Anda lewat situs ini.
          </p>
        </div>
      </div>

      <p className="mt-6 text-sm text-ink-600">
        Aturan lengkapnya ada di{" "}
        <Link href="/ketentuan" className="font-semibold text-gold-700 underline decoration-gold-400/50 underline-offset-2 hover:text-gold-600">
          Ketentuan Layanan
        </Link>
        , dan cara kami memperlakukan data Anda di{" "}
        <Link href="/privasi" className="font-semibold text-gold-700 underline decoration-gold-400/50 underline-offset-2 hover:text-gold-600">
          Kebijakan Privasi
        </Link>
        .
      </p>
    </section>
  );
}
