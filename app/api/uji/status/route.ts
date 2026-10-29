import { NextResponse } from "next/server";
import { modeUjiAktif } from "@/lib/server/mode-uji";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status mode uji persona (cabang uji-persona). Di produksi selalu
 * { aktif: false } dan panel masuk uji tidak dirender.
 */
export async function GET() {
  return NextResponse.json(
    { aktif: modeUjiAktif() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
