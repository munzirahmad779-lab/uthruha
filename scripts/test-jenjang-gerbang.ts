// Uji: struktur per jenjang sungguh berbeda + gerbang mutu + pemeriksa gabungan.
import { getStruktur } from "../lib/content/struktur";
import { periksaGerbang } from "../lib/engine/gerbang-mutu";
import { periksaSitasi } from "../lib/engine/periksa-sitasi";
import { newProject } from "../lib/engine/project";
import { sumberBaru } from "../lib/engine/cite";
import assert from "node:assert";

let lulus = 0;
const cek = (n: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"} ${n}`); assert(ok, n); lulus++; };

const ids = (j: "skripsi" | "tesis" | "disertasi" | "jurnal") =>
  new Set(getStruktur(j).chapters.flatMap((c) => c.sections.map((s) => s.id)));
const total = (j: "skripsi" | "tesis" | "disertasi" | "jurnal") =>
  getStruktur(j).chapters.flatMap((c) => c.sections).reduce((a, s) => a + (s.targetKata ?? 0), 0);

cek("skripsi tanpa kontribusi/kebaruan", !ids("skripsi").has("kontribusi") && !ids("skripsi").has("kebaruan"));
cek("tesis punya kontribusi + sintesisTeori, tanpa kebaruan", ids("tesis").has("kontribusi") && ids("tesis").has("sintesisTeori") && !ids("tesis").has("kebaruan"));
cek("disertasi punya kebaruan + petaJalan", ids("disertasi").has("kebaruan") && ids("disertasi").has("petaJalan"));
cek("target kata naik per jenjang", total("skripsi") < total("tesis") && total("tesis") < total("disertasi"));
cek("disertasi >= 45 rb kata", total("disertasi") >= 45000);
cek("jurnal punya abstrakEn + kepatuhan", ids("jurnal").has("abstrakEn") && ids("jurnal").has("keterbatasan") && ids("jurnal").has("pernyataanEtik"));
cek("jurnal 5–8,5 rb kata", total("jurnal") >= 5000 && total("jurnal") <= 8500);

// Gerbang: proyek kosong pasti belum lolos; syarat khas jenjang muncul.
const p0 = newProject({ jenis: "skripsi" });
const g0 = periksaGerbang(p0);
cek("proyek kosong belum lolos gerbang", !g0.lolos);
cek("gerbang skripsi punya syarat sumber 15", g0.syarat.some((s) => s.id === "sumber" && s.label.includes("15")));
const pD = newProject({ jenis: "disertasi" });
const gD = periksaGerbang(pD);
cek("gerbang disertasi menuntut kebaruan + kitab", gD.syarat.some((s) => s.id === "wajib-kebaruan") && gD.syarat.some((s) => s.id === "kitab"));
const pJ = newProject({ jenis: "jurnal" });
cek("gerbang jurnal menuntut kemutakhiran + abstrakEn", periksaGerbang(pJ).syarat.some((s) => s.id === "mutakhir") && periksaGerbang(pJ).syarat.some((s) => s.id === "wajib-abstrakEn"));

// Pemeriksa gabungan: jalur warisan + abaikan + hitungan sehat.
const s1 = { ...sumberBaru("artikel"), id: "s-art", judul: "Artikel Uji", penulis: "Penguji, A.", tahun: "2024", halaman: "1-9" };
const teksPanjang = "Klaim pertama dengan sitasi [[ref:s-art|hlm:3]] yang sehat dan cukup panjang untuk dianggap draf. Ada footnote lama [^7] tanpa definisi di bagian ini.";
const p1 = { ...newProject({ jenis: "skripsi" }), sumber: [s1], draf: { khalfiya: teksPanjang } };
const h1 = periksaSitasi(p1);
cek("penanda sehat terhitung", h1.penandaSehat === 1 && h1.penandaTotal === 1);
cek("warisan [^7] tanpa definisi tertangkap", h1.masalah.some((m) => m.jenis === "warisan" && (m.kunciAbaikan ?? "") === "fn:7"));
const p2 = { ...p1, abaikanSitasi: ["fn:7"] };
cek("abaikan fn:7 menekan temuan warisan", !periksaSitasi(p2).masalah.some((m) => m.jenis === "warisan"));
const p3 = { ...p1, draf: { khalfiya: "Teks cukup panjang dengan penanda yatim [[ref:hilang|hlm:1]] di dalamnya untuk diuji." } };
cek("tak-dikenal tetap tertangkap", periksaSitasi(p3).masalah.some((m) => m.jenis === "tak-dikenal"));
const p4 = { ...p3, abaikanSitasi: ["hilang"] };
cek("abaikan id menekan tak-dikenal", !periksaSitasi(p4).masalah.some((m) => m.jenis === "tak-dikenal"));

console.log(`\n${lulus} uji lulus semua`);
