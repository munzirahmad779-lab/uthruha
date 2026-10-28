/**
 * Uji gerbang DUA KUNCI + login Google di halaman awal (28 Okt 2026).
 * Dijalankan melawan server lokal BERGERBANG dalam tiga fase (lihat
 * docs/FASE3-UJI.md bagian "Uji dua kunci"):
 *   FASE A — UTH_ACCESS_KEY=P1 + UTH_KUNCI_GRATIS terisi.
 *   FASE B — server direstart dengan UTH_ACCESS_KEY=P2 (ROTASI),
 *            data file yang sama: premium yang menempel harus selamat.
 *   FASE C — server tanpa UTH_KUNCI_GRATIS: jalur gratis tertutup jujur.
 *
 * Identitas memakai cookie sesi pengguna ASLI (buatNilaiSesi dengan
 * UTH_SESI_SECRET yang sama dengan server) untuk fixture dari
 * scripts/seed-uji-kunci.ts — jalur produksi, bukan header uji.
 * Setiap kelompok percobaan /api/masuk memakai cf-connecting-ip berbeda
 * agar ember batas laju per-IP tidak saling mengotori.
 */
import { promises as fs } from "node:fs";
import { buatNilaiSesi } from "../lib/server/identitas";
import { tandaAkses } from "../lib/security/akses";

const BASE = process.env.UTH_URL_UJI || "http://127.0.0.1:3312";
const FASE = (process.env.FASE_UJI || "A").toUpperCase();
const KUNCI_PREMIUM = process.env.KUNCI_PREMIUM_UJI || "premium-uji-kunci-123456";
const KUNCI_PREMIUM_LAMA = process.env.KUNCI_PREMIUM_LAMA_UJI || "";
const KUNCI_GRATIS = process.env.KUNCI_GRATIS_UJI || "gratis-uji-kunci-123456";
const DATA_FILE = process.env.UJI_DATA_FILE || "";

let lulus = 0;
let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian = "") {
  if (kondisi) {
    lulus += 1;
    console.log(`  ✓ ${nama}${rincian ? ` — ${rincian}` : ""}`);
  } else {
    gagal += 1;
    console.log(`  ✗ GAGAL: ${nama}${rincian ? ` — ${rincian}` : ""}`);
  }
}

interface Hasil {
  status: number;
  data: Record<string, unknown>;
  teks: string;
  setCookie: string[];
}

async function panggil(
  metode: string,
  jalur: string,
  opsi: { cookie?: string; badan?: unknown; ip?: string } = {},
): Promise<Hasil> {
  const res = await fetch(`${BASE}${jalur}`, {
    method: metode,
    headers: {
      "Content-Type": "application/json",
      ...(opsi.cookie ? { Cookie: opsi.cookie } : {}),
      ...(opsi.ip ? { "cf-connecting-ip": opsi.ip } : {}),
    },
    body: opsi.badan ? JSON.stringify(opsi.badan) : undefined,
  });
  const teks = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(teks) as Record<string, unknown>;
  } catch { /* halaman HTML */ }
  return { status: res.status, data, teks, setCookie: res.headers.getSetCookie() };
}

function cookieDari(setCookie: string[], nama: string): string | null {
  for (const baris of setCookie) {
    const pasangan = baris.split(";")[0]!;
    const i = pasangan.indexOf("=");
    if (i > 0 && pasangan.slice(0, i).trim() === nama) return pasangan.slice(i + 1).trim();
  }
  return null;
}

const cookieUser = (id: string) => `uthruha_user=${buatNilaiSesi(id)}`;
const IP = (n: number) => `198.51.100.${n}`;

async function bacaPenggunaStore(id: string): Promise<Record<string, unknown> | null> {
  if (!DATA_FILE) return null;
  const db = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as {
    pengguna?: Record<string, Record<string, unknown>>;
  };
  return db.pengguna?.[id] ?? null;
}

async function faseA() {
  console.log("== FASE A: dua kunci aktif ==");

  const tanpaLogin = await panggil("POST", "/api/kata-kunci", { badan: { teks: "uji" } });
  cek("Tanpa login sama sekali → API tertolak 401", tanpaLogin.status === 401, `HTTP ${tanpaLogin.status}`);

  const authPalsu = await panggil("POST", "/api/auth/google", { badan: { idToken: "token-palsu" } });
  cek(
    "POST /api/auth/google tanpa cookie gerbang mencapai handler (bukan diblokir middleware)",
    authPalsu.status === 401 && String(authPalsu.data.error ?? "").includes("Token Google"),
    `HTTP ${authPalsu.status} ${String(authPalsu.data.error ?? "")}`,
  );

  const halamanMasuk = await panggil("GET", "/masuk");
  cek(
    "Halaman /masuk termuat untuk tamu & memuat formulir kunci",
    halamanMasuk.status === 200 && halamanMasuk.teks.includes("Kunci akses"),
    `HTTP ${halamanMasuk.status}`,
  );

  const statusTamu = await panggil("GET", "/api/auth/status");
  cek("Status identitas tamu: pengguna null", statusTamu.data.pengguna === null && statusTamu.data.bisaMasukTanpaKunci === false);

  const statusPol = await panggil("GET", "/api/auth/status", { cookie: cookieUser("uji-kunci-pol") });
  cek(
    "Google saja (tanpa kunci): identitas terbaca, belum bisa masuk tanpa kunci",
    statusPol.status === 200 &&
      (statusPol.data.pengguna as { email?: string } | null)?.email === "uji-kunci-pol@uji.local" &&
      statusPol.data.bisaMasukTanpaKunci === false,
  );

  const apiTanpaGerbang = await panggil("GET", "/api/lapis/status", { cookie: cookieUser("uji-kunci-pol") });
  cek("Google saja tanpa kunci → API ruang kerja TERTOLAK jujur 401", apiTanpaGerbang.status === 401, `HTTP ${apiTanpaGerbang.status}`);

  const identitasPol = await panggil("POST", "/api/masuk", {
    cookie: cookieUser("uji-kunci-pol"),
    badan: { mode: "identitas" },
    ip: IP(1),
  });
  cek(
    "Mode identitas tanpa bukti kunci → 403 WAJIB_KUNCI",
    identitasPol.status === 403 && identitasPol.data.kode === "WAJIB_KUNCI",
    `HTTP ${identitasPol.status} ${String(identitasPol.data.kode ?? "")}`,
  );

  const kunciSalah = await panggil("POST", "/api/masuk", { badan: { kunci: "kunci-ngawur-123456" }, ip: IP(2) });
  cek("Kunci salah → 401 pesan umum", kunciSalah.status === 401 && kunciSalah.data.error === "Kunci akses salah.", `HTTP ${kunciSalah.status}`);

  // --- Kunci GRATIS ---
  const masukGratis = await panggil("POST", "/api/masuk", {
    cookie: cookieUser("uji-kunci-gratis"),
    badan: { kunci: KUNCI_GRATIS },
    ip: IP(3),
  });
  const gerbangGratis = cookieDari(masukGratis.setCookie, "uthruha_akses");
  cek(
    "Kunci gratis + identitas → 200 jenis gratis & cookie gerbang terbit",
    masukGratis.status === 200 && masukGratis.data.jenis === "gratis" && Boolean(gerbangGratis),
    `HTTP ${masukGratis.status}`,
  );
  const gabungGratis = `uthruha_akses=${gerbangGratis}; ${cookieUser("uji-kunci-gratis")}`;
  const proyek1 = await panggil("POST", "/api/lapis/proyek", {
    cookie: gabungGratis,
    badan: { judul: "Proyek dari kunci gratis", kategoriId: "quran" },
  });
  cek("Sesi kunci gratis membuka ruang kerja: proyek #1 dibuat", proyek1.status === 200, `HTTP ${proyek1.status}`);
  const proyek2 = await panggil("POST", "/api/lapis/proyek", {
    cookie: gabungGratis,
    badan: { judul: "Proyek kedua dari kunci gratis", kategoriId: "quran" },
  });
  cek(
    "Aturan lapis GRATIS berlaku penuh: proyek #2 ditolak BATAS_PROYEK",
    proyek2.status === 403 && proyek2.data.kode === "BATAS_PROYEK",
    `HTTP ${proyek2.status} ${String(proyek2.data.kode ?? "")}`,
  );
  const statusGratis = await panggil("GET", "/api/auth/status", { cookie: cookieUser("uji-kunci-gratis") });
  cek(
    "Sidik kunci gratis menempel ke identitas (terverifikasi)",
    statusGratis.data.kunciGratisTerverifikasi === true && statusGratis.data.bisaMasukTanpaKunci === true,
  );
  const pulihGratis = await panggil("POST", "/api/masuk", {
    cookie: cookieUser("uji-kunci-gratis"),
    badan: { mode: "identitas" },
    ip: IP(4),
  });
  cek(
    "Mode identitas (sidik gratis cocok) → sesi pulih tanpa mengetik kunci",
    pulihGratis.status === 200 && pulihGratis.data.jenis === "gratis",
    `HTTP ${pulihGratis.status}`,
  );

  // --- Kunci PREMIUM ---
  const masukPremium = await panggil("POST", "/api/masuk", {
    cookie: cookieUser("uji-kunci-premium"),
    badan: { kunci: KUNCI_PREMIUM },
    ip: IP(5),
  });
  const gerbangPremium = cookieDari(masukPremium.setCookie, "uthruha_akses");
  cek(
    "Kunci premium + identitas → 200 jenis premium & cookie gerbang terbit",
    masukPremium.status === 200 && masukPremium.data.jenis === "premium" && Boolean(gerbangPremium),
    `HTTP ${masukPremium.status}`,
  );
  const gabungPremium = `uthruha_akses=${gerbangPremium}; ${cookieUser("uji-kunci-premium")}`;
  const statusPremium = await panggil("GET", "/api/lapis/status", { cookie: gabungPremium });
  cek("Premium MENEMPEL ke identitas: tier premium", statusPremium.data.tier === "premium", `tier=${String(statusPremium.data.tier)}`);
  const sampai1 = String(statusPremium.data.premiumSampai ?? "");
  const sisaHari = (new Date(sampai1).getTime() - Date.now()) / 86_400_000;
  cek("Masa premium ≈ 30 hari", sisaHari > 29 && sisaHari <= 30.1, `${sisaHari.toFixed(2)} hari`);
  const recPremium = await bacaPenggunaStore("uji-kunci-premium");
  cek(
    "Sumber aktivasi tercatat 'kunci-premium' di store",
    recPremium?.premiumSumber === "kunci-premium",
    String(recPremium?.premiumSumber ?? "(tidak terbaca)"),
  );

  const masukPremiumLagi = await panggil("POST", "/api/masuk", {
    cookie: cookieUser("uji-kunci-premium"),
    badan: { kunci: KUNCI_PREMIUM },
    ip: IP(6),
  });
  const statusPremium2 = await panggil("GET", "/api/lapis/status", { cookie: gabungPremium });
  cek(
    "Kunci premium dimasukkan ulang saat aktif → TIDAK menumpuk (premiumSampai tetap)",
    masukPremiumLagi.status === 200 && String(statusPremium2.data.premiumSampai ?? "") === sampai1,
    `${sampai1} → ${String(statusPremium2.data.premiumSampai ?? "")}`,
  );

  const polPakaiPremium = await panggil("POST", "/api/masuk", {
    cookie: cookieUser("uji-kunci-pol"),
    badan: { kunci: KUNCI_PREMIUM },
    ip: IP(7),
  });
  cek(
    "Kunci premium yang sama bisa dipakai identitas lain (model kunci bersama)",
    polPakaiPremium.status === 200 && polPakaiPremium.data.jenis === "premium",
    `HTTP ${polPakaiPremium.status}`,
  );

  // --- Batas laju percobaan kunci ---
  let semua401 = true;
  for (let i = 0; i < 5; i += 1) {
    const r = await panggil("POST", "/api/masuk", { badan: { kunci: `tebakan-salah-${i}-xxxx` }, ip: "203.0.113.77" });
    if (r.status !== 401) semua401 = false;
  }
  const keenam = await panggil("POST", "/api/masuk", { badan: { kunci: "tebakan-salah-keenam" }, ip: "203.0.113.77" });
  cek("Batas laju: 5 tebakan salah 401, percobaan ke-6 → 429", semua401 && keenam.status === 429, `ke-6 HTTP ${keenam.status}`);

  // --- Regresi webhook ---
  const webhookPalsu = await panggil("POST", "/api/bayar/webhook", {
    badan: {
      order_id: "order-regresi-kunci",
      status_code: "200",
      gross_amount: "10000.00",
      transaction_status: "settlement",
      signature_key: "0".repeat(128),
    },
  });
  cek("Regresi: webhook tanda tangan palsu tetap 403", webhookPalsu.status === 403, `HTTP ${webhookPalsu.status}`);
}

async function faseB() {
  console.log("== FASE B: sesudah ROTASI UTH_ACCESS_KEY ==");
  if (!KUNCI_PREMIUM_LAMA) throw new Error("KUNCI_PREMIUM_LAMA_UJI wajib diisi pada fase B");

  const recSebelum = await bacaPenggunaStore("uji-kunci-premium");
  const sampaiStore = String(recSebelum?.premiumSampai ?? "");
  cek(
    "Store: premium dari kunci masih tercatat (sumber kunci-premium)",
    Boolean(sampaiStore) && recSebelum?.premiumSumber === "kunci-premium",
    `s.d. ${sampaiStore}`,
  );

  const cookieLama = `uthruha_akses=${tandaAkses(KUNCI_PREMIUM_LAMA)}; ${cookieUser("uji-kunci-premium")}`;
  const sesiLama = await panggil("GET", "/api/lapis/status", { cookie: cookieLama });
  cek("Sesi gerbang dari kunci premium LAMA gugur sesudah rotasi (401)", sesiLama.status === 401, `HTTP ${sesiLama.status}`);

  const cookieBebas = `uthruha_akses=${tandaAkses(KUNCI_GRATIS)}; ${cookieUser("uji-kunci-gratis")}`;
  const sesiBebas = await panggil("GET", "/api/lapis/status", { cookie: cookieBebas });
  cek(
    "Sesi kunci GRATIS tidak ikut gugur oleh rotasi kunci premium",
    sesiBebas.status === 200 && sesiBebas.data.tier === "gratis",
    `HTTP ${sesiBebas.status}`,
  );

  const kunciLama = await panggil("POST", "/api/masuk", {
    cookie: cookieUser("uji-kunci-premium"),
    badan: { kunci: KUNCI_PREMIUM_LAMA },
    ip: IP(11),
  });
  cek("Kunci premium LAMA ditolak sesudah rotasi (401)", kunciLama.status === 401, `HTTP ${kunciLama.status}`);

  const pulih = await panggil("POST", "/api/masuk", {
    cookie: cookieUser("uji-kunci-premium"),
    badan: { mode: "identitas" },
    ip: IP(12),
  });
  const gerbangBaru = cookieDari(pulih.setCookie, "uthruha_akses");
  cek(
    "Mode identitas memulihkan sesi premium TANPA kunci baru (premium menempel selamat)",
    pulih.status === 200 && pulih.data.jenis === "premium" && Boolean(gerbangBaru),
    `HTTP ${pulih.status}`,
  );
  const statusSesudah = await panggil("GET", "/api/lapis/status", {
    cookie: `uthruha_akses=${gerbangBaru}; ${cookieUser("uji-kunci-premium")}`,
  });
  cek(
    "Premium tetap aktif dengan masa berlaku yang sama persis",
    statusSesudah.data.tier === "premium" && String(statusSesudah.data.premiumSampai ?? "") === sampaiStore,
    `${String(statusSesudah.data.premiumSampai ?? "")} vs store ${sampaiStore}`,
  );

  const kunciBaru = await panggil("POST", "/api/masuk", {
    cookie: cookieUser("uji-kunci-pol"),
    badan: { kunci: KUNCI_PREMIUM },
    ip: IP(13),
  });
  cek(
    "Kunci premium BARU (hasil rotasi) diterima",
    kunciBaru.status === 200 && kunciBaru.data.jenis === "premium",
    `HTTP ${kunciBaru.status}`,
  );
}

async function faseC() {
  console.log("== FASE C: UTH_KUNCI_GRATIS kosong — jalur gratis tertutup jujur ==");
  const cobaGratis = await panggil("POST", "/api/masuk", { badan: { kunci: KUNCI_GRATIS }, ip: IP(21) });
  cek(
    "Nilai kunci gratis ditolak biasa (401, bukan 500) saat env gratis kosong",
    cobaGratis.status === 401 && cobaGratis.data.error === "Kunci akses salah.",
    `HTTP ${cobaGratis.status}`,
  );
  const kosong = await panggil("POST", "/api/masuk", { badan: { kunci: "" }, ip: IP(22) });
  cek("Kunci kosong → 400", kosong.status === 400, `HTTP ${kosong.status}`);
  const premiumSaja = await panggil("POST", "/api/masuk", { badan: { kunci: KUNCI_PREMIUM }, ip: IP(23) });
  cek(
    "Kunci premium tetap bekerja sendirian",
    premiumSaja.status === 200 && premiumSaja.data.jenis === "premium",
    `HTTP ${premiumSaja.status}`,
  );
  const status = await panggil("GET", "/api/auth/status", { cookie: cookieUser("uji-kunci-gratis") });
  cek(
    "Status identitas: kunciGratisTerverifikasi false saat env gratis kosong",
    status.data.kunciGratisTerverifikasi === false,
  );
}

async function main() {
  if (FASE === "A") await faseA();
  else if (FASE === "B") await faseB();
  else await faseC();
  console.log(`\nHASIL FASE ${FASE}: ${lulus} lulus, ${gagal} gagal`);
  if (gagal > 0) process.exit(1);
}

void main();
