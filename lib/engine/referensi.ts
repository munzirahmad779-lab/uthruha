/**
 * Referensi: deduplikasi + parser impor BibTeX/RIS manual (tanpa dependensi).
 * Dipakai Reference Manager (Urutan 1) dan panel pencarian (Urutan 3).
 * Prinsip anti-karang: parser hanya memindahkan field yang benar-benar ada
 * di teks impor; yang tidak ada dibiarkan kosong, bukan ditebak.
 */
import { sumberBaru, type JenisSumber, type Sumber } from "@/lib/engine/cite";

/** Judul ternormalisasi untuk perbandingan: buang harakat, tanda baca, kecilkan. */
export function normalisasiJudul(judul: string): string {
  return judul
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalisasiDoi(doi?: string): string {
  return (doi ?? "")
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .trim();
}

function tokenSet(teks: string): Set<string> {
  return new Set(normalisasiJudul(teks).split(" ").filter((t) => t.length > 2));
}

/** Kemiripan judul 0..1 (Jaccard token). */
export function kemiripanJudul(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let iris = 0;
  for (const t of A) if (B.has(t)) iris++;
  return iris / (A.size + B.size - iris);
}

export type HasilDuplikat = { duplikat: Sumber; alasan: string } | null;

/**
 * Cari padanan duplikat untuk kandidat di daftar:
 * 1) DOI exact (setelah normalisasi), atau
 * 2) judul sangat mirip (>= 0.92) DAN tahun sama/belum diketahui.
 */
export function cariDuplikat(kandidat: Sumber, daftar: Sumber[]): HasilDuplikat {
  const doi = normalisasiDoi(kandidat.doi);
  if (doi) {
    const sama = daftar.find((s) => normalisasiDoi(s.doi) === doi);
    if (sama) return { duplikat: sama, alasan: `DOI sama (${doi})` };
  }
  for (const s of daftar) {
    if (s.id === kandidat.id) continue;
    const mirip = kemiripanJudul(kandidat.judul, s.judul);
    if (mirip >= 0.92 && (!kandidat.tahun || !s.tahun || kandidat.tahun === s.tahun)) {
      return { duplikat: s, alasan: `Judul hampir sama (${Math.round(mirip * 100)}%)` };
    }
  }
  return null;
}

let penghitungId = 0;
function idBaru(): string {
  penghitungId += 1;
  return `src-${Date.now().toString(36)}${penghitungId.toString(36)}`;
}

function bersihkanNilai(v: string): string {
  return v
    .replace(/^\{+|\}+$/g, "")
    .replace(/\\&/g, "&")
    .replace(/\{|\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Petakan tipe BibTeX ke JenisSumber Uthruha. */
function jenisDariBibtex(tipe: string): JenisSumber {
  switch (tipe.toLowerCase()) {
    case "article":
      return "artikel";
    case "inbook":
    case "incollection":
    case "inproceedings":
      return "bab";
    case "phdthesis":
    case "mastersthesis":
    case "thesis":
      return "skripsi";
    case "online":
    case "misc":
      return "web";
    default:
      return "kitab";
  }
}

/** Parser BibTeX manual: cukup untuk ekspor Zotero/Mendeley/Google Scholar. */
export function parseBibtex(teks: string): Sumber[] {
  const hasil: Sumber[] = [];
  const potongan = teks.split(/(?=^@\w+\s*\{)/m);
  for (const pot of potongan) {
    const kepala = pot.match(/^@(\w+)\s*\{[^,]*,([\s\S]*)\}\s*$/);
    if (!kepala) continue;
    const tipe = kepala[1];
    if (/^(string|preamble|comment)$/i.test(tipe)) continue;
    const isi = kepala[2];
    const field: Record<string, string> = {};
    const reField = /(\w+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^,\n]+)\s*,?/g;
    let f: RegExpExecArray | null;
    while ((f = reField.exec(isi)) !== null) {
      field[f[1].toLowerCase()] = bersihkanNilai(f[2].trim());
    }
    if (!field.title && !field.author) continue;
    const penulisDaftar = field.author
      ? field.author.split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean)
      : [];
    const s: Sumber = {
      ...sumberBaru(jenisDariBibtex(tipe)),
      id: idBaru(),
      penulis: penulisDaftar.join("؛ "),
      penulisDaftar,
      tahun: field.year ?? "",
      judul: field.title ?? "",
      penerbit: field.publisher,
      kota: field.address ?? field.location,
      edisi: field.edition,
      jurnal: field.journal ?? field.booktitle,
      volume: field.volume,
      nomor: field.number,
      halaman: field.pages?.replace(/--/g, "–"),
      doi: field.doi,
      url: field.url,
      isbn: field.isbn,
      issn: field.issn,
      penerjemah: field.translator,
      muhaqqiq: field.editor,
      sumberImpor: "bibtex",
      perluVerifikasi: false,
    };
    hasil.push(s);
  }
  return hasil;
}

/** Parser RIS manual (TY..ER blok). */
export function parseRis(teks: string): Sumber[] {
  const hasil: Sumber[] = [];
  const blok = teks.split(/^ER\s*-.*$/m);
  for (const b of blok) {
    const ambil = (tag: string): string[] => {
      const out: string[] = [];
      const re = new RegExp(`^${tag}\\s*-\\s*(.+)$`, "gm");
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(b)) !== null) out.push(mm[1].trim());
      return out;
    };
    const ty = ambil("TY")[0];
    if (!ty) continue;
    const judul = ambil("TI")[0] ?? ambil("T1")[0] ?? "";
    const penulisDaftar = [...ambil("AU"), ...ambil("A1")];
    if (!judul && penulisDaftar.length === 0) continue;
    const jenis: JenisSumber =
      ty === "JOUR" ? "artikel" : ty === "THES" ? "skripsi" : ty === "ELEC" ? "web" : "kitab";
    hasil.push({
      ...sumberBaru(jenis),
      id: idBaru(),
      penulis: penulisDaftar.join("؛ "),
      penulisDaftar,
      tahun: ambil("Y1")[0]?.slice(0, 4) ?? ambil("PY")[0]?.slice(0, 4) ?? "",
      judul,
      penerbit: ambil("PB")[0],
      kota: ambil("CY")[0],
      jurnal: ambil("JO")[0] ?? ambil("JF")[0],
      volume: ambil("VL")[0],
      nomor: ambil("IS")[0],
      halaman: [ambil("SP")[0], ambil("EP")[0]].filter(Boolean).join("–") || undefined,
      doi: ambil("DO")[0],
      url: ambil("UR")[0],
      isbn: ambil("SN")[0],
      muhaqqiq: ambil("ED")[0],
      sumberImpor: "ris",
      perluVerifikasi: false,
    });
  }
  return hasil;
}

/** Deteksi format dari teks tempelan user. */
export function deteksiFormatImpor(teks: string): "bibtex" | "ris" | null {
  if (/^\s*@\w+\s*\{/m.test(teks)) return "bibtex";
  if (/^TY\s*-/m.test(teks)) return "ris";
  return null;
}

export function parseImpor(teks: string): { format: "bibtex" | "ris"; entri: Sumber[] } | null {
  const format = deteksiFormatImpor(teks);
  if (!format) return null;
  return { format, entri: format === "bibtex" ? parseBibtex(teks) : parseRis(teks) };
}
