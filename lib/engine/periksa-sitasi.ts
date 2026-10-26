// lib/engine/periksa-sitasi.ts
// Pemeriksa sitasi sebelum ekspor: menemukan penanda yang rujukannya sudah
// terhapus, sitasi tanpa halaman, dan rujukan terpakai yang belum diverifikasi.
// Murni deterministik dari isi proyek — tanpa AI.

import type { Project } from "@/lib/engine/project";
import { strukturProyek } from "@/lib/content/struktur";
import { composeSection } from "@/lib/engine/compose";

export type JenisMasalah = "tak-dikenal" | "tanpa-halaman" | "belum-verifikasi";

export interface MasalahSitasi {
  jenis: JenisMasalah;
  pesan: string;
  sectionId?: string;
  labelBagian?: string;
}

export interface HasilPeriksa {
  masalah: MasalahSitasi[];
  jumlahSitasi: number;
  jumlahSumberTakTerpakai: number;
}

const POLA = /\[\[ref:([^\]|]+)(?:\|hlm:([^\]|]*))?(?:\|jilid:([^\]]*))?\]\]/g;

export function periksaSitasi(p: Project): HasilPeriksa {
  const perId = new Map(p.sumber.map((s) => [s.id, s]));
  const st = strukturProyek(p);
  const masalah: MasalahSitasi[] = [];
  const terpakai = new Set<string>();
  const kutipanPertama = new Map<string, { sectionId: string; labelBagian: string }>();
  let jumlahSitasi = 0;

  for (const c of st.chapters) {
    for (const s of c.sections) {
      const labelBagian = `${c.labelId} — ${s.labelId}`;
      const draf = p.draf[s.id];
      const teksS = draf && draf.trim().length > 20 ? draf : composeSection(p, s.id).markdown;
      for (const m of teksS.matchAll(POLA)) {
        const id = (m[1] ?? "").trim();
        const hlm = (m[2] ?? "").trim();
        const sumber = perId.get(id);
        if (!sumber) {
          masalah.push({
            jenis: "tak-dikenal",
            pesan: `Ada penanda sitasi yang rujukannya sudah tidak ada di daftar referensi (${id}) — footnote-nya tidak akan terbentuk saat ekspor.`,
            sectionId: s.id,
            labelBagian,
          });
          continue;
        }
        jumlahSitasi++;
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

  return {
    masalah,
    jumlahSitasi,
    jumlahSumberTakTerpakai: p.sumber.filter((s) => !terpakai.has(s.id)).length,
  };
}
