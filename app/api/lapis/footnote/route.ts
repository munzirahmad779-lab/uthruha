import { NextResponse } from "next/server";
import { penggunaDariRequest } from "@/lib/server/identitas";
import { daftarFootnote } from "@/lib/server/lapis";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

/**
 * Gerbang penyisipan footnote: klien WAJIB memanggil ini sebelum memasang.
 * Di sinilah batas 3 footnote/paragraf (gratis) dan kunci ruang lingkup
 * (footnote pertama) ditegakkan di server.
 */
export async function POST(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const laju = bolehLaju(`lapis-footnote:${ipKlien(req)}`, 60, 60_000);
  if (!laju.boleh) return balasanLaju(laju.ulangDetik, "Terlalu banyak permintaan.");

  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Belum masuk dengan Google." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { proyekId?: string; paragrafId?: string } | null;
  if (!body?.proyekId || !body?.paragrafId) {
    return NextResponse.json({ error: "proyekId dan paragrafId wajib." }, { status: 400 });
  }
  const hasil = await daftarFootnote(u, body.proyekId, body.paragrafId.slice(0, 120));
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan, kode: hasil.kode }, { status: 403 });
  return NextResponse.json(hasil.data);
}
