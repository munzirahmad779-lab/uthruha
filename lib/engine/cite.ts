export type JenisSumber =
  | "kitab"
  | "artikel"
  | "bab"
  | "skripsi"
  | "web"
  | "terjemahan"
  // Jenis tambahan Tahap 6: ke-12 format hawamisy SPEC-PEDOMAN dipilih
  // dari JENIS sebagai data terstruktur, jadi ensiklopedia, wawancara,
  // hadis, dan koran/majalah berkala perlu nilai jenisnya sendiri.
  | "ensiklopedia"
  | "wawancara"
  | "hadis"
  | "koran";

export interface Sumber {
  id: string;
  jenis: JenisSumber;
  /** Nama penulis dalam huruf Arab, format «اللقب، الاسم». */
  penulis: string;
  /** Schema v2: penulis sebagai daftar (untuk gaya sitasi Latin & impor). penulis string tetap sumber tampil Arab. */
  penulisDaftar?: string[];
  tahun: string;
  /** Tahun Hijriah bila diketahui (schema v2). */
  tahunHijriah?: string;
  judul: string;
  penerbit?: string;
  kota?: string;
  edisi?: string;
  jilid?: string;
  halaman?: string;
  jurnal?: string;
  volume?: string;
  nomor?: string;
  doi?: string;
  url?: string;
  penerjemah?: string;
  /** Tanggal terbit (web, format 7 Mangkoso) atau tanggal wawancara
   *  (format 11) atau tanggal akses (web As'adiyah) — teks bebas persis
   *  seperti yang ditulis mahasiswa, mis. "10 أكتوبر 2021". */
  tanggal?: string;
  /** Media wawancara (format 11 Mangkoso): telepon, tatap muka, dst. */
  media?: string;
  /** Nomor hadis (format 12 Mangkoso; takhrij As'adiyah). Untuk hadis,
   *  yang dicantumkan adalah nomor ini, bukan nomor halaman. */
  nomorHadis?: string;
  /** Kitab/bagian tematis takhrij As'adiyah, mis. "كتاب السلام". */
  bagianTematis?: string;
  /** Bab tematis takhrij As'adiyah, mis. "باب الطاعون والطيرة". */
  babTematis?: string;
  /** Derajat hadis (takhrij As'adiyah, untuk selain Bukhari-Muslim). */
  derajatHadis?: string;
  tahqiq?: string;
  /** Schema v2: nama muhaqqiq (kanonis); tahqiq lama dipetakan ke sini saat migrasi. */
  muhaqqiq?: string;
  isbn?: string;
  issn?: string;
  /** Schema v2: asal entri — "manual" | "bibtex" | "ris" | "crossref" | "doaj" | "turath" | "shamela" | "archive" | nama sumber lain. */
  sumberImpor?: string;
  /** Schema v2: true bila metadata belum diperiksa user (hasil pencarian mentah). */
  perluVerifikasi?: boolean;
  /** Ringkasan lit-review (§6 pengganti matriks): temuan utama sumber ini. */
  temuan?: string;
  /** Ringkasan lit-review: metode yang dipakai sumber ini. */
  metodeSumber?: string;
  /** Ringkasan lit-review: relevansi sumber ini dengan penelitian user. */
  relevansi?: string;
  catatan?: string;
}

export const JENIS_LABEL: Record<JenisSumber, { id: string; ar: string }> = {
  kitab: { id: "Kitab / buku", ar: "كتاب" },
  artikel: { id: "Artikel jurnal", ar: "مقال في مجلة" },
  bab: { id: "Bab dalam buku", ar: "فصل في كتاب" },
  skripsi: { id: "Skripsi / tesis / disertasi", ar: "رسالة علمية" },
  web: { id: "Laman web", ar: "موقع إلكتروني" },
  terjemahan: { id: "Karya terjemahan", ar: "كتاب مترجم" },
  ensiklopedia: { id: "Ensiklopedia", ar: "موسوعة" },
  wawancara: { id: "Wawancara", ar: "مقابلة" },
  hadis: { id: "Hadis (takhrij)", ar: "حديث" },
  koran: { id: "Artikel koran / majalah", ar: "مقال في صحيفة" },
};

/**
 * Buang tag jenis di kepala judul ("[مجلة] …", "[كتاب] …") — sanitasi
 * judul Tahap 6. Tag semacam itu lahir di adapter jurnal lama dan
 * mencemari judul di semua permukaan (simpan, tampil, footnote,
 * daftar pustaka). Jenis hidup sebagai bidang data `jenis`, bukan
 * teks judul. Hanya kelompok kurung di PALING AWAL yang dibuang, dan
 * hanya bila isinya pendek tanpa spasi (ciri tag mesin); judul yang
 * sah tidak pernah dimulai begitu. Makna judul tidak berubah.
 */
export function bersihkanJudul(judul: string): string {
  let j = (judul ?? "").trim();
  let m: RegExpExecArray | null;
  while ((m = /^\[([^\s[\]]{1,24})\]\s*/.exec(j)) !== null) {
    j = j.slice(m[0].length).trim();
  }
  return j;
}

const ANGKA_ARAB = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function keAngkaArab(nilai: string | number): string {
  return String(nilai).replace(/\d/g, (d) => ANGKA_ARAB[Number(d)]);
}

export interface OpsiSitasi {
  angkaArab?: boolean;
  /** sertakan halaman bila ada */
  halaman?: boolean;
}

function num(s: string | number | undefined, opsi: OpsiSitasi): string {
  if (s === undefined || s === "") return "";
  return opsi.angkaArab ? keAngkaArab(s) : String(s);
}

/** Kutipan dalam teks gaya Arab: (القرطبي، ١٩٦٤، ٢٣) */
export function kutipanDalamTeks(s: Sumber, opsi: OpsiSitasi = {}): string {
  const nama = s.penulis.split("،")[0].trim() || s.penulis;
  const bagian = [nama, num(s.tahun, opsi)];
  if (opsi.halaman !== false && s.halaman) bagian.push(num(s.halaman, opsi));
  return `(${bagian.filter(Boolean).join("، ")})`;
}

/** Catatan kaki gaya kitab: Penulis، Judul، (Kota: Penerbit، Tahun)، ج، ص. */
export function catatanKaki(s: Sumber, opsi: OpsiSitasi = {}): string {
  const judul = bersihkanJudul(s.judul);
  const kotaPenerbit = [s.kota, s.penerbit].filter(Boolean).join(": ");
  const kurung = kotaPenerbit
    ? `(${kotaPenerbit}${s.tahun ? `، ${num(s.tahun, opsi)}` : ""})`
    : s.tahun
      ? `(${num(s.tahun, opsi)})`
      : "";
  const jilid = s.jilid ? `ج ${num(s.jilid, opsi)}` : "";
  const hal = s.halaman ? `ص ${num(s.halaman, opsi)}` : "";
  return [s.penulis, judul, s.tahqiq ? `تحقيق: ${s.tahqiq}` : "", kurung, jilid, hal]
    .filter(Boolean)
    .join("، ")
    .replace(/،\s*،/g, "،");
}

/** Entri daftar pustaka berbahasa Arab. */
export function entriDaftarPustaka(s: Sumber, opsi: OpsiSitasi = {}): string {
  const bagian: string[] = [];
  bagian.push(s.penulis.replace(/\s*$/, "") + ".");
  bagian.push(bersihkanJudul(s.judul) + ".");
  if (s.tahqiq) bagian.push(`تحقيق: ${s.tahqiq}.`);
  if (s.penerjemah) bagian.push(`ترجمة: ${s.penerjemah}.`);
  if (s.edisi) bagian.push(`${s.edisi}.`);
  if (s.jenis === "artikel") {
    const info = [s.jurnal, s.volume ? `مج ${num(s.volume, opsi)}` : "", s.nomor ? `ع ${num(s.nomor, opsi)}` : ""]
      .filter(Boolean)
      .join("، ");
    if (info) bagian.push(`${info}.`);
  }
  if (s.jenis === "skripsi") {
    bagian.push(`${s.penerbit ?? "الجامعة"}${s.kota ? `، ${s.kota}` : ""}.`);
  }
  const kotaPenerbit = [s.kota, s.penerbit].filter(Boolean).join(": ");
  if (s.jenis !== "skripsi" && (kotaPenerbit || s.tahun)) {
    bagian.push(`${kotaPenerbit}${kotaPenerbit && s.tahun ? "، " : ""}${num(s.tahun, opsi)}.`);
  }
  if (s.jenis === "skripsi" && s.tahun) bagian.push(`${num(s.tahun, opsi)}.`);
  if (s.jenis === "web") {
    bagian.push(`${s.url ?? ""}${s.url ? "." : ""}`);
  }
  if (s.jilid && s.jenis !== "artikel") bagian.push(`ج ${num(s.jilid, opsi)}.`);
  return bagian.filter((b) => b && b !== ".").join(" ").replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
}

/** Entri gaya Indonesia (APA 7 ringkas) untuk naskah berbahasa Indonesia. */
export function entriIndonesia(s: Sumber): string {
  const nama = s.penulis.split("،").reverse().join(", ").trim();
  const judul = bersihkanJudul(s.judul);
  const inti =
    s.jenis === "artikel"
      ? `${nama} (${s.tahun}). ${judul}. ${s.jurnal ?? ""}${s.volume ? `, ${s.volume}` : ""}${s.nomor ? `(${s.nomor})` : ""}.${s.doi ? ` https://doi.org/${s.doi}` : ""}`
      : s.jenis === "web"
        ? `${nama} (${s.tahun}). ${judul}. ${s.url ?? ""}`
        : `${nama} (${s.tahun}). ${judul}. ${[s.kota, s.penerbit].filter(Boolean).join(": ")}.`;
  return inti.replace(/\s+/g, " ").trim();
}

const collator = new Intl.Collator("ar");

export function susunDaftarPustaka(items: Sumber[]): { judul: string; entri: string[] }[] {
  const grup: { judul: string; jenis: JenisSumber[] }[] = [
    { judul: "المصادر والمراجع العربية", jenis: ["kitab", "terjemahan", "bab", "ensiklopedia", "hadis"] },
    { judul: "المقالات في المجلات العلمية", jenis: ["artikel", "koran"] },
    { judul: "الرسائل العلمية", jenis: ["skripsi"] },
    { judul: "المواقع الإلكترونية", jenis: ["web"] },
    { judul: "المقابلات", jenis: ["wawancara"] },
  ];

  return grup
    .map((g) => ({
      judul: g.judul,
      entri: items
        .filter((s) => g.jenis.includes(s.jenis))
        .sort((a, b) => collator.compare(a.penulis, b.penulis) || (b.tahun || "").localeCompare(a.tahun || ""))
        .map((s) => entriDaftarPustaka(s)),
    }))
    .filter((g) => g.entri.length > 0);
}

export function sumberBaru(jenis: JenisSumber = "kitab"): Sumber {
  return {
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    jenis,
    penulis: "",
    tahun: "",
    judul: "",
    kota: "",
    penerbit: "",
  };
}
