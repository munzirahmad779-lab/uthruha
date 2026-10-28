/**
 * Aturan lapis gratis/premium (Fase 3, keputusan pemilik B–D).
 * Semua penegakan terjadi DI SERVER lewat modul ini; klien hanya penampil.
 *
 * GRATIS: maks 1 proyek server; ruang lingkup terkunci setelah footnote
 * pertama terpasang (sebelum itu ganti kategori diperbolehkan SEKALI dengan
 * peringatan); maks 3 footnote per paragraf; pencarian tanpa batas.
 * PREMIUM: tanpa batas di atas.
 */
import { panggilKolam } from "./kolam";
import { ambil, semua, simpan } from "./store";
import { idAcak } from "./store";
import { tierEfektif, type Pengguna } from "./identitas";

export interface KategoriKustom {
  nama: string;
  profilKata: string[];
}

export interface ProyekServer {
  id: string;
  userId: string;
  judul: string;
  kategoriId: string;
  kategoriKustom: KategoriKustom | null;
  gantiKategoriTerpakai: boolean;
  terkunciRuangLingkup: boolean;
  footnotePerParagraf: Record<string, number>;
  totalFootnote: number;
  dibuat: string;
}

export const MAKS_FOOTNOTE_GRATIS_PER_PARAGRAF = 3;
export const MAKS_PROYEK_GRATIS = 1;

export async function proyekPengguna(userId: string): Promise<ProyekServer[]> {
  const semuaProyek = (await semua("proyek")) as unknown as ProyekServer[];
  return semuaProyek.filter((p) => p.userId === userId);
}

export type Hasil<T> = { ok: true; data: T } | { ok: false; kode: string; pesan: string };

export async function buatProyekServer(
  u: Pengguna,
  masukan: { id?: string; judul: string; kategoriId: string; kategoriKustom?: KategoriKustom | null },
): Promise<Hasil<ProyekServer>> {
  const tier = tierEfektif(u);
  const milik = await proyekPengguna(u.id);
  if (masukan.id && milik.some((p) => p.id === masukan.id)) {
    return { ok: true, data: milik.find((p) => p.id === masukan.id)! };
  }
  if (tier === "gratis" && milik.length >= MAKS_PROYEK_GRATIS) {
    return {
      ok: false,
      kode: "BATAS_PROYEK",
      pesan:
        "Lapis gratis hanya boleh 1 proyek. Naik ke Premium untuk membuat proyek tambahan — proyek lama Anda tidak hilang.",
    };
  }
  const proyek: ProyekServer = {
    id: masukan.id?.trim() || idAcak("proyek-"),
    userId: u.id,
    judul: masukan.judul.slice(0, 300),
    kategoriId: masukan.kategoriId.slice(0, 80),
    kategoriKustom: masukan.kategoriKustom ?? null,
    gantiKategoriTerpakai: false,
    terkunciRuangLingkup: false,
    footnotePerParagraf: {},
    totalFootnote: 0,
    dibuat: new Date().toISOString(),
  };
  await simpan("proyek", proyek as unknown as Record<string, unknown> & { id: string });
  return { ok: true, data: proyek };
}

/**
 * Ganti ruang lingkup: ditolak bila sudah terkunci (footnote pertama) atau
 * jatah ganti sekali sudah habis. Mengganti = proyek baru adalah konsekuensi
 * yang ditampilkan UI lewat pesan penolakan ini.
 */
export async function gantiKategori(
  u: Pengguna,
  proyekId: string,
  kategori: { kategoriId: string; kategoriKustom?: KategoriKustom | null },
): Promise<Hasil<ProyekServer>> {
  const p = (await ambil("proyek", proyekId)) as unknown as ProyekServer | null;
  if (!p || p.userId !== u.id) return { ok: false, kode: "TIDAK_ADA", pesan: "Proyek tidak ditemukan." };
  if (p.terkunciRuangLingkup) {
    return {
      ok: false,
      kode: "RUANG_LINGKUP_TERKUNCI",
      pesan:
        "Ruang lingkup proyek ini sudah terkunci karena footnote pertama telah terpasang. Untuk bidang lain, buat proyek baru.",
    };
  }
  if (p.gantiKategoriTerpakai) {
    return {
      ok: false,
      kode: "GANTI_SUDAH_TERPAKAI",
      pesan: "Jatah ganti kategori satu kali sudah terpakai. Ruang lingkup tidak bisa diganti lagi pada proyek ini.",
    };
  }
  const baru: ProyekServer = {
    ...p,
    kategoriId: kategori.kategoriId.slice(0, 80),
    kategoriKustom: kategori.kategoriKustom ?? null,
    gantiKategoriTerpakai: true,
  };
  await simpan("proyek", baru as unknown as Record<string, unknown> & { id: string });
  return { ok: true, data: baru };
}

/**
 * Daftarkan satu footnote yang hendak dipasang. Untuk gratis, footnote
 * ke-4 dalam paragraf yang sama DITOLAK. Footnote pertama (di paragraf
 * mana pun) mengunci ruang lingkup proyek.
 */
export async function daftarFootnote(
  u: Pengguna,
  proyekId: string,
  paragrafId: string,
): Promise<Hasil<{ nomorDalamParagraf: number; terkunciRuangLingkup: boolean }>> {
  let p = (await ambil("proyek", proyekId)) as unknown as ProyekServer | null;
  if (!p) {
    // Proyek lokal lama yang belum tercatat: daftarkan otomatis agar
    // aturan lapis tetap berlaku mulai dari footnote ini.
    const buat = await buatProyekServer(u, { id: proyekId, judul: "(proyek terdaftar otomatis)", kategoriId: "umum" });
    if (!buat.ok) return buat;
    p = buat.data;
  }
  if (p.userId !== u.id) return { ok: false, kode: "BUKAN_MILIK", pesan: "Proyek ini bukan milik Anda." };
  const tier = tierEfektif(u);
  const sekarang = p.footnotePerParagraf[paragrafId] ?? 0;
  if (tier === "gratis" && sekarang >= MAKS_FOOTNOTE_GRATIS_PER_PARAGRAF) {
    return {
      ok: false,
      kode: "BATAS_FOOTNOTE",
      pesan: `Lapis gratis maksimal ${MAKS_FOOTNOTE_GRATIS_PER_PARAGRAF} footnote dalam satu paragraf. Premium membuka footnote tanpa batas per paragraf.`,
    };
  }
  const baru: ProyekServer = {
    ...p,
    footnotePerParagraf: { ...p.footnotePerParagraf, [paragrafId]: sekarang + 1 },
    totalFootnote: p.totalFootnote + 1,
    terkunciRuangLingkup: p.terkunciRuangLingkup || p.totalFootnote + 1 >= 1,
  };
  await simpan("proyek", baru as unknown as Record<string, unknown> & { id: string });
  return { ok: true, data: { nomorDalamParagraf: sekarang + 1, terkunciRuangLingkup: baru.terkunciRuangLingkup } };
}

/**
 * Profil kata kunci untuk kategori kustom (keputusan D): AI menyusunnya
 * lewat kolam; bila AI tidak tersedia, profil deterministik dari nama tema
 * dipakai agar fitur tidak mati — ditandai jujur lewat bidang `dariAI`.
 */
export async function profilKategoriKustom(
  nama: string,
): Promise<{ profil: KategoriKustom; dariAI: boolean }> {
  const bersih = nama.trim().slice(0, 120);
  try {
    const hasil = await panggilKolam({
      sistem:
        "Anda menyusun profil kata kunci pencarian akademik. Keluarkan HANYA JSON: {\"arab\":[\"...\"],\"indonesia\":[\"...\"],\"inggris\":[\"...\"]} masing-masing 5 frasa pencarian khas untuk tema yang diberikan. Jangan mengarang nama kitab/penulis.",
      pengguna: `Tema bidang: ${bersih}`,
      maksToken: 500,
      json: true,
    });
    const j = JSON.parse(hasil.teks.slice(hasil.teks.indexOf("{"), hasil.teks.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : []);
    const kata = [...arr(j.arab), ...arr(j.indonesia), ...arr(j.inggris)];
    if (kata.length >= 3) return { profil: { nama: bersih, profilKata: kata }, dariAI: true };
  } catch { /* jatuh ke deterministik */ }
  const kataDasar = bersih
    .split(/[\s,;]+/)
    .filter((k) => k.length >= 3)
    .slice(0, 6);
  return { profil: { nama: bersih, profilKata: kataDasar.length ? kataDasar : [bersih] }, dariAI: false };
}

/**
 * Aktifkan/perpanjang premium pengguna selama N hari.
 *
 * Bila `orderId` diberikan, perpanjangan bersifat IDEMPOTEN per order
 * (audit keamanan bayar 28 Okt 2026): order yang sama tidak pernah
 * memperpanjang dua kali, walau webhook-nya diterima berulang atau
 * bersamaan. Daftar order terapan disimpan pada catatan pengguna.
 */
export async function aktifkanPremium(u: Pengguna, hari = 30, orderId?: string): Promise<Pengguna> {
  if (orderId && (u.orderPremiumDiterapkan ?? []).includes(orderId)) return u;
  const dasar = u.premiumSampai && new Date(u.premiumSampai).getTime() > Date.now()
    ? new Date(u.premiumSampai)
    : new Date();
  dasar.setDate(dasar.getDate() + hari);
  const baru: Pengguna = {
    ...u,
    tier: "premium",
    premiumSampai: dasar.toISOString(),
    premiumDiaktifkanPada: new Date().toISOString(),
    ...(orderId
      ? {
          premiumSumber: "midtrans",
          orderPremiumDiterapkan: [...(u.orderPremiumDiterapkan ?? []), orderId],
        }
      : {}),
  };
  await simpan("pengguna", baru as unknown as Record<string, unknown> & { id: string });
  return baru;
}

/**
 * Tempelkan premium 30 hari ke identitas lewat KUNCI PREMIUM bersama
 * (keputusan pemilik, 28 Okt 2026 — sumber aktivasi "kunci-premium").
 *
 * Perilaku yang dipilih, konsisten dengan semangat idempotensi webhook
 * (satu peristiwa pembayaran tidak pernah memanen perpanjangan berulang):
 * kunci bersama BUKAN order baru. Jadi:
 *  - Premium masih aktif → TIDAK berubah sama sekali (tidak menumpuk,
 *    tidak memperpanjang). Mengulang kunci yang sama bukan perpanjangan.
 *  - Premium belum aktif / sudah kedaluwarsa → aktif 30 hari dari sekarang.
 * Premium menempel di catatan identitas (store), BUKAN pada nilai env —
 * merotasi UTH_ACCESS_KEY tidak mencabutnya; pemilik memulihkan akses
 * pembeli lewat mode identitas di /api/masuk.
 */
export async function aktifkanPremiumDariKunci(u: Pengguna): Promise<Pengguna> {
  if (tierEfektif(u) === "premium") return u;
  const sampai = new Date(Date.now() + 30 * 24 * 3_600_000);
  const baru: Pengguna = {
    ...u,
    tier: "premium",
    premiumSampai: sampai.toISOString(),
    premiumSumber: "kunci-premium",
    premiumDiaktifkanPada: new Date().toISOString(),
  };
  await simpan("pengguna", baru as unknown as Record<string, unknown> & { id: string });
  return baru;
}
