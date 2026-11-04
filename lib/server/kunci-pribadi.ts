/**
 * Kunci API pribadi pengguna (BYOK, perintah pemilik 4 Nov 2026).
 *
 * Mahasiswa Ma'had Aly memakai kunci Gemini + Groq MILIK SENDIRI agar
 * kuota kolam pemilik tidak habis oleh pemakaian kelas. Kunci disimpan
 * TERENKRIPSI AES-256-GCM di store (koleksi "kunciPribadi"); kunci
 * dekripsi diturunkan dari UTH_SESI_SECRET dan tidak pernah disimpan.
 * Kunci mentah tidak pernah dikembalikan ke klien — status hanya
 * menampilkan 4 karakter terakhir.
 *
 * Aturan pakai (ditegakkan pemanggil lewat opsiKolamUntuk):
 *  - Akun bertanda mahasiswa: kunci pribadi WAJIB. Tanpa kunci, fitur
 *    AI berhenti dengan pesan jujur (bukan diam-diam memakai kolam).
 *    Kunci pribadi gagal/habis → fitur berhenti; kolam pemilik tidak
 *    dipakai sebagai cadangan untuk akun mahasiswa.
 *  - Premium lain yang mengisi kunci pribadi: kuncinya dicoba lebih
 *    dulu, kolam tetap menjadi cadangan.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ambil, hapus, simpan } from "./store";
import { tierEfektif, type Pengguna } from "./identitas";

export type NamaPenyediaPribadi = "gemini" | "groq";

interface CatatanKunci {
  id: string; // userId
  gemini: string | null; // sandi "v1:iv:tag:data" (base64)
  groq: string | null;
  diperbarui: string;
}

function kunciEnkripsi(): Buffer {
  const rahasia = process.env.UTH_SESI_SECRET?.trim();
  if (!rahasia) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("UTH_SESI_SECRET belum terpasang: kunci pribadi tidak bisa dienkripsi.");
    }
    return createHash("sha256").update("rahasia-dev-lokal-uthruha:kunci-pribadi").digest();
  }
  return createHash("sha256").update(`${rahasia}:kunci-pribadi`).digest();
}

function enkrip(teks: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kunciEnkripsi(), iv);
  const data = Buffer.concat([cipher.update(teks, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

function dekrip(sandi: string): string | null {
  try {
    const [versi, ivB, tagB, dataB] = sandi.split(":");
    if (versi !== "v1" || !ivB || !tagB || !dataB) return null;
    const decipher = createDecipheriv("aes-256-gcm", kunciEnkripsi(), Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function catatan(userId: string): Promise<CatatanKunci | null> {
  return (await ambil("kunciPribadi", userId)) as unknown as CatatanKunci | null;
}

/** Simpan/perbarui kunci: string = pasang, null = hapus, undefined = biarkan. */
export async function simpanKunciPribadi(
  userId: string,
  ubah: { gemini?: string | null; groq?: string | null },
): Promise<void> {
  const lama = await catatan(userId);
  const baru: CatatanKunci = {
    id: userId,
    gemini: lama?.gemini ?? null,
    groq: lama?.groq ?? null,
    diperbarui: new Date().toISOString(),
  };
  if (ubah.gemini !== undefined) baru.gemini = ubah.gemini === null ? null : enkrip(ubah.gemini);
  if (ubah.groq !== undefined) baru.groq = ubah.groq === null ? null : enkrip(ubah.groq);
  if (baru.gemini === null && baru.groq === null) {
    if (lama) await hapus("kunciPribadi", userId);
    return;
  }
  await simpan("kunciPribadi", baru as unknown as Record<string, unknown> & { id: string });
}

export interface KunciPribadiMentah {
  gemini?: string;
  groq?: string;
}

/** Kunci mentah terdekripsi — HANYA untuk pemanggilan AI di server. */
export async function ambilKunciPribadi(userId: string): Promise<KunciPribadiMentah> {
  const c = await catatan(userId);
  if (!c) return {};
  const hasil: KunciPribadiMentah = {};
  if (c.gemini) {
    const k = dekrip(c.gemini);
    if (k) hasil.gemini = k;
  }
  if (c.groq) {
    const k = dekrip(c.groq);
    if (k) hasil.groq = k;
  }
  return hasil;
}

export interface StatusSatuKunci {
  ada: boolean;
  /** 4 karakter terakhir kunci, untuk pengenalan pemiliknya. */
  ekor: string | null;
}

export async function statusKunciPribadi(
  userId: string,
): Promise<{ gemini: StatusSatuKunci; groq: StatusSatuKunci }> {
  const mentah = await ambilKunciPribadi(userId);
  const buat = (k?: string): StatusSatuKunci => ({
    ada: Boolean(k),
    ekor: k ? k.slice(-4) : null,
  });
  return { gemini: buat(mentah.gemini), groq: buat(mentah.groq) };
}

/** Bentuk kunci yang masuk akal: tanpa spasi, 20–200 karakter. */
export function kunciPribadiSah(k: unknown): k is string {
  return typeof k === "string" && k.length >= 20 && k.length <= 200 && !/\s/.test(k);
}

export interface OpsiKolamPengguna {
  pribadi?: { userId: string; gemini?: string; groq?: string };
  wajibPribadi?: boolean;
  /** True bila akun mahasiswa belum mengisi kunci apa pun: pemanggil
   *  wajib menolak dengan kode KUNCI_PRIBADI sebelum memanggil AI. */
  perluIsiKunci: boolean;
}

/**
 * Susun opsi kolam untuk seorang pengguna sesuai aturan di kepala
 * berkas ini. Premium dari tierEfektif tetap diputuskan pemanggil;
 * fungsi ini hanya mengatur kunci pribadi.
 */
export async function opsiKolamUntuk(u: Pengguna): Promise<OpsiKolamPengguna> {
  const mentah = await ambilKunciPribadi(u.id);
  const ada = Boolean(mentah.gemini || mentah.groq);
  if (u.mahasiswa) {
    if (!ada) return { perluIsiKunci: true };
    return {
      pribadi: { userId: u.id, ...mentah },
      wajibPribadi: true,
      perluIsiKunci: false,
    };
  }
  if (ada && tierEfektif(u) === "premium") {
    return { pribadi: { userId: u.id, ...mentah }, perluIsiKunci: false };
  }
  return { perluIsiKunci: false };
}

export const PESAN_PERLU_KUNCI =
  "Fitur AI untuk akun mahasiswa memakai kunci API Anda sendiri. Isi dulu kunci Gemini/Groq Anda di halaman Kunci API (/kunci), gratis dari Google AI Studio dan Groq.";
