import { NextResponse } from "next/server";
import { penggunaDariRequest, tierEfektif } from "@/lib/server/identitas";
import { HARGA_PREMIUM_IDR, buatTransaksiSnap, kunciKlienMidtrans, midtransTerkonfigurasi, urlSnapJs } from "@/lib/server/bayar";
import { idAcak, simpan } from "@/lib/server/store";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

/** Status gerbang pembayaran untuk halaman premium (tanpa rahasia server). */
export async function GET() {
  return NextResponse.json({
    terkonfigurasi: midtransTerkonfigurasi(),
    clientKey: midtransTerkonfigurasi() ? kunciKlienMidtrans() : "",
    snapJs: urlSnapJs(),
    harga: HARGA_PREMIUM_IDR,
    produksi: process.env.MIDTRANS_IS_PRODUCTION?.trim() === "1",
  });
}

/** Buat order premium 30 hari. Premium aktif HANYA lewat webhook terverifikasi. */
export async function POST(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const laju = bolehLaju(`bayar-buat:${ipKlien(req)}`, 10, 60_000);
  if (!laju.boleh) return balasanLaju(laju.ulangDetik, "Terlalu banyak permintaan.");

  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Masuk dengan Google dulu sebelum membayar." }, { status: 401 });
  // Audit keamanan bayar (28 Okt 2026): batas PER PENGGUNA di samping batas
  // per IP — memutar alamat IP tidak lagi memberi jatah order tanpa batas.
  const lajuUser = bolehLaju(`bayar-buat-user:${u.id}`, 5, 60_000);
  if (!lajuUser.boleh) return balasanLaju(lajuUser.ulangDetik, "Terlalu banyak permintaan.");
  if (tierEfektif(u) === "premium") {
    return NextResponse.json({ error: "Akun Anda sudah Premium dan masih berlaku." }, { status: 409 });
  }
  if (!midtransTerkonfigurasi()) {
    return NextResponse.json(
      {
        error:
          "Gerbang pembayaran belum diaktifkan pemilik (pendaftaran Midtrans + kunci server belum dipasang). Premium belum bisa dibeli saat ini — tidak ada dana yang diambil.",
        kode: "GERBANG_BELUM_AKTIF",
      },
      { status: 503 },
    );
  }

  const orderId = idAcak("UTH-");
  await simpan("pembayaran", {
    id: orderId,
    userId: u.id,
    email: u.email,
    paket: "premium-30",
    jumlah: HARGA_PREMIUM_IDR,
    statusInternal: "menunggu_bayar",
    statusGateway: "",
    dibuat: new Date().toISOString(),
    dibayarPada: null,
  });

  try {
    const snap = await buatTransaksiSnap({ orderId, jumlah: HARGA_PREMIUM_IDR, email: u.email, nama: u.nama });
    return NextResponse.json({ orderId, token: snap.token, redirectUrl: snap.redirectUrl });
  } catch (e) {
    return NextResponse.json(
      { error: `Gagal membuat transaksi di gerbang pembayaran: ${e instanceof Error ? e.message : "tidak dikenal"}` },
      { status: 502 },
    );
  }
}
