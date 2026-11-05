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
 *
 * Tahap G1 (menutup bocor uji judul uang panai, 6 Nov 2026):
 * kandidat kitab masadir kini juga melewati GERBANG KATEGORI
 * deterministik (lib/engine/kategori-kitab.ts) sebelum penilaian
 * model — kategori rekod sumber (Shamela/Turath) yang tidak
 * beririsan dengan bidang proyek gugur keras, dan pasang memeriksa
 * ulang gerbang yang sama. Bocornya: kitab tauhid berkategori
 * akidah terpasang dan tersimpan pada proyek fikih uang panai
 * karena bidang kitab hanya dinilai skor model.
 *
 * Tahap C (Aturan Pencarian Valid, putusan pemilik 5 Nov 2026 15:57 —
 * blokir keras penuh): di atas gerbang bidang, kandidat wajib lolos
 * PERIKSA KEBERADAAN sesuai sumbernya sebelum boleh dipasang:
 * kandidat jurnal diperiksa metadata hidupnya ke Crossref lewat
 * periksaMetadata (lib/server/verifikasi-rujukan.ts), kandidat kitab
 * Turath/Shamela dibuktikan rekod sumbernya sendiri, buku web
 * dibuktikan verifikasi DOI/ISBN jalur pencariannya. Kandidat yang
 * gagal periksa atau belum terverifikasi TIDAK BISA DIPASANG dengan
 * cara apa pun: jalur konfirmasi sadar untuk kandidat tertahan
 * DICABUT. Sidik hanya diterbitkan untuk kandidat yang LOLOS, dan
 * pasangFootnoteDisetujui memeriksa ulang kelulusannya (metadata +
 * bidang, dihitung segar) pada saat pemasangan.
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
import { ambil, hapus, simpan } from "./store";
import { getBidang } from "@/lib/content/bidang";
import {
  bidangMilikProyek,
  deteksiBidangSumber,
  nilaiRelevansi,
  nilaiUntukCariRujukan,
  type KonteksProyek,
} from "./gerbang-relevansi";
import {
  jangkarBidangUntuk,
  nilaiBidangJurnal,
  periksaMetadata,
  type StatusVerifikasi,
} from "./verifikasi-rujukan";
import { bersihkanJudul, type Sumber } from "@/lib/engine/cite";
import { idStabilDariIdentitas } from "@/lib/refs/footnote";
import { cari as cariTurath, cariKonsep as cariKonsepTurath } from "@/lib/refs/adapters/turath";
import {
  cari as cariShamela,
  idBukuDariTautan as idBukuShamela,
  kategoriBuku as kategoriBukuShamela,
} from "@/lib/refs/adapters/shamela";
import { gerbangKategoriKitab } from "@/lib/engine/kategori-kitab";
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
 * Ambang tumpang-tindih bermakna antara kalimat isi dan teks acuan,
 * dihitung sebagai jumlah batang kata isi BERBEDA yang sama-sama
 * muncul (tokenJudul sudah membuang kata pendek dan menyamakan batang
 * kata Arab). Satu batang kata yang sama tidak pernah cukup: kata
 * seperti قياس bisa berarti kias ushul fiqh pada acuan dan pengukuran
 * industri pada kandidat, dan boilerplate jurnal bisa tidak berbagi
 * satu kata pun dengan acuan tetapi kemarin tampil utuh sebagai
 * "kalimat isi yang cocok" (temuan S1 telaah silang Tahap 4).
 */
const AMBANG_IRISAN_KALIMAT_ISI = 2;
/**
 * Pengecualian asal untuk kutipan MASADIR: cuplikan Turath/Shamela
 * adalah teks halaman yang SUDAH tercocok oleh adapternya pada frasa
 * pencarian dari paragraf itu sendiri, jadi kecocokannya dibuktikan
 * jalur pencariannya, bukan pemilih ini. Satu batang kata isi yang
 * sama dengan acuan sudah menjadi bukti sentuhan; di bawah itu
 * kutipannya tetap tidak ditampilkan.
 */
const AMBANG_IRISAN_MASADIR = 1;

/**
 * Kalimat isi kandidat: kalimat dari isi nyata sumber (abstrak atau
 * cuplikan teks) yang paling menyentuh teks acuan. Yang ditampilkan
 * selalu teks sumber apa adanya; fungsi ini hanya MEMILIH kalimatnya.
 * Undefined bila sumber tidak menyediakan isi, atau tidak ada kalimat
 * isinya yang menyentuh acuan secara BERMAKNA (lihat ambang di atas,
 * berlaku pada cuplikan pendek maupun panjang) — kandidat lalu
 * ditandai tanpa kalimat isi, tidak diisi karangan.
 */
export function pilihKalimatIsi(
  cuplikan: string | undefined,
  acuan: string,
  opsi?: { dariMasadir?: boolean },
): string | undefined {
  const bersih = (cuplikan ?? "").replace(/\s+/g, " ").trim();
  if (!bersih) return undefined;
  const tokenAcuan = tokenJudul(acuan);
  if (tokenAcuan.size === 0) return undefined;
  const ambang = opsi?.dariMasadir ? AMBANG_IRISAN_MASADIR : AMBANG_IRISAN_KALIMAT_ISI;
  const irisan = (teks: string): number => {
    const t = tokenJudul(teks);
    let sama = 0;
    for (const x of t) if (tokenAcuan.has(x)) sama += 1;
    return sama;
  };
  const kalimat = pecahKalimatServer(bersih);
  if (kalimat.length <= 1) {
    return irisan(bersih) >= ambang ? bersih.slice(0, 420) : undefined;
  }
  let terbaik: string | undefined;
  let skorTerbaik = 0;
  for (const k of kalimat) {
    const s = irisan(k);
    if (s > skorTerbaik) {
      skorTerbaik = s;
      terbaik = k;
    }
  }
  if (terbaik && skorTerbaik >= ambang) return terbaik.slice(0, 500);
  // Cuplikan PENDEK yang kalimatnya terpencar: tampilkan utuh hanya
  // bila cuplikan secara keseluruhan menyentuh acuan melewati ambang
  // yang sama. Cuplikan panjang tidak pernah ditampilkan utuh.
  if (bersih.length <= 420 && irisan(bersih) >= ambang) return bersih;
  return undefined;
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
  const judul = bersihkanJudul(r.judul);
  return {
    // Id STABIL (Tahap 6, menutup L1 Tahap 4): identitas kanonis
    // yang sama dengan jalur dialog Cari Rujukan, bukan id acak —
    // karya yang sama dari dua jalur kini ber-id sama dan penjaga
    // duplikat di titik tanam mengenalinya sebagai satu sumber.
    id: idStabilDariIdentitas(judul, r.penulis.join("، "), r.tahun ?? ""),
    // Jenis disertasi dari indeks dipetakan ke skripsi (menutup R3
    // telaah Tahap 7): dulu semua non-jurnal menjadi kitab, sehingga
    // disertasi terformat sebagai buku, bukan format skripsi.
    jenis: r.jenis === "jurnal" ? "artikel" : r.jenis === "disertasi" ? "skripsi" : "kitab",
    penulis: r.penulis.join("، "),
    penulisDaftar: r.penulis,
    tahun: r.tahun ?? "",
    judul,
    penerbit: r.jenis === "buku" || r.jenis === "disertasi" ? r.wadah || undefined : undefined,
    jurnal: r.jenis === "jurnal" ? r.wadah || undefined : undefined,
    jilid: r.jilid || undefined,
    halaman: r.halaman || undefined,
    doi: r.doi ?? undefined,
    isbn: r.isbn ?? undefined,
    url: r.tautan || undefined,
    // Kategori kitab rekod sumber ikut dibawa (Tahap G1) agar
    // periksa ulang di titik pasang menilai kategori yang sama.
    kategoriKitab: r.kategoriKitab || undefined,
    daftarIsi: r.daftarIsi || undefined,
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
      // Kategori kitab dari rekod sumber (Tahap G1): Turath
      // mengirimnya sebagai cat_id yang sudah dipetakan adapter ke
      // nama klasifikasi; Shamela diisi pengayaan di bawah.
      kategoriKitab: c.kategoriKitab,
      // Judul bab/daftar isi dari meta rekod (gerbang memeriksa
      // istilah inti/penolak di sini juga).
      daftarIsi: c.judul_bab,
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
        // Kategori dari kembaran jalur lain (mis. hit Turath yang
        // membawa cat_id) mengisi yang kosong (Tahap G1).
        if (!lama.kategoriKitab && r.kategoriKitab) lama.kategoriKitab = r.kategoriKitab;
        continue;
      }
      indeks.set(kunci, hasil.length);
      hasil.push(r);
    }
  }
  // Pengayaan kategori Shamela (Tahap G1): hasil pencarian Shamela
  // tidak membawa kategori, tetapi halaman bukunya memuatnya pada
  // breadcrumb. Ambil untuk kandidat Shamela yang belum berkategori
  // (kegagalan jaringan membiarkannya kosong = kategori tidak
  // dikenal bagi gerbang, bukan lolos diam-diam). Kandidat yang sama
  // dari Turath biasanya sudah berkategori lewat cat_id.
  const perluKategori = hasil.filter((r) => r.asal === "shamela" && !r.kategoriKitab);
  if (perluKategori.length > 0) {
    await Promise.all(
      perluKategori.map(async (r) => {
        const id = idBukuShamela(r.tautan);
        if (!id) return;
        const nama = await kategoriBukuShamela(id).catch(() => undefined);
        if (nama) r.kategoriKitab = nama;
      }),
    );
  }
  // Kandidat hasil dedupe lintas sumber dengan judul sama (pencarian
  // Turath dan Shamela kerap mengembalikan kitab yang sama pada
  // halaman berbeda): kategori yang sudah diketahui satu salinan
  // mengisi salinan judul yang sama.
  const kategoriPerJudul = new Map<string, string>();
  for (const r of hasil) {
    if (r.kategoriKitab) kategoriPerJudul.set(r.judul.toLowerCase(), r.kategoriKitab);
  }
  for (const r of hasil) {
    if (!r.kategoriKitab) {
      const isi = kategoriPerJudul.get(r.judul.toLowerCase());
      if (isi) r.kategoriKitab = isi;
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

/** Satu kandidat yang LOLOS semua periksa pada mode seleksi, siap
 *  dipilih mahasiswa di panel kandidat. Sidiknya diterbitkan server
 *  untuk kandidat ini persis: pemasangan berjalan lewat
 *  pasangFootnoteDisetujui yang memeriksa ulang kelulusannya pada
 *  saat pemasangan (Tahap C). */
export interface KandidatHasil {
  sumber: Sumber;
  /** Sidik kandidat lolos terbitan server. */
  sidik: string;
  /** Kalimat isi nyata dari sumbernya yang cocok dengan teks yang
   *  diblok. Tidak ada (undefined) bila sumber tidak menyediakan isi
   *  atau tidak ada kalimat isinya yang menyentuh teks tersebut. */
  kalimatIsi?: string;
  /** True bila kandidat memang tidak punya kalimat isi untuk
   *  ditampilkan — klien wajib menyatakannya apa adanya. */
  tanpaKalimatIsi?: boolean;
  /** Skor penilaian model 0..100 bila model menilai kandidat ini. */
  skorModel?: number;
  /** True bila kandidat tidak membawa nomor halaman sama sekali
   *  (jurnal maupun buku): klien menampilkan lencana "Tanpa nomor
   *  halaman", bukan lencana "Halaman" yang kosong (temuan R4 telaah
   *  silang Tahap 4). */
  halamanKosong?: boolean;
}

/** Satu kandidat yang TIDAK lolos periksa pada mode seleksi (Tahap C).
 *  Ditampilkan dengan label putusannya agar penulis tahu apa yang
 *  ditolak dan kenapa, tetapi TANPA sidik dan tanpa jalan pemasangan:
 *  kandidat yang gagal periksa atau belum terverifikasi tidak bisa
 *  dipasang dengan cara apa pun (putusan pemilik 5 Nov 2026 15:57). */
export interface DitolakHasil {
  sumber: Sumber;
  /** Putusan periksa yang menggagalkan kandidat ini. */
  status: Exclude<StatusVerifikasi, "terverifikasi">;
  alasan: string;
  bidangSumber: string;
  kalimatIsi?: string;
  tanpaKalimatIsi?: boolean;
  /** Sama seperti pada KandidatHasil: kandidat tanpa nomor halaman. */
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
  /** Mode seleksi: kandidat yang lolos semua periksa (target minimal
   *  3 bila tersedia), urut penilaian. Mahasiswa memilih sendiri;
   *  tidak ada pemasangan otomatis. */
  kandidat?: KandidatHasil[];
  /** Kandidat yang TIDAK lolos periksa, dengan label putusannya
   *  (maksimal 5 pada mode seleksi, 3 pada alur kursor). Tidak ada
   *  sidik dan tidak ada jalan memasang mereka (Tahap C). */
  ditolak?: DitolakHasil[];
  /** Mode seleksi: rumusan makna kalimat yang diblok. dariModel false
   *  berarti analisis model tidak tersedia dan pencarian berjalan
   *  dengan teks seleksi apa adanya. */
  makna?: {
    topikParagraf: string;
    klaim: string;
    kebutuhan: string;
    dariModel: boolean;
  };
  /** Penolakan gerbang yang dicatat selama mencoba kandidat, urut
   *  pemeriksaan. Untuk audit dan pesan jujur ke pengguna. */
  penolakan?: { judul: string; alasan: string }[];
}

/* ------------------------------------------------------------------ */
/* Sidik kandidat (Tahap 4 bentuk awal; Tahap C MEMBALIK arahnya).      */
/*                                                                      */
/* Bentuk awal Tahap 4: sidik diterbitkan untuk kandidat TERTAHAN dan   */
/* pemasangan paksa memasang persis kandidat itu tanpa penilaian        */
/* ulang, atas dasar persetujuan sadar pengguna. Putusan pemilik        */
/* 5 Nov 2026 15:57 mencabut model itu: kandidat yang gagal periksa     */
/* atau belum terverifikasi tidak boleh terpasang dengan cara apa       */
/* pun, jadi sidik kini diterbitkan HANYA untuk kandidat yang LOLOS     */
/* semua periksa saat generate, dan pasangFootnoteDisetujui adalah      */
/* gerbang pemasangan servernya:                                        */
/*  1. sidik (hash isi kandidat) cocok dengan data yang dikirim balik   */
/*     DAN tercatat di store atas nama pemiliknya, belum kedaluwarsa    */
/*     (24 jam; rekam tanpa tanggal sah dianggap kedaluwarsa);          */
/*  2. PERIKSA ULANG SEGAR pada saat pemasangan: metadata Crossref      */
/*     untuk kandidat jurnal, penanda rekod sumber untuk kitab          */
/*     Turath/Shamela, dan penilaian bidang gerbang untuk semua         */
/*     kandidat. Status dari klien atau hasil periksa lama tidak        */
/*     pernah dipercaya — yang gagal periksa ulang DITOLAK.             */
/*  3. Rekam SEKALI PAKAI: dihapus sesudah semua periksa lolos dan       */
/*     pemasangan terjadi. Penolakan periksa ulang tidak membakar       */
/*     rekamnya, tetapi percobaan berikutnya dinilai ulang dari nol     */
/*     dan akan ditolak lagi dengan alasan yang sama.                   */
/* ------------------------------------------------------------------ */

function hashSidik(teks: string): string {
  return createHash("sha256").update(teks).digest("hex").slice(0, 32);
}

/** Tupel kanonis kandidat dari bentuk RujukanTamu (sisi server).
 *  Judul dibersihkan dari tag jenis (Tahap 6) di kedua bentuk tupel
 *  agar sidik kandidat yang disetujui pengguna tetap cocok dengan
 *  sidik Sumber hasil rujukanKeSumber yang kini menyimpan judul
 *  bersih. */
function tupelDariRujukan(r: RujukanTamu): string {
  return [
    bersihkanJudul(r.judul),
    r.penulis.join("، "),
    r.tahun ?? "",
    r.wadah ?? "",
    r.doi ?? "",
    r.isbn ?? "",
    r.halaman ?? "",
    r.jilid ?? "",
    r.jenis,
    // Kategori kitab terikat pada sidik (Tahap G1): klien tidak bisa
    // mengganti atau membuang kategori yang menggagalkan kandidat
    // tanpa membatalkan sidiknya.
    r.kategoriKitab ?? "",
    r.daftarIsi ?? "",
  ].join("\n");
}

/** Tupel kanonis yang sama dari bentuk Sumber (yang dilihat klien).
 *  Pemetaan jenis dan wadah meniru rujukanKeSumber persis. */
function tupelDariSumber(s: Sumber): string {
  return [
    bersihkanJudul(s.judul ?? ""),
    s.penulis ?? "",
    s.tahun ?? "",
    s.jurnal ?? s.penerbit ?? "",
    s.doi ?? "",
    s.isbn ?? "",
    s.halaman ?? "",
    s.jilid ?? "",
    s.jenis === "artikel" ? "jurnal" : "buku",
    s.kategoriKitab ?? "",
    s.daftarIsi ?? "",
  ].join("\n");
}

export function sidikKandidatDariRujukan(r: RujukanTamu): string {
  return hashSidik(tupelDariRujukan(r));
}

export function sidikKandidatDariSumber(s: Sumber): string {
  return hashSidik(tupelDariSumber(s));
}

const UMUR_SIDIK_MS = 24 * 60 * 60 * 1000;

/** Label putusan verifikasi untuk pesan ke pengguna. */
export function labelStatusVerifikasi(status: StatusVerifikasi): string {
  switch (status) {
    case "terverifikasi":
      return "Terverifikasi";
    case "gagal-metadata":
      return "Gagal periksa metadata";
    case "gagal-bidang":
      return "Tidak sesuai bidang";
    case "belum-terverifikasi":
      return "Belum terverifikasi";
  }
}

/** Catat sidik kandidat lolos atas nama pemiliknya agar pemasangan
 *  nanti bisa diverifikasi. Kegagalan mencatat tidak menggagalkan
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
 * Pasang PERSIS kandidat lolos yang dipilih pengguna, dengan PERIKSA
 * ULANG SEGAR di server (Tahap C). Sidik hanya membuktikan server
 * pernah menerbitkan kandidat ini sebagai kandidat lolos untuk
 * pemiliknya; kelulusannya TIDAK dipercaya dari sidik itu:
 *  - kandidat jurnal: metadata diperiksa ulang ke Crossref hidup;
 *  - kandidat kitab Turath/Shamela: penanda rekod sumbernya (tautan
 *    rekod) wajib masih ada;
 *  - semua kandidat: bidang dinilai ulang oleh gerbang relevansi
 *    dengan standar tataran bidang yang sama dengan verifikasi
 *    tambah jurnal (bidang proyek atau irisan langsungnya).
 * Kandidat yang pada periksa ulang gagal atau belum terverifikasi
 * DITOLAK (hasil membawa alasanTolak; route menjawab 403). Rekam
 * sidik sekali pakai: dihapus hanya sesudah semua periksa lolos dan
 * pemasangan terjadi.
 */
export async function pasangFootnoteDisetujui(opsi: {
  sidik: string;
  kandidat: Sumber;
  paragraf: string;
  kalimatIdx?: number;
  /** Id pengguna pemilik sidik (dari sesi server, bukan dari klien). */
  pemilik: string;
  /** Konteks proyek untuk periksa ulang bidang (dari klien proyek,
   *  pola yang sama dengan /api/refs/search dan verifikasi-jurnal). */
  bidangId?: string;
  judulProyek?: string;
  topikAr?: string;
  /** BYOK: kunci pribadi pemanggil, diteruskan ke penilaian gerbang. */
  kolam?: OpsiKolamTerusan;
}): Promise<HasilGenerate & { alasanTolak?: string }> {
  const gagal = (catatan: string): HasilGenerate & { alasanTolak: string } => ({
    ketemu: false,
    kalimatKunci: [],
    dariBank: false,
    dariSidik: false,
    catatan,
    alasanTolak: catatan,
  });
  const sidik = (opsi.sidik ?? "").trim();
  if (!sidik || !opsi.kandidat || typeof opsi.kandidat.judul !== "string" || !opsi.kandidat.judul.trim()) {
    return gagal("Data kandidat yang akan dipasang tidak lengkap. Minta generate ulang, lalu pasang kandidat lolos yang ditampilkan.");
  }
  if (sidikKandidatDariSumber(opsi.kandidat) !== sidik) {
    return gagal(
      "Sidik kandidat tidak cocok dengan data kandidat yang dikirim balik, jadi pemasangan dibatalkan. Minta generate ulang, lalu pasang kandidat yang ditampilkan.",
    );
  }
  const rec = (await ambil("tembolok", `konf:${sidik}`).catch(() => null)) as
    | { pemilik?: string; dibuat?: string }
    | null;
  if (!rec || rec.pemilik !== opsi.pemilik) {
    return gagal(
      "Kandidat ini tidak tercatat sebagai kandidat lolos yang diterbitkan server untuk akun Anda. Minta generate ulang, lalu pasang dari panel yang baru.",
    );
  }
  const dibuat = Date.parse(rec.dibuat ?? "");
  if (!Number.isFinite(dibuat) || Date.now() - dibuat > UMUR_SIDIK_MS) {
    return gagal(
      "Sidik kandidat ini sudah kedaluwarsa (lebih dari 24 jam) atau catatan sidiknya tidak lengkap. Minta generate ulang.",
    );
  }
  const paragraf = opsi.paragraf.replace(/\[\[ref:[^\]]*\]\]/g, "").trim();
  const kalimatParagraf = pecahKalimatServer(paragraf);
  const jumlahKalimat = Math.max(1, kalimatParagraf.length);
  const kalimatIdx = Math.min(
    Math.max(0, typeof opsi.kalimatIdx === "number" && Number.isFinite(opsi.kalimatIdx) ? Math.floor(opsi.kalimatIdx) : 0),
    jumlahKalimat - 1,
  );
  /* ---- Periksa ulang segar: metadata / penanda sumber ---- */
  const kandidat = opsi.kandidat;
  const dariMasadir =
    /turath|shamela/i.test(kandidat.sumberImpor ?? "") || /turath|shamela/i.test(kandidat.url ?? "");
  // Konteks bidang titik pasang dibangun lebih dulu karena jalur
  // jurnal kini menilainya di dalam cabangnya sendiri (G2).
  const bidangPasang = opsi.bidangId ? getBidang(opsi.bidangId) : null;
  const konteksPasang: KonteksProyek = {
    bidangId: opsi.bidangId ?? "",
    bidangLabel: bidangPasang ? `${bidangPasang.labelId} (${bidangPasang.labelAr})` : "",
    judulProyek: opsi.judulProyek ?? "",
    topik: opsi.topikAr ?? "",
  };
  // Kandidat jurnal dinilai bidangnya oleh fungsi bersama
  // nilaiBidangJurnal (gerbang deterministik + veto model) di dalam
  // cabang metadatanya; blok penilaian umum di bawah dilewati untuk
  // kelas itu agar standarnya persis sama dengan endpoint verifikasi.
  let bidangSudahDinilai = false;
  if (dariMasadir) {
    // Keberadaan kitab adalah rekod sumbernya sendiri; tanpa tautan
    // rekod itu tidak ada yang bisa dicek ulang.
    if (!(kandidat.url ?? "").trim()) {
      return gagal(
        "Pemasangan ditolak pada periksa ulang (Belum terverifikasi): kitab ini tidak membawa tautan rekod sumber Turath/Shamela yang bisa dicek.",
      );
    }
    // Gerbang kategori kitab dinilai ulang segar di titik pasang
    // (Tahap G1): kategori yang tidak beririsan dengan bidang proyek
    // gugur keras di sini sebelum penilaian model bidang di bawah,
    // dan kategori yang tidak dikenal tanpa sebutan persis tertahan.
    // Inilah titik yang pada uji uang panai memasang kitab tauhid ke
    // proyek fikih tanpa peringatan.
    const gerbangKitabPasang = gerbangKategoriKitab(
      {
        judul: kandidat.judul,
        kategoriKitab: kandidat.kategoriKitab,
        daftarIsi: kandidat.daftarIsi,
        teksParagraf: paragraf,
        judulProyek: opsi.judulProyek,
      },
      opsi.bidangId ?? "",
    );
    if (gerbangKitabPasang.putusan !== "lolos") {
      return gagal(
        `Pemasangan ditolak pada periksa ulang kategori kitab (${labelStatusVerifikasi(gerbangKitabPasang.putusan)}): ${gerbangKitabPasang.alasan}`,
      );
    }
  } else if (kandidat.jenis === "artikel" || (kandidat.doi ?? "").trim()) {
    const meta = await periksaMetadata({
      id: kandidat.id,
      doi: kandidat.doi ?? undefined,
      judul: kandidat.judul,
      jurnal: kandidat.jurnal,
      tahun: kandidat.tahun || undefined,
    });
    if (meta.status !== "lolos") {
      return gagal(
        `Pemasangan ditolak pada periksa ulang metadata (${labelStatusVerifikasi(meta.status)}): ${meta.alasan}`,
      );
    }
    if (kandidat.jenis === "artikel" && !(kandidat.halaman ?? "").trim()) {
      return gagal(
        "Pemasangan ditolak pada periksa ulang (Belum terverifikasi): artikel jurnal ini tidak membawa nomor halaman, jadi footnote-nya belum bisa dipasang.",
      );
    }
    // Bidang jurnal dinilai ulang segar dengan fungsi bersama G2
    // (nilaiBidangJurnal): gerbang deterministik label sumber +
    // model hanya veto — standar yang sama persis dengan endpoint
    // verifikasi tambah jurnal. Hanya "terverifikasi" yang lolos.
    const bidangJurnal = await nilaiBidangJurnal(
      { doi: kandidat.doi ?? undefined, judul: kandidat.judul, jurnal: kandidat.jurnal },
      konteksPasang,
      opsi.kolam,
    );
    if (bidangJurnal.status !== "terverifikasi") {
      return gagal(
        `Pemasangan ditolak pada periksa ulang bidang (${labelStatusVerifikasi(bidangJurnal.status)}): ${bidangJurnal.alasan}`,
      );
    }
    bidangSudahDinilai = true;
  }
  // Buku web tanpa DOI tidak punya rekod metadata untuk diperiksa
  // ulang; keberadaannya dibuktikan sidik itu sendiri (server hanya
  // menerbitkannya bagi kandidat yang lolos periksa saat generate).
  // Bidang semua kandidat tetap dinilai ulang di bawah ini.

  /* ---- Periksa ulang segar: bidang lewat gerbang ----
   * Jalur ini kini hanya untuk kitab masadir (sesudah gerbang
   * kategori G1 di atas) dan buku web: kandidat JURNAL sudah dinilai
   * di cabangnya sendiri dengan fungsi bersama G2 (bidangSudahDinilai).
   * Standar bidang di titik pasang adalah standar tataran bidang
   * yang sama dengan verifikasi tambah jurnal (Tahap A,
   * jangkarBidangUntuk): bidang SESUAI atau BERIRISAN langsung
   * dengan bidang proyek = lolos. Kesesuaian kandidat dengan
   * kalimat tujuan sendiri sudah dinilai pada tahap generate
   * (kalimat + rumusan makna menjadi jangkarnya di sana) dan
   * kandidat ini dipilih pengguna untuk kalimat itu; titik pasang
   * membuktikan kandidatnya nyata dan se-bidang, bukan mengadili
   * ulang kecocokan kalimatnya. Penilaian berjangkar judul sempit
   * di sini terbukti menggagalkan artikel sebidang yang sah (kasus
   * Ihya pada proyek takamul: model mengenalinya sebagai Fiqh &
   * Ushul Fiqh tetapi menolaknya hanya karena tidak membahas frasa
   * judul proyek, skor 45 pada uji hidup Tahap C). */
  if (!bidangSudahDinilai) {
    const { putusan: putusanPasang } = await nilaiUntukCariRujukan(
      [
        {
          kunci: "pasang",
          judul: kandidat.judul,
          wadah: kandidat.jurnal ?? kandidat.penerbit ?? "",
          jenis: kandidat.jenis === "artikel" ? "jurnal" : "buku",
          kalimat: jangkarBidangUntuk(konteksPasang),
        },
      ],
      konteksPasang,
      opsi.kolam,
      1,
    );
    const nilaiPasang = putusanPasang.get("pasang");
    if (!nilaiPasang || !(nilaiPasang.lolos && nilaiPasang.statusPenilaian === "dinilai")) {
      // Pemetaan blokir keras: model tidak menilai (atau putusan
      // tidak terbit) berarti bidangnya belum terbukti; penolakan
      // yang dinilai berarti bidangnya tidak sesuai.
      const statusPasang: StatusVerifikasi =
        !nilaiPasang || nilaiPasang.statusPenilaian === "tidak-dinilai"
          ? "belum-terverifikasi"
          : "gagal-bidang";
      return gagal(
        `Pemasangan ditolak pada periksa ulang bidang (${labelStatusVerifikasi(statusPasang)}): ${nilaiPasang?.alasan ?? "Kandidat tidak mendapat putusan bidang dari gerbang."}`,
      );
    }
  }

  // SEKALI PAKAI: semua periksa lolos, pemasangan akan terjadi —
  // bakar rekam sidiknya sekarang agar sidik yang sama tidak bisa
  // diputar ulang untuk pemasangan kedua. Kegagalan menghapus tidak
  // membatalkan pemasangan yang sah ini.
  await hapus("tembolok", `konf:${sidik}`).catch(() => undefined);
  const sumber: Sumber = {
    ...kandidat,
    // Kitab Turath/Shamela tetap bertanda perlu verifikasi: metadata
    // cetak korpus tidak lengkap dan halaman wajib diperiksa penulis
    // pada kitab cetaknya (keputusan lama yang dipertahankan).
    // Kandidat lain membawa tandanya sendiri dari hasil periksa.
    perluVerifikasi: dariMasadir ? true : kandidat.perluVerifikasi,
  };
  return {
    ketemu: true,
    sumber,
    kalimatIdx,
    kalimatKunci: [],
    dariBank: false,
    dariSidik: false,
    catatan:
      "Dipasang sesudah periksa ulang di server pada saat pemasangan: metadata dan bidang kandidat ini lulus periksa.",
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

/** Kelas periksa keberadaan kandidat (Tahap C): jurnal diperiksa
 *  metadata hidupnya ke Crossref, kitab Turath/Shamela dibuktikan
 *  rekod sumbernya sendiri, buku web dibuktikan verifikasi DOI/ISBN
 *  jalur pencariannya. Yang disebut jurnal di sini adalah kandidat
 *  ber-DOI atau berjenis jurnal. */
function kelasKandidat(r: RujukanTamu): "jurnal" | "masadir" | "buku" {
  if (apakahMasadir(r)) return "masadir";
  if ((r.doi ?? "").trim() || r.jenis === "jurnal") return "jurnal";
  return "buku";
}

interface NilaiKandidat {
  rujukan: RujukanTamu;
  kalimatIdx: number;
  skorModel?: number;
}

interface DitolakKandidat {
  rujukan: RujukanTamu;
  kalimatIdx: number;
  status: Exclude<StatusVerifikasi, "terverifikasi">;
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
  const ditolakList: DitolakKandidat[] = [];
  let penilaianModel = 0;
  let jatahHabisAdaSisa = false;
  let adaTidakDinilai = false;

  for (let i = 0; i < urutan.length && i < maksPeriksa; i++) {
    const kandidat = urutan[i]!;
    const kalimatIdxKandidat = modeSeleksi
      ? indeksKalimatSeleksi(paragraf, seleksi)
      : pilihKalimat(paragraf, kandidat, kalimatKunci, opsi.kalimatKursor);

    // Footnote jurnal tanpa halaman tidak bisa dipasang sama sekali
    // (Tahap C): dulu kelas ini tertahan dan bisa dipasang paksa
    // lewat konfirmasi sadar; putusan blokir keras mencabut jalan
    // itu. Bila bidangnya juga terdeteksi asing putusannya
    // gagal-bidang; selain itu belum-terverifikasi karena data
    // rujukannya tidak lengkap untuk sebuah footnote.
    if (kandidat.jenis === "jurnal" && !(kandidat.halaman ?? "").trim()) {
      const bidangJurnalIni = deteksiBidangSumber(kandidat.judul, kandidat.wadah);
      const asingJurnalIni = Boolean(bidangJurnalIni && !bidangMilikProyek(bidangJurnalIni, konteks));
      const alasanJurnalIni = asingJurnalIni
        ? `Judul atau nama jurnal menunjukkan bidang ${bidangJurnalIni}, sedangkan proyek ini bidang ${bidangProyekTampil}. Artikel ini juga tidak membawa nomor halaman.`
        : "Artikel jurnal ini tidak membawa nomor halaman. Footnote jurnal wajib mencantumkan halaman, jadi kandidat ini tidak bisa dipasang.";
      penolakan.push({ judul: kandidat.judul, alasan: alasanJurnalIni });
      ditolakList.push({
        rujukan: kandidat,
        kalimatIdx: kalimatIdxKandidat,
        status: asingJurnalIni ? "gagal-bidang" : "belum-terverifikasi",
        bidangSumber: bidangJurnalIni ?? "",
        alasan: alasanJurnalIni,
      });
      continue;
    }

    /* ---- Periksa keberadaan (Tahap C), sesuai kelas sumbernya ---- */
    const kelas = kelasKandidat(kandidat);
    if (kelas === "jurnal") {
      const meta = await periksaMetadata({
        id: kandidat.id,
        doi: kandidat.doi ?? undefined,
        judul: bersihkanJudul(kandidat.judul),
        jurnal: kandidat.wadah || undefined,
        tahun: kandidat.tahun || undefined,
      });
      if (meta.status !== "lolos") {
        penolakan.push({ judul: kandidat.judul, alasan: meta.alasan });
        ditolakList.push({
          rujukan: kandidat,
          kalimatIdx: kalimatIdxKandidat,
          status: meta.status,
          bidangSumber: "",
          alasan: meta.alasan,
        });
        continue;
      }
    } else if (kelas === "masadir") {
      // Keberadaan kitab dibuktikan rekod sumbernya sendiri: tautan
      // rekod Turath/Shamela yang diterbitkan adapternya. Tanpa
      // penanda itu tidak ada yang bisa dicek, jadi kandidat belum
      // terverifikasi dan tidak bisa dipasang. Kitab TIDAK dipaksa
      // ke Crossref: korpusnya memang di luar indeks itu.
      if (!(kandidat.tautan ?? "").trim()) {
        const alasanMasadir =
          "Kitab ini tidak membawa tautan rekod sumber Turath/Shamela yang bisa dicek, jadi keberadaannya belum terverifikasi.";
        penolakan.push({ judul: kandidat.judul, alasan: alasanMasadir });
        ditolakList.push({
          rujukan: kandidat,
          kalimatIdx: kalimatIdxKandidat,
          status: "belum-terverifikasi",
          bidangSumber: "",
          alasan: alasanMasadir,
        });
        continue;
      }
    } else if (!kandidat.terverifikasi) {
      // Buku/disertasi web tanpa DOI: keberadaannya dibuktikan
      // verifikasi DOI/ISBN pada jalur pencariannya sendiri (flag
      // terverifikasi pipeline rujukan). Belum terverifikasi di sana
      // berarti belum terverifikasi di sini juga.
      const alasanBuku =
        "Keberadaan buku ini belum terverifikasi (DOI/ISBN tidak terkonfirmasi pada jalur pencariannya), jadi belum bisa dipasang.";
      penolakan.push({ judul: kandidat.judul, alasan: alasanBuku });
      ditolakList.push({
        rujukan: kandidat,
        kalimatIdx: kalimatIdxKandidat,
        status: "belum-terverifikasi",
        bidangSumber: "",
        alasan: alasanBuku,
      });
      continue;
    }

    /* ---- Gerbang kategori kitab (Tahap G1) ----
     * Kandidat kitab masadir dinilai mesin gerbang deterministik
     * (lib/engine/kategori-kitab.ts: relasi cabang kategori sumber
     * terhadap topik proyek + istilah inti/penolak pada judul dan
     * daftar isi) TERLEBIH DULU, sebelum penilaian model apa pun.
     * Putusan selain "lolos" berhenti di sini: gagal-bidang untuk
     * yang gugur keras (kasus uang panai: kitab tauhid berkategori
     * akidah, cabang bertentangan dengan topik munakahat, sempat
     * lolos lewat skor model 90 dan tersimpan), dan
     * belum-terverifikasi berlabel "Perlu konfirmasi: ..." untuk
     * yang tertahan — keduanya TANPA sidik, tanpa dinilai model,
     * tanpa memakai jatah penilaian. Model sesudah ini hanya boleh
     * menggugurkan, tidak pernah meloloskan yang tertahan/gugur.
     * Kelas jurnal tidak lewat gerbang kitab ini (sumbernya tidak
     * punya sistem kategori kitab); ia dinilai gerbang jurnal G2
     * tepat di bawah. Buku web tetap pada periksa Tahap C + gerbang
     * relevansi kalimat seperti sebelumnya. */
    if (kelas === "masadir") {
      const gerbangKitab = gerbangKategoriKitab(
        {
          judul: kandidat.judul,
          kategoriKitab: kandidat.kategoriKitab,
          daftarIsi: kandidat.daftarIsi,
          teksParagraf: paragraf,
          judulProyek: opsi.judulProyek,
        },
        opsi.bidangId ?? "",
      );
      if (gerbangKitab.putusan !== "lolos") {
        penolakan.push({ judul: kandidat.judul, alasan: gerbangKitab.alasan });
        ditolakList.push({
          rujukan: kandidat,
          kalimatIdx: kalimatIdxKandidat,
          status: gerbangKitab.putusan,
          bidangSumber: gerbangKitab.labelKitab
            ? `Kategori kitab: ${kandidat.kategoriKitab ?? gerbangKitab.labelKitab}`
            : "",
          alasan: gerbangKitab.alasan,
        });
        continue;
      }
    }

    /* ---- Gerbang jurnal deterministik + veto model (Tahap G2) ----
     * Kandidat jurnal TIDAK lagi dinilai nilaiRelevansi langsung
     * terhadap kalimat tujuan seperti kelas lain. Ia dinilai fungsi
     * bersama nilaiBidangJurnal (label cabang dari metadata sumber
     * OpenAlex/DOAJ/nama jurnal + sembilan aturan; model hanya
     * veto) — standar yang sama persis dengan endpoint verifikasi
     * tambah jurnal dan periksa ulang titik pasang, supaya satu
     * kandidat tidak lolos di satu jalur dan gugur di jalur lain.
     * Konsekuensi yang disengaja: kecocokan kalimat per kalimat
     * untuk jurnal tidak lagi diputuskan skor model di loop ini;
     * urutan penawaran tetap dipimpin peringkat pencarian
     * (pilihRujukan) dan kalimat tujuan tetap dipilih pilihKalimat
     * seperti sebelumnya. Penilaian model di dalam fungsi bersama
     * memakai jatah penilaian generate ini. */
    if (kelas === "jurnal") {
      if (penilaianModel >= maksPenilaian) {
        jatahHabisAdaSisa = true;
        break;
      }
      const h = await nilaiBidangJurnal(
        {
          doi: kandidat.doi ?? undefined,
          judul: kandidat.judul,
          jurnal: kandidat.wadah || undefined,
          isi: kandidat.cuplikan,
        },
        konteks,
        opsi.kolam,
      );
      // Model benar-benar dipanggil hanya bila gerbang deterministik
      // meloloskan (tahap veto); kegagalan deterministik tidak
      // memakai jatah penilaian model.
      if (h.status === "terverifikasi" || h.kodeGerbang === "VETO_MODEL") {
        penilaianModel += 1;
      }
      if (h.status === "terverifikasi") {
        lolosList.push({
          rujukan: kandidat,
          kalimatIdx: kalimatIdxKandidat,
          skorModel: h.skorModel,
        });
        if (lolosList.length >= targetLolos) break;
        continue;
      }
      penolakan.push({ judul: kandidat.judul, alasan: h.alasan });
      ditolakList.push({
        rujukan: kandidat,
        kalimatIdx: kalimatIdxKandidat,
        status: h.status,
        bidangSumber: h.labelSumber?.length
          ? `Label sumber: ${h.labelSumber.join(", ")}`
          : "",
        alasan: h.alasan,
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
    ditolakList.push({
      rujukan: kandidat,
      kalimatIdx: kalimatIdxKandidat,
      // Model yang tidak menilai berarti kesesuaiannya belum terbukti
      // (belum-terverifikasi); penolakan yang benar-benar dinilai
      // berarti bidangnya tidak sesuai (gagal-bidang).
      status: nilai.statusPenilaian === "tidak-dinilai" ? "belum-terverifikasi" : "gagal-bidang",
      bidangSumber: nilai.bidangSumber,
      alasan: nilai.alasan,
    });
  }
  // Kandidat di luar jatah periksa juga dihitung sebagai sisa belum
  // dinilai bila loop berhenti karena target/jatah, bukan karena habis.
  if (!jatahHabisAdaSisa && urutan.length > maksPeriksa && lolosList.length < targetLolos) {
    jatahHabisAdaSisa = true;
  }

  const keKandidatHasil = async (n: NilaiKandidat): Promise<KandidatHasil> => {
    // Sidik diterbitkan HANYA untuk kandidat lolos (Tahap C):
    // pemasangannya berjalan lewat pasangFootnoteDisetujui yang
    // memeriksa ulang kelulusan kandidat ini persis.
    const sidik = sidikKandidatDariRujukan(n.rujukan);
    await terbitkanSidik(sidik, opsi.pemilik ?? "");
    const kalimatIsi = pilihKalimatIsi(n.rujukan.cuplikan, modeSeleksi ? seleksi : paragraf, {
      dariMasadir: apakahMasadir(n.rujukan),
    });
    return {
      sumber: rujukanKeSumber(n.rujukan),
      sidik,
      ...(kalimatIsi ? { kalimatIsi } : { tanpaKalimatIsi: true }),
      ...(typeof n.skorModel === "number" ? { skorModel: n.skorModel } : {}),
      ...(!(n.rujukan.halaman ?? "").trim() ? { halamanKosong: true } : {}),
    };
  };
  const keDitolakHasil = (t: DitolakKandidat): DitolakHasil => {
    const kalimatIsi = pilihKalimatIsi(t.rujukan.cuplikan, modeSeleksi ? seleksi : paragraf, {
      dariMasadir: apakahMasadir(t.rujukan),
    });
    return {
      sumber: rujukanKeSumber(t.rujukan),
      status: t.status,
      bidangSumber: t.bidangSumber,
      alasan: t.alasan,
      ...(kalimatIsi ? { kalimatIsi } : { tanpaKalimatIsi: true }),
      ...(!(t.rujukan.halaman ?? "").trim() ? { halamanKosong: true } : {}),
    };
  };

  /* ---- Hasil mode seleksi: daftar kandidat untuk dipilih ---- */
  if (modeSeleksi) {
    const kandidatHasil = await Promise.all(lolosList.map(keKandidatHasil));
    const ditolakHasil = ditolakList.slice(0, 5).map(keDitolakHasil);
    const catatanBagian: string[] = [];
    if (kandidatHasil.length === 0) {
      catatanBagian.push("Tidak ada kandidat yang lolos periksa untuk teks yang diblok ini.");
    } else if (kandidatHasil.length < 3) {
      catatanBagian.push(
        `Hanya ${kandidatHasil.length} kandidat yang lolos periksa dari ${Math.min(urutan.length, maksPeriksa)} yang diperiksa; tidak ada kandidat tambahan yang dikarang untuk mengejar jumlah.`,
      );
    }
    if (ditolakHasil.length > 0) {
      catatanBagian.push(
        `${ditolakHasil.length} kandidat tidak lolos periksa dan tidak bisa dipasang; putusannya tampil pada daftar ditolak di panel.`,
      );
    }
    if (!makna) {
      catatanBagian.push(
        "Analisis makna oleh model tidak tersedia, jadi pencarian berjalan dengan teks yang diblok apa adanya dan penilaian gerbang tanpa rumusan makna.",
      );
    }
    if (adaTidakDinilai) {
      catatanBagian.push(
        "Sebagian kandidat belum dinilai model (layanan AI terganggu atau kuota habis); kandidat itu masuk daftar ditolak sebagai belum terverifikasi, bukan diloloskan.",
      );
    }
    if (jatahHabisAdaSisa) {
      catatanBagian.push("Masih ada kandidat lain yang belum sempat dinilai pada generate ini; jalankan Generate lagi untuk menilai lebih banyak.");
    }
    return {
      ketemu: kandidatHasil.length > 0,
      kalimatIdx: indeksKalimatSeleksi(paragraf, seleksi),
      kandidat: kandidatHasil,
      ...(ditolakHasil.length > 0 ? { ditolak: ditolakHasil } : {}),
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

  // Tidak ada kandidat yang lolos: alur kursor TIDAK lagi menawarkan
  // kandidat tertahan untuk dipasang paksa (Tahap C mencabut jalur
  // perluKonfirmasi + sidik untuk kandidat tertahan). Yang tidak
  // lolos tampil sebagai daftar ditolak berlabel putusan; jalan
  // berikutnya adalah generate ulang atau Cari rujukan (AI).
  const ditolakHasil = ditolakList.slice(0, 3).map(keDitolakHasil);
  const teratasDitolak = ditolakHasil[0];
  return {
    ketemu: false,
    kalimatKunci,
    dariBank,
    dariSidik: Boolean(sidikLama),
    ...(penolakan.length > 0 ? { penolakan } : {}),
    ...(ditolakHasil.length > 0 ? { ditolak: ditolakHasil } : {}),
    catatan: jatahHabisAdaSisa
      ? "Kandidat yang tersedia belum sempat dinilai semua pada generate ini. Jalankan Generate footnote sekali lagi."
      : teratasDitolak
        ? `Tidak ada kandidat yang lolos periksa untuk paragraf ini. Kandidat teratas berstatus ${labelStatusVerifikasi(teratasDitolak.status)}: ${teratasDitolak.alasan} Kandidat yang tidak lolos periksa tidak bisa dipasang. Coba perjelas pokok datanya, atau cari lewat Cari rujukan (AI).`
        : "Belum ditemukan rujukan yang cukup relevan untuk paragraf ini. Coba perjelas pokok datanya, atau cari lewat Cari rujukan (AI) lalu pasang dengan dialog manual.",
  };
}
