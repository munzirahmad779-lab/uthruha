// Uji fitur pencarian v2: kurasi kalimat kunci + pasang footnote terarah.
import { migrasiProyek, newProject, type Project } from "../lib/engine/project";
import { parseKata, parseKalimat, kataTanpaAI, kalimatTanpaAI } from "../lib/engine/kata-kunci-server";
import { kompilasiMarker } from "../lib/engine/marker";
import { composeNaskah } from "../lib/engine/compose";
import { footnotePedoman } from "../lib/engine/citation";
import { sumberBaru } from "../lib/engine/cite";
import { pedomanDefault } from "../lib/refs/pedoman";
import { getStruktur } from "../lib/content/struktur";

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (!ok) gagal++;
};

// Proyek uji: berpedoman + satu sumber kitab.
const p: Project = newProject({
  jenis: "skripsi",
  metode: "kualitatif",
  bidangId: "bahasa",
  topikAr: "حكم شرب بول الفرس",
  judulAr: "حكم شرب بول الفرس في الفقه الإسلامي",
  rumusan: ["ما تصوير مسألة شرب بول الفرس؟"],
});
p.pedoman = pedomanDefault();
const sumber = {
  ...sumberBaru("kitab"),
  id: "src-uji1",
  penulis: "النووي، يحيى بن شرف",
  judul: "المجموع شرح المهذب",
  kota: "بيروت",
  penerbit: "دار الفكر",
  tahun: "1997",
};
p.sumber = [sumber];

// 1) Parser route
const kata = parseKata('{"kata":[{"ar":"بول الفرس","id":"kencing kuda"},{"ar":"الطهارة","id":"kesucian"}]}');
cek("parseKata", kata?.length === 2 && kata[0].id === "kencing kuda");
const kal = parseKalimat('{"kalimat":[{"teks":"حكم شرب بول الفرس","arti":"Hukum minum kencing kuda","alasan":"frasa khas","peran":"taswir"},{"teks":"أقوال العلماء في بول الفرس","arti":"x","alasan":"y","peran":"salah"}]}');
cek("parseKalimat peran dibetulkan", kal?.length === 2 && kal[1].peran === "aqwal");

// 2) Fallback tanpa AI
cek("kataTanpaAI", kataTanpaAI("Hukum minum kencing kuda dalam hukum Islam dan kencing kuda").length >= 3);
const temp = kalimatTanpaAI("حكم شرب بول الفرس", ["بول الفرس", "الطهارة"]);
cek("kalimatTanpaAI tepat 3 berperan", temp.length === 3 && temp.map((t) => t.peran).join(",") === "taswir,aqwal,tarjih");

// 3) Sanitasi kunciPencarian & temuan lewat migrasi
const mentah = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
mentah.kunciPencarian = {
  "bab-2": {
    kata: ["بول الفرس"],
    kataDipakai: ["بول الفرس"],
    kalimat: [
      { teks: "أ", arti: "", alasan: "", peran: "taswir" },
      { teks: "ب", arti: "", alasan: "", peran: "aqwal" },
      { teks: "ج", arti: "", alasan: "", peran: "tarjih" },
      { teks: "د-keempat-dibuang", arti: "", alasan: "", peran: "taswir" },
      { teks: 123, peran: "taswir" },
    ],
  },
  rusak: "bukan-objek",
};
mentah.temuan = [
  { id: "t1", babId: "bab-2", sumber, kutipan: "نص", dibuat: "2026-10-26" },
  { id: "t2", babId: 42, sumber },
];
const mig = migrasiProyek(mentah as never);
cek("sanitasi kalimat dibatasi 3", mig.kunciPencarian?.["bab-2"]?.kalimat.length === 3);
cek("sanitasi bab rusak dibuang", mig.kunciPencarian?.["rusak"] === undefined);
cek("sanitasi temuan", mig.temuan?.length === 1 && mig.temuan[0].sumber.judul === sumber.judul);

// 4) Pasang footnote: sisip penanda setelah kalimat ke-2 lalu kompilasi
function pecah(paragraf: string): string[] {
  return paragraf.split(/(?<=[.؟!؛])\s+/u).map((s) => s.trim()).filter(Boolean);
}
function sisip(paragraf: string, idx: number, sisipan: string): string {
  const parts = pecah(paragraf);
  parts[Math.min(idx, parts.length - 1)] += sisipan;
  return parts.join(" ");
}
const paragrafAsli = "الجملة الأولى في الفقرة. الجملة الثانية هنا. الجملة الثالثة أخيرة.";
const tersisip = sisip(paragrafAsli, 1, ` [[ref:${sumber.id}|hlm:137]]`);
cek("penanda setelah kalimat 2", tersisip.indexOf("[[ref:") > tersisip.indexOf("الثانية") && tersisip.indexOf("[[ref:") < tersisip.indexOf("الثالثة"));

const sectionId = getStruktur("skripsi").chapters[0].sections[0].id;
const bayangan: Project = { ...p, draf: { ...p.draf, [sectionId]: tersisip } };
const hasil = kompilasiMarker(composeNaskah(bayangan), bayangan);
const teksFn = footnotePedoman(sumber, p.pedoman!, { halaman: "137" });
const cocok = [...hasil.markdown.matchAll(/^\[\^(\d+)\]: (.*)$/gm)].find((m) => m[2] === teksFn);
cek("pratinjau nomor footnote ketemu", !!cocok, cocok ? `nomor ${cocok[1]}: ${teksFn.slice(0, 60)}` : "tidak ketemu");
cek("naskah bebas penanda mentah", !hasil.markdown.includes("[[ref:"));

console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
