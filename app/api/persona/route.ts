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
import { ambilAkunUji, cariAkunUji, personaAktif } from "@/lib/server/persona";
import { simpan } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jendela batas laju akun uji: sama seperti jendela masuk biasa. */
const JENDELA_MS = 15 * 60 * 1000;
/** Maksimal 10 percobaan per 15 menit per IP. */
const MAKS_PER_IP = 10;
/** Batas global agar pemutaran IP tidak menolong penebak daftar. */
const MAKS_GLOBAL = 60;
/** Umur cookie identitas: 30 hari, sama seperti sesi pengguna biasa. */
const UMUR_SESI_USER_DETIK = 30 * 24 * 60 * 60;

/**
 * Balasan 404 untuk keadaan jalur mati: persis pesan 404 umum, agar
 * pemanggil luar tidak mendapat petunjuk bahwa jalur ini ada.
 */
function tidakDitemukan() {
  return NextResponse.json(
    { error: "Tidak ditemukan." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Penolakan umum untuk semua keadaan tertutup selain jalur mati:
 * email di luar daftar putih dan akun yang dinonaktifkan pemilik
 * menjawab persis sama, tanpa cookie apa pun, jadi respons tidak
 * membocorkan email mana yang terdaftar atau akun mana yang nonaktif.
 */
function ditolakUmum() {
  return NextResponse.json(
    { error: "Email tidak terdaftar untuk akses uji coba." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Masuk akun uji coba berbasis email (perintah pemilik, 6 Nov 2026):
 * agen AI lain milik pemilik mengirim { email }; hanya lima belas
 * email daftar putih di lib/server/persona.ts yang diterima, dan tiap email
 * masuk ke akun ujinya sendiri dengan lapis yang terkunci dari tabel.
 * Pengembangan dari jalur persona tunggal 5 Nov 2026: kunci bersama
 * jalur gugur, daftar putih inilah gerbangnya, dan saklarnya tetap
 * env UTH_PERSONA_AKTIF.
 *
 * Yang SENGAJA tidak dilakukan di sini, beserta alasannya:
 *  - Tanpa notif email login: akun uji adalah akun mesin, bukan
 *    manusia; notif hanya akan memenuhi kotak masuk pemilik.
 *  - Tanpa saring perangkat: agen penguji berjalan dari lingkungan
 *    yang berganti-ganti; batas perangkat per akun dibuat untuk akun
 *    manusia dan akan mengunci agen keluar tanpa manfaat keamanan.
 *  - Tanpa sinkronMahasiswa dan tanpa daftar mahasiswa kampus:
 *    status mahasiswa akun uji bersumber dari tabel AKUN_UJI saja
 *    (ditetapkan ambilAkunUji saat akun diwujudkan). Sepuluh akun
 *    pertama bukan mahasiswa; lima akun mahasiswa uji dikenai gerbang
 *    kunci pribadi di rute AI persis seperti mahasiswa sungguhan.
 *    Gerbang masuk WAJIB_ISI_KUNCI di /api/masuk TIDAK ditiru di
 *    sini: akun mahasiswa uji tetap bisa masuk walau belum punya
 *    kunci, agar agen penguji bisa mencapai halaman /kunci dan
 *    menyetor kunci pertamanya lewat jalur yang sama (perbedaan
 *    yang disengaja dan tercatat).
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

  let body: { email?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Badan permintaan bukan JSON." }, { status: 400 });
  }

  // Daftar putih diperiksa sebelum apa pun diterbitkan: email di
  // luar daftar tidak mendapat cookie, sesi, atau petunjuk tambahan.
  const def = cariAkunUji(body.email);
  if (!def) return ditolakUmum();

  const akun = await ambilAkunUji(def);
  if (akun.nonaktif) return ditolakUmum();

  // Cap masuk terakhir dicatat seperti akun biasa agar pemilik bisa
  // melihat di panel admin kapan akun uji terakhir dipakai.
  const terbaru = { ...akun, loginTerakhir: new Date().toISOString() };
  await simpan("pengguna", terbaru as unknown as Record<string, unknown> & { id: string });

  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");
  // Cookie identitas akun uji (sesi HMAC 30 hari, pola sama seperti
  // login Google) supaya /api/auth/status dan seluruh API mengenalnya.
  res.cookies.set({
    name: COOKIE_USER,
    value: buatNilaiSesi(akun.id),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: UMUR_SESI_USER_DETIK,
  });
  // Cookie gerbang sesuai lapis terkunci akun ini, diterbitkan persis
  // seperti terbitkanCookie di /api/masuk agar ruang kerja terbuka
  // pada lapis yang benar (gratis tetap gratis, premium tetap premium).
  res.cookies.set({
    name: COOKIE_AKSES,
    value: tandaAkses(kunciUntukJenis(def.tier)),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: UMUR_SESI_DETIK,
  });
  return res;
}
