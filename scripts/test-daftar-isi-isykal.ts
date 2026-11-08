/**
 * Uji generator daftar isi pola Ma'had (susunDaftarIsiIsykal) sesudah
 * pendalaman kerangka eksplorasi (perintah pemilik 9 Nov 2026): mabhats
 * bab pengurai isykal wajib datang lengkap dengan fashl dan mathlab,
 * bab analisis akhir tetap tanpa anak, id unik di seluruh pohon, dan
 * sanitasiDaftarIsi mempertahankan seluruh anak.
 * TANPA jaringan dan TANPA model.
 * Jalankan: npx tsx scripts/test-daftar-isi-isykal.ts
 */
import { susunDaftarIsiIsykal } from "../lib/content/struktur";
import {
  newProject,
  sanitasiDaftarIsi,
  type BabKustom,
  type SubBabKustom,
} from "../lib/engine/project";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (!ok) gagal++;
};

const RUMUSAN = [
  "ما مفهوم التكامل المعرفي عند أمبو دالي؟",
  "كيف يطبق التكامل بين علوم القرآن وأصول الفقه في مرشد الطلاب؟",
  "ما أثر التكامل المعرفي في تعليم العلوم الشرعية؟",
];

const kumpulId = (subs: SubBabKustom[] | undefined, ke: string[]): void => {
  for (const s of subs ?? []) {
    ke.push(s.id);
    kumpulId(s.anak, ke);
  }
};
const semuaId = (bab: BabKustom[]): string[] => {
  const ke: string[] = [];
  for (const b of bab) {
    ke.push(b.id);
    kumpulId(b.sections, ke);
  }
  return ke;
};
const hitungSimpul = (subs: SubBabKustom[] | undefined): number =>
  (subs ?? []).reduce((acc, s) => acc + 1 + hitungSimpul(s.anak), 0);
const cari = (subs: SubBabKustom[] | undefined, id: string): SubBabKustom | undefined => {
  for (const s of subs ?? []) {
    if (s.id === id) return s;
    const dalam = cari(s.anak, id);
    if (dalam) return dalam;
  }
  return undefined;
};

/* ---------- Susunan proyek 3 isykal ---------- */
const proyek = newProject({ jenis: "skripsi", rumusan: RUMUSAN });
const hasil = susunDaftarIsiIsykal(proyek);
cek("proyek 3 isykal menghasilkan daftar isi", !!hasil);
const babIsykal = (hasil ?? []).filter((b) => typeof b.isykalKe === "number");
cek("tiga bab isykal terbentuk", babIsykal.length === 3, `isykalKe: ${babIsykal.map((b) => b.isykalKe).join(",")}`);

const bab2 = babIsykal.find((b) => b.isykalKe === 1);
cek("Bab 2 (isykal 1) ada", !!bab2);
cek(
  "Bab 2 punya 4 mabhats eksplorasi",
  !!bab2 &&
    bab2.sections.length === 4 &&
    bab2.sections.map((s) => s.id).join(",") ===
      "isykal1-taswir,isykal1-aqwal,isykal1-adilla,isykal1-munaqasha",
  bab2?.sections.map((s) => s.id).join(","),
);

const taswir = cari(bab2?.sections, "isykal1-taswir");
cek(
  "taswir: 3 fashl dengan id berurutan",
  !!taswir &&
    taswir.anak?.length === 3 &&
    taswir.anak.map((f) => f.id).join(",") ===
      "isykal1-taswir-f1,isykal1-taswir-f2,isykal1-taswir-f3",
  taswir?.anak?.map((f) => f.id).join(","),
);
const taswirF1 = cari(bab2?.sections, "isykal1-taswir-f1");
cek(
  "taswir f1: label persis dan 2 mathlab",
  !!taswirF1 &&
    taswirF1.labelAr === "تعريف المسألة وحدودها" &&
    taswirF1.labelId === "Definisi Masalah dan Batasannya" &&
    taswirF1.anak?.length === 2 &&
    taswirF1.anak[0]?.id === "isykal1-taswir-f1-m1" &&
    taswirF1.anak[0]?.labelAr === "المعنى اللغوي للمصطلحات" &&
    taswirF1.anak[1]?.id === "isykal1-taswir-f1-m2" &&
    taswirF1.anak[1]?.labelAr === "المعنى الاصطلاحي للمصطلحات",
);
cek(
  "taswir f2 dan f3 tanpa mathlab",
  cari(bab2?.sections, "isykal1-taswir-f2")?.labelAr === "تحرير محل النزاع" &&
    !cari(bab2?.sections, "isykal1-taswir-f2")?.anak &&
    cari(bab2?.sections, "isykal1-taswir-f3")?.labelAr === "سبب الخلاف في المسألة" &&
    !cari(bab2?.sections, "isykal1-taswir-f3")?.anak,
);

const aqwal = cari(bab2?.sections, "isykal1-aqwal");
cek(
  "aqwal: 3 fashl tanpa mathlab",
  !!aqwal &&
    aqwal.anak?.length === 3 &&
    aqwal.anak.every((f) => !f.anak) &&
    aqwal.anak.map((f) => f.labelAr).join("|") ===
      "القول الأول وأصحابه|القول الثاني وأصحابه|القول الثالث وأصحابه",
  aqwal?.anak?.map((f) => f.labelAr).join(" | "),
);

const adilla = cari(bab2?.sections, "isykal1-adilla");
cek(
  "adilla: 2 fashl, masing-masing 4 mathlab",
  !!adilla &&
    adilla.anak?.length === 2 &&
    adilla.anak.every((f) => f.anak?.length === 4),
);
cek(
  "adilla: mathlab f1 dan f2 sama persis, id f2-m4 benar",
  !!adilla &&
    (adilla.anak?.[0]?.anak ?? []).map((m) => `${m.labelAr}|${m.labelId}`).join(";") ===
      (adilla.anak?.[1]?.anak ?? []).map((m) => `${m.labelAr}|${m.labelId}`).join(";") &&
    cari(bab2?.sections, "isykal1-adilla-f2-m4")?.labelAr === "وجه الاستدلال" &&
    cari(bab2?.sections, "isykal1-adilla-f1-m3")?.labelAr === "الدليل من الإجماع والقياس",
);

const munaqasha = cari(bab2?.sections, "isykal1-munaqasha");
cek(
  "munaqasha: 2 fashl, masing-masing 2 mathlab",
  !!munaqasha &&
    munaqasha.anak?.length === 2 &&
    munaqasha.anak.every((f) => f.anak?.length === 2) &&
    cari(bab2?.sections, "isykal1-munaqasha-f1-m1")?.labelAr === "الاعتراضات الواردة عليها" &&
    cari(bab2?.sections, "isykal1-munaqasha-f2-m2")?.labelAr === "الأجوبة عن الاعتراضات",
);

/* ---------- Bab tengah eksplorasi, bab terakhir analisis ---------- */
const bab3 = babIsykal.find((b) => b.isykalKe === 2);
cek(
  "Bab 3 (isykal 2, bukan terakhir) ikut memakai kerangka eksplorasi beranak",
  !!bab3 && cari(bab3.sections, "isykal2-adilla-f1-m1")?.labelAr === "الدليل من الكتاب",
);
const babAkhirIsykal = babIsykal.find((b) => b.isykalKe === 3);
cek(
  "bab isykal terakhir (analisis): 4 mabhats, semuanya tanpa anak",
  !!babAkhirIsykal &&
    babAkhirIsykal.sections.length === 4 &&
    babAkhirIsykal.sections.every((s) => !s.anak) &&
    babAkhirIsykal.sections[0]?.id === "isykal3-talkhis",
  babAkhirIsykal?.sections.map((s) => s.id).join(","),
);

/* ---------- Id unik di seluruh pohon ---------- */
const ids = hasil ? semuaId(hasil) : [];
cek(
  "semua id di seluruh pohon unik",
  ids.length > 0 && new Set(ids).size === ids.length,
  `${ids.length} simpul`,
);

/* ---------- Sanitasi mempertahankan seluruh anak ---------- */
const salinan = JSON.parse(JSON.stringify(hasil)) as unknown;
const bersih = sanitasiDaftarIsi(salinan);
const hitungTotal = (bab: BabKustom[] | undefined): number =>
  (bab ?? []).reduce((acc, b) => acc + 1 + hitungSimpul(b.sections), 0);
cek(
  "sanitasi: jumlah simpul utuh sesudah saring",
  !!bersih && hitungTotal(bersih) === hitungTotal(hasil ?? undefined),
  `${hitungTotal(bersih)} dari ${hitungTotal(hasil ?? undefined)} simpul`,
);
cek(
  "sanitasi: id terdalam tetap ada dan sama",
  !!bersih &&
    semuaId(bersih).sort().join(",") === ids.slice().sort().join(",") &&
    cari(bersih.find((b) => b.isykalKe === 1)?.sections, "isykal1-adilla-f2-m4")?.labelId ===
      "Sisi Pendalilan",
);

/* ---------- Perilaku lama tidak berubah ---------- */
cek(
  "jenis jurnal tetap null",
  susunDaftarIsiIsykal(newProject({ jenis: "jurnal", rumusan: RUMUSAN })) === null,
);
cek(
  "rumusan kosong tetap null",
  susunDaftarIsiIsykal(newProject({ jenis: "skripsi", rumusan: [] })) === null,
);
const satuIsykal = susunDaftarIsiIsykal(newProject({ jenis: "skripsi", rumusan: [RUMUSAN[0]!] }));
cek(
  "satu isykal tetap pola eksplorasi (bukan analisis) dan kini beranak",
  !!satuIsykal &&
    cari(satuIsykal[1]?.sections, "isykal1-taswir-f1")?.labelAr === "تعريف المسألة وحدودها",
);

/* ---------- Cetak pohon Bab 2 (bukti visual teks) ---------- */
if (bab2) {
  console.log("\nPohon Bab 2 hasil generate:");
  const cetak = (subs: SubBabKustom[], indent: string): void => {
    for (const s of subs) {
      console.log(`${indent}${s.labelAr}`);
      if (s.anak) cetak(s.anak, indent + "  ");
    }
  };
  console.log(bab2.labelAr);
  cetak(bab2.sections, "  ");
}

console.log(gagal === 0 ? "\nSEMUA PASS" : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
