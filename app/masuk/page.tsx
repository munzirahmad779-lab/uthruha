import type { Metadata } from "next";
import { MasukForm } from "@/components/masuk-form";
import { loginGoogleAktif } from "@/lib/security/akses";
import { EMAIL_KONTAK, tautanWa } from "@/lib/legal";

/** Teks pesan WA yang sudah terisi untuk permintaan kunci (pemilik, 3 Nov 2026). */
const PESAN_WA_GRATIS =
  "Assalamu'alaikum, saya ingin meminta kunci gratis Kitabah.\nNama: \nKampus: ";
const PESAN_WA_PREMIUM =
  "Assalamu'alaikum, saya ingin meminta kunci premium Kitabah.\nNama: \nKampus: ";

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
          <div className="mt-6 border-t border-ink-900/10 pt-5">
            <p className="text-[13px] font-semibold text-ink-900">
              Belum punya kunci? Pilih lapisnya, lalu minta lewat WhatsApp
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
              Pesan sudah disiapkan otomatis. Tinggal isi nama dan kampus Anda,
              lalu kirim.
            </p>

            <div className="mt-3 rounded-xl border border-ink-900/10 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold text-ink-900">Gratis</p>
                <p className="text-[13px] font-bold text-ink-900">Rp0</p>
              </div>
              <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-ink-700">
                <li>✓ 1 proyek penulisan</li>
                <li>✓ Hanya untuk 1 perangkat</li>
                <li>✓ Pencarian rujukan kitab dan jurnal tanpa batas</li>
                <li>✓ Maksimal 3 footnote dalam satu paragraf</li>
                <li>✓ Ekspor naskah ke Word (.docx)</li>
                <li>✓ Ruang lingkup terkunci sesudah footnote pertama terpasang</li>
              </ul>
              <a
                href={tautanWa(PESAN_WA_GRATIS)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block rounded-lg bg-emerald-600 px-3 py-2.5 text-center text-[13px] font-semibold text-white transition hover:bg-emerald-700"
              >
                Minta kunci gratis lewat WhatsApp
              </a>
            </div>

            <div className="mt-3 rounded-xl border border-gold-300/70 bg-parchment-50 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold text-ink-900">
                  Premium{" "}
                  <span className="ml-1 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Diskon
                  </span>
                </p>
                <p className="text-[13px] font-bold text-ink-900">
                  <s className="mr-1 font-semibold text-ink-400">Rp50.000</s>
                  Rp10.000
                  <span className="font-semibold text-ink-500"> / bulan</span>
                </p>
              </div>
              <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-ink-700">
                <li>✓ Proyek tanpa batas jumlah</li>
                <li>✓ Bisa dipakai sampai 2 perangkat</li>
                <li>✓ Footnote tanpa batas dalam satu paragraf</li>
                <li>✓ Generate footnote otomatis: AI menyusun rujukan dari paragraf Anda dan menanam footnote langsung</li>
                <li>✓ Chat agen AI instan di dalam web</li>
                <li>✓ Bebas ganti ruang lingkup lewat proyek baru, proyek lama tetap ada</li>
                <li>✓ Proyek gratis lama Anda ikut terbuka fitur premiumnya</li>
                <li>✓ Jaminan admin: kendala distandarkan beres paling lambat 6 jam; kegagalan sistem yang terbukti berarti dana kembali penuh</li>
              </ul>
              <a
                href={tautanWa(PESAN_WA_PREMIUM)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block rounded-lg bg-emerald-600 px-3 py-2.5 text-center text-[13px] font-semibold text-white transition hover:bg-emerald-700"
              >
                Minta kunci premium lewat WhatsApp
              </a>
            </div>
          </div>
          <p className="mt-6 text-[11px] leading-relaxed text-ink-500">
            Kunci tidak bisa dipulihkan dari halaman ini. Selain lewat WhatsApp,
            kunci gratis atau kunci pengganti juga bisa diminta lewat email ke{" "}
            <a
              href={`mailto:${EMAIL_KONTAK}`}
              className="font-semibold text-gold-700 underline underline-offset-2"
            >
              {EMAIL_KONTAK}
            </a>{" "}
            dengan menyebut nama dan kampus Anda.
          </p>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            Perlu diketahui sebelum masuk: pada lapis gratis, kategori ruang
            lingkup proyek hanya bisa diganti satu kali per perangkat, dan
            terkunci permanen sesudah footnote pertama terpasang.
          </p>
        </div>
      </div>
    </div>
  );
}
