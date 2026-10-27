import { NextResponse } from "next/server";
import { penggunaDariRequest } from "@/lib/server/identitas";
import { idAcak, simpan } from "@/lib/server/store";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

/**
 * "Laporkan Kendala" (keputusan I): TIDAK ada pengembalian otomatis.
 * Laporan menjadi catatan insiden bertenggat 6 jam yang wajib dibereskan
 * admin; bila layanan premium terbukti gagal dari sisi sistem dan tidak
 * pulih dalam tenggat itu, admin mengembalikan dana PENUH secara manual
 * dari dasbor Midtrans.
 */
export async function POST(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const laju = bolehLaju(`insiden:${ipKlien(req)}`, 5, 3_600_000);
  if (!laju.boleh) return balasanLaju(laju.ulangDetik, "Terlalu banyak laporan. Coba lagi nanti.");

  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Masuk dengan Google dulu." }, { status: 401 });
  // Audit keamanan bayar (28 Okt 2026): batas PER PENGGUNA di samping batas
  // per IP — satu akun tidak bisa membanjiri antrean admin dengan memutar IP.
  const lajuUser = bolehLaju(`insiden-user:${u.id}`, 5, 3_600_000);
  if (!lajuUser.boleh) return balasanLaju(lajuUser.ulangDetik, "Terlalu banyak laporan. Coba lagi nanti.");

  const body = (await req.json().catch(() => null)) as { pesan?: string; konteks?: string } | null;
  const pesan = body?.pesan?.trim().slice(0, 2000) ?? "";
  if (pesan.length < 10) return NextResponse.json({ error: "Ceritakan kendalanya sedikit lebih lengkap (min. 10 karakter)." }, { status: 400 });

  const sekarang = new Date();
  const tenggat = new Date(sekarang.getTime() + 6 * 3_600_000);
  const insiden = {
    id: idAcak("INS-"),
    userId: u.id,
    email: u.email,
    pesan,
    konteks: (body?.konteks ?? "").slice(0, 200),
    status: "terbuka",
    dibuat: sekarang.toISOString(),
    tenggat: tenggat.toISOString(),
    standar: "Dibereskan ≤6 jam, atau dana kembali penuh via refund manual admin bila kegagalan dari sistem.",
  };
  await simpan("insiden", insiden);
  return NextResponse.json({ insiden: { id: insiden.id, tenggat: insiden.tenggat, status: insiden.status } });
}
