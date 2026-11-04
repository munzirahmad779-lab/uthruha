/**
 * Marker sitasi (Urutan 2).
 * Format SIMPAN di draf:  [[ref:<id-sumber>|hlm:45|jilid:2]]
 * Format RENDER/EKSPOR:   footnote markdown [^n] + definisi, dihasilkan oleh
 * kompilasiMarker() dari data Sumber + gaya aktif — angka footnote tidak
 * pernah ditulis tangan user, jadi tidak ada nomor yang basi saat naskah
 * disusun ulang. Draf lama tanpa marker tidak berubah sama sekali.
 *
 * Tahap 5 (penanda tampil sebagai nomor di editor):
 * - pecahSegmen() memecah teks draf menjadi segmen teks / penanda /
 *   fragmen rusak; menggabungkan kembali semua `mentah` segmen SELALU
 *   menghasilkan teks asal persis (round-trip), jadi lapisan tampil boleh
 *   merender penanda sebagai chip bernomor tanpa mengubah format simpan.
 * - Penanda tak dikenal TIDAK lagi lolos sebagai teks mentah [[ref:…]] ke
 *   hasil kompilasi (dulu bocor ke DOCX, .md, dan tab Rujukan). Ia diganti
 *   teks peringatan yang terbaca manusia dan tetap dilaporkan lewat
 *   HasilKompilasi.takDikenal. Keluaran penanda yang DIKENAL tidak berubah.
 */
import { footnoteGaya, footnotePedoman, footnoteSingkat, gayaSah } from "@/lib/engine/citation";
import type { Project } from "@/lib/engine/project";

export interface MarkerSitasi {
  mentah: string;
  id: string;
  halaman?: string;
  jilid?: string;
  posisi: number;
}

/**
 * Pola penanda sah. Kelompok id TIDAK boleh memuat spasi, kurung siku,
 * atau pipa: id sumber selalu dicetak mesin (src-…, ref-…, hash stabil)
 * tanpa karakter itu. Kelas id yang longgar adalah cacat nyata: penanda
 * patah "[[ref:src-c …" bisa menelan penanda sah berikutnya sampai
 * "]]" miliknya dan terbaca sebagai satu penanda raksasa ber-id sampah
 * (kelas kerusakan B3). Pengetatan ini hanya menolak bentuk yang tidak
 * pernah dihasilkan pencetak penanda mana pun.
 */
const POLA = /\[\[ref:([^\s\]|[]+)(?:\|hlm:([^\]|]*))?(?:\|jilid:([^\]]*))?\]\]/g;

export function cariMarker(teks: string): MarkerSitasi[] {
  const hasil: MarkerSitasi[] = [];
  for (const m of teks.matchAll(POLA)) {
    hasil.push({
      mentah: m[0],
      id: m[1].trim(),
      halaman: m[2]?.trim() || undefined,
      jilid: m[3]?.trim() || undefined,
      posisi: m.index ?? 0,
    });
  }
  return hasil;
}

export function buatMarker(id: string, halaman?: string, jilid?: string): string {
  const bag = [`[[ref:${id}`];
  if (halaman) bag.push(`hlm:${halaman}`);
  if (jilid) bag.push(`jilid:${jilid}`);
  return `${bag.join("|")}]]`;
}

/* ------------------------------------------------------------------ */
/* Segmen teks draf: teks biasa, penanda utuh, fragmen penanda rusak.  */
/* ------------------------------------------------------------------ */

export type SegmenPenanda =
  | { jenis: "teks"; mentah: string }
  | { jenis: "penanda"; mentah: string; id: string; halaman?: string; jilid?: string }
  | { jenis: "fragmen"; mentah: string; posisi: number };

/**
 * Pecah teks menjadi segmen untuk lapisan tampil editor. Aturan fragmen
 * meniru pembersih fragmen yang sudah ada di tab Tulis sejak 914a005:
 * blok "[[…" yang tidak membentuk penanda sah adalah fragmen sampai
 * "]]" terdekat (jendela 100 karakter) atau sampai spasi; sisa "ref:…"
 * yatim di luar penanda juga fragmen. Gabungan `mentah` semua segmen
 * selalu sama persis dengan teks masukan.
 */
export function pecahSegmen(teks: string): SegmenPenanda[] {
  const hasil: SegmenPenanda[] = [];
  const validDi = new RegExp(POLA.source, "y");
  let berjalan = "";
  const tumpah = () => {
    if (berjalan) {
      hasil.push({ jenis: "teks", mentah: berjalan });
      berjalan = "";
    }
  };
  let i = 0;
  while (i < teks.length) {
    if (teks.startsWith("[[", i)) {
      validDi.lastIndex = i;
      const cocok = validDi.exec(teks);
      if (cocok && cocok.index === i) {
        tumpah();
        hasil.push({
          jenis: "penanda",
          mentah: cocok[0],
          id: (cocok[1] ?? "").trim(),
          halaman: cocok[2]?.trim() || undefined,
          jilid: cocok[3]?.trim() || undefined,
        });
        i += cocok[0].length;
        continue;
      }
      const tutup = teks.indexOf("]]", i);
      let akhir: number;
      if (tutup !== -1 && tutup - i < 100) {
        akhir = tutup + 2;
        // Di dalam jendela "]]" ini, penanda SAH yang mulai lebih dulu
        // tidak boleh ikut tertelan: fragmen berhenti tepat di depannya.
        // (Di luar jendela, konsumsi berhenti di spasi pertama sehingga
        // penanda berikutnya tidak pernah tertelan dan prosa di antara
        // keduanya tidak ikut menjadi fragmen.)
        const sarang = teks.indexOf("[[", i + 2);
        if (sarang !== -1 && sarang < tutup) {
          validDi.lastIndex = sarang;
          const m2 = validDi.exec(teks);
          if (m2 && m2.index === sarang) akhir = sarang;
        }
      } else {
        let j = i;
        while (j < teks.length && !/\s/.test(teks[j] ?? "")) j++;
        akhir = j;
      }
      tumpah();
      hasil.push({ jenis: "fragmen", mentah: teks.slice(i, akhir), posisi: i });
      i = akhir;
      continue;
    }
    if (teks.startsWith("ref:", i)) {
      let j = i;
      while (j < teks.length && !/[\s\]]/.test(teks[j] ?? "")) j++;
      if (teks.slice(j, j + 2) === "]]") j += 2;
      else if (teks[j] === "]") j++;
      tumpah();
      hasil.push({ jenis: "fragmen", mentah: teks.slice(i, j), posisi: i });
      i = j;
      continue;
    }
    berjalan += teks[i];
    i++;
  }
  tumpah();
  return hasil;
}

/** Fragmen penanda rusak dalam teks (untuk pemeriksa sitasi). */
export function cariFragmen(teks: string): { mentah: string; posisi: number }[] {
  return pecahSegmen(teks)
    .filter((s): s is Extract<SegmenPenanda, { jenis: "fragmen" }> => s.jenis === "fragmen")
    .map((s) => ({ mentah: s.mentah, posisi: s.posisi }));
}

/* ------------------------------------------------------------------ */
/* Kompilasi penanda menjadi footnote bernomor.                        */
/* ------------------------------------------------------------------ */

/** Teks pengganti penanda yang rujukannya tidak ditemukan: terlihat
 *  jelas oleh manusia di naskah hasil ekspor, bukan kode mentah. */
export function teksPenandaTakDikenal(id: string): string {
  return `[⚠ rujukan tidak ditemukan: ${id}]`;
}

/** Teks pengganti fragmen penanda yang patah di hasil kompilasi:
 *  sisa penanda rusak tidak tampil mentah di naskah hasil ekspor. */
export function teksPenandaRusak(): string {
  return "[⚠ penanda sitasi rusak]";
}

export interface EntriKompilasi {
  nomor: number;
  /** Teks footnote lengkap (tanpa awalan [^n]:). */
  teks: string;
}

export interface HasilProsesKompilasi {
  /** Teks dengan penanda diganti [^n] (dikenal) atau teks peringatan (tak dikenal). */
  diganti: string;
  /** Definisi footnote BARU yang lahir dari teks ini, berurutan. */
  entriBaru: EntriKompilasi[];
}

export interface Kompilator {
  proses: (teks: string) => HasilProsesKompilasi;
  readonly takDikenal: MarkerSitasi[];
  /** Fragmen penanda rusak yang diganti teks peringatan selama proses. */
  readonly fragmen: { mentah: string; posisi: number }[];
  readonly jumlah: number;
  readonly definisi: string[];
}

/**
 * Kompilator berkeadaan: penomoran PER KEMUNCULAN mengikuti urutan
 * pemrosesan (kaidah catatan kaki). Kemunculan pertama satu sumber =
 * bentuk penuh; kemunculan berikutnya = bentuk singkat. Dipakai
 * kompilasiMarker (satu dokumen utuh) dan kompilasi per bagian
 * (footnote-bagian) yang menyemai keadaan dari bagian-bagian sebelumnya
 * agar nomornya cocok dengan dokumen utuh.
 */
export function buatKompilator(p: Project): Kompilator {
  const gaya = gayaSah(p.gayaSitasi);
  const perId = new Map(p.sumber.map((s) => [s.id, s]));
  const definisi: string[] = [];
  const takDikenal: MarkerSitasi[] = [];
  const fragmen: { mentah: string; posisi: number }[] = [];
  const sudahDikutip = new Set<string>();
  let jumlah = 0;

  return {
    takDikenal,
    fragmen,
    get jumlah() {
      return jumlah;
    },
    definisi,
    proses(teks: string) {
      const entriBaru: EntriKompilasi[] = [];
      const sesudahPenanda = teks.replace(POLA, (mentah, idRaw: string, hlm?: string, jil?: string) => {
        const id = idRaw.trim();
        const sumber = perId.get(id);
        if (!sumber) {
          takDikenal.push({ mentah, id, halaman: hlm, jilid: jil, posisi: 0 });
          return teksPenandaTakDikenal(id);
        }
        const nomor = definisi.length + 1;
        const opsi = { halaman: hlm?.trim() || undefined, jilid: jil?.trim() || undefined };
        const pertama = !sudahDikutip.has(id);
        sudahDikutip.add(id);
        // Pedoman kampus adalah lapisan teratas: bila proyek punya pedoman,
        // template footnote pedoman yang dipakai, bukan gaya proyek.
        const teksFootnote = p.pedoman?.formatFootnote
          ? pertama
            ? footnotePedoman(sumber, p.pedoman, opsi)
            : footnoteSingkat(sumber, opsi, p.pedoman.angkaArab)
          : pertama || gaya === "apa7"
            ? footnoteGaya(sumber, gaya, opsi)
            : footnoteSingkat(sumber, opsi, false);
        definisi.push(`[^${nomor}]: ${teksFootnote}`);
        entriBaru.push({ nomor, teks: teksFootnote });
        jumlah++;
        return `[^${nomor}]`;
      });
      // Lintas kedua: fragmen penanda yang patah diganti teks peringatan
      // yang sama kelasnya dengan penanda tak dikenal, supaya sisa
      // penanda rusak tidak tampil mentah di naskah hasil ekspor.
      // Tokenisasi pecahSegmen menjamin penanda sah tidak tertelan
      // fragmen dan teks di luar fragmen tidak berubah.
      const diganti = pecahSegmen(sesudahPenanda)
        .map((s) => {
          if (s.jenis !== "fragmen") return s.mentah;
          fragmen.push({ mentah: s.mentah, posisi: s.posisi });
          return teksPenandaRusak();
        })
        .join("");
      return { diganti, entriBaru };
    },
  };
}

export interface HasilKompilasi {
  markdown: string;
  /** Marker yang id-nya tidak ditemukan di sumber proyek — JANGAN dibuang diam-diam. */
  takDikenal: MarkerSitasi[];
  /** Fragmen penanda rusak yang diganti teks peringatan. */
  fragmen: { mentah: string; posisi: number }[];
  jumlah: number;
}

/**
 * Kompilasi seluruh marker dalam satu markdown menjadi footnote [^n].
 * Penomoran mengikuti urutan kemunculan di dokumen gabungan.
 * Marker tak dikenal diganti teks peringatan yang terbaca manusia
 * (teksPenandaTakDikenal) dan dilaporkan lewat `takDikenal`; ia tidak
 * memakan nomor footnote.
 */
export function kompilasiMarker(markdown: string, p: Project): HasilKompilasi {
  const k = buatKompilator(p);
  const { diganti } = k.proses(markdown);
  return {
    markdown: k.definisi.length > 0 ? `${diganti}\n\n${k.definisi.join("\n")}` : diganti,
    takDikenal: k.takDikenal,
    fragmen: k.fragmen,
    jumlah: k.jumlah,
  };
}
