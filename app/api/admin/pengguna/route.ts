/**
 * TINDAKAN SUPER ADMIN ATAS AKUN (perintah pemilik, 3 Nov 2026):
 * POST /api/admin/pengguna { userId, aksi } dengan aksi:
 *  - "nonaktifkan": akun dikunci total (semua lapis, termasuk premium).
 *    Sesi yang sedang berjalan mati karena penggunaDariCookie menolak
 *    catatan nonaktif. Tier dan data akun TIDAK diubah.
 *  - "aktifkan": penonaktifan dicabut, akun kembali seperti semula.
 *  - "premium": premium 30 hari ditempel langsung dari server
 *    (premiumSumber "admin", kaidah sama dengan kunci premium bersama:
 *    premium yang masih aktif tidak ditumpuk dan tidak diperpanjang).
 * Hanya sesi pemilik (daftar email admin) yang boleh; admin tidak bisa
 * menonaktifkan akunnya sendiri agar tidak terkunci keluar.
 */
import { NextResponse } from "next/server";
import { apakahAdmin } from "@/lib/server/admin";
import { penggunaDariRequest, tierEfektif, type Pengguna } from "@/lib/server/identitas";
import { ambil, perbarui } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AKSI = ["nonaktifkan", "aktifkan", "premium"] as const;
type Aksi = (typeof AKSI)[number];

export async function POST(req: Request) {
  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  if (!apakahAdmin(u)) {
    return NextResponse.json({ error: "Halaman ini khusus pemilik layanan." }, { status: 403 });
  }

  let body: { userId?: unknown; aksi?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Isi permintaan tidak sah." }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const aksi = AKSI.includes(body.aksi as Aksi) ? (body.aksi as Aksi) : null;
  if (!userId || !aksi) {
    return NextResponse.json({ error: "userId dan aksi wajib diisi dengan benar." }, { status: 400 });
  }

  const target = (await ambil("pengguna", userId)) as unknown as Pengguna | null;
  if (!target) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  if (aksi === "nonaktifkan") {
    if (target.id === u.id) {
      return NextResponse.json(
        { error: "Akun pemilik yang sedang masuk tidak bisa dinonaktifkan." },
        { status: 400 },
      );
    }
    await perbarui("pengguna", userId, {
      nonaktif: true,
      dinonaktifkanPada: new Date().toISOString(),
      dinonaktifkanOleh: u.email,
    });
    return NextResponse.json({ ok: true, userId, nonaktif: true });
  }

  if (aksi === "aktifkan") {
    await perbarui("pengguna", userId, {
      nonaktif: false,
      dinonaktifkanPada: null,
      dinonaktifkanOleh: null,
    });
    return NextResponse.json({ ok: true, userId, nonaktif: false });
  }

  // aksi === "premium": tempel 30 hari dari server, tanpa kunci ditempel
  // penerima. Premium aktif tidak diubah (tidak menumpuk), sama seperti
  // kaidah kunci premium bersama di aktifkanPremiumDariKunci.
  if (tierEfektif(target) === "premium") {
    return NextResponse.json({
      ok: true,
      userId,
      catatan: "Akun ini sudah premium aktif; masa berlakunya tidak diubah.",
      premiumSampai: target.premiumSampai,
    });
  }
  const sampai = new Date(Date.now() + 30 * 24 * 3_600_000).toISOString();
  await perbarui("pengguna", userId, {
    tier: "premium",
    premiumSampai: sampai,
    premiumSumber: "admin",
    premiumDiaktifkanPada: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, userId, premiumSampai: sampai });
}
