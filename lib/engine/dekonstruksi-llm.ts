/**
 * Dekonstruksi judul berbasis LLM.
 *
 * MENGAPA INI DIPERLUKAN
 * ----------------------
 * Versi heuristik membagi judul menjadi 3 bagian berdasarkan jumlah kata.
 * Untuk judul "Pengaruh Media Sosial terhadap Motivasi Belajar Santri",
 * hasilnya: klaster1=["Pengaruh","Media"], klaster2=["Sosial","terhadap"],
 * klaster3=["Motivasi","Belajar","Santri"]. Kata "Sosial" masuk klaster 2
 * padahal ia bagian dari frasa "Media Sosial". Akibatnya pencarian artikel
 * untuk klaster 2 memakai kata kunci "Sosial terhadap" yang tidak bermakna.
 *
 * LLM memahami frasa dan semantik, sehingga bisa memisahkan:
 *   Klaster 1 (Fondasi):  "Media Sosial" — objek kajian
 *   Klaster 2 (Metode):   "Pengaruh ... terhadap" — variabel/korelasi
 *   Klaster 3 (Konteks):  "Motivasi Belajar Santri" — subjek & setting
 *
 * DESAIN
 * ------
 *  - Meminta JSON terstruktur agar hasil bisa di-parse deterministik.
 *  - Validasi ketat: harus ada 3 klaster, masing-masing punya kalimatKunci
 *    non-kosong. Bila tidak valid → fallback ke heuristik.
 *  - Timeout 15 detik. Bila semua penyedia gagal → fallback ke heuristik.
 *  - Tidak pernah melempar error ke pemanggil. Selalu mengembalikan KlasterJudul.
 */

import { panggilLLM, type HasilLLM } from "@/lib/refs/llm/penyedia";
import type { KlasterJudul } from "./khalfiyah";

/** Format yang diminta dari LLM. */
interface ResponLLM {
  klaster1: {
    label: string;
    kalimatKunci: string[];
    deskripsi: string;
  };
  klaster2: {
    label: string;
    kalimatKunci: string[];
    deskripsi: string;
  };
  klaster3: {
    label: string;
    kalimatKunci: string[];
    deskripsi: string;
  };
}

const PROMPT_SISTEM = `أنت مساعد بحث أكاديمي متخصص في الدراسات الإسلامية والتربوية.
مهمتك: تحليل عنوان البحث وتقسيمه إلى ثلاثة محاور أساسية لخلفية البحث (خلفية البحث).

القواعد الصارمة:
1. أجب بـ JSON صالح فقط، بدون أي نص إضافي قبل أو بعد.
2. كل محور يجب أن يحتوي على كلمات مفتاحية حقيقية من العنوان، ليست كلمات عامة.
3. المحور الأول: الموضوع الأساسي / الظاهرة المدروسة.
4. المحور الثاني: المنهجية / المتغير المستقل / الأداة / التدخل.
5. المحور الثالث: السياق / الفئة المستهدفة / الهدف / الموقع.
6. الكلمات المفتاحية يجب أن تكون عبارات ذات معنى، لا كلمات مفردة بلا سياق.
7. اكتب التسميات والوصف باللغة الإندونيسية.
8. لا تكتب أبدًا أسماء كتب أو مراجع أو أرقام صفحات.`;

function buatPrompt(judul: string): string {
  return `حلّل هذا العنوان وقسّمه إلى ثلاثة محاور:

العنوان: "${judul}"

أجب بهذا الشكل بالضبط:
{
  "klaster1": {
    "label": "الموضوع الأساسي (Topik Fondasi)",
    "kalimatKunci": ["kata kunci 1", "kata kunci 2"],
    "deskripsi": "Penjelasan singkat dalam bahasa Indonesia"
  },
  "klaster2": {
    "label": "المنهج أو المتغير (Metode/Variabel)",
    "kalimatKunci": ["kata kunci 1", "kata kunci 2"],
    "deskripsi": "Penjelasan singkat dalam bahasa Indonesia"
  },
  "klaster3": {
    "label": "السياق والأهداف (Konteks & Tujuan)",
    "kalimatKunci": ["kata kunci 1", "kata kunci 2"],
    "deskripsi": "Penjelasan singkat dalam bahasa Indonesia"
  }
}`;
}

/**
 * Coba ekstrak JSON dari teks LLM.
 * LLM kadang membungkus JSON dalam ```json ... ``` atau menambahkan penjelasan.
 */
function ekstrakJSON(teks: string): unknown | null {
  // Coba parse langsung dulu.
  try {
    return JSON.parse(teks);
  } catch {
    // kosong
  }

  // Coba ambil blok kode.
  const blok = teks.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blok) {
    try {
      return JSON.parse(blok[1].trim());
    } catch {
      // kosong
    }
  }

  // Coba cari objek JSON pertama.
  const mulai = teks.indexOf("{");
  const akhir = teks.lastIndexOf("}");
  if (mulai >= 0 && akhir > mulai) {
    try {
      return JSON.parse(teks.slice(mulai, akhir + 1));
    } catch {
      // kosong
    }
  }

  return null;
}

/** Validasi bahwa respon LLM memenuhi kontrak KlasterJudul. */
function valid(obj: unknown): obj is ResponLLM {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;

  for (const k of ["klaster1", "klaster2", "klaster3"] as const) {
    const sub = o[k];
    if (!sub || typeof sub !== "object") return false;
    const s = sub as Record<string, unknown>;
    if (typeof s.label !== "string" || !s.label.trim()) return false;
    if (!Array.isArray(s.kalimatKunci) || s.kalimatKunci.length === 0) return false;
    if (s.kalimatKunci.some((x) => typeof x !== "string" || !x.trim())) return false;
    if (typeof s.deskripsi !== "string" || !s.deskripsi.trim()) return false;
  }

  return true;
}

/** Hasil dekonstruksi beserta metadata untuk audit. */
export interface HasilDekonstruksi {
  klaster: KlasterJudul;
  /** "llm" bila berhasil via LLM, "heuristik" bila fallback. */
  metode: "llm" | "heuristik";
  /** Penyedia LLM yang menjawab (bila metode === "llm"). */
  penyedia?: string;
  /** Model yang dipakai (bila metode === "llm"). */
  model?: string;
  /** Alasan fallback (bila metode === "heuristik"). */
  alasanFallback?: string;
}

/**
 * Dekonstruksi judul via LLM dengan fallback ke heuristik.
 * Tidak pernah melempar — selalu mengembalikan HasilDekonstruksi.
 */
export async function dekonstruksiLLM(
  judul: string,
  heuristikFallback: () => KlasterJudul,
): Promise<HasilDekonstruksi> {
  const prompt = buatPrompt(judul);

  try {
    const { hasil, dicoba } = await panggilLLM(prompt, {
      batasMs: 15000,
      maksToken: 500,
    });

    if (!hasil) {
      const alasan = dicoba
        .map((d) => `${d.penyedia}: ${d.alasan}`)
        .join("; ");
      return {
        klaster: heuristikFallback(),
        metode: "heuristik",
        alasanFallback: `Semua penyedia LLM gagal: ${alasan}`,
      };
    }

    const obj = ekstrakJSON(hasil.teks);
    if (!valid(obj)) {
      return {
        klaster: heuristikFallback(),
        metode: "heuristik",
        alasanFallback: `Respon LLM bukan JSON valid (${hasil.penyedia}/${hasil.model})`,
      };
    }

    return {
      klaster: {
        klaster1: {
          label: obj.klaster1.label,
          kalimatKunci: obj.klaster1.kalimatKunci.map((k) => k.trim()),
          deskripsi: obj.klaster1.deskripsi,
        },
        klaster2: {
          label: obj.klaster2.label,
          kalimatKunci: obj.klaster2.kalimatKunci.map((k) => k.trim()),
          deskripsi: obj.klaster2.deskripsi,
        },
        klaster3: {
          label: obj.klaster3.label,
          kalimatKunci: obj.klaster3.kalimatKunci.map((k) => k.trim()),
          deskripsi: obj.klaster3.deskripsi,
        },
      },
      metode: "llm",
      penyedia: hasil.penyedia,
      model: hasil.model,
    };
  } catch (e) {
    return {
      klaster: heuristikFallback(),
      metode: "heuristik",
      alasanFallback: e instanceof Error ? e.message : "Error tidak dikenal",
    };
  }
}
