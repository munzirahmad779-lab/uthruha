import type { Metadata } from "next";
import Link from "next/link";
import { AlatFrasa } from "@/components/alat/frasa";
import { AlatOrtografi } from "@/components/alat/ortografi";
import { AlatSidang } from "@/components/alat/sidang";
import { AlatSitasi } from "@/components/alat/sitasi";
import { AlatTransliterasi } from "@/components/alat/transliterasi";
import { IconArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Alat gratis",
  description:
    "Pemeriksa ortografi Arab, transliterasi dua arah, penyusun sitasi gaya kitab, bank frasa akademik, dan simulasi pertanyaan sidang — tanpa akun.",
};

const NAV = [
  { href: "#ortografi", label: "Ortografi" },
  { href: "#transliterasi", label: "Transliterasi" },
  { href: "#sitasi", label: "Sitasi" },
  { href: "#frasa", label: "Bank frasa" },
  { href: "#sidang", label: "Sidang" },
];

export default function AlatPage() {
  return (
    <div className="wrap py-10 sm:py-14">
      <header className="max-w-2xl">
        <span className="eyebrow">Alat</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.6rem]">
          Lima alat yang bisa dipakai sekarang, tanpa akun.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
          Semua berjalan di peramban Anda. Tidak ada teks yang dikirim ke server, dan tidak ada
          kuota yang perlu dibeli.
        </p>
      </header>

      <nav
        aria-label="Daftar alat"
        className="no-scrollbar sticky top-16 z-20 -mx-1 mt-6 flex gap-1 overflow-x-auto border-y border-ink-900/10 bg-parchment-50/95 px-1 py-2 backdrop-blur"
      >
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-ink-900/5 hover:text-ink-900"
          >
            {n.label}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-16">
        <AlatOrtografi />
        <AlatTransliterasi />
        <AlatSitasi />
        <AlatFrasa />
        <AlatSidang />
      </div>

      <div className="mt-16 rounded-2xl border border-ink-900/10 bg-parchment-100/70 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-ink-900">
          Ingin kerangka naskah lengkap, bukan hanya alat lepas?
        </h2>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-700">
          Buat proyek: struktur lima bab, target kata per bagian, penyusun draf, kamus istilah,
          dan ekspor .docx dalam satu ruang kerja.
        </p>
        <Link href="/mulai" className="btn-primary mt-5">
          Mulai proyek
          <IconArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
