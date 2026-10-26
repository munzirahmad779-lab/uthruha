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


/** Samakan angka Arab-Indic (٠١٢٣) ke Latin agar regex angka bekerja dwibahasa. */
export function angkaArabKeLatin(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/**
 * Turunkan templat footnote dari CONTOH persis di pedoman (Arab/Indonesia).
 * Pola kanonis pedoman: penulis، judul، (kota: penerbit، tahun)، ج jilid، ص halaman.
 * Penulis boleh dua segmen (laqab، nama) — segmen terakhir kepala = judul.
 * Null bila contoh tidak cukup lengkap; pemanggil memakai pola bawaan.
 */
export function templatFootnoteDariContoh(contoh: string): string | null {
  let s = angkaArabKeLatin(contoh.trim());
  if (s.length < 15) return null;
  const titikAkhir = /[.。]\s*$/.test(s);
  s = s.replace(/[.。]\s*$/, "");
  const iKurung = s.indexOf("(");
  const kepalaMentah = iKurung >= 0 ? s.slice(0, iKurung) : s;
  const kepala = kepalaMentah.trim();
  const bagKepala = kepala.split(/،|,/).map((x) => x.trim()).filter(Boolean);
  if (bagKepala.length < 2) return null;
  const pemisah = kepala.includes("،") ? "، " : ", ";
  let hasil = "{penulis}" + pemisah + "{judul}";
  let ekor = iKurung >= 0 ? s.slice(iKurung) : "";
  if (!ekor && bagKepala.length > 2) {
    const judul = bagKepala[bagKepala.length - 1];
    ekor = kepala.slice(kepala.lastIndexOf(judul) + judul.length);
  }
  if (ekor) {
    let e = ekor;
    e = e.replace(/\(([^:()]+):/, "({kota}:");
    e = e.replace(/:\s*([^،,()]+?)(?=\s*[،,]|\s*\)|\s*$)/, ": {penerbit}");
    e = e.replace(/(1[0-9]{3}|20[0-9]{2})\s*(هـ)?/, "{tahun}");
    e = e.replace(/ج\s*[0-9]+/, "ج {jilid}");
    e = e.replace(/jilid\s*[0-9]+/i, "jilid {jilid}");
    e = e.replace(/ص\s*[0-9]+/, "ص {halaman}");
    e = e.replace(/hlm\.?\s*[0-9]+/i, "hlm. {halaman}");
    const sambung = iKurung >= 0 ? (kepalaMentah.match(/(،|,)\s*$/)?.[0] ?? pemisah) : "";
    hasil += sambung + e;
  }
  if (!hasil.includes("{tahun}") && !hasil.includes("{halaman}")) return null;
  if (!hasil.includes("{penulis}") || !hasil.includes("{judul}")) return null;
  return hasil + (titikAkhir ? "." : "");
}

/**
 * Turunkan templat daftar pustaka dari contoh pedoman.
 * Pola kanonis: penulis. judul. kota: penerbit، tahun. (ج jilid.)
 */
export function templatPustakaDariContoh(contoh: string): string | null {
  let s = angkaArabKeLatin(contoh.trim());
  if (s.length < 15) return null;
  const titikAkhir = /[.。]\s*$/.test(s);
  s = s.replace(/[.。]\s*$/, "");
  const seg = s.split(/\.\s+/).map((x) => x.trim()).filter(Boolean);
  if (seg.length < 3) return null;
  const out: string[] = ["{penulis}", "{judul}"];
  let adaKota = false;
  let adaTahun = false;
  for (const g of seg.slice(2)) {
    let t = g;
    if (/^(1[0-9]{3}|20[0-9]{2})/.test(t)) {
      out.push("{tahun}");
      adaTahun = true;
      continue;
    }
    if (/^ج\s*[0-9]+/.test(t)) {
      out.push("ج {jilid}");
      continue;
    }
    if (t.includes(":")) {
      t = t.replace(/^[^:]+:/, "{kota}:").replace(/:\s*[^،,]+/, ": {penerbit}");
      adaKota = true;
      t = t.replace(/(1[0-9]{3}|20[0-9]{2})\s*(هـ)?/, () => {
        adaTahun = true;
        return "{tahun}";
      });
      out.push(t);
      continue;
    }
    out.push(t);
  }
  if (!adaKota || !adaTahun) return null;
  return out.join(". ") + (titikAkhir ? "." : "");
}

export function parsePedoman(md: string, namaBerkas = "pedoman.md"): PedomanRules {
  const aturan = pedomanDefault();
  aturan.mentah = md.slice(0, 24000);
  aturan.namaBerkas = namaBerkas;

  const teks = md.replace(/\r\n/g, "\n");
  const teksA = angkaArabKeLatin(teks);
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
  const barisFootnote = barisPemicu(teksA, /(footnote|catatan kaki|catatan perut|catatan bawah|هامش|الهوامش|حاشية|الحواشي|حاشية سفلية)/i);
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

  const barisNaskah = barisPemicu(teksA, /(naskah|isi|body|teks utama|badan tulisan|المتن|نص البحث)/i);
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
  const spasiM = teksA.match(/spasi\s*([0-9]+(?:[.,][0-9])?)/i) ?? teksA.match(/(?:تباعد(?: الأسطر)?|المسافة بين الأسطر)\s*:?\s*([0-9]+(?:[.,][0-9])?)/) ?? teksA.match(/([0-9]+[.,]5)\s*(?:spasi|line|baris)/i);
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
  const m = angka("margin", "Margin", 0, [/margin[^\n]{0,30}?(\d{1,2}(?:[.,]\d)?)\s*cm/i, /(\d{1,2}(?:[.,]\d)?)\s*cm[^\n]{0,20}margin/i, /(\d{1,2}(?:[.,]\d)?)\s*(?:cm|سم)/i, /هوامش[^\n]{0,30}?(\d{1,2}(?:[.,]\d)?)/], teksA);
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
  if (/(angka arab|arabic-indic|٠١٢٣|digit arab|الأرقام العربية|أرقام عربية|أرقام مشرقية)/i.test(teks)) {
    aturan.angkaArab = true;
  } else if (/(angka latin|western digit|0-9|الأرقام اللاتينية|أرقام لاتينية)/i.test(teks)) {
    aturan.angkaArab = false;
    catat("Angka", "Latin (0-9)", barisPemicu(teks, /(angka latin|0-9)/i) ?? "");
  }


  // Contoh footnote & daftar pustaka -> templat (dwibahasa). Inilah pola
  // kampus yang sebenarnya; bila penurunan gagal, pola bawaan dipertahankan
  // dan kegagalannya dicatat jujur.
  const nilaiSetelahLabel = (baris: string | null): string =>
    baris ? baris.split(/[:：]/).slice(1).join(":").trim() : "";
  const barisContohFootnote = barisPemicu(teks, /(contoh|مثال)[^\n]{0,30}(footnote|catatan kaki|حاشية|هامش)/i);
  const contohFootnote = nilaiSetelahLabel(barisContohFootnote);
  if (contohFootnote) {
    const tpl = templatFootnoteDariContoh(contohFootnote);
    if (tpl) {
      aturan.formatFootnote = tpl;
      catat("Bentuk footnote", "diturunkan dari contoh pedoman", barisContohFootnote ?? "");
    } else {
      catat("Contoh footnote", `${contohFootnote.slice(0, 110)} (pola tidak bisa diturunkan — memakai pola bawaan)`, barisContohFootnote ?? "");
    }
  }
  const barisContohPustaka = barisPemicu(teks, /(contoh|مثال)[^\n]{0,30}(daftar pustaka|قائمة المراجع|قائمة المصادر|المصادر والمراجع)/i);
  const contohPustaka = nilaiSetelahLabel(barisContohPustaka);
  if (contohPustaka) {
    const tpl = templatPustakaDariContoh(contohPustaka);
    if (tpl) {
      aturan.formatPustaka = tpl;
      catat("Bentuk daftar pustaka", "diturunkan dari contoh pedoman", barisContohPustaka ?? "");
    } else {
      catat("Contoh daftar pustaka", `${contohPustaka.slice(0, 110)} (pola tidak bisa diturunkan — memakai pola bawaan)`, barisContohPustaka ?? "");
    }
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
2. Tulis ulang HANYA aturan format, sitasi, dan sistematika yang benar-benar disebut. Jangan menambah aturan yang tidak ada.
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
## Daftar Isi (Sistematika Penulisan)
Salin sistematika/daftar isi bab dari pedoman PERSIS sebagai daftar bersarang:
bab tanpa indentasi, sub-bab menjorok 2 spasi, fasal menjorok 4 spasi.
- BAB I <judul bab>
  - <sub-bab>
    - <fasal/matlab>
- BAB II <judul bab>
  - <sub-bab>
## Aturan lain
- <poin-poin lain yang relevan: penulisan judul, transliterasi, kutipan panjang, dll>

Aturan penting:
- Judul bagian tetap Bahasa Indonesia seperti contoh di atas, meskipun isi dan contohnya berbahasa Arab.
- Jangan mengarang. Jika pedoman tidak menyebut sesuatu, tulis "tidak disebut".
- Pertahankan contoh footnote/daftar pustaka apa adanya, karena saya akan memakainya sebagai pola.
- Keluarkan hanya markdown di atas, tanpa penjelasan tambahan.

Pedoman kampus saya:
<<<TEMPELKAN DI SINI>>>`;
