/**
 * Adapter Shamela.ws — API pencarian sungguhan.
 *
 * Hasil uji langsung (bukan dugaan):
 *  - `GET /ajax/search` → 400 "رجاء التأكد من كتابة عبارة البحث" (selalu).
 *  - `POST /ajax/search` dengan form field `term` → 200 HTML berisi hasil.
 *  - `GET /ajax/books/?q=` → JSON, tetapi hanya daftar kitab, bukan
 *    pencarian isi. Tidak dipakai untuk rujukan.
 *
 * Jadi Shamela TIDAK butuh key. Yang dipakai adalah bentuk HTML yang
 * dihasilkan `/assets/js/custom.js` (doSearch → `$.post('ajax/search')`).
 *
 * Struktur satu hasil (terverifikasi):
 *   <div>
 *     <a href="https://shamela.ws/book/{id}/{page}">
 *       <b><span class="text-primaryy">NAMA KITAB</span></b>
 *       <span class="text-gray">[PENULIS]</span>
 *     </a>
 *     <span class="text-gray srch-page-ref">(ج 6، ص 274)</span>
 *   </div>
 *   <p class="srch-snippet"><span class="srch-snippet-text">…<em>kata</em>…</span></p>
 *
 * Shamela mengirim nama kitab, penulis, jilid, halaman, dan teks kutipan —
 * tetapi TIDAK mengirim penerbit, kota, dan tahun. Kolom itu ditandai
 * `[ ! verifikasi ]` secara jujur, bukan dikarang.
 */
import type { RefCandidate } from "@/lib/refs/types";
import { ambilHtmlPost, type OpsiAdapter } from "@/lib/refs/adapters/http";
import { bersihkanKutipan, skorMirip } from "@/lib/refs/score";

const SITUS = "https://shamela.ws";
const RUTE_CARI = `${SITUS}/ajax/search`;

export const info = {
  id: "shamela" as const,
  mode: "api" as const,
  butuhKey: false,
  adaKeyServer: true,
  situs: SITUS,
};

export function tautanShamela(kalimat: string): string {
  return `${SITUS}/search?q=${encodeURIComponent(kalimat.slice(0, 180))}`;
}

/** Buang tag HTML, ubah entitas dasar, rapikan spasi. */
function teksDari(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Angka Arab-Indic (٠١٢…) ke Latin. Shamela menulis jilid/halaman dengan
 * angka Arab-Indic pada sebagian kitab, jadi tanpa ini halaman jadi kosong.
 */
function angkaArab(s: string): number | undefined {
  const peta: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  const latin = s.replace(/[٠-٩۰-۹]/g, (d) => peta[d] ?? d);
  const m = latin.match(/\d+/);
  if (!m) return undefined;
  const n = Number.parseInt(m[0], 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Baca "(ص 1460)" atau "(ج 6، ص 274)" dari penanda halaman Shamela.
 * Urutan penting: jilid dicari dari "ج" dan halaman dari "ص", bukan
 * sekadar angka pertama — pada (ج 6، ص 274) angka pertama adalah jilid.
 */
export function bacaHalaman(
  tanda: string,
): { jilid?: number; halaman?: number } {
  const j = tanda.match(/ج\s*([٠-٩۰-۹\d]+)/);
  const p = tanda.match(/ص\s*([٠-٩۰-۹\d]+)/);
  const hasil: { jilid?: number; halaman?: number } = {};
  if (j) hasil.jilid = angkaArab(j[1]);
  if (p) hasil.halaman = angkaArab(p[1]);
  // Tanpa penanda "ص", satu-satunya angka adalah halaman.
  if (!p && !j) {
    const n = angkaArab(tanda);
    if (n !== undefined) hasil.halaman = n;
  }
  return hasil;
}

/**
 * Urai HTML hasil Shamela menjadi kandidat.
 *
 * Dipisah dari `cari()` supaya bisa diuji tanpa jaringan: QA memberi HTML
 * contoh dan memeriksa hasil uraiannya.
 */
export function uraiHasil(html: string, kalimat: string, maks = 8): RefCandidate[] {
  const keluar: RefCandidate[] = [];

  // Satu hasil = satu <div> yang memuat <a href=".../book/…"> diikuti
  // penanda halaman. Dipecah pada kemunculan tautan kitab agar tahan
  // terhadap perbedaan spasi/atribut.
  const bagian = html.split(/(?=<a[^>]+href="[^"]*\/book\/)/i);
  for (const blok of bagian) {
    if (keluar.length >= maks) break;

    const tautan = blok.match(/href="([^"]*\/book\/[^"]*)"/i);
    if (!tautan) continue;
    const url = tautan[1].replace(/^\/\//, "https://");

    const judulM = blok.match(/text-primaryy[^>]*>([\s\S]*?)<\/span>/i);
    const kitab = judulM ? teksDari(judulM[1]) : "";

    const penulisM = blok.match(/text-gray[^>]*>\s*\[([\s\S]*?)\]\s*<\/span>/i);
    const penulis = penulisM ? teksDari(penulisM[1]) : undefined;

    const tandaM = blok.match(/srch-page-ref[^>]*>([\s\S]*?)<\/span>/i);
    const { jilid, halaman } = tandaM ? bacaHalaman(teksDari(tandaM[1])) : {};

    const snipM = blok.match(/srch-snippet-text[^>]*>([\s\S]*?)<\/span>/i);
    const kutipan = snipM ? bersihkanKutipan(teksDari(snipM[1])) : "";
    if (!kutipan) continue;

    const skor = skorMirip(kalimat, kutipan);
    const kurang: string[] = [];
    if (!kitab) kurang.push("nama kitab");
    if (!penulis) kurang.push("penulis");
    kurang.push("penerbit", "kota", "tahun");

    keluar.push({
      source: "shamela",
      kitab: kitab || "[ ! verifikasi ]",
      penulis,
      jilid,
      halaman_cetak: halaman,
      teks_kutipan: kutipan,
      url_sumber: url,
      skor: Number(skor.toFixed(3)),
      mode: "api",
      perluVerifikasi: true,
      catatanVerifikasi: `Shamela tidak mengirim ${kurang.join(", ")}. Lengkapi manual sebelum dipakai.`,
      skor_jenis: "kata",
    });
  }

  return keluar.sort((a, b) => b.skor - a.skor);
}

export async function cari(kalimat: string, opsi: OpsiAdapter = {}): Promise<RefCandidate[]> {
  const maks = opsi.maks ?? 6;
  const kueri = kalimat.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!kueri) return [];

  const html = await ambilHtmlPost(
    RUTE_CARI,
    { term: kueri },
    { ...opsi, rujukan: `${SITUS}/` },
  );

  // Shamela menolak dengan 200 + pesan bila `term` dianggap kosong.
  if (/رجاء التأكد من كتابة عبارة البحث/.test(html)) {
    throw new Error("Shamela menolak kata kunci (kosong/terlalu pendek)");
  }

  return uraiHasil(html, kalimat, maks).filter((c) => c.skor >= 0.08);
}

export function deeplink(kalimat: string): RefCandidate {
  return {
    source: "shamela",
    kitab: "",
    teks_kutipan: kalimat,
    url_sumber: tautanShamela(kalimat),
    skor: 0,
    mode: "deeplink",
    perluVerifikasi: true,
    catatanVerifikasi: "Buka tautan untuk memeriksa hasil langsung di Shamela.",
  };
}

export async function cariKonsep(
  konsep: string[],
  opsi: OpsiAdapter = {},
): Promise<RefCandidate[]> {
  const maks = opsi.maks ?? 6;
  if (konsep.length === 0) return [];

  const out: RefCandidate[] = [];
  const sudah = new Set<string>();

  for (const q of konsep.slice(0, 4)) {
    try {
      const res = await cari(q, { ...opsi, maks: 4 });
      for (const item of res) {
        const key = `${item.kitab}:${item.jilid ?? "-"}:${item.halaman_cetak ?? "-"}`;
        if (!sudah.has(key)) {
          sudah.add(key);
          out.push({
            ...item,
            judul_bab: q,
            konsep_cocok: [q],
            skor_jenis: "konsep",
            skor: Math.max(item.skor, 0.82),
          });
        }
      }
    } catch {
      // Abaikan bila satu kueri gagal
    }
    if (out.length >= maks) break;
  }

  return out.slice(0, maks);
}
