/**
 * Mengubah paragraf Arab menjadi ISTILAH PENCARIAN.
 *
 * Batas tegas peran LLM di sini:
 *  - LLM hanya membaca paragraf dan mengusulkan kata/frasa Arab yang lazim
 *    dipakai kitab untuk membahas topik itu.
 *  - LLM TIDAK menulis nama kitab, penulis, jilid, halaman, tahun, penerbit.
 *  - Semua sitasi tetap datang dari Turath. Kalau LLM mengarang istilah yang
 *    tidak ada di korpus, Turath mengembalikan nol dan istilah itu dibuang.
 */
import { panggilLLM, type OpsiLLM } from "@/lib/refs/llm/penyedia";

export interface IstilahLLM {
  /** Istilah pencarian Arab yang siap dikirim ke Turath. */
  istilah: string[];
  /** Penyedia yang menjawab ("ollama", "gemini", …). */
  penyedia: string;
  /** Model yang dipakai. */
  model: string;
  /** true bila gagal dan pemanggil harus pakai cara deterministik. */
  gagal: boolean;
  /** Alasan gagal, ditampilkan apa adanya. */
  alasan?: string;
}

const SISTEM = `أنت خبير ومحقق في التراث الإسلامي ومناهج التأليف في الدراسات العليا.
إذا قرأت فقرة تتناول دراسة كتاب أو منظومة معينة (خاصة كتب العلماء المتأخرين أو المحليين مثل علماء إندونيسيا التي لا توجد نصوصها مباشرة في فهارس التراث الكلاسيكية القديمة):
فإن مهمتك ليست التشبث باسم الكتاب الحرفي، بل فهم "المعنى والقضية العلمية المنهجية الكلية" واستخراج موضوعات تأصيلية من أمهات كتب التراث تدعم فكرة الباحث وتصلح كحواشٍ ومراجع علمية (Shawahid & Maraji').

مثال توضيحي:
إذا كان النص يتحدث عن: منظومة تعليمية في أصول التفسير اعتمدت منهج الاختصار وتقريب العلم للمتعلمين في المقدمة.
فالموضوعات التراثية الداعمة هي:
تقريب العلم وتيسيره للمتعلمين
منهج الاختصار في الكتب
نظم أصول التفسير
مقاصد التأليف في المقدمات

القواعد الإلزامية:
1. ركز على جوهر المعنى التقعيدي والمنهجي الذي يسنده التراث.
2. أخرج من 3 إلى 5 موضوعات علمية مركبة (كل موضوع من 2 إلى 4 كلمات).
3. احذر تمامًا من إخراج كلمات مفردة مبتورة مثل "الاختصار" فقط.
4. أخرج العناوين فقط، كل عنوان في سطر مستقل، بدون أرقام وبدون شرح.`;

/** Baris jawaban model → daftar istilah yang bersih. */
export function bersihkanJawaban(teks: string, maks = 8): string[] {
  const out: string[] = [];
  for (const barisKasar of teks.split(/\r?\n/)) {
    let b = barisKasar.trim();
    if (!b) continue;

    // Buang penomoran, label prefiks seperti "مصطلح:", "مصطفى:", dll.
    b = b.replace(/^[-*•·]\s*/, "");
    b = b.replace(/^\d+[).\]:-]\s*/, "");
    b = b.replace(/^[\u0600-\u06FF\s]+[:：]\s*/u, "");
    b = b.replace(/^["'«»“”]+|["'«»“”]+$/g, "");
    b = b.replace(/[.،,؛;]+$/g, "");
    b = b.trim();

    if (!b) continue;
    // Hanya huruf Arab dan spasi — membuang penjelasan berbahasa lain.
    if (!/^[\u0600-\u06FF\s'’\-]+$/u.test(b)) continue;

    const kata = b.split(/\s+/).filter(Boolean);
    // 1..5 kata: terima istilah baik 1 kata penting maupun frasa
    if (kata.length < 1 || kata.length > 5) continue;
    if (!out.includes(b)) out.push(b);
    if (out.length >= maks) break;
  }
  return out;
}

/**
 * Minta LLM mengusulkan istilah. Tidak pernah melempar.
 */
export async function istilahDariParagraf(
  paragraf: string,
  opsi: OpsiLLM & { hanya?: string[]; maks?: number } = {},
): Promise<IstilahLLM> {
  const bersih = paragraf.replace(/\s+/g, " ").trim();
  if (bersih.length < 20) {
    return { istilah: [], penyedia: "", model: "", gagal: true, alasan: "Paragraf terlalu pendek." };
  }

  const prompt = `${SISTEM}\n\nالفقرة:\n${bersih.slice(0, 1500)}`;
  const { hasil, dicoba } = await panggilLLM(prompt, opsi);

  if (!hasil) {
    const alasan = dicoba.length
      ? dicoba.map((d) => `${d.penyedia}: ${d.alasan}`).join("; ")
      : "Tidak ada penyedia LLM yang siap.";
    return { istilah: [], penyedia: "", model: "", gagal: true, alasan };
  }

  const istilah = bersihkanJawaban(hasil.teks, opsi.maks ?? 8);
  if (istilah.length === 0) {
    return {
      istilah: [],
      penyedia: hasil.penyedia,
      model: hasil.model,
      gagal: true,
      alasan: "Model menjawab, tetapi tidak ada istilah Arab yang bisa dipakai.",
    };
  }
  return { istilah, penyedia: hasil.penyedia, model: hasil.model, gagal: false };
}
