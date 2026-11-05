/**
 * Uji penerimaan Pembangunan Ulang Tahap 4 + penanaman Tahap C
 * (Aturan Pencarian Valid): footnote dari teks yang diblok, panel
 * kandidat dengan kalimat isi, dan penutupan lubang gerbang.
 *
 * Perubahan Tahap C (putusan pemilik 5 Nov 2026 15:57, blokir keras
 * penuh) yang dicerminkan suite ini:
 *  - Kandidat jurnal wajib lolos periksaMetadata (Crossref) di dalam
 *    generate; kandidat kitab dibuktikan penanda rekod sumbernya;
 *    buku web dibuktikan flag terverifikasi jalur pencariannya.
 *  - Jalur konfirmasi sadar untuk kandidat tertahan DICABUT: hasil
 *    generate tidak lagi memuat perluKonfirmasi/tertahan; yang tidak
 *    lolos tampil sebagai daftar `ditolak` berlabel putusan, TANPA
 *    sidik dan tanpa jalan pasang (A9, A10, A15, B2, B3, D1).
 *  - Sidik kini diterbitkan HANYA untuk kandidat lolos (A14), dan
 *    pasangFootnoteDisetujui MEMERIKSA ULANG kelulusannya secara
 *    segar: metadata Crossref + bidang gerbang (E4, E10, E11).
 *  - Sidik tetap sekali pakai (E6) dan rekam tanpa tanggal sah tetap
 *    kedaluwarsa (E7, E8, E9).
 *
 * TANPA jaringan luar: kolam diarahkan ke stub lokal OpenAI-compatible
 * (UTH_MODE_UJI + KOLAM_UJI_BASE) yang menjawab penilaian gerbang dan
 * analisis makna dari penanda judul fixture; Crossref dialihkan ke
 * fixture fetch lokal (rekod persis untuk dua judul jurnal fixture,
 * 404 untuk DOI lain); kandidat datang dari bank rujukan bersama yang
 * diisi fixture lewat simpanKeBank. Kunci penyedia asli dikosongkan
 * dari env proses uji agar failover tidak pernah menyentuh internet.
 *
 * Perbaikan telaah silang Tahap 4 yang dipertahankan: ambang kecocokan
 * kalimat isi pada semua panjang cuplikan + perlakuan asal masadir
 * (S1), identitas sumber stabil untuk penjaga duplikat dialog (S2),
 * sidik sekali pakai dan rekam tanpa tanggal kedaluwarsa (R2), isi
 * kandidat ikut dinilai di Cari Rujukan (R5), lencana halaman jujur
 * untuk buku tanpa halaman (R4), serta penjaga statis R1/R3.
 *
 * Jalankan: npx tsx scripts/test-tahap4-blok-footnote.ts
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/* ---------- Lingkungan uji: env diatur SEBELUM modul server dimuat ---------- */
for (const k of [
  "GEMINI_API_KEY", "GEMINI_API_KEYS", "GEMINI_API_KEYS_PREMIUM", "GOOGLE_API_KEY",
  "GROQ_API_KEY", "GROQ_API_KEYS", "CLOUDFLARE_API_TOKEN", "CF_API_TOKEN",
  "DEEPSEEK_API_KEY", "DEEPSEEK_API_KEYS", "META_MODEL_API_KEY", "META_MODEL_API_KEYS",
]) {
  delete process.env[k];
}
const dirUji = mkdtempSync(path.join(tmpdir(), "uth-tahap4-"));
process.env.UTH_DATA_FILE = path.join(dirUji, "db.json");
process.env.UTH_MODE_UJI = "1";

/* ---------- Fixture Crossref lokal (Tahap C) ---------- */
/* periksaMetadata memanggil api.crossref.org lewat fetch global; uji
 * ini mengalihkannya ke rekod fixture: pencarian bibliografik untuk
 * dua judul jurnal fixture menjawab rekod yang cocok persis, semua
 * pengambilan per-DOI menjawab 404 (DOI fixture tidak terdaftar). */
const REKOD_CROSSREF_UJI: { judul: string; jurnal: string; tahun: number }[] = [
  { judul: "حجية القياس في أصول الفقه المعاصر", jurnal: "مجلة الدراسات الأصولية", tahun: 2020 },
  { judul: "الشورى في الفقه السياسي الإسلامي المعاصر", jurnal: "مجلة الشريعة والدراسات الإسلامية", tahun: 2020 },
];
const fetchAsli = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: unknown) => {
  const url =
    typeof input === "string" ? input : ((input as { url?: string })?.url ?? "");
  if (url.includes("api.crossref.org")) {
    if (url.includes("/works?")) {
      const q = new URL(url).searchParams.get("query.bibliographic") ?? "";
      const cocok = REKOD_CROSSREF_UJI.find((r) => q.includes(r.judul));
      const items = cocok
        ? [
            {
              title: [cocok.judul],
              "container-title": [cocok.jurnal],
              issued: { "date-parts": [[cocok.tahun]] },
            },
          ]
        : [];
      return new Response(JSON.stringify({ message: { items } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  }
  return fetchAsli(input as never, init as never);
}) as typeof fetch;

/* ---------- Stub kolam: penilai gerbang + pemaham makna ---------- */
const MAKNA_FIXTURE = {
  topikParagraf: "حجية القياس عند الأصوليين",
  klaim: "القياس مصدر من مصادر التشريع يلحق الفرع بالأصل لعلة جامعة",
  kebutuhan: "مصدر أصولي يثبت حجية القياس وحدوده",
  arab: ["القياس في أصول الفقه", "حجية القياس عند الأصوليين"],
  indonesia: ["kias dalam usul fikih"],
  inggris: ["qiyas in usul al-fiqh"],
};

const stub = createServer((req, res) => {
  let badan = "";
  req.on("data", (c) => (badan += c));
  req.on("end", () => {
    let pesan: { role?: string; content?: string }[] = [];
    try {
      pesan = (JSON.parse(badan) as { messages?: { role?: string; content?: string }[] }).messages ?? [];
    } catch {
      /* badan tidak terbaca: jawab kosong */
    }
    const sistem = pesan.find((m) => m.role === "system")?.content ?? "";
    const pengguna = pesan.find((m) => m.role === "user")?.content ?? "";
    const jawab = (isi: string) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: isi } }] }));
    };
    if (sistem.includes("pemaham makna naskah akademik")) {
      jawab(JSON.stringify(MAKNA_FIXTURE));
      return;
    }
    if (sistem.includes("penilai relevansi rujukan akademik")) {
      if (pengguna.includes("MODEL-MATI")) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "stub: penilai mati" }));
        return;
      }
      if (pengguna.includes("TERTAHAN-UJI")) {
        jawab(JSON.stringify({
          sesuai: false,
          skor: 25,
          bidangSumber: "Sosiologi",
          alasan: "Stub uji: kandidat ditandai tidak sesuai bidang proyek.",
        }));
        return;
      }
      jawab(JSON.stringify({
        sesuai: true,
        skor: 88,
        bidangSumber: "",
        alasan: "Stub uji: kandidat sesuai bidang dan kalimat tujuan.",
      }));
      return;
    }
    jawab("{}");
  });
});

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

async function main() {
  await new Promise<void>((resolve) => stub.listen(0, "127.0.0.1", resolve));
  const alamat = stub.address();
  if (!alamat || typeof alamat === "string") throw new Error("stub tidak mendapat port");
  process.env.KOLAM_UJI_BASE = `http://127.0.0.1:${alamat.port}`;

  const { generateFootnoteUntukParagraf, pasangFootnoteDisetujui, pilihKalimatIsi, sidikKandidatDariSumber } =
    await import("../lib/server/generate-footnote");
  const { nilaiUntukCariRujukan } = await import("../lib/server/gerbang-relevansi");
  const { simpanKeBank, simpanSidikParagraf } = await import("../lib/server/bank-rujukan");
  const { simpan: simpanStore } = await import("../lib/server/store");
  const { kandidatKeSumber } = await import("../lib/refs/footnote");
  type RujukanTamu = import("../lib/server/rujukan").RujukanTamu;
  type Sumber = import("../lib/engine/cite").Sumber;
  type RefCandidate = import("../lib/refs/types").RefCandidate;

  const JUDUL_PROYEK = "أثر أصول الفقه في الحياة المعاصرة";
  const KONTEKS_PASANG = { bidangId: "fiqh", judulProyek: JUDUL_PROYEK, topikAr: JUDUL_PROYEK };
  let nomor = 0;
  const ruj = (sebagian: Partial<RujukanTamu> & { judul: string }): RujukanTamu => ({
    id: `uji-t4-${++nomor}`,
    jenis: "buku",
    penulis: ["أحمد الباحث"],
    tahun: "2020",
    wadah: "دار النشر العلمية",
    doi: null,
    isbn: null,
    tautan: "https://example.org/uji",
    terverifikasi: true,
    skor: 0.8,
    kecocokan: 3,
    inti: true,
    umum: false,
    ...sebagian,
  });

  /* ================= Skenario A: mode seleksi ================= */
  const paragrafA =
    "يُعدّ القياس من أهم مصادر التشريع عند الأصوليين، إذ يُلحق الفرع بالأصل في الحكم لعلة جامعة بينهما. " +
    "وقد اختلف العلماء في حجية القياس وحدوده اختلافا واسعا عبر العصور. " +
    "ويظهر أثر القياس في كثير من النوازل المعاصرة التي لم يرد فيها نص صريح.";
  const seleksiA =
    "يُعدّ القياس من أهم مصادر التشريع عند الأصوليين، إذ يُلحق الفرع بالأصل في الحكم لعلة جامعة بينهما.";
  const frasaA = [...MAKNA_FIXTURE.arab, ...MAKNA_FIXTURE.indonesia, ...MAKNA_FIXTURE.inggris];
  const cuplikanA1 =
    "تصدر هذه المجلة العلمية المحكمة عن كلية الشريعة والدراسات الإسلامية منذ سنوات طويلة وتنشر بحوثا محكمة في الدراسات الإسلامية بمختلف فروعها وتخصصاتها العلمية المتنوعة داخل الجامعة وخارجها على حد سواء. " +
    "يثبت هذا البحث أن القياس يلحق الفرع بالأصل في الحكم لعلة جامعة بينهما كما قرره الأصوليون في كتبهم المعتمدة عند التحقيق. " +
    "وتشكر هيئة التحرير الباحثين الكرام على التزامهم الدقيق بشروط النشر العلمي وضوابط التحكيم المعمول بها في المؤسسات الأكاديمية المعاصرة كلها داخل البلاد وخارجها.";
  await simpanKeBank(frasaA, [
    ruj({
      jenis: "jurnal",
      judul: "حجية القياس في أصول الفقه المعاصر",
      wadah: "مجلة الدراسات الأصولية",
      halaman: "45",
      skor: 0.95,
      cuplikan: cuplikanA1,
    }),
    ruj({
      asal: "turath",
      judul: "المستصفى في أصول الفقه",
      penulis: ["أبو حامد الغزالي"],
      tahun: "505هـ",
      skor: 0.9,
      cuplikan: "قال الغزالي: القياس إلحاق فرع بأصل في حكمه لعلة جامعة بينهما عند القائس.",
    }),
    ruj({
      judul: "القياس عند الأصوليين: دراسة تأصيلية مقارنة",
      skor: 0.85,
      cuplikan: "يتناول هذا الكتاب القياس عند الأصوليين من جهة تعريفه وأركانه وشروطه وحجيته عند الجمهور.",
    }),
    ruj({
      judul: "دراسة TERTAHAN-UJI في مناهج التأصيل الأصولي",
      skor: 0.8,
    }),
    ruj({
      judul: "مصادر التشريع الإسلامي ومراتبها عند الأصوليين",
      skor: 0.75,
    }),
    ruj({
      jenis: "jurnal",
      judul: "أثر القياس في النوازل المعاصرة",
      wadah: "مجلة البحوث الفقهية",
      skor: 0.7,
    }),
  ]);
  const hasilA = await generateFootnoteUntukParagraf({
    paragraf: paragrafA,
    seleksi: seleksiA,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("A1 unit pencarian adalah teks seleksi utuh, bukan ekstrak kalimat kunci",
    hasilA.kalimatKunci[0] === seleksiA, `kunci[0]=${(hasilA.kalimatKunci[0] ?? "").slice(0, 40)}…`);
  cek("A2 analisis makna dari model berjalan", hasilA.makna?.dariModel === true);
  cek("A3 hasil datang dari bank fixture (tanpa jaringan)", hasilA.dariBank === true);
  cek("A4 panel menawarkan minimal 3 kandidat lolos",
    (hasilA.kandidat?.length ?? 0) >= 3, `kandidat=${hasilA.kandidat?.length ?? 0}`);
  cek("A5 kandidat jurnal berhalaman membawa kalimat isi yang cocok dari cuplikannya",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("حجية القياس") && (k.kalimatIsi ?? "").includes("يلحق الفرع بالأصل")) === true);
  cek("A6 kalimat isi yang tampil adalah kalimat yang cocok, bukan kalimat lain dari cuplikan",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("حجية القياس") && !(k.kalimatIsi ?? "").includes("هيئة التحرير")) === true);
  cek("A7 kandidat masadir melewati gerbang yang sama dan tampil dengan kalimat isinya",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("المستصفى") && (k.kalimatIsi ?? "").includes("الغزالي")) === true);
  cek("A8 kandidat tanpa cuplikan ditandai tanpa kalimat isi, tidak diisi karangan",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("مصادر التشريع") && k.tanpaKalimatIsi === true && !k.kalimatIsi) === true);
  cek("A9 jurnal tanpa halaman masuk daftar ditolak sebagai belum terverifikasi dengan tanda halaman kosong (Tahap C)",
    hasilA.ditolak?.some((t) => t.sumber.judul.includes("أثر القياس") && t.halamanKosong === true && t.status === "belum-terverifikasi") === true);
  cek("A10 kandidat yang ditolak model masuk daftar ditolak gagal-bidang TANPA sidik, tidak ikut terpasang (Tahap C)",
    hasilA.ditolak?.some((t) => t.sumber.judul.includes("TERTAHAN-UJI") && t.status === "gagal-bidang" && !("sidik" in t)) === true &&
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("TERTAHAN-UJI")) !== true);
  cek("A11 ketemu karena ada kandidat yang bisa dipilih", hasilA.ketemu === true);
  cek("A12 kandidat buku tanpa halaman membawa tanda halaman kosong (R4)",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("دراسة تأصيلية مقارنة") && k.halamanKosong === true) === true);
  cek("A13 kandidat jurnal berhalaman tidak membawa tanda halaman kosong (R4)",
    hasilA.kandidat?.some((k) => k.sumber.judul.includes("حجية القياس") && !k.halamanKosong) === true);
  cek("A14 semua kandidat lolos membawa sidik terbitan server untuk pasang lewat endpoint (Tahap C)",
    (hasilA.kandidat?.length ?? 0) > 0 &&
    (hasilA.kandidat ?? []).every((k) => typeof k.sidik === "string" && k.sidik.length === 32));
  cek("A15 hasil generate tidak lagi memuat jalur konfirmasi: perluKonfirmasi dan tertahan dihapus (Tahap C)",
    (hasilA as unknown as { perluKonfirmasi?: unknown }).perluKonfirmasi === undefined &&
    (hasilA as unknown as { tertahan?: unknown }).tertahan === undefined);

  /* ============ Skenario B: gerbang gagal tertutup (alur kursor) ============ */
  const paragrafB =
    "تُعدّ زكاة المهنة من النوازل الفقهية المعاصرة التي اختلف فيها المعاصرون، إذ لم يرد فيها نص صريح من الكتاب أو السنة. " +
    "ويرى جمهور المعاصرين وجوب الزكاة في رواتب الموظفين قياسا على زكاة المال المستفاد عند حولان الحول.";
  const frasaB = ["زكاة المهنة والرواتب", "zakat profesi", "professional zakat"];
  await simpanSidikParagraf(paragrafB, frasaB);
  await simpanKeBank(frasaB, [
    ruj({ judul: "زكاة المهنة MODEL-MATI دراسة فقهية معاصرة", skor: 0.9 }),
    ruj({ judul: "زكاة الرواتب MODEL-MATI بين المؤيدين والمعارضين", skor: 0.85 }),
  ]);
  const hasilB = await generateFootnoteUntukParagraf({
    paragraf: paragrafB,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("B1 penilai mati: tidak ada kandidat yang terpasang senyap", hasilB.ketemu === false);
  cek("B2 penilai mati: kandidat masuk daftar ditolak sebagai belum terverifikasi, tanpa tawaran konfirmasi (Tahap C)",
    (hasilB as unknown as { perluKonfirmasi?: unknown }).perluKonfirmasi === undefined &&
    hasilB.ditolak?.some((t) => t.status === "belum-terverifikasi" && /BELUM dinilai/.test(t.alasan)) === true,
    (hasilB.ditolak?.[0]?.alasan ?? "").slice(0, 60));
  cek("B3 penilai mati: kandidat yang belum dinilai tidak membawa sidik apa pun (Tahap C)",
    (hasilB.ditolak?.length ?? 0) > 0 && (hasilB.ditolak ?? []).every((t) => !("sidik" in t)));

  /* ============ Skenario E: pasang lewat sidik + periksa ulang ============ */
  const kandidatE = hasilA.kandidat?.find((k) => k.sumber.judul.includes("حجية القياس"));
  const sumberE = kandidatE?.sumber;
  const sidikE = kandidatE?.sidik ?? "";
  cek("E0 prasyarat kandidat lolos membawa sidik tersedia", Boolean(sumberE) && sidikE.length === 32);
  if (sumberE) {
    const salahIsi = await pasangFootnoteDisetujui({
      sidik: sidikE,
      kandidat: { ...sumberE, judul: `${sumberE.judul} (diubah)` },
      paragraf: paragrafA,
      pemilik: "uji-pemilik",
      ...KONTEKS_PASANG,
    });
    cek("E1 sidik menolak data kandidat yang diubah dari yang ditampilkan", salahIsi.ketemu === false);
    const salahPemilik = await pasangFootnoteDisetujui({
      sidik: sidikE,
      kandidat: sumberE,
      paragraf: paragrafA,
      pemilik: "orang-lain",
      ...KONTEKS_PASANG,
    });
    cek("E2 sidik tidak berlaku untuk pemilik lain", salahPemilik.ketemu === false);
    const sidikAsing = await pasangFootnoteDisetujui({
      sidik: "f".repeat(32),
      kandidat: sumberE,
      paragraf: paragrafA,
      pemilik: "uji-pemilik",
      ...KONTEKS_PASANG,
    });
    cek("E3 sidik yang tidak pernah diterbitkan ditolak", sidikAsing.ketemu === false);
    const pasangPas = await pasangFootnoteDisetujui({
      sidik: sidikE,
      kandidat: sumberE,
      paragraf: paragrafA,
      kalimatIdx: hasilA.kalimatIdx,
      pemilik: "uji-pemilik",
      ...KONTEKS_PASANG,
    });
    cek("E4 sidik memasang kandidat lolos sesudah periksa ulang segar (metadata + bidang) lulus",
      pasangPas.ketemu === true && pasangPas.sumber?.judul === sumberE.judul,
      pasangPas.sumber?.judul ?? pasangPas.catatan ?? "");
    cek("E5 kandidat jurnal lolos periksa penuh terpasang TANPA tanda perlu verifikasi (Tahap C)",
      pasangPas.sumber?.perluVerifikasi !== true);
    const pasangUlang = await pasangFootnoteDisetujui({
      sidik: sidikE,
      kandidat: sumberE,
      paragraf: paragrafA,
      kalimatIdx: hasilA.kalimatIdx,
      pemilik: "uji-pemilik",
      ...KONTEKS_PASANG,
    });
    cek("E6 sidik sekali pakai: pemasangan kedua dengan sidik yang sama ditolak (R2)",
      pasangUlang.ketemu === false);
  }

  /* ============ Skenario E lanjutan: tanggal rekam sidik (R2) ============ */
  const kandidatR2: Sumber = {
    id: "src-uji-r2",
    jenis: "kitab",
    penulis: "أحمد الباحث",
    tahun: "2020",
    judul: "كتاب الأصول في الفقه المقارن",
    penerbit: "دار النشر العلمية",
  };
  const sidikR2 = sidikKandidatDariSumber(kandidatR2);
  await simpanStore("tembolok", { id: `konf:${sidikR2}`, tipe: "konf", pemilik: "uji-pemilik" });
  const pasangR2 = await pasangFootnoteDisetujui({
    sidik: sidikR2,
    kandidat: kandidatR2,
    paragraf: paragrafB,
    pemilik: "uji-pemilik",
    ...KONTEKS_PASANG,
  });
  cek("E7 rekam sidik tanpa tanggal pembuatan dianggap kedaluwarsa, bukan lolos (R2)",
    pasangR2.ketemu === false);
  const kandidatR3: Sumber = { ...kandidatR2, judul: "كتاب الأصول في الفقه المقارن (طبعة منقحة)" };
  const sidikR3 = sidikKandidatDariSumber(kandidatR3);
  await simpanStore("tembolok", {
    id: `konf:${sidikR3}`,
    tipe: "konf",
    pemilik: "uji-pemilik",
    dibuat: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  });
  const pasangR3 = await pasangFootnoteDisetujui({
    sidik: sidikR3,
    kandidat: kandidatR3,
    paragraf: paragrafB,
    pemilik: "uji-pemilik",
    ...KONTEKS_PASANG,
  });
  cek("E8 rekam sidik berumur 25 jam ditolak kedaluwarsa (R2)", pasangR3.ketemu === false);
  const kandidatR4: Sumber = { ...kandidatR2, judul: "كتاب الأصول في الفقه المقارن (طبعة حديثة)" };
  const sidikR4 = sidikKandidatDariSumber(kandidatR4);
  await simpanStore("tembolok", {
    id: `konf:${sidikR4}`,
    tipe: "konf",
    pemilik: "uji-pemilik",
    dibuat: new Date().toISOString(),
  });
  const pasangR4 = await pasangFootnoteDisetujui({
    sidik: sidikR4,
    kandidat: kandidatR4,
    paragraf: paragrafB,
    pemilik: "uji-pemilik",
    ...KONTEKS_PASANG,
  });
  cek("E9 kontrol: rekam sidik segar bertanggal sah tetap memasang sesudah periksa ulang bidang lulus (R2)",
    pasangR4.ketemu === true && pasangR4.sumber?.judul === kandidatR4.judul,
    pasangR4.catatan ?? "");

  /* ===== Skenario E lanjutan: periksa ulang TIDAK percaya sidik ===== */
  // Sidik yang sah secara rekam tetap tidak cukup: kandidat yang
  // bidangnya gagal pada periksa ulang segar ditolak di titik pasang.
  const kandidatE10: Sumber = {
    id: "src-uji-e10",
    jenis: "kitab",
    penulis: "أحمد الباحث",
    tahun: "2020",
    judul: "دراسة TERTAHAN-UJI في مناهج التأصيل الأصولي",
    penerbit: "دار النشر العلمية",
  };
  const sidikE10 = sidikKandidatDariSumber(kandidatE10);
  await simpanStore("tembolok", {
    id: `konf:${sidikE10}`,
    tipe: "konf",
    pemilik: "uji-pemilik",
    dibuat: new Date().toISOString(),
  });
  const pasangE10 = await pasangFootnoteDisetujui({
    sidik: sidikE10,
    kandidat: kandidatE10,
    paragraf: paragrafA,
    pemilik: "uji-pemilik",
    ...KONTEKS_PASANG,
  });
  cek("E10 periksa ulang bidang di titik pasang menolak kandidat walau sidiknya sah (Tahap C)",
    pasangE10.ketemu === false && /bidang/i.test(pasangE10.alasanTolak ?? ""),
    (pasangE10.alasanTolak ?? "").slice(0, 60));
  // Kandidat jurnal ber-DOI karangan: metadata periksa ulang gugur di
  // Crossref (404 pada fixture fetch), sebelum bidang dinilai.
  const kandidatE11: Sumber = {
    id: "src-uji-e11",
    jenis: "artikel",
    penulis: "باحث وهمي",
    tahun: "2020",
    judul: "دراسة فقهية في أحكام المعاملات المعاصرة",
    jurnal: "مجلة الدراسات الأصولية",
    halaman: "10",
    doi: "10.9999/fiktif.123",
  };
  const sidikE11 = sidikKandidatDariSumber(kandidatE11);
  await simpanStore("tembolok", {
    id: `konf:${sidikE11}`,
    tipe: "konf",
    pemilik: "uji-pemilik",
    dibuat: new Date().toISOString(),
  });
  const pasangE11 = await pasangFootnoteDisetujui({
    sidik: sidikE11,
    kandidat: kandidatE11,
    paragraf: paragrafA,
    pemilik: "uji-pemilik",
    ...KONTEKS_PASANG,
  });
  cek("E11 periksa ulang metadata di titik pasang menolak DOI yang tidak terdaftar di Crossref (Tahap C)",
    pasangE11.ketemu === false && /Crossref/.test(pasangE11.alasanTolak ?? ""),
    (pasangE11.alasanTolak ?? "").slice(0, 60));

  /* ============ Skenario C: regresi alur kursor lama ============ */
  const paragrafC =
    "تُعدّ الشورى مبدأ أصيلا في النظرية السياسية الإسلامية، وقد ورد الأمر بها في القرآن الكريم في مواضع عدة من كتاب الله. " +
    "واختلف الفقهاء في كون الشورى ملزمة للحاكم أو معلمة له على أقوال معروفة في كتب الفقه السياسي.";
  const frasaC = ["الشورى في الإسلام", "shura dalam islam", "shura in islam"];
  await simpanSidikParagraf(paragrafC, frasaC);
  await simpanKeBank(frasaC, [
    ruj({
      jenis: "jurnal",
      judul: "الشورى في الفقه السياسي الإسلامي المعاصر",
      wadah: "مجلة الشريعة والدراسات الإسلامية",
      halaman: "112",
      skor: 0.9,
      cuplikan: "يقرر هذا البحث أن الشورى مبدأ أصيل في النظرية السياسية الإسلامية بدلالة النصوص الشرعية.",
    }),
  ]);
  const hasilC = await generateFootnoteUntukParagraf({
    paragraf: paragrafC,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("C1 alur kursor lama tetap menemukan dan memasang kandidat lolos",
    hasilC.ketemu === true && (hasilC.sumber?.judul ?? "").includes("الشورى في الفقه السياسي"));
  cek("C2 alur kursor lama memberi indeks kalimat numerik", typeof hasilC.kalimatIdx === "number");

  /* ============ Skenario D: masadir melewati gerbang ============ */
  const paragrafD =
    "قال الشافعي رحمه الله في الرسالة: القياس ما طلب الدليل عليه من إجماع أو خبر ثابت عن رسول الله صلى الله عليه وسلم. " +
    "وهذا النص أصل معتمد في باب الاحتجاج عند الأصوليين جميعا من بعده.";
  const frasaD = ["القياس عند الشافعي", "qiyas menurut syafii", "qiyas according to shafii"];
  await simpanSidikParagraf(paragrafD, frasaD);
  await simpanKeBank(frasaD, [
    ruj({
      asal: "turath",
      judul: "الرسالة في أصول الفقه TERTAHAN-UJI",
      penulis: ["محمد بن إدريس الشافعي"],
      skor: 0.9,
      konsepCocok: 3,
      cuplikan: "قال الشافعي: القياس ما طلب الدليل عليه من إجماع أو خبر.",
    }),
  ]);
  const hasilD = await generateFootnoteUntukParagraf({
    paragraf: paragrafD,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("D1 masadir yang ditolak gerbang TIDAK terpasang dan TIDAK ditawarkan lewat konfirmasi (Tahap C)",
    hasilD.ketemu === false &&
    (hasilD as unknown as { perluKonfirmasi?: unknown }).perluKonfirmasi === undefined &&
    hasilD.ditolak?.some((t) => t.sumber.judul.includes("الرسالة") && t.status === "gagal-bidang") === true,
    hasilD.ditolak?.[0]?.sumber.judul ?? "(tanpa daftar ditolak)");

  const paragrafE =
    "قال الغزالي في المستصفى: القياس حمل معلوم على معلوم في إثبات حكم لهما أو نفيه عنهما بأمر جامع بينهما. " +
    "فجعل القياس بذلك أصلا من أصول الاستنباط عند جمهور الأصوليين.";
  const frasaE = ["المستصفى والقياس", "mustasfa dan kias", "mustasfa qiyas"];
  await simpanSidikParagraf(paragrafE, frasaE);
  await simpanKeBank(frasaE, [
    ruj({
      asal: "turath",
      judul: "المستصفى من علم الأصول",
      penulis: ["أبو حامد الغزالي"],
      skor: 0.9,
      konsepCocok: 3,
      cuplikan: "القياس حمل معلوم على معلوم في إثبات حكم لهما أو نفيه عنهما.",
    }),
  ]);
  const hasilE = await generateFootnoteUntukParagraf({
    paragraf: paragrafE,
    judulProyek: JUDUL_PROYEK,
    bidangId: "fiqh",
    topikAr: JUDUL_PROYEK,
    pemilik: "uji-pemilik",
  });
  cek("D2 masadir lolos gerbang tetap terpasang", hasilE.ketemu === true &&
    (hasilE.sumber?.judul ?? "").includes("المستصفى من علم الأصول"));
  cek("D3 masadir tanpa halaman cetak membawa catatan jujur, bukan halaman karangan",
    /nomor halaman cetak/.test(hasilE.catatan ?? "") && !(hasilE.sumber?.halaman ?? "").trim(),
    (hasilE.catatan ?? "").slice(0, 60));

  /* ============ Skenario F: gerbang untuk Cari Rujukan ============ */
  const konteksF = {
    bidangId: "fiqh",
    bidangLabel: "Fiqh dan Ushul Fiqh (الفقه وأصول الفقه)",
    judulProyek: JUDUL_PROYEK,
    topik: "",
  };
  const kandidatCari = [
    { kunci: "durkheim", judul: "نظرية الانتحار عند دوركايم في علم الاجتماع", wadah: "مجلة علم الاجتماع", jenis: "jurnal", kalimat: "القياس عند الأصوليين" },
    ...[1, 2, 3, 4, 5, 6, 7].map((i) => ({
      kunci: `n${i}`,
      judul: `دراسات في أصول الفقه المعاصر الجزء ${i}`,
      wadah: "دار النشر العلمية",
      jenis: "buku",
      kalimat: "القياس عند الأصوليين",
    })),
    { kunci: "n1", judul: "دراسات في أصول الفقه المعاصر الجزء 1", wadah: "دار النشر العلمية", jenis: "buku", kalimat: "نسخة duplikat kunci yang sama" },
  ];
  const { putusan, belumDinilai } = await nilaiUntukCariRujukan(kandidatCari, konteksF, undefined);
  cek("F1 kandidat Durkheim tertahan aturan keras tanpa memanggil model",
    putusan.get("durkheim")?.lolos === false && putusan.get("durkheim")?.statusPenilaian === "aturan-keras",
    putusan.get("durkheim")?.bidangSumber ?? "");
  cek("F2 kandidat seBidang lolos penilaian model", putusan.get("n1")?.lolos === true);
  cek("F3 kunci duplikat berbagi satu putusan (dedupe)",
    putusan.size === 7, `putusan=${putusan.size}`);
  cek("F4 kandidat di luar batas penilaian dihitung belum dinilai, bukan diloloskan",
    belumDinilai === 1 && !putusan.has("n7"), `belumDinilai=${belumDinilai}`);
  const f5 = await nilaiUntukCariRujukan(
    [{
      kunci: "isi",
      judul: "دراسات أصولية معاصرة في المنهج والتأصيل",
      wadah: "دار النشر العلمية",
      jenis: "buku",
      isi: "TERTAHAN-UJI: نص هذا الكتاب يخالف مجال المشروع مخالفة صريحة.",
      kalimat: "القياس عند الأصوليين",
    }],
    konteksF,
    undefined,
  );
  cek("F5 isi kandidat Cari Rujukan ikut dinilai model: judul bersih, isi tertahan (R5)",
    f5.putusan.get("isi")?.lolos === false, f5.putusan.get("isi")?.statusPenilaian ?? "");
  const f6 = await nilaiUntukCariRujukan(
    [{
      kunci: "isi",
      judul: "دراسات أصولية معاصرة في المنهج والتأصيل",
      wadah: "دار النشر العلمية",
      jenis: "buku",
      kalimat: "القياس عند الأصوليين",
    }],
    konteksF,
    undefined,
  );
  cek("F6 kontrol: kandidat yang sama tanpa isi dinilai dari judul dan lolos (R5)",
    f6.putusan.get("isi")?.lolos === true);

  /* ============ Skenario G: pemilih kalimat isi ============ */
  const cuplikanPanjang =
    "The history of printing presses in medieval European towns shows how book production slowly changed hands from monasteries to urban workshops over several centuries of craft development. " +
    "يثبت هذا البحث أن القياس يلحق الفرع بالأصل في الحكم لعلة جامعة بينهما كما قرره الأصوليون في كتبهم المعتمدة عند التحقيق والتدقيق. " +
    "Guild records from the same period describe paper prices, ink suppliers, and the seasonal rhythms of binders who served university students in northern cities far from the sea.";
  cek("G1 kalimat isi dipilih yang tumpang-tindih dengan acuan",
    (pilihKalimatIsi(cuplikanPanjang, seleksiA) ?? "").includes("يلحق الفرع بالأصل"));
  cek("G2 tanpa cuplikan berarti tanpa kalimat isi", pilihKalimatIsi(undefined, seleksiA) === undefined);
  const cuplikanAsing =
    "The history of printing presses in medieval European towns shows how book production slowly changed hands from monasteries to urban workshops over several centuries of craft development and trade. " +
    "Guild records from the same period describe paper prices, ink suppliers, and the seasonal rhythms of binders who served university students in northern cities far from the sea and rivers. " +
    "Later chapters follow maritime trade routes, customs ledgers, and the correspondence of merchants who financed voyages across the Mediterranean basin during the fifteenth century alone.";
  cek("G3 cuplikan panjang tanpa tumpang-tindih tidak dipaksakan menjadi kalimat isi",
    pilihKalimatIsi(cuplikanAsing, seleksiA) === undefined);
  cek("G4 cuplikan pendek tampil utuh apa adanya",
    pilihKalimatIsi("نص قصير عن القياس عند الأصوليين.", seleksiA) === "نص قصير عن القياس عند الأصوليين.");
  const cuplikanBoilerplate =
    "This peer-reviewed journal is published quarterly by the Faculty of Letters, hosting scholarly studies in history, linguistics, and cultural heritage contributed by researchers from universities across the region and abroad, with rigorous double-blind review for every submission.";
  cek("G5 cuplikan pendek boilerplate jurnal tanpa satu kata pun sama tidak tampil sebagai kalimat isi (S1)",
    pilihKalimatIsi(cuplikanBoilerplate, seleksiA) === undefined);
  const cuplikanIndustri =
    "يدور هذا البحث حول القياس الدقيق لأبعاد المنتج الصناعي في المصانع الحديثة وخطوط إنتاجها المتطورة والمتفرعة. " +
    "كما يعرض لأنواع خطوط التجميع وطرق ضبط الجودة ومراحل فحص العينات قبل التغليف والشحن إلى الأسواق المحلية الواسعة. " +
    "وتوثق الدراسة تكاليف التشغيل والصيانة الدورية للمعدات الثقيلة في ورش التصنيع بمناطق صناعية متعددة ومتباعدة. " +
    "وتختم بعرض جداول الإنتاج الشهرية ونسب الهدر في المواد الخام وخطط التوسع المستقبلية للمصنع الجديد الكبير.";
  cek("G6 kalimat beririsan tepat satu batang kata homonim (قياس industri) tidak terpilih sebagai kalimat isi (S1)",
    pilihKalimatIsi(cuplikanIndustri, seleksiA) === undefined);
  const cuplikanMasadirSatuBatang =
    "نقل صاحب الكتاب عن شيوخه أن القياس عندهم مرتبة تالية للنص والإجماع في ترتيب الأدلة المعتبرة.";
  cek("G7a kutipan satu batang kata tanpa perlakuan asal tetap di bawah ambang umum (S1)",
    pilihKalimatIsi(cuplikanMasadirSatuBatang, seleksiA) === undefined);
  cek("G7b kutipan masadir satu batang kata tampil lewat perlakuan asal adapternya (S1)",
    (pilihKalimatIsi(cuplikanMasadirSatuBatang, seleksiA, { dariMasadir: true }) ?? "").includes("القياس عندهم"));
  const cuplikanDuaKalimat = "دراسة موجزة في القياس وأركانه. وتناولت موقف الأصوليين منه قديما وحديثا.";
  cek("G8 cuplikan pendek dua kalimat yang bersama menyentuh acuan melewati ambang tampil utuh (S1)",
    pilihKalimatIsi(cuplikanDuaKalimat, seleksiA) === cuplikanDuaKalimat);

  /* ============ Skenario I: identitas sumber stabil (S2) ============ */
  const hitI: RefCandidate = {
    source: "turath",
    kitab: "المستصفى في أصول الفقه",
    penulis: "أبو حامد الغزالي",
    jilid: 1,
    halaman_cetak: 45,
    penerbit: "دار الكتب العلمية",
    kota: "بيروت",
    tahun: 1993,
    teks_kutipan: "القياس إلحاق فرع بأصل في حكمه لعلة جامعة بينهما.",
    url_sumber: "https://example.org/mustasfa",
    skor: 0.9,
    mode: "api",
    perluVerifikasi: false,
  };
  const sumberI1 = kandidatKeSumber(hitI);
  const sumberI2 = kandidatKeSumber({ ...hitI });
  cek("I1 konversi hit yang sama dua kali menghasilkan id sumber yang sama (S2)",
    sumberI1.id === sumberI2.id && sumberI1.id.length > 4, sumberI1.id);
  cek("I2 halaman dan jilid berbeda tidak mengubah identitas sumber; keduanya milik penanda (S2)",
    kandidatKeSumber({ ...hitI, halaman_cetak: 99, jilid: 2 }).id === sumberI1.id);
  cek("I3 tahun terbit berbeda menghasilkan sumber yang berbeda (S2)",
    kandidatKeSumber({ ...hitI, tahun: 2005 }).id !== sumberI1.id);
  const polaDialog = /\[\[ref:([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  const drafI = `نص الفقرة الأولى في هذا الباب. [[ref:${sumberI1.id}|hlm:45]] ويليه شرح آخر في الموضوع نفسه.`;
  let hitungI = 0;
  for (const m of drafI.matchAll(polaDialog)) {
    if ((m[1] ?? "").trim() === sumberI2.id) hitungI++;
  }
  cek("I4 penghitung duplikat dialog mengenali pemasangan kedua hit yang sama sebagai duplikat (S2)",
    hitungI === 1, `duplikat=${hitungI}`);

  /* ============ Skenario H: pengawatan statis ============ */
  const baca = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  const ruteGenerate = baca("app/api/footnote/generate/route.ts");
  cek("H1 rute generate menerima seleksi dan cabang sidik",
    ruteGenerate.includes("seleksi") && ruteGenerate.includes("sidikDisetujui") && ruteGenerate.includes("pasangFootnoteDisetujui"));
  const ruteCari = baca("app/api/refs/search/route.ts");
  cek("H2 rute Cari Rujukan menilai gerbang bidang yang sama",
    ruteCari.includes("nilaiUntukCariRujukan") && ruteCari.includes("deteksiBidangSumber"));
  const refFinder = baca("components/workspace/ref-finder.tsx");
  cek("H3 RefFinder mengirim konteks bidang dan menampilkan putusan gerbang",
    refFinder.includes("bidangId: p.bidangId") && refFinder.includes("Tertahan gerbang bidang"));
  const tulisTab = baca("components/workspace/tulis-tab.tsx");
  cek("H4 tab Tulis punya alur seleksi, panel kandidat, dan pasang lewat sidik",
    tulisTab.includes("generateSeleksi") && tulisTab.includes("panelKandidat") && tulisTab.includes("pasangLewatSidik"));
  const dialogPasang = baca("components/workspace/pasang-footnote.tsx");
  // H5 DIBALIK oleh putusan pemilik 5 Nov 2026 15:57 (blokir keras
  // penuh): jalur konfirmasi sadar untuk sumber tertahan di dialog
  // pasang DICABUT, sama seperti H10/H11 membalik perilaku Generate.
  cek("H5 dialog pasang tidak lagi memuat jalur konfirmasi untuk sumber tertahan gerbang (dicabut, Aturan Pencarian Valid)",
    !dialogPasang.includes("konfirmasiGerbang") && !dialogPasang.includes("blokirGerbang"));
  cek("H6 rute Cari Rujukan melaporkan gagal total penilaian secara jujur, bukan nol (R3)",
    ruteCari.includes("jumlahUnik") && ruteCari.includes("penilaianGagalTotal") && !ruteCari.includes("belumDinilai: 0"));
  // H7 DIBALIK oleh putusan yang sama: hit tertahan kini tidak bisa
  // masuk daftar terpilih sama sekali (penjaga bisaDipakai), jadi
  // tidak ada lagi konfirmasi Sisip untuk hit tertahan.
  cek("H7 RefFinder memblokir hit tertahan tanpa jalur konfirmasi Sisip (dicabut, Aturan Pencarian Valid)",
    !refFinder.includes("konfirmasiSisipTertahan") && !refFinder.includes("blokirSisipTertahan") && refFinder.includes("bisaDipakai"));
  const footnoteRefs = baca("lib/refs/footnote.ts");
  cek("H8 kandidatKeSumber memakai id stabil deterministik, bukan acak (S2)",
    footnoteRefs.includes("idStabilKandidat") && !footnoteRefs.includes("Math.random"));
  const gerbangTs = baca("lib/server/gerbang-relevansi.ts");
  cek("H9 gerbang Cari Rujukan meneruskan isi kandidat ke penilaian model (R5)",
    gerbangTs.includes("isi: k.isi") && ruteCari.includes("isi: h.teks_kutipan"));
  cek("H10 tab Tulis tidak lagi memuat jalur konfirmasi pasang untuk kandidat Generate yang tidak lolos (Tahap C)",
    !tulisTab.includes("perluKonfirmasi") && !tulisTab.includes("Tetap pasang kandidat ini"));
  const genFootnoteTs = baca("lib/server/generate-footnote.ts");
  cek("H11 mesin generate memeriksa metadata Crossref untuk kandidat jurnal dan sidik hanya untuk yang lolos (Tahap C)",
    genFootnoteTs.includes("periksaMetadata") && genFootnoteTs.includes("verifikasi-rujukan") &&
    genFootnoteTs.includes("keDitolakHasil") && !genFootnoteTs.includes("keTertahanHasil"));

  stub.close();
  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  process.exit(gagal > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("UJI TAHAP 4 GAGAL JALAN:", e);
  stub.close();
  process.exit(2);
});
