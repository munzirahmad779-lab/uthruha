/**
 * BATAS PERANGKAT PER AKUN (perintah pemilik, 3 Nov 2026):
 *  - gratis  : maksimal 1 perangkat
 *  - premium : maksimal 2 perangkat
 * Mencegah satu akun dipakai bergantian di banyak perangkat berbeda.
 *
 * Penegakan berjalan di pintu masuk (/api/masuk): setiap pemulihan
 * sesi lewat identitas dan setiap penempelan kunci memeriksa sidik
 * perangkat yang dikirim klien (lib/perangkat-klien.ts). Yang disimpan
 * di catatan pengguna hanya sidik hash ID perangkat, bukan ID mentah.
 *
 * Kaidah:
 *  - Perangkat yang sidiknya berada dalam jatah urutan pendaftaran
 *    (indeks < batas lapis saat ini) selalu boleh; cap "terakhir"
 *    diperbarui.
 *  - Perangkat baru didaftarkan bila daftar belum mencapai batas.
 *  - Selain itu ditolak dengan kode BATAS_PERANGKAT. Pemilik dapat
 *    mengosongkan daftar lewat aksi admin "reset-perangkat" (misalnya
 *    mahasiswa berganti HP).
 *  - Akun admin (pemilik) bebas dari batas ini.
 *  - ID perangkat yang tidak terkirim atau bernilai cadangan
 *    "perangkat-tidak-dikenal" TIDAK ditegakkan (klien resmi selalu
 *    mengirimnya; memblokir nilai cadangan akan mengunci peramban
 *    yang menolak penyimpanan).
 */
import { createHash } from "node:crypto";
import { apakahAdmin } from "@/lib/server/admin";
import { tierEfektif, type Pengguna } from "@/lib/server/identitas";
import { simpan } from "@/lib/server/store";

export const BATAS_PERANGKAT_AKUN: Record<string, number> = {
  gratis: 1,
  premium: 2,
};

export function sidikPerangkatAkun(perangkatId: string): string {
  const garam = process.env.UTH_SESI_SECRET?.trim() || "kitabah-perangkat";
  return createHash("sha256")
    .update(`${garam}|perangkat|${perangkatId}`)
    .digest("hex")
    .slice(0, 32);
}

export type HasilSaringPerangkat =
  | { ok: true }
  | { ok: false; batas: number; tier: string };

export function pesanBatasPerangkat(tier: string, batas: number): string {
  if (tier === "premium") {
    return (
      `Akun Premium hanya boleh dipakai pada maksimal ${batas} perangkat, dan batas akun Anda sudah penuh. ` +
      "Perangkat ini belum terdaftar. Hubungi pemilik untuk mengatur ulang perangkat akun Anda."
    );
  }
  return (
    "Akun gratis hanya boleh dipakai pada 1 perangkat, dan perangkat akun Anda sudah terdaftar. " +
    "Perangkat ini belum terdaftar. Bila Anda berganti perangkat, hubungi pemilik untuk mengatur ulang perangkat akun Anda."
  );
}

export async function saringPerangkatAkun(
  pengguna: Pengguna,
  perangkatId: unknown,
): Promise<HasilSaringPerangkat> {
  if (apakahAdmin(pengguna)) return { ok: true };
  if (
    typeof perangkatId !== "string" ||
    perangkatId.length < 8 ||
    perangkatId === "perangkat-tidak-dikenal"
  ) {
    return { ok: true };
  }
  const tier = tierEfektif(pengguna);
  const batas = BATAS_PERANGKAT_AKUN[tier] ?? 1;
  const sidik = sidikPerangkatAkun(perangkatId);
  const daftar = Array.isArray(pengguna.perangkatAkun)
    ? pengguna.perangkatAkun.map((d) => ({ ...d }))
    : [];
  const kini = new Date().toISOString();
  const idx = daftar.findIndex((d) => d.sidik === sidik);
  if (idx >= 0) {
    if (idx >= batas) return { ok: false, batas, tier };
    daftar[idx] = { ...daftar[idx], terakhir: kini };
    await simpan("pengguna", {
      ...pengguna,
      perangkatAkun: daftar,
    } as unknown as Record<string, unknown> & { id: string });
    return { ok: true };
  }
  if (daftar.length >= batas) return { ok: false, batas, tier };
  daftar.push({ sidik, pertama: kini, terakhir: kini });
  await simpan("pengguna", {
    ...pengguna,
    perangkatAkun: daftar,
  } as unknown as Record<string, unknown> & { id: string });
  return { ok: true };
}
