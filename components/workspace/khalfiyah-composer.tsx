"use client";

import { useState } from "react";
import type { HasilKhalfiyah } from "@/lib/engine/khalfiyah";

export function KhalfiyahComposer() {
  const [judul, setJudul] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasil, setHasil] = useState<HasilKhalfiyah | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "klaster" | "kasus" | "jurnal" | "maraji" | "narasi"
  >("klaster");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim()) return;

    setLoading(true);
    setError(null);
    setHasil(null);

    try {
      const res = await fetch("/api/khalfiyah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judul: judul.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menyusun khalfiyah");
      }

      const data: HasilKhalfiyah = await res.json();
      setHasil(data);
      setActiveTab("klaster");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-arabic text-3xl font-bold text-ink-900">
          خلفية البحث (Khalfiyah Al-Bahts)
        </h1>
        <p className="text-ink-600">
          Penyusunan Latar Belakang Berbasis Tri-Fokus Judul & Referensi Berlapis
        </p>
      </div>

      {/* Form Input */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="judul"
            className="block text-sm font-medium text-ink-700 mb-2"
          >
            عنوان البحث (Judul Penelitian):
          </label>
          <textarea
            id="judul"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="مثال: تطبيق المنهج التكاملي في تعليم اللغة العربية لطلاب المدارس الثانوية بإندونيسيا"
            className="w-full px-4 py-3 border border-ink-900/15 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent text-right"
            rows={4}
            dir="rtl"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !judul.trim()}
          className="w-full py-3 px-6 bg-gold-600 text-white rounded-lg font-medium hover:bg-gold-600 disabled:bg-ink-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "جارٍ التحليل... (30-60 ثانية)" : "ابدأ التحليل"}
        </button>
      </form>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Results Display */}
      {hasil && (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="border-b border-ink-900/10">
            <nav className="flex space-x-4" aria-label="Tabs">
              {[
                { key: "klaster", label: "1. Peta 3 Klaster Masalah" },
                { key: "kasus", label: "2. Kasus Latar Belakang" },
                { key: "jurnal", label: "3. Daftar Jurnal + DOI" },
                { key: "maraji", label: "4. Rujukan Kitab Asli" },
                { key: "narasi", label: "5. Draf Khalfiyah Lengkap" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() =>
                    setActiveTab(
                      tab.key as "klaster" | "kasus" | "jurnal" | "maraji" | "narasi",
                    )
                  }
                  className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.key
                      ? "border-gold-500 text-gold-600"
                      : "border-transparent text-ink-500 hover:text-ink-700 hover:border-ink-900/15"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg border border-ink-900/10 p-6">
            {activeTab === "klaster" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-ink-900">
                  Pemetaan 3 Klaster Kunci dari Judul
                </h2>
                
                {[
                  { key: "klaster1", label: "Klaster 1", data: hasil.klaster.klaster1 },
                  { key: "klaster2", label: "Klaster 2", data: hasil.klaster.klaster2 },
                  { key: "klaster3", label: "Klaster 3", data: hasil.klaster.klaster3 },
                ].map((k) => (
                  <div key={k.key} className="p-4 bg-parchment-100/70 rounded-lg space-y-2">
                    <h3 className="font-bold text-ink-900">{k.label}: {k.data.label}</h3>
                    <p className="text-sm text-ink-600">{k.data.deskripsi}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {k.data.kalimatKunci.map((kata, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-gold-100 text-ink-800 rounded-full text-sm"
                          dir="rtl"
                        >
                          {kata}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "kasus" && (
              <div className="space-y-6">
                <div className="rounded-lg border border-gold-600/30 bg-gold-500/5 p-4">
                  <h2 className="text-lg font-bold text-ink-900">
                    Kasus Latar Belakang per Klaster
                  </h2>
                  <p className="mt-1 text-sm text-ink-700">
                    Inilah isi yang masuk ke paragraf khalfiyah. Setiap butir diambil
                    dari kalimat masalah pada abstrak artikel — bukan dikarang.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-gold-100 px-2 py-1 font-medium text-gold-600">
                      hijau = abstrak ada, masalah eksplisit
                    </span>
                    <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-800">
                      kuning = kesimpulan dari konteks
                    </span>
                    <span className="rounded bg-red-100 px-2 py-1 font-medium text-red-800">
                      merah = abstrak tidak ada, wajib cek manual
                    </span>
                  </div>
                </div>

                {hasil.paragraf
                  .filter((p) => p.bagian !== "sintesis")
                  .map((p) => {
                    const kasus = p.kasus ?? [];
                    return (
                      <div key={p.bagian} className="rounded-lg border border-ink-900/10 p-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-bold text-ink-900" dir="rtl">
                            {p.judul}
                          </h3>
                          <span className="shrink-0 rounded bg-parchment-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                            {kasus.length} kasus
                          </span>
                        </div>

                        {p.peringatan && (
                          <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            ⚠ {p.peringatan}
                          </p>
                        )}

                        {kasus.length === 0 ? (
                          <p className="mt-3 text-sm text-ink-500">
                            Tidak ada kasus yang bisa disusun dari artikel klaster ini.
                          </p>
                        ) : (
                          <ol className="mt-3 space-y-3">
                            {kasus.map((k) => (
                              <li
                                key={k.urut}
                                className="rounded border-l-4 border-l-ink-300 bg-parchment-100/70 p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-semibold text-ink-900">
                                    {k.urut}. {k.sumber}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 font-medium ${
                                      k.kekuatan === "kuat"
                                        ? "bg-gold-100 text-gold-600"
                                        : k.kekuatan === "sedang"
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {k.kekuatan.toUpperCase()}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm font-medium text-ink-800" dir="rtl">
                                  {k.arab}
                                </p>

                                <p className="mt-2 text-xs italic text-ink-600">
                                  Asli: “{k.pernyataan}”
                                </p>

                                <p className="mt-1 text-xs text-ink-500">{k.judulArtikel}</p>

                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                  {k.tautan && (
                                    <a
                                      href={k.tautan}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-gold-600 hover:underline"
                                    >
                                      Buka sumber ↗
                                    </a>
                                  )}
                                  <span className="text-ink-500">{k.catatan}</span>
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
            {activeTab === "jurnal" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-ink-900">
                  Daftar Jurnal Ilmiah per Klaster ({hasil.artikel.length} artikel)
                </h2>
                
                {[1, 2, 3].map((klasterNum) => {
                  const artikelKlaster = hasil.artikel.filter(
                    (a) => a.klaster === klasterNum,
                  );
                  if (artikelKlaster.length === 0) return null;

                  return (
                    <div key={klasterNum} className="space-y-3">
                      <h3 className="font-bold text-ink-900">
                        Klaster {klasterNum} ({artikelKlaster.length} artikel)
                      </h3>
                      {artikelKlaster.map((art, i) => (
                        <div
                          key={i}
                          className="p-4 border border-ink-900/10 rounded-lg space-y-2"
                        >
                          <h4 className="font-semibold text-ink-900">{art.judul}</h4>
                          <p className="text-sm text-ink-600">
                            <strong>Penulis:</strong> {art.penulis.join(", ") || "N/A"}
                          </p>
                          <p className="text-sm text-ink-600">
                            <strong>Jurnal:</strong> {art.namaJurnal} ({art.tahun})
                          </p>
                          {art.doi && (
                            <p className="text-sm">
                              <strong>DOI:</strong>{" "}
                              <a
                                href={art.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gold-600 hover:underline"
                              >
                                {art.doi}
                              </a>
                            </p>
                          )}
                          {art.masalahEmpiris && (
                            <div className="text-sm">
                              {art.abstrak ? (
                                <div className="bg-parchment-100/70 border-l-4 border-gold-500 p-3 rounded">
                                  <div className="flex items-start gap-2">
                                    <span className="text-gold-600 font-bold text-xs">âœ“ ABSTRAK</span>
                                    <div className="flex-1">
                                      <strong className="text-ink-800">Masalah Empiris:</strong>
                                      <p className="text-ink-700 mt-1">{art.masalahEmpiris}</p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded">
                                  <div className="flex items-start gap-2">
                                    <span className="text-amber-600 font-bold text-xs">âڑ  NO ABSTRACT</span>
                                    <div className="flex-1">
                                      <strong className="text-amber-900">Catatan:</strong>
                                      <p className="text-ink-700 mt-1">{art.masalahEmpiris}</p>
                                      <p className="text-xs text-amber-700 mt-2">
                                        Abstrak tidak tersedia di API. Klik DOI untuk membaca artikel asli.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "maraji" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-ink-900">
                  Rujukan Masadir & Kitab Asli ({hasil.maraji.length} rujukan)
                </h2>
                
                {hasil.maraji.length === 0 ? (
                  <p className="text-ink-600">
                    Tidak ada konsep turats yang teridentifikasi dalam judul ini.
                  </p>
                ) : (
                  hasil.maraji.map((m, i) => (
                    <div
                      key={i}
                      className="p-4 border border-ink-900/10 rounded-lg space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-1">
                          <h4 className="font-bold text-ink-900" dir="rtl">
                            {m.namaKitab}
                          </h4>
                          <p className="text-sm text-ink-600" dir="rtl">
                            {m.pengarang}
                            {m.jilid && ` • جزء ${m.jilid}`}
                            {m.halaman && ` • صفحة ${m.halaman}`}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-gold-100 text-gold-600 text-xs rounded">
                          {m.konsep}
                        </span>
                      </div>
                      <p className="text-sm text-ink-700 bg-parchment-100/70 p-3 rounded" dir="rtl">
                        {m.kutipan}
                      </p>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gold-600 hover:underline inline-block"
                      >
                        رابط المصدر ←
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "narasi" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-ink-900">
                  Draf Khalfiyah Al-Bahts Lengkap
                </h2>

                {/* Research Gap */}
                <div className="p-4 bg-gold-500/5 border-l-4 border-gold-500 rounded">
                  <h3 className="font-bold text-ink-800 mb-2">
                    Research Gap & Urgensi
                  </h3>
                  <p className="text-sm text-ink-800 whitespace-pre-wrap" dir="rtl">
                    {hasil.researchGap}
                  </p>
                </div>

                {/* Narasi Lengkap */}
                <div className="prose max-w-none">
                  <div
                    className="text-ink-800 leading-relaxed space-y-4 whitespace-pre-wrap"
                    dir="rtl"
                    dangerouslySetInnerHTML={{
                      __html: hasil.narasiLengkap
                        .replace(/\n/g, "<br/>")
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/^## (.*?)$/gm, "<h2 class='text-xl font-bold mt-6 mb-3'>$1</h2>")
                        .replace(/^# (.*?)$/gm, "<h1 class='text-2xl font-bold mt-8 mb-4'>$1</h1>"),
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(hasil.narasiLengkap);
                      alert("Teks berhasil disalin!");
                    }}
                    className="px-4 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-500"
                  >
                    نسخ النص
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([hasil.narasiLengkap], {
                        type: "text/plain;charset=utf-8",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "khalfiyah-al-bahts.txt";
                      a.click();
                    }}
                    className="px-4 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-600"
                  >
                    تنزيل الملف
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
