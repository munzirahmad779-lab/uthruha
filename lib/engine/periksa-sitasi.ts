// lib/engine/periksa-sitasi.ts
// SATU-SATUNYA pemeriksa sitasi Uthruha (hasil gabungan crosscheck lama +
// periksa-sitasi): memeriksa penanda [[ref:…]] pada teks EFEKTIF tiap bagian
// (draf mahasiswa, atau hasil susunan bila draf kosong) — penanda tak dikenal,
// sitasi tanpa halaman, rujukan terpakai belum terverifikasi — DITAMBAH jalur
// warisan footnote [^n] manual dari crosscheck lama (dilabeli heuristik) dan
// daftar abaikan proyek. Murni deterministik — tanpa AI. Ini memeriksa
// KEBERADAAN penanda, bukan kebenaran isi kutipan.

import type { Project } from "@/lib/engine/project";
import { strukturProyek } from "@/lib/content/struktur";
import { composeSection } from "@/lib/engine/compose";

export type JenisMasalah = "tak-dikenal" | "tanpa-halaman" | "belum-verifikasi" | "warisan";

export interface MasalahSitasi {
  jenis: JenisMasalah;
  pesan: string;
  sectionId?: string;
  labelBagian?: string;
  /** Tingkat untuk pewarnaan: tak-dikenal = kritis; warisan pakai-tanpa-def = saran; def-tanpa-pakai = info. */
  tingkat?: "kritis" | "saran" | "info";
  /** Kunci stabil daftar abaikan proyek (id sumber / "fn:<nomor>"). */
  kunciAbaikan?: string;
}

export interface HasilPeriksa {
  masalah: MasalahSitasi[];
  /** Semua kemunculan penanda [[ref:…]] di naskah. */
  penandaTotal: number;
  /** Penanda yang rujukannya dikenal. */
  penandaSehat: number;
  /** Jumlah sitasi sehat (nama lama, dipertahankan untuk pemakai terdahulu). */
  jumlahSitasi: number;
  jumlahSumberTakTerpakai: number;
  sumberTakTerpakaiJudul: string[];
}

const POLA = /\[\[ref:([^\]|]+)(?:\|hlm:([^\]|]*))?(?:\|jilid:([^\]]*))?\]\]/g;
const POLA_DEF = /\[\^([^\]\s]+)\]:/g;
const POLA_PAKAI = /\[\^([^\]\s]+)\](?!:)/g;

export function periksaSitasi(p: Project): HasilPeriksa {
  const perId = new Map(p.sumber.map((s) => [s.id, s]));
  const abaikan = new Set(p.abaikanSitasi ?? []);
  const st = strukturProyek(p);
  const masalah: MasalahSitasi[] = [];
  const terpakai = new Set<string>();
  const kutipanPertama = new Map<string, { sectionId: string; labelBagian: string }>();
  let penandaTotal = 0;
  let penandaSehat = 0;

  for (const c of st.chapters) {
    for (const s of c.sections) {
      const labelBagian = `${c.labelId} — ${s.labelId}`;
      const draf = p.draf[s.id];
      const teksS = draf && draf.trim().length > 20 ? draf : composeSection(p, s.id).markdown;

      // Jalur penanda terkelola [[ref:…]]
      for (const m of teksS.matchAll(POLA)) {
        penandaTotal++;
        const id = (m[1] ?? "").trim();
        const hlm = (m[2] ?? "").trim();
        const sumber = perId.get(id);
        if (!sumber) {
          if (!abaikan.has(id)) {
            masalah.push({
              jenis: "tak-dikenal",
              tingkat: "kritis",
              pesan: `Ada penanda sitasi yang rujukannya sudah tidak ada di daftar referensi (${id}) — footnote-nya tidak akan terbentuk saat ekspor.`,
              sectionId: s.id,
              labelBagian,
              kunciAbaikan: id,
            });
          }
          continue;
        }
        penandaSehat++;
        terpakai.add(id);
        if (!kutipanPertama.has(id)) kutipanPertama.set(id, { sectionId: s.id, labelBagian });
        const butuhHalaman = sumber.jenis === "kitab" || sumber.jenis === "artikel";
        if (butuhHalaman && !hlm && !(sumber.halaman ?? "").trim()) {
          masalah.push({
            jenis: "tanpa-halaman",
            pesan: `Sitasi ke “${sumber.judul}” belum mencantumkan halaman.`,
            sectionId: s.id,
            labelBagian,
          });
        }
      }

      // Jalur warisan: footnote [^n] manual di luar penanda terkelola (heuristik).
      const defs = new Set([...teksS.matchAll(POLA_DEF)].map((x) => x[1]));
      const pakai = new Set([...teksS.matchAll(POLA_PAKAI)].map((x) => x[1]));
      for (const n of pakai) {
        if (!defs.has(n) && !abaikan.has(`fn:${n}`)) {
          masalah.push({
            jenis: "warisan",
            tingkat: "saran",
            pesan: `Kemungkinan sitasi tanpa penanda terkelola: footnote [^${n}] dipakai tetapi definisinya tidak ditemukan di bagian ini — periksa manual.`,
            sectionId: s.id,
            labelBagian,
            kunciAbaikan: `fn:${n}`,
          });
        }
      }
      for (const n of defs) {
        if (!pakai.has(n) && !abaikan.has(`fn:${n}`)) {
          masalah.push({
            jenis: "warisan",
            tingkat: "info",
            pesan: `Definisi footnote [^${n}] tidak dipakai di teks bagian ini.`,
            sectionId: s.id,
            labelBagian,
            kunciAbaikan: `fn:${n}`,
          });
        }
      }
    }
  }

  for (const id of terpakai) {
    const sumber = perId.get(id);
    if (sumber?.perluVerifikasi) {
      const pertama = kutipanPertama.get(id);
      masalah.push({
        jenis: "belum-verifikasi",
        pesan: `Rujukan “${sumber.judul}” sudah dipakai di naskah tetapi masih bertanda perlu verifikasi — periksa edisi & halamannya di situs sumber.`,
        sectionId: pertama?.sectionId,
        labelBagian: pertama?.labelBagian,
      });
    }
  }

  const takTerpakai = p.sumber.filter((s) => !terpakai.has(s.id));
  return {
    masalah,
    penandaTotal,
    penandaSehat,
    jumlahSitasi: penandaSehat,
    jumlahSumberTakTerpakai: takTerpakai.length,
    sumberTakTerpakaiJudul: takTerpakai.map((s) => s.judul || s.id),
  };
}
