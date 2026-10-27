import { NextResponse } from "next/server";
import { formatGrossAmount, petakanStatus, verifikasiSignature } from "@/lib/server/bayar";
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
 *
 * Pengerasan audit keamanan bayar (28 Okt 2026):
 *  1. NOMINAL dicocokkan persis (string) dengan order yang tersimpan di
 *     server — tanda tangan sah untuk nominal lain TIDAK mengaktifkan apa
 *     pun dan dicatat sebagai anomali.
 *  2. Mesin status MONOTON: sekali `lunas_final`, status tidak pernah
 *     mundur (expire/deny susulan hanya dicatat); satu-satunya jalan keluar
 *     adalah `refund` (catatan saja — premium tidak dicabut otomatis,
 *     keputusan admin). Ini menutup rantai settlement→expire→settlement
 *     yang dulu bisa memanen perpanjangan berulang.
 *  3. Aktivasi IDEMPOTEN per order berlapis: antrean serial per order_id
 *     dalam proses + klaim `premiumDiaktifkanPada` ditulis pada catatan
 *     order SEBELUM perpanjangan + `aktifkanPremium` menolak order yang
 *     sudah pernah diterapkan pada pengguna.
 */

const antreanOrder = new Map<string, Promise<unknown>>();

/** Jalankan fn secara serial untuk satu order_id (mencegah balapan webhook). */
async function serialPerOrder<T>(orderId: string, fn: () => Promise<T>): Promise<T> {
  const ekor = (antreanOrder.get(orderId) ?? Promise.resolve()).then(fn, fn);
  const penanda = ekor.then(
    () => undefined,
    () => undefined,
  );
  antreanOrder.set(orderId, penanda);
  try {
    return await ekor;
  } finally {
    if (antreanOrder.get(orderId) === penanda) antreanOrder.delete(orderId);
  }
}

interface BadanWebhook {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as BadanWebhook | null;
  if (!body?.order_id) return NextResponse.json({ error: "order_id kosong" }, { status: 400 });

  if (!verifikasiSignature(body)) {
    console.error("[bayar/webhook] signature_key TIDAK SAH untuk order", body.order_id);
    return NextResponse.json({ error: "signature tidak sah" }, { status: 403 });
  }

  return serialPerOrder(body.order_id, async () => {
    const rec = await ambil("pembayaran", body.order_id!);
    if (!rec) return NextResponse.json({ error: "order tidak dikenal" }, { status: 404 });

    const sekarang = new Date().toISOString();
    const statusBaru = petakanStatus(body.transaction_status ?? "", body.fraud_status);

    // (1) Nominal wajib persis sama dengan order di server.
    const nominalHarap = formatGrossAmount(Number(rec.jumlah));
    if (body.gross_amount !== nominalHarap) {
      console.error(
        "[bayar/webhook] NOMINAL TIDAK COCOK untuk order",
        body.order_id,
        "— diterima:",
        body.gross_amount,
        "diharapkan:",
        nominalHarap,
      );
      await simpan("pembayaran", {
        ...rec,
        webhookTerakhir: sekarang,
        anomaliTerakhir: `nominal-tidak-cocok:${body.gross_amount ?? "?"}!=${nominalHarap}`,
      });
      // 200 agar Midtrans berhenti mengulang; TIDAK ada perubahan status/aktivasi.
      return NextResponse.json({ ok: false, kode: "NOMINAL_TIDAK_COCOK" });
    }

    // (2) Sekali lunas_final, tidak ada jalan mundur.
    if (rec.statusInternal === "lunas_final") {
      if (statusBaru === "refund") {
        await simpan("pembayaran", {
          ...rec,
          statusInternal: "refund",
          statusGateway: body.transaction_status ?? "",
          webhookTerakhir: sekarang,
        });
      } else {
        await simpan("pembayaran", {
          ...rec,
          statusGateway: body.transaction_status ?? "",
          webhookTerakhir: sekarang,
          ...(statusBaru === "gagal"
            ? { anomaliTerakhir: `status-mundur-diabaikan:${body.transaction_status ?? ""}` }
            : {}),
        });
      }
      return NextResponse.json({ ok: true });
    }
    if (rec.statusInternal === "refund") {
      await simpan("pembayaran", { ...rec, webhookTerakhir: sekarang });
      return NextResponse.json({ ok: true });
    }

    if (statusBaru === "lunas") {
      // (3) Klaim dulu pada catatan order, BARU perpanjang — dan perpanjangan
      // sendiri idempoten per order di sisi pengguna.
      await simpan("pembayaran", {
        ...rec,
        statusInternal: "lunas_final",
        statusGateway: body.transaction_status ?? "",
        paymentType: body.payment_type ?? rec.paymentType ?? "",
        dibayarPada: sekarang,
        premiumDiaktifkanPada: sekarang,
        webhookTerakhir: sekarang,
      });
      if (!rec.premiumDiaktifkanPada) {
        const pengguna = (await ambil("pengguna", String(rec.userId))) as unknown as Pengguna | null;
        if (pengguna) await aktifkanPremium(pengguna, 30, body.order_id!);
      }
      return NextResponse.json({ ok: true });
    }

    await simpan("pembayaran", {
      ...rec,
      statusInternal:
        statusBaru === "refund" ? "refund" : statusBaru === "gagal" ? "gagal" : "menunggu_bayar",
      statusGateway: body.transaction_status ?? "",
      paymentType: body.payment_type ?? rec.paymentType ?? "",
      webhookTerakhir: sekarang,
    });
    return NextResponse.json({ ok: true });
  });
}
