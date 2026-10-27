import { NextResponse } from "next/server";
import { penggunaDariRequest } from "@/lib/server/identitas";
import { gantiKategori, profilKategoriKustom, type KategoriKustom } from "@/lib/server/lapis";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

/**
 * POST { proyekId, kategoriId }          → ganti ruang lingkup (aturan kunci).
 * POST { kustom: "nama tema" }            → susun profil kategori kustom.
 * POST { proyekId, kustom: "nama tema" } → ganti ke kategori kustom (mengikuti
 *                                            aturan kunci yang sama).
 */
export async function POST(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const laju = bolehLaju(`lapis-kategori:${ipKlien(req)}`, 15, 60_000);
  if (!laju.boleh) return balasanLaju(laju.ulangDetik, "Terlalu banyak permintaan.");

  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Belum masuk dengan Google." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    proyekId?: string;
    kategoriId?: string;
    kustom?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "Badan permintaan kosong." }, { status: 400 });

  if (body.kustom?.trim() && !body.proyekId) {
    const { profil, dariAI } = await profilKategoriKustom(body.kustom);
    return NextResponse.json({ kategoriKustom: profil, dariAI });
  }
  if (!body.proyekId) return NextResponse.json({ error: "proyekId wajib." }, { status: 400 });

  let kategoriKustom: KategoriKustom | null = null;
  let kategoriId = body.kategoriId?.trim() ?? "";
  if (body.kustom?.trim()) {
    const { profil } = await profilKategoriKustom(body.kustom);
    kategoriKustom = profil;
    kategoriId = `kustom:${profil.nama.toLowerCase().replace(/\s+/g, "-").slice(0, 60)}`;
  }
  if (!kategoriId) return NextResponse.json({ error: "kategoriId/kustom wajib." }, { status: 400 });

  const hasil = await gantiKategori(u, body.proyekId, { kategoriId, kategoriKustom });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan, kode: hasil.kode }, { status: 403 });
  return NextResponse.json({ proyek: hasil.data });
}
