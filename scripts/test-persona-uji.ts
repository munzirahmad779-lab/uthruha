/**
 * Uji penerimaan jalur persona uji (perintah pemilik, 5 Nov 2026).
 *
 * Skrip ini menyalakan server pengembangan SENDIRI pada port bebas
 * dengan berkas data temp sendiri, lalu memeriksa:
 *  a. Halaman /masuk-persona: tanpa k → 404; k salah → 404; k benar →
 *     200 dan memuat teks langkah masuk Google.
 *  b. POST /api/persona: kunci salah → 404; kunci benar + email acak →
 *     200 dan Set-Cookie memuat uthruha_user + uthruha_akses.
 *  c. GET /api/auth/status dengan cookie hasil (b): tier premium,
 *     nama "Persona Uji", email tetap persona (bukan email formulir).
 *  d. POST kedua dengan email acak lain: tetap persona yang sama
 *     (id pengguna tidak berubah, persona tunggal).
 *  e. Saklar mati: server dinyalakan ulang TANPA UTH_PERSONA_AKTIF;
 *     halaman dan POST dengan kunci yang tadinya benar → 404.
 *
 * Jalankan: npx tsx scripts/test-persona-uji.ts
 * Keluar dengan kode non-nol bila ada butir GAGAL.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

let lulus = 0;
let gagal = 0;
function cek(nama: string, ok: boolean, rincian = "") {
  console.log(`${ok ? "PASS" : "GAGAL"} ${nama}${rincian ? " :: " + rincian : ""}`);
  if (ok) lulus += 1;
  else gagal += 1;
}

const KUNCI_AKSES_UJI = "kunci-akses-uji-persona-0123456789";
const KUNCI_PERSONA_UJI = "kunci-persona-uji-0123456789abcdef";
const KUNCI_SALAH = "kunci-yang-pasti-salah-999999";

/** Cari port bebas dari sistem operasi agar uji tidak menabrak server lain. */
function portBebas(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const alamat = srv.address();
      const port = typeof alamat === "object" && alamat ? alamat.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ServerUji {
  anak: ChildProcess;
  keluaran: string;
}

/** Nyalakan `npx next dev` dengan env uji; envPersona=false untuk uji saklar mati. */
function nyalakanServer(port: number, berkasData: string, envPersona: boolean): ServerUji {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    UTH_DATA_FILE: berkasData,
    UTH_SESI_SECRET: "rahasia-sesi-uji-persona-0123456789",
    UTH_ACCESS_KEY: KUNCI_AKSES_UJI,
    UTH_PERSONA_KUNCI: KUNCI_PERSONA_UJI,
    UTH_COOKIE_SECURE: "0",
  };
  if (envPersona) env.UTH_PERSONA_AKTIF = "1";
  else delete env.UTH_PERSONA_AKTIF;

  const anak = spawn("npx", ["next", "dev", "-p", String(port)], {
    cwd: process.cwd(),
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const server: ServerUji = { anak, keluaran: "" };
  const tangkap = (d: Buffer) => {
    server.keluaran = (server.keluaran + d.toString()).slice(-8000);
  };
  anak.stdout?.on("data", tangkap);
  anak.stderr?.on("data", tangkap);
  return server;
}

/** Tunggu sampai server menjawab permintaan apa pun (kompilasi awal dev bisa lama). */
async function tungguSiap(base: string, server: ServerUji, batasMs = 240_000): Promise<boolean> {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    if (server.anak.exitCode !== null) return false;
    try {
      await fetch(`${base}/masuk-persona`, { signal: AbortSignal.timeout(10_000) });
      return true;
    } catch {
      await tidur(1000);
    }
  }
  return false;
}

/** Matikan server beserta seluruh kelompok prosesnya, lalu tunggu benar-benar mati. */
async function matikanServer(server: ServerUji): Promise<void> {
  const { anak } = server;
  if (anak.exitCode !== null || !anak.pid) return;
  const mati = new Promise<void>((resolve) => anak.once("exit", () => resolve()));
  try {
    process.kill(-anak.pid, "SIGTERM");
  } catch {
    anak.kill("SIGTERM");
  }
  const selesai = await Promise.race([mati.then(() => true), tidur(10_000).then(() => false)]);
  if (!selesai && anak.exitCode === null) {
    try {
      process.kill(-anak.pid!, "SIGKILL");
    } catch {
      anak.kill("SIGKILL");
    }
    await Promise.race([mati, tidur(5000)]);
  }
}

/** Ambil pasangan nama=nilai dari Set-Cookie untuk diteruskan sebagai header Cookie. */
function headerCookieDari(res: Response): string {
  const mentah =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return mentah.map((c) => c.split(";")[0]!.trim()).filter(Boolean).join("; ");
}

async function postPersona(
  base: string,
  kunci: string,
  email: string,
): Promise<{ status: number; cookie: string; setCookieMentah: string }> {
  const res = await fetch(`${base}/api/persona`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kunci, email }),
    signal: AbortSignal.timeout(30_000),
  });
  const setCookieMentah =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie().join("\n") : "";
  return { status: res.status, cookie: headerCookieDari(res), setCookieMentah };
}

async function statusDenganCookie(
  base: string,
  cookie: string,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${base}/api/auth/status`, {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

async function main() {
  const folderTemp = mkdtempSync(path.join(tmpdir(), "uji-persona-"));
  const berkasData = path.join(folderTemp, "db.json");
  const port = await portBebas();
  const base = `http://127.0.0.1:${port}`;
  console.log(`Server uji persona di ${base} (data: ${berkasData})`);

  let server = nyalakanServer(port, berkasData, true);
  try {
    const siap = await tungguSiap(base, server);
    cek("server uji menyala", siap, siap ? "" : server.keluaran.slice(-500));
    if (!siap) return;

    /* ---------- a. Halaman masuk persona ---------- */
    const tanpaK = await fetch(`${base}/masuk-persona`, { signal: AbortSignal.timeout(30_000) });
    cek("a1 GET /masuk-persona tanpa k adalah 404", tanpaK.status === 404, `HTTP ${tanpaK.status}`);

    const kSalah = await fetch(`${base}/masuk-persona?k=${encodeURIComponent(KUNCI_SALAH)}`, {
      signal: AbortSignal.timeout(30_000),
    });
    cek("a2 GET /masuk-persona dengan k salah adalah 404", kSalah.status === 404, `HTTP ${kSalah.status}`);

    const kBenar = await fetch(`${base}/masuk-persona?k=${encodeURIComponent(KUNCI_PERSONA_UJI)}`, {
      signal: AbortSignal.timeout(30_000),
    });
    const teksHalaman = await kBenar.text();
    cek("a3 GET /masuk-persona dengan k benar adalah 200", kBenar.status === 200, `HTTP ${kBenar.status}`);
    cek(
      "a4 halaman k benar memuat teks langkah masuk Google",
      teksHalaman.includes("Gunakan Akun Google Anda"),
    );

    /* ---------- b. POST /api/persona ---------- */
    const postSalah = await postPersona(base, KUNCI_SALAH, "acak123@contoh.id");
    cek("b1 POST /api/persona kunci salah adalah 404", postSalah.status === 404, `HTTP ${postSalah.status}`);

    const postBenar = await postPersona(base, KUNCI_PERSONA_UJI, "acak123@contoh.id");
    cek("b2 POST /api/persona kunci benar + email acak adalah 200", postBenar.status === 200, `HTTP ${postBenar.status}`);
    cek(
      "b3 Set-Cookie memuat uthruha_user dan uthruha_akses",
      postBenar.setCookieMentah.includes("uthruha_user=") &&
        postBenar.setCookieMentah.includes("uthruha_akses="),
    );

    /* ---------- c. Status identitas dari cookie hasil ---------- */
    const st = await statusDenganCookie(base, postBenar.cookie);
    const pengguna = (st.data.pengguna ?? {}) as { id?: string; nama?: string; email?: string };
    cek("c1 status menjawab 200", st.status === 200, `HTTP ${st.status}`);
    cek("c2 tier persona adalah premium", st.data.tier === "premium", `tier=${String(st.data.tier)}`);
    cek("c3 nama pengguna adalah Persona Uji", pengguna.nama === "Persona Uji", String(pengguna.nama ?? ""));
    cek(
      "c4 email pengguna adalah email tetap persona, bukan email formulir",
      pengguna.email === "persona@uji.kitabah.local",
      String(pengguna.email ?? ""),
    );

    /* ---------- d. Persona tunggal untuk email acak lain ---------- */
    const postKedua = await postPersona(base, KUNCI_PERSONA_UJI, "lainnya987@acak.example");
    cek("d1 POST kedua dengan email acak lain adalah 200", postKedua.status === 200, `HTTP ${postKedua.status}`);
    const st2 = await statusDenganCookie(base, postKedua.cookie);
    const pengguna2 = (st2.data.pengguna ?? {}) as { id?: string };
    cek(
      "d2 id pengguna POST kedua sama dengan yang pertama (persona tunggal)",
      Boolean(pengguna.id) && pengguna2.id === pengguna.id,
      `${String(pengguna.id ?? "")} vs ${String(pengguna2.id ?? "")}`,
    );

    /* ---------- e. Saklar mati: tanpa UTH_PERSONA_AKTIF ---------- */
    await matikanServer(server);
    server = nyalakanServer(port, berkasData, false);
    const siap2 = await tungguSiap(base, server);
    cek("e0 server tanpa persona menyala", siap2, siap2 ? "" : server.keluaran.slice(-500));
    if (siap2) {
      const halamanMati = await fetch(`${base}/masuk-persona?k=${encodeURIComponent(KUNCI_PERSONA_UJI)}`, {
        signal: AbortSignal.timeout(30_000),
      });
      cek(
        "e1 tanpa UTH_PERSONA_AKTIF, halaman dengan k benar adalah 404",
        halamanMati.status === 404,
        `HTTP ${halamanMati.status}`,
      );
      const postMati = await postPersona(base, KUNCI_PERSONA_UJI, "acak123@contoh.id");
      cek(
        "e2 tanpa UTH_PERSONA_AKTIF, POST dengan kunci benar adalah 404",
        postMati.status === 404,
        `HTTP ${postMati.status}`,
      );
    }
  } finally {
    await matikanServer(server);
    rmSync(folderTemp, { recursive: true, force: true });
  }
}

main()
  .then(() => {
    console.log(`\nHASIL: ${lulus} PASS, ${gagal} GAGAL`);
    process.exit(gagal > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    console.log(`\nHASIL: ${lulus} PASS, ${gagal + 1} GAGAL`);
    process.exit(1);
  });
