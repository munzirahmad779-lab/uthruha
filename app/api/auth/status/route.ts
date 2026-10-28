import { NextResponse } from "next/server";
import { penggunaDariCookie, tierEfektif } from "@/lib/server/identitas";
import {
  gerbangGratisAktif,
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
  const pengguna = await penggunaDariCookie(req.headers.get("cookie"));
  if (!pengguna) {
    return NextResponse.json(
      { pengguna: null, tier: "tamu", premiumSampai: null, kunciGratisTerverifikasi: false, bisaMasukTanpaKunci: false },
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
      bisaMasukTanpaKunci: tier === "premium" || kunciGratisTerverifikasi,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
