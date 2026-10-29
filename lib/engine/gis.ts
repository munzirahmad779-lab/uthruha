/**
 * Pemuatan Google Identity Services (GIS) yang dibagi bersama.
 *
 * Dipakai tombol login Google (identitas saja: openid, email, profile).
 * Kitabah tidak meminta akses Google Drive sama sekali sejak fitur
 * penyimpanan Drive dan Google Doc dihapus (29 Okt 2026); modul ini
 * hanya memastikan skrip GIS termuat, dengan semua jalur kegagalan
 * berakhir sebagai Error berpesan jelas + batas waktu (pola yang dulu
 * tinggal di gdrive-storage.ts dan membuat UI menggantung saat popup
 * Google gagal).
 */
let janjiGIS: Promise<void> | null = null;

export function muatGIS(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("GIS hanya tersedia di browser."));
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (janjiGIS) return janjiGIS;
  janjiGIS = new Promise<void>((resolve, reject) => {
    const selesai = window.setInterval(() => {
      if ((window as any).google?.accounts?.oauth2) {
        window.clearInterval(selesai);
        window.clearTimeout(batas);
        resolve();
      }
    }, 100);
    const batas = window.setTimeout(() => {
      window.clearInterval(selesai);
      janjiGIS = null;
      reject(new Error("Google Identity Services tidak termuat dalam 15 detik. Periksa koneksi internet lalu muat ulang halaman."));
    }, 15000);
    if (!document.getElementById("google-identity-services")) {
      const script = document.createElement("script");
      script.id = "google-identity-services";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onerror = () => {
        window.clearInterval(selesai);
        window.clearTimeout(batas);
        janjiGIS = null;
        reject(new Error("Gagal memuat skrip Google Identity Services dari accounts.google.com."));
      };
      document.head.appendChild(script);
    }
  });
  return janjiGIS;
}
