/**
 * Adapter manual — pengguna menempel sendiri data rujukan dari kitab cetak.
 * Ini jalur jujur terakhir: tidak ada pencarian, hanya pengurai teks yang
 * menghasilkan isian awal; semua kolom yang tidak terbaca ditandai kosong
 * agar tidak dikarang.
 */
import type { Sumber } from "@/lib/engine/cite";
import type { RefCandidate, RefHit } from "@/lib/refs/types";

export const info = {
  id: "manual" as const,
  mode: "manual" as const,
};

const POLA_JILID = /(?:^|[\s،,])ج(?:لد)?\s*(\d{1,3})/u;
const POLA_HAL = /(?:^|[\s،,])(?:ص|صفحة|هـ)\s*(\d{1,4})/u;
const POLA_TAHUN = /(\d{4})/;
const POLA_KURUNG = /\(([^)]{3,80})\)/u;

/** Urai satu baris sitasi menjadi isian awal `Sumber`. */
export function uraiSitasi(teks: string): Sumber {
  const bersih = teks.replace(/\s+/g, " ").trim();
  const kurung = bersih.match(POLA_KURUNG);
  const dalamKurung = kurung ? kurung[1] : "";

  const [kota, penerbit] = dalamKurung
    .split(/[:،,]/u)
    .map((s) => s.trim())
    .filter(Boolean);

  const tahun = bersih.match(POLA_TAHUN);
  const jilid = bersih.match(POLA_JILID);
  const halaman = bersih.match(POLA_HAL);

  // Bagian sebelum kurung biasanya "penulis، judul".
  const inti = (kurung ? bersih.slice(0, kurung.index) : bersih).replace(/[،,]\s*$/u, "").trim();
  const pisah = inti.split(/[،,]/u).map((s) => s.trim()).filter(Boolean);
  const penulis = pisah.length > 1 ? pisah[0] : "";
  const judul = (pisah.length > 1 ? pisah.slice(1).join("، ") : inti)
    .replace(POLA_JILID, "")
    .replace(POLA_HAL, "")
    .replace(/[،,]\s*$/u, "")
    .trim();

  return {
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    jenis: "kitab",
    penulis,
    judul,
    kota: kota ?? "",
    penerbit: penerbit ?? "",
    tahun: tahun ? tahun[1] : "",
    jilid: jilid ? jilid[1] : "",
    halaman: halaman ? halaman[1] : "",
  };
}

/** Kolom yang masih kosong setelah penguraian — ditampilkan ke pengguna. */
export function kolomKosong(s: Sumber): string[] {
  const wajib: [keyof Sumber, string][] = [
    ["penulis", "penulis"],
    ["judul", "judul"],
    ["kota", "kota"],
    ["penerbit", "penerbit"],
    ["tahun", "tahun"],
    ["halaman", "halaman"],
  ];
  return wajib.filter(([k]) => !String(s[k] ?? "").trim()).map(([, label]) => label);
}

/**
 * Ubah baris sitasi manual menjadi kandidat yang bisa dipilih sebagai
 * footnote.
 *
 * Catatan jujur: kandidat manual TIDAK punya skor. Skor 0 dipakai
 * sengaja — bukan "cocok", tapi "anda yang menulis". Kolom yang tidak
 * terbaca tetap kosong supaya penyusun footnote menandainya
 * `[ ! verifikasi ]`, bukan mengisinya.
 */
export function keKandidat(teks: string, kalimat = ""): RefCandidate {
  const s = uraiSitasi(teks);
  const kosong = kolomKosong(s);
  return {
    source: "manual",
    kitab: s.judul || "[ ! verifikasi ]",
    penulis: s.penulis || undefined,
    jilid: s.jilid ? Number(s.jilid) : undefined,
    halaman_cetak: s.halaman ? Number(s.halaman) : undefined,
    penerbit: s.penerbit || undefined,
    kota: s.kota || undefined,
    tahun: s.tahun ? Number(s.tahun) : undefined,
    teks_kutipan: teks.trim(),
    url_sumber: "",
    skor: 0,
    mode: "api",
    perluVerifikasi: kosong.length > 0,
    catatanVerifikasi: kosong.length > 0 ? `Kolom belum diisi: ${kosong.join(", ")}` : undefined,
  };
}

/** Buat kandidat manual siap pakai (dengan id & kalimat asal). */
export function kandidatManual(teks: string, kalimat = ""): RefHit {
  return {
    ...keKandidat(teks, kalimat),
    id: `m-${Math.random().toString(36).slice(2, 9)}`,
    kalimat,
  };
}
