// Uji regresi audit eksternal M1 (T-01 s.d. T-10) — hanya koreksi yang
// terbukti dari kode produksi yang dikunci di sini.
import assert from "node:assert";
import { strukturProyek, susunDaftarIsiBawaan } from "../lib/content/struktur";
import { composeNaskah, composeSection, tujuanDefault } from "../lib/engine/compose";
import { newProject } from "../lib/engine/project";
import { bersihSelTabel, pecahBarisTabel } from "../lib/engine/tabel-markdown";

let lulus = 0;
const cek = (n: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${n}`);
  assert(ok, n);
  lulus++;
};

const dasar = {
  topikAr: "تعليم المحادثة",
  judulAr: "فاعلية تعليم المحادثة",
  lokasi: "معهد دار المعارف",
  populasi: "طلاب الصف الثاني",
};

// T-01: pernyataan pendanaan/etik tidak lagi ditulis sebagai fakta.
const pJurnal = newProject({ jenis: "jurnal", ...dasar });
const pendanaan = composeSection(pJurnal, "pendanaan").markdown;
cek("T-01 pendanaan menjadi placeholder", pendanaan.includes("[اكتب مصدر التمويل") && !pendanaan.includes("من أي جهة مانحة في القطاع العام"));
const etik = composeSection(pJurnal, "pernyataanEtik").markdown;
cek("T-01 pernyataan etik menjadi placeholder", etik.includes("[اكتب هنا: هل يوجد تضارب مصالح؟") && !etik.includes("يصرّح الباحث بأنه لا يوجد أي تضارب"));

// T-02: hipotesis tidak masuk struktur efektif/naskah kualitatif, tetapi
// tampil untuk kuantitatif dan tidak menyembunyikan draf substantif lama.
const pKual = newProject({ jenis: "skripsi", metode: "kualitatif", ...dasar });
const idsKual = strukturProyek(pKual).chapters.flatMap((c) => c.sections.map((s) => s.id));
cek("T-02 kualitatif tanpa farudhiyat", !idsKual.includes("farudhiyat"));
cek("T-02 naskah kualitatif tanpa bagian hipotesis", !composeNaskah(pKual).includes("## الفرضيات"));
const pKuan = newProject({ jenis: "skripsi", metode: "kuantitatif", ...dasar });
cek("T-02 kuantitatif tetap punya farudhiyat", strukturProyek(pKuan).chapters.flatMap((c) => c.sections.map((s) => s.id)).includes("farudhiyat"));
const pDrafHipotesis = { ...pKual, draf: { farudhiyat: "Draf hipotesis lama yang ditulis mahasiswa dan cukup substantif." } };
cek("T-02 draf farudhiyat lama tidak disembunyikan", strukturProyek(pDrafHipotesis).chapters.flatMap((c) => c.sections.map((s) => s.id)).includes("farudhiyat"));
cek("T-02 snapshot daftar isi kualitatif tanpa farudhiyat", !susunDaftarIsiBawaan(pKual).flatMap((b) => b.sections.map((s) => s.id)).includes("farudhiyat"));

// T-03: tujuan bawaan sejajar jumlahnya dengan rumusan.
cek("T-03 jurnal dua rumusan -> dua tujuan", tujuanDefault(pJurnal).length === 2);
cek("T-03 satu rumusan kustom -> satu tujuan", tujuanDefault(newProject({ rumusan: ["سؤال واحد؟"] })).length === 1);
cek("T-03 empat rumusan kustom -> empat tujuan", tujuanDefault(newProject({ rumusan: ["أ؟", "ب؟", "ج؟", "د؟"] })).length === 4);

// T-04: klaim hasil yang belum dibuktikan diganti placeholder.
const pDisertasi = newProject({ jenis: "disertasi", ...dasar });
cek("T-04 abstrakEn tanpa klaim temuan", !composeSection(pJurnal, "abstrakEn").markdown.includes("The findings show that the phenomenon cannot"));
cek("T-04 kebaruan tanpa klaim sudah terbukti", !composeSection(pDisertasi, "kebaruan").markdown.includes("وقد أُثبتت هذه الجدة"));
cek("T-04 munazara tanpa klaim kesesuaian hasil", !composeSection(pKual, "munazara").markdown.includes("ويتضح من ذلك أن نتائج هذه الدراسة تتفق"));
cek("T-04 mulakhkhas tanpa klaim hubungan hasil", !composeSection(pJurnal, "mulakhkhas").markdown.includes("وانتهى البحث إلى نتائج تشير إلى وجود علاقة واضحة"));
cek("T-04 nataij tanpa klaim faktor hasil", !composeSection(pJurnal, "nataij").markdown.includes("يتأثر بعوامل متداخلة"));
cek("T-04 khatima tanpa kesimpulan karangan", !composeSection(pJurnal, "khatima").markdown.includes("ظاهرة متعددة الأبعاد لا تُفسَّر بعامل واحد"));

// T-06: judul tercetak mengikuti struktur efektif, termasuk judul kustom.
cek("T-06 keterbatasan memakai heading struktur", composeSection(pJurnal, "keterbatasan").markdown.startsWith("## حدود البحث"));
cek("T-06 pernyataan etik memakai heading lengkap", composeSection(pJurnal, "pernyataanEtik").markdown.startsWith("## الإفصاح عن تضارب المصالح وتوفر البيانات"));
const daftarKustom = susunDaftarIsiBawaan(pJurnal).map((b) => ({
  ...b,
  sections: b.sections.map((s) => (s.id === "keterbatasan" ? { ...s, labelAr: "حدود الدراسة" } : s)),
}));
const pKustom = { ...pJurnal, daftarIsi: daftarKustom };
cek("T-06 judul kustom daftar isi terbawa ke susunan", composeSection(pKustom, "keterbatasan").markdown.startsWith("## حدود الدراسة"));

// T-07: daftar semua desain tidak lagi ditampilkan sebagai desain terpilih.
const manhaj = composeSection(pKual, "manhajNau").markdown;
cek("T-07 manhajNau memakai placeholder desain", manhaj.includes("[اذكر التصميم الذي اخترته") && !manhaj.includes("البحث الإثنوغرافي") && !manhaj.includes("المنهج الفينومينولوجي"));
const tariqa = composeSection(pJurnal, "tariqa").markdown;
cek("T-07 tariqa memakai placeholder desain", tariqa.includes("[اذكر تصميم البحث المعتمد") && !tariqa.includes("دراسة الحالة"));

// T-08: label hasil yang diharapkan tidak lagi mengambil rumusan terakhir.
const pIthar = newProject({ jenis: "skripsi", rumusan: ["سؤال أول؟", "سؤال أخير مميز؟"], ...dasar });
const itharFikri = composeSection(pIthar, "itharFikri").markdown;
cek("T-08 hasil yang diharapkan menjadi placeholder", itharFikri.includes("[اكتب التوقع الذي ترجحه لسؤال البحث الأخير]") && !itharFikri.includes("سؤال أخير مميز؟"));

// T-09: instruksi internal tidak masuk naskah kata kunci.
const kataKunci = composeSection(pJurnal, "kataKunciArtikel").markdown;
cek("T-09 kata kunci bersih dari instruksi internal", !kataKunci.includes("Kata kunci dipilih dari") && !kataKunci.includes("research topic; Islamic studies") && kataKunci.includes("[اختر الكلمات المفتاحية"));

// T-10: pipa di sel tabel di-escape dan parser membacanya kembali utuh.
cek("T-10 sel tabel di-escape", bersihSelTabel("a|b\\c") === "a\\|b\\\\c");
assert.deepEqual(pecahBarisTabel("| أ | ب\\|ج | د\\\\ه |"), ["أ", "ب|ج", "د\\ه"]);
cek("T-10 baris tabel terbaca kembali utuh", true);
const pIstilah = newProject({
  jenis: "skripsi",
  ...dasar,
  istilah: [{ id: "i1", id_label: "istilah | khusus", ar: "مصطلح | خاص" }],
});
const barisIstilah = composeSection(pIstilah, "mustalahat").markdown.split("\n").find((b) => b.includes("istilah"));
cek("T-10 tabel istilah tetap dua kolom", !!barisIstilah && pecahBarisTabel(barisIstilah).length === 2 && barisIstilah.includes("istilah \\| khusus"));

console.log(`\n${lulus} uji audit M1 lulus semua`);
