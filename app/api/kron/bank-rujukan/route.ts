// app/api/kron/bank-rujukan/route.ts
// Pengelolaan bank rujukan bersama, dipanggil Vercel Cron tiap malam
// (lihat vercel.json, 20:00 UTC = 04:00 WITA): dedupe rujukan per
// DOI/judul, buang rekam kosong dan sidik paragraf kedaluwarsa, batasi
// ukuran bank. Tidak memuat data pengguna dan tidak memanggil LLM.
//
// Rute ini masuk JALUR_BEBAS middleware karena cron tidak membawa cookie.
// Vercel Cron mengirimkan env CRON_SECRET sebagai header Authorization:
// Bearer, dan handler mewajibkannya persis. Gerbang ini fail-closed
// (audit putaran 1, temuan D-01): bila CRON_SECRET belum terpasang,
// rute menolak semua panggilan alih-alih berjalan terbuka, karena
// kelolaBank melakukan penghapusan rekam.

import { NextRequest, NextResponse } from "next/server";
import { kelolaBank } from "@/lib/server/bank-rujukan";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const rahasia = process.env.CRON_SECRET?.trim();
  if (!rahasia) {
    return NextResponse.json(
      { error: "CRON_SECRET belum terpasang di server." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${rahasia}`) {
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  }
  const hasil = await kelolaBank();
  return NextResponse.json({ ok: true, pada: new Date().toISOString(), ...hasil });
}
