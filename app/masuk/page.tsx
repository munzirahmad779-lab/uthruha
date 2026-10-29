import type { Metadata } from "next";
import { MasukForm } from "@/components/masuk-form";
import { loginGoogleAktif } from "@/lib/security/akses";

export const metadata: Metadata = {
  title: "Masuk — Kitabah",
  robots: { index: false, follow: false },
};

export default function MasukPage() {
  // TAHAN LOGIN GOOGLE (perintah pemilik, 28 Okt 2026): selama
  // UTH_LOGIN_GOOGLE_AKTIF belum "1", halaman ini adalah gerbang satu
  // kolom kunci akses seperti semula — tanpa bagian Google sama sekali.
  const googleAktif = loginGoogleAktif();
  return (
    <div className="wrap flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-ink-900/10 bg-white p-8 shadow-sm">
          <p className="font-arabic text-2xl text-gold-600" dir="rtl">
            كِتَابَة
          </p>
          <h1 className="mt-3 text-xl font-bold text-ink-900">Ruang kerja terkunci</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
            {googleAktif ? (
              <>
                Dua langkah singkat: masuk dengan Google, lalu masukkan kunci akses yang
                diberikan pemilik server. Kunci hanya dikirim sekali; setelah itu peramban
                Anda menyimpan tanda sesinya, bukan kuncinya.
              </>
            ) : (
              <>
                Masukkan kunci akses yang diberikan pemilik server. Kunci ini hanya
                dikirim sekali; setelah itu peramban Anda menyimpan tanda sesinya,
                bukan kuncinya.
              </>
            )}
          </p>
          <MasukForm googleAktif={googleAktif} />
          <p className="mt-6 text-[11px] leading-relaxed text-ink-500">
            Lupa kunci? Kunci tidak bisa dipulihkan dari sini — hubungi pemilik server.
            Pemilik server dapat menggantinya dengan mengubah nilai{" "}
            <code className="rounded bg-ink-900/5 px-1 py-0.5">UTH_ACCESS_KEY</code>{" "}
            atau{" "}
            <code className="rounded bg-ink-900/5 px-1 py-0.5">UTH_KUNCI_GRATIS</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
