/**
 * Adapter Ketabonline.com.
 * Uji langsung: halaman beranda terbuka, tetapi route pencarian menutup
 * koneksi (aborted) — tidak ada API publik terdokumentasi.
 * Karena itu mode default `deeplink`; mode `api` hanya aktif bila
 * KETABONLINE_API_BASE diisi (endpoint resmi hasil konfirmasi penyedia).
 */
import type { RefCandidate } from "@/lib/refs/types";
import { ambilJson, type OpsiAdapter } from "@/lib/refs/adapters/http";
import { dariItemJson, larikItem } from "@/lib/refs/adapters/normalize";

const BASE = process.env.KETABONLINE_API_BASE?.trim();
const SITUS = "https://ketabonline.com";

export const info = {
  id: "ketabonline" as const,
  mode: (BASE ? "api" : "deeplink") as "api" | "deeplink",
  butuhKey: true,
  situs: SITUS,
};

export function tautanKetab(kalimat: string): string {
  return `${SITUS}/ar/search?q=${encodeURIComponent(kalimat.slice(0, 180))}`;
}

export async function cari(kalimat: string, opsi: OpsiAdapter = {}): Promise<RefCandidate[]> {
  if (!BASE) return [];
  const maks = opsi.maks ?? 5;
  const url = `${BASE.replace(/\/$/, "")}/search?q=${encodeURIComponent(kalimat.slice(0, 240))}`;
  const json = await ambilJson<unknown>(url, opsi);
  return larikItem(json)
    .map((item) => dariItemJson("ketabonline", item, kalimat, "api", tautanKetab(kalimat)))
    .filter((c): c is RefCandidate => Boolean(c) && c!.skor >= 0.12)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, maks);
}

export function deeplink(kalimat: string): RefCandidate {
  return {
    source: "ketabonline",
    kitab: "",
    teks_kutipan: kalimat,
    url_sumber: tautanKetab(kalimat),
    skor: 0,
    mode: "deeplink",
    perluVerifikasi: true,
    catatanVerifikasi:
      "Ketabonline tidak membuka API publik; tautan ini membuka pencarian di situsnya dan hasilnya belum bisa dipilih otomatis.",
  };
}
