/**
 * Persona uji untuk agen AI lain milik pemilik (perintah pemilik,
 * 5 Nov 2026): satu akun premium tunggal yang bisa dimasuki agen luar
 * lewat halaman /masuk-persona, tanpa login Google sungguhan.
 *
 * Keamanan jalur ini BUKAN gerbang middleware, melainkan dua env di
 * server:
 *  - UTH_PERSONA_AKTIF harus persis "1"; nilai lain berarti jalur mati
 *    total (halaman dan API menjawab 404, seolah tidak pernah ada).
 *  - UTH_PERSONA_KUNCI adalah kunci rahasia pemegang jalur (minimal 16
 *    karakter). Tanpa kunci yang benar, halaman dan API tetap 404
 *    tanpa membedakan alasan, jadi pemindai luar tidak mendapat
 *    petunjuk apa pun bahwa jalur ini ada.
 *
 * Email yang diisi di halaman masuk persona TIDAK dipakai sebagai
 * identitas dan TIDAK disimpan: apa pun isinya, yang masuk selalu
 * persona tunggal ber-id tetap di bawah ini. Ini disengaja agar agen
 * penguji bisa memakai email acak tanpa membuat akun baru setiap kali.
 */
import { tandaSama } from "../security/akses";
import { ambil, simpan } from "./store";
import type { Pengguna } from "./identitas";

/** ID tetap persona uji; satu-satunya akun yang diterbitkan jalur ini. */
export const ID_PERSONA = "persona-uji";

/** Email tetap persona (bukan email yang diisi di formulir). */
const EMAIL_PERSONA = "persona@uji.kitabah.local";

/** Apakah jalur persona aktif: saklar env menyala DAN kunci cukup kuat. */
export function personaAktif(): boolean {
  if (process.env.UTH_PERSONA_AKTIF !== "1") return false;
  return (process.env.UTH_PERSONA_KUNCI ?? "").trim().length >= 16;
}

/**
 * Periksa kunci yang dikirim pemanggil. Perbandingan memakai tandaSama
 * (waktu konstan) dari modul akses agar waktu respons tidak membocorkan
 * seberapa dekat tebakan dengan kunci asli. Jalur mati selalu salah.
 */
export function personaKunciSah(dikirim: unknown): boolean {
  if (!personaAktif()) return false;
  if (typeof dikirim !== "string") return false;
  const kunci = (process.env.UTH_PERSONA_KUNCI ?? "").trim();
  return tandaSama(dikirim.trim(), kunci);
}

/** Nama tampil persona; bisa diganti pemilik lewat env tanpa ubah kode. */
export function personaNama(): string {
  return process.env.UTH_PERSONA_NAMA?.trim() || "Persona Uji";
}

/**
 * Ambil persona uji dari store; buat baru bila belum ada. Bila nama di
 * env berubah, nama tersimpan disamakan supaya tampilan selalu mengikuti
 * ketetapan pemilik terakhir. Record yang sudah dinonaktifkan pemilik
 * dikembalikan apa adanya: fungsi ini TIDAK pernah mengaktifkan ulang
 * akun nonaktif; pemanggil yang wajib menolaknya.
 */
export async function ambilPersona(): Promise<Pengguna> {
  const ada = (await ambil("pengguna", ID_PERSONA)) as unknown as Pengguna | null;
  const nama = personaNama();
  if (ada) {
    if (ada.nama !== nama) {
      const baru = { ...ada, nama };
      await simpan("pengguna", baru as unknown as Record<string, unknown> & { id: string });
      return baru;
    }
    return ada;
  }
  const baru: Pengguna = {
    id: ID_PERSONA,
    email: EMAIL_PERSONA,
    nama,
    foto: "",
    tier: "premium",
    premiumSampai: null,
    dibuat: new Date().toISOString(),
    personaUji: true,
  };
  await simpan("pengguna", baru as unknown as Record<string, unknown> & { id: string });
  return baru;
}
