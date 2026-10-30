/**
 * Generate Footnote otomatis (fitur Premium, keputusan pemilik 30 Okt 2026).
 *
 * Mahasiswa menaruh kursor di paragraf, satu klik: AI menyusun kalimat
 * kunci dari paragraf itu, mencari rujukan baru di web (OpenAlex,
 * Crossref, Google Books, Open Library — pipeline yang sama dengan uji
 * coba tamu, lengkap dengan verifikasi DOI/ISBN), memilih rujukan dan
 * kalimat tempat footnote menempel, selesai. Tanpa dialog, tanpa memilih
 * paragraf/kalimat/rujukan sendiri.
 *
 * Dua jalur rujukan: MARAJI' dari web umum (jurnal/buku modern, boleh
 * dari mana saja) dan MASADIR dari Turath.io + Shamela (kitab turath,
 * wajib ada untuk sumber primer — keputusan pemilik 30 Okt 2026).
 * Paragraf yang mengutip atau membahas sumber klasik didahulukan
 * masadirnya; selain itu jurnal terverifikasi yang memimpin.
 *
 * Hemat API lewat bank rujukan bersama (lib/server/bank-rujukan.ts):
 *  1. Sidik paragraf persis sama pernah diproses → kalimat kuncinya
 *     dipakai ulang, tanpa panggilan AI.
 *  2. Kalimat kunci pernah dicari → daftar rujukannya dipakai ulang,
 *     tanpa pencarian web.
 *  3. Hasil pencarian baru disimpan ke bank untuk pengguna berikutnya.
 * Yang dibagikan antar-pengguna hanya data bibliografi publik, bukan
 * teks paragraf mahasiswa.
 *
 * Pemanggilan AI selalu lewat kolam dengan premium: true — hanya kunci
 * kolam premium (lalu cadangan umum) yang dipakai di jalur ini.
 */
import { panggilKolam } from "./kolam";
import { cariRujukanTamu, tokenJudul, type RujukanTamu } from "./rujukan";
import {
  cariDiBank,
  cariSidikParagraf,
  simpanKeBank,
  simpanSidikParagraf,
} from "./bank-rujukan";
import { idAcak } from "./store";
import type { Sumber } from "@/lib/engine/cite";
import { cari as cariTurath } from "@/lib/refs/adapters/turath";
import { cari as cariShamela } from "@/lib/refs/adapters/shamela";
import type { RefCandidate } from "@/lib/refs/types";

/** Sama persis dengan pecahKalimatLokal di komponen dialog pasang footnote. */
export function pecahKalimatServer(paragraf: string): string[] {
  return paragraf
    .split(/(?<=[.؟!؛،])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

const SYSTEM_PROMPT = `Anda adalah pengekstrak KALIMAT KUNCI (frasa kunci pencarian) untuk literatur akademik.
Tugas Anda HANYA menyusun kalimat kunci dari SATU paragraf naskah akademik yang diberikan pengguna.
Aturan:
- Keluarkan HANYA JSON valid, tanpa penjelasan, tanpa markdown:
  {"arab":["..."],"indonesia":["..."],"inggris":["..."]}
- Masing-masing 2-4 KALIMAT KUNCI yang menangkap pokok data/klaim paragraf itu. Kalimat kunci adalah frasa utuh 3-7 kata yang cukup khas untuk dicari persis — BUKAN kata tunggal dan BUKAN daftar kata lepas.
- "arab": kalimat kunci dalam HURUF ARAB (bukan transliterasi Latin), istilah/ungkapan akademik Arab untuk konsep yang sama.
- "indonesia": kalimat kunci dalam Bahasa Indonesia.
- "inggris": padanan akademik frasa tersebut dalam Bahasa Inggris (untuk Crossref).
- Jangan mengarang nama penulis, judul, tahun, atau DOI. Hanya kalimat kunci dari teks pengguna.`;

interface KataKunciMentah {
  arab: string[];
  indonesia: string[];
  inggris: string[];
}

function parseKataKunci(raw: string): KataKunciMentah | null {
  try {
    const bersih = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(bersih.slice(bersih.indexOf("{"), bersih.lastIndexOf("}") + 1));
    const arr = (v: unknown) =>
      Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 4) : [];
    const hasil = { arab: arr(json.arab), indonesia: arr(json.indonesia), inggris: arr(json.inggris) };
    return hasil.arab.length || hasil.indonesia.length || hasil.inggris.length ? hasil : null;
  } catch {
    return null;
  }
}

async function kalimatKunciDariAI(paragraf: string): Promise<string[] | null> {
  try {
    const hasil = await panggilKolam({
      sistem: SYSTEM_PROMPT,
      pengguna: paragraf.slice(0, 3000),
      maksToken: 500,
      json: true,
      premium: true,
    });
    if (!hasil.teks) return null;
    const k = parseKataKunci(hasil.teks);
    if (!k) return null;
    const gabung = [...k.arab.slice(0, 2), ...k.indonesia.slice(0, 1), ...k.inggris.slice(0, 1)];
    const unik = [...new Set(gabung.map((x) => x.trim()).filter((x) => x.length >= 8))];
    return unik.length > 0 ? unik.slice(0, 4) : null;
  } catch {
    return null;
  }
}

/** Rujukan hasil web → Sumber proyek. Halaman/jilid mengikuti bawaan
 *  rujukan (keputusan pemilik): rujukan maraji' web tidak membawa nomor
 *  halaman sitasi, sedangkan masadir dari Turath/Shamela justru membawa
 *  jilid dan halaman cetak yang persis — itu nilai utamanya. */
export function rujukanKeSumber(r: RujukanTamu): Sumber {
  return {
    id: idAcak("src-"),
    jenis: r.jenis === "jurnal" ? "artikel" : "kitab",
    penulis: r.penulis.join("، "),
    penulisDaftar: r.penulis,
    tahun: r.tahun ?? "",
    judul: r.judul,
    penerbit: r.jenis === "buku" ? r.wadah || undefined : undefined,
    jurnal: r.jenis === "jurnal" ? r.wadah || undefined : undefined,
    jilid: r.jilid || undefined,
    halaman: r.halaman || undefined,
    doi: r.doi ?? undefined,
    isbn: r.isbn ?? undefined,
    url: r.tautan || undefined,
    sumberImpor: r.asal ? `web-${r.asal}` : "web-generate",
    perluVerifikasi: r.terverifikasi ? undefined : true,
  };
}

/**
 * Jalur MASADIR: cari kitab turath di Turath.io dan Shamela (keputusan
 * pemilik 30 Okt 2026 — untuk masadir dua korpus ini wajib ada; maraji'
 * boleh dari mana saja). Memakai adapter yang sama dengan pencari
 * rujukan ruang kerja. Kueri: kalimat kunci berhuruf Arab; adapter
 * Turath memecahnya sendiri menjadi jendela frasa persis.
 */
async function cariMasadir(kalimatKunci: string[], paragraf: string): Promise<RujukanTamu[]> {
  const arab = kalimatKunci.filter((k) => /[\u0600-\u06FF]/.test(k)).slice(0, 2);
  const kueri = arab.length > 0 ? arab : [pecahKalimatServer(paragraf)[0] ?? ""].filter(Boolean);
  if (kueri.length === 0) return [];

  const frasaToken = kalimatKunci.map((k) => tokenJudul(k)).filter((s) => s.size > 0);
  const tokenInti = frasaToken[0] ? [...frasaToken[0]][0] : undefined;
  const keRujukan = (c: RefCandidate): RujukanTamu | null => {
    const judul = (c.kitab ?? "").trim();
    if (!judul || judul.startsWith("[ !")) return null;
    const token = tokenJudul(judul);
    return {
      id: `ref-${c.source}`,
      jenis: "buku",
      judul,
      penulis: c.penulis ? [c.penulis] : [],
      tahun: c.tahun ? String(c.tahun) : "",
      wadah: c.penerbit ?? "",
      doi: null,
      isbn: null,
      tautan: c.url_sumber ?? "",
      // Turath/Shamela tidak mengirim penerbit/tahun lengkap: catatan
      // kakinya wajib diverifikasi manusia, sama seperti di RefFinder.
      terverifikasi: false,
      skor: c.skor,
      kecocokan: frasaToken.filter((s) => [...s].some((x) => token.has(x))).length,
      inti: tokenInti ? token.has(tokenInti) : false,
      umum: token.size <= 1,
      jilid: c.jilid ? String(c.jilid) : undefined,
      halaman: c.halaman_cetak ? String(c.halaman_cetak) : undefined,
      asal: c.source,
    };
  };

  const hasil: RujukanTamu[] = [];
  const lihat = new Set<string>();
  const panggilan: Promise<RefCandidate[]>[] = [];
  for (const q of kueri) {
    panggilan.push(cariTurath(q, { maks: 4 }), cariShamela(q, { maks: 4 }));
  }
  const semua = await Promise.allSettled(panggilan);
  for (const s of semua) {
    if (s.status !== "fulfilled") continue;
    for (const c of s.value) {
      const r = keRujukan(c);
      if (!r) continue;
      const kunci = `${r.judul.toLowerCase()}|${r.jilid ?? ""}|${r.halaman ?? ""}`;
      if (lihat.has(kunci)) continue;
      lihat.add(kunci);
      hasil.push(r);
    }
  }
  return hasil.sort((a, b) => b.skor - a.skor).slice(0, 5);
}

/** Penanda paragraf yang sedang mengutip/membahas sumber klasik:
 *  kata atribusi, penanda ayat, atau gelar ulama. */
const PENANDA_KLASIK = /(قال|يقول|روى|أخرج|حديث|﴿|قوله تعالى|رحمه الله|رضي الله عنه|عليه السلام|صلى الله عليه)/;

/**
 * Pilih rujukan terbaik.
 * - Ada kandidat masadir (Turath/Shamela) yang kuat → didahulukan:
 *   paragraf bertanda klasik cukup dengan skor sedang, paragraf lain
 *   butuh skor kemiripan tinggi dari halaman kitabnya. Masadir adalah
 *   sumber primer; maraji' tidak menggantikannya.
 * - Selain itu: jurnal terverifikasi didahulukan (daftar maraji' sudah
 *   terurut relevansi), lalu terverifikasi apa pun, lalu peringkat satu.
 */
function pilihRujukan(daftar: RujukanTamu[], paragraf: string): RujukanTamu | null {
  if (daftar.length === 0) return null;
  const masadir = daftar
    .filter((r) => r.asal === "turath" || r.asal === "shamela")
    .sort((a, b) => b.skor - a.skor);
  // Kitab yang NAMANYA disebut persis di paragraf (mis. "في إحياء علوم
  // الدين قال...") adalah sumber yang dimaksud mahasiswa — menangkan
  // tanpa syarat skor.
  const disebut = masadir.find((r) => r.judul.length >= 8 && paragraf.includes(r.judul));
  if (disebut) return disebut;
  const terbaikMasadir = masadir[0];
  if (terbaikMasadir) {
    const klasik = PENANDA_KLASIK.test(paragraf);
    if (terbaikMasadir.skor >= 0.25 || (klasik && terbaikMasadir.skor >= 0.12)) {
      return terbaikMasadir;
    }
  }
  return (
    daftar.find((r) => r.terverifikasi && r.jenis === "jurnal") ??
    daftar.find((r) => r.terverifikasi) ??
    daftar[0] ??
    null
  );
}

/** Pilih kalimat tempat footnote menempel: tumpang-tindih token kalimat
 *  dengan judul rujukan + kalimat kunci. Kalimat tempat kursor berada
 *  didahulukan bila skornya masih dekat dengan yang terbaik — mahasiswa
 *  menaruh kursor di kalimat yang menurutnya memuat data. */
function pilihKalimat(
  paragraf: string,
  rujukan: RujukanTamu,
  kalimatKunci: string[],
  kalimatKursor?: number,
): number {
  const kalimat = pecahKalimatServer(paragraf);
  if (kalimat.length <= 1) return 0;
  const tokenKueri = tokenJudul([rujukan.judul, ...kalimatKunci].join(" "));
  const skor = kalimat.map((k) => {
    const t = tokenJudul(k);
    let sama = 0;
    for (const x of t) if (tokenKueri.has(x)) sama += 1;
    return sama;
  });
  let terbaik = 0;
  for (let i = 1; i < skor.length; i++) if ((skor[i] ?? 0) > (skor[terbaik] ?? 0)) terbaik = i;
  if (
    typeof kalimatKursor === "number" &&
    kalimatKursor >= 0 &&
    kalimatKursor < kalimat.length &&
    (skor[kalimatKursor] ?? 0) > 0 &&
    (skor[kalimatKursor] ?? 0) >= 0.5 * (skor[terbaik] ?? 0)
  ) {
    return kalimatKursor;
  }
  return terbaik;
}

export interface HasilGenerate {
  ketemu: boolean;
  sumber?: Sumber;
  kalimatIdx?: number;
  kalimatKunci: string[];
  dariBank: boolean;
  dariSidik: boolean;
  catatan?: string;
}

export async function generateFootnoteUntukParagraf(opsi: {
  paragraf: string;
  judulProyek?: string;
  kalimatKursor?: number;
}): Promise<HasilGenerate> {
  // Penanda sitasi lama dibuang dari semua pemrosesan (sidik, AI,
  // pencarian, pemilihan kalimat): penanda tidak mengandung tanda baca
  // kalimat, jadi indeks kalimat hasil bersih tetap sejajar dengan
  // paragraf asli tempat klien menanam penanda baru.
  const paragraf = opsi.paragraf.replace(/\[\[ref:[^\]]*\]\]/g, "").trim();

  // 1) Sidik paragraf: paragraf persis sama pernah diproses → tanpa AI.
  const sidik = await cariSidikParagraf(paragraf).catch(() => null);
  let kalimatKunci = sidik?.kalimatKunci ?? null;

  // 2) AI menyusun kalimat kunci dari paragraf (kolam premium).
  if (!kalimatKunci) {
    kalimatKunci = await kalimatKunciDariAI(paragraf);
  }
  // 3) Cadangan tanpa AI: kalimat pertama paragraf sebagai kueri apa adanya.
  if (!kalimatKunci || kalimatKunci.length === 0) {
    const pertama = pecahKalimatServer(paragraf)[0] ?? paragraf.slice(0, 200);
    kalimatKunci = [pertama.slice(0, 200)];
  }

  // 4) Bank rujukan bersama: kalimat kunci ini pernah dicari → pakai ulang.
  const bank = await cariDiBank(kalimatKunci).catch(() => null);
  let daftar = bank?.rujukan ?? null;
  let dariBank = Boolean(bank);

  // 5) Cari baru: maraji' di web umum dan masadir di Turath/Shamela,
  //    berjalan paralel. Hasil gabungan disimpan ke bank + sidik agar
  //    pengguna berikutnya tidak mengulang pencarian apa pun.
  if (!daftar || daftar.length === 0) {
    dariBank = false;
    const [maraji, masadir] = await Promise.all([
      cariRujukanTamu(opsi.judulProyek ?? "", kalimatKunci),
      cariMasadir(kalimatKunci, paragraf).catch(() => [] as RujukanTamu[]),
    ]);
    const lihat = new Set(maraji.map((r) => r.judul.toLowerCase()));
    daftar = [...maraji, ...masadir.filter((r) => !lihat.has(r.judul.toLowerCase()))];
    if (daftar.length > 0) {
      await simpanKeBank(kalimatKunci, daftar).catch(() => undefined);
      if (!sidik) await simpanSidikParagraf(paragraf, kalimatKunci).catch(() => undefined);
    }
  }

  const rujukan = pilihRujukan(daftar ?? [], paragraf);
  if (!rujukan) {
    return {
      ketemu: false,
      kalimatKunci,
      dariBank: false,
      dariSidik: Boolean(sidik),
      catatan:
        "Belum ditemukan rujukan yang cukup relevan untuk paragraf ini. Coba perjelas pokok datanya, atau cari lewat Cari rujukan (AI) lalu pasang dengan dialog manual.",
    };
  }

  return {
    ketemu: true,
    sumber: rujukanKeSumber(rujukan),
    kalimatIdx: pilihKalimat(paragraf, rujukan, kalimatKunci, opsi.kalimatKursor),
    kalimatKunci,
    dariBank,
    dariSidik: Boolean(sidik),
  };
}
