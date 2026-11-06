// Uji regresi Periksa Batas (perbaikan laporan QA agen penguji
// 6 Nov 2026): pemeriksa batas WAJIB membaca footnote yang benar
// benar tertanam di draf. Kasus agen: satu paragraf berisi 3
// footnote terpasang ditolak penegak batas lapis saat footnote
// keempat hendak dipasang (lampau batas gratis 3 per paragraf),
// tetapi hitungBatas membaca 0 dan menyatakan "Batas terpenuhi"
// karena ia hanya menghitung pola [^n] hasil kompilasi, padahal
// draf menyimpan sitasi sebagai penanda [[ref:…]].
import { hitungBatas } from "../lib/refs/footnote";
import { hitungFootnoteBlok } from "../lib/engine/marker";
import { pedomanDefault, type PedomanRules } from "../lib/refs/pedoman";

let lulus = 0;
let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

const aturan: PedomanRules = { ...pedomanDefault(), maksFootnotePerParagraf: 3, maksHalaman: 500 };
const penanda = (id: string, hlm: string) => `[[ref:${id}|hlm:${hlm}]]`;

// 1) Kasus agen persis: paragraf draf dengan 3 penanda terpasang.
const tiga =
  `نص الفقرة الأولى يستند إلى المجموع شرح المهذب. ${penanda("src-a", "137")} ` +
  `ويستند أيضا إلى فتح الباري. ${penanda("src-b", "55")} ` +
  `ويختم بما في الأذكار للنووي. ${penanda("src-c", "23")}`;
const h3 = hitungBatas(tiga, aturan);
cek("3 penanda draf terbaca 3 oleh pemeriksa", h3.paragraf[0]?.jumlah === 3, `jumlah=${h3.paragraf[0]?.jumlah}`);
cek("3 penanda pada maks 3 belum lampau batas", h3.paragraf[0]?.lebih === false);
cek("total footnote 3", h3.footnoteTotal === 3, `total=${h3.footnoteTotal}`);
cek(
  "tidak ada pelanggaran footnote pada tepat batas",
  !h3.pelanggaran.some((v) => v.includes("footnote")),
  h3.pelanggaran.join(" / "),
);

// 2) Keadaan lampau batas: 4 penanda pada maks 3 terdeteksi lampau,
//    BUKAN "terpenuhi".
const empat = `${tiga} وزيادة على ذلك من رياض الصالحين. ${penanda("src-d", "9")}`;
const h4 = hitungBatas(empat, aturan);
cek("4 penanda terbaca 4", h4.paragraf[0]?.jumlah === 4, `jumlah=${h4.paragraf[0]?.jumlah}`);
cek("4 penanda pada maks 3 terdeteksi lampau", h4.paragraf[0]?.lebih === true);
cek(
  "pelanggaran menyebut paragraf 1 lampau batas",
  h4.pelanggaran.some((v) => v.includes("Paragraf 1") && v.includes("footnote")),
  h4.pelanggaran.join(" / "),
);

// 3) Teks terkompilasi: rujukan [^n] dihitung, definisi [^n]: tidak
//    dihitung ganda.
const kompilasi = "نص أول.[^1] ونص ثان.[^2]\n\n[^1]: النووي، المجموع.\n[^2]: ابن حجر، فتح الباري.";
cek(
  "teks kompilasi: 2 rujukan, definisi tidak menggandakan",
  hitungFootnoteBlok("نص أول.[^1] ونص ثان.[^2]") === 2 &&
    hitungBatas(kompilasi, aturan).footnoteTotal === 2,
  `total=${hitungBatas(kompilasi, aturan).footnoteTotal}`,
);

// 4) Penomoran paragraf selaras dialog Pasang Footnote: blok judul
//    markdown tidak memakan nomor paragraf.
const berdjudul = `# الباب الأول\n\n${tiga}`;
const hj = hitungBatas(berdjudul, aturan);
cek(
  "blok judul tidak memakan nomor: paragraf isi tetap nomor 1",
  hj.paragraf.length === 1 && hj.paragraf[0]?.nomor === 1 && hj.paragraf[0]?.jumlah === 3,
  JSON.stringify(hj.paragraf),
);

// 5) Dua paragraf isi: hitungan per paragraf dan totalnya terpisah benar.
const dua = `${penanda("src-a", "1")} نص قصير.\n\n${tiga}`;
const hd = hitungBatas(dua, aturan);
cek(
  "dua paragraf: 1 dan 3, total 4",
  hd.paragraf[0]?.jumlah === 1 && hd.paragraf[1]?.jumlah === 3 && hd.footnoteTotal === 4,
  JSON.stringify(hd.paragraf),
);

// 6) Penghitung blok: penanda tanpa atribut dan penanda patah.
cek(
  "penanda polos dihitung, fragmen patah tidak",
  hitungFootnoteBlok("نص [[ref:src-a]] وآخر [[ref:src-b|jilid:2]]") === 2 &&
    hitungFootnoteBlok("نص [[ref:src-a tanpa tutup") === 0,
);

console.log(`\nHASIL: ${lulus} PASS, ${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
