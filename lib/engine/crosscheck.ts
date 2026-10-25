/**
 * Cross-check integritas sitasi (Urutan 4) — on-demand, deterministik, lokal.
 * Jalur utama: marker [[ref:id]] (akurat — id dikenal / tidak dikenal).
 * Jalur warisan: footnote markdown [^n] diperiksa konsistensinya (definisi
 * tanpa pemakaian & sebaliknya) dan DILABELI heuristik — bukan vonis.
 * Ini memeriksa KEBERADAAN penanda, bukan kesesuaian makna klaim dengan
 * referensinya. Jangan pernah menyebutnya validasi isi.
 */
import { cariMarker } from "@/lib/engine/marker";
import type { Project } from "@/lib/engine/project";

export interface TemuanSitasi {
  tingkat: "kritis" | "saran" | "info";
  jalur: "marker" | "warisan";
  bagian: string;
  pesan: string;
  /** Kunci stabil untuk daftar abaikan (id sumber / nomor footnote). */
  kunciAbaikan?: string;
}

export interface LaporanSitasi {
  temuan: TemuanSitasi[];
  markerTotal: number;
  markerSehat: number;
  sumberTakDisitir: string[];
}

const POLA_DEF = /^\[\^([^\]\s]+)\]:/gm;
const POLA_PAKAI = /\[\^([^\]\s]+)\](?!:)/g;

export function periksaSitasi(p: Project): LaporanSitasi {
  const temuan: TemuanSitasi[] = [];
  const abaikan = new Set(p.abaikanSitasi ?? []);
  const idSumber = new Set(p.sumber.map((s) => s.id));
  const disitir = new Set<string>();
  let markerTotal = 0;
  let markerSehat = 0;

  for (const [bagian, teks] of Object.entries(p.draf)) {
    if (!teks?.trim()) continue;

    // Jalur marker — deterministik.
    for (const m of cariMarker(teks)) {
      markerTotal++;
      if (idSumber.has(m.id)) {
        markerSehat++;
        disitir.add(m.id);
      } else if (!abaikan.has(m.id)) {
        temuan.push({
          tingkat: "kritis",
          jalur: "marker",
          bagian,
          pesan: `Penanda [[ref:${m.id}]] tidak menunjuk rujukan mana pun di proyek ini (mungkin rujukannya terhapus).`,
          kunciAbaikan: m.id,
        });
      }
    }

    // Jalur warisan — footnote [^n] manual, dilabeli heuristik.
    const defs = new Set([...teks.matchAll(POLA_DEF)].map((x) => x[1]));
    const pakai = new Set([...teks.matchAll(POLA_PAKAI)].map((x) => x[1]));
    for (const n of pakai) {
      if (!defs.has(n) && !abaikan.has(`fn:${n}`)) {
        temuan.push({
          tingkat: "saran",
          jalur: "warisan",
          bagian,
          pesan: `Kemungkinan sitasi tanpa penanda terkelola: footnote [^${n}] dipakai tetapi definisinya tidak ditemukan di bagian ini — periksa manual.`,
          kunciAbaikan: `fn:${n}`,
        });
      }
    }
    for (const n of defs) {
      if (!pakai.has(n)) {
        temuan.push({
          tingkat: "info",
          jalur: "warisan",
          bagian,
          pesan: `Definisi footnote [^${n}] tidak dipakai di teks bagian ini.`,
          kunciAbaikan: `fn:${n}`,
        });
      }
    }
  }

  const sumberTakDisitir = p.sumber.filter((s) => !disitir.has(s.id)).map((s) => s.judul || s.id);
  return { temuan, markerTotal, markerSehat, sumberTakDisitir };
}
