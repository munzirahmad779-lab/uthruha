/**
 * Identitas pengguna (Fase 3, keputusan pemilik A):
 * login Google = IDENTITAS SAJA (openid/email/profile). Scope Drive TIDAK
 * diminta saat login; token Drive diminta bertahap hanya untuk fitur yang
 * membutuhkannya (penyimpanan & Google Doc premium).
 *
 * Sesi pengguna adalah cookie bertanda tangan HMAC terpisah dari gerbang
 * kunci akses: `uthruha_user = <userId>.<kedaluwarsa>.<HMAC>`. Tier selalu
 * dibaca ulang dari store di server — tidak pernah dipercaya dari cookie.
 *
 * Mode uji (UTH_MODE_UJI=1, TIDAK pernah di produksi): header
 * `x-uji-user: UJI-GRATIS|UJI-PREMIUM` memetakan ke fixture basis data
 * dengan nama persis itu, dibuat oleh scripts/seed-uji.ts.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { ambil, simpan } from "./store";

export const COOKIE_USER = "uthruha_user";
const UMUR_SESI_USER = 30 * 24 * 60 * 60; // 30 hari

export interface Pengguna {
  id: string;
  email: string;
  nama: string;
  foto: string;
  tier: "gratis" | "premium";
  premiumSampai: string | null;
  dibuat: string;
  namaUji?: string;
  /** Order pembayaran yang SUDAH diterapkan sebagai perpanjangan premium
   *  (idempotensi aktivasi per order — audit keamanan bayar 28 Okt 2026). */
  orderPremiumDiterapkan?: string[];
}

let sudahPeringatkanRahasia = false;
function rahasiaSesi(): string {
  const khusus = process.env.UTH_SESI_SECRET?.trim();
  if (khusus) return khusus;
  if (!sudahPeringatkanRahasia) {
    sudahPeringatkanRahasia = true;
    if (process.env.UTH_ACCESS_KEY?.trim()) {
      console.error(
        "[identitas] UTH_SESI_SECRET belum diisi — rahasia sesi memakai kunci akses bersama. " +
          "Isi UTH_SESI_SECRET acak khusus di env produksi agar cookie sesi tidak bisa ditempa pemegang kunci akses.",
      );
    } else {
      console.error(
        "[identitas] PERINGATAN: rahasia sesi memakai nilai bawaan pengembang — JANGAN dipakai di produksi.",
      );
    }
  }
  return process.env.UTH_ACCESS_KEY?.trim() || "rahasia-dev-lokal-uthruha";
}

function tanda(isi: string): string {
  return createHmac("sha256", rahasiaSesi()).update(isi).digest("hex");
}

export function buatNilaiSesi(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + UMUR_SESI_USER;
  const isi = `${userId}.${exp}`;
  return `${isi}.${tanda(isi)}`;
}

function samaKonstan(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Verifikasi id_token Google lewat endpoint tokeninfo resmi. */
export async function verifikasiGoogle(
  idToken: string,
): Promise<{ sub: string; email: string; nama: string; foto: string } | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, string>;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
    if (clientId && j.aud !== clientId) return null;
    if (!j.sub || !j.email) return null;
    if (j.email_verified === "false") return null;
    return { sub: j.sub, email: j.email, nama: j.name ?? "", foto: j.picture ?? "" };
  } catch {
    return null;
  }
}

/** Cari pengguna dari sub Google; buat baru (tier gratis) bila belum ada. */
export async function cariAtauBuatPengguna(g: {
  sub: string;
  email: string;
  nama: string;
  foto: string;
}): Promise<Pengguna> {
  const id = `g-${g.sub}`;
  const ada = (await ambil("pengguna", id)) as unknown as Pengguna | null;
  if (ada) {
    if (ada.email !== g.email || ada.nama !== g.nama || ada.foto !== g.foto) {
      const baru = { ...ada, email: g.email, nama: g.nama, foto: g.foto };
      await simpan("pengguna", baru as unknown as Record<string, unknown> & { id: string });
      return baru;
    }
    return ada;
  }
  const baru: Pengguna = {
    id,
    email: g.email,
    nama: g.nama,
    foto: g.foto,
    tier: "gratis",
    premiumSampai: null,
    dibuat: new Date().toISOString(),
  };
  await simpan("pengguna", baru as unknown as Record<string, unknown> & { id: string });
  return baru;
}

/** Pengguna dari cookie sesi; null bila tidak ada/tidak sah. */
export async function penggunaDariCookie(cookieHeader: string | null): Promise<Pengguna | null> {
  if (!cookieHeader) return null;
  let nilai: string | undefined;
  for (const bagian of cookieHeader.split(";")) {
    const i = bagian.indexOf("=");
    if (i > 0 && bagian.slice(0, i).trim() === COOKIE_USER) nilai = bagian.slice(i + 1).trim();
  }
  if (!nilai) return null;
  const potong = nilai.split(".");
  if (potong.length < 3) return null;
  const sig = potong.pop()!;
  const exp = Number(potong.pop());
  const userId = potong.join(".");
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  if (!samaKonstan(sig, tanda(`${userId}.${exp}`))) return null;
  return (await ambil("pengguna", userId)) as unknown as Pengguna | null;
}

/**
 * Resolusi pengguna untuk route handler: fixture uji (mode uji saja)
 * → cookie sesi. Mengembalikan null untuk tamu.
 */
export async function penggunaDariRequest(req: Request): Promise<Pengguna | null> {
  if (process.env.UTH_MODE_UJI === "1") {
    const uji = req.headers.get("x-uji-user")?.trim();
    if (uji === "UJI-GRATIS" || uji === "UJI-PREMIUM") {
      const semuaPengguna = await import("./store").then((m) => m.semua("pengguna"));
      const f = semuaPengguna.find((p) => p.namaUji === uji);
      if (f) return f as unknown as Pengguna;
    }
  }
  return penggunaDariCookie(req.headers.get("cookie"));
}

/** Tier efektif: premium hanya bila masa berlaku belum lewat. */
export function tierEfektif(u: Pengguna): "gratis" | "premium" {
  if (u.tier !== "premium") return "gratis";
  if (!u.premiumSampai) return "premium";
  return new Date(u.premiumSampai).getTime() > Date.now() ? "premium" : "gratis";
}
