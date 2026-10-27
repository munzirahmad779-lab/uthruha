/**
 * Uji ADVERSARIAL pembayaran (audit keamanan bayar, 28 Okt 2026).
 *
 * Menyerang jalur bayar seperti penyerang sungguhan, melawan server lokal
 * mode uji dengan server key uji buatan sendiri (MIDTRANS_SERVER_KEY dari
 * env). Ground truth dibaca dari berkas store (UTH_DATA_FILE) — bukan dari
 * klaim respons API.
 *
 * Jalankan per fase (driver me-reset store + me-restart server antar fase):
 *   FASE=1a|1b|1c|2|3|4|5 npx tsx scripts/test-bayar-serangan.ts
 * Env: UTH_URL_UJI (bawaan http://127.0.0.1:3311), MIDTRANS_SERVER_KEY,
 *      UTH_DATA_FILE, UTH_SESI_SECRET (untuk fase 4, menempa cookie sesi).
 */
import { createHash, createHmac } from "node:crypto";
import { promises as fs } from "node:fs";

const BASE = process.env.UTH_URL_UJI || "http://127.0.0.1:3311";
const FASE = process.env.FASE || "1a";
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || "";
const SESI_SECRET = process.env.UTH_SESI_SECRET || "";
const DATA_FILE = process.env.UTH_DATA_FILE || "";

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
}

async function panggil(
  metode: string,
  jalur: string,
  opsi: { uji?: string; badan?: unknown; headers?: Record<string, string>; cookie?: string } = {},
): Promise<Hasil> {
  const res = await fetch(`${BASE}${jalur}`, {
    method: metode,
    headers: {
      "Content-Type": "application/json",
      ...(opsi.uji ? { "x-uji-user": opsi.uji } : {}),
      ...(opsi.cookie ? { cookie: opsi.cookie } : {}),
      ...(opsi.headers ?? {}),
    },
    body: opsi.badan ? JSON.stringify(opsi.badan) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

async function bacaDB(): Promise<Record<string, Record<string, Record<string, unknown>>>> {
  const teks = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(teks) as Record<string, Record<string, Record<string, unknown>>>;
}
const jeda = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tanda(orderId: string, statusCode: string, gross: string): string {
  return createHash("sha512").update(`${orderId}${statusCode}${gross}${SERVER_KEY}`).digest("hex");
}

function badanWebhook(orderId: string, gross: string, tStatus: string, fraud?: string) {
  const b: Record<string, unknown> = {
    order_id: orderId,
    status_code: tStatus === "pending" ? "201" : "200",
    gross_amount: gross,
    transaction_status: tStatus,
    payment_type: "qris",
    signature_key: tanda(orderId, tStatus === "pending" ? "201" : "200", gross),
  };
  if (fraud) b.fraud_status = fraud;
  return b;
}

async function buatOrder(uji = "UJI-GRATIS", badan: unknown = undefined, headers?: Record<string, string>) {
  return panggil("POST", "/api/bayar/buat", { uji, badan, headers });
}

async function penggunaDB(id: string) {
  const db = await bacaDB();
  return db.pengguna?.[id] ?? null;
}
async function pembayaranDB(orderId: string) {
  const db = await bacaDB();
  return db.pembayaran?.[orderId] ?? null;
}
function hariDariSekarang(iso: string | null | undefined): number {
  if (!iso) return -1;
  return (new Date(iso).getTime() - Date.now()) / 86_400_000;
}

async function fase1a() {
  console.log("== FASE 1a: pembuatan order + webhook non-aktivasi ==");
  // 2) Tanpa sesi sama sekali → 401
  const tanpa = await panggil("POST", "/api/bayar/buat", {});
  cek("Buat order TANPA sesi ditolak 401", tanpa.status === 401, `HTTP ${tanpa.status}`);

  // 2) Body klien (nominal & userId lain) diabaikan; nominal & pemilik dari server/sesi
  const buat = await buatOrder("UJI-GRATIS", { jumlah: 1, userId: "uji-premium", gross_amount: 1 });
  cek("Buat order dengan body manipulatif tetap 200", buat.status === 200, `HTTP ${buat.status}`);
  const orderId = String(buat.data.orderId ?? "");
  cek("order_id berformat UTH- + 24 heksadesimal acak", /^UTH-[0-9a-f]{24}$/.test(orderId), orderId);
  await jeda(200);
  const rec = await pembayaranDB(orderId);
  cek("Nominal tersimpan DITENTUKAN SERVER (10000, bukan 1 dari body)", rec?.jumlah === 10000, `jumlah=${String(rec?.jumlah)}`);
  cek("Order terikat identitas sesi (uji-gratis, bukan uji-premium dari body)", rec?.userId === "uji-gratis", `userId=${String(rec?.userId)}`);

  // 1f) order_id tidak dikenal, tanda tangan SAH → ditolak, tidak ada aktivasi
  const asing = await panggil("POST", "/api/bayar/webhook", { badan: badanWebhook("UTH-000000000000000000000000", "10000.00", "settlement") });
  cek("Webhook order TIDAK DIKENAL ditolak (404)", asing.status === 404, `HTTP ${asing.status}`);

  // 1a) tanda tangan palsu → 403, tidak aktif
  const palsu = { ...badanWebhook(orderId, "10000.00", "settlement"), signature_key: "0".repeat(128) };
  const rPalsu = await panggil("POST", "/api/bayar/webhook", { badan: palsu });
  cek("Webhook tanda tangan PALSU ditolak 403", rPalsu.status === 403, `HTTP ${rPalsu.status}`);

  // 1c) status bukan lunas (tanda tangan sah, nominal cocok) → tidak aktif
  for (const st of ["pending", "deny", "cancel", "expire"]) {
    const r = await panggil("POST", "/api/bayar/webhook", { badan: badanWebhook(orderId, "10000.00", st) });
    cek(`Webhook status ${st} diterima handler (200)`, r.status === 200, `HTTP ${r.status}`);
  }
  // 1d) capture + fraud challenge → tidak aktif
  const rCh = await panggil("POST", "/api/bayar/webhook", { badan: badanWebhook(orderId, "10000.00", "capture", "challenge") });
  cek("Webhook capture+challenge diterima handler (200)", rCh.status === 200, `HTTP ${rCh.status}`);

  await jeda(200);
  const u = await penggunaDB("uji-gratis");
  cek("Setelah pending/deny/cancel/expire/challenge: tier TETAP gratis", u?.tier === "gratis" && !u?.premiumSampai, `tier=${String(u?.tier)}`);
  const recAkhir = await pembayaranDB(orderId);
  cek("Status internal order BUKAN lunas_final", recAkhir?.statusInternal !== "lunas_final", `statusInternal=${String(recAkhir?.statusInternal)}`);
}

async function fase1b() {
  console.log("== FASE 1b: capture dengan fraud_status deny ==");
  const buat = await buatOrder();
  const orderId = String(buat.data.orderId ?? "");
  cek("Order dibuat", buat.status === 200 && orderId.length > 0, `HTTP ${buat.status}`);
  const r = await panggil("POST", "/api/bayar/webhook", { badan: badanWebhook(orderId, "10000.00", "capture", "deny") });
  cek("Webhook capture+deny diterima handler (200)", r.status === 200, `HTTP ${r.status}`);
  await jeda(200);
  const u = await penggunaDB("uji-gratis");
  cek("capture+deny TIDAK mengaktifkan premium", u?.tier === "gratis" && !u?.premiumSampai, `tier=${String(u?.tier)}`);
  const rec = await pembayaranDB(orderId);
  cek("Status internal order BUKAN lunas_final", rec?.statusInternal !== "lunas_final", `statusInternal=${String(rec?.statusInternal)}`);
}

async function fase1c() {
  console.log("== FASE 1c: nominal diubah dengan tanda tangan sah ==");
  const buat = await buatOrder();
  const orderId = String(buat.data.orderId ?? "");
  cek("Order dibuat", buat.status === 200 && orderId.length > 0, `HTTP ${buat.status}`);

  // 1b) gross_amount 5000.00, tanda tangan SAH untuk angka itu → TIDAK boleh aktif
  const rMurah = await panggil("POST", "/api/bayar/webhook", { badan: badanWebhook(orderId, "5000.00", "settlement") });
  cek("Webhook nominal-salah ditangani (200/4xx, bukan 5xx)", rMurah.status === 200 || rMurah.status === 400, `HTTP ${rMurah.status}`);
  await jeda(200);
  let u = await penggunaDB("uji-gratis");
  cek("Nominal 5000.00 TIDAK mengaktifkan premium", u?.tier === "gratis" && !u?.premiumSampai, `tier=${String(u?.tier)}`);

  // Format string lain ("10000" tanpa .00) + tanda tangan sah → TIDAK boleh aktif
  const rFmt = await panggil("POST", "/api/bayar/webhook", { badan: badanWebhook(orderId, "10000", "settlement") });
  cek("Webhook format-nominal-lain ditangani", rFmt.status === 200 || rFmt.status === 400, `HTTP ${rFmt.status}`);
  await jeda(200);
  u = await penggunaDB("uji-gratis");
  cek("Format '10000' (tanpa .00) TIDAK mengaktifkan premium", u?.tier === "gratis" && !u?.premiumSampai, `tier=${String(u?.tier)}`);

  // Sanity: nominal persis "10000.00" + tanda tangan sah → AKTIF (jalur sah tidak rusak)
  const rSah = await panggil("POST", "/api/bayar/webhook", { badan: badanWebhook(orderId, "10000.00", "settlement") });
  cek("Webhook sah persis diterima (200)", rSah.status === 200, `HTTP ${rSah.status}`);
  await jeda(200);
  u = await penggunaDB("uji-gratis");
  const hari = hariDariSekarang(u?.premiumSampai as string | null);
  cek("Jalur sah: premium aktif ±30 hari", u?.tier === "premium" && hari > 29 && hari < 31, `tier=${String(u?.tier)} sisa=${hari.toFixed(2)} hari`);
}

async function fase2() {
  console.log("== FASE 2: replay serial + status mundur setelah lunas ==");
  const buat = await buatOrder();
  const orderId = String(buat.data.orderId ?? "");
  cek("Order dibuat", buat.status === 200 && orderId.length > 0, `HTTP ${buat.status}`);
  const badan = badanWebhook(orderId, "10000.00", "settlement");
  for (let i = 1; i <= 3; i += 1) {
    const r = await panggil("POST", "/api/bayar/webhook", { badan });
    cek(`Replay settlement ke-${i} diterima (200)`, r.status === 200, `HTTP ${r.status}`);
  }
  await jeda(200);
  let u = await penggunaDB("uji-gratis");
  const hari = hariDariSekarang(u?.premiumSampai as string | null);
  cek("Replay 3× serial: premium diperpanjang SEKALI (±30 hari, bukan 60/90)", u?.tier === "premium" && hari > 29 && hari < 31, `sisa=${hari.toFixed(2)} hari`);

  // 1g) status mundur: expire SETELAH settlement untuk order yang sama
  const rExp = await panggil("POST", "/api/bayar/webhook", { badan: badanWebhook(orderId, "10000.00", "expire") });
  cek("Webhook expire-susulan diterima handler (200)", rExp.status === 200, `HTTP ${rExp.status}`);
  await jeda(200);
  const rec = await pembayaranDB(orderId);
  cek("Status internal TETAP lunas_final setelah expire susulan", rec?.statusInternal === "lunas_final", `statusInternal=${String(rec?.statusInternal)}`);
  u = await penggunaDB("uji-gratis");
  cek("Premium TIDAK dibatalkan oleh status mundur", u?.tier === "premium", `tier=${String(u?.tier)}`);
}

async function fase3() {
  console.log("== FASE 3: replay PARALEL (balapan) ==");
  const buat = await buatOrder();
  const orderId = String(buat.data.orderId ?? "");
  cek("Order dibuat", buat.status === 200 && orderId.length > 0, `HTTP ${buat.status}`);
  const badan = badanWebhook(orderId, "10000.00", "settlement");
  const hasil = await Promise.all(
    Array.from({ length: 5 }, () => panggil("POST", "/api/bayar/webhook", { badan })),
  );
  cek("5 webhook paralel semua tertangani", hasil.every((h) => h.status === 200), hasil.map((h) => h.status).join(","));
  await jeda(300);
  const u = await penggunaDB("uji-gratis");
  const hari = hariDariSekarang(u?.premiumSampai as string | null);
  cek("Balapan 5×: premium diperpanjang SEKALI (±30 hari)", u?.tier === "premium" && hari > 29 && hari < 31, `sisa=${hari.toFixed(2)} hari`);
}

function tempaCookie(userId: string, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const isi = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret).update(isi).digest("hex");
  return `uthruha_user=${isi}.${sig}`;
}

async function fase4() {
  console.log("== FASE 4: mode PRODUKSI (tanpa UTH_MODE_UJI) — header uji & cookie tempaan ==");
  // 3) header x-uji-user WAJIB diabaikan di luar mode uji
  const stUji = await panggil("GET", "/api/lapis/status", { uji: "UJI-PREMIUM" });
  cek("Header x-uji-user DIABAIKAN: status tetap tamu", stUji.data.pengguna === null && stUji.data.tier === "tamu", `tier=${String(stUji.data.tier)}`);
  const buatUji = await buatOrder("UJI-PREMIUM");
  cek("Buat order bermodal header uji ditolak 401", buatUji.status === 401, `HTTP ${buatUji.status}`);

  // Cookie SAH untuk uji-gratis → terbaca sebagai uji-gratis (tier dari store)
  const cookieSah = tempaCookie("uji-gratis", SESI_SECRET);
  const stSah = await panggil("GET", "/api/lapis/status", { cookie: cookieSah });
  const pg = stSah.data.pengguna as { id?: string } | null;
  cek("Cookie sesi sah terbaca (uji-gratis)", pg?.id === "uji-gratis", `id=${String(pg?.id)}`);
  cek("Tier dibaca dari STORE (gratis), bukan klaim cookie", stSah.data.tier === "gratis", `tier=${String(stSah.data.tier)}`);

  // Cookie ditempa: userId diganti ke uji-premium, tanda tangan lama → ditolak
  const potong = tempaCookie("uji-gratis", SESI_SECRET).split(".");
  const sig = potong.pop();
  const exp = potong.pop();
  const cookieTempa = `uthruha_user=uji-premium.${exp}.${sig}`;
  const stTempa = await panggil("GET", "/api/lapis/status", { cookie: cookieTempa });
  cek("Cookie dengan userId diganti (klaim premium) DITOLAK → tamu", stTempa.data.pengguna === null, `pengguna=${JSON.stringify(stTempa.data.pengguna)}`);

  // Cookie dengan rahasia yang salah → ditolak
  const cookieSalah = tempaCookie("uji-premium", "rahasia-yang-salah-total");
  const stSalah = await panggil("GET", "/api/lapis/status", { cookie: cookieSalah });
  cek("Cookie bertanda tangan rahasia asing DITOLAK → tamu", stSalah.data.pengguna === null, `pengguna=${JSON.stringify(stSalah.data.pengguna)}`);

  // 4) Konfigurasi publik hanya memuat client key, BUKAN server key
  const konfig = await panggil("GET", "/api/bayar/buat", {});
  cek("GET konfigurasi bayar tidak memuat server key", !JSON.stringify(konfig.data).includes(SERVER_KEY), "");
  cek("GET konfigurasi bayar memuat client key (publik, wajar)", typeof konfig.data.clientKey === "string", "");
}

async function fase5() {
  console.log("== FASE 5: pembatas laju per pengguna & jalur refund otomatis ==");
  // 2) Laju pembuatan order PER PENGGUNA: IP diputar-putar, pengguna sama
  const hasilOrder: number[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const r = await buatOrder("UJI-GRATIS", undefined, { "cf-connecting-ip": `198.51.100.${i}` });
    hasilOrder.push(r.status);
  }
  cek("Order ke-1..5 (IP berganti) lolos", hasilOrder.slice(0, 5).every((s) => s === 200), hasilOrder.join(","));
  cek("Order ke-6 per PENGGUNA dibatasi (429) walau IP baru", hasilOrder[5] === 429, hasilOrder.join(","));

  // 5) Insiden per pengguna: IP diputar-putar, pengguna sama → tetap dibatasi
  const hasilInsiden: number[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const r = await panggil("POST", "/api/bayar/insiden", {
      uji: "UJI-GRATIS",
      headers: { "cf-connecting-ip": `203.0.113.${i}` },
      badan: { pesan: `Laporan uji serangan nomor ${i}: fitur tidak bisa dibuka sama sekali.`, konteks: "uji-serangan" },
    });
    hasilInsiden.push(r.status);
  }
  cek("Insiden ke-1..5 tercatat", hasilInsiden.slice(0, 5).every((s) => s === 200), hasilInsiden.join(","));
  cek("Insiden ke-6 per PENGGUNA dibatasi (429) walau IP baru", hasilInsiden[5] === 429, hasilInsiden.join(","));
  await jeda(200);
  const db = await bacaDB();
  const insidenGratis = Object.values(db.insiden ?? {}).filter((x) => x.userId === "uji-gratis");
  cek("Insiden terikat identitas pelapor di store", insidenGratis.length >= 5, `jumlah=${insidenGratis.length}`);

  // 5) Tidak ada endpoint refund/aktivasi yang bisa dipanggil klien
  for (const jalur of ["/api/bayar/refund", "/api/bayar/aktifkan", "/api/bayar/konfirmasi"]) {
    const r = await panggil("POST", jalur, { uji: "UJI-GRATIS", badan: {} });
    cek(`Endpoint ${jalur} TIDAK ADA (404)`, r.status === 404, `HTTP ${r.status}`);
  }
}

async function main() {
  if (!SERVER_KEY) throw new Error("MIDTRANS_SERVER_KEY (uji) wajib diisi");
  if (FASE === "1a") await fase1a();
  else if (FASE === "1b") await fase1b();
  else if (FASE === "1c") await fase1c();
  else if (FASE === "2") await fase2();
  else if (FASE === "3") await fase3();
  else if (FASE === "4") await fase4();
  else if (FASE === "5") await fase5();
  else throw new Error(`FASE tidak dikenal: ${FASE}`);
  console.log(`\nHASIL FASE ${FASE}: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

void main();
