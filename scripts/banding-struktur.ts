import { getStruktur } from "../lib/content/struktur";
import type { KaryaType } from "../lib/content/types";
for (const j of ["skripsi", "tesis", "disertasi", "jurnal"] as KaryaType[]) {
  const st = getStruktur(j);
  const secs = st.chapters.flatMap((c) => c.sections);
  const total = secs.reduce((a, s) => a + (s.targetKata ?? 0), 0);
  console.log(`${j}: ${st.chapters.length} bab, ${secs.length} bagian, total ≈ ${total.toLocaleString("id-ID")} kata`);
  console.log(`  ids: ${secs.map((s) => s.id).join(", ")}`);
}
const dirS = getStruktur("skripsi").chapters.flatMap(c=>c.sections).find(s=>s.id==="dirasat")!;
const dirT = getStruktur("tesis").chapters.flatMap(c=>c.sections).find(s=>s.id==="dirasat")!;
const dirD = getStruktur("disertasi").chapters.flatMap(c=>c.sections).find(s=>s.id==="dirasat")!;
console.log("panduan dirasat berbeda per jenjang:", dirS.panduan !== dirT.panduan && dirT.panduan !== dirD.panduan);
