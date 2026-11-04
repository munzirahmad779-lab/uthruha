/**
 * Analisis istilah sadar isi draf (Pembangunan Ulang Tahap 9, B11).
 *
 * Cacat lama: Tab Istilah menghitung kemunculan padanan Arab dengan
 * regex mentah atas string padanan persis, dan chip sarannya berasal
 * dari daftar teori bidang statis. Padanan dari chip teori menyimpan
 * string penuh termasuk rincian dalam kurung (mis. "مناهج التفسير
 * (التحليلي، ...)") yang tidak akan pernah muncul utuh di draf, dan
 * draf berharakat tidak cocok dengan padanan tanpa harakat, sehingga
 * istilah yang benar-benar dipakai terbaca "Muncul di draf 0 kali".
 *
 * Modul ini adalah satu-satunya penghitung yang dipakai tab:
 * - Teks yang dibaca adalah gabungan SEMUA bagian draf proyek itu
 *   sendiri (lokal, tidak dikirim ke mana pun).
 * - Pencocokan per KATA UTUH dari tokenisasi teks: frasa cocok bila
 *   urutan tokennya sama persis sesudah normalisasi; kata yang hanya
 *   menjadi bagian kata lain tidak terhitung.
 * - Normalisasi DASAR (dipakai hitungan utama): harakat dan tatwil
 *   dibuang (selaras HARAKAT di orthografi.ts), bentuk alif disatukan
 *   (أ إ آ ٱ menjadi ا), alif maqsurah menjadi ya, huruf Latin
 *   direndahkan. Perbedaan ejaan selebihnya TIDAK dihapus diam-diam.
 * - Normalisasi LONGGAR (hanya untuk mendeteksi varian, tidak pernah
 *   masuk hitungan utama): dasar ditambah ta marbuta menjadi ha,
 *   hamzah berkursi waw/ya menjadi hamzah tunggal. Kemunculan yang
 *   hanya cocok pada lapis longgar dilaporkan sebagai VARIAN bentuk,
 *   lengkap dengan kutipan teks drafnya, agar mahasiswa menyamakan
 *   sendiri ke bentuk tetap.
 * - PARTIKEL MENEMPEL (perbaikan telaah Tahap 9, S1): partikel
 *   konsonan tunggal Arab (و/ف/ب/ل/ك) yang menempel di awal kata
 *   bukan bagian kata itu, jadi token DRAF dicocokkan juga dalam
 *   bentuk terlunasi partikelnya: "والعلم" adalah "العلم" berawalan
 *   و, "بالعلم" adalah "العلم" berawalan ب. Tanpa ini kemunculan
 *   berpartikel lenyap dari kedua lapis dan istilah terbaca 0
 *   padahal dipakai. Aturannya dinyatakan dan dibatasi: pelucutan
 *   maksimal dua lapis, lapis kedua hanya pola partikel + alif lam
 *   (وبالعلم menjadi العلم); sisa kata sesudah dilucuti wajib
 *   minimal 3 huruf agar huruf akar tidak termakan (وضع، وصف، ورد
 *   tidak pernah dilucuti menjadi ضع، صف، رد); yang dilucuti hanya
 *   token draf, frasa yang dicari tidak pernah dilucuti, jadi beda
 *   alif lam tetap tidak cocok (frasa "علم" tidak cocok dengan
 *   "العلم"); dan bentuk yang alif lamnya terasimilasi dalam
 *   tulisan (للعلم، للمدرسة) tidak dilucuti ke bentuk tetap.
 * - Hitungan padanan memakai BENTUK INTI dari ar tersimpan
 *   (perbaikan telaah Tahap 9, S2): istilah yang disimpan chip lama
 *   membawa string penuh berketerangan kurung; di lapis baca ia
 *   dihitung dari intinya, sama seperti data tercemar Tahap 6
 *   dibersihkan saat dibaca. Data tersimpan tidak diubah dan
 *   tampilan padanan tetap apa adanya.
 */
import type { Istilah, Project } from "@/lib/engine/project";

export interface HitunganFrasa {
  /** Kemunculan bentuk persis sesudah normalisasi dasar. */
  dasar: number;
  /** Kemunculan yang hanya cocok pada normalisasi longgar. */
  varian: number;
  /** Potongan teks draf pada kemunculan varian pertama (bila ada). */
  kutipanVarian: string;
}

export interface AnalisisIstilah {
  istilah: Istilah;
  /** Kemunculan padanan Arab bentuk tetap di draf. */
  munculAr: number;
  /** Kemunculan varian penulisan padanan di draf (di luar bentuk tetap). */
  varianAr: number;
  /** Kutipan varian pertama dari draf (bila ada). */
  kutipanVarian: string;
  /** Kemunculan label Indonesia/Latin di draf. */
  munculLabel: number;
}

export type StatusIstilah = "dipakai" | "varian" | "label-saja" | "tidak-muncul";

export interface SaranIstilah {
  /** Bentuk inti padanan (rincian kurung teori dibuang). */
  ar: string;
  id: string;
  munculAr: number;
  munculLabel: number;
}

/** Gabungan semua teks draf proyek, urutan bagian terurut agar hasil deterministik. */
export function teksDrafProyek(p: Pick<Project, "draf">): string {
  return Object.keys(p.draf ?? {})
    .sort()
    .map((k) => p.draf[k] ?? "")
    .join("\n");
}

const HARAKAT_DAN_TATWIL = /[\u064B-\u0652\u0670\u0640]/g;

/** Normalisasi dasar satu kata: lihat kepala berkas untuk aturannya. */
export function normalisasiDasarKata(kata: string): string {
  return kata
    .replace(HARAKAT_DAN_TATWIL, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "ا")
    .replace(/\u0649/g, "ي")
    .toLowerCase();
}

/** Normalisasi longgar satu kata untuk deteksi varian penulisan. */
export function normalisasiLonggarKata(kata: string): string {
  return normalisasiDasarKata(kata)
    .replace(/\u0629/g, "ه")
    .replace(/\u0624/g, "ء")
    .replace(/\u0626/g, "ء");
}

interface Token {
  asli: string;
  dasar: string;
  longgar: string;
}

function tokenisasi(teks: string): Token[] {
  const hasil: Token[] = [];
  for (const m of teks.matchAll(/[\p{L}\p{N}\p{M}]+/gu)) {
    hasil.push({
      asli: m[0],
      dasar: normalisasiDasarKata(m[0]),
      longgar: normalisasiLonggarKata(m[0]),
    });
  }
  return hasil;
}

function tokenFrasa(frasa: string): Token[] {
  return tokenisasi(frasa).filter((t) => t.dasar.length > 0);
}

/** Kunci teks ternormalisasi dasar, untuk perbandingan label dan padanan. */
export function kunciTeks(s: string): string {
  return tokenFrasa(s)
    .map((t) => t.dasar)
    .join(" ");
}

const PARTIKEL_DEPAN = "وفبلك";
const PARTIKEL_SEBELUM_LAM = "بلك";

/**
 * Bentuk-bentuk satu token DRAF untuk pencocokan: token itu sendiri
 * plus bentuk terlunasi partikel depannya (aturan dan batasnya di
 * kepala berkas). Hanya dipanggil untuk token draf; token frasa
 * tidak pernah melewati fungsi ini.
 */
function bentukTokenDraf(kata: string): string[] {
  const hasil = [kata];
  if (kata.length >= 4 && PARTIKEL_DEPAN.includes(kata[0])) {
    const sisa = kata.slice(1);
    hasil.push(sisa);
    if (sisa.length >= 4 && PARTIKEL_SEBELUM_LAM.includes(sisa[0]) && sisa[1] === "ا") {
      hasil.push(sisa.slice(1));
    }
  }
  return hasil;
}

/**
 * Hitung kemunculan frasa di teks dengan jendela token: setiap posisi
 * awal token diperiksa; jendela yang cocok dasar dihitung dasar,
 * jendela yang hanya cocok longgar dihitung varian. Token draf cocok
 * dengan token frasa bila salah satu bentuknya (utuh atau terlunasi
 * partikel) sama dengan token frasa itu.
 */
export function hitungFrasa(teks: string, frasa: string): HitunganFrasa {
  const pola = tokenFrasa(frasa);
  if (pola.length === 0 || !teks) return { dasar: 0, varian: 0, kutipanVarian: "" };
  const token = tokenisasi(teks);
  const bentukDasar = token.map((t) => bentukTokenDraf(t.dasar));
  const bentukLonggar = token.map((t) => bentukTokenDraf(t.longgar));
  let dasar = 0;
  let varian = 0;
  let kutipanVarian = "";
  for (let i = 0; i + pola.length <= token.length; i++) {
    let cocokDasar = true;
    let cocokLonggar = true;
    for (let j = 0; j < pola.length; j++) {
      if (!bentukDasar[i + j].includes(pola[j].dasar)) cocokDasar = false;
      if (!bentukLonggar[i + j].includes(pola[j].longgar)) cocokLonggar = false;
      if (!cocokDasar && !cocokLonggar) break;
    }
    if (cocokDasar) dasar++;
    else if (cocokLonggar) {
      varian++;
      if (!kutipanVarian) {
        kutipanVarian = token
          .slice(i, i + pola.length)
          .map((t) => t.asli)
          .join(" ");
      }
    }
  }
  return { dasar, varian, kutipanVarian };
}

/**
 * Analisis semua istilah proyek terhadap draf proyek itu sendiri.
 * Murni: tidak mengubah proyek. Padanan dihitung dari BENTUK INTI ar
 * tersimpan (S2 telaah Tahap 9): data warisan chip lama yang masih
 * membawa rincian kurung ikut terhitung dari intinya di lapis baca
 * ini, sementara data tersimpan dan tampilannya tetap apa adanya.
 */
export function analisisIstilahProyek(p: Pick<Project, "draf" | "istilah">): AnalisisIstilah[] {
  const teks = teksDrafProyek(p);
  return (p.istilah ?? []).map((istilah) => {
    const ar = hitungFrasa(teks, bentukIntiAr(istilah.ar ?? ""));
    const label = hitungFrasa(teks, (istilah.id_label ?? "").trim());
    return {
      istilah,
      munculAr: ar.dasar,
      varianAr: ar.varian,
      kutipanVarian: ar.kutipanVarian,
      munculLabel: label.dasar,
    };
  });
}

/** Status turunan satu istilah dari hitungannya, untuk penanda di tab. */
export function statusIstilah(a: AnalisisIstilah): StatusIstilah {
  if (a.munculAr > 0) return "dipakai";
  if (a.varianAr > 0) return "varian";
  if (a.munculLabel > 0) return "label-saja";
  return "tidak-muncul";
}

/**
 * Konflik padanan: satu label yang sama (sesudah normalisasi) dipasangi
 * lebih dari satu padanan yang berbeda. Logika lama tab, dipindah ke
 * sini agar teruji; perbandingan kini memakai normalisasi dasar yang
 * sama dengan penghitung, jadi beda harakat tidak dianggap beda padanan.
 * Kunci padanan memakai BENTUK INTI (S2 telaah Tahap 9): entri warisan
 * berketerangan kurung dan entri inti dengan label sama terkelompok
 * sebagai padanan yang sama, bukan konflik semu dan bukan luput.
 * Entri berpadanan kosong dilewati dari perbandingan (R1 telaah
 * Tahap 9): padanan yang hilang bukan padanan yang berbeda, jadi ia
 * tidak membentuk dan tidak ikut grup konflik.
 */
export function konflikPadanan(istilah: Istilah[]): Istilah[][] {
  const grup = new Map<string, Istilah[]>();
  for (const t of istilah ?? []) {
    if (!(t.id_label ?? "").trim()) continue;
    const k = kunciTeks(t.id_label);
    if (!k) continue;
    grup.set(k, [...(grup.get(k) ?? []), t]);
  }
  return Array.from(grup.values()).filter((g) => {
    const padananBerbeda = new Set(
      g.map((x) => kunciTeks(bentukIntiAr(x.ar ?? ""))).filter((k) => k.length > 0),
    );
    return padananBerbeda.size > 1;
  });
}

/**
 * Bentuk inti padanan dari entri teori bidang: rincian dalam kurung
 * (mis. "(التحليلي، الإجمالي، ...)") bukan bagian istilahnya. Chip lama
 * menampilkan bentuk ini tetapi menyimpan string penuh, itulah akar
 * hitungan 0 pada B11.
 */
export function bentukIntiAr(ar: string): string {
  return (ar ?? "").split("(")[0].trim();
}

/**
 * Saran istilah DARI isi draf: kandidat teori bidang yang bentuk inti
 * padanannya atau labelnya benar-benar muncul di draf proyek, diurutkan
 * dari yang paling sering muncul. Kandidat yang sudah menjadi istilah
 * proyek dan kandidat tanpa kemunculan tidak disajikan di sini, jadi
 * saran ini tidak pernah menyajikan hitungan 0 seolah temuan draf.
 */
export function saranDariDraf(
  p: Pick<Project, "draf" | "istilah">,
  kandidat: { ar: string; id: string }[],
): SaranIstilah[] {
  const teks = teksDrafProyek(p);
  const sudahAda = new Set(
    (p.istilah ?? []).map((t) => kunciTeks(bentukIntiAr(t.ar ?? ""))).filter(Boolean),
  );
  const hasil: (SaranIstilah & { urutan: number })[] = [];
  (kandidat ?? []).forEach((k, i) => {
    const inti = bentukIntiAr(k.ar ?? "");
    if (!inti) return;
    if (sudahAda.has(kunciTeks(inti))) return;
    const munculAr = hitungFrasa(teks, inti).dasar;
    const munculLabel = hitungFrasa(teks, (k.id ?? "").trim()).dasar;
    if (munculAr + munculLabel === 0) return;
    hasil.push({ ar: inti, id: k.id, munculAr, munculLabel, urutan: i });
  });
  return hasil
    .sort((a, b) => b.munculAr + b.munculLabel - (a.munculAr + a.munculLabel) || a.urutan - b.urutan)
    .map(({ urutan: _urutan, ...s }) => s);
}
