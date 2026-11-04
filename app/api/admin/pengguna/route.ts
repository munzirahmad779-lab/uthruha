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
 *  - "hapus-akun": catatan akun dihapus dari dashboard beserta kunci
 *    API pribadi dan keadaan kolam pribadinya (perintah pemilik
 *    4 Nov 2026 sore). Email di daftar mahasiswa TIDAK ikut terhapus.
 * Hanya sesi pemilik (daftar email admin) yang boleh; admin tidak bisa
 * menonaktifkan atau menghapus akunnya sendiri agar tidak terkunci
 * keluar.
 */
import { NextResponse } from "next/server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { asalSah } from "@/lib/security/laju";
import { apakahAdmin } from "@/lib/server/admin";
import { kirimEmail } from "@/lib/server/email";
import { penggunaDariRequest, tierEfektif, type Pengguna } from "@/lib/server/identitas";
import { ambil, hapus, perbarui } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AKSI = ["nonaktifkan", "aktifkan", "premium", "reset-perangkat", "mahasiswa", "bukan-mahasiswa", "hapus-akun"] as const;
type Aksi = (typeof AKSI)[number];

export async function POST(req: Request) {
  // Pengencangan 3 Nov 2026 (S-7): lapis kedua yang sama seperti rute
  // LLM (cookie gerbang diperiksa di handler + pemeriksaan asal),
  // agar rute paling berkuasa ini tidak bertumpu pada middleware saja.
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
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

  // Kosongkan ikatan perangkat akun (batas perangkat per lapis:
  // gratis 1, premium 2). Dipakai bila mahasiswa berganti perangkat;
  // perangkat berikutnya yang masuk akan terdaftar sebagai yang baru.
  if (aksi === "reset-perangkat") {
    const jumlah = Array.isArray(target.perangkatAkun) ? target.perangkatAkun.length : 0;
    await perbarui("pengguna", userId, { perangkatAkun: [] });
    return NextResponse.json({
      ok: true,
      userId,
      catatan: `Ikatan perangkat dikosongkan (${jumlah} perangkat terdaftar sebelumnya). Perangkat berikutnya yang masuk akan terdaftar ulang.`,
    });
  }

  // Mahasiswa Ma'had Aly (perintah pemilik 4 Nov 2026): tanda ini membuat
  // tierEfektif selalu premium dan mengarahkan fitur AI ke kunci pribadi
  // mahasiswa. Mencabut tanda mengembalikan akun ke lapis dasarnya.
  if (aksi === "mahasiswa") {
    await perbarui("pengguna", userId, { mahasiswa: true });
    return NextResponse.json({
      ok: true,
      userId,
      catatan: "Akun ditandai mahasiswa: premium aktif dan fitur AI memakai kunci API pribadinya.",
    });
  }
  if (aksi === "bukan-mahasiswa") {
    await perbarui("pengguna", userId, { mahasiswa: false });
    return NextResponse.json({ ok: true, userId, catatan: "Tanda mahasiswa dicabut." });
  }

  // Hapus akun dari dashboard: catatan pengguna, kunci API pribadi,
  // dan keadaan kolam pribadinya dibuang sekaligus. Akun pemilik
  // terlindungi. Email di daftar mahasiswa sengaja dipertahankan
  // (pencabutannya lewat rute mahasiswa), jadi orangnya tetap bisa
  // masuk lagi dan tercipta akun baru yang bersih.
  if (aksi === "hapus-akun") {
    if (target.id === u.id || apakahAdmin(target)) {
      return NextResponse.json(
        { error: "Akun pemilik tidak bisa dihapus." },
        { status: 400 },
      );
    }
    const adaKunci = (await ambil("kunciPribadi", userId)) !== null;
    if (adaKunci) await hapus("kunciPribadi", userId);
    for (const label of [`gemini-pribadi-${userId}`, `groq-pribadi-${userId}`]) {
      if ((await ambil("kolam", label)) !== null) await hapus("kolam", label);
    }
    await hapus("pengguna", userId);
    return NextResponse.json({
      ok: true,
      userId,
      catatan: `Akun ${target.email} dihapus dari dashboard${adaKunci ? " beserta kunci API pribadinya" : ""}. Emailnya tetap di daftar mahasiswa bila terdaftar, jadi ia bisa masuk lagi sebagai akun baru yang bersih.`,
    });
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
  // Pemberitahuan otomatis ke email akun (best-effort: gagal kirim tidak
  // membatalkan premium yang sudah menempel). Isi email TANPA kunci
  // premium mentah, karena premium menempel langsung dari server.
  const sampaiTeks = new Date(sampai).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hasil = await kirimEmail({
    ke: target.email,
    subjek: "Akun Kitabah Anda sudah Premium",
    teks:
      `Assalamu'alaikum ${target.nama || ""},\n\n` +
      `Akun Kitabah Anda (${target.email}) sudah diaktifkan sebagai Premium oleh admin sampai ${sampaiTeks}. ` +
      `Silakan masuk seperti biasa di https://www.kitabah.web.id/masuk — tidak perlu menempel kunci apa pun, ` +
      `premium sudah menempel di akun Anda.\n\nSelamat menulis.`,
  });
  return NextResponse.json({
    ok: true,
    userId,
    premiumSampai: sampai,
    emailTerkirim: hasil.terkirim,
    catatan: hasil.terkirim
      ? `Premium aktif sampai ${sampaiTeks}. Email pemberitahuan terkirim ke ${target.email}.`
      : `Premium aktif sampai ${sampaiTeks}, tetapi email pemberitahuan tidak terkirim (${hasil.alasan ?? "penyedia belum siap"}). Premiumnya sendiri sudah menempel.`,
  });
}
