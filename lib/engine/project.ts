import type { Metode, KaryaType } from "@/lib/content/types";
import { Sumber } from "@/lib/engine/cite";
import type { PedomanRules } from "@/lib/refs/pedoman";

export interface Istilah {
  id: string;
  /** Istilah Indonesia/Latin. */
  id_label: string;
  /** Padanan Arab yang dipakai konsisten di seluruh naskah. */
  ar: string;
  catatan?: string;
}

export interface Project {
  id: string;
  dibuat: string;
  diperbarui: string;
  jenis: KaryaType;
  metode: Metode;
  bidangId: string;
  /** Bahasa naskah yang dituju. */
  bahasa: "ar" | "id" | "en";
  judulAr: string;
  topikAr: string;
  lokasi: string;
  populasi: string;
  fenomenaAr: string;
  /** Rumusan masalah (Arab). */
  rumusan: string[];
  /** Tujuan penelitian (Arab). */
  tujuan: string[];
  istilah: Istilah[];
  /** Jawaban pemicu per section id. */
  jawaban: Record<string, string>;
  /** Draf per section id (markdown). */
  draf: Record<string, string>;
  sumber: Sumber[];
  catatan: string;
  /** Aturan pedoman kampus yang diunggah pengguna (null = belum ada). */
  pedoman?: PedomanRules | null;
}

const KEY = "uthruha:projects:v1";
const KEY_CADANGAN = "uthruha:projects:cadangan";
export const VERSI_SKEMA_SAAT_INI = 2;

/** Dilempar saat localStorage penuh — UI wajib menampilkannya, jangan ditelan. */
export class SimpanPenuhError extends Error {
  constructor() {
    super("Penyimpanan peramban penuh. Ekspor proyek atau sinkronkan ke Google Drive, lalu coba lagi.");
    this.name = "SimpanPenuhError";
  }
}

/** Estimasi byte UTF-8 satu proyek (akurat untuk teks Arab, bukan panjang string). */
export function ukurProyek(p: Project): number {
  return new Blob([JSON.stringify(p)]).size;
}

/** Estimasi total byte semua kunci uthruha:* di localStorage. */
export function ukurPenyimpanan(): { terpakai: number; kuotaPerkiraan: number; persen: number } {
  let terpakai = 0;
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("uthruha:")) {
        const v = window.localStorage.getItem(k) ?? "";
        terpakai += new Blob([k + v]).size;
      }
    }
  }
  const kuotaPerkiraan = 5 * 1024 * 1024; // batas umum per origin ±5MB
  return { terpakai, kuotaPerkiraan, persen: Math.min(100, Math.round((terpakai / kuotaPerkiraan) * 100)) };
}

export function newProject(init: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return {
    id: `p-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`,
    dibuat: now,
    diperbarui: now,
    jenis: "skripsi",
    metode: "kualitatif",
    bidangId: "quran",
    bahasa: "ar",
    judulAr: "",
    topikAr: "",
    lokasi: "",
    populasi: "",
    fenomenaAr: "",
    rumusan: [],
    tujuan: [],
    istilah: [],
    jawaban: {},
    draf: {},
    sumber: [],
    catatan: "",
    ...init,
  };
}

function bacaMentah(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function bacaSemua(): Project[] {
  const raw = bacaMentah();
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as Project[]) : [];
  } catch {
    // JANGAN kembalikan daftar kosong begitu saja: JSON rusak sekali bisa
    // berarti seluruh proyek user. Amankan salinan mentahnya agar bisa
    // dipulihkan, lalu laporkan lewat flag agar UI memberi tahu user.
    try {
      window.localStorage.setItem(`uthruha:projects:rusak:${Date.now()}`, raw);
      window.localStorage.setItem("uthruha:projects:ada-yang-rusak", "1");
    } catch {
      /* penyimpanan benar-benar tidak bisa ditulis — UI akan gagal simpan dengan pesan */
    }
    return [];
  }
}

function tulisSemua(list: Project[]) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(list);
  try {
    // Cadangan bergilir: salinan daftar SEBELUM penimpaan ini, disimpan hanya
    // bila ukurannya masuk akal agar tidak mempercepat penuh (maks ±40% kuota).
    const lama = bacaMentah();
    if (lama && new Blob([lama]).size < 2 * 1024 * 1024) {
      try {
        window.localStorage.setItem(KEY_CADANGAN, lama);
      } catch {
        /* cadangan boleh gagal; penulisan utama tetap dicoba */
      }
    }
    window.localStorage.setItem(KEY, json);
  } catch (e) {
    // Kembalikan data lama bila penimpaan gagal di tengah, lalu lempar error
    // yang bisa dijelaskan UI. Kegagalan simpan tidak boleh senyap.
    try {
      const lama = window.localStorage.getItem(KEY_CADANGAN);
      if (lama) window.localStorage.setItem(KEY, lama);
    } catch {
      /* abaikan */
    }
    throw new SimpanPenuhError();
  }
}

export function daftarProyek(): Project[] {
  return bacaSemua().sort((a, b) => (a.diperbarui < b.diperbarui ? 1 : -1));
}

export function ambilProyek(id: string): Project | null {
  return bacaSemua().find((p) => p.id === id) ?? null;
}

export function simpanProyek(p: Project): Project {
  const list = bacaSemua();
  const next = { ...p, diperbarui: new Date().toISOString() };
  const i = list.findIndex((x) => x.id === p.id);
  if (i >= 0) list[i] = next;
  else list.unshift(next);
  tulisSemua(list);
  return next;
}

export function hapusProyek(id: string) {
  tulisSemua(bacaSemua().filter((p) => p.id !== id));
}

export function duplikatProyek(id: string): Project | null {
  const asal = ambilProyek(id);
  if (!asal) return null;
  const salinan = newProject({
    ...asal,
    id: undefined,
    judulAr: asal.judulAr ? `${asal.judulAr} (نسخة)` : "",
  });
  return simpanProyek(salinan);
}

export function progresProyek(p: Project, totalSection: number): number {
  const terisi = Object.values(p.draf).filter((d) => d.trim().length > 80).length;
  if (!totalSection) return 0;
  return Math.min(100, Math.round((terisi / totalSection) * 100));
}

export function kataProyek(p: Project): number {
  return Object.values(p.draf)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}
