/**
 * Penyimpanan server Uthruha (Fase 3).
 *
 * Dua backend, dipilih dari environment:
 *  1. Supabase REST — bila SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY terisi.
 *     Memakai satu tabel KV generik `uthruha_kv (koleksi, id, data)` lewat
 *     PostgREST. SQL pembuatan tabel ada di docs/FASE3-SUPABASE.sql.
 *  2. Berkas JSON lokal — bawaan untuk pengembangan & pengujian
 *     (UTH_DATA_FILE atau .data/db.json; jatuh ke /tmp bila folder kerja
 *     tidak bisa ditulis, seperti di Vercel — di sana backend ini TIDAK
 *     persisten antar-instance, jadi produksi wajib memakai backend 1).
 *
 * Koleksi: pengguna, proyek, pembayaran, insiden, kolam, tembolok,
 * sesiUji, perangkat.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { modeUjiAktif } from "./mode-uji";

export type Koleksi =
  | "pengguna"
  | "proyek"
  | "pembayaran"
  | "insiden"
  | "kolam"
  | "tembolok"
  | "sesiUji"
  | "perangkat";

export type Rekam = Record<string, unknown> & { id: string };

interface DB {
  [koleksi: string]: Record<string, Rekam>;
}

let cache: DB | null = null;
let jalurBerkas = "";

function supabaseSiap(): boolean {
  // Mode uji (cabang uji-persona): paksa backend berkas lokal agar
  // lingkungan staging TIDAK pernah membaca/menulis basis data produksi,
  // walau env Supabase ikut terbawa ke deployment preview.
  if (modeUjiAktif()) return false;
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function jalurData(): string {
  if (jalurBerkas) return jalurBerkas;
  jalurBerkas = process.env.UTH_DATA_FILE?.trim()
    ? path.resolve(process.env.UTH_DATA_FILE.trim())
    : path.join(process.cwd(), ".data", "db.json");
  return jalurBerkas;
}

async function muatBerkas(): Promise<DB> {
  if (cache) return cache;
  try {
    const teks = await fs.readFile(jalurData(), "utf8");
    cache = JSON.parse(teks) as DB;
  } catch {
    cache = {};
  }
  return cache;
}

async function simpanBerkas(): Promise<void> {
  const db = await muatBerkas();
  const teks = JSON.stringify(db, null, 1);
  const tujuan = jalurData();
  try {
    await fs.mkdir(path.dirname(tujuan), { recursive: true });
    const tmp = `${tujuan}.tmp`;
    await fs.writeFile(tmp, teks, "utf8");
    await fs.rename(tmp, tujuan);
  } catch {
    // Lingkungan baca-saja (mis. Vercel tanpa Supabase): tulis ke /tmp.
    const tmpPath = "/tmp/uthruha-db.json";
    if (tujuan !== tmpPath) {
      jalurBerkas = tmpPath;
      await fs.writeFile(tmpPath, teks, "utf8");
    }
  }
}

async function sbFetch(pathname: string, init: RequestInit): Promise<Response> {
  const base = process.env.SUPABASE_URL!.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  return fetch(`${base}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function ambil(koleksi: Koleksi, id: string): Promise<Rekam | null> {
  if (supabaseSiap()) {
    const res = await sbFetch(
      `uthruha_kv?koleksi=eq.${encodeURIComponent(koleksi)}&id=eq.${encodeURIComponent(id)}&select=data`,
      { method: "GET" },
    );
    if (!res.ok) return null;
    const baris = (await res.json()) as { data: Rekam }[];
    return baris[0]?.data ?? null;
  }
  const db = await muatBerkas();
  return db[koleksi]?.[id] ?? null;
}

export async function semua(koleksi: Koleksi): Promise<Rekam[]> {
  if (supabaseSiap()) {
    const res = await sbFetch(
      `uthruha_kv?koleksi=eq.${encodeURIComponent(koleksi)}&select=data`,
      { method: "GET" },
    );
    if (!res.ok) return [];
    const baris = (await res.json()) as { data: Rekam }[];
    return baris.map((b) => b.data);
  }
  const db = await muatBerkas();
  return Object.values(db[koleksi] ?? {});
}

export async function simpan(koleksi: Koleksi, rec: Rekam): Promise<Rekam> {
  if (supabaseSiap()) {
    await sbFetch("uthruha_kv?on_conflict=koleksi,id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ koleksi, id: rec.id, data: rec, diperbarui: new Date().toISOString() }),
    });
    return rec;
  }
  const db = await muatBerkas();
  (db[koleksi] ??= {})[rec.id] = rec;
  await simpanBerkas();
  return rec;
}

export async function perbarui(
  koleksi: Koleksi,
  id: string,
  patch: Record<string, unknown>,
): Promise<Rekam | null> {
  const lama = await ambil(koleksi, id);
  if (!lama) return null;
  return simpan(koleksi, { ...lama, ...patch, id });
}

/** ID acak yang tidak bisa ditebak urutannya. */
export function idAcak(prefix = ""): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  const hex = Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${prefix}${hex}`;
}
