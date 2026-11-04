import type { Metadata } from "next";
import { KunciForm } from "@/components/kunci-form";

export const metadata: Metadata = {
  title: "Kunci API Saya · Kitabah",
  robots: { index: false, follow: false },
};

/**
 * Halaman kunci API pribadi (BYOK mahasiswa, perintah pemilik 4 Nov 2026).
 * Mahasiswa mengisi kunci Gemini + Groq milik sendiri di sini; pemilik
 * tidak lagi menempel ±40 kunci satu-satu ke env Vercel.
 */
export default function KunciPage() {
  return (
    <div className="wrap flex min-h-[70vh] items-start justify-center py-16">
      <div className="w-full max-w-xl">
        <div className="rounded-2xl border border-ink-900/10 bg-white p-8 shadow-sm">
          <p className="font-arabic text-2xl text-gold-600" dir="rtl">
            كِتَابَة
          </p>
          <h1 className="mt-3 text-xl font-bold text-ink-900">Kunci API saya</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
            Fitur AI Kitabah untuk akun mahasiswa memakai kunci API milik Anda sendiri,
            supaya kuota Anda tidak bercampur dengan pengguna lain. Kedua kunci di bawah
            ini gratis dibuat, tanpa kartu kredit.
          </p>
          <KunciForm />
        </div>
      </div>
    </div>
  );
}
