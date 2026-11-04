/**
 * DAFTAR EMAIL MAHASISWA MA'HAD ALY (perintah pemilik 4 Nov 2026).
 *
 * Pemilik menempel banyak email SEKALIGUS (satu per baris atau dipisah
 * koma) — tanpa env Vercel, tanpa satu-satu. Email di daftar ini:
 *  - akun yang sudah ada langsung ditandai mahasiswa;
 *  - akun yang belum pernah masuk ditandai otomatis saat login Google
 *    pertama (sinkronMahasiswa di lib/server/identitas.ts).
 * Mahasiswa = premium aktif + fitur AI memakai kunci API pribadi mereka.
 *
 * GET    → daftar email aktif.
 * POST   { emails: string | string[] } → tambah massal.
 * DELETE { email } → cabut dari daftar + cabut tanda di akunnya.
 * Hanya sesi pemilik (apakahAdmin), pola pengamanan sama seperti rute
 * admin lain (gerbang di handler + pemeriksaan asal).
 */
import { NextResponse } from "next/server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah } from "@/lib/security/laju";
import { apakahAdmin } from "@/lib/server/admin";
import { penggunaDariRequest, type Pengguna } from "@/lib/server/identitas";
import { hapus, perbarui, semua, simpan } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return POLA_EMAIL.test(e) && e.length <= 160 ? e : null;
}

async function jagaAdmin(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return { galat: tolak };
  const u = await penggunaDariRequest(req);
  if (!u) return { galat: NextResponse.json({ error: "Belum masuk." }, { status: 401 }) };
  if (!apakahAdmin(u)) {
    return { galat: NextResponse.json({ error: "Halaman ini khusus pemilik layanan." }, { status: 403 }) };
  }
  return { u };
}

export async function GET(req: Request) {
  const { galat } = await jagaAdmin(req);
  if (galat) return galat;
  const daftar = await semua("mahasiswa");
  return NextResponse.json({
    ok: true,
    emails: daftar
      .filter((r) => r.aktif !== false)
      .map((r) => ({ email: String(r.id), ditambahkan: String(r.ditambahkan ?? "") }))
      .sort((a, b) => a.email.localeCompare(b.email)),
  });
}

export async function POST(req: Request) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const { galat, u } = await jagaAdmin(req);
  if (galat) return galat;

  let body: { emails?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Isi permintaan tidak sah." }, { status: 400 });
  }
  const mentah: string[] = Array.isArray(body.emails)
    ? body.emails.filter((x): x is string => typeof x === "string")
    : typeof body.emails === "string"
      ? body.emails.split(/[\s,;]+/)
      : [];
  const unik = [...new Set(mentah.map((e) => normalEmail(e)).filter((e): e is string => Boolean(e)))];
  if (unik.length === 0) {
    return NextResponse.json({ error: "Tidak ada email sah dalam kiriman." }, { status: 400 });
  }
  if (unik.length > 200) {
    return NextResponse.json({ error: "Sekali kirim maksimal 200 email." }, { status: 400 });
  }

  const sekarang = new Date().toISOString();
  for (const email of unik) {
    await simpan("mahasiswa", { id: email, aktif: true, ditambahkan: sekarang, oleh: u!.email });
  }
  // Akun yang sudah terdaftar langsung ditandai, tanpa menunggu login ulang.
  const semuaPengguna = (await semua("pengguna")) as unknown as Pengguna[];
  let ditandai = 0;
  for (const p of semuaPengguna) {
    if (!p.mahasiswa && unik.includes(p.email.trim().toLowerCase())) {
      await perbarui("pengguna", p.id, { mahasiswa: true });
      ditandai += 1;
    }
  }
  return NextResponse.json({ ok: true, ditambah: unik.length, akunDitandai: ditandai, emails: unik });
}

export async function DELETE(req: Request) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const { galat } = await jagaAdmin(req);
  if (galat) return galat;

  let body: { email?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Isi permintaan tidak sah." }, { status: 400 });
  }
  const email = normalEmail(body.email);
  if (!email) return NextResponse.json({ error: "Email tidak sah." }, { status: 400 });
  await hapus("mahasiswa", email);
  const semuaPengguna = (await semua("pengguna")) as unknown as Pengguna[];
  for (const p of semuaPengguna) {
    if (p.mahasiswa && p.email.trim().toLowerCase() === email) {
      await perbarui("pengguna", p.id, { mahasiswa: false });
    }
  }
  return NextResponse.json({ ok: true, email });
}
