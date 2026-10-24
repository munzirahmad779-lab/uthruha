/**
 * Penyisipan referensi kontekstual ke dalam paragraf komposisi.
 *
 * PRINSIP:
 *  - Semua output FULL ARAB — termasuk untuk sumber berbahasa Indonesia/Inggris.
 *  - Setiap footnote menjelaskan MENGAPA sumber itu relevan untuk kalimat tersebut.
 *  - Footnote bersifat OPSIONAL — UI menampilkan tombol "masukkan / buang" per item.
 *  - Sumber dipetakan ke paragraf berdasarkan kesamaan topik/kata kunci.
 *  - Tidak pernah mengarang — hanya memakai p.sumber[].
 *  - Batas 1 halaman ≈ 1800 karakter Arab untuk badan teks utama.
 */

import type { Project } from "@/lib/engine/project";
import type { Sumber } from "@/lib/engine/cite";
import { catatanKaki } from "@/lib/engine/cite";
import { latinKeArab } from "@/lib/engine/translit";

/** Kandidat footnote yang siap ditampilkan di UI untuk dipilih user. */
export interface KandidatFootnote {
  /** ID unik untuk tracking pilihan user. */
  id: string;
  /** Sumber yang direkomendasikan. */
  sumber: Sumber;
  /** Penjelasan mengapa sumber ini relevan untuk paragraf tersebut. */
  alasan: string;
  /** Teks footnote lengkap (siap sisip). */
  teksFootnote: string;
  /** Index paragraf tempat footnote ini disarankan. */
  indexParagraf: number;
}

/**
 * Cek apakah teks dominan Arab (≥50% karakter Arab dari total non-spasi).
 */
function dominanArab(teks: string): boolean {
  if (!teks || !teks.trim()) return true; // kosong dianggap Arab
  const tanpaSpasi = teks.replace(/\s/g, "");
  if (tanpaSpasi.length === 0) return true;
  const arab = (tanpaSpasi.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arab / tanpaSpasi.length >= 0.5;
}

/**
 * Konversi satu field Latin ke Arab via transliterasi.
 * Jika sudah Arab, kembalikan as-is.
 */
function keArab(teks: string | undefined): string {
  if (!teks || !teks.trim()) return "";
  if (dominanArab(teks)) return teks;
  return latinKeArab(teks, "akademik");
}

/** Label jenis sumber dalam Arab untuk konteks footnote. */
const LABEL_JENIS_ARAB: Record<Sumber["jenis"], string> = {
  kitab: "كتاب",
  artikel: "مقال علمي",
  bab: "فصل في كتاب",
  skripsi: "رسالة علمية",
  web: "موقع إلكتروني",
  terjemahan: "كتاب مترجم",
};

/**
 * Buat salinan Sumber dengan semua field dikonversi ke Arab.
 * Sumber yang sudah Arab dikembalikan as-is.
 */
export function konversiSumberKeArab(s: Sumber): Sumber {
  if (dominanArab(s.penulis) && dominanArab(s.judul)) return s;

  return {
    ...s,
    penulis: keArab(s.penulis),
    judul: keArab(s.judul),
    kota: keArab(s.kota),
    penerbit: keArab(s.penerbit),
    jurnal: keArab(s.jurnal),
    penerjemah: keArab(s.penerjemah),
    tahqiq: keArab(s.tahqiq),
    edisi: keArab(s.edisi),
    catatan: s.catatan, // biarkan apa adanya (metadata internal)
  };
}

/**
 * Format footnote full Arab dengan label jenis sumber.
 * Contoh: [مقال علمي] أحمد، محمد، تعليم المحادثة... — سبب الصلة
 */
export function formatFootnoteArab(s: Sumber, alasan: string): string {
  const label = LABEL_JENIS_ARAB[s.jenis];
  const sitasi = catatanKaki(s, { angkaArab: true });
  return `[${label}] ${sitasi} — ${alasan}`;
}

/**
 * Pemetaan section → jenis sumber yang relevan + template alasan.
 */
const KONTEKS_SECTION: Record<string, {
  jenis: Array<Sumber["jenis"]>;
  templateAlasan: string[];
}> = {
  khalfiya: {
    jenis: ["kitab", "artikel", "skripsi"],
    templateAlasan: [
      "يدعم البيان المتعلق بخلفية المشكلة",
      "يقدّم بيانات ميدانية متصلة بالظاهرة المدروسة",
      "يُظهر فجوة في الدراسات السابقة",
      "يعزّز ضرورة البحث من منظور نظري",
    ],
  },
  masalah: {
    jenis: ["kitab", "artikel"],
    templateAlasan: [
      "يحيل إلى صياغة مشكلة مماثلة في الأدبيات",
      "يقدّم سابقة أكاديمية لتأطير هذه المشكلة",
    ],
  },
  fawaid: {
    jenis: ["kitab", "artikel"],
    templateAlasan: [
      "يُظهر إسهام البحث في مجال العلم",
      "يقارن الفوائد النظرية بما ورد في الدراسات السابقة",
    ],
  },
  mustalahat: {
    jenis: ["kitab"],
    templateAlasan: [
      "تعريف المصطلح مستمد من هذا المصدر المعتمد",
      "المرجع الأصلي للمصطلحات المستعملة في البحث",
    ],
  },
  ithar: {
    jenis: ["kitab", "terjemahan", "bab", "artikel"],
    templateAlasan: [
      "يناقش النظرية أو المفهوم نفسه من زاوية مختلفة",
      "المصدر الأولي لتعريف هذا المفهوم",
      "دراسة مقارنة تُثري الإطار النظري",
      "الكتاب المرجعي الرئيسي في هذا المجال",
    ],
  },
  dirasat: {
    jenis: ["artikel", "skripsi"],
    templateAlasan: [
      "بحث سابق بموضوع مشابه وسياق مختلف",
      "نتائجه قابلة للمقارنة مع نتائج هذا البحث",
      "منهجيته تُتخذ مرجعًا أو نقطة مقارنة",
    ],
  },
  itharFikri: {
    jenis: ["kitab", "artikel"],
    templateAlasan: [
      "يقدّم أساسًا منطقيًّا لهذا الإطار الفكري",
      "هذه النظرية أساس العلاقة بين المتغيرات",
    ],
  },
  manhajNau: {
    jenis: ["kitab", "artikel"],
    templateAlasan: [
      "تبرير اختيار المنهج استنادًا إلى الأدبيات المنهجية",
      "سابقة استعمال منهج مشابه في دراسات مماثلة",
    ],
  },
  adawat: {
    jenis: ["kitab", "artikel"],
    templateAlasan: [
      "التحقق من الأداة يستند إلى معايير هذا المصدر",
      "تقنية جمع البيانات مقتبسة من هذا البحث",
    ],
  },
  tahlil: {
    jenis: ["kitab", "artikel"],
    templateAlasan: [
      "تقنية تحليل البيانات تتبع منهج هذا المصدر",
      "مرجع للإجراءات الإحصائية أو الموضوعية المستعملة",
    ],
  },
  farudhiyat: {
    jenis: ["kitab", "artikel"],
    templateAlasan: [
      "الفرضية مبنية على ما ورد في هذه الأدبيات",
      "أساس نظري للتنبؤ بالعلاقة بين المتغيرات",
    ],
  },
  munazara: {
    jenis: ["kitab", "artikel", "skripsi"],
    templateAlasan: [
      "نتائج هذا البحث تتفق أو تختلف مع نتائج هذا المصدر",
      "يمكن تفسير اختلاف النتائج باختلاف السياق أو المنهج",
      "هذا المصدر يقدّم منظورًا إضافيًّا للتفسير",
    ],
  },
  muqaddima: {
    jenis: ["kitab", "artikel"],
    templateAlasan: [
      "وضع الموضوع في سياق أدبيات المجال",
      "بيان موقع البحث في خريطة المعرفة",
    ],
  },
  tariqa: {
    jenis: ["kitab", "artikel"],
    templateAlasan: [
      "الإجراءات المنهجية تستند إلى هذا المصدر",
      "إثبات صحة مقاربة البحث من الأدبيات",
    ],
  },
  nataij: {
    jenis: ["artikel"],
    templateAlasan: [
      "هذا الاكتشاف يتسق أو يختلف مع نتائج دراسة سابقة",
      "بيانات داعمة من دراسة ميدانية ذات صلة",
    ],
  },
};

/**
 * Ekstrak kata kunci dari teks Arab untuk pencocokan dengan sumber.
 */
function ekstrakKataKunci(teks: string): Set<string> {
  const kata = teks
    .replace(/[^\u0600-\u06FF\s]/g, "")
    .split(/\s+/)
    .filter((k) => k.length > 2);
  return new Set(kata);
}

/**
 * Hitung skor relevansi antara paragraf dan sumber.
 */
function skorRelevansi(paragraf: string, sumber: Sumber): number {
  const kataParagraf = ekstrakKataKunci(paragraf);
  const kataSumber = ekstrakKataKunci(`${sumber.judul} ${sumber.penulis}`);
  
  let skor = 0;
  for (const k of kataParagraf) {
    if (kataSumber.has(k)) skor += 1;
  }
  
  // Boost jika judul sumber mengandung topik utama
  if (sumber.judul && paragraf.includes(sumber.judul.slice(0, 10))) skor += 3;
  
  return skor;
}

/**
 * Hasilkan kandidat footnote untuk sebuah section.
 * User kemudian memilih mana yang dimasukkan.
 */
export function hasilkanKandidatFootnote(
  p: Project,
  sectionId: string,
  markdown: string,
): KandidatFootnote[] {
  const konteks = KONTEKS_SECTION[sectionId];
  if (!konteks || p.sumber.length === 0) return [];

  // Konversi semua sumber ke Arab (transliterasi yang non-Arab).
  const sumberArab = p.sumber.map(konversiSumberKeArab);

  // Filter sumber yang relevan untuk section ini
  const sumberRelevan = sumberArab
    .filter((s) => konteks.jenis.includes(s.jenis))
    .sort((a, b) => (b.tahun || "").localeCompare(a.tahun || ""));

  if (sumberRelevan.length === 0) return [];

  // Bagi markdown jadi paragraf
  const paragrafList = markdown.split(/\n\n+/).filter((p) => p.trim().length > 20);
  
  const kandidat: KandidatFootnote[] = [];
  const sudahDipakai = new Set<string>();

  for (let i = 0; i < paragrafList.length; i++) {
    const paragraf = paragrafList[i]!;
    
    // Cari sumber paling relevan untuk paragraf ini
    const dinilai = sumberRelevan
      .filter((s) => !sudahDipakai.has(s.id))
      .map((s) => ({ sumber: s, skor: skorRelevansi(paragraf, s) }))
      .sort((a, b) => b.skor - a.skor);

    // Ambil sumber terbaik
    const terbaik = dinilai[0];
    if (!terbaik) continue;

    sudahDipakai.add(terbaik.sumber.id);

    // Pilih template alasan secara deterministik
    const idxAlasan = (i + terbaik.sumber.judul.length) % konteks.templateAlasan.length;
    const alasan = konteks.templateAlasan[idxAlasan]!;

    kandidat.push({
      id: `${sectionId}-fn-${i}-${terbaik.sumber.id}`,
      sumber: terbaik.sumber,
      alasan,
      teksFootnote: formatFootnoteArab(terbaik.sumber, alasan),
      indexParagraf: i,
    });
  }

  return kandidat;
}

/**
 * Sisipkan footnote yang sudah dipilih user ke dalam markdown.
 * @param markdown - Teks asli section
 * @param dipilih - Daftar kandidat yang user setujui
 */
export function sisipkanFootnoteTerpilih(
  markdown: string,
  dipilih: KandidatFootnote[],
): string {
  if (dipilih.length === 0) return markdown;

  const paragrafList = markdown.split(/\n\n+/);
  const footnotes: string[] = [];
  let nomor = 1;

  // Urutkan berdasarkan index paragraf
  const diurutkan = [...dipilih].sort((a, b) => a.indexParagraf - b.indexParagraf);

  for (const fn of diurutkan) {
    if (fn.indexParagraf < paragrafList.length) {
      // Tambahkan marker di akhir paragraf
      paragrafList[fn.indexParagraf] = `${paragrafList[fn.indexParagraf]}[^${nomor}]`;
      footnotes.push(`[^${nomor}]: ${fn.teksFootnote} — ${fn.alasan}`);
      nomor++;
    }
  }

  return paragrafList.join("\n\n") + "\n\n" + footnotes.join("\n");
}

/**
 * Batas karakter untuk ~1 halaman A4 teks Arab (font 14pt, spasi 1.5).
 */
export const BATAS_HALAMAN = 1800;

/**
 * Pangkas markdown agar tidak melebihi batas halaman.
 * Memotong di batas paragraf, bukan di tengah kalimat.
 */
export function pangkasSatuHalaman(markdown: string, batas = BATAS_HALAMAN): string {
  if (markdown.length <= batas) return markdown;

  const paragraf = markdown.split(/\n\n+/);
  let hasil = "";

  for (const p of paragraf) {
    const calon = hasil ? `${hasil}\n\n${p}` : p;
    if (calon.length > batas) break;
    hasil = calon;
  }

  if (!hasil) {
    return markdown.slice(0, batas).replace(/\s+\S*$/, "") + "\n\n[… تابع في الصفحة التالية]";
  }

  return hasil;
}
