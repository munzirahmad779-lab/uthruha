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
 *
 * Penjaga: sesi Google yang sah WAJIB. Sesudah itu salah satu dari
 * cookie gerbang (pengguna biasa yang sudah masuk) ATAU tanda
 * mahasiswa — mahasiswa terdaftar memang harus bisa mencapai rute
 * ini SEBELUM aksesnya dibuka, untuk menyetor kunci pertamanya
 * (gerbang setor kunci di /api/masuk). Karena itu jalur ini bebas
 * gerbang tepi di middleware dan penjaganya tinggal di sini.
 */
import { NextResponse } from "next/server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah } from "@/lib/security/laju";
import { penggunaDariRequest, type Pengguna } from "@/lib/server/identitas";
import {
  kunciPribadiSah,
  simpanKunciPribadi,
  statusKunciPribadi,
} from "@/lib/server/kunci-pribadi";
import { perbarui } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function penjaga(req: Request): Promise<Pengguna | Response> {
  const u = await penggunaDariRequest(req);
  if (!u) {
    return NextResponse.json({ error: "Belum masuk dengan Google." }, { status: 401 });
  }
  if (u.mahasiswa) return u;
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  return u;
}

export async function GET(req: Request) {
  const hasil = await penjaga(req);
  if (hasil instanceof Response) return hasil;
  const u = hasil;
  const status = await statusKunciPribadi(u.id);
  return NextResponse.json({ ok: true, mahasiswa: Boolean(u.mahasiswa), ...status });
}

export async function POST(req: Request) {
  const hasil = await penjaga(req);
  if (hasil instanceof Response) return hasil;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const u = hasil;

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
  // Kehadiran mahasiswa menyetor kunci dihitung kehadiran hari ini:
  // cap login terakhir ditulis agar kuncinya tidak dipinjam pada hari
  // yang sama dengan hari ia sendiri muncul (aturan kolam pinjaman).
  if (u.mahasiswa) {
    await perbarui("pengguna", u.id, { loginTerakhir: new Date().toISOString() });
  }
  const status = await statusKunciPribadi(u.id);
  return NextResponse.json({ ok: true, ...status });
}

export async function DELETE(req: Request) {
  const hasil = await penjaga(req);
  if (hasil instanceof Response) return hasil;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const u = hasil;

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
