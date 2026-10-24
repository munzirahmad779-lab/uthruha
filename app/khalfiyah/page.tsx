import type { Metadata } from "next";
import Link from "next/link";
import { KhalfiyahComposer } from "@/components/workspace/khalfiyah-composer";
import { IconArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Khalfiyah Al-Bahts - Penyusunan Latar Belakang",
  description:
    "Penyusunan Khalfiyah Al-Bahts (Latar Belakang) berbasis Tri-Fokus Judul & Referensi Berlapis dengan agregasi jurnal dan maraji' otomatis.",
};

export default function KhalfiyahPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-parchment-50 to-parchment-100 py-10 sm:py-14">
      <div className="wrap">
        <header className="max-w-3xl mx-auto text-center mb-10">
          <span className="eyebrow">خلفية البحث</span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.6rem]">
            Khalfiyah Al-Bahts
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
            Susun latar belakang penelitian secara sistematis: dekonstruksi judul menjadi 3 klaster
            kunci, agregasi jurnal ilmiah per klaster, penelusuran maraji' turats, hingga narasi
            khalfiyah lengkap dengan research gap.
          </p>
        </header>

        <KhalfiyahComposer />

        <div className="mt-16 max-w-4xl mx-auto rounded-2xl border border-ink-900/10 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold text-ink-900">Cara Kerja Fitur Ini</h2>
          <div className="mt-4 space-y-3 text-[13.5px] text-ink-700">
            <div className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                1
              </span>
              <div>
                <strong className="text-ink-900">Dekonstruksi Judul</strong>: Judul penelitian
                dibedah menjadi 3 klaster kunci (Fondasi, Metode/Variabel, Konteks/Tujuan).
              </div>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                2
              </span>
              <div>
                <strong className="text-ink-900">Agregasi Jurnal</strong>: Sistem mencari artikel
                jurnal ilmiah dari Crossref dan OpenAlex untuk setiap klaster, lengkap dengan DOI
                dan metadata.
              </div>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                3
              </span>
              <div>
                <strong className="text-ink-900">Pemetaan Masalah</strong>: Dari setiap artikel,
                diekstrak rumusan masalah empiris yang sering muncul dalam literatur.
              </div>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                4
              </span>
              <div>
                <strong className="text-ink-900">Penelusuran Maraji'</strong>: Konsep turats yang
                teridentifikasi dicari rujukannya dari Turath.io dan Shamela untuk memperkuat
                argumen.
              </div>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                5
              </span>
              <div>
                <strong className="text-ink-900">Sintesis Khalfiyah</strong>: Paragraf disusun
                secara sistematis dengan struktur: Klaster 1 → Klaster 2 → Klaster 3 → Sintesis
                (Research Gap & Urgensi).
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Catatan:</strong> Proses ini memakan waktu 30-60 detik karena mencari data
              dari beberapa API eksternal (Crossref, OpenAlex, Turath, Shamela). Hasil bersifat
              deterministik: judul yang sama akan menghasilkan output yang sama.
            </p>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
            <p className="text-sm text-blue-800">
              <strong>Tentang Abstrak Jurnal:</strong> Tidak semua artikel di Crossref/OpenAlex
              menyertakan abstrak dalam metadata API mereka (coverage ~40-60%). Artikel tanpa
              abstrak akan ditandai dengan label <span className="font-mono bg-yellow-100 px-1">⚠ NO ABSTRACT</span>
              {" "}dan Anda perlu membuka DOI untuk membaca artikel asli guna mengekstrak masalah
              penelitiannya secara manual.
            </p>
          </div>

          <Link href="/proyek" className="btn-primary mt-6 inline-flex">
            Lihat Proyek Lain
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
