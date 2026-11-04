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
import {
  generateFootnoteUntukParagraf,
  pasangFootnoteDisetujui,
} from "@/lib/server/generate-footnote";
import type { Sumber } from "@/lib/engine/cite";

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
  const bersihParagraf = paragraf.replace(/\[\[ref:[^\]]*\]\]/g, "").trim();
  // Mode seleksi (Tahap 4): teks yang diblok mahasiswa menjadi unit
  // pencarian; ambang panjangnya pada teks seleksinya sendiri.
  const seleksi =
    typeof body?.seleksi === "string" ? body.seleksi.replace(/\s+/g, " ").trim().slice(0, 1200) : "";
  const judulProyek = typeof body?.judulProyek === "string" ? body.judulProyek.trim().slice(0, 300) : "";
  const kalimatKursor =
    typeof body?.kalimatKursor === "number" && Number.isFinite(body.kalimatKursor)
      ? Math.max(0, Math.floor(body.kalimatKursor))
      : undefined;
  // Konteks gerbang relevansi (opsional; klien lama tetap berjalan).
  const bidangId = typeof body?.bidangId === "string" ? body.bidangId.trim().slice(0, 60) : undefined;
  const topikAr = typeof body?.topikAr === "string" ? body.topikAr.trim().slice(0, 300) : undefined;

  // Pemasangan persis kandidat tertahan yang disetujui (Tahap 4):
  // sidik terbitan server + data kandidat yang ditampilkan. Jalur
  // generate TIDAK dijalankan ulang untuk permintaan ini, dan
  // paksaKonfirmasi tanpa sidik tidak lagi berlaku (diabaikan).
  const sidikDisetujui =
    typeof body?.sidikDisetujui === "string" ? body.sidikDisetujui.trim().slice(0, 64) : "";
  if (sidikDisetujui) {
    const kandidatMentah = body?.kandidatDisetujui as Partial<Sumber> | null;
    if (!kandidatMentah || typeof kandidatMentah !== "object" || typeof kandidatMentah.judul !== "string") {
      return NextResponse.json(
        { error: "Data kandidat yang disetujui tidak lengkap. Minta generate ulang." },
        { status: 400 },
      );
    }
    const kandidat: Sumber = {
      id: typeof kandidatMentah.id === "string" ? kandidatMentah.id.slice(0, 80) : "",
      jenis: kandidatMentah.jenis === "artikel" ? "artikel" : "kitab",
      penulis: typeof kandidatMentah.penulis === "string" ? kandidatMentah.penulis.slice(0, 300) : "",
      penulisDaftar: Array.isArray(kandidatMentah.penulisDaftar)
        ? kandidatMentah.penulisDaftar.filter((x) => typeof x === "string").slice(0, 8)
        : undefined,
      tahun: typeof kandidatMentah.tahun === "string" ? kandidatMentah.tahun.slice(0, 20) : "",
      judul: kandidatMentah.judul.slice(0, 500),
      penerbit: typeof kandidatMentah.penerbit === "string" ? kandidatMentah.penerbit.slice(0, 300) : undefined,
      jurnal: typeof kandidatMentah.jurnal === "string" ? kandidatMentah.jurnal.slice(0, 300) : undefined,
      jilid: typeof kandidatMentah.jilid === "string" ? kandidatMentah.jilid.slice(0, 20) : undefined,
      halaman: typeof kandidatMentah.halaman === "string" ? kandidatMentah.halaman.slice(0, 40) : undefined,
      doi: typeof kandidatMentah.doi === "string" ? kandidatMentah.doi.slice(0, 120) : undefined,
      isbn: typeof kandidatMentah.isbn === "string" ? kandidatMentah.isbn.slice(0, 40) : undefined,
      url: typeof kandidatMentah.url === "string" ? kandidatMentah.url.slice(0, 500) : undefined,
      sumberImpor: typeof kandidatMentah.sumberImpor === "string" ? kandidatMentah.sumberImpor.slice(0, 60) : undefined,
    };
    const hasilPasang = await pasangFootnoteDisetujui({
      sidik: sidikDisetujui,
      kandidat,
      paragraf,
      kalimatIdx: kalimatKursor,
      pemilik: pengguna.id,
    });
    return NextResponse.json(hasilPasang);
  }

  // Validasi panjang untuk jalur generate (cabang sidik di atas tidak
  // memerlukannya: ia hanya memasang kandidat yang sudah diterbitkan).
  if (seleksi) {
    if (seleksi.length < 20) {
      return NextResponse.json(
        { error: "Teks yang diblok terlalu pendek. Blok minimal satu kalimat utuh, lalu coba lagi." },
        { status: 400 },
      );
    }
    if (bersihParagraf.length < 20) {
      return NextResponse.json(
        { error: "Paragraf tempat teks diblok terlalu pendek untuk diberi footnote otomatis." },
        { status: 400 },
      );
    }
  } else if (bersihParagraf.length < 40) {
    return NextResponse.json(
      { error: "Paragraf terlalu pendek untuk diberi footnote otomatis. Tulis dulu isi paragrafnya." },
      { status: 400 },
    );
  }

  const hasil = await generateFootnoteUntukParagraf({
    paragraf,
    judulProyek,
    kalimatKursor,
    bidangId,
    topikAr,
    ...(seleksi ? { seleksi } : {}),
    pemilik: pengguna.id,
    kolam: {
      pribadi: opsiP.pribadi,
      wajibPribadi: opsiP.wajibPribadi,
      pinjaman: opsiP.pinjaman,
    },
  });
  return NextResponse.json(hasil);
}
