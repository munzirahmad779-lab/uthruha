import { NextResponse } from "next/server";
import { panggilKolam } from "@/lib/server/kolam";
import { cariRujukanTamu, type RujukanTamu } from "@/lib/server/rujukan";
import { ambil, simpan } from "@/lib/server/store";
import { idAcak } from "@/lib/server/store";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";

/**
 * UJI COBA TAMU (keputusan E) — disengaja TANPA gerbang kunci akses &
 * tanpa sesi pengguna (ia ada di halaman awal, sebelum mendaftar), dengan
 * rem biaya berlapis:
 *  1. tombol mulai eksplisit di klien (tidak ada panggilan otomatis),
 *  2. pembatas laju IP + global (pola laju.ts yang ada),
 *  3. tembolok per judul ternormalisasi — judul populer tidak membakar AI
 *     dua kali,
 *  4. perangkat yang sudah mencoba SEKALI diblokir pada percobaan kedua
 *     (penanda perangkat dari klien + catatan server) → wajib login gratis.
 */

const SISTEM = `Anda adalah asisten penulisan akademik berbahasa Arab untuk mahasiswa Indonesia. Dari JUDUL penelitian, hasilkan HANYA JSON valid tanpa markdown:
{"kalimatKunci":["...","...","..."],"khalfiyah":["paragraf 1","paragraf 2","paragraf 3"],"isykaliyat":["..."],"ahdaf":["..."]}
Aturan:
- kalimatKunci: tepat 3 frasa pencarian khas (Arab gundul/fushah) dari judul.
- khalfiyah: tepat 3 paragraf Bahasa Arab akademik yang MENYATU — paragraf 2 melanjutkan paragraf 1, paragraf 3 melanjutkan paragraf 2 (akai kata penghubung seperti ومن هنا، وفي هذا السياق، وتأسيسا على ذلك). Jangan menulis nama kitab, penulis, tahun, atau rujukan apa pun di dalam paragraf.
- isykaliyat: 2-3 rumusan masalah (Arab) yang benar-benar lahir dari judul.
- ahdaf: 2-3 tujuan penelitian (Arab) yang sejajar dengan isykaliyat. JANGAN hasilkan fawaid/manfaat.`;

interface HasilGenerasi {
  kalimatKunci: string[];
  khalfiyah: string[];
  isykaliyat: string[];
  ahdaf: string[];
}

function parseGenerasi(teks: string): HasilGenerasi | null {
  try {
    const j = JSON.parse(teks.slice(teks.indexOf("{"), teks.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const arr = (v: unknown, maks: number) =>
      Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, maks) : [];
    const hasil: HasilGenerasi = {
      kalimatKunci: arr(j.kalimatKunci, 3),
      khalfiyah: arr(j.khalfiyah, 3),
      isykaliyat: arr(j.isykaliyat, 3),
      ahdaf: arr(j.ahdaf, 3),
    };
    if (hasil.khalfiyah.length < 2 || hasil.kalimatKunci.length < 1) return null;
    return hasil;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal tidak dikenal." }, { status: 403 });

  const ip = ipKlien(req);
  const perIp = bolehLaju(`uji-coba:ip:${ip}`, 8, 3_600_000);
  if (!perIp.boleh) return balasanLaju(perIp.ulangDetik, "Batas uji coba dari jaringan ini tercapai. Masuk gratis untuk melanjutkan.");
  const global = bolehLaju("uji-coba:global", 300, 3_600_000);
  if (!global.boleh) return balasanLaju(global.ulangDetik, "Uji coba sedang ramai. Coba lagi sebentar.");

  const body = (await req.json().catch(() => null)) as { judul?: string; perangkatId?: string } | null;
  const judul = body?.judul?.trim().slice(0, 300) ?? "";
  const perangkatId = body?.perangkatId?.trim().slice(0, 80) ?? "";
  if (judul.length < 10) return NextResponse.json({ error: "Judul terlalu pendek (minimal 10 karakter)." }, { status: 400 });
  if (!perangkatId) return NextResponse.json({ error: "Penanda perangkat tidak ada." }, { status: 400 });

  // Rem perangkat: percobaan kedua dari perangkat sama → wajib login.
  const perangkat = await ambil("perangkat", perangkatId);
  if (perangkat && Number(perangkat.percobaan ?? 0) >= 1) {
    return NextResponse.json(
      {
        error: "Perangkat ini sudah memakai jatah uji coba tamu. Silakan masuk gratis untuk melanjutkan tanpa batas uji coba.",
        kode: "WAJIB_LOGIN",
      },
      { status: 403 },
    );
  }

  // Tembolok per judul ternormalisasi.
  const kunciJudul = judul.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  const tembolok = await ambil("tembolok", kunciJudul);

  let generasi: HasilGenerasi;
  let refs: RujukanTamu[];
  let dariTembolok = false;
  if (tembolok?.sesiId) {
    const sesiLama = await ambil("sesiUji", String(tembolok.sesiId));
    if (sesiLama?.generasi && sesiLama?.refs) {
      generasi = sesiLama.generasi as unknown as HasilGenerasi;
      refs = sesiLama.refs as unknown as RujukanTamu[];
      dariTembolok = true;
    } else {
      return NextResponse.json({ error: "Tembolok rusak; coba lagi." }, { status: 500 });
    }
  } else {
    let mentah;
    try {
      mentah = await panggilKolam({ sistem: SISTEM, pengguna: `JUDUL: ${judul}`, maksToken: 2200, json: true });
    } catch (e) {
      const percobaan = (e as { percobaan?: unknown }).percobaan;
      console.error("[uji-coba] kolam gagal", percobaan);
      return NextResponse.json(
        { error: "Mesin AI sedang tidak tersedia. Coba lagi beberapa saat lagi." },
        { status: 503 },
      );
    }
    const hasil = parseGenerasi(mentah.teks);
    if (!hasil) return NextResponse.json({ error: "Hasil AI tidak terbaca. Coba lagi." }, { status: 502 });
    generasi = hasil;
    refs = await cariRujukanTamu(judul, generasi.kalimatKunci);
  }

  const sesiId = idAcak("uji-");
  await simpan("sesiUji", {
    id: sesiId,
    judul,
    perangkatId,
    generasi,
    refs,
    dikembangkan: false,
    paragrafKembang: null,
    lampiran: null,
    dibuat: new Date().toISOString(),
  });
  if (!dariTembolok) {
    await simpan("tembolok", { id: kunciJudul, sesiId, dibuat: new Date().toISOString() });
  }
  await simpan("perangkat", {
    id: perangkatId,
    percobaan: Number(perangkat?.percobaan ?? 0) + 1,
    terakhir: new Date().toISOString(),
  });

  return NextResponse.json({
    sesiId,
    judul,
    ...generasi,
    refs,
    dariTembolok,
    penyedia: dariTembolok ? "tembolok" : undefined,
  });
}
