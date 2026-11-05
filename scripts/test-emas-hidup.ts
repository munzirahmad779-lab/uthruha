/**
 * Set uji emas v1 HIDUP — Aturan Pencarian Valid (Tahap G1,
 * 6 Nov 2026). Pasangan hidup dari scripts/test-emas-pencarian-
 * valid.ts: menjalankan skenario uang panai yang pada 6 Nov 2026
 * 02:50 MEMASANG kitab tauhid ke proyek fikih, kali ini melawan
 * adapter nyata (Turath/Shamela), gerbang kategori di tingkat
 * generate dan pasang, model penilai nyata lewat jembatan, dan
 * endpoint verifikasi jurnal lewat HTTP.
 *
 * Skenario:
 *  A. Adapter: pencarian Turath untuk kitabnya sendiri mengembalikan
 *     القواعد في توحيد العبادة DENGAN kategoriKitab "العقيدة" dari
 *     cat_id rekodnya; kategoriBuku Shamela membaca breadcrumb
 *     halaman buku 604 (العقيدة) dan 7372 المستصفى (أصول الفقه).
 *  B. Pasang paksa: Sumber dibangun dari rekod Turath nyata kitab
 *     tauhid itu + sidik yang sah ditanam → pasangFootnoteDisetujui
 *     pada konteks proyek uang panai WAJIB menolak dengan alasan
 *     kategori. Kontrol positif: kitab مسائل فقهية مستجدة في النكاح
 *     (Shamela 16083, kategori مسائل فقهية) pada proyek yang sama
 *     WAJIB terpasang.
 *  C. Generate: sidik paragraf ditanam dengan kalimat kunci judul
 *     kitab tauhid; generateFootnoteUntukParagraf (mode kursor) pada
 *     konteks uang panai TIDAK boleh menawarkannya sebagai kandidat
 *     dan WAJIB mencatatnya ditolak gagal-bidang.
 *  D. Endpoint /api/refs/verifikasi-jurnal (HTTP, server dev):
 *     DOI ekonomi vs proyek fikih uang panai → gagal-bidang; DOI
 *     yang sama vs proyek iqtishad → terverifikasi; DOI fiktif
 *     10.9999/fiktif.123 → gagal-metadata.
 *
 * Syarat jalan (pola uji hidup tahap sebelumnya):
 *  - Jembatan LLM hidup di KOLAM_UJI_BASE (bawaan
 *    http://127.0.0.1:3458, model gemini-3.5-flash-lite).
 *  - Server dev di EMAS_UJI_BASE (bawaan http://127.0.0.1:3217)
 *    dengan UTH_MODE_UJI=1 + store seed-uji (untuk bagian D saja;
 *    bagian A–C berjalan setingkat fungsi dalam proses ini dengan
 *    store temp sendiri). Server tak menjawab → keluar kode 2
 *    HANYA untuk bagian D sesudah A–C dilaporkan.
 *  - Internet untuk api.turath.io, shamela.ws, api.crossref.org.
 *
 * Jalankan: npx tsx scripts/test-emas-hidup.ts
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
const dirUji = mkdtempSync(path.join(tmpdir(), "uth-emas-hidup-"));
process.env.UTH_DATA_FILE = path.join(dirUji, "db.json");
process.env.UTH_MODE_UJI = "1";
process.env.KOLAM_UJI_BASE = process.env.KOLAM_UJI_BASE ?? "http://127.0.0.1:3458";

const BASE = process.env.EMAS_UJI_BASE ?? "http://127.0.0.1:3217";
const JUDUL_UANG_PANAI = "حكم uang panai في الشريعة الاسلامية: دراسة مقاصدية";
const PARAGRAF_MAHAR =
  "المهر حق خالص للمرأة أوجبته الشريعة الإسلامية في عقد النكاح، وقد جرت عادة أهل سولاويسي أن يقدم الخاطب ما يسمى بالمال المقدم قبل العقد. " +
  "ويترتب على النكاح أحكام مالية واجتماعية تناولها الفقهاء في كتب النكاح والأسرة، فكان لا بد من تأصيل هذه العادة وبيان حكمها في ضوء مقاصد الشريعة.";

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

async function main() {
  const { cari: cariTurath } = await import("../lib/refs/adapters/turath");
  const { cari: cariShamela, kategoriBuku: kategoriShamela, idBukuDariTautan } =
    await import("../lib/refs/adapters/shamela");
  const { pasangFootnoteDisetujui, sidikKandidatDariSumber, generateFootnoteUntukParagraf } =
    await import("../lib/server/generate-footnote");
  const { simpanSidikParagraf } = await import("../lib/server/bank-rujukan");
  const { simpan } = await import("../lib/server/store");
  type Sumber = import("../lib/engine/cite").Sumber;
  type RefCandidate = import("../lib/refs/types").RefCandidate;

  const konteks = { bidangId: "fiqh", judulProyek: JUDUL_UANG_PANAI, topikAr: JUDUL_UANG_PANAI };
  const PEMILIK = "uji-emas";

  /* ── A. Adapter membawa kategori dari rekod nyata ─────────────── */
  const hasilTurath = await cariTurath("القواعد في توحيد العبادة", { maks: 8 });
  const tauhid: RefCandidate | undefined = hasilTurath.find((c) =>
    (c.kitab ?? "").includes("القواعد في توحيد العبادة"),
  );
  cek("A1 adapter Turath menemukan kitab tauhid dari judulnya sendiri",
    Boolean(tauhid), tauhid?.url_sumber ?? "tidak ketemu");
  cek("A2 kandidat Turath membawa kategoriKitab العقيدة dari cat_id rekodnya",
    tauhid?.kategoriKitab === "العقيدة", tauhid?.kategoriKitab ?? "(kosong)");
  const kat604 = await kategoriShamela(604);
  cek("A3 kategoriBuku Shamela membaca breadcrumb buku 604 = العقيدة",
    kat604 === "العقيدة", kat604 ?? "(kosong)");
  const kat7372 = await kategoriShamela(7372);
  cek("A4 kategoriBuku Shamela membaca breadcrumb buku 7372 المستصفى = أصول الفقه",
    kat7372 === "أصول الفقه", kat7372 ?? "(kosong)");

  /* ── B. Pasang: kitab tauhid ditolak, kitab nikah terpasang ───── */
  const tanamDanPasang = async (sumber: Sumber) => {
    const sidik = sidikKandidatDariSumber(sumber);
    await simpan("tembolok", {
      id: `konf:${sidik}`,
      tipe: "konf",
      pemilik: PEMILIK,
      dibuat: new Date().toISOString(),
    });
    return pasangFootnoteDisetujui({
      sidik,
      kandidat: sumber,
      paragraf: PARAGRAF_MAHAR,
      pemilik: PEMILIK,
      ...konteks,
    });
  };

  if (tauhid) {
    const sumberTauhid: Sumber = {
      id: "emas-tauhid",
      jenis: "kitab",
      tahun: "",
      penulis: tauhid.penulis ?? "",
      penulisDaftar: tauhid.penulis ? [tauhid.penulis] : [],
      judul: tauhid.kitab,
      jilid: tauhid.jilid ? String(tauhid.jilid) : undefined,
      halaman: tauhid.halaman_cetak ? String(tauhid.halaman_cetak) : undefined,
      url: tauhid.url_sumber,
      sumberImpor: "web-turath",
      kategoriKitab: tauhid.kategoriKitab,
    };
    const pasangTauhid = await tanamDanPasang(sumberTauhid);
    cek("B1 pasang paksa kitab tauhid pada proyek uang panai DITOLAK gerbang kategori",
      pasangTauhid.ketemu === false && /kategori/i.test(pasangTauhid.alasanTolak ?? ""),
      (pasangTauhid.alasanTolak ?? "terpasang!").slice(0, 130));
  } else {
    cek("B1 pasang paksa kitab tauhid", false, "kandidat Turath tidak ketemu (A1 gagal)");
  }

  const hasilShamela = await cariShamela("المسائل الفقهية المستجدة في النكاح", { maks: 6 });
  const nikah = hasilShamela.find((c) => idBukuDariTautan(c.url_sumber) === 16083) ?? hasilShamela[0];
  const idNikah = nikah ? idBukuDariTautan(nikah.url_sumber) : undefined;
  const katNikah = idNikah ? await kategoriShamela(idNikah) : undefined;
  cek("B2 kitab nikah Shamela ketemu dan kategorinya مسائل فقهية",
    Boolean(nikah) && katNikah === "مسائل فقهية",
    `${nikah?.kitab ?? "-"} | ${katNikah ?? "-"}`);
  if (nikah) {
    const sumberNikah: Sumber = {
      id: "emas-nikah",
      jenis: "kitab",
      tahun: "",
      penulis: nikah.penulis ?? "",
      penulisDaftar: nikah.penulis ? [nikah.penulis] : [],
      judul: nikah.kitab,
      halaman: nikah.halaman_cetak ? String(nikah.halaman_cetak) : undefined,
      url: nikah.url_sumber,
      sumberImpor: "web-shamela",
      kategoriKitab: katNikah,
    };
    const pasangNikah = await tanamDanPasang(sumberNikah);
    cek("B3 kontrol positif: kitab fikih nikah pada proyek yang sama TERPASANG",
      pasangNikah.ketemu === true,
      pasangNikah.ketemu ? (pasangNikah.sumber?.judul ?? "").slice(0, 60) : (pasangNikah.alasanTolak ?? "").slice(0, 130));
  } else {
    cek("B3 kontrol positif kitab nikah", false, "kandidat Shamela tidak ketemu");
  }

  /* ── C. Generate: kitab tauhid tidak ditawarkan, tercatat gugur ── */
  await simpanSidikParagraf(PARAGRAF_MAHAR, ["القواعد في توحيد العبادة"]);
  const hasilGenerate = await generateFootnoteUntukParagraf({
    paragraf: PARAGRAF_MAHAR,
    kalimatKursor: 0,
    pemilik: PEMILIK,
    ...konteks,
  });
  const judulTauhid = "القواعد في توحيد العبادة";
  const ditawarkan = (hasilGenerate.kandidat ?? []).some((k) =>
    (k.sumber.judul ?? "").includes(judulTauhid),
  ) || (hasilGenerate.sumber?.judul ?? "").includes(judulTauhid);
  cek("C1 generate TIDAK menawarkan kitab tauhid sebagai kandidat pada proyek uang panai",
    !ditawarkan);
  const tercatatGugur =
    (hasilGenerate.ditolak ?? []).some(
      (d) => (d.sumber.judul ?? "").includes(judulTauhid) && d.status === "gagal-bidang",
    ) ||
    (hasilGenerate.penolakan ?? []).some(
      (p) => p.judul.includes(judulTauhid) && /kategori|BERTENTANGAN/i.test(p.alasan),
    );
  cek("C2 generate mencatat kitab tauhid ditolak gagal-bidang oleh gerbang kategori",
    tercatatGugur,
    (hasilGenerate.ditolak ?? []).map((d) => `${d.sumber.judul}:${d.status}`).join("; ").slice(0, 130));

  /* ── D. Endpoint verifikasi jurnal lewat HTTP ─────────────────── */
  const ambilRekod = async (doi: string) => {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { "User-Agent": "UthruhaAcademic/1.0 (mailto:peneliti@uthruha.id)" },
    });
    if (!res.ok) throw new Error(`Crossref ${res.status} untuk ${doi}`);
    const m = (await res.json()) as {
      message: { title?: string[]; "container-title"?: string[]; issued?: { "date-parts"?: number[][] } };
    };
    return {
      judul: (m.message.title?.[0] ?? "").trim(),
      jurnal: (m.message["container-title"]?.[0] ?? "").trim(),
      tahun: String(m.message.issued?.["date-parts"]?.[0]?.[0] ?? ""),
    };
  };
  const panggilEndpoint = async (
    kandidat: { id: string; doi: string; judul: string; jurnal: string; tahun: string }[],
    bidangId: string,
    judulProyek: string,
  ) => {
    const res = await fetch(`${BASE}/api/refs/verifikasi-jurnal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-uji-user": "UJI-PREMIUM", Origin: BASE },
      body: JSON.stringify({ kandidat, bidangId, judulProyek, topikAr: judulProyek }),
    });
    const data = (await res.json().catch(() => null)) as {
      hasil?: { id: string; status: string; alasan: string }[];
      error?: string;
    } | null;
    if (!res.ok || !data || !Array.isArray(data.hasil)) {
      throw new Error(`endpoint menjawab ${res.status} ${data?.error ?? ""}`);
    }
    return new Map(data.hasil.map((h) => [h.id, h]));
  };

  try {
    const rekodEkonomi = await ambilRekod("10.12816/0032787");
    const kartuEkonomi = [{ id: "emas-eko", doi: "10.12816/0032787", ...rekodEkonomi }];
    const vsFiqh = await panggilEndpoint(kartuEkonomi, "fiqh", JUDUL_UANG_PANAI);
    cek("D1 DOI ekonomi vs proyek fikih uang panai: gagal-bidang",
      vsFiqh.get("emas-eko")?.status === "gagal-bidang",
      (vsFiqh.get("emas-eko")?.alasan ?? "").slice(0, 110));
    const vsIqtishad = await panggilEndpoint(
      kartuEkonomi,
      "iqtishad",
      "التكامل الاقتصادي بين الدول العربية والإسلامية",
    );
    cek("D2 DOI ekonomi yang sama vs proyek iqtishad: terverifikasi (relativitas bidang)",
      vsIqtishad.get("emas-eko")?.status === "terverifikasi",
      (vsIqtishad.get("emas-eko")?.alasan ?? "").slice(0, 110));
    const vsFiktif = await panggilEndpoint(
      [{
        id: "emas-fiktif",
        doi: "10.9999/fiktif.123",
        judul: "Artikel Rekayasa yang Tidak Pernah Terbit",
        jurnal: "Jurnal Rekayasa",
        tahun: "2024",
      }],
      "fiqh",
      JUDUL_UANG_PANAI,
    );
    cek("D3 DOI fiktif 10.9999/fiktif.123: gagal-metadata",
      vsFiktif.get("emas-fiktif")?.status === "gagal-metadata",
      (vsFiktif.get("emas-fiktif")?.alasan ?? "").slice(0, 110));
  } catch (e) {
    console.error(
      `BAGIAN D TIDAK BISA JALAN: ${e instanceof Error ? e.message : e}. ` +
        `Pastikan server dev hidup di ${BASE} (UTH_MODE_UJI=1, store seed-uji) dan jembatan LLM hidup.`,
    );
    console.log(`\nHASIL SEMENTARA (A–C): ${lulus} PASS, ${gagal} FAIL`);
    process.exit(2);
  }

  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  process.exit(gagal > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("UJI EMAS HIDUP GAGAL JALAN:", e);
  process.exit(2);
});
