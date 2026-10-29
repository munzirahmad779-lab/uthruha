/**
 * Mode uji persona (cabang uji-persona, JANGAN digabung ke main).
 *
 * Aktif bila UTH_MODE_UJI=1 (lokal) ATAU deployment Vercel berjenis
 * "preview" (VERCEL_ENV=preview). Di produksi (VERCEL_ENV=production)
 * fungsi ini selalu false, dan semua permukaan uji menjawab 404 atau
 * tidak dirender.
 *
 * Mode uji TIDAK PERNAH menyentuh data produksi: store memaksa backend
 * berkas lokal saat mode ini aktif (lihat lib/server/store.ts), dan
 * identitas yang tersedia hanyalah fixture dummy di
 * lib/server/fixture-persona.ts.
 */
export function modeUjiAktif(): boolean {
  return process.env.UTH_MODE_UJI === "1" || process.env.VERCEL_ENV === "preview";
}
