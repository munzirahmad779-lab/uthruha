import { NextResponse } from "next/server";
import { penggunaDariCookie, tierEfektif } from "@/lib/server/identitas";
import { cariAkunUji } from "@/lib/server/persona";
import {
  gerbangGratisAktif,
  loginGoogleAktif,
  sidikKunciGratisAktif,
  tandaSama,
} from "@/lib/security/akses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status identitas pemanggil — dibaca halaman /masuk SEBELUM gerbang
 * terbuka, jadi endpoint ini sengaja hanya memeriksa cookie identitas
 * (uthruha_user) milik pemanggil sendiri, bukan cookie gerbang. Ia
 * tidak membocorkan apa pun tentang pengguna lain dan tidak memberi
 * akses: `bisaMasukTanpaKunci` hanya memberi tahu UI apakah mode
 * identitas di /api/masuk akan diterima server (keputusan akhir tetap
 * di server saat POST itu terjadi).
 */
export async function GET(req: Request) {
  // TAHAN LOGIN GOOGLE: saat flag mati, endpoint ini tidak mengiklankan
  // mode identitas (bisaMasukTanpaKunci selalu false) dan menyatakan
  // terus terang loginGoogleAktif: false agar UI tidak menampilkan
  // tombol/pemulihan sesi Google yang belum aktif.
  const googleAktif = loginGoogleAktif();
  const pengguna = await penggunaDariCookie(req.headers.get("cookie"));
  if (!pengguna) {
    return NextResponse.json(
      { pengguna: null, tier: "tamu", premiumSampai: null, kunciGratisTerverifikasi: false, bisaMasukTanpaKunci: false, loginGoogleAktif: googleAktif },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const sidikAktif = gerbangGratisAktif() ? sidikKunciGratisAktif() : null;
  const kunciGratisTerverifikasi = Boolean(
    sidikAktif &&
      pengguna.sidikKunciGratis &&
      tandaSama(pengguna.sidikKunciGratis, sidikAktif),
  );
  const tier = tierEfektif(pengguna);

  // Proyek tetap akun uji (6 Nov 2026): HANYA untuk akun berlabel
  // personaUji, status ikut membawa judul dan bidang proyek tetapnya
  // dari daftar putih, agar bootstrap peramban di halaman daftar
  // proyek bisa mewujudkannya satu kali. Akun biasa tidak menerima
  // kedua field ini sama sekali.
  const defUji = pengguna.personaUji ? cariAkunUji(pengguna.email) : null;

  return NextResponse.json(
    {
      pengguna: {
        id: pengguna.id,
        email: pengguna.email,
        nama: pengguna.nama,
        foto: pengguna.foto,
      },
      tier,
      premiumSampai: pengguna.premiumSampai,
      kunciGratisTerverifikasi,
      bisaMasukTanpaKunci: googleAktif && (tier === "premium" || kunciGratisTerverifikasi),
      loginGoogleAktif: googleAktif,
      ...(defUji
        ? { judulProyekUji: defUji.judulProyek, bidangProyekUji: defUji.bidangId }
        : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
