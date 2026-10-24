/**
 * Peringatan Kritis — Utruha v2.0
 * Bahasa Indonesia sesuai permintaan user.
 */

/** Peringatan utama yang muncul setiap kali hasil AI masuk. */
export const PERINGATAN_UTAMA =
  "⚠️ Peringatan: Teks ini dibuat oleh AI dan mungkin mengandung kesalahan. Harap baca ulang dan verifikasi semua rujukan sebelum menggunakannya dalam karya ilmiah Anda.";

/** Peringatan saat ekspor ke AI eksternal. */
export const PERINGATAN_EKSPOR =
  "⚠️ Data naskah Anda akan dikirim ke layanan AI eksternal ({provider}). Pastikan tidak ada informasi pribadi atau sensitif dalam teks.";

/** Peringatan saat verifikasi rujukan gagal. */
export const PERINGATAN_VERIFIKASI_GAGAL =
  "⚠️ Beberapa rujukan tidak dapat diverifikasi otomatis. Harap periksa manual melalui tautan atau database yang disediakan.";

/** Peringatan saat draft terpotong karena batas token. */
export const PERINGATAN_TERPOTONG =
  "⚠️ Naskah terlalu panjang untuk {provider}. Teks telah dipotong dari {asli} menjadi {final} karakter. Sebagian isi mungkin tidak diproses AI.";

/** Disclaimer footer di setiap halaman hasil. */
export const DISCLAIMER_FOOTER =
  "Catatan: Utruha adalah alat bantu penyusunan karya ilmiah. Seluruh output harus diverifikasi dan disunting secara kritis oleh pengguna. Utruha tidak bertanggung jawab atas akurasi konten yang dihasilkan.";

/** Label status verifikasi untuk UI (bahasa Indonesia). */
export const LABEL_STATUS_VERIFIKASI: Record<string, { label: string; warna: string; deskripsi: string }> = {
  "موثق": { label: "✅ Terverifikasi", warna: "#16a34a", deskripsi: "Sumber ditemukan dan valid." },
  "يحتاج_تحقق": { label: "⚠️ Perlu Dicek", warna: "#ca8a04", deskripsi: "Tidak dapat diverifikasi otomatis. Harap cek manual." },
  "غير_موجود": { label: "❌ Tidak Ditemukan", warna: "#dc2626", deskripsi: "DOI/URL tidak aktif atau sumber tidak ditemukan." },
  "محرر_يدويًّا": { label: "✏️ Diedit Manual", warna: "#7c3aed", deskripsi: "Rujukan telah diedit setelah verifikasi otomatis." },
};

/** Format pesan peringatan dengan variabel. */
export function formatPeringatan(template: string, vars: Record<string, string>): string {
  let hasil = template;
  for (const [key, val] of Object.entries(vars)) {
    hasil = hasil.replace(`{${key}}`, val);
  }
  return hasil;
}
