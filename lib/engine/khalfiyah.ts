/**
 * Modul Penyusunan Khalfiyah Al-Bahts Berbasis Tri-Fokus Judul & Referensi Berlapis.
 * 
 * Alur:
 * 1. Dekonstruksi judul -> 3 klaster kunci (AI task)
 * 2. Agregasi jurnal deterministik per klaster (Google Scholar/Crossref)
 * 3. Pemetaan paragraf khalfiyah berdasarkan literatur
 * 4. Penelusuran maraji' turats sebagai penguat argumen
 */

import {
  narasiKasusArab,
  ringkasKualitas,
  susunKasus,
  type KasusLatarBelakang,
} from "./kasus-latar-belakang";
import { dekonstruksiLLM, type HasilDekonstruksi } from "./dekonstruksi-llm";

export type { HasilDekonstruksi };

/**
 * Representasi 3 klaster fokus dari judul penelitian.
 */
export interface KlasterJudul {
  /** Klaster 1: Fondasi/Objek Awal */
  klaster1: {
    label: string;
    kalimatKunci: string[];
    deskripsi: string;
  };
  /** Klaster 2: Variabel Tengah/Metode/Intervensi */
  klaster2: {
    label: string;
    kalimatKunci: string[];
    deskripsi: string;
  };
  /** Klaster 3: Tujuan Akhir/Dampak/Konteks Khusus */
  klaster3: {
    label: string;
    kalimatKunci: string[];
    deskripsi: string;
  };
}

/**
 * Artikel jurnal yang ditemukan untuk satu klaster.
 */
export interface ArtikelJurnal {
  judul: string;
  penulis: string[];
  tahun: number;
  namaJurnal: string;
  abstrak?: string;
  doi?: string;
  url: string;
  masalahEmpiris?: string; // rumusan masalah yang muncul dalam artikel
  klaster: 1 | 2 | 3; // dari klaster mana artikel ini berasal
}

/**
 * Rujukan maraji' turats untuk memperkuat argumen.
 */
export interface MarajiTurats {
  konsep: string; // konsep yang butuh rujukan
  namaKitab: string;
  pengarang: string;
  jilid?: number;
  halaman?: number;
  kutipan: string;
  url: string;
}

/**
 * Struktur paragraf khalfiyah yang tersusun sistematis.
 */
export interface ParagrafKhalfiyah {
  bagian: "klaster1" | "klaster2" | "klaster3" | "sintesis";
  judul: string;
  konten: string;
  rujukanJurnal: ArtikelJurnal[];
  rujukanTurats: MarajiTurats[];
  /** Kasus latar belakang yang memperkaya paragraf (bisa kosong). */
  kasus?: KasusLatarBelakang[];
  /** Peringatan jujur bila bahan kasus tidak memadai. */
  peringatan?: string;
}

/**
 * Hasil lengkap penyusunan khalfiyah.
 */
export interface HasilKhalfiyah {
  judul: string;
  klaster: KlasterJudul;
  artikel: ArtikelJurnal[];
  maraji: MarajiTurats[];
  paragraf: ParagrafKhalfiyah[];
  narasiLengkap: string; // teks khalfiyah siap pakai
  researchGap: string; // argumen "alasan memilih judul"
  /** Metode dekonstruksi yang dipakai: "llm" atau "heuristik". */
  metodeDekonstruksi?: "llm" | "heuristik";
  /** Penyedia LLM yang menjawab (bila metode === "llm"). */
  penyediaDekonstruksi?: string;
}

/**
 * Dekonstruksi judul menjadi 3 klaster — versi heuristik (tanpa LLM).
 * Dipakai sebagai fallback bila semua penyedia LLM gagal.
 *
 * Strategi: deteksi struktur judul akademik berdasarkan kata hubung dan pola frasa.
 * Jauh lebih baik daripada membagi rata per jumlah kata.
 */
export function dekonstruksiHeuristik(judul: string): KlasterJudul {
  const judulBersih = judul.trim();
  if (!judulBersih) {
    throw new Error("Judul tidak boleh kosong");
  }

  // Kata hubung yang menandai batas antar segmen semantik.
  // Urutan penting: yang lebih spesifik dulu agar tidak tertangkap yang umum.
  const PEMISAH = [
    /\s+terhadap\s+/i,
    /\s+dalam\s+/i,
    /\s+pada\s+/i,
    /\s+untuk\s+/i,
    /\s+di\s+(?![a-z])/i,   // "di" sebagai preposisi, bukan awalan
    /\s+melalui\s+/i,
    /\s+dengan\s+/i,
    /\s+berbasis\s+/i,
    /\s+berdasarkan\s+/i,
    /\s+guna\s+/i,
  ];

  // Coba belah judul berdasarkan kata hubung pertama yang cocok.
  let bagian: string[] = [];
  for (const pola of PEMISAH) {
    const pecah = judulBersih.split(pola);
    if (pecah.length >= 2) {
      bagian = pecah.map((s) => s.trim()).filter(Boolean);
      break;
    }
  }

  // Jika tidak ada pemisah yang cocok, coba pola "X Y Z" dengan asumsi:
  // kata pertama = hubungan (Pengaruh/Hubungan/Efektivitas/dll),
  // sisanya dibagi dua.
  if (bagian.length < 2) {
    const kata = judulBersih.split(/\s+/);
    if (kata.length <= 3) {
      // Judul sangat pendek: semua masuk klaster1
      bagian = [judulBersih];
    } else {
      // Bagi di tengah, tapi usahakan tidak memotong frasa umum.
      const tengah = Math.ceil(kata.length / 2);
      bagian = [
        kata.slice(0, tengah).join(" "),
        kata.slice(tengah).join(" "),
      ];
    }
  }

  // Normalisasi ke tepat 3 bagian.
  while (bagian.length < 3) {
    // Bagi bagian terpanjang menjadi dua.
    let idxTerpanjang = 0;
    for (let i = 1; i < bagian.length; i++) {
      if (bagian[i]!.length > bagian[idxTerpanjang]!.length) idxTerpanjang = i;
    }
    const kata = bagian[idxTerpanjang]!.split(/\s+/);
    const tengah = Math.ceil(kata.length / 2);
    const kiri = kata.slice(0, tengah).join(" ");
    const kanan = kata.slice(tengah).join(" ");
    bagian.splice(idxTerpanjang, 1, kiri, kanan);
  }
  // Jika lebih dari 3, gabungkan yang berlebih ke bagian terakhir.
  while (bagian.length > 3) {
    const terakhir = bagian.pop()!;
    bagian[bagian.length - 1] = `${bagian[bagian.length - 1]} ${terakhir}`;
  }

  return {
    klaster1: {
      label: "الموضوع الأساسي (Topik Fondasi)",
      kalimatKunci: bagian[0]!.split(/\s+/),
      deskripsi: "Objek utama penelitian yang menjadi fondasi kajian",
    },
    klaster2: {
      label: "المنهج أو المتغير (Metode/Variabel)",
      kalimatKunci: bagian[1]!.split(/\s+/),
      deskripsi: "Pendekatan, metode, atau variabel yang digunakan",
    },
    klaster3: {
      label: "السياق والأهداف (Konteks & Tujuan)",
      kalimatKunci: bagian[2]!.split(/\s+/),
      deskripsi: "Konteks khusus dan dampak yang diharapkan",
    },
  };
}

/**
 * Dekonstruksi judul menjadi 3 klaster kunci.
 * Mencoba LLM terlebih dahulu (memahami frasa & semantik),
 * lalu jatuh ke heuristik bila semua penyedia gagal.
 *
 * Mengembalikan HasilDekonstruksi yang mencakup metadata metode
 * agar UI bisa menampilkan apakah hasil berasal dari LLM atau heuristik.
 */
export async function dekonstruksiJudul(judul: string): Promise<HasilDekonstruksi> {
  const judulBersih = judul.trim();
  if (!judulBersih) {
    throw new Error("Judul tidak boleh kosong");
  }

  return dekonstruksiLLM(judulBersih, () => dekonstruksiHeuristik(judulBersih));
}

/**
 * Identifikasi konsep turats yang butuh maraji' dari paragraf.
 */
export function identifikasiKonsepTurats(teks: string): string[] {
  // Pola kata kunci yang umum butuh rujukan kitab
  const pola = [
    /الفقه/g,
    /الأصول/g,
    /التفسير/g,
    /الحديث/g,
    /العقيدة/g,
    /الشريعة/g,
    /التربية/g,
    /المنهج/g,
    /الوسائل/g,
    /التقويم/g,
  ];

  const konsep = new Set<string>();
  for (const p of pola) {
    const cocok = teks.match(p);
    if (cocok) {
      cocok.forEach((k) => konsep.add(k));
    }
  }

  return Array.from(konsep);
}

/**
 * Susun paragraf khalfiyah berdasarkan struktur tri-fokus.
 */
export function susunParagrafKhalfiyah(
  klaster: KlasterJudul,
  artikel: ArtikelJurnal[],
  maraji: MarajiTurats[],
): ParagrafKhalfiyah[] {
  const paragraf: ParagrafKhalfiyah[] = [];

  // Bagian 1: Klaster 1 (Fondasi)
  // Kasus-kasus nyata disusun dari abstrak artikel, bukan daftar mentah.
  const artikelK1 = artikel.filter((a) => a.klaster === 1);
  const kasusK1 = susunKasus(artikelK1, 1, 4);
  const narasiK1 = narasiKasusArab(kasusK1, 1);

  const kontenK1 =
    narasiK1.length > 0
      ? `
?? ${klaster.klaster1.kalimatKunci.join(" ")} ????? ?? ????????? ???????? ?? ???? ???????? ????????? ????????? ??? ?? ???????? ??????? ???? ?? ???????? ?????? ?????? ?????:

${narasiK1}

???? ?????????? ???? ?????? ?? ???????? ??????? ???? ?????? ???????? ??? ???? ?? ??????? ???????:
`.trim()
      : `
?? ${klaster.klaster1.kalimatKunci.join(" ")} ????? ?? ????????? ???????? ?? ???? ???????? ????????? ????????. ??? ????? ?? ??????? ????????? ?? ???? ?? ?????? ????? ?? ??????????? ????? ???? ????????? ??????? ??? ??????? ???????.
`.trim();

  const kualitasK1 = ringkasKualitas(kasusK1);

  paragraf.push({
    bagian: "klaster1",
    judul: klaster.klaster1.label,
    konten: kontenK1,
    rujukanJurnal: artikelK1.slice(0, 4),
    rujukanTurats: maraji
      .filter((m) => klaster.klaster1.kalimatKunci.some((k) => m.konsep.includes(k)))
      .slice(0, 2),
    kasus: kasusK1,
    peringatan:
      kasusK1.length === 0
        ? "Tidak ada kasus yang bisa disusun: artikel klaster 1 tidak ditemukan atau abstraknya kosong. Tambahkan kata kunci atau periksa manual."
        : kualitasK1.lemah > 0
          ? `${kualitasK1.lemah} dari ${kasusK1.length} kasus tidak punya abstrak (kekuatan lemah). Buka DOI masing-masing sebelum dikutip.`
          : undefined,
  });

  // Bagian 2: Klaster 2 (Metode/Variabel) + silang dengan Klaster 1
  const artikelK2 = artikel.filter((a) => a.klaster === 2);
  const kasusK2 = susunKasus(artikelK2, 2, 4);
  const narasiK2 = narasiKasusArab(kasusK2, 2);

  // Persilangan: kasus dari klaster 1 yang belum dijawab klaster 2 = tanda gap.
  const topikK2 = kasusK2.map((k) => k.pernyataan.slice(0, 40).toLowerCase());
  const gapSilang = kasusK1.filter((k1) => {
    const t = k1.pernyataan.slice(0, 40).toLowerCase();
    return !topikK2.some((t2) => t2.length > 10 && t.includes(t2.slice(0, 10)));
  });

  const kontenK2 =
    narasiK2.length > 0
      ? `
??? ?? ??? ${klaster.klaster2.kalimatKunci.join(" ")}? ??? ???????? ?? ??????? ?? ????? ?????? ?????? ?????? ??? ???????? ??? ???? ??? ????? ??????:

${narasiK2}
${
  gapSilang.length > 0
    ? `
???? ????? ${klaster.klaster1.label} ?? ${klaster.klaster2.label}? ???? ???? ???? ????: ??????????? ???? ????? ?????? ????? ?? ??? ?????? ?????? ?????? ?? ?????? ??????.
`.trim()
    : `
???? ????? ${klaster.klaster1.label} ?? ${klaster.klaster2.label}? ???? ?? ???????? ???????? ????? ??? ????? ????.
`.trim()
}
`.trim()
      : `
??? ?? ??? ${klaster.klaster2.kalimatKunci.join(" ")}? ??? ????? ?????? ?????? ?? ???? ??? ???? ??? ????????? ??? ????? ??????? ???????? ???.
`.trim();

  paragraf.push({
    bagian: "klaster2",
    judul: klaster.klaster2.label,
    konten: kontenK2,
    rujukanJurnal: artikelK2.slice(0, 4),
    rujukanTurats: maraji
      .filter((m) => klaster.klaster2.kalimatKunci.some((k) => m.konsep.includes(k)))
      .slice(0, 2),
    kasus: kasusK2,
    peringatan:
      kasusK2.length === 0
        ? "Artikel klaster 2 tidak ditemukan. Bagian metode akan berisi kalimat umum - lengkapi manual."
        : undefined,
  });

  // Bagian 3: Klaster 3 (Konteks & Tujuan) + integrasi 1+2+3
  const artikelK3 = artikel.filter((a) => a.klaster === 3);
  const kasusK3 = susunKasus(artikelK3, 3, 4);
  const narasiK3 = narasiKasusArab(kasusK3, 3);

  const kontenK3 =
    narasiK3.length > 0
      ? `
??? ${klaster.klaster3.kalimatKunci.join(" ")}? ???? ?????? ??? ????? ?? ????? ???? ??????? ?? ?????? ??????? ??? ???? ???????? ???:

${narasiK3}

????? ??????? ??????? (${klaster.klaster1.label}? ${klaster.klaster2.label}? ${klaster.klaster3.label})? ???? ?? ???? ????? ??????? ?? ????? ?? ???? ????? ??? ?? ?????? ??? ???????.
`.trim()
      : `
??? ${klaster.klaster3.kalimatKunci.join(" ")}? ???? ?????? ??? ????? ?? ????? ???? ??????? ?? ?????? ??????. ????? ??????? ??????? (${klaster.klaster1.label}? ${klaster.klaster2.label}? ${klaster.klaster3.label})? ???? ?? ???? ????? ??????? ????? ??????? ???????.
`.trim();

  paragraf.push({
    bagian: "klaster3",
    judul: klaster.klaster3.label,
    konten: kontenK3,
    rujukanJurnal: artikelK3.slice(0, 4),
    rujukanTurats: maraji
      .filter((m) => klaster.klaster3.kalimatKunci.some((k) => m.konsep.includes(k)))
      .slice(0, 2),
    kasus: kasusK3,
    peringatan:
      kasusK3.length === 0
        ? "Artikel klaster 3 tidak ditemukan. Bagian konteks akan berisi kalimat umum - lengkapi manual."
        : undefined,
  });

  // Bagian 4: Sintesis (Research Gap & Urgensi)
  const kontenSintesis = `
بناءً على استعراض الأدبيات السابقة، يتبين أن هناك فجوة بحثية واضحة في تناول ${klaster.klaster1.kalimatKunci.join(" ")} من خلال ${klaster.klaster2.kalimatKunci.join(" ")} في سياق ${klaster.klaster3.kalimatKunci.join(" ")}.

فالدراسات التي تناولت الموضوع الأول لم تربطه بالمنهج الثاني، والدراسات المنهجية لم تطبقها في السياق الثالث. ومن هنا تبرز الحاجة الملحة إلى إجراء هذه الدراسة للأسباب التالية:

1. **الأصالة العلمية**: لم تُجرَ دراسة سابقة تجمع بين هذه الأبعاد الثلاثة في إطار واحد متكامل.
2. **الحاجة الميدانية**: الواقع العملي يتطلب فهمًا أعمق لهذه العلاقة التكاملية.
3. **التأصيل الشرعي**: المراجع الأصلية تقدم أسسًا نظرية لم تُختبر في السياق المعاصر.

وعليه، فإن هذه الدراسة تسعى إلى سد هذا الفراغ البحثي من خلال منهج علمي منضبط يجمع بين النظرية والتطبيق، ويستند إلى المصادر الأصلية والدراسات المعاصرة معًا.
`.trim();

  paragraf.push({
    bagian: "sintesis",
    judul: "التأصيل والفراغ البحثي (Research Gap)",
    konten: kontenSintesis,
    rujukanJurnal: artikel.slice(0, 6),
    rujukanTurats: maraji.slice(0, 4),
  });

  return paragraf;
}

/**
 * Susun narasi lengkap khalfiyah al-bahts.
 */
export function susunNarasiLengkap(paragraf: ParagrafKhalfiyah[]): string {
  const bagian: string[] = [];

  bagian.push("# خلفية البحث (Khalfiyah Al-Bahts)\n");

  for (const p of paragraf) {
    bagian.push(`## ${p.judul}\n`);
    bagian.push(p.konten + "\n");

    // Tambahkan referensi jurnal
    if (p.rujukanJurnal.length > 0) {
      bagian.push("\n**المراجع العلمية:**\n");
      for (const r of p.rujukanJurnal) {
        const penulis = r.penulis.length > 0 ? r.penulis.join("، ") : "باحث غير معروف";
        bagian.push(
          `- ${penulis} (${r.tahun}). "${r.judul}". *${r.namaJurnal}*. ${r.doi ? `DOI: ${r.doi}` : ""} [${r.url}](${r.url})\n`,
        );
      }
    }

    // Tambahkan maraji' turats
    if (p.rujukanTurats.length > 0) {
      bagian.push("\n**المراجع الأصلية:**\n");
      for (const m of p.rujukanTurats) {
        const lokasi = [m.jilid ? `ج${m.jilid}` : "", m.halaman ? `ص${m.halaman}` : ""]
          .filter(Boolean)
          .join("، ");
        bagian.push(
          `- ${m.pengarang}، *${m.namaKitab}*${lokasi ? `، ${lokasi}` : ""}. "${m.kutipan}" [${m.url}](${m.url})\n`,
        );
      }
    }

    bagian.push("\n---\n");
  }

  return bagian.join("\n");
}

/**
 * Ekstrak research gap dari hasil khalfiyah.
 */
export function ekstrakResearchGap(paragraf: ParagrafKhalfiyah[]): string {
  const sintesis = paragraf.find((p) => p.bagian === "sintesis");
  if (!sintesis) {
    return "لم يتم العثور على قسم التأصيل والفراغ البحثي في النص.";
  }

  // Ekstrak bagian research gap dari sintesis
  const baris = sintesis.konten.split("\n");
  const mulai = baris.findIndex((b) => b.includes("فجوة بحثية") || b.includes("التأصيل"));
  if (mulai === -1) return sintesis.konten;

  return baris.slice(mulai).join("\n");
}