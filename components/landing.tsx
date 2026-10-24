import Link from "next/link";
import { FRASA } from "@/lib/content/frasa";
import { JURNAL } from "@/lib/content/jurnal";
import { STRUKTUR } from "@/lib/content/struktur";
import { KARYA_LABEL } from "@/lib/content/types";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconBook,
  IconCheck,
  IconCompass,
  IconDoc,
  IconLayers,
  IconList,
  IconPen,
  IconQuote,
  IconScale,
  IconSearch,
  IconShield,
  IconSparkle,
  IconTarget,
  IconTranslate,
} from "@/components/icons";

/* ------------------------------------------------------------------ Hero */

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 pattern-geo opacity-[0.25]" />
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-gold-200/40 blur-3xl" />
        <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-ink-200/40 blur-3xl" />
      </div>

      <div className="wrap grid gap-14 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div className="animate-rise">
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
            Ruang kerja karya ilmiah berbahasa Arab
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.12] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">
            Dari topik yang masih kabur, jadi naskah Arab yang{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">siap dibimbing.</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-3 bg-gold-300/60" />
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-700 sm:text-base">
            Skripsi, tesis, disertasi, dan artikel jurnal berbahasa Arab punya aturan
            mainnya sendiri: struktur <span className="font-arabic">الباب الأول</span>…,
            istilah yang harus konsisten, ortografi yang tidak ditangkap pemeriksa ejaan,
            dan sitasi gaya <span className="font-arabic">الحواشي</span>. Uthruha
            menyiapkan kerangkanya — Anda yang mengisi datanya.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/mulai" className="btn-gold">
              Mulai proyek pertama
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/alat" className="btn-ghost">
              Coba alat gratis
              <IconArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-600">
            {[
              "Tanpa akun, tanpa langganan",
              "Data tersimpan di peramban Anda",
              "Ekspor .docx siap RTL",
            ].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <IconCheck className="h-3.5 w-3.5 text-gold-600" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative animate-rise lg:justify-self-end">
          <div className="absolute -right-2 -top-5 z-20 hidden rounded-full border border-gold-500/40 bg-parchment-50 px-3 py-1 text-[11px] font-semibold text-ink-700 shadow-card sm:block">
            <span className="font-arabic">خلفية البحث</span> · 900 kata
          </div>
          <div className="absolute -left-3 bottom-16 z-20 hidden rounded-full border border-ink-900/10 bg-white px-3 py-1 text-[11px] font-semibold text-ink-700 shadow-card sm:block">
            همزة · ة / ت · مراجع
          </div>

          <div className="card relative w-full max-w-md overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-ink-900/10 bg-parchment-100/80 px-5 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-600">
                مسودة البحث
              </span>
              <span className="chip !border-gold-500/30 !bg-gold-100/60 !text-ink-700">
                <IconSparkle className="h-3.5 w-3.5" /> tesis · kualitatif
              </span>
            </div>

            <div className="px-5 py-5">
              <p className="body-ar text-[15px] leading-loose" dir="rtl">
                إِنَّ الحمد لله، والصلاة والسلام على رسول الله. أمّا بعد، فإنّ موضوع{" "}
                <span className="rounded bg-gold-200/50 px-1">تعليم اللغة العربية</span>{" "}
                من الموضوعات التي تستحق النظر العلمي المتأنّي، لما يترتب عليها من آثار
                مباشرة في واقع المتعلمين…
              </p>
              <div className="mt-5 space-y-2.5">
                {[
                  { ar: "خلفية البحث", kata: "٩٠٠", isi: 100 },
                  { ar: "تحديد المشكلة", kata: "٢٢٠", isi: 100 },
                  { ar: "الإطار النظري", kata: "١١٠٠", isi: 62 },
                  { ar: "الدراسات السابقة", kata: "٩٠٠", isi: 18 },
                ].map((r) => (
                  <div key={r.ar} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-right font-arabic text-[13px] text-ink-800" dir="rtl">
                      {r.ar}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900/10">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300"
                        style={{ width: `${r.isi}%` }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-left text-[10px] font-medium text-ink-500">
                      {r.kata} kata
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-ink-900/10 bg-ink-900 px-5 py-3 text-[11px] text-parchment-200/80">
              <span className="inline-flex items-center gap-1.5">
                <IconShield className="h-3.5 w-3.5 text-gold-300" />
                Setiap klaim perlu sumber asli
              </span>
              <span className="font-arabic text-parchment-100">أُطروحة</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Masalah */

const MASALAH = [
  {
    ikon: IconList,
    judul: "Template babnya tidak sama",
    ar: "هيكل البحث",
    isi: "Panduan penulisan umum memakai Chapter 1–5. Naskah Arab memakai الباب الأول sampai الباب الخامس, dengan bagian مثل خلفية البحث dan تحديد المصطلحات yang tidak punya padanan langsung.",
  },
  {
    ikon: IconTranslate,
    judul: "Istilah berubah di tiap bab",
    ar: "اتساق المصطلحات",
    isi: "Satu istilah Indonesia diterjemahkan jadi tiga bentuk Arab yang berbeda di bab I, III, dan IV. Penguji akan menanyakannya satu per satu.",
  },
  {
    ikon: IconSearch,
    judul: "Pemeriksa ejaan tidak menolong",
    ar: "الإملاء",
    isi: "Kesalahan ة/ه, hamzah, dan tanda baca Arab lolos dari Word. Yang tertangkap justru kata asing yang sebenarnya benar.",
  },
  {
    ikon: IconQuote,
    judul: "Sitasi Arab punya aturannya",
    ar: "الحواشي والمراجع",
    isi: "Catatan kaki menyebut تحقيق، الطبعة، ج، dan ص — bukan hanya penulis–tahun. Daftar rujukan juga diurutkan dengan kaidah Arab.",
  },
];

export function Masalah() {
  return (
    <section className="wrap py-16 sm:py-20">
      <div className="max-w-2xl">
        <span className="eyebrow">Kenapa dibuat</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.4rem]">
          Masalahnya jarang pada bahasa Arabnya.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-700">
          Sebagian besar mahasiswa sudah bisa membaca dan menulis Arab. Yang membuat
          naskah tertahan adalah hal-hal teknis yang tidak diajarkan seragam: struktur
          bab, konsistensi istilah, ortografi, dan sitasi.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {MASALAH.map((m) => (
          <div key={m.judul} className="card group p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-gold-300">
                <m.ikon className="h-5 w-5" />
              </span>
              <span className="font-arabic text-sm text-ink-400" dir="rtl">
                {m.ar}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink-900">{m.judul}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{m.isi}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Cara kerja */

const LANGKAH = [
  {
    no: "٠١",
    judul: "Petakan topik",
    ar: "تحديد الموضوع",
    isi: "Jawab lima pertanyaan pemicu: jenis karya, bidang, metode, fenomena, dan lokasi penelitian. Hasilnya menjadi konteks kerja Anda.",
    tautan: "/mulai",
    label: "Mulai proyek",
  },
  {
    no: "٠٢",
    judul: "Susun struktur",
    ar: "بناء الهيكل",
    isi: "Struktur bab tersusun otomatis mengikuti jenis karya dan metode — termasuk bagian yang hanya berlaku untuk kuantitatif.",
    tautan: "/panduan#struktur",
    label: "Lihat struktur",
  },
  {
    no: "٠٣",
    judul: "Tulis per bagian",
    ar: "الكتابة",
    isi: "Setiap bagian punya panduan, pertanyaan pemicu, target kata, dan pola kalimat akademik Arab yang bisa Anda adaptasi.",
    tautan: "/proyek",
    label: "Buka ruang kerja",
  },
  {
    no: "٠٤",
    judul: "Periksa & ekspor",
    ar: "المراجعة والتصدير",
    isi: "Cek ortografi, konsistensi istilah, dan sitasi. Lalu unduh sebagai .docx berformat RTL yang bisa langsung diedit di Word.",
    tautan: "/alat#ortografi",
    label: "Coba pemeriksa",
  },
];

export function CaraKerja() {
  return (
    <section id="cara-kerja" className="border-y border-ink-900/10 bg-parchment-100/60">
      <div className="wrap py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <span className="eyebrow">Cara kerja</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.4rem]">
              Empat langkah, satu naskah.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-600">
            Semua modul memakai konteks proyek yang sama, jadi Anda tidak perlu
            menjelaskan ulang penelitian Anda setiap kali berpindah bagian.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {LANGKAH.map((l) => (
            <div key={l.no} className="relative rounded-2xl border border-ink-900/10 bg-white/70 p-6">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl font-semibold text-gold-600">{l.no}</span>
                <span className="font-arabic text-xs text-ink-400" dir="rtl">
                  {l.ar}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-ink-900">{l.judul}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-700">{l.isi}</p>
              <Link
                href={l.tautan}
                className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-ink-700 hover:text-gold-600"
              >
                {l.label}
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Fitur */

const FITUR = [
  {
    ikon: IconLayers,
    judul: "Struktur bab versi Arab",
    ar: "هيكل الأبواب",
    isi: "Lima bab dengan sub-bagian berbahasa Arab, target kata per bagian, dan penanda bagian yang butuh data lapangan.",
    href: "/panduan#struktur",
  },
  {
    ikon: IconPen,
    judul: "Bank frasa akademik",
    ar: "عبارات أكاديمية",
    isi: `${FRASA.length} pola kalimat Arab untuk membuka, membandingkan, menyimpulkan, dan mengutip — sudah dipetakan per bagian naskah.`,
    href: "/alat#frasa",
  },
  {
    ikon: IconSearch,
    judul: "Pemeriksa ortografi",
    ar: "تدقيق إملائي",
    isi: "Menangkap ة/ه, hamzah yang hilang, kata terulang, spasi sebelum tanda baca, dan tanda baca Latin di dalam teks Arab.",
    href: "/alat#ortografi",
  },
  {
    ikon: IconTranslate,
    judul: "Transliterasi dua arah",
    ar: "النقل الحرفي",
    isi: "Nama dan istilah Latin ke huruf Arab (dan sebaliknya), dengan mode akademik untuk istilah dan mode fonetis untuk nama Indonesia.",
    href: "/alat#transliterasi",
  },
  {
    ikon: IconBook,
    judul: "Kamus istilah & konsistensi",
    ar: "اتساق المصطلحات",
    isi: "Tetapkan satu padanan Arab untuk tiap istilah, lalu periksa apakah naskah Anda memakai padanan lain di bagian lain.",
    href: "/proyek",
  },
  {
    ikon: IconQuote,
    judul: "Sitasi & daftar rujukan",
    ar: "التوثيق",
    isi: "Kutipan dalam teks, catatan kaki gaya kitab, dan daftar rujukan terurut kaidah Arab — dari data yang Anda masukkan sendiri.",
    href: "/alat#sitasi",
  },
  {
    ikon: IconCompass,
    judul: "Pemadu jurnal",
    ar: "مطابقة المجلات",
    isi: `${JURNAL.length} jurnal Arab dan kajian Islam, dicocokkan dengan kata kunci naskah Anda, lengkap dengan catatan yang perlu dicek.`,
    href: "/jurnal",
  },
  {
    ikon: IconTarget,
    judul: "Simulasi sidang",
    ar: "أسئلة المناقشة",
    isi: "Pertanyaan penguji yang realistis — dalam bahasa Indonesia dan Arab — beserta bukti naskah yang harus Anda tunjukkan.",
    href: "/alat#sidang",
  },
  {
    ikon: IconDoc,
    judul: "Ekspor .docx RTL",
    ar: "تصدير الملف",
    isi: "Unduh naskah sebagai .docx berarah kanan-ke-kiri, siap diedit di Word tanpa memasang font atau pengaturan tambahan.",
    href: "/proyek",
  },
];

export function Fitur() {
  return (
    <section id="fitur" className="wrap py-16 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <span className="eyebrow">Fitur</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.4rem]">
            Alat yang memang dibuat untuk naskah Arab.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-ink-600">
          Bukan terjemahan dari alat berbahasa Inggris. Setiap modul mengikuti konvensi
          penulisan yang dipakai di program studi berbahasa Arab.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FITUR.map((f) => (
          <Link
            key={f.judul}
            href={f.href}
            className="card group flex flex-col p-6 transition hover:-translate-y-0.5 hover:border-gold-500/40 hover:shadow-lift"
          >
            <div className="flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-parchment-200 text-ink-800 transition group-hover:bg-ink-900 group-hover:text-gold-300">
                <f.ikon className="h-5 w-5" />
              </span>
              <span className="font-arabic text-xs text-ink-400" dir="rtl">
                {f.ar}
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-bold text-ink-900">{f.judul}</h3>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-700">{f.isi}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-gold-600 opacity-0 transition group-hover:opacity-100">
              Buka <IconArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Struktur */

export function StrukturSection() {
  const kartu = [
    { jenis: "skripsi" as const, kata: "≈ 8.000–15.000" },
    { jenis: "tesis" as const, kata: "≈ 18.000–30.000" },
    { jenis: "disertasi" as const, kata: "≈ 40.000–70.000" },
    { jenis: "jurnal" as const, kata: "4.000–8.000" },
  ];

  return (
    <section id="struktur" className="border-y border-ink-900/10 bg-ink-950 text-parchment-100">
      <div className="wrap py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <span className="eyebrow !text-gold-300">Struktur</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[2.4rem]">
              Satu kerangka, empat jenjang.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-parchment-200/70">
              Semua struktur mengikuti urutan bab yang lazim di perguruan tinggi
              keislaman. Bedanya pada kedalaman, cakupan teori, dan bobot pembahasan —
              bukan pada nama babnya.
            </p>
          </div>
          <Link
            href="/panduan#struktur"
            className="inline-flex items-center gap-1.5 rounded-xl border border-parchment-200/25 px-4 py-2.5 text-xs font-semibold text-parchment-100 hover:border-gold-300/60 hover:text-gold-200"
          >
            Bandingkan detailnya
            <IconArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kartu.map(({ jenis, kata }) => {
            const st = STRUKTUR[jenis];
            return (
              <div
                key={jenis}
                className="rounded-2xl border border-parchment-200/15 bg-white/[0.04] p-5"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-parchment-100">{st.labelId}</h3>
                  <span className="font-arabic text-xs text-gold-300" dir="rtl">
                    {st.labelAr}
                  </span>
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-parchment-200/45">
                  {KARYA_LABEL[jenis].jenjang} · {kata} kata
                </p>
                <div className="my-4 h-px bg-parchment-200/10" />
                <ul className="space-y-2">
                  {st.chapters.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gold-400" />
                      <span className="font-arabic text-[12px] leading-relaxed text-parchment-200/80" dir="rtl">
                        {c.labelAr}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] text-parchment-200/50">{st.rentang}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Frasa demo */

const CONTOH_FRASA = ["khalfiya-02", "masalah-01", "munazara-02", "khulasah-01"];

export function FrasaPreview() {
  const contoh = CONTOH_FRASA.map((id) => FRASA.find((f) => f.id === id)).filter(Boolean);
  return (
    <section className="wrap py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <span className="eyebrow">Bank frasa</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.4rem]">
            Kalimat yang memang dipakai di naskah Arab.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-700">
            {FRASA.length} pola kalimat akademik, dipetakan ke bagian naskah: pembuka
            latar belakang, rumusan masalah, celah penelitian, analisis data, sampai
            kesimpulan. Setiap pola dilengkapi terjemahan Indonesia agar Anda tahu
            persis apa yang Anda pakai.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["pembuka", "kesenjangan", "metodologi", "statistik", "kutipan", "etika"].map((t) => (
              <span key={t} className="chip">
                #{t}
              </span>
            ))}
          </div>
          <Link href="/alat#frasa" className="btn-primary mt-8">
            Telusuri semua frasa
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="space-y-3">
          {contoh.map((f) => (
            <figure key={f!.id} className="card p-5">
              <blockquote dir="rtl" className="font-naskh text-[16px] leading-loose text-ink-900">
                {f!.ar}
              </blockquote>
              <figcaption className="mt-3 border-t border-dashed border-ink-900/10 pt-3 text-[12px] leading-relaxed text-ink-600">
                <span className="font-semibold uppercase tracking-wider text-gold-600">
                  {f!.section}
                </span>{" "}
                — {f!.arti}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Jurnal preview */

export function JurnalPreview() {
  const tampil = [
    JURNAL.find((j) => j.id === "al-jamiah") ?? JURNAL[0],
    JURNAL.find((j) => j.id === "studia-islamika") ?? JURNAL[1],
    JURNAL.find((j) => j.id.includes("arabiyat")) ?? JURNAL[2],
    JURNAL.find((j) => j.id.includes("ijaz")) ?? JURNAL[3],
  ];

  return (
    <section className="wrap pb-16 sm:pb-20">
      <div className="panel overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <span className="eyebrow">Direktori jurnal</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Sebelum mengirim naskah, cek dulu tujuannya.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-700">
              {JURNAL.length} jurnal yang menerima atau lazim memuat naskah berbahasa
              Arab. Pemadu mencocokkan kata kunci naskah Anda dengan cakupan jurnal —
              lalu Anda memutuskan sendiri setelah membaca laman resminya.
            </p>
            <Link href="/jurnal" className="btn-ghost mt-6">
              Buka direktori
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-2.5">
            {tampil.filter(Boolean).map((j) => (
              <div
                key={j!.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-ink-900/10 bg-white/80 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink-900">{j!.namaLatin}</p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-500">{j!.penerbit}</p>
                </div>
                <span className="shrink-0 rounded-full bg-ink-900/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">
                  {j!.indeks[0] ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="border-t border-ink-900/10 bg-white/50 px-6 py-3 text-[11px] leading-relaxed text-ink-500">
          Data direktori bersifat indikatif dan berubah dari waktu ke waktu. Selalu
          verifikasi cakupan, biaya, dan indeks pada laman resmi jurnal sebelum mengirim
          naskah.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Integritas */

const TIDAK = [
  "Tidak menuliskan naskah Anda dari nol, lalu Anda tinggal menyalinnya.",
  "Tidak menggantikan bimbingan dosen pembimbing atau keputusan penguji.",
  "Tidak mengarang sumber, DOI, atau kutipan yang tidak pernah Anda baca.",
  "Tidak mengirim naskah atas nama Anda ke jurnal mana pun.",
];

const YA = [
  "Menyediakan kerangka, panduan, dan pola kalimat untuk Anda kembangkan.",
  "Menandai bagian yang masih butuh data lapangan Anda sendiri.",
  "Membantu merapikan ortografi, istilah, dan sitasi yang sudah Anda masukkan.",
  "Menyimpan draf di peramban Anda — bukan di server kami.",
];

export function Integritas() {
  return (
    <section className="border-y border-ink-900/10 bg-parchment-100/70">
      <div className="wrap grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <span className="eyebrow">Integritas akademik</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.4rem]">
            Alat bantu, bukan jasa pembuatan karya.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-700">
            Naskah yang baik lahir dari data dan penalaran Anda. Uthruha mengambil beban
            teknis penulisan — bukan beban berpikirnya.
          </p>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gold-500/30 bg-gold-100/50 p-4">
            <IconScale className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
            <p className="text-[13px] leading-relaxed text-ink-800">
              Mahasiswa dan pembimbing sama-sama bisa memeriksa: setiap bagian naskah
              berasal dari kerangka yang sama, dan sitasi harus bisa dilacak ke sumber
              aslinya. Kalau tidak bisa dilacak, jangan dipakai.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-600">
              Yang dilakukan
            </h3>
            <ul className="mt-4 space-y-3">
              {YA.map((t) => (
                <li key={t} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-800">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-white/60 p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-600">
              Yang tidak dilakukan
            </h3>
            <ul className="mt-4 space-y-3">
              {TIDAK.map((t) => (
                <li key={t} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-700">
                  <span className="mt-2 h-1 w-3 shrink-0 rounded bg-ink-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- CTA band */

export function CtaBand() {
  return (
    <section className="wrap py-16 sm:py-20">
      <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 text-center sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute inset-0 pattern-geo opacity-[0.12]" />
        <p className="relative font-arabic text-2xl text-gold-300 sm:text-3xl" dir="rtl">
          ابدأ بحثك بخطوة واحدة
        </p>
        <h2 className="relative mx-auto mt-4 max-w-2xl text-2xl font-extrabold leading-snug tracking-tight text-parchment-50 sm:text-4xl">
          Mulai dari satu bagian hari ini, bukan dari halaman kosong.
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-parchment-200/75">
          Buat proyek, pilih jenjang dan metode, lalu susun draf bagian pertama dalam
          beberapa menit. Tidak perlu mendaftar.
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/mulai" className="btn-gold">
            Mulai proyek
            <IconArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/panduan"
            className="btn border border-parchment-200/25 text-parchment-100 hover:border-gold-300/60"
          >
            Baca panduan dulu
          </Link>
        </div>
      </div>
    </section>
  );
}
