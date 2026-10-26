// Uji daftar isi dari pedoman: parser outline + penerapan ke struktur proyek.
import { parseOutlinePedoman, parseOutlineTempelan } from "../lib/engine/daftar-isi-pedoman";
import { migrasiProyek, newProject, type Project } from "../lib/engine/project";
import { strukturProyek } from "../lib/content/struktur";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (!ok) gagal++;
};

const PEDOMAN_MD = `# Pedoman Penulisan Ma'had Aly Contoh
## Format Naskah
- Font Arab: Traditional Arabic 16 pt
## Sitasi
- Gaya: catatan kaki
## Daftar Isi (Sistematika Penulisan)
- BAB I PENDAHULUAN
  - Latar Belakang
  - Rumusan Masalah
  - Tujuan Penelitian
- BAB II KERANGKA TEORI
  - Pengertian Sorogan
  - Landasan Teori
    - Pengertian Kitab Kuning
    - Metode Sorogan dalam Tradisi Pesantren
- BAB III PENUTUP
  - Kesimpulan
  - Saran
## Aturan lain
- Judul memakai huruf kapital`;

// 1) Parse dari bagian pedoman
const dariPedoman = parseOutlinePedoman(PEDOMAN_MD);
cek("pedoman: 3 bab terbaca", dariPedoman?.length === 3, `${dariPedoman?.length}`);
cek("pedoman: sub-bab bab I = 3", dariPedoman?.[0].sections.length === 3);
cek("pedoman: fasal tingkat 3 terbaca", dariPedoman?.[1].sections[1].anak?.length === 2);
cek("pedoman: babAr ordinal", dariPedoman?.[1].babAr === "الباب الثاني", dariPedoman?.[1].babAr);

// 2) Pedoman tanpa bagian daftar isi -> null
cek("pedoman tanpa seksi -> null", parseOutlinePedoman("# Pedoman\n## Format Naskah\n- Font: Amiri") === null);
cek("pedoman 'tidak disebut' -> null", parseOutlinePedoman("## Daftar Isi\ntidak disebut") === null);

// 3) Tempelan desimal
const tempelan = `1. Pendahuluan
1.1 Latar Belakang
1.2 Rumusan Masalah
2. Pembahasan
2.1 Hasil
2.1.1 Analisis Data`;
const dariTempel = parseOutlineTempelan(tempelan);
cek("tempelan desimal: 2 bab", dariTempel?.length === 2);
cek("tempelan desimal: fasal dari 2.1.1", dariTempel?.[1].sections[0].anak?.length === 1);

// 4) Tempelan Arab
const arab = `الباب الأول المقدمة
  خلفية البحث
  أسئلة البحث
الباب الثاني الخاتمة
  الخلاصة`;
const dariArab = parseOutlineTempelan(arab);
cek("tempelan Arab: 2 bab & labelAr terisi", dariArab?.length === 2 && (dariArab?.[0].labelAr.length ?? 0) > 0);

// 5) Hasil parse lolos sanitasi migrasi & dipakai strukturProyek
const p: Project = newProject({ jenis: "skripsi", metode: "kualitatif", bidangId: "bahasa", judulAr: "x" });
const mentah = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
mentah.daftarIsi = dariPedoman;
const mig = migrasiProyek(mentah as never);
cek("sanitasi mempertahankan daftar isi pedoman", mig.daftarIsi?.length === 3 && (mig.daftarIsi?.[1].sections[1].anak?.length ?? 0) === 2);
const st = strukturProyek(mig);
cek("strukturProyek memakai 3 bab pedoman", st.chapters.length === 3 && st.chapters[0].sections.length === 3);
cek("fasal diratakan tingkat 2 di struktur", st.chapters[1].sections.some((s) => s.tingkat === 2));

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
