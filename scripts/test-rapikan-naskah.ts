// Uji perapian naskah dokumen: kalimat susunan mengalir, draf mahasiswa utuh.
import { composeNaskah, rapikanNaskah } from "../lib/engine/compose";
import { newProject } from "../lib/engine/project";
import assert from "node:assert";

let lulus = 0;
const cek = (n: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"} ${n}`); assert(ok, n); lulus++; };

// Unit: prosa digabung, struktur dipertahankan.
const contoh = [
  "## عنوان القسم",
  "هذه الجملة الأولى من الفقرة.",
  "وهذه الجملة الثانية بعدها مباشرة.",
  "- عنصر قائمة أول",
  "جملة بعد القائمة تقف وحدها.",
  "> ملاحظة مقتبسة",
  "الجملة الأخيرة في القسم.",
].join("\n\n");
const r = rapikanNaskah(contoh);
const blok = r.split(/\n\n+/);
cek("judul tetap blok sendiri", blok[0].startsWith("## "));
cek("dua kalimat prosa menyatu satu paragraf", blok.some((b) => b.includes("الأولى من الفقرة. وهذه الجملة الثانية")));
cek("daftar tidak ikut menyatu", blok.some((b) => b.startsWith("- عنصر")));
cek("kalimat sesudah daftar tidak menempel ke daftar", blok.some((b) => b.startsWith("جملة بعد القائمة")));
cek("kutip tetap sendiri", blok.some((b) => b.startsWith("> ")));

// Integrasi: naskah utuh jauh lebih sedikit bloknya, penanda tidak rusak.
const p = newProject({ jenis: "skripsi", topikAr: "تعليم اللغة العربية", judulAr: "تعليم اللغة العربية في المدرسة" });
const n = composeNaskah(p);
cek("blok prosa menyusut drastis (dari ±110 blok kalimat)", n.split(/\n\n+/).filter((b) => !b.startsWith("#") && !b.startsWith(">") && !b.startsWith("---")).length <= 65);
const blokKhalfiya = n.split(/\n\n+/).filter((b) => b.includes("وتبرز أهمية") || b.includes("ومن هنا تبرز الحاجة"));
cek("kalimat-kalimat khalfiya mengalir dalam satu blok", blokKhalfiya.length === 1 && (blokKhalfiya[0].match(/\./g)?.length ?? 0) >= 4);

// Draf mahasiswa TIDAK dirapikan (paragraf buatannya dihormati).
const drafDua = "Paragraf pertama tulisan mahasiswa yang cukup panjang untuk dianggap draf sah.\n\nParagraf kedua yang sengaja ia pisahkan agar alurnya jelas bagi pembaca.";
const p2 = { ...p, draf: { khalfiya: drafDua } };
const n2 = composeNaskah(p2);
cek("draf dua paragraf tetap dua paragraf", n2.includes("draf sah.\n\nParagraf kedua"));

console.log(`\n${lulus} uji lulus semua`);
