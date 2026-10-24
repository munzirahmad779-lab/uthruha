export function CaraKerja() {
  return (
    <section className="wrap py-16 sm:py-20">
      <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">Cara kerja</h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 bg-white border border-ink-900/10 rounded-xl">
          <div className="text-2xl font-bold text-gold-600">1</div>
          <h3 className="mt-3 font-bold text-ink-900">Pilih struktur</h3>
          <p className="mt-2 text-sm text-ink-700">
            Skripsi 5 bab, tesis, atau artikel IMRaD — struktur sudah tersedia lengkap dengan
            heading Arab.
          </p>
        </div>
        <div className="p-6 bg-white border border-ink-900/10 rounded-xl">
          <div className="text-2xl font-bold text-gold-600">2</div>
          <h3 className="mt-3 font-bold text-ink-900">Isi konteks</h3>
          <p className="mt-2 text-sm text-ink-700">
            Topik, metode, populasi, lokasi — lalu sistem menyusun kerangka tiap bagian sesuai
            konteks Anda.
          </p>
        </div>
        <div className="p-6 bg-white border border-ink-900/10 rounded-xl">
          <div className="text-2xl font-bold text-gold-600">3</div>
          <h3 className="mt-3 font-bold text-ink-900">Ekspor .docx</h3>
          <p className="mt-2 text-sm text-ink-700">
            Naskah lengkap dengan heading, daftar rujukan, dan format siap cetak.
          </p>
        </div>
      </div>
    </section>
  );
}
