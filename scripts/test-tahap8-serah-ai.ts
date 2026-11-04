/**
 * Uji penerimaan Pembangunan Ulang Tahap 8: tombol salin prompt ke AI
 * luar untuk pengembangan (poin A8, butir 8 perintah user).
 *
 * Yang dibuktikan:
 * - Daftar penyedia serah tepat empat (ChatGPT, Claude, DeepSeek,
 *   Meta AI) dengan URL resmi yang benar, diambil dari AI_PROVIDERS
 *   yang sama; Claude sudah masuk AI_PROVIDERS; penyedia warisan
 *   (Gemini, Qwen) TIDAK dihapus sesuai RENCANA Tahap 8.
 * - Prompt kembangkan meracik konteks nyata proyek: judul, nama
 *   bagian, dan teks saat ini tampil persis; instruksinya berbahasa
 *   Arab akademik dengan larangan mengarang rujukan (yang butuh
 *   rujukan ditandai [يحتاج إلى مرجع]) dan kewajiban menjaga penanda
 *   sitasi [[ref:...]] apa adanya.
 * - Tidak ada placeholder templat yang bocor; baris target panjang
 *   hanya muncul dari targetKata nyata bagian itu; prompt silang
 *   konteks tidak mencampur data proyek lain.
 * - Bagian kosong berperilaku jujur: prompt null, serah null.
 * - Serah per penyedia: yang ditampilkan panel adalah yang disalin;
 *   pemotongan ke batas aman penyedia dinyatakan lewat penanda dan
 *   bendera terpotong; penyedia tak dikenal ditolak.
 * - Fungsi warisan modul (buatPromptAI, siapkanEkspor, parseHasilAI,
 *   generateDiff) tidak dihapus dan tetap bekerja.
 * - Sumber komponen: panel memakai satu sumber string (serah.prompt)
 *   untuk tampilan, salinan, dan pembukaan tab; URL penyedia tidak
 *   ditulis keras di komponen; label kejujuran tampil; tombol
 *   "Kembangkan di AI luar" terpasang di tulis-tab (teks diblok lebih
 *   dulu, selain itu draf bagian aktif) dan di khalfiyah-composer
 *   (draf narasi panel itu).
 *
 * Jalankan: npx tsx scripts/test-tahap8-serah-ai.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

const JUDUL = "أثر أصول الفقه في الحياة المعاصرة";
const JUDUL_LAIN = "تعليم النحو في المدارس الداخلية";
const TEKS =
  "يتناول هذا البحث أثر أصول الفقه في حياة المسلم المعاصر[[ref:src-uji1234|hlm: 12]]، ويبيّن كيف تتجلى القواعد الأصولية في الفتوى والتعامل اليومي، ثم يربط ذلك بواقع التعليم في المعاهد.";
const PEDOMAN = "Pedoman Penulisan Risalah Ma'had Aly DDI Mangkoso";

async function main() {
  const {
    AI_PROVIDERS,
    ID_PENYEDIA_SERAH,
    penyediaSerah,
    buatPromptKembangkan,
    siapkanSerahKembangkan,
    buatPromptAI,
    siapkanEkspor,
    parseHasilAI,
    generateDiff,
  } = await import("../lib/engine/ai-handoff");

  /* ---------- A. Daftar penyedia ---------- */
  const claude = AI_PROVIDERS.find((p) => p.id === "claude");
  cek("A1 Claude masuk AI_PROVIDERS dengan URL resmi", Boolean(claude) && claude!.nama === "Claude" && claude!.url === "https://claude.ai");
  cek(
    "A2 penyedia warisan Gemini dan Qwen tidak dihapus",
    AI_PROVIDERS.some((p) => p.id === "gemini") && AI_PROVIDERS.some((p) => p.id === "qwen"),
  );
  const serah = penyediaSerah();
  cek("A3 penyedia serah tepat empat", serah.length === 4, `dapat ${serah.length}`);
  cek(
    "A4 urutan penyedia serah sesuai ID_PENYEDIA_SERAH",
    JSON.stringify(serah.map((p) => p.id)) === JSON.stringify([...ID_PENYEDIA_SERAH]),
    serah.map((p) => p.id).join(","),
  );
  const urlHarapan: Record<string, string> = {
    gpt: "https://chatgpt.com",
    claude: "https://claude.ai",
    deepseek: "https://chat.deepseek.com",
    meta: "https://meta.ai",
  };
  cek(
    "A5 URL keempat penyedia serah resmi dan benar",
    serah.every((p) => urlHarapan[p.id] === p.url),
    serah.map((p) => `${p.id}=${p.url}`).join(" "),
  );
  cek(
    "A6 penyedia serah adalah objek yang sama dari AI_PROVIDERS (satu sumber)",
    serah.every((p) => AI_PROVIDERS.includes(p)),
  );

  /* ---------- B. Racikan prompt ---------- */
  const konteks = { judul: JUDUL, namaBagian: "خلفية البحث", teks: TEKS };
  const prompt = buatPromptKembangkan(konteks);
  cek("B1 prompt terbentuk untuk konteks nyata", typeof prompt === "string" && prompt.length > 0);
  const pr = prompt ?? "";
  cek("B2 prompt memuat judul persis", pr.includes(JUDUL));
  cek("B3 prompt memuat nama bagian persis", pr.includes("خلفية البحث"));
  cek("B4 prompt memuat teks saat ini persis utuh (termasuk penandanya)", pr.includes(TEKS));
  cek(
    "B5 instruksi melarang mengarang rujukan dan menyiapkan penanda jujur",
    pr.includes("لا تخترع مراجع") && pr.includes("[يحتاج إلى مرجع]"),
  );
  cek(
    "B6 instruksi menjaga penanda sitasi disebut sebelum blok teks",
    pr.indexOf("[[ref:") !== -1 && pr.indexOf("[[ref:") < pr.indexOf("النص الحالي:"),
  );
  cek(
    "B7 tidak ada placeholder templat yang bocor",
    !pr.includes("{{") && !pr.includes("{judul}") && !pr.includes("{teks}") && !pr.includes("${") && !pr.includes("[اسم الباحث]") && !pr.includes("undefined"),
  );
  cek("B8 tanpa pedoman, baris pedoman tidak dimunculkan", !pr.includes("يُكتب هذا البحث وفق"));
  const promptPedoman = buatPromptKembangkan({ ...konteks, namaPedoman: PEDOMAN }) ?? "";
  cek("B9 dengan pedoman, nama pedoman proyek tampil persis", promptPedoman.includes(PEDOMAN) && promptPedoman.includes("يُكتب هذا البحث وفق"));
  cek("B10 tanpa targetKata, tidak ada baris target yang dikarang", !pr.includes("المستهدف"));
  const promptTarget = buatPromptKembangkan({ ...konteks, targetKata: 900 }) ?? "";
  cek(
    "B11 targetKata nyata di bawah capaian memunculkan baris target dengan angkanya",
    promptTarget.includes("المستهدف") && promptTarget.includes("900"),
  );
  const kataTeks = TEKS.split(/\s+/).filter(Boolean).length;
  const promptTargetKecil = buatPromptKembangkan({ ...konteks, targetKata: Math.max(1, kataTeks - 1) }) ?? "";
  cek("B12 targetKata yang sudah terlampaui tidak memunculkan baris target", !promptTargetKecil.includes("المستهدف"));
  cek("B13 teks kosong menghasilkan prompt null", buatPromptKembangkan({ ...konteks, teks: "" }) === null);
  cek("B14 teks hanya spasi menghasilkan prompt null", buatPromptKembangkan({ ...konteks, teks: "   \n  " }) === null);
  const promptLain = buatPromptKembangkan({ judul: JUDUL_LAIN, namaBagian: "خلفية البحث", teks: TEKS }) ?? "";
  cek(
    "B15 prompt tidak mencampur data proyek lain",
    promptLain.includes(JUDUL_LAIN) && !promptLain.includes(JUDUL) && !pr.includes(JUDUL_LAIN),
  );

  /* ---------- C. Serah per penyedia ---------- */
  const serahGpt = siapkanSerahKembangkan(konteks, "gpt");
  cek("C1 serah ChatGPT terbentuk", serahGpt !== null);
  cek(
    "C2 prompt serah sama persis dengan hasil pembangun prompt (yang tampil = yang disalin)",
    serahGpt !== null && serahGpt.prompt === pr,
  );
  cek(
    "C3 serah di bawah batas tidak terpotong dan URL-nya URL penyedia",
    serahGpt !== null && serahGpt.terpotong === false && serahGpt.url === "https://chatgpt.com",
  );
  cek("C4 jumlah kata serah sama dengan hitungan teks fixture", serahGpt !== null && serahGpt.jumlahKata === kataTeks);
  cek("C5 penyedia tak dikenal ditolak", siapkanSerahKembangkan(konteks, "tidak-ada") === null);
  cek("C6 teks kosong ditolak untuk semua penyedia", siapkanSerahKembangkan({ ...konteks, teks: "" }, "claude") === null);
  cek(
    "C7 keempat penyedia serah menghasilkan serah yang hidup",
    serah.every((p) => siapkanSerahKembangkan(konteks, p.id) !== null),
  );
  const teksPanjang = "كلمة ".repeat(6000).trim();
  const promptPanjang = buatPromptKembangkan({ judul: JUDUL, namaBagian: "خلفية البحث", teks: teksPanjang }) ?? "";
  const gptProvider = AI_PROVIDERS.find((p) => p.id === "gpt")!;
  const serahPanjang = siapkanSerahKembangkan({ judul: JUDUL, namaBagian: "خلفية البحث", teks: teksPanjang }, "gpt");
  cek(
    "C8 teks melewati batas aman terpotong dengan penanda jujur",
    serahPanjang !== null &&
      serahPanjang.terpotong === true &&
      serahPanjang.prompt.endsWith("[… تم اقتصاص النص بسبب حدود الرموز]") &&
      serahPanjang.prompt.length <= gptProvider.batasKarakter + 60 &&
      serahPanjang.panjangAsli === promptPanjang.length,
  );
  cek(
    "C9 potongan mempertahankan awal prompt asli",
    serahPanjang !== null && serahPanjang.prompt.startsWith(promptPanjang.slice(0, 200)),
  );

  /* ---------- D. Fungsi warisan modul tetap bekerja ---------- */
  cek("D1 buatPromptAI lama tetap memuat draf", buatPromptAI("draf uji tahap8", "khalfiya").includes("draf uji tahap8"));
  const eksporGemini = siapkanEkspor("draf uji tahap8", "gemini", "khalfiya");
  cek("D2 siapkanEkspor lama untuk Gemini tetap hidup", eksporGemini !== null && eksporGemini.provider.id === "gemini");
  const impor = parseHasilAI("---BEGIN_RESULT---\nنص محسن هنا.\n\n[^1]: مؤلف، عنوان، (مدينة: ناشر، 2020)، ج 1، ص. 5\n---END_RESULT---");
  cek("D3 parseHasilAI lama tetap membaca blok hasil + footnote", impor.berhasil && impor.footnotes.length === 1 && impor.teksNaskah.includes("نص محسن"));
  const diff = generateDiff("satu dua tiga", "satu dua empat");
  cek(
    "D4 generateDiff lama tetap bekerja",
    diff.some((s) => s.type === "added" && s.text === "empat") && diff.some((s) => s.type === "same" && s.text === "satu"),
  );

  /* ---------- E. Sumber komponen ---------- */
  const akar = path.join(process.cwd());
  const sumberPanel = readFileSync(path.join(akar, "components/workspace/serah-ai-panel.tsx"), "utf8");
  const sumberTulis = readFileSync(path.join(akar, "components/workspace/tulis-tab.tsx"), "utf8");
  const sumberKhalfiyah = readFileSync(path.join(akar, "components/workspace/khalfiyah-composer.tsx"), "utf8");
  cek(
    "E1 panel memakai pembangun modul yang sama",
    sumberPanel.includes("siapkanSerahKembangkan") && sumberPanel.includes("penyediaSerah"),
  );
  cek("E2 string yang ditampilkan adalah serah.prompt", sumberPanel.includes("value={serah.prompt}"));
  cek("E3 string yang disalin adalah serah.prompt yang sama", sumberPanel.includes("salinTeks(serah.prompt)"));
  cek("E4 tab penyedia dibuka dari URL data serah yang sama", sumberPanel.includes("window.open(serah.provider.url"));
  cek(
    "E5 komponen tidak menulis URL penyedia secara keras",
    !sumberPanel.includes("chatgpt.com") && !sumberPanel.includes("claude.ai") && !sumberPanel.includes("chat.deepseek.com") && !sumberPanel.includes("meta.ai"),
  );
  cek(
    "E6 label kejujuran panel tampil (tidak terkirim otomatis; tempel kembali sendiri)",
    sumberPanel.includes("tidak ada yang") && sumberPanel.includes("terkirim otomatis") && sumberPanel.includes("tempel hasilnya kembali"),
  );
  cek(
    "E7 tulis-tab memasang panel dan tombol, teks diblok didahulukan dari draf bagian",
    sumberTulis.includes("SerahAiPanel") && sumberTulis.includes("Kembangkan di AI luar") && sumberTulis.includes("seleksi ? seleksi.teks : teks"),
  );
  cek(
    "E8 khalfiyah-composer memasang panel dengan draf narasi panelnya",
    sumberKhalfiyah.includes("SerahAiPanel") && sumberKhalfiyah.includes("Kembangkan di AI luar") && sumberKhalfiyah.includes("teks: hasil.narasiLengkap"),
  );

  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
