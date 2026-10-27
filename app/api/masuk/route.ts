import { NextResponse } from "next/server";
import {
  COOKIE_AKSES,
  COOKIE_PERANGKAT,
  UMUR_PERANGKAT_DETIK,
  UMUR_SESI_DETIK,
  cookieSecure,
  gerbangAktif,
  kunciAkses,
  sidikKunci,
  tandaAkses,
  tandaPerangkat,
  tandaSama,
} from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Maksimal 5 percobaan per 15 menit per IP — menahan tebakan kunci. */
const JENDELA_MS = 15 * 60 * 1000;
const MAKS_PERCOBAAN = 5;
/** Batas lidah global agar percobaan dari banyak IP tetap tertahan. */
const MAKS_GLOBAL = 60;

export async function POST(req: Request) {
  if (!asalSah(req)) {
    return NextResponse.json({ error: "Asal permintaan tidak dikenal." }, { status: 403 });
  }

  const ip = ipKlien(req);
  const perIp = bolehLaju(`masuk:${ip}`, MAKS_PERCOBAAN, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(
      perIp.ulangDetik,
      `Terlalu banyak percobaan. Coba lagi dalam ${perIp.ulangDetik} detik.`,
    );
  }
  const global = bolehLaju("masuk:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Percobaan masuk sedang dibatasi. Coba lagi nanti.");
  }

  if (!gerbangAktif()) {
    return NextResponse.json(
      {
        error:
          "Gerbang akses belum diaktifkan di server. Isi UTH_ACCESS_KEY (minimal 16 karakter) pada .env.local lalu restart.",
      },
      { status: 503 },
    );
  }

  let body: { kunci?: unknown; ingat?: unknown };
  try {
    body = (await req.json()) as { kunci?: unknown; ingat?: unknown };
  } catch {
    return NextResponse.json({ error: "Badan permintaan bukan JSON." }, { status: 400 });
  }

  const dikirim = typeof body.kunci === "string" ? body.kunci.trim() : "";
  if (!dikirim) {
    return NextResponse.json({ error: "Kunci akses wajib diisi." }, { status: 400 });
  }

  // Bandingkan sidik, bukan kunci mentah, agar panjang kunci tidak bocor
  // lewat waktu perbandingan. (Cookie yang diterbitkan memakai tandaAkses/
  // tandaPerangkat bercap waktu — format N-03.)
  const cocok = tandaSama(sidikKunci(dikirim), sidikKunci(kunciAkses()));
  if (!cocok) {
    return NextResponse.json({ error: "Kunci akses salah." }, { status: 401 });
  }

  const ingat = body.ingat !== false; // default: ingat perangkat
  const res = NextResponse.json({ ok: true, ingat });
  res.headers.set("Cache-Control", "no-store");

  res.cookies.set({
    name: COOKIE_AKSES,
    value: tandaAkses(kunciAkses()),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: UMUR_SESI_DETIK,
  });

  // Perangkat tepercaya: 365 hari, diperpanjang otomatis oleh middleware.
  if (ingat) {
    res.cookies.set({
      name: COOKIE_PERANGKAT,
      value: tandaPerangkat(kunciAkses()),
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: UMUR_PERANGKAT_DETIK,
    });
  }

  return res;
}

/** Keluar: hapus kedua cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE_AKSES, value: "", path: "/", maxAge: 0 });
  res.cookies.set({ name: COOKIE_PERANGKAT, value: "", path: "/", maxAge: 0 });
  return res;
}