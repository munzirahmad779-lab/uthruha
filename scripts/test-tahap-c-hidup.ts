/**
 * Uji hidup Tahap C (Aturan Pencarian Valid, lapis footnote):
 * pemasangan kandidat jurnal lewat pasangFootnoteDisetujui dengan
 * Crossref HIDUP dan model penilai NYATA lewat jembatan LLM lokal.
 *
 * Syarat jalan:
 *  - Jembatan LLM hidup di KOLAM_UJI_BASE (bawaan
 *    http://127.0.0.1:3458, model gemini-3.5-flash-lite sesuai pola
 *    verifikasi Tahap A+B).
 *  - Koneksi internet untuk api.crossref.org.
 *
 * Skenario: tiga kandidat jurnal dibangun PERSIS dari rekod Crossref
 * hidupnya (judul, jurnal, tahun, halaman dari rekod), masing-masing
 * ditanam rekam sidik yang sah meniru terbitan generate untuk
 * kandidat lolos. Ini bentuk ujian paling keras untuk titik pasang:
 * walau sidiknya sah, periksa ulang segar di server yang memutuskan.
 *  - DOI 10.12816/0032787 (ekonomi, jurnal التكامل الاقتصادي)
 *    → WAJIB ditolak pada periksa ulang bidang.
 *  - DOI 10.54528/1549-004-001-003 (الشرعية التنظيمية, administrasi)
 *    → WAJIB ditolak pada periksa ulang bidang.
 *  - DOI 10.21580/ihya.20.2.4048 (Ushul Fiqh, Ihya' 'Ulum al-Din)
 *    → WAJIB terpasang; putaran ulang sidik yang sama WAJIB ditolak.
 *
 * Konteks proyek: takamul (bidangId "fiqh", judul frasa التكامل
 * المعرفي بين علوم القرآن وأصول الفقه) — kasus nyata perintah ini.
 *
 * Jalankan: npx tsx scripts/test-tahap-c-hidup.ts
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

for (const k of [
  "GEMINI_API_KEY", "GEMINI_API_KEYS", "GEMINI_API_KEYS_PREMIUM", "GOOGLE_API_KEY",
  "GROQ_API_KEY", "GROQ_API_KEYS", "CLOUDFLARE_API_TOKEN", "CF_API_TOKEN",
  "DEEPSEEK_API_KEY", "DEEPSEEK_API_KEYS", "META_MODEL_API_KEY", "META_MODEL_API_KEYS",
]) {
  delete process.env[k];
}
const dirUji = mkdtempSync(path.join(tmpdir(), "uth-tahapc-hidup-"));
process.env.UTH_DATA_FILE = path.join(dirUji, "db.json");
process.env.UTH_MODE_UJI = "1";
process.env.KOLAM_UJI_BASE = process.env.KOLAM_UJI_BASE ?? "http://127.0.0.1:3458";

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

interface RekodHidup {
  judul: string;
  jurnal: string;
  tahun: string;
  halaman: string;
  penulis: string[];
}

async function ambilRekod(doi: string): Promise<RekodHidup> {
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { "User-Agent": "UthruhaAcademic/1.0 (mailto:peneliti@uthruha.id)" },
  });
  if (!res.ok) throw new Error(`Crossref menjawab ${res.status} untuk ${doi}`);
  const m = (await res.json()) as {
    message: {
      title?: string[];
      "container-title"?: string[];
      issued?: { "date-parts"?: number[][] };
      page?: string;
      author?: { given?: string; family?: string }[];
    };
  };
  const msg = m.message;
  return {
    judul: (msg.title?.[0] ?? "").trim(),
    jurnal: (msg["container-title"]?.[0] ?? "").trim(),
    tahun: String(msg.issued?.["date-parts"]?.[0]?.[0] ?? ""),
    halaman: (msg.page ?? "").split("-")[0]?.trim() ?? "",
    penulis: (msg.author ?? []).map((a) => `${a.given ?? ""} ${a.family ?? ""}`.trim()).filter(Boolean),
  };
}

async function main() {
  const { pasangFootnoteDisetujui, sidikKandidatDariSumber } =
    await import("../lib/server/generate-footnote");
  const { simpan } = await import("../lib/server/store");
  type Sumber = import("../lib/engine/cite").Sumber;

  const JUDUL_PROYEK = "التكامل المعرفي بين علوم القرآن وأصول الفقه";
  const konteks = { bidangId: "fiqh", judulProyek: JUDUL_PROYEK, topikAr: JUDUL_PROYEK };
  const PEMILIK = "uji-hidup";
  const paragrafTakamul =
    "يهدف هذا البحث إلى بيان التكامل المعرفي بين علوم القرآن وأصول الفقه في بناء المنهج الأصولي المعاصر. " +
    "ويعرض لأوجه الالتقاء بين مقاصد القرآن الكريم ومقاصد الشريعة في تفسير النصوص واستنباط الأحكام منها.";
  const paragrafKaidah =
    "تُعدّ القواعد الفقهية وأصول الفقه من أهم أدوات الاجتهاد في استنباط أحكام المنتجات الحلال في المعاملات المعاصرة. " +
    "ويحتاج الباحث إلى تأصيل منهج الاستنباط والاجتهاد في النوازل المتعلقة بالمنتجات الحلال وضوابطها الشرعية.";

  const buatDanTanam = async (doi: string, n: number): Promise<Sumber> => {
    const r = await ambilRekod(doi);
    const sumber: Sumber = {
      id: `src-hidup-${n}`,
      jenis: "artikel",
      penulis: r.penulis.join("، "),
      penulisDaftar: r.penulis,
      tahun: r.tahun,
      judul: r.judul,
      jurnal: r.jurnal,
      halaman: r.halaman || undefined,
      doi,
      sumberImpor: "web-crossref",
    };
    const sidik = sidikKandidatDariSumber(sumber);
    await simpan("tembolok", {
      id: `konf:${sidik}`,
      tipe: "konf",
      pemilik: PEMILIK,
      dibuat: new Date().toISOString(),
    });
    return sumber;
  };

  /* 1) Ekonomi: metadata cocok persis, bidang yang menggagalkan. */
  const ekonomi = await buatDanTanam("10.12816/0032787", 1);
  const pasangEkonomi = await pasangFootnoteDisetujui({
    sidik: sidikKandidatDariSumber(ekonomi),
    kandidat: ekonomi,
    paragraf: paragrafTakamul,
    pemilik: PEMILIK,
    ...konteks,
  });
  cek("H1 kandidat ekonomi (DOI 10.12816/0032787) ditolak server pada periksa ulang bidang",
    pasangEkonomi.ketemu === false && /bidang/i.test(pasangEkonomi.alasanTolak ?? ""),
    (pasangEkonomi.alasanTolak ?? "").slice(0, 110));

  /* 2) الشرعية التنظيمية: administrasi organisasi, bidang asing. */
  const legitimasi = await buatDanTanam("10.54528/1549-004-001-003", 2);
  const pasangLegitimasi = await pasangFootnoteDisetujui({
    sidik: sidikKandidatDariSumber(legitimasi),
    kandidat: legitimasi,
    paragraf: paragrafTakamul,
    pemilik: PEMILIK,
    ...konteks,
  });
  cek("H2 kandidat الشرعية التنظيمية (DOI 10.54528/1549-004-001-003) ditolak server pada periksa ulang bidang",
    pasangLegitimasi.ketemu === false && /bidang/i.test(pasangLegitimasi.alasanTolak ?? ""),
    (pasangLegitimasi.alasanTolak ?? "").slice(0, 110));

  /* 3) Ihya: Ushul Fiqh, wajib terpasang; sidik sekali pakai. */
  const ihya = await buatDanTanam("10.21580/ihya.20.2.4048", 3);
  const sidikIhya = sidikKandidatDariSumber(ihya);
  const pasangIhya = await pasangFootnoteDisetujui({
    sidik: sidikIhya,
    kandidat: ihya,
    paragraf: paragrafKaidah,
    pemilik: PEMILIK,
    ...konteks,
  });
  cek("H3 kandidat Ihya Ushul Fiqh (DOI 10.21580/ihya.20.2.4048) lulus periksa ulang dan terpasang",
    pasangIhya.ketemu === true && pasangIhya.sumber?.doi === ihya.doi,
    pasangIhya.ketemu ? (pasangIhya.sumber?.judul ?? "").slice(0, 60) : (pasangIhya.alasanTolak ?? "").slice(0, 110));
  const ulangIhya = await pasangFootnoteDisetujui({
    sidik: sidikIhya,
    kandidat: ihya,
    paragraf: paragrafKaidah,
    pemilik: PEMILIK,
    ...konteks,
  });
  cek("H4 sidik Ihya sekali pakai: putaran ulang ditolak karena rekam sidik sudah terbakar",
    ulangIhya.ketemu === false && /tidak tercatat/.test(ulangIhya.alasanTolak ?? ""),
    (ulangIhya.alasanTolak ?? "").slice(0, 80));

  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  process.exit(gagal > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("UJI HIDUP TAHAP C GAGAL JALAN:", e);
  process.exit(2);
});
