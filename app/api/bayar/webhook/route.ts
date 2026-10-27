import { NextResponse } from "next/server";
import { petakanStatus, verifikasiSignature } from "@/lib/server/bayar";
import { aktifkanPremium } from "@/lib/server/lapis";
import { ambil, simpan } from "@/lib/server/store";
import type { Pengguna } from "@/lib/server/identitas";

export const runtime = "nodejs";

/**
 * Webhook Midtrans — SATU-SATUNYA jalan premium menyala.
 * Tanpa cookie/sesi (server-ke-server Midtrans); keamanannya adalah
 * signature_key SHA512 yang diverifikasi dengan server key. Redirect
 * peramban dari Snap TIDAK pernah dipercaya untuk mengubah status.
 * (Rute ini bebas dari gerbang kunci akses di middleware — lihat JALUR_BEBAS.)
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    order_id?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
    transaction_status?: string;
    fraud_status?: string;
    payment_type?: string;
  } | null;
  if (!body?.order_id) return NextResponse.json({ error: "order_id kosong" }, { status: 400 });

  if (!verifikasiSignature(body)) {
    console.error("[bayar/webhook] signature_key TIDAK SAH untuk order", body.order_id);
    return NextResponse.json({ error: "signature tidak sah" }, { status: 403 });
  }

  const rec = await ambil("pembayaran", body.order_id);
  if (!rec) return NextResponse.json({ error: "order tidak dikenal" }, { status: 404 });

  const statusBaru = petakanStatus(body.transaction_status ?? "", body.fraud_status);
  const sudahLunas = rec.statusInternal === "lunas_final";
  const diperbarui = {
    ...rec,
    statusGateway: body.transaction_status ?? "",
    paymentType: body.payment_type ?? rec.paymentType ?? "",
    statusInternal:
      statusBaru === "lunas" ? "lunas_final" : statusBaru === "refund" ? "refund" : statusBaru === "gagal" ? "gagal" : "menunggu_bayar",
    dibayarPada: statusBaru === "lunas" ? new Date().toISOString() : rec.dibayarPada ?? null,
    webhookTerakhir: new Date().toISOString(),
  };
  await simpan("pembayaran", diperbarui);

  // Aktifkan premium sekali saja per order (idempoten terhadap webhook ganda).
  if (statusBaru === "lunas" && !sudahLunas) {
    const pengguna = (await ambil("pengguna", String(rec.userId))) as unknown as Pengguna | null;
    if (pengguna) await aktifkanPremium(pengguna, 30);
  }

  return NextResponse.json({ ok: true });
}
