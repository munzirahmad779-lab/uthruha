// Uji pedoman berbahasa Arab penuh: format, templat dari contoh, daftar isi.
import { parsePedoman, templatFootnoteDariContoh, templatPustakaDariContoh } from "../lib/refs/pedoman";
import { footnotePedoman, daftarPustakaPedoman } from "../lib/engine/citation";
import { parseOutlinePedoman } from "../lib/engine/daftar-isi-pedoman";
import { sumberBaru } from "../lib/engine/cite";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (!ok) gagal++;
};

const MD_ARAB = `# دليل كتابة البحوث — جامعة دار السلام كونتور
## تنسيق البحث
- الخط العربي: Traditional Arabic ١٦
- حجم الحاشية: ١٤
- تباعد الأسطر: 1.5
- هوامش الصفحة: 3 سم
- الأرقام: الأرقام العربية
## الحواشي وقائمة المراجع
- ترقيم الحواشي: لكل باب
- مثال الحاشية: النووي، يحيى بن شرف، المجموع شرح المهذب، (بيروت: دار الفكر، 1997)، ج 2، ص 137.
- مثال قائمة المراجع: النووي، يحيى بن شرف. المجموع شرح المهذب. بيروت: دار الفكر، 1997.
## المحتويات
- الباب الأول المقدمة
  - خلفية البحث
  - أسئلة البحث
- الباب الثاني الخاتمة
  - الخلاصة
  - الاقتراحات`;

const p = parsePedoman(MD_ARAB, "pedoman-arab.md");
cek("nama lembaga Arab terbaca", p.namaKampus.includes("جامعة"), p.namaKampus);
cek("ukuran footnote Arab 14", p.ukuranFootnote === 14, String(p.ukuranFootnote));
cek("ukuran naskah Arab 16 (angka Arab-Indic)", p.ukuranNaskah === 16, String(p.ukuranNaskah));
cek("spasi dari تباعد الأسطر", p.spasi === 1.5, String(p.spasi));
cek("margin dari سم", p.marginCm === 3, String(p.marginCm));
cek("penomoran لكل باب", p.penomoran === "per-bab", p.penomoran);
cek("angkaArab true", p.angkaArab === true);
cek(
  "templat footnote diturunkan dari contoh Arab",
  ["{penulis}", "{judul}", "{kota}", "{penerbit}", "{tahun}", "{jilid}", "{halaman}"].every((s) => p.formatFootnote.includes(s)),
  p.formatFootnote,
);
cek(
  "templat pustaka diturunkan dari contoh Arab",
  ["{penulis}", "{judul}", "{kota}", "{penerbit}", "{tahun}"].every((s) => p.formatPustaka.includes(s)),
  p.formatPustaka,
);

// Render pulang-pergi: sumber yang sama dengan contoh harus menghasilkan contoh itu lagi.
const nawawi = {
  ...sumberBaru("kitab"),
  penulis: "النووي، يحيى بن شرف",
  judul: "المجموع شرح المهذب",
  kota: "بيروت",
  penerbit: "دار الفكر",
  tahun: "1997",
};
const fn = footnotePedoman(nawawi, p, { halaman: "137", jilid: "2" });
cek("render footnote == contoh pedoman", fn === "النووي، يحيى بن شرف، المجموع شرح المهذب، (بيروت: دار الفكر، ١٩٩٧)، ج ٢، ص ١٣٧.", fn);
const dp = daftarPustakaPedoman([nawawi], p)[0] ?? "";
cek("render pustaka memuat semua unsur", dp.includes("النووي") && dp.includes("المجموع") && dp.includes("١٩٩٧"), dp);

// Daftar isi dari seksi المحتويات
const outline = parseOutlinePedoman(p.mentah);
cek("outline Arab: 2 bab", outline?.length === 2, `${outline?.length}`);
cek("outline Arab: sub-bab terbaca", outline?.[0].sections.length === 2 && outline[1].sections.length === 2);
cek("outline Arab: labelAr terisi", (outline?.[0].labelAr.length ?? 0) > 0);

// Contoh Indonesia (pola lama) tetap turun templat
const tplId = templatFootnoteDariContoh("النووي، الأذكار، (بيروت: دار الفكر، 2000)، ص 12.");
cek("templat contoh ringkas", tplId === "{penulis}، {judul}، ({kota}: {penerbit}، {tahun})، ص {halaman}.", tplId ?? "null");
const tplPustakaId = templatPustakaDariContoh("Syafii, Ahmad. Metode Sorogan. Jakarta: Pustaka Ilmu, 2019.");
cek("templat pustaka Latin", tplPustakaId === "{penulis}. {judul}. {kota}: {penerbit}, {tahun}.", tplPustakaId ?? "null");
cek("contoh rusak -> null", templatFootnoteDariContoh("bebas tanpa pola") === null);

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
