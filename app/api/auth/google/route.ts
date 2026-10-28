import { NextResponse } from "next/server";
import {
  COOKIE_USER,
  buatNilaiSesi,
  cariAtauBuatPengguna,
  tierEfektif,
  verifikasiGoogle,
} from "@/lib/server/identitas";
import { cookieSecure } from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

/** Batas percobaan login Google: menahan penyalahgunaan endpoint publik. */
const JENDELA_MS = 15 * 60 * 1000;
const MAKS_PER_IP = 20;
const MAKS_GLOBAL = 200;

/**
 * Login Google IDENTITAS SAJA (openid/email/profile).
 * Klien mengirim id_token dari GIS; server memverifikasinya ke Google,
 * lalu menerbitkan cookie sesi pengguna. Scope Drive tidak terlibat.
 *
 * Sejak login Google pindah ke halaman awal (keputusan pemilik, 28 Okt
 * 2026), endpoint ini adalah PINTU MASUK — ia tidak lagi mensyaratkan
 * cookie gerbang kunci akses (dulu tolakTanpaSesi). Pengganti lapis
 * pemeriksanya adalah verifikasi id_token ke Google di server itu
 * sendiri + pemeriksaan asal + batas laju di bawah. Identitas yang
 * diterbitkan endpoint ini TIDAK membuka ruang kerja sendirian: semua
 * API lain tetap memeriksa cookie gerbang (middleware + tolakTanpaSesi)
 * DAN keadaan kunci lewat /api/masuk.
 */
export async function POST(req: Request) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });

  const ip = ipKlien(req);
  const perIp = bolehLaju(`auth-google:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(perIp.ulangDetik, "Terlalu banyak percobaan masuk. Coba lagi nanti.");
  }
  const global = bolehLaju("auth-google:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Percobaan masuk sedang dibatasi. Coba lagi nanti.");
  }

  const body = (await req.json().catch(() => null)) as { idToken?: string } | null;
  if (!body?.idToken) return NextResponse.json({ error: "id_token kosong." }, { status: 400 });

  const g = await verifikasiGoogle(body.idToken);
  if (!g) return NextResponse.json({ error: "Token Google tidak sah/kedaluwarsa." }, { status: 401 });

  const pengguna = await cariAtauBuatPengguna(g);
  const res = NextResponse.json({
    pengguna: { id: pengguna.id, email: pengguna.email, nama: pengguna.nama, foto: pengguna.foto },
    tier: tierEfektif(pengguna),
    premiumSampai: pengguna.premiumSampai,
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
  return res;
}
