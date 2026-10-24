import type { Metadata } from "next";
import Link from "next/link";
import { BIDANG } from "@/lib/content/bidang";
import { METODE } from "@/lib/content/metode";
import { STRUKTUR } from "@/lib/content/struktur";
import { KARYA_LABEL, type KaryaType } from "@/lib/content/types";
import { SPRINT } from "@/lib/content/panduan";
import { IconArrowRight, IconCheck, IconQuote, IconScale, IconSearch } from "@/components/icons";
import { Note } from "@/components/ui";

export const metadata: Metadata = {
  title: "Panduan penulisan Arab",
  description:
    "Struktur bab per jenjang, ketentuan format naskah Arab, kesalahan ortografi yang sering lolos, strategi istilah, gaya sitasi, dan etika penggunaan alat bantu.",
};

const ORTOGRAFI = [
  ["انشاء الله", "إن شاء الله", "Hamzah kasrah pada إن، dan penulisan terpisah"],
  ["القران", "القرآن", "Alif mamdudah (آ)"],
  ["مسالة", "مسألة", "Hamzah pada مسألة"],
  ["مدرسه", "مدرسة", "Ta marbuta, bukan ha"],
  ["الذى", "الذي", "Nama huruf ya ditulis ي"],
  ["هاذا", "هذا", "Tanpa alif setelah ha"],
  ["الاسلام", "الإسلام", "Hamzah kasrah setelah alif lam"],
  ["الاخرة", "الآخرة", "Alif mamdudah"],
  ["هؤلا", "هؤلاء", "Hamzah + alif mamdudah"],
  ["باذن الله", "بإذن الله", "Hamzah kasrah pada إذن"],
];

const FORMAT = [
  { label: "Jenis huruf", nilai: "Traditional Arabic, Sakkal Majalla, atau Amiri (konsisten satu naskah)." },
  { label: "Ukuran", nilai: "16–18 pt untuk badan teks; catatan kaki 12 pt." },
  { label: "Spasi", nilai: "1,5 untuk badan teks; spasi tunggal untuk kutipan panjang dan tabel." },
  { label: "Margin", nilai: "Umumnya 4 cm sisi jilid dan 3 cm sisi lain — periksa pedoman kampus." },
  { label: "Perataan", nilai: "Justify (ضبط) dengan indentasi baris pertama; judul bab rata tengah." },
  { label: "Angka", nilai: "Banyak kampus meminta angka Arab-Indic ٠١٢٣٤٥٦٧٨٩; sebagian menerima angka Latin." },
  { label: "Penomoran", nilai: "BAB memakai أرقام رومانية atau huruf; daftar isi menyesuaikan." },
  { label: "Istilah asing", nilai: "Ditulis Latin dalam kurung, miring, dan tidak diterjemahkan berulang." },
  { label: "Transliterasi", nilai: "Pilih satu pedoman (mis. pedoman kampus atau Library of Congress) dan pakai sampai selesai." },
  { label: "Tanda baca", nilai: "، ؛ ؟ « » — bukan , ; ? \" \" di dalam teks Arab." },
];

const SITASI_CONTOH = [
  {
    judul: "Catatan kaki kitab",
    ar: "القرطبي، الجامع لأحكام القرآن، تحقيق أحمد البردوني، (القاهرة: دار الكتب المصرية، ١٩٦٤)، ج ١، ص ٢٣.",
    id: "Pertama kali menyebut: lengkap. Penyebutan berikutnya cukup nama keluarga, judul singkat, dan halaman.",
  },
  {
    judul: "Kutipan dalam teks",
    ar: "(القرطبي، ١٩٦٤، ٢٣)",
    id: "Dipakai bila kampus Anda meminta gaya kurung, bukan catatan kaki.",
  },
  {
    judul: "Artikel jurnal",
    ar: "محمد، أحمد. «تعليم اللغة العربية في المعاهد». مجلة الدراسات الإسلامية، مج ١٢، ع ٢ (٢٠٢٠): ٤٥–٦٨.",
    id: "Nama jurnal, volume, nomor, dan rentang halaman wajib lengkap.",
  },
];

const ETIKA = [
  {
    judul: "Yang boleh dibantu alat",
    isi: [
      "Menyusun kerangka dan urutan argumen.",
      "Menemukan pola kalimat akademik yang lazim.",
      "Merapikan ortografi, tanda baca, dan konsistensi istilah.",
      "Memeriksa kelengkapan format sitasi dari data yang Anda masukkan.",
    ],
  },
  {
    judul: "Yang tetap milik Anda",
    isi: [
      "Data lapangan, hasil pengolahan, dan interpretasinya.",
      "Keputusan teoretis: mengapa teori ini, bukan teori itu.",
      "Kutipan: hanya yang benar-benar Anda baca dan pahami.",
      "Kesimpulan yang harus konsisten dengan rumusan masalah.",
    ],
  },
  {
    judul: "Yang tidak boleh",
    isi: [
      "Menyerahkan seluruh naskah pada alat lalu mengakuinya sebagai karya sendiri.",
      "Mengarang sumber, DOI, atau angka statistik.",
      "Menyalin kalimat dari karya lain tanpa sitasi.",
      "Mengubah data agar sesuai hipotesis.",
    ],
  },
];

export default function PanduanPage() {
  const kartu: KaryaType[] = ["skripsi", "tesis", "disertasi", "jurnal"];

  return (
    <div className="wrap py-10 sm:py-14">
      <header className="max-w-2xl">
        <span className="eyebrow">Panduan</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.6rem]">
          Panduan menulis karya ilmiah berbahasa Arab
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
          Rangkuman praktik yang lazim dipakai: struktur bab, format naskah, ortografi, istilah,
          sitasi, dan batas penggunaan alat bantu. Ini bukan pengganti pedoman resmi program studi
          Anda — selalu periksa dokumen yang berlaku di kampus.
        </p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-1.5">
        {[
          ["#struktur", "Struktur"],
          ["#format", "Format naskah"],
          ["#ortografi", "Ortografi"],
          ["#istilah", "Istilah"],
          ["#sitasi", "Sitasi"],
          ["#etika", "Etika"],
          ["#sidang", "Sidang"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-ink-900/15 bg-white/70 px-3 py-1 text-[11px] font-semibold text-ink-600 hover:border-gold-500 hover:text-gold-700"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Struktur */}
      <section id="struktur" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Struktur per jenjang</h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-600">
          Urutan bab hampir sama; yang berubah adalah kedalaman teori, ketatnya uji, dan bobot
          kontribusi. Artikel jurnal memakai IMRaD versi Arab, tanpa pembagian bab.
        </p>

        <div className="mt-5 overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-ink-900/15 text-left">
                <th className="py-2 pe-3 font-semibold text-ink-600">Bagian</th>
                {kartu.map((k) => (
                  <th key={k} className="px-3 py-2 font-semibold text-ink-900">
                    {KARYA_LABEL[k].id}
                    <span className="mt-0.5 block text-[10px] font-normal text-ink-500">
                      {STRUKTUR[k].rentang}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-ink-900/5 align-top">
                  <td className="py-2.5 pe-3 font-arabic text-[13px] text-ink-800" dir="rtl">
                    {STRUKTUR.skripsi.chapters[i]?.babAr ?? "—"}
                    <span className="mt-0.5 block font-sans text-[10px] text-ink-500" dir="ltr">
                      {["Pendahuluan", "Kerangka teori", "Metode", "Hasil & pembahasan", "Penutup"][i]}
                    </span>
                  </td>
                  {kartu.map((k) => {
                    const ch = STRUKTUR[k].chapters[i];
                    return (
                      <td key={k} className="px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-700">
                        {ch ? (
                          <span className="font-arabic text-[12.5px] text-ink-900" dir="rtl">
                            {ch.labelAr.split(":")[1]?.trim() ?? ch.labelAr}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                        {ch && (
                          <ul className="mt-1 space-y-0.5">
                            {ch.sections.slice(0, 4).map((s) => (
                              <li key={s.id} className="text-[10.5px] text-ink:500" dir="rtl">
                                <span className="font-arabic text-[11px] text-ink-500">{s.headingAr}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kartu.map((k) => (
            <div key={k} className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
              <p className="text-[12px] font-bold text-ink-900">{KARYA_LABEL[k].id}</p>
              <p className="mt-1 text-[11px] italic text-ink-500">{STRUKTUR[k].deskripsi}</p>
              <p className="mt-2 text-[11px] text-ink-600">
                {(STRUKTUR[k].chapters.reduce((a, c) => a + c.sections.length, 0))} sub-bagian ·{" "}
                {STRUKTUR[k].rentang}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Format */}
      <section id="format" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Ketentuan format naskah
        </h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-600">
          Nilai di bawah adalah praktik umum, bukan standar tunggal. Bila pedoman kampus berbeda,
          pedoman kampus yang berlaku.
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-ink-900/10 bg-white/70">
          <dl className="divide-y divide-ink-900/5">
            {FORMAT.map((f) => (
              <div key={f.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  {f.label}
                </dt>
                <dd className="text-[12.5px] leading-relaxed text-ink-800">{f.nilai}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Ortografi */}
      <section id="ortografi" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Ortografi yang sering lolos
        </h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-600">
          Sepuluh pola yang paling sering ditemukan di draf mahasiswa. Pemeriksa ejaan Word
          biasanya tidak menandainya.
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-ink-900/10 bg-white/70">
          <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2 border-b border-ink-900/10 bg-parchment-100/70 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-500">
            <span>Salah</span>
            <span>Benar</span>
            <span>Alasan</span>
          </div>
          <div className="divide-y divide-ink-900/5">
            {ORTOGRAFI.map(([salah, benar, alasan]) => (
              <div key={salah} className="grid grid-cols-[1fr_1fr_1.4fr] items-center gap-2 px-4 py-2.5">
                <span dir="rtl" className="text-right font-naskh text-[15px] text-red-800 line-through decoration-red-300">
                  {salah}
                </span>
                <span dir="rtl" className="text-right font-naskh text-[15px] text-emerald-800">
                  {benar}
                </span>
                <span className="text-[11.5px] leading-relaxed text-ink-700">{alasan}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href="/alat#ortografi" className="btn-ghost !py-2.5 !text-[12.5px]">
            <IconSearch className="h-4 w-4" /> Periksa naskah Anda sekarang
          </Link>
          <span className="text-[11px] text-ink-500">
            Alat menangkap pola di atas secara otomatis, termasuk tanda baca.
          </span>
        </div>
      </section>

      {/* Istilah */}
      <section id="istilah" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Menjaga istilah tetap satu bentuk
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <ol className="space-y-2.5">
            {[
              "Daftarkan istilah kunci dari judul dan rumusan masalah — biasanya 5–10 istilah.",
              "Pilih satu padanan Arab untuk setiap istilah, lalu tulis di daftar istilah karya Anda.",
              "Pada penyebutan pertama, tulis padanan Arab diikuti istilah aslinya dalam kurung.",
              "Setelah itu, pakai bentuk yang sama tanpa variasi sinonim.",
              "Bila terpaksa memakai sinonim, nyatakan alasannya di catatan kaki.",
            ].map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-900 text-[10px] font-bold text-parchment-100">
                  {i + 1}
                </span>
                <span className="text-[13px] leading-relaxed text-ink-800">{t}</span>
              </li>
            ))}
          </ol>
          <div className="rounded-2xl border border-ink-900/10 bg-parchment-100/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
              Contoh istilah per bidang
            </p>
            <ul className="mt-2 space-y-1.5">
              {BIDANG.slice(0, 5).map((b) => (
                <li key={b.id} className="text-[11.5px] text-ink-700">
                  <span className="font-semibold">{b.labelId}:</span>{" "}
                  <span className="font-arabic" dir="rtl">
                    {b.teori[0]?.ar}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/proyek" className="btn-quiet mt-3 !px-0">
              Kelola di kamus istilah <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Sitasi */}
      <section id="sitasi" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Gaya sitasi</h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-600">
          Dua gaya yang paling sering diminta: catatan kaki (الحواشي) dan kutipan dalam teks.
          Jangan mencampur keduanya dalam satu naskah.
        </p>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {SITASI_CONTOH.map((s) => (
            <div key={s.judul} className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold-700">
                <IconQuote className="h-3.5 w-3.5" /> {s.judul}
              </p>
              <p dir="rtl" className="mt-2 font-naskh text-[14px] leading-loose text-ink-900">
                {s.ar}
              </p>
              <p className="mt-2 border-t border-dashed border-ink-900/10 pt-2 text-[11px] leading-relaxed text-ink-600">
                {s.id}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Etika */}
      <section id="etika" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Batas penggunaan alat bantu
        </h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {ETIKA.map((e, i) => (
            <div
              key={e.judul}
              className={`rounded-2xl border p-4 ${
                i === 2
                  ? "border-red-500/25 bg-red-50/60"
                  : i === 0
                    ? "border-gold-500/30 bg-gold-100/40"
                    : "border-ink-900/10 bg-white/70"
              }`}
            >
              <h3 className="flex items-center gap-2 text-[12px] font-bold text-ink-900">
                {i === 2 ? (
                  <IconScale className="h-4 w-4 text-red-600" />
                ) : (
                  <IconCheck className="h-4 w-4 text-gold-600" />
                )}
                {e.judul}
              </h3>
              <ul className="mt-2.5 space-y-1.5">
                {e.isi.map((t) => (
                  <li key={t} className="text-[11.5px] leading-relaxed text-ink-700">
                    • {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Note jenis="warn">
            Banyak kampus sudah memiliki aturan tertulis tentang penggunaan AI dalam skripsi.
            Baca aturan itu lebih dulu, dan bila diminta, laporkan penggunaan alat bantu dalam
            bagian ucapan terima kasih atau lampiran metodologi.
          </Note>
        </div>
      </section>

      {/* Sidang */}
      <section id="sidang" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Sebelum masuk ruang sidang
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SPRINT.map((s) => (
            <div key={s.judul} className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
              <p className="text-[12px] font-bold text-ink-900">{s.judul}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-700">{s.isi}</p>
            </div>
          ))}
        </div>
        <Link href="/alat#sidang" className="btn-ghost mt-4 !py-2.5 !text-[12.5px]">
          Latihan dengan pertanyaan penguji <IconArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      {/* Metode ringkas */}
      <section className="mt-14">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Ringkasan tiga metode
        </h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {Object.values(METODE).map((m) => (
            <div key={m.id} className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
              <p className="flex items-baseline justify-between">
                <span className="text-[12.5px] font-bold text-ink-900">{m.labelId}</span>
                <span className="font-arabic text-[12px] text-gold-700" dir="rtl">
                  {m.labelAr}
                </span>
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-600">{m.ringkas}</p>
              <ul className="mt-2 space-y-1">
                {m.analisis.slice(0, 3).map((a) => (
                  <li key={a.ar} className="text-right font-arabic text-[11.5px] text-ink-700" dir="rtl">
                    {a.ar}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 rounded-2xl bg-ink-900 p-6 text-parchment-100 sm:p-8">
        <p className="font-arabic text-xl text-gold-300" dir="rtl">
          وما توفيقي إلا بالله
        </p>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-parchment-200/80">
          Panduan ini disusun sebagai ringkasan praktik, bukan dokumen resmi. Bila ada perbedaan
          dengan pedoman program studi Anda, ikuti pedoman program studi.
        </p>
        <Link href="/mulai" className="btn-gold mt-5">
          Mulai menyusun naskah <IconArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
