/**
 * Adapter Midtrans Snap (Fase 3, keputusan I).
 *
 * - Mode dari env: MIDTRANS_IS_PRODUCTION=1 → produksi; selain itu sandbox.
 * - Bila MIDTRANS_SERVER_KEY belum diisi pemilik (pendaftaran + KYC adalah
 *   aksi pemilik), gerbang dinyatakan BELUM AKTIF secara jujur — endpoint
 *   pemanggil membalas 503, bukan berpura-pura berhasil.
 * - Webhook hanya dipercaya setelah signature_key terverifikasi:
 *   SHA512(order_id + status_code + gross_amount + server_key).
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const HARGA_PREMIUM_IDR = 10_000;

export function midtransTerkonfigurasi(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY?.trim());
}

export function midtransProduksi(): boolean {
  return process.env.MIDTRANS_IS_PRODUCTION?.trim() === "1";
}

function basisSnap(): string {
  // Override hanya untuk pengujian/proxy resmi (mis. stub lokal rangkaian uji).
  const override = process.env.MIDTRANS_API_BASE?.trim();
  if (override) return override.replace(/\/$/, "");
  return midtransProduksi() ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
}

export function urlSnapJs(): string {
  return `${basisSnap()}/snap/snap.js`;
}

export function kunciKlienMidtrans(): string {
  return process.env.MIDTRANS_CLIENT_KEY?.trim() ?? "";
}

export async function buatTransaksiSnap(opsi: {
  orderId: string;
  jumlah: number;
  email: string;
  nama: string;
}): Promise<{ token: string; redirectUrl: string }> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY!.trim();
  const res = await fetch(`${basisSnap()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
    },
    body: JSON.stringify({
      transaction_details: { order_id: opsi.orderId, gross_amount: opsi.jumlah },
      customer_details: { email: opsi.email, first_name: opsi.nama || "Pengguna Uthruha" },
      item_details: [
        { id: "premium-30", price: opsi.jumlah, quantity: 1, name: "Uthruha Premium 30 hari" },
      ],
      enabled_payments: ["qris", "gopay", "shopeepay", "other_qris"],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Midtrans HTTP ${res.status}`);
  const j = (await res.json()) as { token?: string; redirect_url?: string };
  if (!j.token) throw new Error("Midtrans tidak mengembalikan token");
  return { token: j.token, redirectUrl: j.redirect_url ?? "" };
}

/** Verifikasi tanda tangan webhook Midtrans. */
export function verifikasiSignature(body: {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
}): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) return false;
  if (!body.order_id || !body.status_code || !body.gross_amount || !body.signature_key) return false;
  const harap = createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
    .digest("hex");
  const a = Buffer.from(harap);
  const b = Buffer.from(body.signature_key);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Petakan status gateway ke status internal mesin pembayaran. */
export function petakanStatus(
  transactionStatus: string,
  fraudStatus?: string,
): "lunas" | "menunggu" | "gagal" | "refund" {
  switch (transactionStatus) {
    case "settlement":
      return "lunas";
    case "capture":
      return fraudStatus === "challenge" ? "menunggu" : "lunas";
    case "pending":
      return "menunggu";
    case "refund":
    case "partial_refund":
      return "refund";
    default:
      return "gagal"; // deny, cancel, expire, failure
  }
}
