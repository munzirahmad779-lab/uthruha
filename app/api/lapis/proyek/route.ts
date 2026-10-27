import { NextResponse } from "next/server";
import { penggunaDariRequest } from "@/lib/server/identitas";
import { buatProyekServer, proyekPengguna, type KategoriKustom } from "@/lib/server/lapis";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Belum masuk dengan Google." }, { status: 401 });
  return NextResponse.json({ proyek: await proyekPengguna(u.id) });
}

/** Buat proyek tercatat di server — di sinilah batas 1 proyek gratis ditegakkan. */
export async function POST(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const laju = bolehLaju(`lapis-proyek:${ipKlien(req)}`, 20, 60_000);
  if (!laju.boleh) return balasanLaju(laju.ulangDetik, "Terlalu banyak permintaan.");

  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Belum masuk dengan Google." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    judul?: string;
    kategoriId?: string;
    kategoriKustom?: KategoriKustom | null;
  } | null;
  if (!body?.judul?.trim() || !body?.kategoriId?.trim()) {
    return NextResponse.json({ error: "Judul dan kategori wajib diisi." }, { status: 400 });
  }
  const hasil = await buatProyekServer(u, {
    id: body.id,
    judul: body.judul,
    kategoriId: body.kategoriId,
    kategoriKustom: body.kategoriKustom ?? null,
  });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan, kode: hasil.kode }, { status: 403 });
  return NextResponse.json({ proyek: hasil.data });
}
