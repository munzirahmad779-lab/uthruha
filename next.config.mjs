import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const produksi = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy.
 *
 * Hanya dipasang di produksi. Di mode pengembangan, Next.js memakai eval untuk
 * Hot Reload sehingga CSP ketat akan mematahkan halaman — dan halaman yang
 * patah justru mendorong orang mematikan proteksi sepenuhnya.
 *
 * 'unsafe-inline' pada script masih diperlukan karena Next menanamkan skrip
 * bootstrap inline. Bila kelak ingin CSP berbasis nonce (lebih ketat),
 * pasang lewat middleware dengan header per-permintaan.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  // frame-src WAJIB ada: tanpa direktif ini browser jatuh ke default-src
  // 'self' sehingga iframe tombol Google Sign-In (accounts.google.com)
  // diblokir dan pengunjung hanya melihat kotak kosong. style-src juga
  // harus mengizinkan accounts.google.com untuk lembar gaya GIS.
  "frame-src https://accounts.google.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://api.crossref.org https://doaj.org https://shamela.ws https://api.openalex.org https://api.semanticscholar.org https://kotak-surat-muse.munzirahmad779.workers.dev",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const headerKeamanan = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // WAJIB allow-popups: nilai "same-origin" memutus hubungan window dengan
  // popup OAuth Google (GIS) sehingga login Drive selalu dilaporkan
  // "popup ditutup" / menggantung. Google mensyaratkan same-origin-allow-popups.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(produksi
    ? [
        { key: "Content-Security-Policy", value: csp },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Jangan bocorkan versi framework ke penyerang.
  poweredByHeader: false,
  // Izinkan akses dev lewat localhost maupun 127.0.0.1 agar peringatan
  // "Cross origin request detected" hilang dan Fast Refresh tidak terganggu.
  allowedDevOrigins: ["127.0.0.1", "localhost", "172.25.208.1"],
  outputFileTracingRoot: dir,
  async headers() {
    return [
      { source: "/:path*", headers: headerKeamanan },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;