import { NextResponse } from "next/server";
import { penggunaDariRequest, tierEfektif } from "@/lib/server/identitas";
import { proyekPengguna } from "@/lib/server/lapis";
import { statusKolam } from "@/lib/server/kolam";

export const runtime = "nodejs";

/** Status lapis pemanggil: tier, masa premium, jumlah proyek, status kolam. */
export async function GET(req: Request) {
  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ pengguna: null, tier: "tamu" });
  const proyek = await proyekPengguna(u.id);
  return NextResponse.json({
    pengguna: { id: u.id, email: u.email, nama: u.nama, foto: u.foto },
    tier: tierEfektif(u),
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
    kolam: await statusKolam(),
  });
}
