/**
 * Gerbang akses tingkat tepi (Edge Middleware).
 *
 * Aktif HANYA bila `UTH_ACCESS_KEY` (min. 16 karakter) diisi di environment.
 * Selama kosong, aplikasi berjalan seperti biasa di localhost — jadi
 * pengembangan lokal tidak terganggu dan tidak ada risiko terkunci.
 *
 * Dua jalur masuk:
 *  1. `uthruha_akses`    — sesi 7 hari, hasil mengetik kunci.
 *  2. `uthruha_perangkat`— perangkat tepercaya 365 hari. Bila Anda mencentang
 *     "ingat perangkat ini" sekali, laptop Anda langsung masuk sendiri
 *     seterusnya. Sliding: masa berlakunya diperpanjang tiap kali dipakai.
 *
 * Yang dijaga: seluruh halaman dan API, kecuali halaman masuk, API masuk, dan
 * aset statis.
 *
 * Catatan jujur: ini mencegah orang asing memakai aplikasi dan API Anda.
 * Ia TIDAK mencegah penyalinan HTML/JS yang sudah terkirim ke peramban yang
 * sah — hal itu mustahil dicegah dari sisi server. Yang benar-benar rahasia
 * (kunci API, prompt, model) tetap di server dan tidak pernah ikut terkirim.
 */
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_AKSES = "uthruha_akses";
const COOKIE_PERANGKAT = "uthruha_perangkat";
const PESAN = "uthruha-akses-v1";
const PESAN_PERANGKAT = "uthruha-perangkat-v1";
const UMUR_SESI_DETIK = 7 * 24 * 60 * 60;
const UMUR_PERANGKAT_DETIK = 365 * 24 * 60 * 60;

function kunciAkses(): string {
  return process.env.UTH_ACCESS_KEY?.trim() ?? "";
}

function gerbangAktif(): boolean {
  return kunciAkses().length >= 16;
}

/**
 * Kunci kedua: UTH_KUNCI_GRATIS (lapis gratis). Cookie yang diterbitkan
 * lewat kunci gratis ditandatangani dengan kunci itu; validasi menerima
 * tanda dari kunci aktif mana pun. Logika ini HARUS mencerminkan
 * lib/security/akses.ts (jenisDariKunci & kunciValidasi di sana).
 */
function kunciGratis(): string {
  return process.env.UTH_KUNCI_GRATIS?.trim() ?? "";
}

function gerbangGratisAktif(): boolean {
  return kunciGratis().length >= 16;
}

/** Kunci aktif untuk validasi: premium selalu; gratis ditambahkan bila aktif. */
function daftarKunci(): string[] {
  const daftar = [kunciAkses()];
  if (gerbangGratisAktif()) daftar.push(kunciGratis());
  return daftar;
}

/**
 * Seperti nilaiSah, tetapi mengembalikan KUNCI yang cocok (atau null) —
 * dibutuhkan agar perpanjangan cookie perangkat ditandatangani ulang
 * dengan kunci yang sama seperti yang memvalidasinya.
 */
async function kunciYangCocok(
  nilai: string | undefined,
  pesan: string,
  maksUmurDetik: number,
): Promise<string | null> {
  for (const kunci of daftarKunci()) {
    if (await nilaiSah(nilai, kunci, pesan, maksUmurDetik)) return kunci;
  }
  return null;
}

function cookieSecure(): boolean {
  const paksa = process.env.UTH_COOKIE_SECURE?.trim();
  if (paksa === "0") return false;
  if (paksa === "1") return true;
  return process.env.NODE_ENV === "production";
}

/** HMAC-SHA256 lewat Web Crypto — hasil sama dengan versi Node. */
async function tanda(kunci: string, pesan: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(kunci),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(pesan));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function samaWaktuKonstan(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i += 1) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

/**
 * Verifikasi nilai cookie format N-03: `<detik-terbit>.<HMAC(pesan + "." +
 * detik-terbit)>` — HARUS identik dengan nilaiSah() di lib/security/akses.ts.
 * Token lama tanpa cap waktu ditolak; pengguna cukup masuk ulang sekali.
 */
async function nilaiSah(
  nilai: string | undefined,
  kunci: string,
  pesan: string,
  maksUmurDetik: number,
): Promise<boolean> {
  if (!nilai) return false;
  const titik = nilai.indexOf(".");
  if (titik <= 0) return false;
  const ts = Number(nilai.slice(0, titik));
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const sekarang = Math.floor(Date.now() / 1000);
  if (ts > sekarang + 300) return false;
  if (sekarang - ts > maksUmurDetik) return false;
  const harap = `${ts}.${await tanda(kunci, `${pesan}.${ts}`)}`;
  return samaWaktuKonstan(nilai, harap);
}

const JALUR_BEBAS = new Set([
  // Halaman publik (Langkah 0 publikasi OAuth, 28 Okt 2026): beranda
  // menjelaskan fungsi aplikasi dan memuat tautan kebijakan privasi —
  // syarat verifikasi merek Google TIDAK BOLEH hanya halaman login.
  // Ketiganya halaman statis tanpa data pengguna; semua rute ruang
  // kerja & API lain tetap tergerbang persis seperti sebelumnya.
  "/",
  "/privasi",
  "/ketentuan",
  "/api/masuk",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  // Login Google kini terjadi DI halaman awal, SEBELUM kunci akses —
  // endpoint penukar id_token dan pembaca status identitas harus bisa
  // dicapai tanpa cookie gerbang. Keamanan keduanya BUKAN gerbang ini:
  // /api/auth/google memverifikasi id_token ke Google di server +
  // batas laju; /api/auth/status hanya membaca cookie identitas milik
  // pemanggil sendiri. Identitas saja TIDAK membuka apa pun: semua API
  // lain tetap memeriksa cookie gerbang (lapis kedua tolakTanpaSesi).
  "/api/auth/google",
  "/api/auth/status",
  // Keluar/ganti akun juga harus tercapai SEBELUM gerbang (tombol
  // "Ganti akun" di /masuk dipakai pengunjung yang belum punya sesi
  // gerbang) dan dari dalam ruang kerja. Endpoint ini tidak memberi
  // akses apa pun — ia hanya MEMBERSIHKAN cookie milik pemanggil
  // sendiri, dan handler-nya memeriksa asal (asalSah) seperti POST lain.
  "/api/auth/keluar",
  // Fase 3 (keputusan pemilik E): uji coba tamu memang SEBELUM mendaftar.
  // Keamanannya bukan gerbang ini melainkan rem berlapis di handler-nya:
  // pembatas laju IP+global, tembolok per judul, blokir perangkat pada
  // percobaan kedua. Jangan tambah rute berbayar/LLM lain ke daftar ini.
  "/api/uji-coba",
  // Masuk persona uji (cabang uji-persona): handler-nya sendiri membalas
  // 404 di luar mode uji, jadi jalur ini aman walau kode ini terbawa.
  "/api/uji/status",
  "/api/uji/masuk",
  "/api/uji-coba/kembangkan",
  // Webhook Midtrans adalah panggilan server-ke-server tanpa cookie;
  // keamanannya signature_key SHA512 yang diverifikasi di handler.
  "/api/bayar/webhook",
  // Pengelolaan bank rujukan bersama oleh Vercel Cron tiap malam:
  // panggilan server-ke-server tanpa cookie, tanpa data pengguna, tanpa
  // LLM. Bila CRON_SECRET terisi, handler mewajibkan header-nya persis.
  "/api/kron/bank-rujukan",
]);

/** Tujuan setelah berhasil masuk; hanya jalur internal (anti open redirect). */
function tujuanAman(nilai: string | null): string {
  if (!nilai) return "/";
  if (!nilai.startsWith("/") || nilai.startsWith("//")) return "/";
  return nilai;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!gerbangAktif()) return NextResponse.next();
  if (JALUR_BEBAS.has(pathname)) return NextResponse.next();

  const sesi = req.cookies.get(COOKIE_AKSES)?.value;
  const perangkat = req.cookies.get(COOKIE_PERANGKAT)?.value;

  const sesiSah =
    (await kunciYangCocok(sesi, PESAN, UMUR_SESI_DETIK)) !== null;
  const kunciPerangkat = await kunciYangCocok(
    perangkat,
    PESAN_PERANGKAT,
    UMUR_PERANGKAT_DETIK,
  );
  const perangkatSah = kunciPerangkat !== null;
  const masuk = sesiSah || perangkatSah;

  // Sudah pernah masuk lalu membuka /masuk → langsung antar ke tujuan.
  // Inilah bagian "otomatis login" saat Anda membuka tautan lama.
  if (pathname === "/masuk") {
    if (masuk) {
      const tujuan = req.nextUrl.clone();
      const lanjut = tujuanAman(tujuan.searchParams.get("lanjut"));
      return NextResponse.redirect(new URL(lanjut, req.url));
    }
    return NextResponse.next();
  }

  if (!masuk) {
    // Permintaan API: balas JSON 401, jangan dialihkan ke halaman HTML.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Akses ditolak. Buka /masuk lalu masukkan kunci akses." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const tujuan = req.nextUrl.clone();
    tujuan.pathname = "/masuk";
    tujuan.search = "";
    tujuan.searchParams.set("lanjut", pathname + search);
    return NextResponse.redirect(tujuan);
  }

  const res = NextResponse.next();

  // Perpanjang masa berlaku perangkat tepercaya setiap kali dipakai (sliding),
  // supaya laptop sehari-hari tidak pernah tiba-tiba diminta kunci lagi.
  // Nilai diterbitkan ULANG dengan cap waktu segar (N-03): token yang
  // beredar selalu berumur muda, token curian lama tetap kedaluwarsa
  // pada jadwalnya sendiri.
  if (perangkatSah && kunciPerangkat) {
    const ts = Math.floor(Date.now() / 1000);
    res.cookies.set({
      name: COOKIE_PERANGKAT,
      value: `${ts}.${await tanda(kunciPerangkat, `${PESAN_PERANGKAT}.${ts}`)}`,
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: UMUR_PERANGKAT_DETIK,
    });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};