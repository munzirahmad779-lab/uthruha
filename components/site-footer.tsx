import Link from "next/link";
import { BrandLockup } from "@/components/brand";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Ruang kerja",
    links: [
      { href: "/mulai", label: "Mulai proyek baru" },
      { href: "/proyek", label: "Daftar proyek" },
      { href: "/panduan", label: "Panduan penulisan" },
    ],
  },
  {
    title: "Alat",
    links: [
      { href: "/alat#ortografi", label: "Pemeriksa ortografi" },
      { href: "/alat#transliterasi", label: "Transliterasi" },
      { href: "/alat#sitasi", label: "Penyusun sitasi" },
      { href: "/alat#frasa", label: "Bank frasa akademik" },
    ],
  },
  {
    title: "Riset",
    links: [
      { href: "/jurnal", label: "Direktori jurnal" },
      { href: "/alat#sidang", label: "Simulasi sidang" },
      { href: "/panduan#struktur", label: "Struktur per jenjang" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-ink-900/10 bg-ink-950 text-parchment-200">
      <div className="wrap py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="[&_span]:!text-parchment-100">
              <BrandLockup />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-parchment-200/70">
              Ruang kerja penulisan karya ilmiah berbahasa Arab. Dibangun untuk mahasiswa
              dan peneliti yang menulis dalam bahasa Arab — bukan terjemahan mesin dari
              bahasa lain.
            </p>
            <p className="mt-5 font-arabic text-lg text-gold-300" dir="rtl">
              وَقُل رَّبِّ زِدْنِي عِلْمًا
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-parchment-200/50">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-parchment-200/75 transition hover:text-gold-200"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-parchment-200/10 pt-6 text-xs text-parchment-200/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Uthruha. Draf tetap milik penulisnya.</p>
          <p className="max-w-lg sm:text-right">
            Alat bantu penulisan — bukan pengganti pembimbing, dan bukan jasa pembuatan
            karya ilmiah. Setiap sitasi wajib diperiksa pada sumber aslinya.
          </p>
        </div>
      </div>
    </footer>
  );
}
