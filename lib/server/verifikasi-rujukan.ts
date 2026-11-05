/**
 * Verifikasi rujukan hasil pencarian jurnal SEBELUM boleh ditambahkan
 * (Aturan Pencarian Valid, perintah pemilik 5 Nov 2026).
 *
 * Latar: pada rekaman tutorial lama, jurnal ekonomi التكامل الاقتصادي
 * (DOI 10.12816/0032787, artikel perjanjian perdagangan regional) masuk
 * draf proyek takamul المعرفي hanya karena tombol Tambah di panel topik
 * tidak memeriksa apa pun selain duplikat. Padahal metadata Crossref
 * jurnal itu COCOK PERSIS: yang menggagalkannya adalah bidangnya.
 * Karena itu periksa di sini DUA lapis, dan keduanya syarat mutlak:
 *
 *  1. METADATA dari rekod hidup Crossref: DOI (atau judul) harus
 *     menunjuk karya yang judul, nama jurnal, dan tahunnya sama dengan
 *     kartu yang tampil. DOI karangan gugur di sini.
 *  2. BIDANG lewat gerbang relevansi yang sama dengan Generate Footnote
 *     (nilaiUntukCariRujukan), dengan pemetaan BLOKIR KERAS: perluKonfirmasi
 *     dari gerbang di jalur ini berarti TIDAK lolos. Putusan pemilik
 *     5 Nov 2026 15:57 mencabut jalur konfirmasi sadar untuk kandidat
 *     yang gagal atau belum terverifikasi di semua jalur pencarian:
 *     "jangan sampai ada celah rujukan palsu masuk".
 *
 * Yang tidak bisa diperiksa (Crossref tidak menjawab, model penilaian
 * tidak berjalan) berstatus "belum-terverifikasi" dan DIPERLAKUKAN
 * TERTAHAN: tidak ada status abu-abu yang bisa ditambahkan.
 */
import { kemiripanJudul, normalisasiDoi, normalisasiJudul } from "@/lib/engine/referensi";
import {
  nilaiUntukCariRujukan,
  type KonteksProyek,
} from "./gerbang-relevansi";
import { opsiKolamUntuk } from "./kunci-pribadi";
import type { Pengguna } from "./identitas";

/** Ambang kemiripan judul 0..1 agar kartu dinyatakan menunjuk karya
 *  yang sama dengan rekod Crossref. Angka 0,6 meniru standar yang sudah
 *  berjalan di verifikasiDoi (lib/engine/validasi-ref.ts): kemiripan
 *  >= 0,6 di sana dinyatakan "cocok", di bawahnya "tidak-cocok". */
export const AMBANG_KEMIRIPAN_JUDUL = 0.6;

/** Ambang kemiripan nama jurnal; selain kemiripan, penahanan
 *  (containment) dua arah pada bentuk ternormalisasi juga meloloskan,
 *  karena nama jurnal sering tampil panjang-pendek antar indeks
 *  (mis. dengan atau tanpa nama penerbit di depannya). */
export const AMBANG_KEMIRIPAN_JURNAL = 0.6;

/** Kandidat hasil pencarian jurnal yang akan diperiksa, persis seperti
 *  yang tampil pada kartunya (bukan data tambahan karangan pemanggil). */
export interface KandidatVerifikasi {
  id: string;
  doi?: string;
  judul: string;
  jurnal?: string;
  /** Tahun terbit pada kartu, bentuk teks ("2018") seperti Sumber. */
  tahun?: string;
  jenis?: string;
}

/** Rekod resmi Crossref yang menjadi pembanding kartu. */
export interface RekodCrossref {
  judul: string;
  jurnal?: string;
  tahun?: string;
  doi?: string;
}

export type StatusVerifikasi =
  | "terverifikasi"
  | "gagal-metadata"
  | "gagal-bidang"
  | "belum-terverifikasi";

export interface PutusanVerifikasi {
  id: string;
  status: StatusVerifikasi;
  /** Alasan Bahasa Indonesia yang menyebut bukti (termasuk nilai rekod
   *  asli bila kartu berbeda darinya). */
  alasan: string;
  /** Rekod Crossref pembanding, bila berhasil dibaca. */
  rekod?: RekodCrossref;
}

/** Hasil periksa metadata saja (sebelum penilaian bidang). */
export interface HasilMetadata {
  status: "lolos" | "gagal-metadata" | "belum-terverifikasi";
  alasan: string;
  rekod?: RekodCrossref;
}

/**
 * Bandingkan kartu kandidat dengan satu rekod Crossref. MURNI, tanpa
 * jaringan, agar bisa diuji langsung: di sinilah DOI asli dengan judul
 * kartu yang dipalsukan gugur, dan jurnal atau tahun yang berbeda gugur.
 */
export function bandingkanDenganRekod(
  kartu: KandidatVerifikasi,
  rekod: RekodCrossref,
): HasilMetadata {
  const simJudul = kemiripanJudul(kartu.judul, rekod.judul);
  if (simJudul < AMBANG_KEMIRIPAN_JUDUL) {
    return {
      status: "gagal-metadata",
      alasan: `Judul pada kartu tidak cocok dengan rekod Crossref. Rekod aslinya berjudul "${rekod.judul}" (kemiripan hanya ${Math.round(simJudul * 100)}%).`,
      rekod,
    };
  }

  // Nama jurnal: lewati bila kartu tidak membawa nama jurnal (beberapa
  // indeks memang tidak mengirimnya), dan nyatakan itu di alasan akhir.
  let catatanJurnal = "";
  if (kartu.jurnal && kartu.jurnal.trim()) {
    if (!rekod.jurnal || !rekod.jurnal.trim()) {
      return {
        status: "belum-terverifikasi",
        alasan: `Nama jurnal pada kartu ("${kartu.jurnal}") tidak bisa dicocokkan karena rekod Crossref karya ini tidak mencantumkan nama jurnal.`,
        rekod,
      };
    }
    const jKartu = normalisasiJudul(kartu.jurnal);
    const jRekod = normalisasiJudul(rekod.jurnal);
    const tertahan = jKartu.includes(jRekod) || jRekod.includes(jKartu);
    if (!tertahan && kemiripanJudul(kartu.jurnal, rekod.jurnal) < AMBANG_KEMIRIPAN_JURNAL) {
      return {
        status: "gagal-metadata",
        alasan: `Nama jurnal pada kartu ("${kartu.jurnal}") berbeda dari rekod Crossref ("${rekod.jurnal}").`,
        rekod,
      };
    }
  } else {
    catatanJurnal = " Kartu tidak membawa nama jurnal, jadi nama jurnal tidak ikut dicocokkan.";
  }

  // Tahun: beda tahun berarti karya atau edisi yang berbeda; tahun yang
  // hilang di salah satu sisi membuat kecocokan tidak bisa ditegakkan.
  const tahunKartu = (kartu.tahun ?? "").trim();
  const tahunRekod = (rekod.tahun ?? "").trim();
  if (tahunKartu && tahunRekod && tahunKartu !== tahunRekod) {
    return {
      status: "gagal-metadata",
      alasan: `Tahun pada kartu (${tahunKartu}) berbeda dari rekod Crossref (${tahunRekod}).`,
      rekod,
    };
  }
  if (!tahunKartu || !tahunRekod) {
    return {
      status: "belum-terverifikasi",
      alasan: `Tahun terbit tidak terbaca lengkap (kartu: ${tahunKartu || "kosong"}; rekod Crossref: ${tahunRekod || "kosong"}), jadi kecocokan metadata belum bisa ditegakkan.`,
      rekod,
    };
  }

  return {
    status: "lolos",
    alasan: `Metadata cocok dengan rekod Crossref (judul sama, jurnal "${rekod.jurnal ?? kartu.jurnal ?? ""}", tahun ${tahunRekod}).${catatanJurnal}`,
    rekod,
  };
}

interface ItemCrossrefMentah {
  title?: string[];
  "container-title"?: string[];
  DOI?: string;
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  created?: { "date-parts"?: number[][] };
}

function tahunDariItem(it: ItemCrossrefMentah): string | undefined {
  for (const kunci of ["issued", "published", "published-print", "published-online", "created"] as const) {
    const tahun = it[kunci]?.["date-parts"]?.[0]?.[0];
    if (typeof tahun === "number" && tahun > 0) return String(tahun);
  }
  return undefined;
}

function itemKeRekod(it: ItemCrossrefMentah): RekodCrossref | null {
  const judul = (it.title?.[0] ?? "").trim();
  if (!judul) return null;
  return {
    judul,
    jurnal: (it["container-title"]?.[0] ?? "").trim() || undefined,
    tahun: tahunDariItem(it),
    doi: it.DOI ? String(it.DOI) : undefined,
  };
}

const KEPALA_CROSSREF = {
  "User-Agent": "UthruhaAcademic/1.0 (mailto:peneliti@uthruha.id)",
  Accept: "application/json",
};

/**
 * Periksa metadata satu kandidat ke Crossref hidup.
 * Ada DOI: ambil rekod per DOI. Tanpa DOI: cari per judul dan ambil
 * rekod berkemiripan tertinggi; di bawah ambang berarti judul itu tidak
 * ditemukan persis, jadi kandidat belum terverifikasi (tertahan).
 */
export async function periksaMetadata(k: KandidatVerifikasi): Promise<HasilMetadata> {
  const doi = normalisasiDoi(k.doi);

  if (doi) {
    let res: Response;
    try {
      res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
        headers: KEPALA_CROSSREF,
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return {
        status: "belum-terverifikasi",
        alasan: "Crossref tidak menjawab saat DOI diperiksa (jaringan atau batas waktu), jadi karya ini belum terverifikasi.",
      };
    }
    if (res.status === 404) {
      return {
        status: "gagal-metadata",
        alasan: `DOI ${doi} tidak ditemukan di Crossref. DOI yang tidak terdaftar tidak bisa ditambahkan.`,
      };
    }
    if (!res.ok) {
      return {
        status: "belum-terverifikasi",
        alasan: `Crossref menjawab HTTP ${res.status} saat DOI diperiksa, jadi karya ini belum terverifikasi.`,
      };
    }
    let item: ItemCrossrefMentah | null = null;
    try {
      item = ((await res.json()) as { message?: ItemCrossrefMentah })?.message ?? null;
    } catch {
      item = null;
    }
    const rekod = item ? itemKeRekod(item) : null;
    if (!rekod) {
      return {
        status: "belum-terverifikasi",
        alasan: "Rekod Crossref untuk DOI ini tidak terbaca judulnya, jadi karya ini belum terverifikasi.",
      };
    }
    return bandingkanDenganRekod(k, rekod);
  }

  // Tanpa DOI: satu-satunya jangkar adalah judul yang ditemukan persis.
  let items: ItemCrossrefMentah[] = [];
  try {
    const params = new URLSearchParams({
      "query.bibliographic": k.judul,
      rows: "5",
      filter: "type:journal-article",
      select: "title,container-title,DOI,issued,published,published-print,published-online,created",
    });
    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: KEPALA_CROSSREF,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        status: "belum-terverifikasi",
        alasan: `Crossref menjawab HTTP ${res.status} saat judul dicari, jadi karya ini belum terverifikasi.`,
      };
    }
    const data = (await res.json()) as { message?: { items?: ItemCrossrefMentah[] } };
    items = data?.message?.items ?? [];
  } catch {
    return {
      status: "belum-terverifikasi",
      alasan: "Crossref tidak menjawab saat judul dicari (jaringan atau batas waktu), jadi karya ini belum terverifikasi.",
    };
  }
  let terbaik: { rekod: RekodCrossref; sim: number } | null = null;
  for (const it of items) {
    const rekod = itemKeRekod(it);
    if (!rekod) continue;
    const sim = kemiripanJudul(k.judul, rekod.judul);
    if (!terbaik || sim > terbaik.sim) terbaik = { rekod, sim };
  }
  if (!terbaik || terbaik.sim < AMBANG_KEMIRIPAN_JUDUL) {
    return {
      status: "belum-terverifikasi",
      alasan: `Judul ini tidak ditemukan persis di Crossref${terbaik ? ` (kemiripan terbaik hanya ${Math.round(terbaik.sim * 100)}%)` : ""}, jadi karya ini belum terverifikasi dan tidak bisa ditambahkan.`,
    };
  }
  return bandingkanDenganRekod(k, terbaik.rekod);
}

/**
 * Jangkar penilaian bidang untuk rujukan sebuah proyek, dirumuskan
 * pada tataran BIDANG, bukan judul sempit: standar pemilik (kasus
 * perbaikan N8) adalah bidang SESUAI atau BERIRISAN langsung lolos.
 * Bila jangkarnya judul proyek persis, artikel Ushul Fiqh murni
 * (Kaidah Fiqh, Ihya' 'Ulum al-Din) gugur hanya karena tidak membahas
 * frasa judul, padahal bidangnya tepat dan model sendiri mengenalinya
 * sebagai bidang proyek. Gerbang, prompt, dan ambang 60 tidak berubah;
 * yang dirumuskan pemanggil hanyalah kalimat tujuannya.
 *
 * Dipakai bersama oleh verifikasiKandidat (tambah jurnal) dan
 * periksa ulang pasang footnote (lib/server/generate-footnote.ts)
 * agar standar bidangnya SATU di semua jalur (penyempurnaan pemilik
 * 5 Nov 2026 15:52: standar tunggal semua jalur sumber).
 */
export function jangkarBidangUntuk(konteks: KonteksProyek): string {
  return (
    `Daftar rujukan jurnal proyek. Nilai kesesuaian HANYA dari bidang kandidat: sesuai bila bidangnya sama dengan bidang proyek (${konteks.bidangLabel || konteks.bidangId || "yang dipilih penulis"}) atau beririsan langsung dengan bidang itu; judul proyek yang sempit bukan topik yang wajib dibahas kandidat.` +
    (konteks.judulProyek ? ` Judul proyek: "${konteks.judulProyek}".` : "") +
    (konteks.topik ? ` Topik proyek: ${konteks.topik}.` : "")
  );
}

/** Jalankan fungsi atas daftar dengan jumlah serentak terbatas. */
async function petaTerbatas<T, R>(daftar: T[], maksSerentak: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const hasil: R[] = new Array(daftar.length);
  let indeks = 0;
  async function pekerja() {
    while (indeks < daftar.length) {
      const i = indeks;
      indeks += 1;
      hasil[i] = await fn(daftar[i]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(maksSerentak, daftar.length) }, () => pekerja()),
  );
  return hasil;
}

/**
 * Verifikasi penuh satu set kandidat untuk satu proyek: metadata dulu
 * (paralel maks 4), lalu SEMUA yang lolos metadata dinilai bidangnya
 * sekaligus lewat gerbang yang sama dengan Generate Footnote.
 *
 * Pemetaan putusan bidang di jalur ini BLOKIR KERAS (putusan pemilik
 * 5 Nov 2026 15:57, tanpa jalur konfirmasi):
 *  - model menilai lolos (statusPenilaian "dinilai") → bidang lolos;
 *  - aturan keras mendeteksi bidang asing → gagal-bidang;
 *  - model menilai TIDAK lolos (perluKonfirmasi gerbang) → gagal-bidang;
 *  - model tidak berjalan/gagal total ("tidak-dinilai") → belum-terverifikasi.
 */
export async function verifikasiKandidat(
  daftar: KandidatVerifikasi[],
  konteks: KonteksProyek,
  pengguna: Pengguna,
): Promise<PutusanVerifikasi[]> {
  const metadata = await petaTerbatas(daftar, 4, (k) => periksaMetadata(k));

  const putusan = new Map<string, PutusanVerifikasi>();
  const lolosMetadata: { k: KandidatVerifikasi; m: HasilMetadata }[] = [];
  daftar.forEach((k, i) => {
    const m = metadata[i]!;
    if (m.status === "lolos") {
      lolosMetadata.push({ k, m });
    } else {
      putusan.set(k.id, { id: k.id, status: m.status, alasan: m.alasan, rekod: m.rekod });
    }
  });

  if (lolosMetadata.length > 0) {
    const opsiP = await opsiKolamUntuk(pengguna).catch(() => null);
    if (opsiP?.perluIsiKunci) {
      // Mahasiswa tanpa kunci pribadi: penilaian model memang tidak
      // boleh berjalan memakai kolam pemilik, jadi bidangnya belum
      // terverifikasi dan kandidat tertahan (bukan lolos diam-diam).
      for (const { k, m } of lolosMetadata) {
        putusan.set(k.id, {
          id: k.id,
          status: "belum-terverifikasi",
          alasan:
            "Metadata cocok, tetapi penilaian bidang tidak dapat berjalan: akun mahasiswa wajib menyetor kunci API pribadi dulu agar penilaian memakai kunci Anda sendiri.",
          rekod: m.rekod,
        });
      }
    } else {
      const opsiKolam = {
        pribadi: opsiP?.pribadi,
        wajibPribadi: opsiP?.wajibPribadi,
        pinjaman: opsiP?.pinjaman,
      };
      // Jangkar penilaian dirumuskan pada tataran bidang lewat
      // jangkarBidangUntuk (lihat komentar fungsinya).
      const jangkarBidang = jangkarBidangUntuk(konteks);
      const bentuk = lolosMetadata.map(({ k }) => ({
        kunci: k.id,
        judul: k.judul,
        wadah: k.jurnal ?? "",
        jenis: "jurnal",
        kalimat: jangkarBidang,
      }));
      // maksDinilai disetel sejumlah kandidat: di jalur verifikasi ini
      // TIDAK ada kandidat yang boleh lolos tanpa putusan hanya karena
      // jatah penilaian per pencarian habis.
      const { putusan: putusanGerbang } = await nilaiUntukCariRujukan(
        bentuk,
        konteks,
        opsiKolam,
        bentuk.length,
      );
      for (const { k, m } of lolosMetadata) {
        const g = putusanGerbang.get(k.id);
        if (!g) {
          putusan.set(k.id, {
            id: k.id,
            status: "belum-terverifikasi",
            alasan: "Metadata cocok, tetapi kandidat ini tidak mendapat putusan bidang dari gerbang, jadi belum terverifikasi.",
            rekod: m.rekod,
          });
        } else if (g.lolos && g.statusPenilaian === "dinilai") {
          putusan.set(k.id, {
            id: k.id,
            status: "terverifikasi",
            alasan: `${m.alasan} Bidang sesuai: ${g.alasan}`,
            rekod: m.rekod,
          });
        } else if (g.statusPenilaian === "tidak-dinilai") {
          putusan.set(k.id, {
            id: k.id,
            status: "belum-terverifikasi",
            alasan:
              "Metadata cocok, tetapi penilaian bidang tidak dapat berjalan (model tidak menjawab), jadi kandidat ini belum terverifikasi dan belum bisa ditambahkan.",
            rekod: m.rekod,
          });
        } else {
          // Aturan keras bidang asing ATAU model menilai tidak lolos.
          // Di jalur lain putusan ini berbentuk perluKonfirmasi; di
          // jalur verifikasi tambah jurnal ia GAGAL, titik (blokir
          // keras putusan pemilik 5 Nov 2026 15:57).
          putusan.set(k.id, {
            id: k.id,
            status: "gagal-bidang",
            alasan: g.alasan,
            rekod: m.rekod,
          });
        }
      }
    }
  }

  return daftar.map((k) => putusan.get(k.id)!);
}
