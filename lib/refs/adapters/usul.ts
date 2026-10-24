/**
 * Adapter Usul.ai.
 * Uji langsung: halaman terbuka (HTML), status API belum dikonfirmasi
 * penyedia. Mode default `deeplink`; `api` hanya bila USUL_API_BASE diisi.
 * Catatan jujur: Usul.ai sendiri berbasis AI — Uthruha hanya menerima
 * hasil pencariannya sebagai teks, tidak memanggil model bahasa.
 */
import type { RefCandidate } from "@/lib/refs/types";
import { ambilJson, type OpsiAdapter } from "@/lib/refs/adapters/http";
import { dariItemJson, larikItem } from "@/lib/refs/adapters/normalize";

const BASE = process.env.USUL_API_BASE?.trim();
const SITUS = "https://usul.ai";

export const info = {
  id: "usul" as const,
  mode: (BASE ? "api" : "deeplink") as "api" | "deeplink",
  situs: SITUS,
};

export function tautanUsul(kalimat: string): string {
  return `${SITUS}/search?q=${encodeURIComponent(kalimat.slice(0, 180))}`;
}

export async function cari(kalimat: string, opsi: OpsiAdapter = {}): Promise<RefCandidate[]> {
  if (!BASE) return [];
  const maks = opsi.maks ?? 5;
  const url = `${BASE.replace(/\/$/, "")}/search?q=${encodeURIComponent(kalimat.slice(0, 240))}`;
  const json = await ambilJson<unknown>(url, opsi);
  return larikItem(json)
    .map((item) => dariItemJson("usul", item, kalimat, "api", tautanUsul(kalimat)))
    .filter((c): c is RefCandidate => Boolean(c) && c!.skor >= 0.12)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, maks);
}

export function deeplink(kalimat: string): RefCandidate {
  return {
    source: "usul",
    kitab: "",
    teks_kutipan: kalimat,
    url_sumber: tautanUsul(kalimat),
    skor: 0,
    mode: "deeplink",
    perluVerifikasi: true,
    catatanVerifikasi:
      "Akses API Usul.ai belum dikonfirmasi penyedia; tautan ini membuka pencarian konsep di situsnya.",
  };
}
