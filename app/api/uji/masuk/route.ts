import { NextResponse } from "next/server";
import {
  COOKIE_AKSES,
  UMUR_SESI_DETIK,
  cookieSecure,
  gerbangAktif,
  kunciUntukJenis,
  tandaAkses,
} from "@/lib/security/akses";
import { asalSah } from "@/lib/security/laju";
import { COOKIE_USER, buatNilaiSesi } from "@/lib/server/identitas";
import { modeUjiAktif } from "@/lib/server/mode-uji";
import { personaDariNamaUji, pastikanPersonaUji } from "@/lib/server/fixture-persona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Masuk sebagai persona dummy (cabang uji-persona). Hanya hidup pada
 * mode uji; di produksi membalas 404. Tanpa sandi: persona memang
 * identitas rekaan di lingkungan staging yang terisolasi dari data
 * produksi (store dipaksa lokal oleh mode uji).
 *
 * Menyetel cookie sesi pengguna bertanda tangan (sama seperti login
 * Google) dan, bila gerbang kunci aktif di deployment itu, cookie
 * gerbang lapis persona tersebut.
 */
export async function POST(req: Request) {
  if (!modeUjiAktif()) {
    return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  }
  if (!asalSah(req)) {
    return NextResponse.json({ error: "Asal permintaan tidak dikenal." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { profil?: string } | null;
  const persona = body?.profil ? personaDariNamaUji(body.profil.trim()) : null;
  if (!persona) {
    return NextResponse.json({ error: "Profil uji tidak dikenal." }, { status: 400 });
  }
  const pengguna = await pastikanPersonaUji(persona);
  const res = NextResponse.json({
    pengguna: { id: pengguna.id, email: pengguna.email, nama: pengguna.nama },
    tier: persona.tier,
  });
  res.cookies.set({
    name: COOKIE_USER,
    value: buatNilaiSesi(pengguna.id),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  if (gerbangAktif()) {
    const kunci = kunciUntukJenis(persona.tier);
    if (kunci) {
      res.cookies.set({
        name: COOKIE_AKSES,
        value: tandaAkses(kunci),
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure(),
        path: "/",
        maxAge: UMUR_SESI_DETIK,
      });
    }
  }
  return res;
}
