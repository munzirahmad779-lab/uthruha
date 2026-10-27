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
  /** Versi schema data. Data lama tanpa field ini = versi 1. Lihat migrasiProyek(). */
  versiSkema?: number;
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
  /** Gaya sitasi aktif proyek (Urutan 2): "turabian9" | "chicago17" | "apa7" | "arab-klasik". Default turabian9. */
  gayaSitasi?: string;
  /** Id sitasi warisan yang diabaikan cross-check (Urutan 4). */
  abaikanSitasi?: string[];
  /** Aturan pedoman kampus yang diunggah pengguna (null = belum ada). */
  pedoman?: PedomanRules | null;
  /**
   * Struktur pedoman tervalidasi skema (Fase 3): hasil ulikan pedoman via
   * AI luar yang lolos SkemaStrukturPedoman. daftarIsi adalah proyeksinya;
   * bidang ini menyimpan data sumbernya (bab → aturan) sebagai jejak audit.
   */
  strukturPedoman?: import("@/lib/pedoman/skema-struktur").StrukturPedoman | null;
  /**
   * Daftar isi milik proyek (pola Ma'had: bab mewakili isykaliyyat).
   * Bila terisi, daftar inilah struktur naskahnya — menggantikan struktur
   * bawaan jenis karya. Disusun dari rumusan masalah, lalu bebas diedit
   * mahasiswa (tambah/kurang/pindah sub-bab) di tab Struktur.
   */
  daftarIsi?: BabKustom[] | null;
  /**
   * Set kalimat kunci hasil KURASI mahasiswa per bab (kunci = id bab atau
   * "umum"): kolam kata kunci terpilih + tepat 3 kalimat kunci berperan.
   * Set inilah yang menjalankan pencarian rujukan — bukan ekstrak otomatis.
   */
  kunciPencarian?: Record<string, SetKunci>;
  /** Kotak temuan: rujukan hasil pencarian yang disimpan untuk dipasang kemudian. */
  temuan?: TemuanRujukan[];
}

/** Peran kalimat kunci mengikuti pola bab isykal: gambaran, dalil, analisis. */
export type PeranKalimat = "taswir" | "aqwal" | "tarjih";

/** Satu kalimat kunci hasil kurasi (generate AI atau tulis manual). */
export interface KalimatKunci {
  /** Kalimat kunci Arab (frasa utuh untuk pencarian kitab). */
  teks: string;
  /** Arti/padanan Bahasa Indonesia (untuk pencarian jurnal). */
  arti: string;
  /** Penjelasan kenapa kalimatnya disusun seperti itu. */
  alasan: string;
  peran: PeranKalimat;
  /** Dikunci mahasiswa: generate ulang tidak menimpa kalimat ini. */
  dikunci?: boolean;
}

/** Set kunci satu bab: kolam kata terpilih + kalimat kunci berperan. */
export interface SetKunci {
  /** Kolam kata kunci (Arab) hasil generate — bisa ditambah/dihapus mahasiswa. */
  kata: string[];
  /** Kata dari kolam yang dipilih untuk menyusun kalimat (kosong = semua). */
  kataDipakai: string[];
  kalimat: KalimatKunci[];
}

/** Rujukan temuan pencarian yang disimpan per bab untuk dipasang kemudian. */
export interface TemuanRujukan {
  id: string;
  /** Id bab (daftar isi) tempat temuan ini disimpan. */
  babId: string;
  sumber: Sumber;
  /** Kutipan teks sumber (untuk Ctrl+F & paragraf baru), bila ada. */
  kutipan: string;
  dibuat: string;
}

/** Saring set kunci dari data mentah. */
export function sanitasiKunciPencarian(mentah: unknown): Record<string, SetKunci> | undefined {
  if (typeof mentah !== "object" || mentah === null || Array.isArray(mentah)) return undefined;
  const hasil: Record<string, SetKunci> = {};
  for (const [k, v] of Object.entries(mentah as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const rec = v as Record<string, unknown>;
    const kata = Array.isArray(rec.kata) ? rec.kata.filter((x): x is string => typeof x === "string") : [];
    const kataDipakai = Array.isArray(rec.kataDipakai)
      ? rec.kataDipakai.filter((x): x is string => typeof x === "string")
      : [];
    const kalimat: KalimatKunci[] = [];
    if (Array.isArray(rec.kalimat)) {
      for (const item of rec.kalimat) {
        if (typeof item !== "object" || item === null) continue;
        const ik = item as Record<string, unknown>;
        if (typeof ik.teks !== "string" || !ik.teks.trim()) continue;
        kalimat.push({
          teks: ik.teks,
          arti: typeof ik.arti === "string" ? ik.arti : "",
          alasan: typeof ik.alasan === "string" ? ik.alasan : "",
          peran: ik.peran === "aqwal" || ik.peran === "tarjih" ? ik.peran : "taswir",
          ...(ik.dikunci === true ? { dikunci: true } : {}),
        });
      }
    }
    hasil[k] = { kata, kataDipakai, kalimat: kalimat.slice(0, 3) };
  }
  return Object.keys(hasil).length > 0 ? hasil : undefined;
}

/** Saring kotak temuan dari data mentah. */
export function sanitasiTemuan(mentah: unknown): TemuanRujukan[] | undefined {
  if (!Array.isArray(mentah)) return undefined;
  const hasil: TemuanRujukan[] = [];
  for (const item of mentah) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== "string" || typeof rec.babId !== "string") continue;
    if (typeof rec.sumber !== "object" || rec.sumber === null) continue;
    hasil.push({
      id: rec.id,
      babId: rec.babId,
      sumber: normalisasiSumber(rec.sumber as Sumber),
      kutipan: typeof rec.kutipan === "string" ? rec.kutipan : "",
      dibuat: typeof rec.dibuat === "string" ? rec.dibuat : "",
    });
  }
  return hasil.length > 0 ? hasil : undefined;
}

/** Satu sub-bab dalam daftar isi kustom proyek. */
export interface SubBabKustom {
  id: string;
  labelId: string;
  labelAr: string;
  /** Fasal/matlab (فصل/مطلب) di bawah sub-bab ini — tingkat ketiga daftar isi. */
  anak?: SubBabKustom[];
}

/** Satu bab dalam daftar isi kustom proyek. */
export interface BabKustom {
  id: string;
  labelId: string;
  labelAr: string;
  babAr: string;
  /** Nomor isykal (1-based) yang diwakili bab ini, bila ada. */
  isykalKe?: number;
  sections: SubBabKustom[];
}

/** Saring daftar isi dari data mentah: hanya bentuk yang sah yang lolos. */
export function sanitasiDaftarIsi(mentah: unknown): BabKustom[] | undefined {
  if (!Array.isArray(mentah)) return undefined;
  const bab: BabKustom[] = [];
  mentah.forEach((b, i) => {
    if (typeof b !== "object" || b === null) return;
    const rec = b as Record<string, unknown>;
    const sections: SubBabKustom[] = [];
    const bersihSub = (sr: Record<string, unknown>, j: number, dalam: boolean): SubBabKustom | null => {
      if (typeof sr.id !== "string" || !sr.id) return null;
      const anak: SubBabKustom[] = [];
      if (!dalam && Array.isArray(sr.anak)) {
        sr.anak.forEach((a, k) => {
          if (typeof a !== "object" || a === null) return;
          const sub = bersihSub(a as Record<string, unknown>, k, true);
          if (sub) anak.push(sub);
        });
      }
      return {
        id: sr.id,
        labelId: typeof sr.labelId === "string" ? sr.labelId : `Sub-bab ${j + 1}`,
        labelAr: typeof sr.labelAr === "string" ? sr.labelAr : "",
        ...(anak.length > 0 ? { anak } : {}),
      };
    };
    if (Array.isArray(rec.sections)) {
      rec.sections.forEach((s, j) => {
        if (typeof s !== "object" || s === null) return;
        const sub = bersihSub(s as Record<string, unknown>, j, false);
        if (sub) sections.push(sub);
      });
    }
    if (sections.length === 0) return;
    bab.push({
      id: typeof rec.id === "string" && rec.id ? rec.id : `bab-kustom-${i + 1}`,
      labelId: typeof rec.labelId === "string" ? rec.labelId : `BAB ${i + 1}`,
      labelAr: typeof rec.labelAr === "string" ? rec.labelAr : "",
      babAr: typeof rec.babAr === "string" ? rec.babAr : "",
      ...(typeof rec.isykalKe === "number" ? { isykalKe: rec.isykalKe } : {}),
      sections,
    });
  });
  return bab.length > 0 ? bab : undefined;
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
    versiSkema: VERSI_SKEMA_SAAT_INI,
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

/** Dilempar migrasiProyek bila data berasal dari versi aplikasi yang LEBIH BARU. */
export class VersiLebihBaruError extends Error {
  constructor(v: number) {
    super(`Data proyek memakai schema versi ${v} yang lebih baru dari aplikasi ini. Perbarui aplikasi sebelum membukanya agar tidak ada data yang hilang.`);
    this.name = "VersiLebihBaruError";
  }
}

/** Lengkapi satu Sumber lama ke schema v2 tanpa membuang field apa pun. */
export function normalisasiSumber(s: Sumber): Sumber {
  const out: Sumber = { ...s };
  if (!out.muhaqqiq && out.tahqiq) out.muhaqqiq = out.tahqiq;
  if (!out.sumberImpor) out.sumberImpor = "manual";
  return out;
}

function bentukGDriveLama(x: Record<string, unknown>): boolean {
  return typeof x === "object" && x !== null && "sections" in x && "references" in x && !("sumber" in x);
}

/**
 * Gerbang migrasi TUNGGAL (C.8): semua jalur muat — localStorage, GDrive,
 * impor file — wajib lewat sini. Menerima:
 * - Project versi 1 (tanpa versiSkema) → dilengkapi ke v2.
 * - Project v2 → dinormalisasi.
 * - Bentuk GDrive lama `ProyekTersimpan` (sections/references/ai_sessions)
 *   → dipetakan field-nya ke Project; field yang tidak dikenal dipertahankan
 *   di `catatan` sebagai JSON agar tidak ada data yang dibuang diam-diam.
 * - versiSkema > yang dikenal → VersiLebihBaruError (jangan dibuka setengah).
 */
export function migrasiProyek(mentah: unknown): Project {
  if (typeof mentah !== "object" || mentah === null) {
    throw new Error("Data proyek bukan objek yang dikenal.");
  }
  const x = mentah as Record<string, unknown>;
  const versi = typeof x.versiSkema === "number" ? x.versiSkema : 1;
  if (versi > VERSI_SKEMA_SAAT_INI) throw new VersiLebihBaruError(versi);

  if (bentukGDriveLama(x)) {
    const sections = (x.sections ?? {}) as Record<string, { markdown?: string }>;
    const draf: Record<string, string> = {};
    for (const [id, s] of Object.entries(sections)) draf[id] = s?.markdown ?? "";
    const references = Array.isArray(x.references) ? x.references : [];
    const sumber: Sumber[] = references.map((r, i) => {
      const rec = (r as { source?: Record<string, unknown> })?.source ?? {};
      return normalisasiSumber({
        id: String((r as { id?: string })?.id ?? `src-gdrive-${i}`),
        jenis: "kitab",
        penulis: String(rec.penulis ?? rec.author ?? ""),
        tahun: String(rec.tahun ?? rec.year ?? ""),
        judul: String(rec.judul ?? rec.title ?? ""),
        penerbit: rec.penerbit ? String(rec.penerbit) : undefined,
        kota: rec.kota ? String(rec.kota) : undefined,
        jilid: rec.jilid ? String(rec.jilid) : undefined,
        halaman: rec.halaman ? String(rec.halaman) : undefined,
        doi: rec.doi ? String(rec.doi) : undefined,
        url: rec.url ? String(rec.url) : undefined,
        sumberImpor: "gdrive-lama",
        perluVerifikasi: true,
      });
    });
    const sisa: Record<string, unknown> = {};
    for (const k of ["ai_sessions", "edit_history"]) if (k in x) sisa[k] = x[k];
    const dasar = newProject({
      ...(typeof x.project_id === "string" ? { id: x.project_id } : {}),
      judulAr: String(x.title ?? ""),
      dibuat: String(x.created_at ?? new Date().toISOString()),
    });
    return {
      ...dasar,
      draf,
      sumber,
      catatan:
        Object.keys(sisa).length > 0
          ? `[Data bentuk GDrive lama yang belum dipetakan: ${JSON.stringify(sisa).slice(0, 2000)}]`
          : dasar.catatan,
    };
  }

  const p = mentah as Project;
  return {
    ...newProject(),
    ...p,
    versiSkema: VERSI_SKEMA_SAAT_INI,
    sumber: Array.isArray(p.sumber) ? p.sumber.map(normalisasiSumber) : [],
    istilah: Array.isArray(p.istilah) ? p.istilah : [],
    rumusan: Array.isArray(p.rumusan) ? p.rumusan : [],
    tujuan: Array.isArray(p.tujuan) ? p.tujuan : [],
    jawaban: p.jawaban ?? {},
    draf: p.draf ?? {},
    daftarIsi: sanitasiDaftarIsi(p.daftarIsi),
    kunciPencarian: sanitasiKunciPencarian(p.kunciPencarian),
    temuan: sanitasiTemuan(p.temuan),
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
    if (!Array.isArray(data)) return [];
    // Semua proyek yang dimuat melewati gerbang migrasi (C.8). Proyek yang
    // gagal migrasi karena versi lebih baru dipertahankan apa adanya agar
    // tidak hilang dari daftar; ia akan ditolak dengan pesan saat dibuka.
    return data.map((item) => {
      try {
        return migrasiProyek(item);
      } catch {
        return item as Project;
      }
    });
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
  const p = bacaSemua().find((x) => x.id === id) ?? null;
  if (!p) return null;
  // Buka = lewati gerbang migrasi; VersiLebihBaruError dibiarkan meledak agar
  // UI bisa menjelaskan, bukan membuka data setengah.
  return migrasiProyek(p);
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
