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
  /**
   * Ikatan bab isi ke nomor rumusan masalah/isykal yang dijawabnya
   * (Pembangunan ulang Tahap 1, dari SPEC-PEDOMAN 2.2: pedoman Mangkoso
   * mewajibkan bab 2 menjawab pertanyaan 1, bab 3 pertanyaan 2, bab 4
   * pertanyaan 3). Bidang DATA, bukan sekadar nama bab: ikut terproyeksi
   * ke BabKustom.isykalKe dan menjadi konteks wajib generasi isi bab.
   * Kosong untuk bab yang tidak terikat (pendahuluan, penutup, dan bab
   * pedoman yang memang tidak memakai pemetaan satu bab satu isykal,
   * misalnya As'adiyah).
   */
  menjawabIsykal: z.number().int().min(1, "menjawab isykal mulai dari 1").max(12).optional(),
  subBab: z.array(SkemaSubBabStruktur).max(20).default([]),
  aturan: z.array(SkemaAturan).max(30).default([]),
});

export const SkemaStrukturPedoman = z
  .object({
    versiSkema: z.literal("pedoman-struktur-v1"),
    namaPedoman: z.string().min(3, "nama pedoman wajib diisi"),
    /**
     * Aturan penomoran catatan kaki menurut pedoman kampus, dicatat
     * sebagai DATA template (mesin footnote-nya dikerjakan tahap lain):
     * "bersambung" = nomor berlanjut antar-bab (Mangkoso, SPEC 2.5);
     * "per-bab" = mulai dari 1 pada setiap bab baru (As'adiyah, SPEC 3.6).
     */
    penomoranFootnote: z.enum(["bersambung", "per-bab"]).optional(),
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
  "penomoranFootnote": "bersambung",
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
    },
    {
      "nomor": 2,
      "nama": "Bab isi pertama",
      "namaAr": "",
      "tujuan": "Satu-dua kalimat tujuan bab menurut pedoman.",
      "menjawabIsykal": 1,
      "subBab": [],
      "aturan": []
    }
  ]
}

Aturan keras:
- Jumlah bab mengikuti pedoman (boleh 1–12). Nomor bab berurutan mulai 1, tidak ganda.
- "wajib": true bila pedoman mewajibkan, false bila anjuran/pilihan.
- "penomoranFootnote": "bersambung" bila nomor catatan kaki berlanjut antar-bab menurut pedoman, "per-bab" bila mulai dari 1 pada setiap bab baru. Kosongkan bidang ini bila pedoman tidak mengaturnya.
- "menjawabIsykal": isi HANYA bila pedoman secara eksplisit mengikat bab isi ke nomor pertanyaan rumusan masalah yang dijawabnya (misalnya bab 2 menjawab pertanyaan 1). Jangan mengarang ikatan yang tidak dinyatakan pedoman.
- Jangan mengarang bab/aturan yang tidak ada di pedoman. Bila pedoman tidak menyebut nama Arab, kosongkan "namaAr" menjadi "".
- Jangan menulis ulang seluruh isi pedoman — hanya struktur dan aturannya.`;

/** Proyeksi struktur tervalidasi → daftar isi proyek. */
/**
 * Peta peran sub-bab pedoman -> id bagian baku Kitabah. Bagian baku membawa
 * panduan menulis, pertanyaan pemicu, dan target kata yang kaya (mis.
 * "khalfiya" untuk latar belakang); tanpa pemetaan ini proyek pedoman
 * hanya menerima panduan generik dan panel khusus (strip khalfiyah,
 * Kembangkan) tidak pernah tampil — temuan lapangan 29 Okt 2026 dari
 * mahasiswa yang memakai template. Pencocokan dari nama Indonesia/Arab;
 * sub-bab yang tidak dikenal mempertahankan id posisinya.
 */
const PERAN_SUBBAB: { pola: RegExp; id: string }[] = [
  { pola: /latar belakang|khalfiy|خلفية/i, id: "khalfiya" },
  { pola: /rumusan|مشكلات|أسئلة البحث/i, id: "masalah" },
  { pola: /tujuan|أهداف/i, id: "ahdaf" },
  { pola: /manfaat|kegunaan|urgensi|أهمية|فوائد/i, id: "fawaid" },
  { pola: /batasan|حدود البحث/i, id: "hudud" },
  { pola: /definisi|تعريف|مصطلحات/i, id: "mustalahat" },
  { pola: /penelitian terdahulu|kajian terdahulu|دراسات سابقة|الدراسات السابقة/i, id: "dirasat" },
  { pola: /kerangka berpikir|kerangka pemikiran|kerangka konseptual|إطار فكري|إطار مفهومي|الإطار المفهومي/i, id: "itharFikri" },
  { pola: /kerangka teori|إطار نظري/i, id: "ithar" },
  { pola: /hipotesis|فرضي/i, id: "farudhiyat" },
  { pola: /kesimpulan|خلاصة|استنتاج/i, id: "khulasah" },
  { pola: /saran|توصيات|مقترحات/i, id: "iqtirahat" },
];

function idSubBabPedoman(nama: string, namaAr: string, fallback: string, terpakai: Set<string>): string {
  const teks = `${nama} ${namaAr}`;
  for (const { pola, id } of PERAN_SUBBAB) {
    if (pola.test(teks) && !terpakai.has(id)) {
      terpakai.add(id);
      return id;
    }
  }
  return fallback;
}

export function strukturKeDaftarIsi(s: StrukturPedoman): BabKustom[] {
  const BAB_AR = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
  const terpakai = new Set<string>();
  return [...s.bab]
    .sort((a, b) => a.nomor - b.nomor)
    .map((b, i) => ({
      id: `bab-pedoman-${b.nomor}`,
      labelId: b.nama,
      labelAr: b.namaAr || "",
      babAr: BAB_AR[i] ?? String(b.nomor),
      // Ikatan isykal, tujuan, dan aturan bab IKUT terproyeksi (Tahap 1):
      // proyeksi lama membuangnya sehingga aturan pedoman gugur begitu
      // struktur menjadi daftar isi proyek.
      ...(typeof b.menjawabIsykal === "number" ? { isykalKe: b.menjawabIsykal } : {}),
      ...(b.tujuan ? { tujuan: b.tujuan } : {}),
      ...(b.aturan.length > 0 ? { aturan: b.aturan.map((a) => a.teks) } : {}),
      sections: b.subBab.map((sub, j) => ({
        id: idSubBabPedoman(sub.nama, sub.namaAr || "", `bab-pedoman-${b.nomor}-sub-${j + 1}`, terpakai),
        labelId: sub.nama,
        labelAr: sub.namaAr || "",
      })) as SubBabKustom[],
    }));
}
