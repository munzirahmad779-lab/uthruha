import { NextResponse } from "next/server";
import { apakahAdmin } from "@/lib/server/admin";
import { penggunaDariRequest, tierEfektif } from "@/lib/server/identitas";
import { proyekPengguna } from "@/lib/server/lapis";
import { statusKolam } from "@/lib/server/kolam";
import { loginGoogleAktif } from "@/lib/security/akses";

export const runtime = "nodejs";

/** Status lapis pemanggil: tier, masa premium, jumlah proyek, status kolam. */
export async function GET(req: Request) {
  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ pengguna: null, tier: "tamu", loginGoogleAktif: loginGoogleAktif() });
  const proyek = await proyekPengguna(u.id);
  return NextResponse.json({
    pengguna: { id: u.id, email: u.email, nama: u.nama, foto: u.foto },
    tier: tierEfektif(u),
    loginGoogleAktif: loginGoogleAktif(),
    premiumSampai: u.premiumSampai,
    jumlahProyek: proyek.length,
    proyek: proyek.map((p) => ({
      id: p.id,
      judul: p.judul,
      kategoriId: p.kategoriId,
      kategoriKustom: p.kategoriKustom,
      terkunciRuangLingkup: p.terkunciRuangLingkup,
      totalFootnote: p.totalFootnote,
    })),
    // Pengencangan 3 Nov 2026 (S-6): keadaan kolam kunci (jumlah dan
    // kesehatan kunci, termasuk premium) hanya untuk admin. Panel
    // admin membacanya lewat /api/admin/laporan, bukan dari sini.
    kolam: apakahAdmin(u) ? await statusKolam() : null,
  });
}
