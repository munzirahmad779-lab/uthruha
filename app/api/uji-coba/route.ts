import { createHash } from "node:crypto";
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
 *
 * Pembaruan pemilik 3 Nov 2026: jatah resmi kini DUA kali per IP dan
 * dicatat PERSISTEN di server (koleksi ipUji, IP disimpan sebagai sidik
 * hash, bukan alamat mentah). Penanda perangkat tetap dicatat dan ikut
 * dibatasi dua kali; membersihkan peramban tidak lagi mengembalikan
 * jatah karena hitungan IP yang berlaku. Tamu juga memilih susunan
 * pedoman (Mangkoso / As'adiyah) di langkah 2, dan susunan itu memandu
 * generasi Bab 1 serta diteruskan menjadi proyek sesudah ia masuk.
 */

/** Jatah uji coba tamu per IP dan per perangkat (perintah pemilik). */
const BATAS_UJI = 2;

/** Konteks susunan Bab 1 per pedoman, dari template permanen kampus. */
const PEDOMAN_UJI: Record<string, { label: string; konteks: string }> = {
  mangkoso: {
    label: "Ma'had Aly DDI Mangkoso",
    konteks:
      "Ikuti Pedoman Penulisan Risalah Ma'had Aly DDI Mangkoso: Bab 1 memuat latar belakang (pengantar topik, batasan penelitian, alasan memilih topik, tujuan dan manfaat), rumusan masalah, tujuan, manfaat, penelitian terdahulu, definisi judul, metode, dan sistematika. Khalfiyah harus menyentuh pengantar topik, batasan, alasan memilih topik, serta tujuan dan manfaat penelitian.",
  },
  asadiyah: {
    label: "Ma'had Aly As'adiyah Sengkang",
    konteks:
      "Ikuti Pedoman Penulisan Risalah Ma'had Aly As'adiyah Sengkang: Bab 1 memuat latar belakang, rumusan masalah, definisi judul yang berdiri sendiri, penelitian terdahulu, metodologi, tujuan, dan urgensi penelitian. Khalfiyah harus menyentuh latar belakang, urgensi penelitian, dan gambaran metodologi secara ringkas.",
  },
};

/** Sidik samaran IP: cukup untuk mengenali IP yang sama, tanpa menyimpan alamat mentahnya. */
function sidikIp(ip: string): string {
  const garam = process.env.UTH_SESI_SECRET?.trim() || "kitabah-uji-coba";
  return createHash("sha256").update(`${garam}|${ip}`).digest("hex").slice(0, 32);
}

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

  const body = (await req.json().catch(() => null)) as { judul?: string; perangkatId?: string; pedoman?: string } | null;
  const judul = body?.judul?.trim().slice(0, 300) ?? "";
  const perangkatId = body?.perangkatId?.trim().slice(0, 80) ?? "";
  const pedoman = body?.pedoman && PEDOMAN_UJI[body.pedoman] ? body.pedoman : "umum";
  if (judul.length < 10) return NextResponse.json({ error: "Judul terlalu pendek (minimal 10 karakter)." }, { status: 400 });
  if (!perangkatId) return NextResponse.json({ error: "Penanda perangkat tidak ada." }, { status: 400 });

  // Rem IP persisten: jatah DUA kali per IP, tercatat di server. Percobaan
  // sesudahnya ditolak dan penolakannya ikut dicatat untuk laporan admin.
  const ipSidik = sidikIp(ip);
  const catatanIp = await ambil("ipUji", ipSidik);
  if (catatanIp && Number(catatanIp.percobaan ?? 0) >= BATAS_UJI) {
    await simpan("ipUji", {
      ...catatanIp,
      ditolak: Number(catatanIp.ditolak ?? 0) + 1,
      terakhir: new Date().toISOString(),
    });
    return NextResponse.json(
      {
        error: `Jaringan ini sudah memakai ${BATAS_UJI} kali jatah uji coba tamu. Silakan masuk gratis untuk melanjutkan tanpa batas uji coba.`,
        kode: "WAJIB_LOGIN",
      },
      { status: 403 },
    );
  }

  // Rem perangkat: jatah yang sama per perangkat.
  const perangkat = await ambil("perangkat", perangkatId);
  if (perangkat && Number(perangkat.percobaan ?? 0) >= BATAS_UJI) {
    return NextResponse.json(
      {
        error: `Perangkat ini sudah memakai ${BATAS_UJI} kali jatah uji coba tamu. Silakan masuk gratis untuk melanjutkan tanpa batas uji coba.`,
        kode: "WAJIB_LOGIN",
      },
      { status: 403 },
    );
  }

  // Tembolok per judul ternormalisasi. Prefiks versi membuang hasil lama
  // bila mesin generasi/pencarian rujukan berubah (v2: pencarian multi-frasa
  // + label kecocokan bergradasi; v3: verifikasi DOI dari Crossref langsung
  // dipercaya + label gambaran umum, 29 Okt 2026).
  const kunciJudul = "v3|" + pedoman + "|" + judul.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
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
      const sistem = pedoman === "umum" ? SISTEM : `${SISTEM}\n${PEDOMAN_UJI[pedoman]!.konteks}`;
      mentah = await panggilKolam({ sistem, pengguna: `JUDUL: ${judul}`, maksToken: 2200, json: true });
    } catch (e) {
      const percobaan = (e as { percobaan?: unknown }).percobaan;
      console.error("[uji-coba] kolam gagal", percobaan);
      return NextResponse.json(
        {
          error: "Mesin AI sedang tidak tersedia. Coba lagi beberapa saat lagi.",
          // Diagnostik aman: hanya label penyedia + alasan singkat
          // (mis. "tidak ada kunci", "HTTP 401") — tidak ada nilai kunci.
          diagnostik: percobaan ?? [],
        },
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
    ipSidik,
    pedoman,
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
  const percobaanIpBaru = Number(catatanIp?.percobaan ?? 0) + 1;
  const perangkatTerlihat = Array.isArray(catatanIp?.perangkatIds) ? (catatanIp.perangkatIds as string[]) : [];
  await simpan("ipUji", {
    id: ipSidik,
    percobaan: percobaanIpBaru,
    ditolak: Number(catatanIp?.ditolak ?? 0),
    pertama: typeof catatanIp?.pertama === "string" ? catatanIp.pertama : new Date().toISOString(),
    terakhir: new Date().toISOString(),
    perangkatIds: [...new Set([...perangkatTerlihat, perangkatId])].slice(-10),
  });

  return NextResponse.json({
    sesiId,
    judul,
    pedoman,
    sisaJatah: Math.max(0, BATAS_UJI - percobaanIpBaru),
    ...generasi,
    refs,
    dariTembolok,
    penyedia: dariTembolok ? "tembolok" : undefined,
  });
}
