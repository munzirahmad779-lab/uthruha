/**
 * Seed fixture uji lapis (Fase 3) — jalankan: npx tsx scripts/seed-uji.ts
 *
 * CARA FIXTURE DIBUAT (persis seperti ini, tidak ada jalan lain):
 *  1. Dua baris ditulis langsung ke koleksi "pengguna" pada store server
 *     (berkas JSON lokal atau tabel uthruha_kv bila Supabase terpasang)
 *     dengan id "uji-gratis" dan "uji-premium", namaUji "UJI-GRATIS" dan
 *     "UJI-PREMIUM", email @uji.local (bukan akun Google asli siapa pun).
 *  2. UJI-PREMIUM diberi tier premium berlaku 30 hari; UJI-GRATIS gratis.
 *  3. Autentikasinya BUKAN login Google: route handler hanya menerima
 *     header `x-uji-user: UJI-GRATIS|UJI-PREMIUM` bila server dijalankan
 *     dengan env UTH_MODE_UJI=1. Di produksi env itu tidak dipasang,
 *     sehingga header ini tidak berpengaruh apa-apa.
 *  4. Fixture TIDAK menyentuh data mahasiswa asli; membersihkannya cukup
 *     dengan menghapus dua baris itu / berkas store uji.
 */
import { simpan } from "../lib/server/store";

async function main() {
  const sekarang = new Date();
  const sebulan = new Date(sekarang.getTime() + 30 * 24 * 3_600_000);
  await simpan("pengguna", {
    id: "uji-gratis",
    namaUji: "UJI-GRATIS",
    email: "uji-gratis@uji.local",
    nama: "UJI-GRATIS (fixture uji, bukan mahasiswa)",
    foto: "",
    tier: "gratis",
    premiumSampai: null,
    dibuat: sekarang.toISOString(),
  });
  await simpan("pengguna", {
    id: "uji-premium",
    namaUji: "UJI-PREMIUM",
    email: "uji-premium@uji.local",
    nama: "UJI-PREMIUM (fixture uji, bukan mahasiswa)",
    foto: "",
    tier: "premium",
    premiumSampai: sebulan.toISOString(),
    dibuat: sekarang.toISOString(),
  });
  console.log("Fixture tertulis: UJI-GRATIS (gratis) & UJI-PREMIUM (premium s.d.", sebulan.toISOString(), ")");
  console.log("Store:", process.env.UTH_DATA_FILE || ".data/db.json (bawaan)");
}

void main();
