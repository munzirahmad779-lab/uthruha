/**
 * Pencarian dirasah sabiqoh (Tahap 7, menutup A9 audit kode).
 *
 * Jalurnya memakai tumpukan pencarian yang sudah ada dan jalur
 * servernya: cariRujukanTamu (OpenAlex, Crossref, Google Books, Open
 * Library, dengan verifikasi identifier dan saringan sempalan bidang
 * milik jalurnya), lalu gerbang relevansi yang SAMA dengan Generate
 * Footnote dan Cari Rujukan (lib/server/gerbang-relevansi): aturan
 * keras bidang untuk semua akun, penilaian model (dari abstrak
 * kandidat) hanya untuk akun yang bisa menilai, dan kegagalan model
 * berarti tertahan sebagai belum dinilai, tidak pernah lolos diam.
 *
 * Judul proyek adalah kueri semantiknya (bukan kalimat kunci
 * paragraf), sesuai kontrak RENCANA-BANGUN Tahap 7. Kandidat tanpa
 * metadata memadai (judul, penulis, atau tahun kosong) TIDAK
 * ditampilkan sebagai kajian: kajian tanpa peneliti dan tahun bukan
 * kajian yang bisa ditulis.
 *
 * Inti tiap kajian (masalah, tujuan, metode, temuan) dirumuskan model
 * dalam SATU panggilan batch, HANYA dari abstrak yang benar-benar
 * dikembalikan indeks. Model gagal atau abstrak tidak ada berarti
 * inti kosong dan dinyatakan apa adanya; tidak ada inti karangan.
 */
import { getBidang } from "@/lib/content/bidang";
import type { HasilCariDirasah, KandidatDirasah } from "@/lib/engine/dirasah";
import { MIN_KAJIAN_DIRASAH } from "@/lib/engine/dirasah";
import {
  bidangMilikProyek,
  deteksiBidangSumber,
  nilaiUntukCariRujukan,
  type KonteksProyek,
  type OpsiKolamGerbang,
} from "./gerbang-relevansi";
import { panggilKolam } from "./kolam";
import { cariRujukanTamu, type RujukanTamu } from "./rujukan";
import { rujukanKeSumber } from "./generate-footnote";

/** Penyedia kandidat mentah; bawaan memakai tumpukan pencarian server
 *  yang sudah ada. Bisa diganti pada uji luring. */
export type PenyediaKajian = (judulProyek: string) => Promise<RujukanTamu[]>;

/**
 * Metadata memadai untuk tampil sebagai kajian: judul, minimal satu
 * penulis bernama, dan tahun terbit. Tanpa ketiganya, entri tidak
 * bisa ditulis sebagai kajian terdahulu yang bisa ditelusur.
 */
export function metadataMemadai(r: RujukanTamu): boolean {
  return (
    (r.judul ?? "").trim().length > 0 &&
    (r.penulis ?? []).some((p) => (p ?? "").trim().length > 0) &&
    (r.tahun ?? "").trim().length > 0
  );
}

const SISTEM_INTI_DIRASAH = `Anda adalah penyusun inti kajian terdahulu untuk bagian الدراسات السابقة (penelitian terdahulu) sebuah risalah akademik.
Anda menerima daftar kajian bernomor, masing-masing dengan judul dan abstrak ASLI dari indeks akademiknya.
Tugas Anda HANYA mengekstrak inti tiap kajian DARI ABSTRAKNYA SENDIRI:
- Keluarkan HANYA JSON valid, tanpa penjelasan, tanpa markdown:
  {"inti":[{"i":0,"masalah":"...","tujuan":"...","metode":"...","temuan":"..."}]}
- "masalah": persoalan yang diangkat kajian itu menurut abstraknya, satu kalimat.
- "tujuan": tujuan kajian itu menurut abstraknya, satu kalimat.
- "metode": metode atau pendekatan yang dinyatakan abstraknya; string kosong bila abstrak tidak menyatakannya.
- "temuan": hasil utama kajian itu menurut abstraknya (النتائج), satu sampai dua kalimat.
- Tulis inti dalam bahasa abstraknya. Jangan menambahkan apa pun yang tidak ada di abstrak: nama, angka, hasil, dan kesimpulan hanya dari abstrak itu.
- Bila abstrak tidak menyatakan satu unsur, isi string kosong untuk unsur itu. Mengarang unsur yang tidak dinyatakan adalah pelanggaran terberat.`;

interface IntiMentah {
  masalah: string;
  tujuan: string;
  metode: string;
  temuan: string;
}

function parseIntiMentah(raw: string): Map<number, IntiMentah> | null {
  try {
    const bersih = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(bersih.slice(bersih.indexOf("{"), bersih.lastIndexOf("}") + 1)) as {
      inti?: unknown;
    };
    if (!Array.isArray(json.inti)) return null;
    const hasil = new Map<number, IntiMentah>();
    const teks = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 600) : "");
    for (const item of json.inti) {
      if (typeof item !== "object" || item === null) continue;
      const rec = item as Record<string, unknown>;
      const i = typeof rec.i === "number" && Number.isFinite(rec.i) ? Math.floor(rec.i) : -1;
      if (i < 0) continue;
      hasil.set(i, {
        masalah: teks(rec.masalah),
        tujuan: teks(rec.tujuan),
        metode: teks(rec.metode),
        temuan: teks(rec.temuan),
      });
    }
    return hasil.size > 0 ? hasil : null;
  } catch {
    return null;
  }
}

/**
 * Rumuskan inti semua kandidat berabstrak dalam satu panggilan model.
 * Mengembalikan peta indeks kandidat → inti, atau null bila model
 * gagal total (inti lalu kosong dan dinyatakan apa adanya).
 */
async function intiDariModel(
  daftar: RujukanTamu[],
  kolam?: OpsiKolamGerbang,
): Promise<Map<number, IntiMentah> | null> {
  const berabstrak = daftar
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => (r.cuplikan ?? "").trim().length > 0);
  if (berabstrak.length === 0) return new Map();
  const pengguna = berabstrak
    .map(
      ({ r, i }) =>
        `[${i}] Judul: ${r.judul}\nPenulis: ${r.penulis.join(", ")}\nTahun: ${r.tahun}\nAbstrak: ${(r.cuplikan ?? "").slice(0, 900)}`,
    )
    .join("\n\n");
  try {
    const hasil = await panggilKolam({
      sistem: SISTEM_INTI_DIRASAH,
      pengguna,
      maksToken: 1600,
      json: true,
      premium: true,
      pribadi: kolam?.pribadi,
      wajibPribadi: kolam?.wajibPribadi,
      pinjaman: kolam?.pinjaman,
    });
    if (!hasil.teks) return null;
    return parseIntiMentah(hasil.teks);
  } catch {
    return null;
  }
}

export async function cariKajianDirasah(opsi: {
  judulProyek: string;
  bidangId?: string;
  topikAr?: string;
  /** Opsi kolam pemanggil (BYOK/pinjaman), diteruskan apa adanya. */
  kolam?: OpsiKolamGerbang;
  /** True bila akun ini boleh memakai penilaian model (Premium, kunci
   *  pribadi, atau pinjaman), sama seperti kebijakan rute Cari
   *  Rujukan. False berarti hanya aturan keras bidang yang bekerja. */
  bisaNilaiModel?: boolean;
  penyedia?: PenyediaKajian;
}): Promise<HasilCariDirasah> {
  const catatan: string[] = [];
  const penyedia = opsi.penyedia ?? ((judul: string) => cariRujukanTamu(judul, [judul]));
  const mentah = await penyedia(opsi.judulProyek);

  // Saring metadata memadai + dedupe per id sumber stabil.
  const layak: RujukanTamu[] = [];
  const lihatId = new Set<string>();
  let dibuang = 0;
  for (const r of mentah) {
    if (!metadataMemadai(r)) {
      dibuang += 1;
      continue;
    }
    const id = rujukanKeSumber(r).id;
    if (lihatId.has(id)) continue;
    lihatId.add(id);
    layak.push(r);
  }
  if (dibuang > 0) {
    catatan.push(
      `${dibuang} hasil dibuang karena metadata tidak memadai (judul, penulis, atau tahun kosong), sehingga tidak layak ditampilkan sebagai kajian.`,
    );
  }

  const bidang = opsi.bidangId ? getBidang(opsi.bidangId) : null;
  const konteks: KonteksProyek = {
    bidangId: opsi.bidangId ?? "",
    bidangLabel: bidang ? `${bidang.labelId} (${bidang.labelAr})` : "",
    judulProyek: opsi.judulProyek,
    topik: opsi.topikAr ?? "",
  };

  // Gerbang relevansi: jalur yang sama dengan Generate Footnote dan
  // Cari Rujukan. Kalimat tujuannya adalah judul proyek itu sendiri:
  // yang dinilai adalah kesesuaian kajian dengan penelitian ini.
  const gerbangPer = new Map<string, KandidatDirasah["gerbang"]>();
  let belumDinilai = 0;
  if (layak.length > 0 && opsi.bisaNilaiModel) {
    const bentuk = layak.map((r) => {
      const s = rujukanKeSumber(r);
      return {
        kunci: s.id,
        judul: s.judul,
        wadah: s.jurnal ?? s.penerbit ?? "",
        jenis: r.jenis === "jurnal" ? "jurnal" : "buku",
        isi: (r.cuplikan ?? "").trim() ? r.cuplikan : undefined,
        kalimat: opsi.judulProyek,
      };
    });
    const nilai = await nilaiUntukCariRujukan(bentuk, konteks, opsi.kolam, 8).catch(() => null);
    if (nilai) {
      belumDinilai = nilai.belumDinilai;
      for (const [kunci, putusan] of nilai.putusan) {
        gerbangPer.set(kunci, {
          lolos: putusan.lolos,
          perluKonfirmasi: putusan.perluKonfirmasi,
          bidangSumber: putusan.bidangSumber,
          alasan: putusan.alasan,
          statusPenilaian: putusan.statusPenilaian,
          ...(typeof putusan.skorModel === "number" ? { skorModel: putusan.skorModel } : {}),
        });
      }
      if (belumDinilai > 0) {
        catatan.push(
          `${belumDinilai} kajian belum dinilai gerbang bidang pada pencarian ini (batas penilaian per pencarian tercapai); kajian itu belum punya putusan bidang.`,
        );
      }
    } else {
      // Penilaian gagal berjalan seluruhnya: TIDAK ada putusan, dan
      // itu dikatakan terus terang, bukan disembunyikan sebagai lolos.
      belumDinilai = bentuk.length;
      catatan.push(
        "Penilaian gerbang bidang gagal berjalan pada pencarian ini; semua kajian di bawah belum punya putusan bidang. Periksa sendiri kesesuaiannya sebelum memilih.",
      );
    }
  } else if (layak.length > 0) {
    // Tanpa penilaian model: aturan keras saja, putusannya hanya
    // untuk kandidat yang tertahan (pola rute Cari Rujukan).
    for (const r of layak) {
      const s = rujukanKeSumber(r);
      const bidangSumber = deteksiBidangSumber(s.judul, s.jurnal ?? s.penerbit ?? "");
      if (bidangSumber && !bidangMilikProyek(bidangSumber, konteks)) {
        gerbangPer.set(s.id, {
          lolos: false,
          perluKonfirmasi: true,
          bidangSumber,
          alasan: `Judul atau nama jurnal menunjukkan bidang ${bidangSumber}, sedangkan proyek ini bidang ${konteks.bidangLabel || konteks.bidangId || "yang dipilih penulis"}. (Penilaian model tidak berjalan untuk akun Anda; yang bekerja aturan keras bidang.)`,
          statusPenilaian: "aturan-keras",
        });
      }
    }
  }

  // Inti kajian dari abstrak, satu panggilan batch, hanya bila akun
  // bisa memakai model. Kegagalan dicatat jujur; inti tetap kosong.
  let inti: Map<number, IntiMentah> | null = null;
  if (layak.length > 0 && opsi.bisaNilaiModel) {
    inti = await intiDariModel(layak, opsi.kolam);
    if (inti === null) {
      catatan.push(
        "Inti kajian (masalah, tujuan, metode, temuan) tidak dapat disusun model pada pencarian ini. Abstrak sumber ditampilkan apa adanya; susun inti sendiri dari abstrak itu atau cari ulang nanti.",
      );
    }
  }

  const kajian: KandidatDirasah[] = layak.map((r, i) => {
    const sumberDasar = rujukanKeSumber(r);
    const intiKajian = inti?.get(i);
    const sumber: typeof sumberDasar = {
      ...sumberDasar,
      dirasah: {
        ...((r.cuplikan ?? "").trim() ? { abstrak: r.cuplikan } : {}),
        ...(intiKajian?.masalah ? { masalah: intiKajian.masalah } : {}),
        ...(intiKajian?.tujuan ? { tujuan: intiKajian.tujuan } : {}),
        ...(intiKajian?.metode ? { metode: intiKajian.metode } : {}),
        ...(intiKajian?.temuan ? { temuan: intiKajian.temuan } : {}),
        dariAbstrak: (r.cuplikan ?? "").trim().length > 0,
      },
    };
    return {
      sumber,
      ...((r.cuplikan ?? "").trim() ? { abstrak: r.cuplikan } : {}),
      tautan: r.tautan ?? "",
      terverifikasi: Boolean(r.terverifikasi),
      skor: r.skor ?? 0,
      intiDariModel: Boolean(
        intiKajian && (intiKajian.masalah || intiKajian.tujuan || intiKajian.metode || intiKajian.temuan),
      ),
      ...(gerbangPer.get(sumber.id) ? { gerbang: gerbangPer.get(sumber.id) } : {}),
    };
  });

  // Urutan tampil: yang lolos gerbang lebih dulu, lalu yang belum
  // berputusan, lalu yang tertahan; di dalam kelompoknya menurut skor
  // pencarian. Putusan tidak pernah diubah urutan diam-diam: labelnya
  // tetap menempel pada kartunya.
  const peringkat = (k: KandidatDirasah): number => {
    if (!k.gerbang) return 1;
    return k.gerbang.lolos ? 0 : 2;
  };
  kajian.sort((a, b) => peringkat(a) - peringkat(b) || b.skor - a.skor);

  const bisaDipilih = kajian.filter(
    (k) => !k.gerbang || k.gerbang.lolos || k.gerbang.statusPenilaian !== "aturan-keras",
  ).length;
  if (kajian.length === 0) {
    catatan.push(
      "Pencarian belum menghasilkan kajian dengan metadata memadai untuk judul ini. Periksa judul proyek, coba lagi, atau tambahkan kajian secara manual dari sumber yang Anda baca sendiri.",
    );
  } else if (bisaDipilih < MIN_KAJIAN_DIRASAH) {
    catatan.push(
      `Pencarian ini hanya menghasilkan ${bisaDipilih} kajian yang bisa dipilih, di bawah minimal ${MIN_KAJIAN_DIRASAH} kajian menurut aturan pemilik web. Lengkapi lewat tambahan manual dari kajian yang benar-benar Anda baca, atau cari ulang sesudah judul diperjelas. Angka minimal tidak dipenuhi dengan kajian karangan.`,
    );
  }

  return { kajian, belumDinilai, catatan };
}
