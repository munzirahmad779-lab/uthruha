/**
 * Parser pedoman penulisan kampus dari markdown hasil olahan AI.
 *
 * Aturan desain: parser ini TIDAK mengarang. Setiap nilai yang tidak
 * ditemukan memakai default dan dicatat di `catatan` supaya pengguna tahu
 * bagian mana yang perlu diperiksa. Nilai yang terbaca juga membawa
 * `asal` (kutipan baris pemicu) agar bisa diaudit.
 */

export type GayaSitasi = "catatan-kaki" | "dalam-teks" | "keduanya";
export type Penomoran = "per-bab" | "kontinu" | "per-halaman";

export interface PedomanRules {
  namaKampus: string;
  fontArab: string;
  ukuranNaskah: number;
  ukuranFootnote: number;
  spasi: number;
  marginCm: number;
  penomoran: Penomoran;
  gayaSitasi: GayaSitasi;
  /** Template footnote dengan slot {penulis} {judul} {kota} {penerbit} {tahun} {jilid} {halaman}. */
  formatFootnote: string;
  formatPustaka: string;
  maksFootnotePerParagraf: number;
  maksHalaman: number;
  angkaArab: boolean;
  /** Bagian yang diambil dari file (untuk ringkasan & audit). */
  catatan: { label: string; nilai: string; asal: string }[];
  /** Bagian yang memakai default karena tidak terbaca. */
  default: string[];
  mentah: string;
  namaBerkas: string;
}

export const BATAS_FOOTNOTE = 2;
export const MAKS_HALAMAN = 1;

export function pedomanDefault(): PedomanRules {
  return {
    namaKampus: "",
    fontArab: "Traditional Arabic",
    ukuranNaskah: 16,
    ukuranFootnote: 14,
    spasi: 1.5,
    marginCm: 2.5,
    penomoran: "per-bab",
    gayaSitasi: "catatan-kaki",
    formatFootnote:
      "{penulis}، {judul}، ({kota}: {penerbit}، {tahun})، ج {jilid}، ص {halaman}.",
    formatPustaka: "{penulis}. {judul}. {kota}: {penerbit}، {tahun}. ج {jilid}.",
    maksFootnotePerParagraf: BATAS_FOOTNOTE,
    maksHalaman: MAKS_HALAMAN,
    angkaArab: true,
    catatan: [],
    default: [],
    mentah: "",
    namaBerkas: "",
  };
}

const FONT_DIKENAL = [
  "Traditional Arabic",
  "Simplified Arabic",
  "Sakkal Majalla",
  "Arabic Typesetting",
  "Amiri",
  "Noto Naskh Arabic",
  "Times New Roman",
  "Arial",
  "Calibri",
];

function barisPemicu(md: string, pola: RegExp): string | null {
  for (const baris of md.split(/\r?\n/)) {
    if (pola.test(baris)) return baris.trim().slice(0, 220);
  }
  return null;
}

function angka(id: string, label: string, nilai: number, pola: RegExp[], md: string) {
  for (const p of pola) {
    const m = md.match(p);
    if (m) {
      const n = Number.parseFloat((m[1] ?? "").replace(",", "."));
      if (Number.isFinite(n)) return { nilai: n, asal: barisPemicu(md, p) ?? label };
    }
  }
  return null;
}

export function parsePedoman(md: string, namaBerkas = "pedoman.md"): PedomanRules {
  const aturan = pedomanDefault();
  aturan.mentah = md.slice(0, 24000);
  aturan.namaBerkas = namaBerkas;

  const teks = md.replace(/\r\n/g, "\n");
  const catat = (label: string, nilai: string, asal: string) => aturan.catatan.push({ label, nilai, asal });

  // Nama kampus / universitas.
  const kampus =
    teks.match(/(?:Universitas|UIN|IAIN|UINSU|STAIN|Institut|Sekolah Tinggi|Ma'?had|Perguruan Tinggi|جامعة|الجامعة)\s+[^\n.,؛]{3,60}/u) ??
    teks.match(/^#\s+(.{3,80})$/m);
  if (kampus) {
    aturan.namaKampus = kampus[0].replace(/^#\s*/, "").trim();
    catat("Nama lembaga", aturan.namaKampus, kampus[0].slice(0, 160));
  } else {
    aturan.default.push("nama lembaga (tidak disebut)");
  }

  // Font.
  for (const f of FONT_DIKENAL) {
    const re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(teks)) {
      aturan.fontArab = f;
      catat("Font Arab", f, barisPemicu(teks, re) ?? f);
      break;
    }
  }
  if (aturan.fontArab === "Traditional Arabic" && !FONT_DIKENAL.some((f) => f !== "Traditional Arabic" && new RegExp(f, "i").test(teks))) {
    aturan.default.push("font (memakai Traditional Arabic sesuai batas produk)");
  }

  // Ukuran naskah vs footnote: cari angka pt di baris yang menyebut footnote.
  const barisFootnote = barisPemicu(teks, /(footnote|catatan kaki|catatan perut|catatan bawah|هامش|الهوامش)/i);
  if (barisFootnote) {
    const pt = barisFootnote.match(/(\d{1,2})\s*(?:pt|poin|point|بيونت)?/i);
    if (pt) {
      const n = Number.parseInt(pt[1], 10);
      if (n >= 8 && n <= 20) {
        aturan.ukuranFootnote = n;
        catat("Ukuran footnote", `${n} pt`, barisFootnote);
      }
    }
  } else {
    aturan.default.push("ukuran footnote (14 pt)");
  }

  const barisNaskah = barisPemicu(teks, /(naskah|isi|body|teks utama|badan tulisan|المتن|نص البحث)/i);
  if (barisNaskah) {
    const pt = barisNaskah.match(/(\d{1,2})\s*(?:pt|poin|point)?/i);
    if (pt) {
      const n = Number.parseInt(pt[1], 10);
      if (n >= 10 && n <= 24) {
        aturan.ukuranNaskah = n;
        catat("Ukuran naskah", `${n} pt`, barisNaskah);
      }
    }
  } else {
    aturan.default.push("ukuran naskah (16 pt)");
  }

  // Spasi.
  const spasiM = teks.match(/spasi\s*([0-9]+(?:[.,][0-9])?)/i) ?? teks.match(/([0-9]+[.,]5)\s*(?:spasi|line|baris)/i);
  if (spasiM) {
    const n = Number.parseFloat(spasiM[1].replace(",", "."));
    if (n >= 1 && n <= 3) {
      aturan.spasi = n;
      catat("Spasi", String(n).replace(".", ","), spasiM[0].slice(0, 120));
    }
  } else {
    aturan.default.push("spasi (1,5)");
  }

  // Margin.
  const m = angka("margin", "Margin", 0, [/margin[^\n]{0,30}?(\d{1,2}(?:[.,]\d)?)\s*cm/i, /(\d{1,2}(?:[.,]\d)?)\s*cm[^\n]{0,20}margin/i], teks);
  if (m) {
    aturan.marginCm = m.nilai;
    catat("Margin (cm)", String(m.nilai).replace(".", ","), m.asal);
  } else {
    aturan.default.push("margin (2,5 cm)");
  }

  // Penomoran footnote.
  if (/(per\s*bab|setiap\s*bab|tiap\s*bab|each chapter|لكل باب|في كل باب)/i.test(teks)) {
    aturan.penomoran = "per-bab";
    catat("Penomoran footnote", "per bab", barisPemicu(teks, /(per\s*bab|لكل باب)/i) ?? "");
  } else if (/(per\s*halaman|each page|لكل صفحة)/i.test(teks)) {
    aturan.penomoran = "per-halaman";
    catat("Penomoran footnote", "per halaman", barisPemicu(teks, /(per\s*halaman|لكل صفحة)/i) ?? "");
  } else if (/(kontinu|berurutan|terus|sequential|متسلسل)/i.test(teks)) {
    aturan.penomoran = "kontinu";
    catat("Penomoran footnote", "kontinu", barisPemicu(teks, /(kontinu|متسلسل)/i) ?? "");
  } else {
    aturan.default.push("penomoran footnote (per bab)");
  }

  // Gaya sitasi.
  const adaFootnote = /(footnote|catatan kaki|catatan perut|هامش|هوامش)/i.test(teks);
  const adaDalam = /(dalam teks|in-?text|\(nama, tahun\)|parenthetical)/i.test(teks);
  if (adaFootnote && adaDalam) aturan.gayaSitasi = "keduanya";
  else if (adaDalam && !adaFootnote) aturan.gayaSitasi = "dalam-teks";
  else aturan.gayaSitasi = "catatan-kaki";
  catat("Gaya sitasi", aturan.gayaSitasi, barisPemicu(teks, /(gaya sitasi|citation style|footnote|catatan kaki)/i) ?? "default");

  // Format footnote eksplisit di file.
  const formatBaris = barisPemicu(teks, /(format|urutan|susunan)[^\n]{0,40}(footnote|catatan kaki|pustaka)/i);
  if (formatBaris) {
    catat("Format yang disebut", formatBaris, formatBaris);
  }

  // Angka Arab.
  if (/(angka arab|arabic-indic|٠١٢٣|digit arab)/i.test(teks)) {
    aturan.angkaArab = true;
  } else if (/(angka latin|western digit|0-9)/i.test(teks)) {
    aturan.angkaArab = false;
    catat("Angka", "Latin (0-9)", barisPemicu(teks, /(angka latin|0-9)/i) ?? "");
  }

  // Batas keras produk tidak boleh dilewati pedoman apa pun.
  aturan.maksFootnotePerParagraf = BATAS_FOOTNOTE;
  aturan.maksHalaman = MAKS_HALAMAN;

  return aturan;
}

/** Ringkasan satu baris per aturan, untuk ditampilkan ke pengguna. */
export function ringkasPedoman(p: PedomanRules): string[] {
  const angkaA = p.angkaArab ? "angka Arab" : "angka Latin";
  return [
    `Naskah: ${p.fontArab} ${p.ukuranNaskah} pt, spasi ${String(p.spasi).replace(".", ",")}, margin ${String(p.marginCm).replace(".", ",")} cm, ${angkaA}.`,
    `Footnote: ${p.ukuranFootnote} pt, penomoran ${p.penomoran}, maksimal ${p.maksFootnotePerParagraf} per paragraf.`,
    `Gaya sitasi: ${p.gayaSitasi}.`,
    `Bentuk footnote: ${p.formatFootnote}`,
    `Bentuk daftar pustaka: ${p.formatPustaka}`,
  ];
}

/** Prompt siap-tempel untuk DeepSeek/Meta AI — dihasilkan web, bukan disalin. */
export const PROMPT_PEDOMAN = `Kamu membantu saya mengubah buku pedoman penulisan skripsi/tesis/disertasi kampus saya menjadi berkas markdown yang mudah dibaca mesin.

Tugasmu:
1. Baca pedoman yang saya tempelkan di bawah (boleh berupa teks berantakan, potongan gambar yang sudah di-OCR, atau tautan).
2. Tulis ulang HANYA aturan format dan sitasi yang benar-benar disebut. Jangan menambah aturan yang tidak ada.
3. Gunakan struktur markdown berikut, dan kosongkan (tulis "tidak disebut") bagian yang tidak ada di pedoman:

# Pedoman Penulisan <nama kampus>
## Format Naskah
- Font Arab: <nama font> <ukuran> pt
- Ukuran footnote: <ukuran> pt
- Spasi: <angka>
- Margin: <angka> cm
- Angka: <Arab/Latin>
## Sitasi
- Gaya: <catatan kaki / dalam teks / keduanya>
- Penomoran footnote: <per bab / kontinu>
- Contoh footnote: <contoh persis dari pedoman>
- Contoh daftar pustaka: <contoh persis dari pedoman>
## Aturan lain
- <poin-poin lain yang relevan: penulisan judul, transliterasi, kutipan panjang, dll>

Aturan penting:
- Jangan mengarang. Jika pedoman tidak menyebut sesuatu, tulis "tidak disebut".
- Pertahankan contoh footnote/daftar pustaka apa adanya, karena saya akan memakainya sebagai pola.
- Keluarkan hanya markdown di atas, tanpa penjelasan tambahan.

Pedoman kampus saya:
<<<TEMPELKAN DI SINI>>>`;
