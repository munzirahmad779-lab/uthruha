// app/api/dirasah/route.ts
// Pencarian dirasah sabiqoh (Pembangunan Ulang Tahap 7, menutup A9).
//
// Satu pencarian dari panel Dirasah Sabiqoh di tab Struktur: server
// mencari kajian nyata dengan judul proyek sebagai kueri semantik
// lewat tumpukan pencarian yang sudah ada, menilainya dengan gerbang
// relevansi yang sama seperti Generate Footnote dan Cari Rujukan,
// lalu menyusun inti tiap kajian dari abstraknya. Penilaian MODEL
// hanya berjalan untuk akun Premium atau pemilik kunci (kebijakan
// kolam yang sama dengan rute Cari Rujukan); aturan keras bidang
// berlaku untuk semua akun. Mahasiswa BYOK wajib memakai kuncinya
// sendiri, sama seperti Generate Footnote.

import { NextRequest, NextResponse } from "next/server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { penggunaDariRequest, tierEfektif } from "@/lib/server/identitas";
import { bolehLajuServer } from "@/lib/server/laju-server";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";
import { cariKajianDirasah } from "@/lib/server/dirasah";

export const runtime = "nodejs";
export const maxDuration = 60;

const JENDELA_MS = 60_000;
const MAKS_PER_IP = 6; // pencarian berat (web + penilaian model): rem ketat seperti generate
const MAKS_GLOBAL = 120;

export async function POST(req: NextRequest) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;

  if (!asalSah(req)) {
    return NextResponse.json({ error: "Asal permintaan tidak dikenal." }, { status: 403 });
  }

  const ip = ipKlien(req);
  const perIp = bolehLaju(`dirasah:ip:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(perIp.ulangDetik, `Terlalu banyak permintaan. Coba lagi dalam ${perIp.ulangDetik} detik.`);
  }
  const global = await bolehLajuServer("dirasah:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Server sedang sibuk. Coba lagi sebentar.");
  }

  const pengguna = await penggunaDariRequest(req);
  if (!pengguna) {
    return NextResponse.json(
      { error: "Masuk dulu dengan akun Anda untuk memakai pencarian dirasah sabiqoh.", kode: "WAJIB_LOGIN" },
      { status: 401 },
    );
  }
  // BYOK mahasiswa: pencarian dan penilaian berjalan di atas kunci
  // pribadi mereka, sama seperti Generate Footnote.
  const { opsiKolamUntuk, PESAN_PERLU_KUNCI } = await import("@/lib/server/kunci-pribadi");
  const opsiP = await opsiKolamUntuk(pengguna);
  if (opsiP.perluIsiKunci) {
    return NextResponse.json({ error: PESAN_PERLU_KUNCI, kode: "KUNCI_PRIBADI" }, { status: 403 });
  }
  // Penilaian model hanya untuk akun yang pada jalur lain pun menilai
  // (Premium, kunci pribadi, wajib pribadi, atau pinjaman kelompok).
  const bisaNilaiModel =
    tierEfektif(pengguna) === "premium" ||
    Boolean(opsiP.pribadi) ||
    Boolean(opsiP.wajibPribadi) ||
    (opsiP.pinjaman?.length ?? 0) > 0;

  const perUser = await bolehLajuServer(`dirasah:user:${pengguna.id}`, 10, JENDELA_MS);
  if (!perUser.boleh) {
    return balasanLaju(perUser.ulangDetik, "Jatah akun Anda untuk pencarian dirasah tercapai. Coba lagi sebentar.");
  }

  const body = await req.json().catch(() => null);
  const judulProyek = typeof body?.judulProyek === "string" ? body.judulProyek.trim().slice(0, 300) : "";
  if (judulProyek.length < 8) {
    return NextResponse.json(
      { error: "Judul proyek belum terisi atau terlalu pendek untuk dicarikan kajian terdahulu." },
      { status: 400 },
    );
  }
  const bidangId = typeof body?.bidangId === "string" ? body.bidangId.trim().slice(0, 60) : undefined;
  const topikAr = typeof body?.topikAr === "string" ? body.topikAr.trim().slice(0, 300) : undefined;

  try {
    const hasil = await cariKajianDirasah({
      judulProyek,
      bidangId,
      topikAr,
      bisaNilaiModel,
      kolam: {
        pribadi: opsiP.pribadi,
        wajibPribadi: opsiP.wajibPribadi,
        pinjaman: opsiP.pinjaman,
      },
    });
    return NextResponse.json(hasil);
  } catch (e) {
    console.error("Error in dirasah search:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pencarian dirasah gagal." },
      { status: 502 },
    );
  }
}
