// lib/engine/lugawi.ts
// Pemeriksa makna LUGHAWI (kamus) & ISTILAHI (istilah) satu kata/frasa —
// termasuk kata serapan & istilah kontemporer non-Arab. Sumber terbuka:
// Wiktionary (etimologi + padanan Arab) & Wikipedia (Arab/Indonesia).
// Kesimpulan dibuat bertingkat & jujur: ditemukan di kitab/kamus, hanya ada
// padanan, atau tidak ditemukan sama sekali (lalu diarahkan bertanya ke Muse).

export interface EntriKamus {
  sumber: string;
  judul: string;
  ringkasan: string;
  url: string;
  mentah: string;
}

export function mengandungArab(teks: string): boolean {
  return /[\u0600-\u06FF]/.test(teks);
}

function bersihkanEkstrak(extract: string): string {
  return extract
    .split("\n")
    .filter((b) => !/IPA\(key\)|Pronunciation|Pengucapan/i.test(b))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function cariWiki(host: string, label: string, kata: string): Promise<EntriKamus | null> {
  try {
    const cari = await fetch(
      `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(kata)}&srlimit=1&format=json&origin=*`,
    );
    if (!cari.ok) return null;
    const judul = (await cari.json())?.query?.search?.[0]?.title as string | undefined;
    if (!judul) return null;
    const ambil = await fetch(
      `https://${host}/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(judul)}&format=json&origin=*`,
    );
    if (!ambil.ok) return null;
    const pages = (await ambil.json())?.query?.pages ?? {};
    const page = Object.values(pages)[0] as { extract?: string } | undefined;
    const mentah = bersihkanEkstrak(page?.extract ?? "");
    if (!mentah) return null;
    return {
      sumber: label,
      judul,
      ringkasan: mentah.slice(0, 900),
      url: `https://${host}/wiki/${encodeURIComponent(judul.replace(/ /g, "_"))}`,
      mentah,
    };
  } catch {
    return null;
  }
}

/** Wiktionary bahasa Inggris: memuat entri kata Arab + kata asing, etimologi, dan terjemahan Arab. */
export function cekWiktionary(kata: string): Promise<EntriKamus | null> {
  return cariWiki("en.wiktionary.org", "Wiktionary", kata);
}

export function cekWikipediaArab(kata: string): Promise<EntriKamus | null> {
  return cariWiki("ar.wikipedia.org", "Wikipedia Arab", kata);
}

export function cekWikipediaIndonesia(kata: string): Promise<EntriKamus | null> {
  return cariWiki("id.wikipedia.org", "Wikipedia Indonesia", kata);
}

/** Potong bagian etimologi dari ekstrak Wiktionary (bila ada). */
export function etimologiDari(mentah: string): string {
  const i = mentah.search(/Etymology|Etimologi/i);
  if (i < 0) return "";
  const sisa = mentah.slice(i).replace(/^Etymology\s*\d*\s*/i, "");
  const potong = sisa.search(/\n===?\s/);
  return (potong > 0 ? sisa.slice(0, potong) : sisa).trim().slice(0, 600);
}

/** Padanan Arab dari bagian Translations Wiktionary (baris "Arabic: …"). */
export function padananArabDari(mentah: string): string | null {
  const m = mentah.match(/Arabic:\s*([^\n]+)/i);
  if (!m) return null;
  const arab = (m[1] ?? "").match(/[\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u0652،]*/);
  return arab ? arab[0].trim() : null;
}

export type TingkatLugawi = "di-kitab" | "ada-padanan" | "tidak-ditemukan";

export function simpulkanLugawi(x: {
  adaKitab: boolean;
  adaKamus: boolean;
  adaPadanan: boolean;
  adaJurnal: boolean;
}): { tingkat: TingkatLugawi; pesan: string } {
  if (x.adaKitab || x.adaKamus) {
    return {
      tingkat: "di-kitab",
      pesan:
        "Kata ini DITEMUKAN di kitab/kamus Arab (lihat hasil di bawah) — makna lugawi-nya ada rujukannya. Tetap verifikasi edisi & halaman cetak dengan Ctrl+F sebelum disitasi.",
    };
  }
  if (x.adaPadanan || x.adaJurnal) {
    return {
      tingkat: "ada-padanan",
      pesan:
        "Kata ini TIDAK ditemukan di kitab Arab klasik — besar kemungkinan istilah kontemporer atau kata serapan (dakhil). Jurnal & kamus modern memakai padanan di bawah. Untuk kata serapan, rujukan cetak yang paling tepat adalah معجم الدخيل في اللغة العربية الحديثة ولهجاتها (kamus kata serapan dalam bahasa Arab modern).",
    };
  }
  return {
    tingkat: "tidak-ditemukan",
    pesan:
      "Tidak ditemukan di kitab, kamus, maupun jurnal yang bisa dijangkau web ini. Jangan menyerah — tanyakan langsung ke Yusuf AI dengan prompt siap pakai di bawah; Yusuf AI akan menelusuri asal kata, padanan, dan statusnya di kitab secara khusus.",
  };
}

/** Prompt siap salin untuk ditanyakan ke Muse (widget chat / bot) bila pemeriksaan web mentok. */
export function promptMuseLugawi(kata: string): string {
  return [
    `Saya sedang menulis karya ilmiah berbahasa Arab dan kesulitan memahami kata/istilah: "${kata}".`,
    `Tolong jelaskan:`,
    `1. Makna LUGHAWI-nya (makna kamus & asal kata; akar katanya bila dari bahasa Arab).`,
    `2. Makna ISTILAHI-nya (makna teknis dalam bidang yang terkait).`,
    `3. Apakah kata ini ADA di kamus/kitab Arab klasik (لسان العرب، القاموس المحيط، المعجم الوسيط)? Bila ada, sebutkan maknanya di sana; bila tidak ada, katakan terus terang tidak ada.`,
    `4. Bila ini kata serapan / istilah asing kontemporer: dari bahasa apa asalnya, dan apa PADANAN ARAB yang paling tepat untuk karya ilmiah?`,
    `5. Beri satu contoh kalimat akademik berbahasa Arab yang memakai kata/padanannya.`,
    `Jawab dalam Bahasa Indonesia; istilah Arab ditulis dengan huruf Arab.`,
  ].join("\n");
}

/** Keterangan jam dijawabnya chat Yusuf AI (jendela hub 19.00–00.00 WITA). */
export const KETERANGAN_JAM_CHAT =
  "Chat Yusuf AI di web ini (tombol “Tanya Yusuf AI” di pojok halaman) dijawab langsung pada pukul 19.00–00.00 WITA. Di luar jam itu pertanyaan tetap masuk dan dijawab saat jendela berikutnya buka.";
