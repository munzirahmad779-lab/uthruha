/**
 * SUPER ADMIN (perintah pemilik, 3 Nov 2026): satu pintu laporan layanan
 * di /admin, hanya untuk akun pemilik. Daftar email admin dibaca dari env
 * UTH_ADMIN_EMAILS (pisahkan dengan koma); bila env kosong, email kontak
 * resmi layanan (EMAIL_KONTAK di lib/legal.ts) adalah admin bawaannya,
 * karena akun Google pemilik memang memakai alamat itu.
 *
 * Pemeriksaan selalu di server dari sesi yang terverifikasi; halaman
 * /admin sendiri tidak menyimpan atau menampilkan apa pun tanpa jawaban
 * 200 dari /api/admin/laporan.
 */
import { EMAIL_KONTAK } from "@/lib/legal";
import type { Pengguna } from "./identitas";

export function daftarEmailAdmin(): string[] {
  const dariEnv = (process.env.UTH_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const daftar = dariEnv.length > 0 ? dariEnv : [EMAIL_KONTAK.toLowerCase()];
  return [...new Set(daftar)];
}

export function apakahAdmin(u: Pengguna | null | undefined): boolean {
  if (!u?.email) return false;
  return daftarEmailAdmin().includes(u.email.trim().toLowerCase());
}
