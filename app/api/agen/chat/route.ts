import { NextResponse } from "next/server";
import { panggilKolam } from "@/lib/server/kolam";
import { opsiKolamUntuk, PESAN_PERLU_KUNCI } from "@/lib/server/kunci-pribadi";
import { penggunaDariRequest, tierEfektif } from "@/lib/server/identitas";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { bolehLajuServer } from "@/lib/server/laju-server";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

const SISTEM_AGEN = `Anda adalah agen bantuan Kitabah (alat bantu penulisan skripsi/tesis berbahasa Arab untuk mahasiswa Indonesia). Jawab singkat, ramah, dan praktis dalam Bahasa Indonesia (istilah Arab boleh). Bantu soal: menyusun khalfiyah, rumusan masalah, mencari rujukan yang bisa diverifikasi (DOI/ISBN), footnote gaya pedoman kampus, dan memakai fitur Kitabah. Jangan mengarang rujukan, nama kitab, atau nomor halaman — bila tidak tahu, katakan tidak tahu dan arahkan ke pencarian rujukan di dalam aplikasi.`;

/**
 * Chat agen (keputusan J): hanya Premium. Bukan premium menerima 403
 * dengan kode PREMIUM agar widget menampilkan panel penawaran.
 * Jawaban instan lewat kolam mesin — BUKAN estafet mailbox lama.
 */
export async function POST(req: Request) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });
  const laju = bolehLaju(`agen:${ipKlien(req)}`, 30, 60_000);
  if (!laju.boleh) return balasanLaju(laju.ulangDetik, "Terlalu banyak pesan. Pelan-pelan dulu.");

  const u = await penggunaDariRequest(req);
  if (!u) {
    return NextResponse.json(
      { error: "Chat agen khusus pengguna Premium. Masuk dengan Google dulu.", kode: "WAJIB_LOGIN" },
      { status: 401 },
    );
  }
  if (tierEfektif(u) !== "premium") {
    return NextResponse.json(
      { error: "Chat agen adalah fitur Premium.", kode: "PREMIUM" },
      { status: 403 },
    );
  }

  // Pengencangan 3 Nov 2026 (S-4): kolam premium hanya berisi sedikit
  // kunci, jadi selain batas per IP ada batas per akun dan global
  // persisten. Berganti IP tidak lagi menambah jatah akun.
  const perUser = await bolehLajuServer(`agen:user:${u.id}`, 20, 60_000);
  if (!perUser.boleh) return balasanLaju(perUser.ulangDetik, "Jatah akun Anda untuk chat tercapai. Coba lagi sebentar.");
  const global = await bolehLajuServer("agen:global", 240, 60_000);
  if (!global.boleh) return balasanLaju(global.ulangDetik, "Agen sedang sibuk. Coba lagi sebentar.");

  const body = (await req.json().catch(() => null)) as { pesan?: string } | null;
  const pesan = body?.pesan?.trim().slice(0, 2000) ?? "";
  if (!pesan) return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });

  // BYOK mahasiswa: chat berjalan di atas kunci pribadi mereka sendiri.
  const opsiP = await opsiKolamUntuk(u);
  if (opsiP.perluIsiKunci) {
    return NextResponse.json({ error: PESAN_PERLU_KUNCI, kode: "KUNCI_PRIBADI" }, { status: 403 });
  }

  try {
    const hasil = await panggilKolam({
      sistem: SISTEM_AGEN,
      pengguna: pesan,
      maksToken: 900,
      premium: true,
      pribadi: opsiP.pribadi,
      wajibPribadi: opsiP.wajibPribadi,
    });
    return NextResponse.json({ jawaban: hasil.teks, penyedia: hasil.penyedia, model: hasil.model });
  } catch {
    return NextResponse.json({ error: "Agen sedang tidak bisa menjawab. Coba lagi sebentar." }, { status: 503 });
  }
}
