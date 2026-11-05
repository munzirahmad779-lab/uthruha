import { NextResponse } from "next/server";
import {
  COOKIE_AKSES,
  UMUR_SESI_DETIK,
  cookieSecure,
  kunciUntukJenis,
  tandaAkses,
} from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";
import { buatNilaiSesi, COOKIE_USER } from "@/lib/server/identitas";
import { ambilPersona, personaAktif, personaKunciSah } from "@/lib/server/persona";
import { simpan } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jendela batas laju persona: sama seperti jendela masuk biasa. */
const JENDELA_MS = 15 * 60 * 1000;
/** Maksimal 10 percobaan per 15 menit per IP. */
const MAKS_PER_IP = 10;
/** Batas global agar pemutaran IP tidak menolong penebak kunci. */
const MAKS_GLOBAL = 60;
/** Umur cookie identitas: 30 hari, sama seperti sesi pengguna biasa. */
const UMUR_SESI_USER_DETIK = 30 * 24 * 60 * 60;

/**
 * Balasan 404 tunggal untuk semua keadaan tertutup jalur ini: jalur
 * mati, kunci salah, dan persona nonaktif semuanya menjawab persis
 * sama, jadi pemanggil luar tidak bisa membedakan mana yang terjadi
 * (tanpa oracle). Pesannya pun pesan 404 umum, bukan petunjuk persona.
 */
function tidakDitemukan() {
  return NextResponse.json(
    { error: "Tidak ditemukan." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Masuk persona uji (perintah pemilik, 5 Nov 2026): agen AI lain milik
 * pemilik mengirim { kunci, email }; kunci adalah kunci rahasia jalur
 * (env UTH_PERSONA_KUNCI), sedangkan email hanya formalitas tampilan
 * langkah masuk Google dan TIDAK dipakai sebagai identitas, tidak
 * disimpan, dan tidak diverifikasi. Yang masuk selalu persona tunggal.
 *
 * Yang SENGAJA tidak dilakukan di sini, beserta alasannya:
 *  - Tanpa notif email login: persona adalah akun uji mesin, bukan
 *    manusia; notif hanya akan memenuhi kotak masuk pemilik.
 *  - Tanpa saring perangkat: agen penguji berjalan dari lingkungan
 *    yang berganti-ganti; batas perangkat per akun dibuat untuk akun
 *    manusia dan akan mengunci agen keluar tanpa manfaat keamanan,
 *    karena kunci jalur sendirilah pengamannya.
 *  - Tanpa gerbang kunci mahasiswa: persona tidak pernah mahasiswa
 *    (lihat field personaUji di lib/server/identitas.ts), jadi gerbang
 *    setor kunci API pribadi tidak berlaku untuknya.
 */
export async function POST(req: Request) {
  if (!personaAktif()) return tidakDitemukan();

  if (!asalSah(req)) {
    return NextResponse.json({ error: "Asal permintaan tidak dikenal." }, { status: 403 });
  }

  const ip = ipKlien(req);
  const perIp = bolehLaju(`persona:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(
      perIp.ulangDetik,
      `Terlalu banyak percobaan. Coba lagi dalam ${perIp.ulangDetik} detik.`,
    );
  }
  const global = bolehLaju("persona:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Percobaan masuk sedang dibatasi. Coba lagi nanti.");
  }

  let body: { kunci?: unknown; email?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Badan permintaan bukan JSON." }, { status: 400 });
  }

  // Kunci diperiksa SEBELUM email divalidasi: pemanggil tanpa kunci
  // yang benar selalu menerima 404 yang sama, apa pun isi badannya.
  if (!personaKunciSah(body.kunci)) return tidakDitemukan();

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > 254) {
    return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
  }

  const persona = await ambilPersona();
  if (persona.nonaktif) return tidakDitemukan();

  // Cap masuk terakhir dicatat seperti akun biasa agar pemilik bisa
  // melihat di panel admin kapan persona terakhir dipakai. Email dari
  // formulir tidak ikut disimpan di mana pun.
  const terbaru = { ...persona, loginTerakhir: new Date().toISOString() };
  await simpan("pengguna", terbaru as unknown as Record<string, unknown> & { id: string });

  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");
  // Cookie identitas persona (sesi HMAC 30 hari, pola sama seperti
  // login Google) supaya /api/auth/status dan seluruh API mengenalnya.
  res.cookies.set({
    name: COOKIE_USER,
    value: buatNilaiSesi(persona.id),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: UMUR_SESI_USER_DETIK,
  });
  // Cookie gerbang lapis premium, diterbitkan persis seperti
  // terbitkanCookie di /api/masuk agar ruang kerja terbuka penuh.
  res.cookies.set({
    name: COOKIE_AKSES,
    value: tandaAkses(kunciUntukJenis("premium")),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: UMUR_SESI_DETIK,
  });
  return res;
}
