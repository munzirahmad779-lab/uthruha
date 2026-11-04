/**
 * Uji penerimaan Pembangunan Ulang Tahap 5: penanda sitasi tampil
 * sebagai nomor footnote di editor.
 *
 * Yang dibuktikan (lapisan fungsi murni yang dipakai permukaan tulis):
 * - pecahSegmen: teks draf terpecah menjadi segmen teks / penanda /
 *   fragmen dengan round-trip persis (gabungan mentah == teks asal),
 *   termasuk skenario B3 (penanda kedua menyisakan fragmen yatim).
 * - kompilasiMarker: keluaran penanda DIKENAL tidak berubah (nomor per
 *   kemunculan, bentuk penuh lalu singkat); penanda TAK dikenal tidak
 *   lagi bocor mentah [[ref:…]] ke hasil kompilasi, diganti teks
 *   peringatan terbaca dan tetap dilaporkan; ia tidak memakan nomor.
 * - kompilasiBagian + kemunculanBagian: nomor bagian cocok dokumen
 *   utuh, berubah benar sesudah suntingan (hapus/tambah penanda), dan
 *   proyek lama bermuatan penanda termuat dengan nomor yang benar.
 * - periksaSitasi: fragmen penanda rusak dilaporkan sebagai masalah
 *   "fragmen" berlabel bagian; penanda tak dikenal tetap terdeteksi.
 * - Penjaga statis permukaan: tulis-tab memakai EditorPenanda dan
 *   pratinjau memakai kompilasiBagian (bukan teks mentah).
 *
 * Jalankan: npx tsx scripts/test-tahap5-penanda-nomor.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  cariMarker,
  kompilasiMarker,
  pecahSegmen,
  teksPenandaTakDikenal,
} from "../lib/engine/marker";
import { composeNaskah } from "../lib/engine/compose";
import { footnoteBagian, kemunculanBagian, kompilasiBagian } from "../components/workspace/footnote-bagian";
import { periksaSitasi } from "../lib/engine/periksa-sitasi";
import { newProject, type Project } from "../lib/engine/project";
import { sumberBaru } from "../lib/engine/cite";
import { pedomanDefault } from "../lib/refs/pedoman";
import { getStruktur } from "../lib/content/struktur";

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

/* ---------------- pecahSegmen: klasifikasi + round-trip ---------------- */

function gabung(teks: string): string {
  return pecahSegmen(teks)
    .map((s) => s.mentah)
    .join("");
}

const kasusSegmen: { nama: string; teks: string; jenis: string[] }[] = [
  { nama: "teks polos", teks: "نص بلا أي Penanda sama sekali.", jenis: ["teks"] },
  { nama: "satu penanda", teks: "قال النووي.[[ref:src-a|hlm:137]] انتهى.", jenis: ["teks", "penanda", "teks"] },
  {
    nama: "penanda jilid tanpa halaman",
    teks: "نص[[ref:src-b|jilid:2]] آخر",
    jenis: ["teks", "penanda", "teks"],
  },
  {
    nama: "B3: penanda utuh + ekor yatim",
    teks: "قال النووي.[[ref:src-a|hlm:137]] ثم انقطع الثاني ref:src-b|hlm:55]] هنا.",
    jenis: ["teks", "penanda", "teks", "fragmen", "teks"],
  },
  {
    nama: "penanda tak tertutup di akhir",
    teks: "نص يبدأ جيدا ثم penanda patah [[ref:src-a|hlm:3",
    jenis: ["teks", "fragmen"],
  },
  {
    nama: "blok kurung bukan penanda",
    teks: "نص فيه [[bukan-ref: sesuatu]] عابر.",
    jenis: ["teks", "fragmen", "teks"],
  },
  {
    nama: "kepala patah dekat: penanda sah tidak tertelan fragmen",
    teks: "نص [[ref:src-c قصير[[ref:src-a|hlm:2]] آخر",
    jenis: ["teks", "fragmen", "penanda", "teks"],
  },
  { nama: "string kosong", teks: "", jenis: [] },
];
for (const k of kasusSegmen) {
  const segs = pecahSegmen(k.teks);
  cek(
    `segmen ${k.nama}: jenis sesuai`,
    JSON.stringify(segs.map((s) => s.jenis)) === JSON.stringify(k.jenis),
    segs.map((s) => s.jenis).join(","),
  );
  cek(`segmen ${k.nama}: round-trip persis`, gabung(k.teks) === k.teks);
}

const gabunganJahat =
  "بداية[[ref:src-a|hlm:1]] وسط ref:src-b]] وذيل [[ref:src-c دون إغلاق هنا وكلام طويل يمتد حتى تتجاوز المسافة مئة حرف بكل تأكيد لأن الجملة تستمر وتستمر دون توقف يذكر هنا\n\nفقرة ثانية [[ref:src-b|hlm:9|jilid:3]] نهاية.";
cek("round-trip fixture gabungan jahat", gabung(gabunganJahat) === gabunganJahat);
cek(
  "fixture jahat: 2 penanda + 2 fragmen",
  (() => {
    const s = pecahSegmen(gabunganJahat);
    return s.filter((x) => x.jenis === "penanda").length === 2 && s.filter((x) => x.jenis === "fragmen").length === 2;
  })(),
);

/* ---------------- Proyek fixture ---------------- */

function buatProyek(): Project {
  const p: Project = newProject({ jenis: "skripsi", metode: "kualitatif", bidangId: "bahasa", judulAr: "بحث" });
  p.pedoman = pedomanDefault();
  const s1 = { ...sumberBaru("kitab"), id: "src-a", penulis: "النووي، يحيى بن شرف", judul: "المجموع شرح المهذب", kota: "بيروت", penerbit: "دار الفكر", tahun: "1997" };
  const s2 = { ...sumberBaru("kitab"), id: "src-b", penulis: "ابن حجر، أحمد بن علي", judul: "فتح الباري", kota: "القاهرة", penerbit: "دار الحديث", tahun: "2001" };
  p.sumber = [s1, s2];
  return p;
}

const secs = getStruktur("skripsi").chapters.flatMap((c) => c.sections);
const secA = secs[0].id;
const secB = secs[1].id;
const secC = secs[2].id;

const p = buatProyek();
p.draf = {
  [secA]: `نص أول يستند إلى شرح النووي.[[ref:src-a|hlm:137]] ويستند أيضا إلى ابن حجر العسقلاني.[[ref:src-b|hlm:55]]`,
  [secB]: `نص ثان يعود إلى النووي مرة أخرى.[[ref:src-a|hlm:200]] ويشير إلى مصدر مجهول غير محفوظ.[[ref:src-xxx|hlm:1]]`,
  [secC]: `نص ثالث يستند إلى ابن حجر مرة أخرى في موضع آخر.[[ref:src-b|hlm:71]]`,
};

/* ---------------- kompilasiMarker: dikenal tak berubah, tak dikenal tak bocor ---------------- */

const hasilDok = kompilasiMarker(composeNaskah(p), p);
cek("dokumen: tidak ada [[ref: mentah tersisa", !hasilDok.markdown.includes("[[ref:"));
cek(
  "dokumen: penanda tak dikenal menjadi teks peringatan",
  hasilDok.markdown.includes(teksPenandaTakDikenal("src-xxx")),
);
cek("dokumen: takDikenal melaporkan src-xxx", hasilDok.takDikenal.some((m) => m.id === "src-xxx"));
cek("dokumen: jumlah penanda dikenal = 4", hasilDok.jumlah === 4, String(hasilDok.jumlah));
const defsDok = [...hasilDok.markdown.matchAll(/^\[\^(\d+)\]: (.*)$/gm)].map((m) => ({ n: m[1], t: m[2] }));
cek(
  "dokumen: definisi 1-4 berurutan untuk empat kemunculan dikenal",
  defsDok.slice(0, 4).map((d) => d.n).join(",") === "1,2,3,4",
  defsDok.slice(0, 4).map((d) => d.n).join(","),
);
cek("dokumen: kemunculan pertama src-a bentuk penuh", (defsDok[0]?.t ?? "").includes("دار الفكر"), defsDok[0]?.t);
cek(
  "dokumen: kemunculan kedua src-a bentuk singkat",
  (defsDok[2]?.t ?? "").includes("المجموع") && !(defsDok[2]?.t ?? "").includes("دار الفكر"),
  defsDok[2]?.t,
);

/* ---------------- kompilasiBagian + kemunculanBagian ---------------- */

const kompA = kompilasiBagian(p, secA);
cek("bagian A: 2 entri bernomor 1,2", kompA.entri.map((e) => e.nomor).join(",") === "1,2", kompA.entri.map((e) => e.nomor).join(","));
const kompB = kompilasiBagian(p, secB);
cek("bagian B: hanya 1 entri (src-a) bernomor 3", kompB.entri.length === 1 && kompB.entri[0].nomor === 3);
cek("bagian B: entri nomor 3 bentuk singkat", (kompB.entri[0]?.teks ?? "").includes("المجموع") && !(kompB.entri[0]?.teks ?? "").includes("دار الفكر"));
cek("bagian B: markdown memuat [^3] dan definisinya", kompB.markdown.includes("[^3]") && kompB.markdown.includes("[^3]:"));
cek("bagian B: markdown bebas [[ref: mentah", !kompB.markdown.includes("[[ref:"));
cek("bagian B: markdown memuat peringatan src-xxx", kompB.markdown.includes(teksPenandaTakDikenal("src-xxx")));
cek("bagian B: takDikenal berisi src-xxx", kompB.takDikenal.some((m) => m.id === "src-xxx"));
const kompC = kompilasiBagian(p, secC);
cek("bagian C: src-b bernomor 4", kompC.entri.length === 1 && kompC.entri[0].nomor === 4);

const kemB = kemunculanBagian(p, secB);
cek(
  "kemunculan B: src-a nomor 3, src-xxx null",
  kemB.length === 2 && kemB[0].id === "src-a" && kemB[0].nomor === 3 && kemB[1].id === "src-xxx" && kemB[1].nomor === null,
  JSON.stringify(kemB.map((k) => [k.id, k.nomor])),
);
cek(
  "kemunculan cocok footnoteBagian (strip)",
  JSON.stringify(footnoteBagian(p, secB).map((f) => f.nomor)) === JSON.stringify(["3"]),
);

/* Suntingan: nomor berubah benar */
const teksBSunting = `نص ثان بعد حذف إشارة النووي الأولى منه وبقيت الإشارة المجهولة فقط.[[ref:src-xxx|hlm:1]]`;
const kemBSunting = kemunculanBagian(p, secB, teksBSunting);
cek(
  "suntingan aktif: teksAktif menang, src-xxx tetap null",
  kemBSunting.length === 1 && kemBSunting[0].nomor === null,
);
const p2 = buatProyek();
p2.draf = { ...p.draf, [secB]: teksBSunting };
cek(
  "sesudah penanda pertama dihapus: src-b di bagian C turun ke nomor 3",
  kemunculanBagian(p2, secC)[0]?.nomor === 3,
  String(kemunculanBagian(p2, secC)[0]?.nomor),
);
const teksATambah = `إشارة مبكرة إلى ابن حجر.[[ref:src-b|hlm:10]] ثم النص الأول يستند إلى النووي.[[ref:src-a|hlm:137]] ويستند أيضا إلى ابن حجر.[[ref:src-b|hlm:55]]`;
cek(
  "penanda ditambah di awal: nomor bergeser 1,2,3",
  kemunculanBagian(p, secA, teksATambah).map((k) => k.nomor).join(",") === "1,2,3",
  kemunculanBagian(p, secA, teksATambah).map((k) => k.nomor).join(","),
);

/* Proyek lama: draf tersimpan bermuatan penanda termuat apa adanya */
const pLama = buatProyek();
pLama.draf = { [secA]: `دraf قديم محفوظ من قبل وفيه إشارة إلى النووي.[[ref:src-a|hlm:5]]` };
cek(
  "proyek lama: penanda tersimpan bernomor 1",
  kemunculanBagian(pLama, secA)[0]?.nomor === 1 && cariMarker(pLama.draf[secA]).length === 1,
);

/* ---------------- periksaSitasi: fragmen + tak dikenal ---------------- */

const periksaP = periksaSitasi(p);
cek(
  "periksa: tak-dikenal src-xxx tetap terdeteksi",
  periksaP.masalah.some((m) => m.jenis === "tak-dikenal"),
);
cek(
  "periksa: proyek bersih dari fragmen pada tiga bagian fixture",
  !periksaP.masalah.some(
    (m) => m.jenis === "fragmen" && [secA, secB, secC].includes(m.sectionId ?? ""),
  ),
);
const p3 = buatProyek();
p3.draf = {
  [secA]: `نص فيه بقايا penanda rusak لم يكتمل [[ref:src-a|hlm:137 ثم تابع الكلام هنا حتى نهاية الفقرة.`,
  [secB]: `نص آخر فيه ذيل يتيم من penanda منقطع ref:src-b|hlm:9]] بعد أن انقطع الأول هنا.`,
};
const periksaP3 = periksaSitasi(p3);
cek(
  "periksa: fragmen [[ tak tertutup dilaporkan di bagiannya",
  periksaP3.masalah.some((m) => m.jenis === "fragmen" && m.sectionId === secA && (m.labelBagian ?? "").length > 0),
);
cek(
  "periksa: fragmen ekor yatim ref: dilaporkan di bagiannya",
  periksaP3.masalah.some((m) => m.jenis === "fragmen" && m.sectionId === secB),
);
cek(
  "periksa: fragmen berstatus kritis",
  periksaP3.masalah.filter((m) => m.jenis === "fragmen").every((m) => m.tingkat === "kritis"),
);

/* ---------------- Penanda patah tidak menelan penanda sah; fragmen di ekspor ---------------- */

const teksTelan =
  "رأس مكسور [[ref:src-c دون إغلاق هنا وكلام طويل يمتد حتى تتجاوز المسافة مئة حرف بكل تأكيد لأن الجملة تستمر وتستمر دون توقف يذكر هنا ثم المرجع الصحيح[[ref:src-a|hlm:5]] بعده.";
const markerTelan = cariMarker(teksTelan);
cek(
  "telan: cariMarker menemukan penanda sah src-a, bukan id sampah",
  markerTelan.length === 1 && markerTelan[0].id === "src-a",
  JSON.stringify(markerTelan.map((m) => m.id)),
);
const kompilasiTelan = kompilasiMarker(teksTelan, p);
cek("telan: penanda sah terkompilasi menjadi [^1]", kompilasiTelan.markdown.includes("[^1]"));
cek("telan: tidak ada [[ref: mentah di keluaran", !kompilasiTelan.markdown.includes("[[ref:"));
cek(
  "telan: kepala patah menjadi teks peringatan fragmen",
  kompilasiTelan.markdown.includes("[⚠ penanda sitasi rusak]"),
);
cek("telan: fragmen dilaporkan di hasil kompilasi", kompilasiTelan.fragmen.length >= 1);

const kompilasiRusak = kompilasiMarker(gabunganJahat, p);
cek(
  "ekspor: fixture jahat bebas [[ref: dan ref: mentah",
  !kompilasiRusak.markdown.includes("[[ref:") && !/ref:src-/.test(kompilasiRusak.markdown),
  kompilasiRusak.markdown.slice(0, 200),
);
cek(
  "ekspor: dua penanda sah fixture jahat tetap bernomor",
  kompilasiRusak.jumlah === 2,
  String(kompilasiRusak.jumlah),
);
cek("ekspor: fragmen fixture jahat dilaporkan", kompilasiRusak.fragmen.length === 2);

/* ---------------- Penjaga statis permukaan tulis ---------------- */

const srcTulis = readFileSync(path.join(process.cwd(), "components/workspace/tulis-tab.tsx"), "utf8");
cek("statis: tulis-tab merender EditorPenanda", srcTulis.includes("<EditorPenanda"));
cek(
  "statis: pratinjau tulis-tab memakai kompilasiBagian",
  srcTulis.includes("kompilasiBagian(p, bagian, teks)"),
);
cek(
  "statis: textarea lama untuk draf sudah tidak ada",
  !srcTulis.includes("value={teks}"),
);

console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
process.exit(gagal === 0 ? 0 : 1);
