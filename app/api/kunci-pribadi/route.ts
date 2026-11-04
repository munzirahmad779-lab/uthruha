/**
 * KUNCI API PRIBADI PENGGUNA (BYOK mahasiswa, perintah pemilik 4 Nov 2026).
 *
 * GET    → status kedua kunci (terisi/belum + 4 karakter terakhir saja).
 * POST   { gemini?, groq? } → pasang/ganti kunci (string) per penyedia.
 * DELETE { penyedia: "gemini" | "groq" } → hapus satu kunci.
 *
 * Kunci mentah TIDAK pernah dikembalikan. Penyimpanan terenkripsi di
 * lib/server/kunci-pribadi.ts. Hanya pemilik sesi yang bisa menyentuh
 * kuncinya sendiri (identitas dari cookie sesi, bukan dari body).
 */
import { NextResponse } from "next/server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah } from "@/lib/security/laju";
import { penggunaDariRequest } from "@/lib/server/identitas";
import {
  kunciPribadiSah,
  simpanKunciPribadi,
  statusKunciPribadi,
} from "@/lib/server/kunci-pribadi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Belum masuk dengan Google." }, { status: 401 });
  const status = await statusKunciPribadi(u.id);
  return NextResponse.json({ ok: true, mahasiswa: Boolean(u.mahasiswa), ...status });
}

export async function POST(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Belum masuk dengan Google." }, { status: 401 });

  let body: { gemini?: unknown; groq?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Isi permintaan tidak sah." }, { status: 400 });
  }
  const ubah: { gemini?: string; groq?: string } = {};
  if (body.gemini !== undefined) {
    if (!kunciPribadiSah(body.gemini)) {
      return NextResponse.json(
        { error: "Kunci Gemini tidak sah bentuknya (20–200 karakter, tanpa spasi)." },
        { status: 400 },
      );
    }
    ubah.gemini = body.gemini;
  }
  if (body.groq !== undefined) {
    if (!kunciPribadiSah(body.groq)) {
      return NextResponse.json(
        { error: "Kunci Groq tidak sah bentuknya (20–200 karakter, tanpa spasi)." },
        { status: 400 },
      );
    }
    ubah.groq = body.groq;
  }
  if (ubah.gemini === undefined && ubah.groq === undefined) {
    return NextResponse.json({ error: "Tidak ada kunci yang dikirim." }, { status: 400 });
  }
  await simpanKunciPribadi(u.id, ubah);
  const status = await statusKunciPribadi(u.id);
  return NextResponse.json({ ok: true, ...status });
}

export async function DELETE(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const u = await penggunaDariRequest(req);
  if (!u) return NextResponse.json({ error: "Belum masuk dengan Google." }, { status: 401 });

  let body: { penyedia?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Isi permintaan tidak sah." }, { status: 400 });
  }
  if (body.penyedia !== "gemini" && body.penyedia !== "groq") {
    return NextResponse.json({ error: "Penyedia tidak dikenal." }, { status: 400 });
  }
  await simpanKunciPribadi(u.id, { [body.penyedia]: null });
  const status = await statusKunciPribadi(u.id);
  return NextResponse.json({ ok: true, ...status });
}
