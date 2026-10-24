import Link from "next/link";

export function Fitur() {
  return (
    <section className="wrap py-16 sm:py-20 bg-parchment-100/50">
      <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">
        Fitur utama
      </h2>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="p-6 bg-white border border-ink-900/10 rounded-xl">
          <h3 className="font-bold text-ink-900">🆕 Khalfiyah Al-Bahts (Latar Belakang)</h3>
          <p className="mt-2 text-sm text-ink-700">
            Susun latar belakang berbasis tri-fokus: dekonstruksi judul → agregasi jurnal per
            klaster → penelusuran maraji' turats → narasi lengkap dengan research gap.
          </p>
          <Link href="/khalfiyah" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Coba fitur baru →
          </Link>
        </div>
        <div className="p-6 bg-white border border-ink-900/10 rounded-xl">
          <h3 className="font-bold text-ink-900">Bank frasa akademik</h3>
          <p className="mt-2 text-sm text-ink-700">
            Pola kalimat pembuka latar belakang, penutup bab, frasa transisi — tinggal sesuaikan
            variabelnya.
          </p>
        </div>
        <div className="p-6 bg-white border border-ink-900/10 rounded-xl">
          <h3 className="font-bold text-ink-900">Penyusun sitasi gaya kitab</h3>
          <p className="mt-2 text-sm text-ink-700">
            Format footnote yang konsisten untuk kitab kuning, jurnal, dan buku modern.
          </p>
        </div>
        <div className="p-6 bg-white border border-ink-900/10 rounded-xl">
          <h3 className="font-bold text-ink-900">Direktori jurnal Arab</h3>
          <p className="mt-2 text-sm text-ink-700">
            Daftar jurnal yang menerima naskah berbahasa Arab, lengkap dengan biaya dan status
            indeks.
          </p>
        </div>
      </div>
    </section>
  );
}
