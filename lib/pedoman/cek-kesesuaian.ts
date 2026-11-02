/**
 * PENANDA KESESUAIAN TEMPLATE (perintah pemilik, 3 Nov 2026): pemeriksa
 * aturan pasti yang berjalan LOKAL di peramban, tanpa panggilan API/AI.
 * Membandingkan daftar isi proyek dengan template pedoman yang dipilih
 * (data wajib + susunan di lib/pedoman/template-pedoman.ts) dan menandai
 * penyimpangan begitu terjadi:
 *  - sub-bab WAJIB template tidak ada di daftar isi (wajib),
 *  - urutan sub-bab dalam satu bab menyimpang dari template (wajib),
 *  - sub-bab wajib masih kosong sementara bagian sesudahnya sudah terisi
 *    (info: kemungkinan terlewat),
 *  - sub-bab tambahan di luar template (info: boleh, catat saja),
 *  - aturan terhitung mesin, misalnya rujukan Mangkoso minimal 30 (info).
 * Bagian yang dinyatakan selesai di luar Kitabah (bagianDiLuar) berada di
 * luar lingkup pemeriksaan dan tidak pernah ditandai.
 */
import type { Project } from "@/lib/engine/project";

export interface TandaKesesuaian {
  tingkat: "wajib" | "info";
  pesan: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

interface SubTemplate {
  babNama: string;
  nama: string;
  wajib: boolean;
}

interface SubProyek {
  babLabel: string;
  id: string;
  label: string;
}

export function cekKesesuaian(p: Project): TandaKesesuaian[] {
  const tpl = p.strukturPedoman;
  if (!tpl || !p.daftarIsi || p.daftarIsi.length === 0) return [];

  const tanda: TandaKesesuaian[] = [];
  const diLuar = new Set(p.bagianDiLuar ?? []);

  const subTpl: SubTemplate[] = [...tpl.bab]
    .sort((a, b) => a.nomor - b.nomor)
    .flatMap((b) => b.subBab.map((s) => ({ babNama: b.nama, nama: s.nama, wajib: s.wajib })));

  const subProyek: SubProyek[] = p.daftarIsi.flatMap((b) => [
    ...b.sections.map((s) => ({ babLabel: b.labelId, id: s.id, label: s.labelId })),
    ...b.sections.flatMap((s) =>
      (s.anak ?? []).map((a) => ({ babLabel: b.labelId, id: a.id, label: a.labelId })),
    ),
  ]);

  const indeksProyek = new Map<string, number>();
  subProyek.forEach((s, i) => {
    const k = norm(s.label);
    if (!indeksProyek.has(k)) indeksProyek.set(k, i);
  });
  const labelTpl = new Set(subTpl.map((s) => norm(s.nama)));

  // 1) Sub-bab wajib yang hilang + urutan per bab.
  const perBab = new Map<string, SubTemplate[]>();
  for (const s of subTpl) {
    const arr = perBab.get(s.babNama) ?? [];
    arr.push(s);
    perBab.set(s.babNama, arr);
  }
  for (const [babNama, subs] of perBab) {
    let idxSebelumnya = -1;
    let urutanRusak = false;
    for (const s of subs) {
      const idx = indeksProyek.get(norm(s.nama));
      if (idx === undefined) {
        if (s.wajib) {
          tanda.push({
            tingkat: "wajib",
            pesan: `Sub-bab wajib "${s.nama}" pada ${babNama} tidak ada di daftar isi proyek. Tambahkan kembali dari tab Struktur, atau tandai bagian ini selesai di luar bila memang dikerjakan di luar Kitabah.`,
          });
        }
        continue;
      }
      const idProyek = subProyek[idx]!.id;
      if (diLuar.has(idProyek)) continue; // di luar lingkup
      if (idx < idxSebelumnya) urutanRusak = true;
      idxSebelumnya = Math.max(idxSebelumnya, idx);
    }
    if (urutanRusak) {
      tanda.push({
        tingkat: "wajib",
        pesan: `Urutan sub-bab pada ${babNama} menyimpang dari susunan pedoman. Kembalikan urutannya mengikuti template.`,
      });
    }
  }

  // 2) Sub-bab wajib kosong yang terlewati (bagian sesudahnya sudah terisi).
  const terisi = (id: string) => (p.draf[id] ?? "").trim().length > 80;
  const urutanTpl = subTpl
    .map((s) => ({ s, idx: indeksProyek.get(norm(s.nama)) }))
    .filter((x) => x.idx !== undefined)
    .map((x) => ({ ...x, id: subProyek[x.idx!]!.id }))
    .filter((x) => !diLuar.has(x.id));
  for (let i = 0; i < urutanTpl.length; i++) {
    const kini = urutanTpl[i]!;
    if (!kini.s.wajib) continue;
    if (terisi(kini.id)) continue;
    if (urutanTpl.slice(i + 1).some((x) => terisi(x.id))) {
      tanda.push({
        tingkat: "info",
        pesan: `Sub-bab wajib "${kini.s.nama}" masih kosong, sementara bagian sesudahnya sudah terisi. Periksa apakah bagian ini terlewat.`,
      });
    }
  }

  // 3) Sub-bab tambahan di luar template.
  let tambahan = 0;
  for (const s of subProyek) {
    if (diLuar.has(s.id)) continue;
    if (!labelTpl.has(norm(s.label))) {
      tambahan += 1;
      if (tambahan <= 10) {
        tanda.push({
          tingkat: "info",
          pesan: `Sub-bab tambahan di luar template: "${s.label}" pada ${s.babLabel}. Boleh dipakai selama sesuai persetujuan pembimbing.`,
        });
      }
    }
  }

  // 4) Aturan terhitung: rujukan Mangkoso tidak kurang dari 30 sumber.
  if (/mangkoso/i.test(tpl.namaPedoman) && p.sumber.length < 30) {
    tanda.push({
      tingkat: "info",
      pesan: `Pedoman Mangkoso mewajibkan rujukan tidak kurang dari 30 sumber; proyek ini baru mencatat ${p.sumber.length}. Angka ini wajar di awal, wajib terpenuhi menjelang selesai.`,
    });
  }

  return tanda;
}
