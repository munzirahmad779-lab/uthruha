/**
 * Adapter Turath.io — satu-satunya sumber dengan endpoint terbuka yang
 * benar-benar diuji (GET https://api.turath.io/search?q=... → JSON).
 * Tidak butuh key. Bila endpoint berubah, adapter gagal dengan jujur
 * dan UI jatuh ke mode deep-link.
 */
import type { RefCandidate } from "@/lib/refs/types";
import { bersihkanKutipan, skorMirip } from "@/lib/refs/score";
import { skorKonsep } from "@/lib/refs/konsep";
import { ambilJson, type OpsiAdapter } from "@/lib/refs/adapters/http";

export const info = {
  id: "turath" as const,
  mode: "api" as const,
  base: process.env.TURATH_API_BASE ?? "https://api.turath.io",
  app: "https://app.turath.io",
};

interface MetaTurath {
  book_name?: string;
  author_name?: string;
  vol?: string;
  page?: number;
  page_id?: number;
  /** Judul bab — dipakai mode konsep untuk menilai topik bahasan. */
  headings?: string[];
}

interface ItemTurath {
  book_id: number;
  meta: string;
  snip?: string;
  text?: string;
}

interface ResTurath {
  count: number;
  data: ItemTurath[];
}

/**
 * Penerbit hanya ditebak bila judul menyebut nama دار/مكتبة/مؤسسة/مركز.
 * Penanda «ط إسطنبول» adalah keterangan cetakan, BUKAN penerbit — dibiarkan
 * kosong agar tidak menjadi karangan.
 */
export function tebakPenerbit(judul: string): string | undefined {
  const dar = judul.match(/((?:دار|مكتبة|مؤسسة|مركز)\s+[^,،]{2,50})/u);
  return dar ? dar[1].trim() : undefined;
}

export function tautanTurath(bookId: number, halaman?: number): string {
  const dasar = `${info.app}/book/${bookId}`;
  return halaman ? `${dasar}?page=${halaman}` : dasar;
}

/**
 * Turath mencocokkan **frasa persis**, bukan kata kunci lepas. Kalimat utuh
 * 19 kata hampir selalu menghasilkan 0 — yang dicari adalah potongan 4–6 kata
 * yang memang ada di kitab. Fungsi ini memecah kalimat menjadi beberapa
 * jendela kata yang saling tumpang tindih.
 *
 * Diuji langsung ke api.turath.io: jendela 5–6 kata selalu mengembalikan
 * hasil, jendela 3 kata mulai gagal pada frasa yang lebih khas.
 */
export function jendelaKueri(kalimat: string, panjang = 5, maks = 4): string[] {
  const kata = kalimat
    .replace(/[«»"'()\[\]{}،.؟!:؛,]/g, " ")
    .split(/\s+/)
    .filter((k) => k.length > 0);

  if (kata.length === 0) return [];
  if (kata.length <= panjang) return [kata.join(" ")];

  // Ambil jendela yang tersebar merata, bukan hanya dari awal kalimat:
  // bagian tengah biasanya memuat frasa paling khas.
  const jumlah = Math.min(maks, kata.length - panjang + 1);
  const langkah = Math.max(1, Math.floor((kata.length - panjang) / Math.max(1, jumlah - 1)));

  const out: string[] = [];
  for (let i = 0; i < jumlah; i++) {
    const mulai = Math.min(i * langkah, kata.length - panjang);
    const q = kata.slice(mulai, mulai + panjang).join(" ");
    if (q && !out.includes(q)) out.push(q);
  }
  return out;
}

interface HasilMentah {
  item: ItemTurath;
  kutipan: string;
  /** Konsep-konsep yang mengembalikan halaman ini. */
  konsepDari?: string[];
}
/** Satu halaman kitab = satu kunci, agar tidak muncul berkali-kali. */
function kunciHalaman(item: ItemTurath): string {
  let meta: MetaTurath = {};
  try {
    meta = JSON.parse(item.meta ?? "{}") as MetaTurath;
  } catch {
    meta = {};
  }
  return `${item.book_id}:${meta.vol ?? "-"}:${meta.page ?? meta.page_id ?? "-"}`;
}

export async function cari(kalimat: string, opsi: OpsiAdapter = {}): Promise<RefCandidate[]> {
  const maks = opsi.maks ?? 6;
  const kueri = jendelaKueri(kalimat);
  if (kueri.length === 0) return [];

  // Kumpulkan dari semua jendela; satu kueri gagal tidak mematikan yang lain.
  const mentah = new Map<string, HasilMentah>();
  let gagal = 0;
  let pesanGagal = "";

  for (const q of kueri) {
    // Abaikan istilah kata tunggal yang terlalu umum/luas seperti "الاختصار"
    if (q.trim().split(/\s+/).length < 2 && ["الاختصار", "الكتاب", "العلم", "المسائل"].includes(q.trim())) {
      continue;
    }
    try {
      const url = `${info.base}/search?q=${encodeURIComponent(q)}`;
      const res = await ambilJson<ResTurath>(url, opsi);
      const data = Array.isArray(res?.data) ? res.data : [];
      for (const item of data) {
        const kutipan = bersihkanKutipan(item.snip ?? item.text ?? "");
        if (!kutipan) continue;
        // Dedup per halaman kitab, bukan per teks: satu halaman bisa muncul
        // dari beberapa jendela sekaligus.
        const kunci = kunciHalaman(item);
        const ada = mentah.get(kunci);
        const skorBaru = skorMirip(kalimat, kutipan);
        if (!ada || skorBaru > skorMirip(kalimat, ada.kutipan)) {
          mentah.set(kunci, { item, kutipan });
        }
      }
    } catch (e) {
      gagal++;
      pesanGagal = e instanceof Error ? e.message : "gagal";
    }
  }

  // Semua jendela gagal → ini GAGAL, bukan "tidak ada hasil". Membedakan
  // keduanya penting: pengguna berhak tahu apakah kitabnya tidak memuat
  // kalimat itu, atau servernya yang tidak menjawab.
  if (gagal === kueri.length) {
    throw new Error(`Turath tidak menjawab (${pesanGagal}). Coba lagi sebentar.`);
  }

  const out: RefCandidate[] = [];
  for (const { item, kutipan } of mentah.values()) {
    let meta: MetaTurath = {};
    try {
      meta = JSON.parse(item.meta ?? "{}") as MetaTurath;
    } catch {
      meta = {};
    }
    const skor = skorMirip(kalimat, kutipan);
    if (skor < 0.08) continue;

    const judul = (meta.book_name ?? "").trim();
    const jilid = meta.vol ? Number.parseInt(meta.vol, 10) : undefined;
    const halaman = typeof meta.page === "number" ? meta.page : undefined;
    const penerbit = judul ? tebakPenerbit(judul) : undefined;

    const kurang: string[] = [];
    if (!judul) kurang.push("nama kitab");
    if (!penerbit) kurang.push("penerbit");
    kurang.push("tahun", "kota");

    out.push({
      source: "turath",
      kitab: judul || "[ ! verifikasi ]",
      penulis: meta.author_name?.trim() || undefined,
      jilid: Number.isFinite(jilid) ? jilid : undefined,
      halaman_cetak: halaman,
      penerbit,
      teks_kutipan: kutipan,
      url_sumber: tautanTurath(item.book_id, halaman),
      skor: Number(skor.toFixed(3)),
      mode: "api",
      perluVerifikasi: true,
      catatanVerifikasi: `Turath tidak mengirim ${kurang.join(", ")}. Lengkapi dari halaman cetak sebelum dipakai.`,
    });
  }

  out.sort((a, b) => b.skor - a.skor);
  return out.slice(0, maks);
}

/**
 * Pencarian mode KONSEP ("makna").
 *
 * Turath tidak punya endpoint semantik/embedding — hanya pencocokan frasa.
 * Jadi pendekatannya: cari tiap konsep paragraf satu per satu, lalu nilai
 * setiap halaman berdasarkan berapa banyak konsep itu muncul di JUDUL BAB
 * kitab (`meta.headings`) dan di teks halaman.
 *
 * Hasilnya halaman yang membahas topik sama walau tidak memakai kata dari
 * paragraf asal. Ini pencocokan topik, BUKAN pemahaman makna.
 */
export async function cariKonsep(
  konsep: string[],
  opsi: OpsiAdapter = {},
): Promise<RefCandidate[]> {
  const maks = opsi.maks ?? 6;
  if (konsep.length === 0) return [];

  // Batasi jumlah kueri agar tidak membanjiri Turath.
  const kueri = konsep.slice(0, 6);

  // Bobot per konsep dari `count` Turath (mirip IDF): kata yang muncul di
  // ratusan ribu halaman ("أمثلة", "وقع") hampir tidak membedakan topik,
  // sedangkan kata khas ("المدني", "الترجيح") sangat membedakan.
  const bobot = new Map<string, number>();
  const mentah = new Map<string, HasilMentah & { headings: string[] }>();
  let gagal = 0;
  let pesanGagal = "";

  for (const q of kueri) {
    // Abaikan istilah kata tunggal yang terlalu umum/luas seperti "الاختصار"
    if (q.trim().split(/\s+/).length < 2 && ["الاختصار", "الكتاب", "العلم", "المسائل"].includes(q.trim())) {
      continue;
    }
    try {
      const url = `${info.base}/search?q=${encodeURIComponent(q)}`;
      const res = await ambilJson<ResTurath>(url, opsi);
      const data = Array.isArray(res?.data) ? res.data : [];
      const total = typeof res?.count === "number" ? res.count : data.length;

      // count 0 → tidak dipakai. count kecil → bobot tinggi.
      // Rumus: 1 / (1 + log10(1 + count)), dinormalkan ke 0.1..1.
      const b = total > 0 ? Math.max(0.1, Math.min(1, 1 / (1 + Math.log10(1 + total) / 2))) : 0;
      bobot.set(q, b);

      for (const item of data) {
        let meta: MetaTurath = {};
        // Abaikan istilah kata tunggal yang terlalu umum/luas seperti "الاختصار"
    if (q.trim().split(/\s+/).length < 2 && ["الاختصار", "الكتاب", "العلم", "المسائل"].includes(q.trim())) {
      continue;
    }
    try {
          meta = JSON.parse(item.meta ?? "{}") as MetaTurath;
        } catch {
          meta = {};
        }
        const kunci = kunciHalaman(item);
        const headings = Array.isArray(meta.headings) ? meta.headings : [];
        const kutipan = bersihkanKutipan(item.text ?? item.snip ?? "");
        const ada = mentah.get(kunci);
        if (!ada) {
          mentah.set(kunci, { item, kutipan, headings, konsepDari: [q] });
        } else {
          if (headings.length > ada.headings.length) {
            ada.headings = headings;
            ada.kutipan = kutipan || ada.kutipan;
          }
          ada.konsepDari = ada.konsepDari ?? [];
          if (!ada.konsepDari.includes(q)) ada.konsepDari.push(q);
        }
      }
    } catch (e) {
      // Satu konsep gagal tidak mematikan pencarian.
      gagal++;
      pesanGagal = e instanceof Error ? e.message : "gagal";
    }
  }

  // Semua konsep gagal dihubungi → laporkan gagal, jangan pura-pura kosong.
  if (gagal === kueri.length) {
    throw new Error(`Turath tidak menjawab (${pesanGagal}). Coba lagi sebentar.`);
  }

  // Konsep yang tidak menghasilkan apa pun dari Turath tidak boleh ikut
  // menurunkan skor halaman lain.
  const konsepHidup = konsep.filter((k) => (bobot.get(k) ?? 0) > 0);
  const totalBobot = konsepHidup.reduce((s, k) => s + (bobot.get(k) ?? 0), 0);

  const out: RefCandidate[] = [];
  for (const { item, kutipan, headings, konsepDari } of mentah.values()) {
    let meta: MetaTurath = {};
    try {
      meta = JSON.parse(item.meta ?? "{}") as MetaTurath;
    } catch {
      meta = {};
    }

    const s = skorKonsep(konsepHidup, headings, kutipan);
    const judulKitab = (meta.book_name ?? "").trim();

    // Bonus kecocokan jika nama kitab mengandung konsep utama yang dicari
    const cocokJudulKitab = konsepHidup.some(k => k.length > 3 && judulKitab.includes(k));

    // Jangan buang jika judul kitab cocok atau ada kecocokan teks yang kuat
    if (s.diHeading === 0 && !cocokJudulKitab && s.diTeks === 0) continue;

    // Skor akhir = kombinasi heading, judul kitab, dan teks
    const bobotCocok = s.konsepCocok.reduce((acc, k) => acc + (bobot.get(k) ?? 0), 0);
    let skorAkhir = totalBobot > 0 ? bobotCocok / totalBobot : s.skor;
    if (cocokJudulKitab) skorAkhir = Math.max(skorAkhir, 0.85);
    else if (s.diHeading === 0 && s.diTeks > 0) skorAkhir = Math.max(skorAkhir, s.skor * 0.7);
    if (bobotCocok === 0) continue;
    const judul = (meta.book_name ?? "").trim();
    const jilid = meta.vol ? Number.parseInt(meta.vol, 10) : undefined;
    const halaman = typeof meta.page === "number" ? meta.page : undefined;
    const penerbit = judul ? tebakPenerbit(judul) : undefined;

    const kurang: string[] = [];
    if (!judul) kurang.push("nama kitab");
    if (!penerbit) kurang.push("penerbit");
    kurang.push("tahun", "kota");

    const judulBab = headings.length > 0 ? headings[headings.length - 1] : "";
    void konsepDari;

    out.push({
      source: "turath",
      kitab: judul || "[ ! verifikasi ]",
      penulis: meta.author_name?.trim() || undefined,
      jilid: Number.isFinite(jilid) ? jilid : undefined,
      halaman_cetak: halaman,
      penerbit,
      teks_kutipan: kutipan || judulBab,
      url_sumber: tautanTurath(item.book_id, halaman),
      skor: Number(skorAkhir.toFixed(3)),
      mode: "api",
      perluVerifikasi: true,
      catatanVerifikasi: `Cocok topik: ${s.diHeading}/${s.total} konsep ada di judul bab. Turath tidak mengirim ${kurang.join(", ")}.`,
      judul_bab: judulBab || undefined,
      konsep_cocok: s.konsepCocok,
      skor_jenis: "konsep",
    });
  }

  // Cakupan dulu, bobot kemudian: halaman yang judul babnya memuat 2 konsep
  // ("المدني والمكي") lebih relevan daripada yang hanya memuat 1 konsep umum,
  // walau kata itu jarang.
  out.sort((a, b) => {
    const ca = (a.konsep_cocok ?? []).length;
    const cb = (b.konsep_cocok ?? []).length;
    return cb - ca || b.skor - a.skor;
  });
  return out.slice(0, maks);
}

/** Deep-link tunggal saat API tidak tersedia. */
export function deeplink(kalimat: string): RefCandidate {
  const url = `${info.app}/search?q=${encodeURIComponent(kalimat.slice(0, 200))}`;
  return {
    source: "turath",
    kitab: "",
    teks_kutipan: kalimat,
    url_sumber: url,
    skor: 0,
    mode: "deeplink",
    perluVerifikasi: true,
    catatanVerifikasi: "Pencarian otomatis gagal; buka tautan ini untuk mencari manual.",
  };
}
