import { NextResponse } from "next/server";
import {
  COOKIE_AKSES,
  COOKIE_PERANGKAT,
  UMUR_PERANGKAT_DETIK,
  UMUR_SESI_DETIK,
  cookieSecure,
  gerbangAktif,
  jenisDariKunci,
  kunciUntukJenis,
  sidikKunciGratisAktif,
  tandaAkses,
  tandaPerangkat,
  tandaSama,
  type JenisKunci,
} from "@/lib/security/akses";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";
import { penggunaDariCookie, tierEfektif } from "@/lib/server/identitas";
import { statusKunciPribadi } from "@/lib/server/kunci-pribadi";
import { aktifkanPremiumDariKunci } from "@/lib/server/lapis";
import { catatDanBeritahuLogin } from "@/lib/server/notif-login";
import { pesanBatasPerangkat, saringPerangkatAkun } from "@/lib/server/perangkat-akun";
import { simpan } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Maksimal 5 percobaan per 15 menit per IP — menahan tebakan kunci. */
const JENDELA_MS = 15 * 60 * 1000;
const MAKS_PERCOBAAN = 5;
/** Batas lidah global agar percobaan dari banyak IP tetap tertahan. */
const MAKS_GLOBAL = 60;
/** Batas per identitas Google (bila sudah login) untuk percobaan kunci. */
const MAKS_PER_IDENTITAS = 10;

/** Terbitkan cookie gerbang yang ditandatangani kunci milik `jenis`. */
function terbitkanCookie(res: NextResponse, jenis: JenisKunci, ingat: boolean) {
  const kunci = kunciUntukJenis(jenis);
  res.cookies.set({
    name: COOKIE_AKSES,
    value: tandaAkses(kunci),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: UMUR_SESI_DETIK,
  });
  // Perangkat tepercaya: 365 hari, diperpanjang otomatis oleh middleware.
  if (ingat) {
    res.cookies.set({
      name: COOKIE_PERANGKAT,
      value: tandaPerangkat(kunci),
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: UMUR_PERANGKAT_DETIK,
    });
  }
}

/**
 * Gerbang setor kunci (ketetapan pemilik 4 Nov 2026 siang): akun
 * mahasiswa TIDAK mendapat akses apa pun sebelum menyetor minimal
 * satu kunci API pribadi — lewat jalur masuk mana pun. Mengembalikan
 * respons penolakan bila harus ditolak, null bila boleh lanjut.
 * Penolakan terjadi sebelum cap login ditulis, dan klien mengantar
 * mahasiswa ke /kunci, rute yang tercapai hanya dengan sesi Google.
 */
async function tolakBilaMahasiswaTanpaKunci(
  pengguna: { id: string; mahasiswa?: boolean },
): Promise<NextResponse | null> {
  if (!pengguna.mahasiswa) return null;
  const statusKunci = await statusKunciPribadi(pengguna.id);
  if (statusKunci.gemini.ada || statusKunci.groq.ada) return null;
  return NextResponse.json(
    {
      error:
        "Akun mahasiswa wajib menyetor kunci API pribadi dulu sebelum bisa masuk. Anda kami antar ke halaman Kunci API.",
      kode: "WAJIB_ISI_KUNCI",
    },
    { status: 403 },
  );
}

/**
 * Mode identitas: pulihkan sesi gerbang TANPA mengetik kunci, hanya untuk
 * identitas Google yang sudah membuktikan haknya —
 *  - premium masih aktif (menempel di identitas; selamat dari rotasi
 *    UTH_ACCESS_KEY karena tersimpan di store, bukan di nilai env), atau
 *  - sidik kunci gratis tersimpan cocok dengan UTH_KUNCI_GRATIS saat ini.
 * Selain itu ditolak jujur dengan kode WAJIB_KUNCI.
 */
async function masukViaIdentitas(req: Request, ingat: boolean, perangkatId: unknown) {
  const pengguna = await penggunaDariCookie(req.headers.get("cookie"));
  if (!pengguna) {
    return NextResponse.json(
      { error: "Belum masuk dengan Google.", kode: "WAJIB_GOOGLE" },
      { status: 401 },
    );
  }

  let jenis: JenisKunci | null = null;
  if (tierEfektif(pengguna) === "premium") {
    jenis = "premium";
  } else {
    const sidikAktif = sidikKunciGratisAktif();
    if (
      sidikAktif &&
      pengguna.sidikKunciGratis &&
      tandaSama(pengguna.sidikKunciGratis, sidikAktif)
    ) {
      jenis = "gratis";
    }
  }

  const tolakMahasiswa = await tolakBilaMahasiswaTanpaKunci(pengguna);
  if (tolakMahasiswa) return tolakMahasiswa;

  if (!jenis) {
    return NextResponse.json(
      {
        error:
          "Akun Google ini belum terverifikasi kunci akses. Masukkan kunci akses Anda sekali untuk melanjutkan.",
        kode: "WAJIB_KUNCI",
      },
      { status: 403 },
    );
  }

  // Batas perangkat per akun (gratis 1, premium 2): pemulihan sesi di
  // perangkat yang tidak terdaftar dan di luar jatah ditolak di sini.
  const saring = await saringPerangkatAkun(pengguna, perangkatId, req.headers.get("user-agent"));
  if (!saring.ok) {
    return NextResponse.json(
      { error: pesanBatasPerangkat(saring.tier, saring.batas), kode: "BATAS_PERANGKAT" },
      { status: 403 },
    );
  }

  await catatDanBeritahuLogin(pengguna, req);

  const res = NextResponse.json({ ok: true, ingat, jenis, via: "identitas" });
  res.headers.set("Cache-Control", "no-store");
  terbitkanCookie(res, jenis, ingat);
  return res;
}

export async function POST(req: Request) {
  if (!asalSah(req)) {
    return NextResponse.json({ error: "Asal permintaan tidak dikenal." }, { status: 403 });
  }

  const ip = ipKlien(req);
  const perIp = bolehLaju(`masuk:${ip}`, MAKS_PERCOBAAN, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(
      perIp.ulangDetik,
      `Terlalu banyak percobaan. Coba lagi dalam ${perIp.ulangDetik} detik.`,
    );
  }
  const global = bolehLaju("masuk:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Percobaan masuk sedang dibatasi. Coba lagi nanti.");
  }

  if (!gerbangAktif()) {
    return NextResponse.json(
      {
        error:
          "Gerbang akses belum diaktifkan di server. Isi UTH_ACCESS_KEY (minimal 16 karakter) pada .env.local lalu restart.",
      },
      { status: 503 },
    );
  }

  let body: { kunci?: unknown; ingat?: unknown; mode?: unknown; perangkatId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Badan permintaan bukan JSON." }, { status: 400 });
  }

  const ingat = body.ingat !== false; // default: ingat perangkat

  if (body.mode === "identitas") {
    return masukViaIdentitas(req, ingat, body.perangkatId);
  }

  const dikirim = typeof body.kunci === "string" ? body.kunci.trim() : "";
  if (!dikirim) {
    return NextResponse.json({ error: "Kunci akses wajib diisi." }, { status: 400 });
  }

  // Identitas Google yang menyertai percobaan ini (bila sudah login):
  // dipakai batas laju per identitas + penempelan hak (premium/sidik).
  const pengguna = await penggunaDariCookie(req.headers.get("cookie"));
  if (pengguna) {
    const perIdentitas = bolehLaju(
      `masuk-user:${pengguna.id}`,
      MAKS_PER_IDENTITAS,
      JENDELA_MS,
    );
    if (!perIdentitas.boleh) {
      return balasanLaju(
        perIdentitas.ulangDetik,
        `Terlalu banyak percobaan dari akun ini. Coba lagi dalam ${perIdentitas.ulangDetik} detik.`,
      );
    }
  }

  // Server memilah jenis kunci (perbandingan sidik HMAC waktu konstan di
  // jenisDariKunci). Kunci tidak pernah ditulis ke log. Bila
  // UTH_KUNCI_GRATIS kosong, hanya kunci premium yang bisa cocok —
  // tebakan lain ditolak dengan pesan umum yang sama.
  const jenis = jenisDariKunci(dikirim);
  if (!jenis) {
    return NextResponse.json({ error: "Kunci akses salah." }, { status: 401 });
  }

  // Tempelkan hak ke identitas yang sudah login Google:
  //  - premium → premium 30 hari menempel ke identitas (sumber
  //    "kunci-premium"; mengulang saat aktif TIDAK memperpanjang);
  //  - gratis  → sidik kunci gratis dicatat pada identitas.
  let terbaru = pengguna;
  if (pengguna && jenis === "premium") {
    terbaru = await aktifkanPremiumDariKunci(pengguna);
  } else if (pengguna && jenis === "gratis") {
    const sidik = sidikKunciGratisAktif();
    if (sidik && pengguna.sidikKunciGratis !== sidik) {
      terbaru = { ...pengguna, sidikKunciGratis: sidik };
      await simpan("pengguna", {
        ...terbaru,
      } as unknown as Record<string, unknown> & { id: string });
    }
  }

  // Gerbang setor kunci berlaku juga di jalur kunci akses: mahasiswa
  // yang menyertai percobaan ini tetapi belum menyetor kunci pribadi
  // tidak dibukakan aksesnya walau kunci bersamanya benar.
  if (terbaru) {
    const tolakMahasiswa = await tolakBilaMahasiswaTanpaKunci(terbaru);
    if (tolakMahasiswa) return tolakMahasiswa;
  }

  // Batas perangkat per akun (gratis 1, premium 2), dinilai SESUDAH hak
  // menempel agar lapis barunya yang menentukan jatah: kunci premium
  // yang dimasukkan di perangkat kedua tetap lolos (jatah premium 2),
  // sedangkan perangkat di luar jatah ditolak sebelum cookie terbit.
  // Tanpa identitas Google tidak ada akun yang bisa diikat, jadi
  // pemeriksaan ini khusus mode identitas.
  if (terbaru) {
    const saring = await saringPerangkatAkun(terbaru, body.perangkatId, req.headers.get("user-agent"));
    if (!saring.ok) {
      return NextResponse.json(
        { error: pesanBatasPerangkat(saring.tier, saring.batas), kode: "BATAS_PERANGKAT" },
        { status: 403 },
      );
    }
  }

  if (terbaru) await catatDanBeritahuLogin(terbaru, req);

  const res = NextResponse.json({ ok: true, ingat, jenis });
  res.headers.set("Cache-Control", "no-store");
  terbitkanCookie(res, jenis, ingat);
  return res;
}

/** Keluar: hapus kedua cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE_AKSES, value: "", path: "/", maxAge: 0 });
  res.cookies.set({ name: COOKIE_PERANGKAT, value: "", path: "/", maxAge: 0 });
  return res;
}
