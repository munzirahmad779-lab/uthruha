import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { personaAktif, personaKunciSah } from "@/lib/server/persona";
import { FormPersona } from "./form-persona";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk · Kitabah",
  robots: { index: false, follow: false },
};

/**
 * Halaman masuk persona uji (perintah pemilik, 5 Nov 2026): tampilannya
 * meniru langkah masuk dengan Google (kartu putih terpusat, judul
 * "Masuk", satu kolom email) agar pada rekaman dan pemakaian agen
 * terbaca jelas bahwa masuk ke Kitabah harus lewat langkah login.
 *
 * Halaman ini hanya ada bagi pemegang kunci jalur: kunci dibaca dari
 * query "k" dan diperiksa di server. Tanpa jalur aktif atau tanpa
 * kunci yang benar, halaman menjawab 404 persis seperti halaman yang
 * tidak ada, dan halaman ini tidak ditautkan dari mana pun.
 *
 * Sengaja TANPA logo Google atau aset merek pihak ketiga: yang ditiru
 * adalah langkah dan susunan halamannya, bukan mereknya.
 */
export default async function MasukPersonaPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string | string[] }>;
}) {
  const params = await searchParams;
  const k = Array.isArray(params.k) ? params.k[0] : params.k;
  if (!personaAktif() || !personaKunciSah(k)) notFound();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f0f4f9] px-4 py-10">
      <div className="w-full max-w-[448px] rounded-[28px] bg-white px-6 py-10 shadow-sm sm:px-10">
        <h1 className="text-center text-[32px] font-normal leading-tight text-neutral-900">
          Masuk
        </h1>
        <p className="mt-3 text-center text-[15px] leading-relaxed text-neutral-700">
          Gunakan Akun Google Anda untuk melanjutkan ke Kitabah
        </p>
        <FormPersona kunci={k ?? ""} />
      </div>
    </div>
  );
}
