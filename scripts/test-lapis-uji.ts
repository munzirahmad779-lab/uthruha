/**
 * Uji ujung-ke-ujung dua lapis (Fase 3) — jalankan melawan server lokal
 * mode uji (lihat docs/FASE3-UJI.md untuk urutan perintahnya).
 *
 * Bukti yang dikumpulkan:
 *  GRATIS  : proyek ke-2 ditolak · footnote ke-4 se-paragraf ditolak ·
 *            ruang lingkup terkunci setelah footnote pertama · ganti kedua
 *            ditolak · widget agen tergerbang · Doc tergerbang.
 *  PREMIUM : proyek ke-2 lolos · footnote tanpa batas · agen menjawab ·
 *            kategori kustom berprofil · Doc dibuat (Drive = STUB/simulasi).
 *  TAMU    : uji coba sekali jalan penuh · kembangkan BM25 · percobaan
 *            kedua dari perangkat sama TERBLOKIR · judul sama dari
 *            perangkat lain = tembolok.
 *  BAYAR   : order dibuat (Snap = STUB) · webhook tanda tangan salah
 *            ditolak · webhook sah mengaktifkan premium (mesin status).
 *  UNIT    : ISBN digit pemeriksa · sisipkanRujukan BM25 deterministik.
 */
import { createHash } from "node:crypto";
import { isbnSah, keISBN13 } from "../lib/server/isbn";
import { sisipkanRujukan } from "../lib/server/bm25";

const BASE = process.env.UTH_URL_UJI || "http://127.0.0.1:3311";
let lulus = 0;
let gagal = 0;

function cek(nama: string, kondisi: boolean, rincian = "") {
  if (kondisi) {
    lulus += 1;
    console.log(`  ✓ ${nama}${rincian ? ` — ${rincian}` : ""}`);
  } else {
    gagal += 1;
    console.log(`  ✗ GAGAL: ${nama}${rincian ? ` — ${rincian}` : ""}`);
  }
}

async function panggil(
  metode: string,
  jalur: string,
  opsi: { uji?: string; badan?: unknown } = {},
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${jalur}`, {
    method: metode,
    headers: {
      "Content-Type": "application/json",
      ...(opsi.uji ? { "x-uji-user": opsi.uji } : {}),
    },
    body: opsi.badan ? JSON.stringify(opsi.badan) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

async function main() {
  console.log("== UNIT: ISBN & BM25 ==");
  const inti = "978013468599";
  let total = 0;
  for (let i = 0; i < 12; i += 1) total += Number(inti[i]) * (i % 2 === 0 ? 1 : 3);
  const isbnUji = `${inti}${(10 - (total % 10)) % 10}`;
  cek("ISBN-13 hasil hitung digit pemeriksa dinyatakan sah", isbnSah(isbnUji), isbnUji);
  cek("ISBN rusak (digit terakhir diganti) ditolak lokal", !isbnSah(`${isbnUji.slice(0, 12)}${(Number(isbnUji[12]) + 1) % 10}`));
  cek("ISBN-10 sah dikonversi ke 13", keISBN13("0134685997") === isbnUji, `0134685997 → ${keISBN13("0134685997")}`);
  const sisip = sisipkanRujukan(
    ["تعليم اللغة العربية يحتاج إلى ممارسة حقيقية داخل الفصل. والمناقشة تمنح الطلاب فرصة الكلام.", "القراءة وحدها لا تكفي لبناء الطلاقة الشفهية عند المتعلمين."],
    [
      { id: "ref-x", teksPadanan: "تعليم اللغة العربية المناقشة الكلام ممارسة الفصل" },
      { id: "ref-y", teksPadanan: "القراءة الطلاقة الشفهية المتعلمين" },
    ],
  );
  cek("BM25 menempelkan ≥1 rujukan ke kalimat", sisip.lampiran.length >= 1, `${sisip.lampiran.length} lampiran`);
  cek("Penanda [[fn:…]] muncul di paragraf hasil", sisip.paragrafBaru.some((p) => p.includes("[[fn:")));

  console.log("== GRATIS (UJI-GRATIS) ==");
  const stG = await panggil("GET", "/api/lapis/status", { uji: "UJI-GRATIS" });
  cek("Status: tier gratis", stG.data.tier === "gratis", JSON.stringify(stG.data.tier));
  const judulProyek = "أثر طريقة المناقشة في تنمية مهارة الكلام";
  const p1 = await panggil("POST", "/api/lapis/proyek", { uji: "UJI-GRATIS", badan: { id: "proyek-uji-1", judul: judulProyek, kategoriId: "quran" } });
  cek("Proyek #1 gratis dibuat", p1.status === 200, `HTTP ${p1.status}`);
  const ganti1 = await panggil("POST", "/api/lapis/kategori", { uji: "UJI-GRATIS", badan: { proyekId: "proyek-uji-1", kategoriId: "tafsir" } });
  cek("Ganti kategori pertama (sebelum footnote) diizinkan", ganti1.status === 200, `HTTP ${ganti1.status}`);
  const ganti2 = await panggil("POST", "/api/lapis/kategori", { uji: "UJI-GRATIS", badan: { proyekId: "proyek-uji-1", kategoriId: "hadis" } });
  cek("Ganti kategori kedua DITOLAK (jatah sekali habis)", ganti2.status === 403 && ganti2.data.kode === "GANTI_SUDAH_TERPAKAI", `HTTP ${ganti2.status} ${String(ganti2.data.kode ?? "")}`);
  const p2 = await panggil("POST", "/api/lapis/proyek", { uji: "UJI-GRATIS", badan: { judul: "Proyek kedua", kategoriId: "quran" } });
  cek("Proyek #2 gratis DITOLAK", p2.status === 403 && p2.data.kode === "BATAS_PROYEK", `HTTP ${p2.status} ${String(p2.data.kode ?? "")}`);
  for (let i = 1; i <= 3; i += 1) {
    const f = await panggil("POST", "/api/lapis/footnote", { uji: "UJI-GRATIS", badan: { proyekId: "proyek-uji-1", paragrafId: "khalfiya:0" } });
    cek(`Footnote #${i} se-paragraf lolos`, f.status === 200 && f.data.nomorDalamParagraf === i, `HTTP ${f.status}`);
  }
  const stKunci = await panggil("GET", "/api/lapis/status", { uji: "UJI-GRATIS" });
  const daftarProyek = (stKunci.data.proyek as { terkunciRuangLingkup?: boolean }[]) ?? [];
  cek("Ruang lingkup TERKUNCI setelah footnote pertama", daftarProyek[0]?.terkunciRuangLingkup === true);
  const ganti3 = await panggil("POST", "/api/lapis/kategori", { uji: "UJI-GRATIS", badan: { proyekId: "proyek-uji-1", kategoriId: "fiqh" } });
  cek("Ganti kategori setelah terkunci DITOLAK", ganti3.status === 403, `HTTP ${ganti3.status} ${String(ganti3.data.kode ?? "")}`);
  const f4 = await panggil("POST", "/api/lapis/footnote", { uji: "UJI-GRATIS", badan: { proyekId: "proyek-uji-1", paragrafId: "khalfiya:0" } });
  cek("Footnote #4 se-paragraf DITOLAK", f4.status === 403 && f4.data.kode === "BATAS_FOOTNOTE", `HTTP ${f4.status} ${String(f4.data.kode ?? "")}`);
  const fLain = await panggil("POST", "/api/lapis/footnote", { uji: "UJI-GRATIS", badan: { proyekId: "proyek-uji-1", paragrafId: "khalfiya:1" } });
  cek("Footnote di paragraf LAIN tetap lolos", fLain.status === 200, `HTTP ${fLain.status}`);
  const agenG = await panggil("POST", "/api/agen/chat", { uji: "UJI-GRATIS", badan: { pesan: "Halo agen" } });
  cek("Widget agen gratis TERGERBANG", agenG.status === 403 && agenG.data.kode === "PREMIUM", `HTTP ${agenG.status}`);
  const docG = await panggil("POST", "/api/doc/buat", { uji: "UJI-GRATIS", badan: { judulProyek: "X", driveToken: "token-uji", bagian: [] } });
  cek("Google Doc gratis TERGERBANG", docG.status === 403 && docG.data.kode === "PREMIUM", `HTTP ${docG.status}`);

  console.log("== PREMIUM (UJI-PREMIUM) ==");
  const pp1 = await panggil("POST", "/api/lapis/proyek", { uji: "UJI-PREMIUM", badan: { id: "proyek-prem-1", judul: judulProyek, kategoriId: "quran" } });
  const pp2 = await panggil("POST", "/api/lapis/proyek", { uji: "UJI-PREMIUM", badan: { id: "proyek-prem-2", judul: "Proyek premium kedua", kategoriId: "tafsir" } });
  cek("Proyek premium #1 & #2 LOLOS", pp1.status === 200 && pp2.status === 200, `HTTP ${pp1.status}/${pp2.status}`);
  let fnOk = true;
  for (let i = 1; i <= 5; i += 1) {
    const f = await panggil("POST", "/api/lapis/footnote", { uji: "UJI-PREMIUM", badan: { proyekId: "proyek-prem-1", paragrafId: "khalfiya:0" } });
    if (f.status !== 200) fnOk = false;
  }
  cek("Footnote premium 5× se-paragraf TANPA BATAS", fnOk);
  const agenP = await panggil("POST", "/api/agen/chat", { uji: "UJI-PREMIUM", badan: { pesan: "Apa itu khalfiyah?" } });
  cek("Widget agen premium MENJAWAB", agenP.status === 200 && String(agenP.data.jawaban ?? "").includes("agen"), `HTTP ${agenP.status}`);
  const kustom = await panggil("POST", "/api/lapis/kategori", { uji: "UJI-PREMIUM", badan: { kustom: "Fiqh Muamalah Kontemporer" } });
  const profil = kustom.data.kategoriKustom as { profilKata?: string[] } | undefined;
  cek("Kategori kustom berprofil kata kunci (AI stub)", kustom.status === 200 && (profil?.profilKata?.length ?? 0) >= 3, `HTTP ${kustom.status}, ${profil?.profilKata?.length ?? 0} kata`);
  const docP = await panggil("POST", "/api/doc/buat", { uji: "UJI-PREMIUM", badan: { proyekId: "proyek-prem-1", judulProyek: judulProyek, driveToken: "token-uji", bagian: [{ judul: "Khalfiyah", teks: "نص تجريبي" }] } });
  cek("Google Doc premium dibuat (Drive STUB = SIMULASI)", docP.status === 200 && docP.data.docId === "doc-uji-1", `HTTP ${docP.status} ${String(docP.data.docId ?? "")}`);

  console.log("== BAYAR (Snap STUB; mesin status & tanda tangan asli) ==");
  const order = await panggil("POST", "/api/bayar/buat", { uji: "UJI-GRATIS" });
  cek("Order dibuat via Snap stub", order.status === 200 && Boolean(order.data.token), `HTTP ${order.status}`);
  const orderId = String(order.data.orderId ?? "");
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const badanSah = { order_id: orderId, status_code: "200", gross_amount: "10000.00", transaction_status: "settlement", payment_type: "qris" };
  const tandaSah = createHash("sha512").update(`${badanSah.order_id}${badanSah.status_code}${badanSah.gross_amount}${serverKey}`).digest("hex");
  const webhookPalsu = await panggil("POST", "/api/bayar/webhook", { badan: { ...badanSah, signature_key: "0".repeat(128) } });
  cek("Webhook tanda tangan PALSU ditolak", webhookPalsu.status === 403, `HTTP ${webhookPalsu.status}`);
  const webhookSah = await panggil("POST", "/api/bayar/webhook", { badan: { ...badanSah, signature_key: tandaSah } });
  cek("Webhook SAH diterima", webhookSah.status === 200, `HTTP ${webhookSah.status}`);
  const stBayar = await panggil("GET", "/api/lapis/status", { uji: "UJI-GRATIS" });
  cek("Premium UJI-GRATIS AKTIF setelah webhook lunas", stBayar.data.tier === "premium", `tier=${String(stBayar.data.tier)}`);
  const insiden = await panggil("POST", "/api/bayar/insiden", { uji: "UJI-PREMIUM", badan: { pesan: "Fitur ekspor tidak bisa dibuka sejak tadi pagi.", konteks: "uji" } });
  cek("Laporkan Kendala tercatat dengan tenggat 6 jam", insiden.status === 200 && Boolean((insiden.data.insiden as { tenggat?: string })?.tenggat), `HTTP ${insiden.status}`);

  console.log("== TAMU: uji coba (AI = stub lokal; rujukan = basis data asli) ==");
  const judulTamu = "أثر طريقة المناقشة في تنمية مهارة الكلام لدى طلاب اللغة العربية";
  const t1 = await panggil("POST", "/api/uji-coba", { badan: { judul: judulTamu, perangkatId: "perangkat-uji-A" } });
  const kh = (t1.data.khalfiyah as string[]) ?? [];
  cek("Uji coba #1 berhasil: khalfiyah tepat 3 paragraf", t1.status === 200 && kh.length === 3, `HTTP ${t1.status}, ${kh.length} paragraf`);
  cek("Kalimat kunci 3 buah", Array.isArray(t1.data.kalimatKunci) && (t1.data.kalimatKunci as string[]).length === 3);
  cek("Isykaliyat + ahdaf terbit (tanpa fawaid)", Array.isArray(t1.data.isykaliyat) && Array.isArray(t1.data.ahdaf));
  cek("Daftar rujukan hadir (basis data asli)", Array.isArray(t1.data.refs), `${Array.isArray(t1.data.refs) ? (t1.data.refs as unknown[]).length : 0} rujukan`);
  const sesiId = String(t1.data.sesiId ?? "");
  const kembang = await panggil("POST", "/api/uji-coba/kembangkan", { badan: { sesiId } });
  cek("Kembangkan (BM25) mengembalikan 3 paragraf", kembang.status === 200 && Array.isArray(kembang.data.paragraf) && (kembang.data.paragraf as string[]).length === 3, `HTTP ${kembang.status}`);
  const t2 = await panggil("POST", "/api/uji-coba", { badan: { judul: "عنوان بحث آخر مختلف تماما عن الأول", perangkatId: "perangkat-uji-A" } });
  cek("Percobaan KEDUA perangkat sama DIBLOKIR (wajib login)", t2.status === 403 && t2.data.kode === "WAJIB_LOGIN", `HTTP ${t2.status} ${String(t2.data.kode ?? "")}`);
  const t3 = await panggil("POST", "/api/uji-coba", { badan: { judul: judulTamu, perangkatId: "perangkat-uji-B" } });
  cek("Judul sama dari perangkat lain = TEMBOLOK (tanpa bakar AI)", t3.status === 200 && t3.data.dariTembolok === true, `HTTP ${t3.status}`);

  console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
  if (gagal > 0) process.exit(1);
}

void main();
