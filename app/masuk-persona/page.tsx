import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Masuk · Kitabah",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Halaman ini PENSIUN (6 Nov 2026): jalur persona tunggal berkunci
 * bersama digantikan formulir email akun uji langsung di /masuk
 * (daftar putih sepuluh email, lihat lib/server/persona.ts). Rute
 * dibiarkan ada hanya agar alamat lamanya menjawab 404 yang bersih
 * dalam segala keadaan, bukan halaman masuk tersembunyi.
 */
export default function MasukPersonaPage() {
  notFound();
}
