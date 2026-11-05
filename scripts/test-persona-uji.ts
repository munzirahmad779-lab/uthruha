/**
 * Uji penerimaan fitur masuk akun uji berbasis email (perintah
 * pemilik, 6 Nov 2026; menulis ulang uji jalur persona tunggal
 * 5 Nov 2026 yang semantiknya pensiun).
 *
 * Skrip ini menyalakan server pengembangan SENDIRI pada port bebas
 * dengan berkas data temp sendiri, lalu memeriksa:
 *  n. Fungsi nama murni: kesepuluh email menghasilkan nama tampilan
 *     yang ditetapkan pemilik.
 *  a. Jalur menyala: GET /masuk memuat formulir email akun uji
 *     (id="masuk-uji"); halaman lama /masuk-persona menjawab 404.
 *  b. Email di luar daftar putih: 403 dengan pesan umum persis,
 *     tanpa cookie identitas apa pun.
 *  c. Kesepuluh email daftar putih: POST 200 + cookie sesi dan
 *     cookie gerbang; /api/auth/status menampilkan tier terkunci,
 *     nama turunan, judulProyekUji, dan bidangProyekUji yang benar.
 *  d. Identitas per akun: dua email berbeda menghasilkan dua id
 *     berbeda; email yang sama dua kali menghasilkan id yang sama;
 *     cookie gerbang lapis gratis berbeda dari lapis premium.
 *  f. Penonaktifan: catatan akun disunting nonaktif di berkas data
 *     (server dinyalakan ulang agar cache store terbaca segar);
 *     login email itu ditolak dengan pesan umum yang sama dan sesi
 *     lamanya mati, sementara akun uji lain tetap bisa masuk.
 *  g. Saklar mati: server tanpa UTH_PERSONA_AKTIF; formulir tidak
 *     ada di /masuk, POST email daftar putih menjawab 404, dan
 *     /masuk-persona tetap 404.
 *
 * Server uji SENGAJA dinyalakan tanpa UTH_PERSONA_KUNCI: syarat kunci
 * bersama jalur lama sudah gugur dan tidak boleh dibutuhkan lagi.
 *
 * Jalankan: npx tsx scripts/test-persona-uji.ts
 * Keluar dengan kode non-nol bila ada butir GAGAL.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { AKUN_UJI, idAkunUji, namaDariEmail } from "../lib/server/persona";

let lulus = 0;
let gagal = 0;
function cek(nama: string, ok: boolean, rincian = "") {
  console.log(`${ok ? "PASS" : "GAGAL"} ${nama}${rincian ? " :: " + rincian : ""}`);
  if (ok) lulus += 1;
  else gagal += 1;
}

const KUNCI_AKSES_UJI = "kunci-akses-uji-persona-0123456789";
const KUNCI_GRATIS_UJI = "kunci-gratis-uji-persona-0123456789";
const PESAN_TOLAK = "Email tidak terdaftar untuk akses uji coba.";

/** Nama tampilan wajib per email (ketetapan pemilik, 6 Nov 2026). */
const NAMA_WAJIB: Record<string, string> = {
  "rahmawati.salsabila92@uji.kitabah.web.id": "Rahmawati Salsabila",
  "fajar.pratama171@uji.kitabah.web.id": "Fajar Pratama",
  "nur.hikmah034@uji.kitabah.web.id": "Nur Hikmah",
  "dandi.setiawan58@uji.kitabah.web.id": "Dandi Setiawan",
  "siti.maryam207@uji.kitabah.web.id": "Siti Maryam",
  "andi.basri64@uji.kitabah.web.id": "Andi Basri",
  "yusra.amilia19@uji.kitabah.web.id": "Yusra Amilia",
  "muh.ridwan883@uji.kitabah.web.id": "Muh Ridwan",
  "fitriani.zahra42@uji.kitabah.web.id": "Fitriani Zahra",
  "ikhlasul.amal76@uji.kitabah.web.id": "Ikhlasul Amal",
};

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

/** Nyalakan `npx next dev` dengan env uji; aktif=false untuk uji saklar mati. */
function nyalakanServer(port: number, berkasData: string, aktif: boolean): ServerUji {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    UTH_DATA_FILE: berkasData,
    UTH_SESI_SECRET: "rahasia-sesi-uji-persona-0123456789",
    UTH_ACCESS_KEY: KUNCI_AKSES_UJI,
    UTH_KUNCI_GRATIS: KUNCI_GRATIS_UJI,
    UTH_COOKIE_SECURE: "0",
  };
  // UTH_PERSONA_KUNCI sengaja TIDAK diisi: syarat itu sudah gugur.
  delete env.UTH_PERSONA_KUNCI;
  if (aktif) env.UTH_PERSONA_AKTIF = "1";
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
      await fetch(`${base}/masuk`, { signal: AbortSignal.timeout(10_000) });
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

/** Nilai satu cookie dari Set-Cookie mentah (untuk membandingkan cookie gerbang per lapis). */
function nilaiCookie(setCookieMentah: string, nama: string): string {
  const baris = setCookieMentah.split("\n").find((c) => c.startsWith(`${nama}=`));
  return baris ? baris.slice(nama.length + 1).split(";")[0]! : "";
}

interface HasilPost {
  status: number;
  cookie: string;
  setCookieMentah: string;
  data: Record<string, unknown>;
}

async function postEmail(base: string, email: string): Promise<HasilPost> {
  const res = await fetch(`${base}/api/persona`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(30_000),
  });
  const setCookieMentah =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie().join("\n") : "";
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, cookie: headerCookieDari(res), setCookieMentah, data };
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
  /* ---------- n. Fungsi nama murni ---------- */
  cek("n0 tabel daftar putih memuat tepat 10 akun", AKUN_UJI.length === 10, `${AKUN_UJI.length}`);
  AKUN_UJI.forEach((def, i) => {
    cek(
      `n${i + 1} nama dari ${def.email}`,
      namaDariEmail(def.email) === NAMA_WAJIB[def.email],
      namaDariEmail(def.email),
    );
  });

  const folderTemp = mkdtempSync(path.join(tmpdir(), "uji-persona-"));
  const berkasData = path.join(folderTemp, "db.json");
  const port = await portBebas();
  const base = `http://127.0.0.1:${port}`;
  console.log(`Server uji akun uji di ${base} (data: ${berkasData})`);

  const idPerEmail = new Map<string, string>();
  const cookiePerEmail = new Map<string, string>();
  const aksesPerEmail = new Map<string, string>();

  let server = nyalakanServer(port, berkasData, true);
  try {
    const siap = await tungguSiap(base, server);
    cek("s1 server uji (jalur menyala) menyala", siap, siap ? "" : server.keluaran.slice(-500));
    if (!siap) return;

    /* ---------- a. Halaman /masuk dan pensiunnya /masuk-persona ---------- */
    const masuk = await fetch(`${base}/masuk`, { signal: AbortSignal.timeout(30_000) });
    const teksMasuk = await masuk.text();
    cek("a1 GET /masuk menjawab 200", masuk.status === 200, `HTTP ${masuk.status}`);
    cek(
      "a2 /masuk memuat formulir email akun uji saat jalur menyala",
      teksMasuk.includes('id="masuk-uji"'),
    );
    const personaLama = await fetch(`${base}/masuk-persona`, {
      signal: AbortSignal.timeout(30_000),
    });
    cek(
      "a3 GET /masuk-persona menjawab 404 (halaman pensiun)",
      personaLama.status === 404,
      `HTTP ${personaLama.status}`,
    );

    /* ---------- b. Email di luar daftar putih ---------- */
    const luar = await postEmail(base, "orang.asing@contoh.id");
    cek("b1 POST email luar daftar adalah 403", luar.status === 403, `HTTP ${luar.status}`);
    cek(
      "b2 pesan penolakan persis pesan umum",
      luar.data.error === PESAN_TOLAK,
      String(luar.data.error ?? ""),
    );
    cek(
      "b3 penolakan tanpa cookie identitas maupun gerbang",
      !luar.setCookieMentah.includes("uthruha_user=") &&
        !luar.setCookieMentah.includes("uthruha_akses="),
    );

    /* ---------- c. Kesepuluh email daftar putih ---------- */
    for (let i = 0; i < AKUN_UJI.length; i += 1) {
      const def = AKUN_UJI[i]!;
      const no = i + 1;
      const post = await postEmail(base, def.email);
      cek(`c${no}a POST ${def.email} adalah 200`, post.status === 200, `HTTP ${post.status}`);
      cek(
        `c${no}b Set-Cookie memuat uthruha_user dan uthruha_akses`,
        post.setCookieMentah.includes("uthruha_user=") &&
          post.setCookieMentah.includes("uthruha_akses="),
      );
      cookiePerEmail.set(def.email, post.cookie);
      aksesPerEmail.set(def.email, nilaiCookie(post.setCookieMentah, "uthruha_akses"));
      const st = await statusDenganCookie(base, post.cookie);
      const pengguna = (st.data.pengguna ?? {}) as { id?: string; nama?: string; email?: string };
      if (pengguna.id) idPerEmail.set(def.email, pengguna.id);
      cek(
        `c${no}c status: tier ${def.tier}, nama turunan, proyek tetap benar`,
        st.data.tier === def.tier &&
          pengguna.email === def.email &&
          pengguna.nama === NAMA_WAJIB[def.email] &&
          pengguna.id === idAkunUji(def.email) &&
          st.data.judulProyekUji === def.judulProyek &&
          st.data.bidangProyekUji === def.bidangId,
        `tier=${String(st.data.tier)} nama=${String(pengguna.nama ?? "")} judul=${String(st.data.judulProyekUji ?? "")}`,
      );
    }

    /* ---------- d. Identitas per akun ---------- */
    const id1 = idPerEmail.get(AKUN_UJI[0]!.email);
    const id2 = idPerEmail.get(AKUN_UJI[1]!.email);
    cek(
      "d1 dua email berbeda menghasilkan dua id akun berbeda",
      Boolean(id1 && id2 && id1 !== id2),
      `${String(id1 ?? "")} vs ${String(id2 ?? "")}`,
    );
    const ulang = await postEmail(base, AKUN_UJI[0]!.email);
    const stUlang = await statusDenganCookie(base, ulang.cookie);
    const penggunaUlang = (stUlang.data.pengguna ?? {}) as { id?: string };
    cek(
      "d2 email yang sama dua kali menghasilkan id yang sama",
      penggunaUlang.id === id1,
      `${String(penggunaUlang.id ?? "")} vs ${String(id1 ?? "")}`,
    );
    cek(
      "d3 cookie gerbang lapis gratis berbeda dari lapis premium",
      Boolean(
        aksesPerEmail.get(AKUN_UJI[0]!.email) &&
          aksesPerEmail.get(AKUN_UJI[5]!.email) &&
          aksesPerEmail.get(AKUN_UJI[0]!.email) !== aksesPerEmail.get(AKUN_UJI[5]!.email),
      ),
    );

    /* ---------- f. Penonaktifan akun ---------- */
    // Sunting berkas data temp: akun premium pertama (andi.basri64)
    // dinonaktifkan seperti tombol Nonaktifkan di Super Admin.
    const db = JSON.parse(readFileSync(berkasData, "utf8")) as {
      pengguna?: Record<string, Record<string, unknown>>;
    };
    const idNonaktif = idAkunUji(AKUN_UJI[5]!.email);
    const catatan = db.pengguna?.[idNonaktif];
    cek("f0 catatan akun uji ada di store temp", Boolean(catatan), idNonaktif);
    if (catatan) catatan.nonaktif = true;
    writeFileSync(berkasData, JSON.stringify(db), "utf8");
    const cookieLamaNonaktif = cookiePerEmail.get(AKUN_UJI[5]!.email) ?? "";

    await matikanServer(server);
    server = nyalakanServer(port, berkasData, true);
    const siapF = await tungguSiap(base, server);
    cek("f1 server menyala ulang sesudah penyuntingan nonaktif", siapF);
    if (siapF) {
      const postNonaktif = await postEmail(base, AKUN_UJI[5]!.email);
      cek(
        "f2 login akun nonaktif ditolak 403 dengan pesan umum yang sama",
        postNonaktif.status === 403 && postNonaktif.data.error === PESAN_TOLAK,
        `HTTP ${postNonaktif.status}`,
      );
      const stMati = await statusDenganCookie(base, cookieLamaNonaktif);
      cek(
        "f3 sesi lama akun nonaktif mati (status tanpa pengguna)",
        stMati.data.pengguna === null,
        `pengguna=${String(stMati.data.pengguna ?? "null")}`,
      );
      const postLain = await postEmail(base, AKUN_UJI[0]!.email);
      cek(
        "f4 akun uji lain tetap bisa masuk",
        postLain.status === 200,
        `HTTP ${postLain.status}`,
      );
    }

    /* ---------- g. Saklar mati: tanpa UTH_PERSONA_AKTIF ---------- */
    await matikanServer(server);
    server = nyalakanServer(port, berkasData, false);
    const siapG = await tungguSiap(base, server);
    cek("g0 server tanpa jalur akun uji menyala", siapG);
    if (siapG) {
      const masukMati = await fetch(`${base}/masuk`, { signal: AbortSignal.timeout(30_000) });
      const teksMati = await masukMati.text();
      cek("g1 GET /masuk tetap 200 saat jalur mati", masukMati.status === 200, `HTTP ${masukMati.status}`);
      cek(
        "g2 formulir akun uji tidak ada di /masuk saat jalur mati",
        !teksMati.includes('id="masuk-uji"'),
      );
      const postMati = await postEmail(base, AKUN_UJI[0]!.email);
      cek(
        "g3 POST email daftar putih saat jalur mati adalah 404",
        postMati.status === 404,
        `HTTP ${postMati.status}`,
      );
      const personaMati = await fetch(`${base}/masuk-persona`, {
        signal: AbortSignal.timeout(30_000),
      });
      cek(
        "g4 GET /masuk-persona tetap 404 saat jalur mati",
        personaMati.status === 404,
        `HTTP ${personaMati.status}`,
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
