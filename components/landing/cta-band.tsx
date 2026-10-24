import Link from "next/link";

export function CtaBand() {
  return (
    <section className="wrap py-16 sm:py-20">
      <div className="rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 p-8 text-center text-white">
        <h2 className="text-2xl font-bold">Siap menulis?</h2>
        <p className="mt-2 text-gold-100">
          Buat proyek pertama Anda sekarang, atau coba fitur Khalfiyah Al-Bahts yang baru.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/mulai" className="px-6 py-3 bg-white text-gold-700 rounded-lg font-semibold hover:bg-gold-50">
            Mulai proyek
          </Link>
          <Link href="/khalfiyah" className="px-6 py-3 bg-gold-700 text-white rounded-lg font-semibold hover:bg-gold-800">
            Susun Khalfiyah
          </Link>
        </div>
      </div>
    </section>
  );
}
