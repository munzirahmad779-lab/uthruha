import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://uthruha.id"),
  title: {
    default: "أُطروحة Uthruha — Ruang Kerja Karya Ilmiah Berbahasa Arab",
    template: "%s · Uthruha",
  },
  description:
    "Ruang kerja penulisan skripsi, tesis, disertasi, dan artikel jurnal berbahasa Arab: struktur bab Arab, bank frasa akademik, pemeriksa ortografi, transliterasi, sitasi, dan pemadu jurnal.",
  keywords: [
    "skripsi bahasa Arab",
    "tesis bahasa Arab",
    "disertasi bahasa Arab",
    "jurnal bahasa Arab",
    "penulisan akademik Arab",
    "الكتابة الأكاديمية",
    "أطروحة",
    "رسالة علمية",
  ],
  authors: [{ name: "Uthruha" }],
  openGraph: {
    title: "أُطروحة Uthruha — Ruang Kerja Karya Ilmiah Berbahasa Arab",
    description:
      "Dari topik yang masih kabur menjadi naskah skripsi, tesis, disertasi, atau artikel jurnal berbahasa Arab yang tertata.",
    type: "website",
    locale: "id_ID",
    siteName: "Uthruha",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0e2c26",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@400;500;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap"
        />
      </head>
      <body className="min-h-dvh bg-parchment-50" suppressHydrationWarning>
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-sm focus:text-parchment-100"
        >
          Lompat ke konten
        </a>
        <SiteHeader />
        <main id="konten">{children}</main>
        <SiteFooter />
        <Script src="/widget-claude.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
