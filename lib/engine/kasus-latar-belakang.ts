/**
 * Pengaya kasus latar belakang (Khalfiyah).
 *
 * MASALAH YANG DIPERBAIKI
 * -----------------------
 * Versi lama menaruh kasus sebagai daftar bernomor berisi teks abstrak mentah
 * dari Crossref — kebanyakan berbahasa Inggris, tanpa tempat, tanpa tahun,
 * tanpa angka. Hasilnya paragraf Arab yang isinya "kosong secara akademik".
 *
 * Modul ini mengubah bahan mentah itu menjadi KASUS yang layak masuk khalfiyah:
 *  - Menyaring kalimat yang benar-benar mengungkap masalah (bukan basa-basi).
 *  - Membuang kalimat yang tidak layak pakai (metadata, copyright, boilerplate).
 *  - Menyusun versi Arab yang bisa ditempel apa adanya.
 *  - Menandai kekuatan bukti agar mahasiswa tahu mana yang perlu dicek manual.
 *
 * SIFAT: deterministik, tanpa AI. Semua keputusan bisa dilacak.
 */

import type { ArtikelJurnal } from "./khalfiyah";

/** Satu kasus latar belakang yang siap dipakai. */
export interface KasusLatarBelakang {
  /** Nomor urut penyajian. */
  urut: number;
  /** Klaster asal kasus (1=fondasi, 2=metode, 3=konteks). */
  klaster: 1 | 2 | 3;
  /** Kalimat masalah asli dari abstrak (bahasa sumber). */
  pernyataan: string;
  /** Versi Arab yang siap ditempel ke khalfiyah. */
  arab: string;
  /** Sumber: penulis pendek + tahun. */
  sumber: string;
  /** Judul artikel asli. */
  judulArtikel: string;
  /** DOI atau URL untuk verifikasi. */
  tautan: string;
  /** Tahun terbit (bila ada). */
  tahun: string;
  /**
   * Kekuatan bukti:
   *  - "kuat"        : abstrak ada + kalimat masalah eksplisit
   *  - "sedang"      : abstrak ada, masalah disimpulkan dari judul
   *  - "lemah"       : abstrak tidak ada, perlu verifikasi manual
   */
  kekuatan: "kuat" | "sedang" | "lemah";
  /** Catatan jujur untuk mahasiswa. */
  catatan: string;
}

/**
 * Frasa pembuka yang menandakan kalimat itu MEMANG mengungkap masalah.
 * Diurutkan dari yang paling kuat.
 */
const PENANDA_MASALAH: Array<{ pola: RegExp; bobot: number }> = [
  { pola: /\b(gap|gaps)\b/i, bobot: 3 },
  { pola: /\blittle is known\b/i, bobot: 3 },
  { pola: /\bremains? (unclear|unknown|unresolved|underexplored)\b/i, bobot: 3 },
  { pola: /\b(has|have) not been (studied|examined|addressed)\b/i, bobot: 3 },
  { pola: /\bunderexplored\b/i, bobot: 3 },
  { pola: /\block of\b/i, bobot: 2 },
  { pola: /\blacking\b/i, bobot: 2 },
  { pola: /\bproblem(s)?\b/i, bobot: 2 },
  { pola: /\bchallenge(s)?\b/i, bobot: 2 },
  { pola: /\bhowever\b/i, bobot: 1 },
  { pola: /\bdespite\b/i, bobot: 1 },
  { pola: /\balthough\b/i, bobot: 1 },
  { pola: /\blimited\b/i, bobot: 1 },
  { pola: /\bissue(s)?\b/i, bobot: 1 },
  { pola: /\bconcern(s)?\b/i, bobot: 1 },
];

/**
 * Kalimat yang HARUS dibuang — bukan isi, hanya sampah metadata.
 */
const SAMPAH: RegExp[] = [
  /^©/, /^\(c\)/i, /\bcopyright\b/i, /\ball rights reserved\b/i,
  /^abstract\b/i, /^this (article|paper|study) (is|was) (published|accepted)/i,
  /\bdoi:\s*10\./i, /\bhttps?:\/\//i, /^received\b/i, /^accepted\b/i,
  /\bkeywords?\b/i, /\bopen access\b/i, /^vol(ume)?\.?\s*\d/i,
  /^pp?\.\s*\d/i, /\bet al\.\s*$/i,
];

/** Frasa Arab untuk membingkai kasus. */
const PEMBINGKAI: Record<1 | 2 | 3, { pembuka: string; penutup: string }> = {
  1: {
    pembuka: "من أبرز الإشكاليات التي رصدتها الدراسات السابقة في هذا الجانب",
    penutup: "وهذا يؤكد أن الموضوع لم يُستوفَ حقه من البحث",
  },
  2: {
    pembuka: "وفيما يتعلق بالمنهج والإجراء، كشفت الدراسات عن قصور منهجي واضح",
    penutup: "مما يستدعي إعادة النظر في الأدوات المنهجية المستخدمة",
  },
  3: {
    pembuka: "أما على مستوى التطبيق والسياق، فقد ظهرت فجوة بين التنظير والواقع",
    penutup: "وهو ما يفرض الحاجة إلى دراسة ميدانية تعالج هذه الفجوة",
  },
};

/** Buang sampah metadata dan rapikan spasi. */
function bersihkan(kalimat: string): string {
  return kalimat.replace(/\s+/g, " ").replace(/^["'“”\s]+|["'“”\s]+$/g, "").trim();
}

/** Apakah kalimat ini layak jadi kasus? */
function layak(kalimat: string): boolean {
  const t = kalimat.trim();
  if (t.length < 40 || t.length > 400) return false;
  if (SAMPAH.some((p) => p.test(t))) return false;
  // Harus punya huruf, bukan sekadar tanda baca atau angka.
  if (!/[A-Za-z\u0600-\u06FF]{4,}/.test(t)) return false;
  return true;
}

/** Skor seberapa kuat kalimat mengungkap masalah. */
function skorMasalah(kalimat: string): number {
  let skor = 0;
  for (const { pola, bobot } of PENANDA_MASALAH) {
    if (pola.test(kalimat)) skor += bobot;
  }
  return skor;
}

/** Pecah abstrak jadi kalimat tanpa merusak singkatan umum. */
function pecahKalimat(abstrak: string): string[] {
  return abstrak
    .replace(/\b(e\.g|i\.e|etc|vs|Dr|Prof|al)\./gi, "$1<DOT>")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/<DOT>/g, "."))
    .map(bersihkan)
    .filter(Boolean);
}

/** Nama penulis dipendekkan: "Ahmad, M." -> "Ahmad". */
function penulisPendek(penulis?: string | string[]): string {
  if (!penulis) return "باحث";
  const mentah = Array.isArray(penulis) ? (penulis[0] ?? "") : penulis;
  const pertama = mentah.split(/[;,]/)[0]?.trim() ?? "";
  if (!pertama) return "باحث";
  return pertama.split(/\s+/)[0] ?? "باحث";
}

/**
 * Terjemahkan pola masalah ke kalimat Arab yang baku.
 *
 * CATATAN JUJUR: ini bukan terjemahan kata-per-kata. Ini "pola kalimat" yang
 * dipilih berdasarkan jenis masalah yang terdeteksi. Rujukan asli tetap
 * disimpan supaya mahasiswa bisa memeriksa dan menulis ulang sesuai gayanya.
 */
function keArab(pernyataan: string, jenis: 1 | 2 | 3, urutan = 0): string {
  const p = pernyataan.toLowerCase();

  if (/gap|little is known|underexplored|remains? unclear/.test(p)) {
    const variasi = [
      "لم تتناول الدراسات السابقة هذا الجانب بشكل كافٍ، إذ لا يزال غير واضح المعالم",
      "يشير الباحثون إلى فراغ معرفي في معالجة هذه المسألة، لم تسده الدراسات المتاحة",
      "لا تزال هذه القضية خارج نطاق الاهتمام البحثي الكافي",
    ];
    const i = urutan % variasi.length;
    return variasi[i]!;
  }
  if (/lock of|lack|lacking|limited|without/.test(p)) {
    const variasi = [
      "تعاني الدراسات القائمة من نقص واضح في المعالجة المنهجية لهذا الجانب",
      "تفتقر الأدبيات المتاحة إلى معالجة متكاملة، وهو ما يضعف نتائجها",
      "الدراسات المنشورة لم تستوف هذا البعد، مما يترك ثغرة في المعرفة",
    ];
    const i = urutan % variasi.length;
    return variasi[i]!;
  }
  if (/challenge|problem|issue|concern|difficult/.test(p)) {
    const variasi = [
      "تواجه الممارسة العملية إشكاليات جوهرية لم تجد حلًا في الأدبيات المتاحة",
      "تكشف الدراسات عن عوائق ميدانية تعترض التطبيق ولم تُعالج بعد",
      "لا تزال الإشكاليات التطبيقية قائمة رغم تراكم البحوث",
    ];
    return variasi[urutan % variasi.length]!;
  }
  if (/however|despite|although/.test(p)) {
    const variasi = [
      "على الرغم من تراكم الدراسات، فإن النتائج لم تُحسم بعد",
      "ومع تنوع المقاربات، لم يتفق الباحثون على نتيجة قاطعة",
      "بيد أن الأدلة المتاحة لا تزال متباينة وغير حاسمة",
    ];
    return variasi[urutan % variasi.length]!;
  }
  if (jenis === 2) {
    const variasi = [
      "لم تُحدد الأدوات المنهجية الأنسب لدراسة هذا الموضوع على نحو قاطع",
      "تتفاوت مناهج البحث في هذا الباب تفاوتًا يضعف قابلية المقارنة بين نتائجها",
      "لا يزال الإطار الإجرائي للدراسة بحاجة إلى ضبط أدق",
    ];
    return variasi[urutan % variasi.length]!;
  }
  if (jenis === 3) {
    const variasi = [
      "توجد فجوة بين ما تنظّره الدراسات وما هو واقع في التطبيق العملي",
      "لم تُختبر النتائج النظرية في السياق الميداني اختبارًا كافيًا",
      "يظهر تفاوت واضح بين المأمول نظريًا والمتحقق عمليًا",
    ];
    return variasi[urutan % variasi.length]!;
  }
  const variasiUmum = [
    "تظل هذه المسألة بحاجة إلى بحث أعمق لسد الفراغ المعرفي",
    "لم تحظ هذه المسألة بالمعالجة العلمية الوافية حتى الآن",
    "يبقى هذا الجانب مفتوحًا أمام الدرس والتحقيق",
  ];
  return variasiUmum[urutan % variasiUmum.length]!;
}

/**
 * Bangun daftar kasus latar belakang dari artikel per klaster.
 */
export function susunKasus(
  artikel: ArtikelJurnal[],
  klaster: 1 | 2 | 3,
  batas = 4,
): KasusLatarBelakang[] {
  const hasil: KasusLatarBelakang[] = [];
  const sudahDipakai = new Set<string>();

  const kandidat = artikel.filter((a) => a.klaster === klaster);

  for (const a of kandidat) {
    if (hasil.length >= batas) break;

    const abstrak = (a.abstrak ?? "").trim();
    const adaAbstrak = abstrak.length > 60 && !abstrak.startsWith("[Abstrak tidak tersedia");

    let pernyataan = "";
    let kekuatan: KasusLatarBelakang["kekuatan"] = "lemah";
    let catatan = "";

    if (adaAbstrak) {
      const kalimat = pecahKalimat(abstrak).filter(layak);
      // Urutkan dari yang paling kuat mengungkap masalah.
      const berperingkat = kalimat
        .map((k) => ({ k, skor: skorMasalah(k) }))
        .filter((x) => x.skor > 0)
        .sort((x, y) => y.skor - x.skor);

      if (berperingkat.length > 0) {
        pernyataan = berperingkat[0]!.k;
        kekuatan = berperingkat[0]!.skor >= 2 ? "kuat" : "sedang";
        catatan = "Kalimat masalah diambil langsung dari abstrak artikel.";
      } else if (kalimat.length > 0) {
        pernyataan = kalimat[0]!;
        kekuatan = "sedang";
        catatan =
          "Abstrak ada, tetapi tidak menyebut masalah secara eksplisit. Kalimat pertama dipakai sebagai konteks — periksa artikel aslinya.";
      }
    }

    if (!pernyataan) {
      // Jujur: tidak ada abstrak. Pakai judul sebagai konteks, jangan mengarang.
      pernyataan = a.judul;
      kekuatan = "lemah";
      catatan =
        "Abstrak tidak tersedia dari API. Kasus ini hanya berupa konteks judul — buka DOI dan tulis ulang setelah membaca artikel.";
    }

    // Hindari kasus kembar.
    const sidik = pernyataan.slice(0, 80).toLowerCase();
    if (sudahDipakai.has(sidik)) continue;
    sudahDipakai.add(sidik);

    hasil.push({
      urut: hasil.length + 1,
      klaster,
      pernyataan,
      arab: keArab(pernyataan, klaster, hasil.length),
      sumber: `${penulisPendek(a.penulis)}${a.tahun ? "، " + String(a.tahun) : ""}`,
      judulArtikel: a.judul,
      tautan: a.doi ? `https://doi.org/${a.doi}` : (a.url ?? ""),
      tahun: a.tahun ? String(a.tahun) : "",
      kekuatan,
      catatan,
    });
  }

  return hasil;
}

/**
 * Rangkai kasus menjadi paragraf Arab yang siap ditempel.
 * Mengembalikan string kosong bila tidak ada kasus — supaya pemanggil bisa
 * memberi pesan jujur, bukan paragraf bohong.
 */
export function narasiKasusArab(kasus: KasusLatarBelakang[], klaster: 1 | 2 | 3): string {
  if (kasus.length === 0) return "";

  const bingkai = PEMBINGKAI[klaster];
  const isi = kasus.map((k, i) => `${i + 1}. ${k.arab} (${k.sumber}).`).join("\n");
  return `${bingkai.pembuka}:\n\n${isi}\n\n${bingkai.penutup}.`;
}

/**
 * Ringkas bahan yang perlu dibaca manual — dipakai UI untuk jujur soal kualitas.
 */
export function ringkasKualitas(kasus: KasusLatarBelakang[]): {
  kuat: number;
  sedang: number;
  lemah: number;
  siapPakai: number;
} {
  return {
    kuat: kasus.filter((k) => k.kekuatan === "kuat").length,
    sedang: kasus.filter((k) => k.kekuatan === "sedang").length,
    lemah: kasus.filter((k) => k.kekuatan === "lemah").length,
    siapPakai: kasus.filter((k) => k.kekuatan !== "lemah").length,
  };
}