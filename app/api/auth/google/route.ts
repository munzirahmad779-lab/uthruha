import { NextResponse } from "next/server";
import {
  COOKIE_USER,
  buatNilaiSesi,
  cariAtauBuatPengguna,
  tierEfektif,
  verifikasiGoogle,
} from "@/lib/server/identitas";
import { cookieSecure, tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah } from "@/lib/security/laju";

export const runtime = "nodejs";

/**
 * Login Google IDENTITAS SAJA (openid/email/profile).
 * Klien mengirim id_token dari GIS; server memverifikasinya ke Google,
 * lalu menerbitkan cookie sesi pengguna. Scope Drive tidak terlibat.
 */
export async function POST(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });

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
