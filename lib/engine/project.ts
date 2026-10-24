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

function bacaSemua(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as Project[]) : [];
  } catch {
    return [];
  }
}

function tulisSemua(list: Project[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
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
