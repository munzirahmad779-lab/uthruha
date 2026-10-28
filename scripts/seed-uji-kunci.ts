/**
 * Seed fixture uji DUA KUNCI (login Google di halaman awal + gerbang
 * dua kunci) — jalankan: npx tsx scripts/seed-uji-kunci.ts
 *
 * Berbeda dari seed-uji.ts (yang memakai header x-uji-user), fixture di
 * sini diautentikasi lewat COOKIE SESI PENGGUNA ASLI (buatNilaiSesi) —
 * karena yang diuji adalah jalur produksi persis: cookie identitas +
 * /api/masuk. Tiga pengguna, semuanya lapis gratis tanpa hak apa pun:
 *  - uji-kunci-gratis  : akan memakai kunci gratis.
 *  - uji-kunci-premium : akan memakai kunci premium.
 *  - uji-kunci-pol     : pembanding (Google saja tanpa kunci, dll).
 * Email @uji.local — bukan akun Google siapa pun. Jalankan dengan
 * UTH_DATA_FILE yang sama dengan server uji SEBELUM server dinyalakan.
 */
import { simpan } from "../lib/server/store";

async function main() {
  const sekarang = new Date().toISOString();
  for (const [id, label] of [
    ["uji-kunci-gratis", "UJI KUNCI GRATIS"],
    ["uji-kunci-premium", "UJI KUNCI PREMIUM"],
    ["uji-kunci-pol", "UJI KUNCI POL"],
  ] as const) {
    await simpan("pengguna", {
      id,
      email: `${id}@uji.local`,
      nama: `${label} (fixture uji, bukan mahasiswa)`,
      foto: "",
      tier: "gratis",
      premiumSampai: null,
      dibuat: sekarang,
    });
  }
  console.log("Fixture dua kunci tertulis: uji-kunci-gratis, uji-kunci-premium, uji-kunci-pol");
  console.log("Store:", process.env.UTH_DATA_FILE || ".data/db.json (bawaan)");
}

void main();
