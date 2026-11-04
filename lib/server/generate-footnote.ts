/**
 * Generate Footnote otomatis (fitur Premium, keputusan pemilik 30 Okt 2026).
 *
 * Dua alur:
 *  1. ALUR SELEKSI (Tahap 4, perintah pemilik): mahasiswa MEMBLOK teks di
 *     editor; teks itu utuh menjadi unit pencarian utama. Model lebih
 *     dulu memahami makna kalimat dalam konteks paragrafnya, lalu
 *     kandidat dicari dan dinilai gerbang relevansi. Hasilnya DAFTAR
 *     kandidat (target minimal 3 yang lolos) beserta kalimat isi nyata
 *     dari sumbernya; mahasiswa sendiri yang memilih yang dipasang.
 *     Tidak ada pemasangan otomatis pada alur ini.
 *  2. ALUR KURSOR (lama, tetap berjalan): mahasiswa menaruh kursor di
 *     paragraf, satu klik: AI menyusun kalimat kunci dari paragraf itu,
 *     mencari rujukan baru di web (OpenAlex, Crossref, Google Books,
 *     Open Library — pipeline yang sama dengan uji coba tamu, lengkap
 *     dengan verifikasi DOI/ISBN), memilih SATU rujukan yang lolos
 *     gerbang dan kalimat tempat footnote menempel.
 *
 * Semua kandidat dari kedua jalur, maraji' maupun masadir, melewati
 * gerbang relevansi yang sama, dan gerbang itu gagal tertutup: model
 * yang tidak bisa menilai menahan kandidat, bukan meloloskannya.
 * Kandidat tertahan hanya dipasang lewat pasangFootnoteDisetujui
 * dengan sidik terbitan server untuk kandidat yang persis ditampilkan.
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
import { createHash } from "node:crypto";
import { panggilKolam } from "./kolam";
import { cariRujukanTamu, tokenJudul, type RujukanTamu } from "./rujukan";
import {
  cariDiBank,
  cariSidikParagraf,
  simpanKeBank,
  simpanSidikParagraf,
} from "./bank-rujukan";
import { ambil, idAcak, simpan } from "./store";
import { getBidang } from "@/lib/content/bidang";
import {
  bidangMilikProyek,
  deteksiBidangSumber,
  nilaiRelevansi,
  type KonteksProyek,
} from "./gerbang-relevansi";
import type { Sumber } from "@/lib/engine/cite";
import { cari as cariTurath, cariKonsep as cariKonsepTurath } from "@/lib/refs/adapters/turath";
import { cari as cariShamela } from "@/lib/refs/adapters/shamela";
import { ekstrakKonsep } from "@/lib/refs/konsep";
import { bersihkanKutipan } from "@/lib/refs/score";
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

type OpsiKolamTerusan = {
  pribadi?: { userId: string; gemini?: string; groq?: string };
  wajibPribadi?: boolean;
  pinjaman?: { userId: string; gemini?: string; groq?: string }[];
};

async function kalimatKunciDariAI(paragraf: string, kolam?: OpsiKolamTerusan): Promise<string[] | null> {
  try {
    const hasil = await panggilKolam({
      sistem: SYSTEM_PROMPT,
      pengguna: paragraf.slice(0, 3000),
      maksToken: 500,
      json: true,
      premium: true,
      pribadi: kolam?.pribadi,
      wajibPribadi: kolam?.wajibPribadi,
      pinjaman: kolam?.pinjaman,
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

/* ------------------------------------------------------------------ */
/* Analisis makna (Tahap 4, poin A8): model membaca paragraf dan        */
/* kalimat yang DIBLOK penulis, merumuskan pokok bahasan paragraf,      */
/* klaim kalimat itu, dan dukungan rujukan yang dibutuhkannya, lalu     */
/* menyusun frasa pencarian DARI MAKNA tersebut. Unit pencarian utama   */
/* tetap teks seleksi itu sendiri utuh (perintah pemilik), frasa makna  */
/* hanya pendamping kueri. Bila model gagal, frasa makna kosong dan     */
/* pencarian berjalan dengan seleksi apa adanya — dinyatakan jujur      */
/* lewat maknaDariModel pada hasil.                                     */
/* ------------------------------------------------------------------ */

const SISTEM_MAKNA = `Anda adalah pemaham makna naskah akademik berbahasa Arab.
Tugas Anda membaca SATU paragraf naskah dan SATU kalimat di dalamnya yang diblok penulis, lalu merumuskan makna dan kebutuhan rujukannya.
Aturan:
- Keluarkan HANYA JSON valid, tanpa penjelasan, tanpa markdown:
  {"topikParagraf":"...","klaim":"...","kebutuhan":"...","arab":["..."],"indonesia":["..."],"inggris":["..."]}
- "topikParagraf": pokok bahasan paragraf itu, satu frasa Bahasa Indonesia.
- "klaim": apa yang sebenarnya dinyatakan kalimat yang diblok, satu sampai dua kalimat Bahasa Indonesia. Tangkap maknanya, jangan menyalin bunyi kalimatnya.
- "kebutuhan": jenis dukungan rujukan yang dibutuhkan klaim itu (mis. data statistik, definisi istilah, pendapat ulama, hasil penelitian terdahulu, dasar hukum), satu kalimat Bahasa Indonesia.
- "arab", "indonesia", "inggris": frasa pencarian 3-7 kata yang dirumuskan dari MAKNA klaim dan kebutuhannya (istilah akademik yang lazim dipakai literatur bidang itu), arab 2-3 frasa, indonesia 1-2, inggris 1-2. Bukan potongan kata dari kalimatnya.
- Jangan mengarang nama penulis, judul, tahun, atau DOI. Hanya makna dan frasa dari teks pengguna.`;

export interface AnalisisMakna {
  topikParagraf: string;
  klaim: string;
  kebutuhan: string;
  /** Frasa pencarian gabungan dari makna (Arab lebih dulu). */
  frasa: string[];
}

interface MaknaMentah {
  topikParagraf: string;
  klaim: string;
  kebutuhan: string;
  arab: string[];
  indonesia: string[];
  inggris: string[];
}

function parseMakna(raw: string): MaknaMentah | null {
  try {
    const bersih = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(bersih.slice(bersih.indexOf("{"), bersih.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const teks = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 400) : "");
    const arr = (v: unknown) =>
      Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 4) : [];
    const hasil: MaknaMentah = {
      topikParagraf: teks(json.topikParagraf),
      klaim: teks(json.klaim),
      kebutuhan: teks(json.kebutuhan),
      arab: arr(json.arab),
      indonesia: arr(json.indonesia),
      inggris: arr(json.inggris),
    };
    return hasil.klaim || hasil.arab.length || hasil.indonesia.length ? hasil : null;
  } catch {
    return null;
  }
}

async function analisisMaknaDariAI(
  paragraf: string,
  seleksi: string,
  kolam?: OpsiKolamTerusan,
): Promise<AnalisisMakna | null> {
  try {
    const hasil = await panggilKolam({
      sistem: SISTEM_MAKNA,
      pengguna: `Paragraf:\n${paragraf.slice(0, 3000)}\n\nKalimat yang diblok penulis:\n${seleksi}`,
      maksToken: 600,
      json: true,
      premium: true,
      pribadi: kolam?.pribadi,
      wajibPribadi: kolam?.wajibPribadi,
      pinjaman: kolam?.pinjaman,
    });
    if (!hasil.teks) return null;
    const m = parseMakna(hasil.teks);
    if (!m) return null;
    const gabung = [...m.arab.slice(0, 2), ...m.indonesia.slice(0, 1), ...m.inggris.slice(0, 1)];
    const unik = [...new Set(gabung.map((x) => x.trim()).filter((x) => x.length >= 8))];
    return {
      topikParagraf: m.topikParagraf,
      klaim: m.klaim,
      kebutuhan: m.kebutuhan,
      frasa: unik.slice(0, 4),
    };
  } catch {
    return null;
  }
}

/**
 * Kalimat isi kandidat: kalimat dari isi nyata sumber (abstrak atau
 * cuplikan teks) yang paling menyentuh teks acuan. Yang ditampilkan
 * selalu teks sumber apa adanya; fungsi ini hanya MEMILIH kalimatnya.
 * Undefined bila sumber tidak menyediakan isi, atau tidak ada kalimat
 * isinya yang menyentuh acuan sama sekali — kandidat lalu ditandai
 * tanpa kalimat isi, tidak diisi karangan.
 */
export function pilihKalimatIsi(cuplikan: string | undefined, acuan: string): string | undefined {
  const bersih = (cuplikan ?? "").replace(/\s+/g, " ").trim();
  if (!bersih) return undefined;
  if (bersih.length <= 420) return bersih;
  const kalimat = pecahKalimatServer(bersih);
  if (kalimat.length <= 1) return bersih.slice(0, 420);
  const tokenAcuan = tokenJudul(acuan);
  if (tokenAcuan.size === 0) return undefined;
  let terbaik: string | undefined;
  let skorTerbaik = 0;
  for (const k of kalimat) {
    const t = tokenJudul(k);
    let sama = 0;
    for (const x of t) if (tokenAcuan.has(x)) sama += 1;
    if (sama > skorTerbaik) {
      skorTerbaik = sama;
      terbaik = k;
    }
  }
  return terbaik ? terbaik.slice(0, 500) : undefined;
}

/** Indeks kalimat paragraf yang memuat teks seleksi (untuk pesan hasil
 *  dan cadangan penanaman per kalimat bila posisi seleksi sudah basi). */
export function indeksKalimatSeleksi(paragraf: string, seleksi: string): number {
  const kalimat = pecahKalimatServer(paragraf);
  if (kalimat.length <= 1) return 0;
  const normal = (s: string) => s.replace(/\s+/g, " ").trim();
  const target = normal(seleksi);
  for (let i = 0; i < kalimat.length; i++) {
    const k = normal(kalimat[i] ?? "");
    if (k && (target.includes(k) || k.includes(target))) return i;
  }
  const tokenTarget = tokenJudul(target);
  let terbaik = 0;
  let skorTerbaik = -1;
  kalimat.forEach((k, i) => {
    const t = tokenJudul(k);
    let sama = 0;
    for (const x of t) if (tokenTarget.has(x)) sama += 1;
    if (sama > skorTerbaik) {
      skorTerbaik = sama;
      terbaik = i;
    }
  });
  return terbaik;
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
async function cariMasadir(
  kalimatKunci: string[],
  paragraf: string,
  judulProyek?: string,
): Promise<RujukanTamu[]> {
  const arab = kalimatKunci.filter((k) => /[\u0600-\u06FF]/.test(k)).slice(0, 2);
  const kueri = arab.length > 0 ? arab : [pecahKalimatServer(paragraf)[0] ?? ""].filter(Boolean);
  // Judul proyek kerap menyebut kitabnya persis ("... في إحياء علوم
  // الدين"): ekor sesudah "في" terakhir menjadi kueri judul kitab.
  const ekorJudul = (judulProyek ?? "").split(/\s+في\s+/).pop()?.trim() ?? "";
  if (
    ekorJudul &&
    /[\u0600-\u06FF]/.test(ekorJudul) &&
    ekorJudul.split(/\s+/).length >= 2 &&
    ekorJudul.split(/\s+/).length <= 6 &&
    !kueri.includes(ekorJudul)
  ) {
    kueri.push(ekorJudul);
  }
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
      // Transkrip seri pelajaran (judul mulai دروس/سلسلة/محاضرات/لقاءات
      // atau pola "شرح كذا - فلان") mengutip teks klasik kata demi kata
      // sehingga skor cuplikannya jenuh — turunkan agar kitab klasik
      // penyusun asli yang menang, bukan transkrip pengajian. (Tanpa \b:
      // batas kata JS tidak berlaku untuk huruf Arab.)
      skor:
        ["دروس ", "سلسلة ", "محاضرات ", "لقاءات "].some((p) => judul.startsWith(p)) || judul.includes(" - ")
          ? c.skor * 0.45
          : c.skor,
      kecocokan: frasaToken.filter((s) => [...s].some((x) => token.has(x))).length,
      inti: tokenInti ? token.has(tokenInti) : false,
      umum: token.size <= 1,
      // Teks halaman yang benar-benar cocok dari korpus: kalimat isi
      // nyata kandidat masadir (Tahap 4), bukan karangan.
      cuplikan: c.teks_kutipan ? bersihkanKutipan(c.teks_kutipan).slice(0, 900) || undefined : undefined,
      jilid: c.jilid ? String(c.jilid) : undefined,
      halaman: c.halaman_cetak ? String(c.halaman_cetak) : undefined,
      konsepCocok: c.konsep_cocok?.length ?? 0,
      asal: c.source,
    };
  };

  const hasil: RujukanTamu[] = [];
  const panggilan: Promise<RefCandidate[]>[] = [];
  for (const q of kueri) {
    panggilan.push(cariTurath(q, { maks: 4 }), cariShamela(q, { maks: 4 }));
  }
  // Jalur konsep Turath: halaman dinilai dari konsep yang muncul di
  // JUDUL BAB kitab — kitab yang memang membaktikan bab untuk topik ini
  // (masadir sejati) naik, kitab yang hanya menyebutnya sepintas turun.
  // Konsep = kalimat kunci Arab pendek (dari AI) + ekstraksi aturan.
  const konsep = [
    ...kalimatKunci.filter((k) => /[\u0600-\u06FF]/.test(k) && k.split(/\s+/).length <= 6),
    ...ekstrakKonsep(paragraf),
  ].slice(0, 8);
  if (konsep.length > 0) {
    panggilan.push(cariKonsepTurath(konsep, { maks: 6 }).catch(() => [] as RefCandidate[]));
  }
  const semua = await Promise.allSettled(panggilan);
  const indeks = new Map<string, number>();
  for (const s of semua) {
    if (s.status !== "fulfilled") continue;
    for (const c of s.value) {
      const r = keRujukan(c);
      if (!r) continue;
      const kunci = `${r.judul.toLowerCase()}|${r.jilid ?? ""}|${r.halaman ?? ""}`;
      const ada = indeks.get(kunci);
      if (ada !== undefined) {
        // Halaman yang sama dari jalur lain (kata vs konsep): gabungkan
        // kekuatan penilaiannya, jangan dibuang salah satu.
        const lama = hasil[ada]!;
        lama.konsepCocok = Math.max(lama.konsepCocok ?? 0, r.konsepCocok ?? 0);
        lama.skor = Math.max(lama.skor, r.skor);
        continue;
      }
      indeks.set(kunci, hasil.length);
      hasil.push(r);
    }
  }
  // Kandidat yang judul kitabnya memuat frasa judul dari judul proyek
  // (kitab yang sedang diteliti mahasiswa) didahulukan tanpa memandang
  // skor kemiripan cuplikan: cuplikan isi kitab jarang memuat judulnya
  // sendiri, jadi jalur skor murni menenggelamkan kitab yang dimaksud.
  const cocokJudul = ekorJudul
    ? hasil
        .filter((r) => r.judul.length >= 8 && (r.judul.includes(ekorJudul) || ekorJudul.includes(r.judul)))
        .sort((a, b) => b.skor - a.skor)
    : [];
  // Kandidat jalur konsep disisihkan slotnya sendiri: skor cuplikannya
  // kalah dari skor jalur kata yang jenuh di angka 1, padahal penilaian
  // judul-babnya yang membuat mereka berharga.
  const dariKonsep = hasil
    .filter((r) => (r.konsepCocok ?? 0) > 0 && !cocokJudul.includes(r))
    .sort((a, b) => (b.konsepCocok ?? 0) - (a.konsepCocok ?? 0) || b.skor - a.skor);
  const sisa = hasil
    .filter((r) => !cocokJudul.includes(r) && !dariKonsep.includes(r))
    .sort((a, b) => b.skor - a.skor);
  return [...cocokJudul.slice(0, 3), ...dariKonsep.slice(0, 3), ...sisa].slice(0, 8);
}

/** Penanda paragraf yang sedang mengutip/membahas sumber klasik:
 *  kata atribusi, penanda ayat, atau gelar ulama. */
const PENANDA_KLASIK = /(قال|يقول|روى|أخرج|حديث|﴿|قوله تعالى|رحمه الله|رضي الله عنه|عليه السلام|صلى الله عليه)/;

/**
 * Pilih rujukan terbaik.
 * - Kitab yang disebut namanya di paragraf/judul proyek selalu menang.
 * - Paragraf bertanda klasik: masadir teratas menang (penilaian judul
 *   bab 2+ konsep, atau skor cuplikan sedang saja cukup).
 * - Paragraf lain: jurnal terverifikasi didahulukan, lalu terverifikasi
 *   apa pun; masadir baru menang bila tak ada maraji' terverifikasi.
 */
function pilihRujukan(daftar: RujukanTamu[], paragraf: string, judulProyek?: string): RujukanTamu | null {
  if (daftar.length === 0) return null;
  const masadir = daftar
    .filter((r) => r.asal === "turath" || r.asal === "shamela")
    .sort((a, b) => b.skor - a.skor || (b.konsepCocok ?? 0) - (a.konsepCocok ?? 0));
  // Kitab yang NAMANYA disebut persis di paragraf atau judul proyek
  // (mis. "في إحياء علوم الدين قال...") adalah sumber yang dimaksud
  // mahasiswa — menangkan tanpa syarat skor.
  const konteks = `${paragraf} ${judulProyek ?? ""}`;
  const disebut = masadir.find((r) => r.judul.length >= 8 && konteks.includes(r.judul));
  if (disebut) return disebut;
  const terbaikMasadir = masadir[0];
  // Masadir hanya menang pada paragraf yang memang bertanda klasik
  // (mengutip/mengatribusi sumber lama). Skor cuplikan Turath jenuh di
  // angka 1 untuk korpus besar mana pun, jadi tanpa penanda klasik ia
  // BUKAN bukti bahwa paragraf ini butuh kitab — paragraf modern tetap
  // dilayani maraji'.
  const klasik = PENANDA_KLASIK.test(paragraf);
  if (terbaikMasadir && klasik && ((terbaikMasadir.konsepCocok ?? 0) >= 2 || terbaikMasadir.skor >= 0.12)) {
    return terbaikMasadir;
  }
  const jurnal = daftar.find((r) => r.terverifikasi && r.jenis === "jurnal");
  if (jurnal) return jurnal;
  const terverifikasi = daftar.find((r) => r.terverifikasi);
  if (terverifikasi) return terverifikasi;
  // Tak ada maraji' terverifikasi: halaman kitab nyata lebih baik
  // daripada temuan web yang belum terverifikasi.
  if (terbaikMasadir && terbaikMasadir.skor >= 0.5) return terbaikMasadir;
  return daftar[0] ?? null;
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

/** Satu kandidat yang LOLOS gerbang pada mode seleksi, siap dipilih
 *  mahasiswa di panel kandidat. */
export interface KandidatHasil {
  sumber: Sumber;
  /** Kalimat isi nyata dari sumbernya yang cocok dengan teks yang
   *  diblok. Tidak ada (undefined) bila sumber tidak menyediakan isi
   *  atau tidak ada kalimat isinya yang menyentuh teks tersebut. */
  kalimatIsi?: string;
  /** True bila kandidat memang tidak punya kalimat isi untuk
   *  ditampilkan — klien wajib menyatakannya apa adanya. */
  tanpaKalimatIsi?: boolean;
  /** Skor penilaian model 0..100 bila model menilai kandidat ini. */
  skorModel?: number;
  /** True bila kandidat artikel jurnal tanpa nomor halaman. */
  halamanKosong?: boolean;
}

/** Satu kandidat TERTAHAN gerbang pada mode seleksi atau alur lama.
 *  Hanya bisa dipasang lewat pasangFootnoteDisetujui dengan sidiknya. */
export interface TertahanHasil {
  sumber: Sumber;
  /** Sidik kandidat yang diterbitkan server untuk kandidat ini. */
  sidik: string;
  bidangSumber: string;
  alasan: string;
  kalimatIsi?: string;
  tanpaKalimatIsi?: boolean;
  halamanKosong?: boolean;
}

export interface HasilGenerate {
  ketemu: boolean;
  sumber?: Sumber;
  kalimatIdx?: number;
  kalimatKunci: string[];
  dariBank: boolean;
  dariSidik: boolean;
  catatan?: string;
  /** Mode seleksi: kandidat yang lolos gerbang (target minimal 3 bila
   *  tersedia), urut penilaian. Mahasiswa memilih sendiri; tidak ada
   *  pemasangan otomatis. */
  kandidat?: KandidatHasil[];
  /** Mode seleksi: kandidat tertahan gerbang yang masih boleh dipasang
   *  paksa lewat sidiknya (maksimal 3 ditampilkan). */
  tertahan?: TertahanHasil[];
  /** Mode seleksi: rumusan makna kalimat yang diblok. dariModel false
   *  berarti analisis model tidak tersedia dan pencarian berjalan
   *  dengan teks seleksi apa adanya. */
  makna?: {
    topikParagraf: string;
    klaim: string;
    kebutuhan: string;
    dariModel: boolean;
  };
  /** Kandidat terbaik tertahan gerbang relevansi (alur kursor lama):
   *  klien menampilkan alasannya dan menanyakan pengguna; pengguna
   *  memasang persis kandidat ini lewat sidiknya
   *  (pasangFootnoteDisetujui), bukan dengan menjalankan ulang jalur. */
  perluKonfirmasi?: {
    sumber: Sumber;
    kalimatIdx: number;
    bidangSumber: string;
    bidangProyek: string;
    alasan: string;
    sidik: string;
  };
  /** Penolakan gerbang yang dicatat selama mencoba kandidat, urut
   *  pemeriksaan. Untuk audit dan pesan jujur ke pengguna. */
  penolakan?: { judul: string; alasan: string }[];
}

/* ------------------------------------------------------------------ */
/* Sidik kandidat tertahan (Tahap 4, menutup temuan S2 + R1 telaah      */
/* komit koreksi). Persetujuan pengguna terikat pada kandidat yang      */
/* benar-benar ia lihat: server menerbitkan sidik (hash isi kandidat)   */
/* dan mencatatnya di store atas nama pemiliknya. Pemasangan paksa      */
/* hanya memasang kandidat yang sidiknya tercatat DAN cocok dengan      */
/* data kandidat yang dikirim balik — jalur tidak dijalankan ulang,     */
/* dan paksaKonfirmasi tanpa sidik tidak berlaku lagi.                  */
/* ------------------------------------------------------------------ */

function hashSidik(teks: string): string {
  return createHash("sha256").update(teks).digest("hex").slice(0, 32);
}

/** Tupel kanonis kandidat dari bentuk RujukanTamu (sisi server). */
function tupelDariRujukan(r: RujukanTamu): string {
  return [
    r.judul.trim(),
    r.penulis.join("، "),
    r.tahun ?? "",
    r.wadah ?? "",
    r.doi ?? "",
    r.isbn ?? "",
    r.halaman ?? "",
    r.jilid ?? "",
    r.jenis,
  ].join("\n");
}

/** Tupel kanonis yang sama dari bentuk Sumber (yang dilihat klien).
 *  Pemetaan jenis dan wadah meniru rujukanKeSumber persis. */
function tupelDariSumber(s: Sumber): string {
  return [
    (s.judul ?? "").trim(),
    s.penulis ?? "",
    s.tahun ?? "",
    s.jurnal ?? s.penerbit ?? "",
    s.doi ?? "",
    s.isbn ?? "",
    s.halaman ?? "",
    s.jilid ?? "",
    s.jenis === "artikel" ? "jurnal" : "buku",
  ].join("\n");
}

export function sidikKandidatDariRujukan(r: RujukanTamu): string {
  return hashSidik(tupelDariRujukan(r));
}

export function sidikKandidatDariSumber(s: Sumber): string {
  return hashSidik(tupelDariSumber(s));
}

const UMUR_SIDIK_MS = 24 * 60 * 60 * 1000;

/** Catat sidik kandidat tertahan atas nama pemiliknya agar pemasangan
 *  paksa nanti bisa diverifikasi. Kegagalan mencatat tidak menggagalkan
 *  generate; ia hanya membuat sidik itu tidak bisa dipakai memasang. */
async function terbitkanSidik(sidik: string, pemilik: string): Promise<void> {
  if (!pemilik) return;
  await simpan("tembolok", {
    id: `konf:${sidik}`,
    tipe: "konf",
    pemilik,
    dibuat: new Date().toISOString(),
  }).catch(() => undefined);
}

/**
 * Pasang PERSIS kandidat tertahan yang disetujui pengguna (Tahap 4).
 * Tidak ada pencarian ulang dan tidak ada penilaian ulang: yang
 * dipasang adalah data kandidat yang ditampilkan server sebelumnya,
 * diverifikasi lewat sidik terbitan server + kecocokan isi data.
 * Sumber hasil selalu bertanda perluVerifikasi.
 */
export async function pasangFootnoteDisetujui(opsi: {
  sidik: string;
  kandidat: Sumber;
  paragraf: string;
  kalimatIdx?: number;
  /** Id pengguna pemilik sidik (dari sesi server, bukan dari klien). */
  pemilik: string;
}): Promise<HasilGenerate> {
  const gagal = (catatan: string): HasilGenerate => ({
    ketemu: false,
    kalimatKunci: [],
    dariBank: false,
    dariSidik: false,
    catatan,
  });
  const sidik = (opsi.sidik ?? "").trim();
  if (!sidik || !opsi.kandidat || typeof opsi.kandidat.judul !== "string" || !opsi.kandidat.judul.trim()) {
    return gagal("Data kandidat yang disetujui tidak lengkap. Minta generate ulang, lalu setujui kandidat yang ditampilkan.");
  }
  if (sidikKandidatDariSumber(opsi.kandidat) !== sidik) {
    return gagal(
      "Sidik kandidat tidak cocok dengan data kandidat yang dikirim balik, jadi pemasangan dibatalkan. Minta generate ulang, lalu setujui kandidat yang ditampilkan.",
    );
  }
  const rec = (await ambil("tembolok", `konf:${sidik}`).catch(() => null)) as
    | { pemilik?: string; dibuat?: string }
    | null;
  if (!rec || rec.pemilik !== opsi.pemilik) {
    return gagal(
      "Kandidat ini tidak tercatat sebagai kandidat tertahan yang diterbitkan server untuk akun Anda. Minta generate ulang, lalu setujui dari panel yang baru.",
    );
  }
  const dibuat = Date.parse(rec.dibuat ?? "");
  if (Number.isFinite(dibuat) && Date.now() - dibuat > UMUR_SIDIK_MS) {
    return gagal("Persetujuan kandidat ini sudah kedaluwarsa (lebih dari 24 jam). Minta generate ulang.");
  }
  const paragraf = opsi.paragraf.replace(/\[\[ref:[^\]]*\]\]/g, "").trim();
  const jumlahKalimat = Math.max(1, pecahKalimatServer(paragraf).length);
  const kalimatIdx = Math.min(
    Math.max(0, typeof opsi.kalimatIdx === "number" && Number.isFinite(opsi.kalimatIdx) ? Math.floor(opsi.kalimatIdx) : 0),
    jumlahKalimat - 1,
  );
  const sumber: Sumber = { ...opsi.kandidat, perluVerifikasi: true };
  return {
    ketemu: true,
    sumber,
    kalimatIdx,
    kalimatKunci: [],
    dariBank: false,
    dariSidik: false,
    catatan:
      "Dipasang persis kandidat yang Anda setujui pada panel konfirmasi, tanpa pencarian atau penilaian ulang. Sumber ditandai perlu verifikasi.",
  };
}

/** Batas pemeriksaan gerbang per generate (alur kursor lama): kandidat
 *  yang dinilai dibatasi agar satu klik tidak berubah menjadi belasan
 *  panggilan. Mode seleksi memeriksa lebih banyak karena panelnya
 *  menargetkan minimal 3 kandidat lolos. */
const MAKS_KANDIDAT_GERBANG = 5;
const MAKS_KANDIDAT_SELEKSI = 10;
/** Batas PENILAIAN MODEL per generate: hanya kandidat yang akan
 *  dipasang atau yang teratas yang dinilai model; penolakan aturan
 *  keras tidak memakai jatah ini. Mode seleksi menilai lebih banyak
 *  agar panel kandidat minimal 3 bisa terisi bila tersedia. */
const MAKS_PENILAIAN_MODEL = 3;
const MAKS_PENILAIAN_SELEKSI = 8;
/** Target kandidat lolos yang dikumpulkan mode seleksi. */
const TARGET_KANDIDAT_SELEKSI = 5;

function apakahMasadir(r: RujukanTamu): boolean {
  return r.asal === "turath" || r.asal === "shamela";
}

interface NilaiKandidat {
  rujukan: RujukanTamu;
  kalimatIdx: number;
  skorModel?: number;
}

interface TertahanKandidat {
  rujukan: RujukanTamu;
  kalimatIdx: number;
  bidangSumber: string;
  alasan: string;
}

export async function generateFootnoteUntukParagraf(opsi: {
  paragraf: string;
  judulProyek?: string;
  kalimatKursor?: number;
  /** Bidang proyek (id dari lib/content/bidang.ts) untuk gerbang relevansi. */
  bidangId?: string;
  /** Topik proyek berbahasa Arab untuk konteks gerbang relevansi. */
  topikAr?: string;
  /** Teks yang DIBLOK mahasiswa di editor (Tahap 4). Bila terisi, alur
   *  berjalan pada mode seleksi: teks ini utuh menjadi unit pencarian
   *  utama dan hasilnya daftar kandidat untuk dipilih mahasiswa. */
  seleksi?: string;
  /** Id pengguna dari sesi server; pemilik sidik kandidat tertahan. */
  pemilik?: string;
  /** BYOK: kunci pribadi pemanggil (wajib untuk akun mahasiswa). */
  kolam?: OpsiKolamTerusan;
}): Promise<HasilGenerate> {
  // Penanda sitasi lama dibuang dari semua pemrosesan (sidik, AI,
  // pencarian, pemilihan kalimat): penanda tidak mengandung tanda baca
  // kalimat, jadi indeks kalimat hasil bersih tetap sejajar dengan
  // paragraf asli tempat klien menanam penanda baru.
  const paragraf = opsi.paragraf.replace(/\[\[ref:[^\]]*\]\]/g, "").trim();
  const seleksi = (opsi.seleksi ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
  const modeSeleksi = seleksi.length > 0;

  /* ---- Langkah makna (mode seleksi) dan kalimat kunci ---- */
  let makna: AnalisisMakna | null = null;
  let kalimatKunci: string[];
  let dariCadangan = false;
  // Frasa yang boleh masuk bank bersama: HANYA frasa makna dari model.
  // Teks seleksi adalah teks mahasiswa dan tidak pernah disimpan ke
  // bank (bank dibagikan antar pengguna), sama seperti aturan jalur
  // cadangan pada alur lama.
  let frasaBank: string[] | null = null;
  // Sidik paragraf alur kursor (alur lama); null di mode seleksi.
  let sidikLama: Awaited<ReturnType<typeof cariSidikParagraf>> = null;

  if (modeSeleksi) {
    makna = await analisisMaknaDariAI(paragraf, seleksi, opsi.kolam);
    if (makna && makna.frasa.length > 0) {
      frasaBank = makna.frasa;
      kalimatKunci = [seleksi, ...makna.frasa.filter((f) => f !== seleksi)];
    } else {
      kalimatKunci = [seleksi];
    }
  } else {
    // 1) Sidik paragraf: paragraf persis sama pernah diproses → tanpa AI.
    const sidik = await cariSidikParagraf(paragraf).catch(() => null);
    let kunci = sidik?.kalimatKunci ?? null;

    // 2) AI menyusun kalimat kunci dari paragraf (kolam premium).
    if (!kunci) {
      kunci = await kalimatKunciDariAI(paragraf, opsi.kolam);
    }
    // 3) Cadangan tanpa AI: kalimat pertama paragraf sebagai kueri apa
    //    adanya. Potongan ini TEKS ASLI mahasiswa: boleh dipakai sesaat
    //    sebagai kueri pencarian, tetapi tidak boleh disimpan ke bank
    //    maupun sidik, karena bank dibagikan antar pengguna.
    if (!kunci || kunci.length === 0) {
      const pertama = pecahKalimatServer(paragraf)[0] ?? paragraf.slice(0, 200);
      kunci = [pertama.slice(0, 200)];
      dariCadangan = true;
    }
    kalimatKunci = kunci;
    frasaBank = dariCadangan ? null : kunci;

    // Sidik paragraf disimpan di langkah pencarian (alur lama).
    sidikLama = sidik;
  }

  /* ---- Daftar kandidat: bank bersama, atau cari baru ---- */
  const bank = frasaBank ? await cariDiBank(frasaBank).catch(() => null) : null;
  let daftar = bank?.rujukan ?? null;
  let dariBank = Boolean(bank);

  if (!daftar || daftar.length === 0) {
    dariBank = false;
    const [maraji, masadir] = await Promise.all([
      cariRujukanTamu(opsi.judulProyek ?? "", kalimatKunci),
      cariMasadir(kalimatKunci, paragraf, opsi.judulProyek).catch(() => [] as RujukanTamu[]),
    ]);
    const lihat = new Set(maraji.map((r) => r.judul.toLowerCase()));
    daftar = [...maraji, ...masadir.filter((r) => !lihat.has(r.judul.toLowerCase()))];
    if (daftar.length > 0 && frasaBank) {
      await simpanKeBank(frasaBank, daftar).catch(() => undefined);
      if (!modeSeleksi && !sidikLama) {
        await simpanSidikParagraf(paragraf, kalimatKunci).catch(() => undefined);
      }
    }
  }

  const semua = daftar ?? [];
  const pertama = pilihRujukan(semua, paragraf, opsi.judulProyek);
  if (!pertama) {
    return {
      ketemu: false,
      kalimatKunci,
      dariBank: false,
      dariSidik: false,
      catatan:
        "Belum ditemukan rujukan yang cukup relevan untuk teks ini. Coba perjelas pokok datanya, atau cari lewat Cari rujukan (AI) lalu pasang dengan dialog manual.",
      ...(modeSeleksi
        ? {
            makna: {
              topikParagraf: makna?.topikParagraf ?? "",
              klaim: makna?.klaim ?? "",
              kebutuhan: makna?.kebutuhan ?? "",
              dariModel: Boolean(makna),
            },
          }
        : {}),
    };
  }

  /* ---- Gerbang relevansi: SATU jalur untuk maraji' dan masadir ----
   * (Tahap 4: jalur masadir tidak lagi memintas gerbang, menutup
   * catatan A8 audit kode dan R3 telaah komit koreksi. Urutan pilihan
   * pilihRujukan tetap memimpin, tetapi setiap kandidat, termasuk
   * pilihan masadir untuk paragraf klasik, dinilai gerbang lebih dulu
   * sebelum boleh dipasang atau ditawarkan.) */
  const bidang = opsi.bidangId ? getBidang(opsi.bidangId) : null;
  const konteks: KonteksProyek = {
    bidangId: opsi.bidangId ?? "",
    bidangLabel: bidang ? `${bidang.labelId} (${bidang.labelAr})` : "",
    judulProyek: opsi.judulProyek ?? "",
    topik: opsi.topikAr ?? "",
  };
  const bidangProyekTampil = konteks.bidangLabel || konteks.bidangId || "proyek Anda";
  const urutan = [
    pertama,
    ...semua.filter((r) => r !== pertama).sort((a, b) => b.skor - a.skor),
  ];
  const maksPeriksa = modeSeleksi ? MAKS_KANDIDAT_SELEKSI : MAKS_KANDIDAT_GERBANG;
  const maksPenilaian = modeSeleksi ? MAKS_PENILAIAN_SELEKSI : MAKS_PENILAIAN_MODEL;
  const targetLolos = modeSeleksi ? TARGET_KANDIDAT_SELEKSI : 1;
  const maknaKalimat = makna
    ? [makna.klaim, makna.kebutuhan ? `Dukungan yang dibutuhkan: ${makna.kebutuhan}` : ""]
        .filter(Boolean)
        .join(" ")
    : "";

  const penolakan: { judul: string; alasan: string }[] = [];
  const lolosList: NilaiKandidat[] = [];
  const tertahanList: TertahanKandidat[] = [];
  let penilaianModel = 0;
  let jatahHabisAdaSisa = false;
  let adaTidakDinilai = false;

  for (let i = 0; i < urutan.length && i < maksPeriksa; i++) {
    const kandidat = urutan[i]!;
    const kalimatIdxKandidat = modeSeleksi
      ? indeksKalimatSeleksi(paragraf, seleksi)
      : pilihKalimat(paragraf, kandidat, kalimatKunci, opsi.kalimatKursor);

    // Footnote jurnal tanpa halaman tidak boleh terpasang diam-diam:
    // tertahan selama masih ada kandidat lain; keputusan akhirnya
    // tetap di tangan pengguna lewat panel/sidik.
    if (kandidat.jenis === "jurnal" && !(kandidat.halaman ?? "").trim()) {
      const bidangJurnalIni = deteksiBidangSumber(kandidat.judul, kandidat.wadah);
      const asingJurnalIni = Boolean(bidangJurnalIni && !bidangMilikProyek(bidangJurnalIni, konteks));
      const alasanJurnalIni = asingJurnalIni
        ? `Judul atau nama jurnal menunjukkan bidang ${bidangJurnalIni}, sedangkan proyek ini bidang ${bidangProyekTampil}. Artikel ini juga tidak membawa nomor halaman.`
        : "Artikel jurnal ini tidak membawa nomor halaman. Footnote tanpa halaman harus dikonfirmasi penulis sebelum dipasang.";
      penolakan.push({ judul: kandidat.judul, alasan: alasanJurnalIni });
      tertahanList.push({
        rujukan: kandidat,
        kalimatIdx: kalimatIdxKandidat,
        bidangSumber: bidangJurnalIni ?? "",
        alasan: alasanJurnalIni,
      });
      continue;
    }

    // Hemat panggilan model: penolakan aturan keras tidak memakai
    // jatah penilaian; kandidat bersih sesudah jatah habis tidak
    // dinilai lagi pada generate ini, dan kehadirannya dicatat agar
    // hasil tidak menawarkan kandidat tertahan seolah tidak ada
    // pilihan lain (temuan S5 telaah komit koreksi).
    const bidangKeras = deteksiBidangSumber(kandidat.judul, kandidat.wadah);
    const kerasMenolak = Boolean(bidangKeras && !bidangMilikProyek(bidangKeras, konteks));
    if (!kerasMenolak && penilaianModel >= maksPenilaian) {
      jatahHabisAdaSisa = urutan
        .slice(i)
        .some((r) => {
          const b = deteksiBidangSumber(r.judul, r.wadah);
          return !(b && !bidangMilikProyek(b, konteks)) && !(r.jenis === "jurnal" && !(r.halaman ?? "").trim());
        });
      break;
    }
    if (!kerasMenolak) penilaianModel += 1;

    // Kalimat tujuan dinilai dari kandidat ini sendiri (alur lama),
    // atau teks seleksi itu sendiri (mode seleksi: unit yang diblok
    // mahasiswa adalah kalimat tujuannya).
    const kalimatTujuan = modeSeleksi
      ? seleksi
      : (pecahKalimatServer(paragraf)[kalimatIdxKandidat] ?? paragraf);
    const nilai = await nilaiRelevansi(
      { judul: kandidat.judul, wadah: kandidat.wadah, jenis: kandidat.jenis, isi: kandidat.cuplikan },
      konteks,
      kalimatTujuan,
      opsi.kolam,
      maknaKalimat ? { maknaKalimat } : undefined,
    );
    if (nilai.statusPenilaian === "tidak-dinilai") adaTidakDinilai = true;
    if (nilai.lolos) {
      lolosList.push({ rujukan: kandidat, kalimatIdx: kalimatIdxKandidat, skorModel: nilai.skorModel });
      if (lolosList.length >= targetLolos) break;
      continue;
    }
    penolakan.push({ judul: kandidat.judul, alasan: nilai.alasan });
    tertahanList.push({
      rujukan: kandidat,
      kalimatIdx: kalimatIdxKandidat,
      bidangSumber: nilai.bidangSumber,
      alasan: nilai.alasan,
    });
  }
  // Kandidat di luar jatah periksa juga dihitung sebagai sisa belum
  // dinilai bila loop berhenti karena target/jatah, bukan karena habis.
  if (!jatahHabisAdaSisa && urutan.length > maksPeriksa && lolosList.length < targetLolos) {
    jatahHabisAdaSisa = true;
  }

  const keKandidatHasil = (n: NilaiKandidat): KandidatHasil => {
    const kalimatIsi = pilihKalimatIsi(n.rujukan.cuplikan, modeSeleksi ? seleksi : paragraf);
    return {
      sumber: rujukanKeSumber(n.rujukan),
      ...(kalimatIsi ? { kalimatIsi } : { tanpaKalimatIsi: true }),
      ...(typeof n.skorModel === "number" ? { skorModel: n.skorModel } : {}),
      ...(n.rujukan.jenis === "jurnal" && !(n.rujukan.halaman ?? "").trim()
        ? { halamanKosong: true }
        : {}),
    };
  };
  const keTertahanHasil = async (t: TertahanKandidat): Promise<TertahanHasil> => {
    const sidik = sidikKandidatDariRujukan(t.rujukan);
    await terbitkanSidik(sidik, opsi.pemilik ?? "");
    const kalimatIsi = pilihKalimatIsi(t.rujukan.cuplikan, modeSeleksi ? seleksi : paragraf);
    return {
      sumber: rujukanKeSumber(t.rujukan),
      sidik,
      bidangSumber: t.bidangSumber,
      alasan: t.alasan,
      ...(kalimatIsi ? { kalimatIsi } : { tanpaKalimatIsi: true }),
      ...(t.rujukan.jenis === "jurnal" && !(t.rujukan.halaman ?? "").trim()
        ? { halamanKosong: true }
        : {}),
    };
  };

  /* ---- Hasil mode seleksi: daftar kandidat untuk dipilih ---- */
  if (modeSeleksi) {
    const kandidatHasil = lolosList.map(keKandidatHasil);
    const tertahanHasil = await Promise.all(tertahanList.slice(0, 3).map(keTertahanHasil));
    const catatanBagian: string[] = [];
    if (kandidatHasil.length === 0) {
      catatanBagian.push("Tidak ada kandidat yang lolos gerbang relevansi untuk teks yang diblok ini.");
    } else if (kandidatHasil.length < 3) {
      catatanBagian.push(
        `Hanya ${kandidatHasil.length} kandidat yang lolos gerbang relevansi dari ${Math.min(urutan.length, maksPeriksa)} yang diperiksa; tidak ada kandidat tambahan yang dikarang untuk mengejar jumlah.`,
      );
    }
    if (!makna) {
      catatanBagian.push(
        "Analisis makna oleh model tidak tersedia, jadi pencarian berjalan dengan teks yang diblok apa adanya dan penilaian gerbang tanpa rumusan makna.",
      );
    }
    if (adaTidakDinilai) {
      catatanBagian.push(
        "Sebagian kandidat belum dinilai model (layanan AI terganggu atau kuota habis); kandidat itu ditahan, bukan diloloskan.",
      );
    }
    if (jatahHabisAdaSisa) {
      catatanBagian.push("Masih ada kandidat lain yang belum sempat dinilai pada generate ini; jalankan Generate lagi untuk menilai lebih banyak.");
    }
    return {
      ketemu: kandidatHasil.length > 0,
      kalimatIdx: indeksKalimatSeleksi(paragraf, seleksi),
      kandidat: kandidatHasil,
      ...(tertahanHasil.length > 0 ? { tertahan: tertahanHasil } : {}),
      makna: {
        topikParagraf: makna?.topikParagraf ?? "",
        klaim: makna?.klaim ?? "",
        kebutuhan: makna?.kebutuhan ?? "",
        dariModel: Boolean(makna),
      },
      kalimatKunci,
      dariBank,
      dariSidik: false,
      ...(penolakan.length > 0 ? { penolakan } : {}),
      ...(catatanBagian.length > 0 ? { catatan: catatanBagian.join(" ") } : {}),
    };
  }

  /* ---- Hasil alur kursor lama: satu kandidat dipasang ---- */
  const terpilih = lolosList[0];
  if (terpilih) {
    const catatanMasadir =
      apakahMasadir(terpilih.rujukan) && !(terpilih.rujukan.halaman ?? "").trim()
        ? "Catatan: sumber masadir ini tidak membawa nomor halaman cetak pada hasil pencariannya; periksa halaman pada kitab cetaknya sebelum mengutip."
        : undefined;
    return {
      ketemu: true,
      sumber: rujukanKeSumber(terpilih.rujukan),
      kalimatIdx: terpilih.kalimatIdx,
      kalimatKunci,
      dariBank,
      dariSidik: Boolean(sidikLama),
      ...(penolakan.length > 0 ? { penolakan } : {}),
      ...(catatanMasadir ? { catatan: catatanMasadir } : {}),
    };
  }

  const tertahan = tertahanList[0];
  if (tertahan) {
    // Jatah penilaian habis padahal masih ada kandidat bersih belum
    // dinilai: jangan tawarkan kandidat tertahan; minta generate lagi
    // (temuan S5 telaah komit koreksi).
    if (jatahHabisAdaSisa) {
      return {
        ketemu: false,
        kalimatKunci,
        dariBank,
        dariSidik: Boolean(sidikLama),
        penolakan,
        catatan:
          "Kandidat teratas tertahan gerbang relevansi, tetapi masih ada kandidat lain yang belum sempat dinilai pada generate ini. Jalankan Generate footnote sekali lagi agar kandidat berikutnya dinilai, sebelum memutuskan memasang yang tertahan.",
      };
    }
    const tertahanHasil = await keTertahanHasil(tertahan);
    return {
      ketemu: false,
      perluKonfirmasi: {
        sumber: tertahanHasil.sumber,
        kalimatIdx: tertahan.kalimatIdx,
        bidangSumber: tertahan.bidangSumber,
        bidangProyek: bidangProyekTampil,
        alasan: tertahan.alasan,
        sidik: tertahanHasil.sidik,
      },
      kalimatKunci,
      dariBank,
      dariSidik: Boolean(sidikLama),
      penolakan,
      catatan: `Rujukan teratas tertahan gerbang relevansi: ${tertahan.alasan} Periksa kandidatnya, lalu pasang persis kandidat itu bila memang disengaja.`,
    };
  }

  const teratas = penolakan[0];
  return {
    ketemu: false,
    kalimatKunci,
    dariBank,
    dariSidik: Boolean(sidikLama),
    ...(penolakan.length > 0 ? { penolakan } : {}),
    catatan: jatahHabisAdaSisa
      ? "Kandidat yang tersedia belum sempat dinilai semua pada generate ini. Jalankan Generate footnote sekali lagi."
      : teratas
        ? `Semua rujukan tertolak gerbang relevansi. Penolakan teratas: "${teratas.judul}" karena ${teratas.alasan} Coba perjelas pokok datanya, atau cari lewat Cari rujukan (AI) lalu pasang dengan dialog manual.`
        : "Belum ditemukan rujukan yang cukup relevan untuk paragraf ini. Coba perjelas pokok datanya, atau cari lewat Cari rujukan (AI) lalu pasang dengan dialog manual.",
  };
}
