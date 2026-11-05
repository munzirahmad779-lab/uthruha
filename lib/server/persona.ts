/**
 * Akun uji coba berbasis email untuk agen AI lain milik pemilik
 * (perintah pemilik, 6 Nov 2026; pengembangan jalur persona tunggal
 * 5 Nov 2026 yang kini pensiun).
 *
 * Di halaman /masuk, di bawah tombol masuk Google, ada formulir email
 * biasa. Formulir itu HANYA menerima sepuluh email pada daftar putih
 * di bawah ini; tiap email memetakan ke akun ujinya SENDIRI (bukan
 * satu persona bersama): lapisnya terkunci dari tabel, judul proyek
 * tetapnya dibawa akun dan diwujudkan sebagai proyek oleh bootstrap
 * peramban di halaman daftar proyek.
 *
 * Keamanan jalur ini BUKAN gerbang middleware, melainkan:
 *  - Saklar env UTH_PERSONA_AKTIF harus persis "1"; nilai lain berarti
 *    jalur mati total (formulir tidak dirender, API menjawab 404,
 *    seolah tidak pernah ada). Syarat kunci bersama jalur lama
 *    (UTH_PERSONA_KUNCI) GUGUR: daftar putih inilah gerbangnya.
 *  - Email di luar daftar ditolak dengan pesan umum yang sama untuk
 *    semua keadaan tertutup, dan daftar ini TIDAK ditampilkan di
 *    halaman publik mana pun.
 *  - Akun-akunnya berlabel Akun Uji (personaUji) di Super Admin dan
 *    bisa dinonaktifkan di sana; penonaktifan mematikan sesi yang
 *    sedang berjalan karena penggunaDariCookie menolak catatan
 *    nonaktif.
 *
 * Akun uji TIDAK pernah mahasiswa dan TIDAK memakai kunci API
 * pribadi: ia tidak melewati sinkronMahasiswa dan tidak menyetor
 * kunci apa pun. Ia juga tidak disaring perangkat (agen penguji
 * berjalan dari lingkungan yang berganti-ganti) dan tidak menerima
 * email pemberitahuan masuk (akun mesin, bukan manusia).
 */
import { ambil, simpan } from "./store";
import type { Pengguna } from "./identitas";

/** Satu baris daftar putih akun uji. */
export interface AkunUjiDef {
  email: string;
  /** Lapis akun, TERKUNCI dari tabel ini (tidak bisa diubah sesi). */
  tier: "gratis" | "premium";
  /** Judul proyek tetap akun ini, ditampilkan persis seperti ini. */
  judulProyek: string;
  /** Bidang proyek tetap (id dari lib/content/bidang.ts). */
  bidangId: string;
}

/**
 * Daftar putih akun uji (perintah pemilik, 6 Nov 2026). Urutan dan
 * isi tabel ini adalah ketetapan pemilik; mengubahnya berarti
 * mengubah siapa yang boleh masuk sebagai akun uji.
 */
export const AKUN_UJI: AkunUjiDef[] = [
  { email: "rahmawati.salsabila92@uji.kitabah.web.id", tier: "gratis", judulProyek: "Konsep Wakaf Produktif dalam Fikih Muamalah Kontemporer", bidangId: "iqtishad" },
  { email: "fajar.pratama171@uji.kitabah.web.id", tier: "gratis", judulProyek: "Metode Tafsir Tematik dalam Studi Al-Qur'an", bidangId: "quran" },
  { email: "nur.hikmah034@uji.kitabah.web.id", tier: "gratis", judulProyek: "Peran Zakat dalam Pemberdayaan Ekonomi Umat", bidangId: "iqtishad" },
  { email: "dandi.setiawan58@uji.kitabah.web.id", tier: "gratis", judulProyek: "Etika Dakwah di Media Sosial Perspektif Hadis", bidangId: "dakwah" },
  { email: "siti.maryam207@uji.kitabah.web.id", tier: "gratis", judulProyek: "Sejarah Perkembangan Pondok Pesantren di Sulawesi Selatan", bidangId: "tarikh" },
  { email: "andi.basri64@uji.kitabah.web.id", tier: "premium", judulProyek: "حكم uang panai في الشريعة الإسلامية: دراسة مقاصدية", bidangId: "fiqh" },
  { email: "yusra.amilia19@uji.kitabah.web.id", tier: "premium", judulProyek: "التكامل المعرفي بين علوم القرآن وأصول الفقه: دراسة فكرية", bidangId: "fiqh" },
  { email: "muh.ridwan883@uji.kitabah.web.id", tier: "premium", judulProyek: "Hukum Khulu' dan Akibat Hukumnya dalam Fikih Munakahat", bidangId: "fiqh" },
  { email: "fitriani.zahra42@uji.kitabah.web.id", tier: "premium", judulProyek: "Maqashid Syariah dalam Penetapan Hukum Keluarga", bidangId: "fiqh" },
  { email: "ikhlasul.amal76@uji.kitabah.web.id", tier: "premium", judulProyek: "Kritik Sanad Hadis dalam Kitab Shahih al-Bukhari: Studi Ilmu Hadis", bidangId: "hadis" },
];

/** Apakah jalur akun uji aktif: hanya saklar env yang menentukan. */
export function personaAktif(): boolean {
  return process.env.UTH_PERSONA_AKTIF === "1";
}

/** Normalisasi email masukan: pangkas spasi dan samakan huruf kecil. */
export function normalisasiEmailUji(masuk: unknown): string {
  return typeof masuk === "string" ? masuk.trim().toLowerCase() : "";
}

/** Cari baris daftar putih untuk email masukan; null bila di luar daftar. */
export function cariAkunUji(masuk: unknown): AkunUjiDef | null {
  const e = normalisasiEmailUji(masuk);
  if (!e) return null;
  return AKUN_UJI.find((a) => a.email === e) ?? null;
}

/**
 * Nama tampilan dari email: bagian lokal dipisah pada titik, digit di
 * akhir tiap token dibuang, tiap token dikapitalkan, lalu digabung
 * dengan spasi. MURNI dan deterministik (diuji untuk kesepuluh email).
 * Contoh: "muh.ridwan883" menjadi "Muh Ridwan".
 */
export function namaDariEmail(email: string): string {
  const lokal = (email.split("@")[0] ?? "").toLowerCase();
  return lokal
    .split(".")
    .map((t) => t.replace(/\d+$/u, ""))
    .filter((t) => t.length > 0)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(" ");
}

/** ID akun yang deterministik dari emailnya (stabil antar masuk). */
export function idAkunUji(email: string): string {
  const lokal = (email.split("@")[0] ?? "").toLowerCase().replace(/\./g, "-");
  return `uji-${lokal}`;
}

/**
 * Ambil akun uji dari store; buat baru bila belum ada. Nama, email,
 * dan lapis pada catatan yang sudah ada DISAMAKAN ke tabel (lapis
 * terkunci: sesi atau suntingan lama tidak bisa mengubahnya). Catatan
 * yang sudah dinonaktifkan pemilik dikembalikan apa adanya: fungsi
 * ini TIDAK pernah mengaktifkan ulang akun nonaktif; pemanggil yang
 * wajib menolaknya.
 */
export async function ambilAkunUji(def: AkunUjiDef): Promise<Pengguna> {
  const id = idAkunUji(def.email);
  const nama = namaDariEmail(def.email);
  const ada = (await ambil("pengguna", id)) as unknown as Pengguna | null;
  if (ada) {
    if (
      ada.email !== def.email ||
      ada.nama !== nama ||
      ada.tier !== def.tier ||
      ada.premiumSampai !== null ||
      ada.personaUji !== true
    ) {
      const baru: Pengguna = {
        ...ada,
        email: def.email,
        nama,
        tier: def.tier,
        premiumSampai: null,
        personaUji: true,
      };
      await simpan("pengguna", baru as unknown as Record<string, unknown> & { id: string });
      return baru;
    }
    return ada;
  }
  const baru: Pengguna = {
    id,
    email: def.email,
    nama,
    foto: "",
    tier: def.tier,
    premiumSampai: null,
    dibuat: new Date().toISOString(),
    personaUji: true,
  };
  await simpan("pengguna", baru as unknown as Record<string, unknown> & { id: string });
  return baru;
}
