/**
 * AI Handoff — Ekspor draft ke AI eksternal & impor hasil kembali.
 * Utruha v2.0
 *
 * Mekanisme: copy-to-clipboard + buka URL (browser tidak bisa auto-type ke web lain).
 * Prompt template menyertakan instruksi footnote valid + format return.
 */

// ─── Provider Config ──────────────────────────────────────────────────────────

export interface AIProvider {
  id: string;
  nama: string;
  url: string;
  batasKarakter: number;
  warna: string; // Untuk UI badge
}

export const AI_PROVIDERS: AIProvider[] = [
  { id: "gemini", nama: "Gemini", url: "https://gemini.google.com/app", batasKarakter: 30000, warna: "#4285F4" },
  { id: "qwen", nama: "Qwen", url: "https://chat.qwen.ai", batasKarakter: 25000, warna: "#FF6A00" },
  { id: "gpt", nama: "ChatGPT", url: "https://chat.openai.com", batasKarakter: 15000, warna: "#10A37F" },
  { id: "meta", nama: "Meta AI", url: "https://meta.ai", batasKarakter: 20000, warna: "#0064E0" },
  { id: "deepseek", nama: "DeepSeek", url: "https://chat.deepseek.com", batasKarakter: 20000, warna: "#1A1A2E" },
];

// ─── Prompt Template ──────────────────────────────────────────────────────────

const PROMPT_TEMPLATE = `أنت مساعد أكاديمي متخصص في الكتابة العلمية باللغة العربية.

المسودة التالية هي جزء من بحث علمي. مهمتك:
1. حسّن الصياغة الأكاديمية مع الحفاظ على المعنى الأصلي.
2. أضف هوامش (footnotes) صالحة بالرجوع إلى المصادر التالية فقط:
   - موقع الشميلة للكتب التراثية: https://shamela.ws
   - المجلات العربية المحكمة عبر DOAJ: https://doaj.org
   - Crossref للأبحاث الدولية: https://crossref.org
3. كل هامش يجب أن يتضمن: اسم المؤلف، عنوان الكتاب/المقال، مكان النشر، الناشر، السنة، الجزء، الصفحة.
4. لا تخترع مصادر أو صفحات. إذا لم تجد مصدرًا مناسبًا، اكتب [بحاجة إلى مصدر].
5. أعد النتيجة بالصيغة التالية حتى يمكن إعادتها للنظام:

---BEGIN_RESULT---
[النص المحسن مع الهوامش بصيغة [^1] [^2]...]

[^1]: المؤلف، العنوان، (المدينة: الناشر، السنة)، جـ، ص.
[^2]: ...
---END_RESULT---

⚠️ تنبيه: البيانات المرسلة ستُعالَج بواسطة ذكاء اصطناعي خارجي. تأكد من عدم تضمين معلومات شخصية حساسة.

---

المسودة:
`;

/**
 * Buat prompt lengkap untuk dikirim ke AI eksternal.
 * @param markdown - Draft section yang akan dikirim
 * @param sectionId - ID section untuk konteks tambahan
 * @param editablePrompt - Prompt custom user (opsional, override default)
 */
export function buatPromptAI(
  markdown: string,
  sectionId: string,
  editablePrompt?: string,
): string {
  const base = editablePrompt ?? PROMPT_TEMPLATE;
  return `${base}\n${markdown}`;
}

/**
 * Siapkan payload ekspor untuk satu provider.
 * Memotong draft jika melebihi batas karakter.
 */
export interface PayloadEkspor {
  provider: AIProvider;
  promptLengkap: string;
  terpotong: boolean;
  panjangAsli: number;
  panjangFinal: number;
  url: string;
}

export function siapkanEkspor(
  markdown: string,
  providerId: string,
  sectionId: string,
  editablePrompt?: string,
): PayloadEkspor | null {
  const provider = AI_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;

  const promptLengkap = buatPromptAI(markdown, sectionId, editablePrompt);
  const terpotong = promptLengkap.length > provider.batasKarakter;
  const finalPrompt = terpotong
    ? promptLengkap.slice(0, provider.batasKarakter) + "\n\n[… تم اقتصاص النص بسبب حدود الرموز]"
    : promptLengkap;

  return {
    provider,
    promptLengkap: finalPrompt,
    terpotong,
    panjangAsli: promptLengkap.length,
    panjangFinal: finalPrompt.length,
    url: provider.url,
  };
}

// ─── Impor Hasil AI ───────────────────────────────────────────────────────────

export interface HasilImporAI {
  teksNaskah: string;
  footnotes: Array<{ nomor: number; teks: string }>;
  berhasil: boolean;
  pesanError?: string;
}

/**
 * Parse hasil dari AI eksternal.
 * Mencari blok ---BEGIN_RESULT--- ... ---END_RESULT--- atau fallback parse [^N].
 */
export function parseHasilAI(input: string): HasilImporAI {
  if (!input || !input.trim()) {
    return { teksNaskah: "", footnotes: [], berhasil: false, pesanError: "Input kosong." };
  }

  // Coba parse blok BEGIN/END RESULT
  const blokMatch = input.match(/---BEGIN_RESULT---\s*([\s\S]*?)\s*---END_RESULT---/);
  const teksRelevan = blokMatch ? blokMatch[1]! : input;

  // Extract footnotes [^N]: ...
  const fnRegex = /\[\^(\d+)\]:\s*(.+?)(?=\[\^\d+\]:|$)/gs;
  const footnotes: Array<{ nomor: number; teks: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = fnRegex.exec(teksRelevan)) !== null) {
    footnotes.push({
      nomor: parseInt(match[1]!, 10),
      teks: match[2]!.trim(),
    });
  }

  // Hapus footnote dari teks naskah
  let teksNaskah = teksRelevan.replace(/\[\^\d+\]/g, "").replace(fnRegex, "").trim();

  // Bersihkan marker BEGIN/END jika masih ada
  teksNaskah = teksNaskah
    .replace(/---BEGIN_RESULT---/g, "")
    .replace(/---END_RESULT---/g, "")
    .trim();

  if (!teksNaskah && footnotes.length === 0) {
    return { teksNaskah: input, footnotes: [], berhasil: false, pesanError: "Tidak dapat memisahkan naskah dan footnote dari hasil AI." };
  }

  return { teksNaskah, footnotes, berhasil: true };
}

// ─── Diff Preview ─────────────────────────────────────────────────────────────

export interface DiffSegment {
  type: "same" | "added" | "removed";
  text: string;
}

/**
 * Generate simple word-level diff antara teks asli dan hasil AI.
 * Untuk preview sebelum diterapkan.
 */
export function generateDiff(asli: string, baru: string): DiffSegment[] {
  const kataAsli = asli.split(/\s+/);
  const kataBaru = baru.split(/\s+/);
  const segments: DiffSegment[] = [];

  let i = 0, j = 0;
  while (i < kataAsli.length || j < kataBaru.length) {
    if (i < kataAsli.length && j < kataBaru.length && kataAsli[i] === kataBaru[j]) {
      segments.push({ type: "same", text: kataAsli[i]! });
      i++; j++;
    } else if (j < kataBaru.length && (i >= kataAsli.length || !kataAsli.slice(i, i + 5).includes(kataBaru[j]!))) {
      segments.push({ type: "added", text: kataBaru[j]! });
      j++;
    } else if (i < kataAsli.length) {
      segments.push({ type: "removed", text: kataAsli[i]! });
      i++;
    } else {
      break;
    }
  }

  return segments;
}
