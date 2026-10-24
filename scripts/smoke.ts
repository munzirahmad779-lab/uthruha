/**
 * Smoke test mesin Uthruha — dijalankan dengan `npx tsx scripts/smoke.ts`.
 * Tidak memakai browser: menguji komposisi, ortografi, transliterasi, sitasi,
 * pemadu jurnal, dan penulisan DOCX.
 */
import fs from "node:fs";
import { getStruktur } from "../lib/content/struktur";
import { newProject } from "../lib/engine/project";
import { composeNaskah, composeSection } from "../lib/engine/compose";
import { perbaikiOtomatis, periksaOrtografi } from "../lib/engine/orthografi";
import { arabKeLatin, latinKeArab } from "../lib/engine/translit";
import {
  catatanKaki,
  entriDaftarPustaka,
  kutipanDalamTeks,
  sumberBaru,
  type Sumber,
} from "../lib/engine/cite";
import { cocokkanJurnal, filterJurnal, tokenkan } from "../lib/engine/match";
import { buatDocx } from "../lib/engine/export";

const p = newProject({
  jenis: "skripsi",
  metode: "kualitatif",
  bidangId: "bahasa",
  topikAr: "تعليم المحادثة في المعاهد الإسلامية",
  judulAr: "فاعلية طريقة المحاورة في تنمية مهارة الكلام",
  lokasi: "معهد دار المعارف",
  populasi: "طلاب الصف الثاني",
  fenomenaAr: "يلاحظ الباحث ضعف الطلاب في المحادثة رغم دراستهم للنحو",
  rumusan: ["كيف يُفهم تعليم المحادثة ويُمارس في المعهد؟", "ما العوامل التي تُشكّل ضعف مهارة الكلام؟"],
});

const arRatio = (s: string) => {
  const ar = (s.match(/[\u0600-\u06FF]/g) ?? []).length;
  return ar / Math.max(1, s.replace(/\s/g, "").length);
};

let gagal = 0;
const cek = (nama: string, ok: boolean, info = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${info ? " - " + info : ""}`);
  if (!ok) gagal++;
};

const jenisList = ["skripsi", "tesis", "disertasi", "jurnal"] as const;
const metodeList = ["kuantitatif", "kualitatif", "mixed"] as const;

let bagian = 0;
let gagalBagian = 0;
for (const jenis of jenisList) {
  for (const metode of metodeList) {
    const proj = { ...p, jenis, metode };
    for (const ch of getStruktur(jenis).chapters) {
      for (const s of ch.sections) {
        const h = composeSection(proj, s.id, 7);
        bagian++;
        const ok = h.markdown.length > 120 && !h.markdown.includes("{{") && arRatio(h.markdown) > 0.1;
        if (!ok) {
          gagalBagian++;
          console.log(`   gagal: ${jenis}/${metode}/${s.id} len=${h.markdown.length} ar=${arRatio(h.markdown).toFixed(2)}`);
        }
      }
    }
  }
}
cek(`komposisi ${bagian} bagian (4 jenis x 3 metode) tanpa placeholder tersisa`, gagalBagian === 0, `${gagalBagian} gagal`);

const nd = composeNaskah(p);
cek("naskah utuh > 4000 karakter", nd.length > 4000, `len=${nd.length}`);

const ort = periksaOrtografi(
  "انشاء الله سيكون هذا البحث مفيدا, وتظهر المشكلة في ضعف الطلاب في المحادثة ؛ حيث انهم يدرسون النحو .. ولكنهم لا يستطيعون التحدث في مكتبه الجامعه",
);
cek("ortografi mendeteksi >= 4 temuan", ort.temuan.length >= 4, `${ort.temuan.length} temuan`);
cek("perbaikan hamzah", perbaikiOtomatis("انشاء الله").includes("إن شاء الله"));
const ulangAsli = periksaOrtografi("الكتاب الكتاب في المنهج").temuan.filter((t) => t.aturan === "Kata terulang");
const ulangPalsu = periksaOrtografi("من مناهج الدراسات وفي فيء الظل").temuan.filter((t) => t.aturan === "Kata terulang");
cek("kata terulang terdeteksi tepat", ulangAsli.length === 1 && ulangPalsu.length === 0, `${ulangAsli.length}/${ulangPalsu.length}`);
cek(
  "penanda daftar tidak dianggap angka liar",
  periksaOrtografi("1. البند الأول\n2. البند الثاني").temuan.filter((t) => t.aturan === "Angka Latin").length === 0,
);

const ak = latinKeArab("Muhammad", "akademik");
const fo = latinKeArab("Nurhaliza", "fonetis");
cek("translit akademik", ak.length > 2, ak);
cek("translit fonetis", fo.length > 4, fo);
const ar2 = arabKeLatin("القرطبي");
cek("arab ke latin (artikel qamariyah)", /^al-q/i.test(ar2), ar2);
const ar3 = arabKeLatin("الرحمن");
cek("arab ke latin (lam syamsiyah)", /^ar-r/.test(ar3), ar3);

const s: Sumber = {
  ...sumberBaru("kitab"),
  penulis: "القرطبي، أبو عبد الله محمد",
  tahun: "1964",
  judul: "الجامع لأحكام القرآن",
  kota: "القاهرة",
  penerbit: "دار الكتب المصرية",
  tahqiq: "أحمد البردوني",
  jilid: "1",
  halaman: "23",
};
cek("kutipan dalam teks", kutipanDalamTeks(s).length > 6, kutipanDalamTeks(s));
cek("catatan kaki", catatanKaki(s).includes("دار الكتب"), catatanKaki(s));
cek("entri daftar pustaka", entriDaftarPustaka(s).length > 30, entriDaftarPustaka(s));

const cocok = cocokkanJurnal("تعليم اللغة العربية مهارة الكلام المحادثة", "bahasa", 5);
cek(
  "pemadu jurnal",
  cocok.length === 5 && cocok[0].skor >= cocok[4].skor,
  `${cocok[0]?.jurnal.namaLatin} ${cocok[0]?.skor}%`,
);
cek("filter jurnal", filterJurnal({ bidang: "bahasa" }).length > 0, `${filterJurnal({ bidang: "bahasa" }).length} jurnal`);
cek("tokenkan", tokenkan("تعليم اللغة العربية").length === 3);

async function ujiDocx() {
  const blob = buatDocx("اختبار", "# عنوان\n\nفقرة عربية للاختبار.\n\n| أ | ب |\n|---|---|");
  const buf = Buffer.from(await blob.arrayBuffer());
  cek("docx magic PK", buf[0] === 0x50 && buf[1] === 0x4b, `${buf.length} bytes`);
  fs.writeFileSync(".smoke.docx", buf);

  console.log(gagal === 0 ? "SEMUA PASS" : `${gagal} GAGAL`);
  process.exit(gagal === 0 ? 0 : 1);
}

void ujiDocx();
