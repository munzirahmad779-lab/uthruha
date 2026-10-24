/**
 * QA naskah: menjalankan pemeriksa ortografi pada hasil komposisi nyata
 * (4 jenis × 3 metode) untuk menemukan cacat template — kata terulang,
 * kurung tidak seimbang, tanda baca salah tempat.
 * Jalankan: npx tsx scripts/qa-naskah.ts
 */
import { getStruktur } from "../lib/content/struktur";
import { newProject } from "../lib/engine/project";
import { composeSection } from "../lib/engine/compose";
import { periksaOrtografi } from "../lib/engine/orthografi";

const dasar = newProject({
  jenis: "skripsi",
  metode: "kualitatif",
  bidangId: "bahasa",
  topikAr: "تعليم المحادثة في المعاهد الإسلامية",
  judulAr: "فاعلية طريقة المحاورة في تنمية مهارة الكلام",
  lokasi: "معهد دار المعارف",
  populasi: "طلاب الصف الثاني",
  fenomenaAr: "يلاحظ الباحث ضعف الطلاب في المحادثة رغم دراستهم للنحو",
  rumusan: ["كيف يُفهم تعليم المحادثة ويُمارس في المعهد؟"],
});

const jenisList = ["skripsi", "tesis", "disertasi", "jurnal"] as const;
const metodeList = ["kuantitatif", "kualitatif", "mixed"] as const;

const hitung = new Map<string, { aturan: string; saran: string; contoh: string; n: number }>();

for (const jenis of jenisList) {
  for (const metode of metodeList) {
    const p = { ...dasar, jenis, metode };
    for (const ch of getStruktur(jenis).chapters) {
      for (const s of ch.sections) {
        const teks = composeSection(p, s.id, 11).markdown;
        for (const t of periksaOrtografi(teks).temuan) {
          const kunci = t.aturan + "|" + t.kutipan;
          const ada = hitung.get(kunci);
          if (ada) ada.n++;
          else hitung.set(kunci, { aturan: t.aturan, saran: t.saran, contoh: t.kutipan, n: 1 });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Regresi: naskah harus bisa DIREPRODUKSI.
//
// Dulu benih susunan frasa memakai `p.id` yang dibuat dengan Math.random().
// Akibatnya bagian yang sama menghasilkan teks berbeda setiap kali disusun,
// dan cacat template jadi hilang-timbul saat diuji. Proyek yang sama wajib
// menghasilkan naskah yang sama, berapa kali pun disusun.
// ---------------------------------------------------------------------------
let gagalStabil = 0;
for (const jenis of jenisList) {
  const p1 = { ...dasar, id: "p-uji-aaa", jenis };
  const p2 = { ...dasar, id: "p-uji-zzz", jenis };
  for (const ch of getStruktur(jenis).chapters) {
    for (const s of ch.sections) {
      const a = composeSection(p1, s.id, 11).markdown;
      const b = composeSection(p2, s.id, 11).markdown;
      const c = composeSection(p1, s.id, 11).markdown;
      if (a !== b) {
        console.log(`GAGAL naskah stabil: id proyek mengubah isi (${jenis}/${s.id})`);
        gagalStabil++;
      }
      if (a !== c) {
        console.log(`GAGAL naskah stabil: dua kali susun berbeda (${jenis}/${s.id})`);
        gagalStabil++;
      }
    }
  }
}
if (gagalStabil === 0) console.log("PASS naskah stabil (id proyek & pengulangan)");

const daftar = Array.from(hitung.values()).sort((a, b) => b.n - a.n);
console.log(`Jenis temuan unik: ${daftar.length}`);
for (const d of daftar.slice(0, 30)) {
  console.log(`- (${d.n}x) ${d.aturan}: «${d.contoh}» -> ${d.saran}`);
}
