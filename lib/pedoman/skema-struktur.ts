/**
 * Skema tetap STRUKTUR PEDOMAN (Fase 3, keputusan F) — satu skema Zod
 * untuk tiga pintu:
 *  (a) kontrak yang dicetak menjadi paket prompt untuk AI luar
 *      (ChatGPT/Claude/Gemini/Meta AI),
 *  (b) validator tempelan hasil ulikan mahasiswa (error per bidang),
 *  (c) sumber proyeksi menjadi daftar isi proyek (BabKustom[]).
 *
 * Pola perbaikan mengikuti Instructor: tempelan yang gagal TIDAK dibuang
 * diam-diam — daftar errornya diubah menjadi "prompt perbaikan" yang bisa
 * disalin dan ditempel balik ke AI luar yang sama (maks 3 putaran, lalu
 * jalur formulir manual yang sudah ada).
 */
import { z } from "zod";
import type { BabKustom, SubBabKustom } from "@/lib/engine/project";

export const SkemaAturan = z.object({
  teks: z.string().min(5, "teks aturan minimal 5 karakter"),
  wajib: z.boolean().default(true),
  contoh: z.string().optional(),
});

export const SkemaSubBabStruktur = z.object({
  nama: z.string().min(2, "nama sub-bab minimal 2 karakter"),
  namaAr: z.string().optional(),
  wajib: z.boolean().default(true),
});

export const SkemaBabStruktur = z.object({
  nomor: z.number().int().min(1, "nomor bab mulai dari 1"),
  nama: z.string().min(2, "nama bab minimal 2 karakter"),
  namaAr: z.string().optional(),
  tujuan: z.string().default(""),
  subBab: z.array(SkemaSubBabStruktur).max(20).default([]),
  aturan: z.array(SkemaAturan).max(30).default([]),
});

export const SkemaStrukturPedoman = z
  .object({
    versiSkema: z.literal("pedoman-struktur-v1"),
    namaPedoman: z.string().min(3, "nama pedoman wajib diisi"),
    bab: z.array(SkemaBabStruktur).min(1, "minimal 1 bab").max(12, "maksimal 12 bab"),
  })
  .superRefine((v, ctx) => {
    const nomor = v.bab.map((b) => b.nomor);
    if (new Set(nomor).size !== nomor.length) {
      ctx.addIssue({ code: "custom", path: ["bab"], message: "nomor bab tidak boleh ganda" });
    }
  });

export type StrukturPedoman = z.infer<typeof SkemaStrukturPedoman>;

/** Ekstrak blok JSON dari tempelan bebas (buang prosa AI luar). */
export function ekstrakJSON(teks: string): unknown | null {
  const pagar = teks.match(/```(?:json)?\s*([\s\S]*?)```/);
  const mentah = (pagar ? pagar[1]! : teks).trim();
  const mulai = mentah.indexOf("{");
  const akhir = mentah.lastIndexOf("}");
  if (mulai < 0 || akhir <= mulai) return null;
  try {
    return JSON.parse(mentah.slice(mulai, akhir + 1));
  } catch {
    return null;
  }
}

export interface GalatBidang {
  jalur: string;
  pesan: string;
}

/** Validasi tempelan; kembalikan data sah atau daftar error per bidang. */
export function validasiTempelanStruktur(teks: string): {
  ok: boolean;
  data?: StrukturPedoman;
  galat: GalatBidang[];
} {
  const json = ekstrakJSON(teks);
  if (json === null) {
    return {
      ok: false,
      galat: [{ jalur: "(dokumen)", pesan: "Tidak ditemukan blok JSON yang bisa dibaca. Minta AI mengeluarkan HANYA blok JSON seperti pada paket prompt." }],
    };
  }
  const hasil = SkemaStrukturPedoman.safeParse(json);
  if (hasil.success) return { ok: true, data: hasil.data, galat: [] };
  return {
    ok: false,
    galat: hasil.error.issues.map((i) => ({
      jalur: i.path.join(".") || "(dokumen)",
      pesan: i.message,
    })),
  };
}

/** Prompt perbaikan siap salin (pola retry-umpan-balik Instructor). */
export function buatPromptPerbaikan(teksAsli: string, galat: GalatBidang[]): string {
  const daftar = galat.map((g, i) => `${i + 1}. Bidang "${g.jalur}": ${g.pesan}`).join("\n");
  return [
    "Hasil JSON yang kamu keluarkan sebelumnya belum sesuai skema Kitabah. Perbaiki HANYA bagian yang salah di bawah ini, pertahankan isi lain yang sudah benar, lalu keluarkan ulang SELURUH dokumen sebagai satu blok ```json tanpa penjelasan apa pun.",
    "",
    "Kesalahan yang harus diperbaiki:",
    daftar,
    "",
    "Dokumen sebelumnya:",
    "```json",
    teksAsli.slice(0, 6000),
    "```",
  ].join("\n");
}

/** Paket prompt resmi untuk AI luar (berisi skema JSON + contoh sah). */
export const PROMPT_PAKET_STRUKTUR = `Kamu membantu mahasiswa mengekstrak STRUKTUR pedoman penulisan skripsi/tesis dari dokumen PDF pedoman yang dilampirkan.

Tugasmu: baca pedoman itu, lalu keluarkan struktur babnya mengikuti LOGIKA pedoman itu sendiri — untuk setiap bab: apa namanya, apa tujuan bab itu, sub-bab apa saja yang WAJIB ada di dalamnya, dan aturan penulisan yang berlaku di bab itu (mis. aturan latar belakang di Bab 1, aturan kajian pustaka/dirasah sabiqah di babnya, dst).

Keluarkan HANYA satu blok \`\`\`json dengan bentuk persis seperti ini (tanpa penjelasan sebelum/sesudah):

{
  "versiSkema": "pedoman-struktur-v1",
  "namaPedoman": "Pedoman Penulisan Skripsi <nama kampus>",
  "bab": [
    {
      "nomor": 1,
      "nama": "Pendahuluan",
      "namaAr": "المقدمة",
      "tujuan": "Satu-dua kalimat tujuan bab menurut pedoman.",
      "subBab": [
        { "nama": "Latar Belakang Masalah", "namaAr": "خلفية البحث", "wajib": true },
        { "nama": "Rumusan Masalah", "namaAr": "أسئلة البحث", "wajib": true }
      ],
      "aturan": [
        { "teks": "Aturan persis dari pedoman, diringkas tanpa mengubah makna.", "wajib": true, "contoh": "" }
      ]
    }
  ]
}

Aturan keras:
- Jumlah bab mengikuti pedoman (boleh 1–12). Nomor bab berurutan mulai 1, tidak ganda.
- "wajib": true bila pedoman mewajibkan, false bila anjuran/pilihan.
- Jangan mengarang bab/aturan yang tidak ada di pedoman. Bila pedoman tidak menyebut nama Arab, kosongkan "namaAr" menjadi "".
- Jangan menulis ulang seluruh isi pedoman — hanya struktur dan aturannya.`;

/** Proyeksi struktur tervalidasi → daftar isi proyek. */
export function strukturKeDaftarIsi(s: StrukturPedoman): BabKustom[] {
  const BAB_AR = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
  return [...s.bab]
    .sort((a, b) => a.nomor - b.nomor)
    .map((b, i) => ({
      id: `bab-pedoman-${b.nomor}`,
      labelId: b.nama,
      labelAr: b.namaAr || "",
      babAr: BAB_AR[i] ?? String(b.nomor),
      sections: b.subBab.map((sub, j) => ({
        id: `bab-pedoman-${b.nomor}-sub-${j + 1}`,
        labelId: sub.nama,
        labelAr: sub.namaAr || "",
      })) as SubBabKustom[],
    }));
}
