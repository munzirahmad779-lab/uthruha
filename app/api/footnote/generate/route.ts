// app/api/footnote/generate/route.ts
// Generate Footnote otomatis — fitur PREMIUM (keputusan pemilik 30 Okt 2026).
//
// Satu klik dari tab Tulis: server menyusun kalimat kunci dari paragraf
// (AI, kolam premium), mencari rujukan baru di web, memilih rujukan +
// kalimat tempat footnote menempel. Hasil pencarian disimpan ke bank
// rujukan bersama agar paragraf/kalimat kunci yang sama pada pengguna
// lain tidak mengulang panggilan API (lihat lib/server/bank-rujukan.ts).
//
// Route ini TIDAK masuk JALUR_BEBAS middleware: sesi gerbang wajib,
// dan handler memeriksa tier Premium sendiri di server.

import { NextRequest, NextResponse } from "next/server";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { penggunaDariRequest, tierEfektif } from "@/lib/server/identitas";
import { bolehLajuServer } from "@/lib/server/laju-server";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";
import { generateFootnoteUntukParagraf } from "@/lib/server/generate-footnote";

export const runtime = "nodejs";
export const maxDuration = 60;

const JENDELA_MS = 60_000;
const MAKS_PER_IP = 6; // generate berat (AI + pencarian web): rem lebih ketat
const MAKS_GLOBAL = 120;

export async function POST(req: NextRequest) {
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;

  if (!asalSah(req)) {
    return NextResponse.json({ error: "Asal permintaan tidak dikenal." }, { status: 403 });
  }

  const ip = ipKlien(req);
  const perIp = bolehLaju(`generate-footnote:ip:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(perIp.ulangDetik, `Terlalu banyak permintaan. Coba lagi dalam ${perIp.ulangDetik} detik.`);
  }
  // Pengencangan 3 Nov 2026 (T-2): batas global persisten lintas
  // instance, bukan lagi hitungan memori proses.
  const global = await bolehLajuServer("generate-footnote:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Server sedang sibuk. Coba lagi sebentar.");
  }

  const pengguna = await penggunaDariRequest(req);
  if (!pengguna) {
    return NextResponse.json(
      { error: "Masuk dulu dengan akun Anda untuk memakai Generate Footnote." },
      { status: 401 },
    );
  }
  if (tierEfektif(pengguna) !== "premium") {
    return NextResponse.json(
      {
        error: "Generate Footnote otomatis adalah fitur Premium. Lapis gratis memasang footnote lewat dialog Pasang footnote.",
        kode: "PREMIUM",
      },
      { status: 403 },
    );
  }
  // BYOK mahasiswa: fitur ini berjalan di atas kunci pribadi mereka.
  const { opsiKolamUntuk, PESAN_PERLU_KUNCI } = await import("@/lib/server/kunci-pribadi");
  const opsiP = await opsiKolamUntuk(pengguna);
  if (opsiP.perluIsiKunci) {
    return NextResponse.json({ error: PESAN_PERLU_KUNCI, kode: "KUNCI_PRIBADI" }, { status: 403 });
  }

  const perUser = await bolehLajuServer(`generate-footnote:user:${pengguna.id}`, 10, JENDELA_MS);
  if (!perUser.boleh) {
    return balasanLaju(perUser.ulangDetik, "Jatah akun Anda untuk Generate Footnote tercapai. Coba lagi sebentar.");
  }

  const body = await req.json().catch(() => null);
  const paragraf = typeof body?.paragraf === "string" ? body.paragraf.trim().slice(0, 6000) : "";
  if (paragraf.replace(/\[\[ref:[^\]]*\]\]/g, "").trim().length < 40) {
    return NextResponse.json(
      { error: "Paragraf terlalu pendek untuk diberi footnote otomatis. Tulis dulu isi paragrafnya." },
      { status: 400 },
    );
  }
  const judulProyek = typeof body?.judulProyek === "string" ? body.judulProyek.trim().slice(0, 300) : "";
  const kalimatKursor =
    typeof body?.kalimatKursor === "number" && Number.isFinite(body.kalimatKursor)
      ? Math.max(0, Math.floor(body.kalimatKursor))
      : undefined;

  const hasil = await generateFootnoteUntukParagraf({
    paragraf,
    judulProyek,
    kalimatKursor,
    kolam: {
      pribadi: opsiP.pribadi,
      wajibPribadi: opsiP.wajibPribadi,
      pinjaman: opsiP.pinjaman,
    },
  });
  return NextResponse.json(hasil);
}
