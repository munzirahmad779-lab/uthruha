import { NextResponse } from "next/server";
import {
  COOKIE_AKSES,
  COOKIE_PERANGKAT,
  cookieSecure,
} from "@/lib/security/akses";
import { COOKIE_USER } from "@/lib/server/identitas";
import { asalSah } from "@/lib/security/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keluar / ganti akun (perintah pemilik, 29 Okt 2026).
 *
 * Sebelum endpoint ini ada, TIDAK ada jalan keluar dari UI: cookie
 * identitas Google berumur 30 hari dan cookie perangkat tepercaya 365
 * hari, jadi salah akun atau komputer bersama berarti terkunci pada
 * identitas itu sampai kedaluwarsa.
 *
 * Dua mode:
 *  - "identitas": bersihkan HANYA cookie identitas Google
 *    (uthruha_user). Dipakai tombol "Ganti akun" di halaman masuk —
 *    sesi gerbang tidak disentuh; pengunjung memilih akun Google lain
 *    sebelum memasukkan kunci (ikatan kunci mengikuti identitas, jadi
 *    pergantian harus mungkin SEBELUM langkah kunci).
 *  - "penuh" (bawaan): bersihkan identitas + sesi gerbang + perangkat
 *    tepercaya. Dipakai tombol "Keluar" di ruang kerja. Cookie perangkat
 *    wajib ikut bersih — tanpanya perangkat akan masuk sendiri lagi dan
 *    tombol keluar menjadi bohong, persis risiko komputer bersama.
 *
 * Membersihkan cookie selalu aman dan idempoten, jadi endpoint ini
 * tidak mensyaratkan sesi apa pun; perlindungannya cukup pemeriksaan
 * asal (asalSah) seperti POST lain. Ia juga SENGAJA tidak digerbang
 * flag login Google: hak untuk keluar tidak boleh ikut mati saat fitur
 * login ditahan.
 */
export async function POST(req: Request) {
  if (!asalSah(req)) {
    return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  }

  let mode: "identitas" | "penuh" = "penuh";
  try {
    const isi = (await req.json()) as { mode?: string };
    if (isi?.mode === "identitas") mode = "identitas";
  } catch { /* tanpa isi = keluar penuh */ }

  const res = NextResponse.json({ ok: true, mode });
  const bersihkan = (name: string) =>
    res.cookies.set({
      name,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: 0,
    });

  bersihkan(COOKIE_USER);
  if (mode === "penuh") {
    bersihkan(COOKIE_AKSES);
    bersihkan(COOKIE_PERANGKAT);
  }
  return res;
}
