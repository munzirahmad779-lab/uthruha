/**
 * Bank rujukan bersama (keputusan pemilik, 30 Okt 2026).
 *
 * Setiap Generate Footnote yang berhasil mencari rujukan baru di web
 * menyimpan hasilnya di sini, dipakai bersama oleh SEMUA pengguna: paragraf
 * atau kalimat kunci yang sama pada mahasiswa lain tidak perlu memanggil
 * AI dan mencari ulang. Yang dibagikan hanya data bibliografi rujukan
 * (judul, penulis, DOI — data publik) plus kalimat kunci pencarinya;
 * teks paragraf mahasiswa TIDAK pernah dibagikan ke pengguna lain, sidik
 * paragraf hanya disimpan sebagai hash untuk mengenali paragraf yang
 * persis sama (umum terjadi pada draf susunan mesin yang memakai templat
 * dan bank frasa yang sama).
 *
 * Penyimpanan: koleksi "tembolok" pada store generik (Supabase di
 * produksi). Dua jenis rekam:
 *  - `bank:<hash>` — kalimat kunci ternormalisasi → daftar rujukan hasil
 *    pencarian terverifikasi.
 *  - `par:<hash>` — sidik paragraf ternormalisasi → kalimat kunci yang
 *    pernah dihasilkan AI untuk paragraf itu.
 *
 * Pengelolaan malam hari (kelolaBank, dipanggil /api/kron/bank-rujukan):
 * dedupe rujukan per DOI/judul, buang rekam kosong dan sidik paragraf
 * kedaluwarsa, batasi ukuran bank.
 */
import { ambil, hapus, perbarui, simpan, semua, type Rekam } from "./store";
import { tokenJudul, type RujukanTamu } from "./rujukan";

export interface RekamBank extends Rekam {
  tipe: "bank";
  frasa: string[];
  rujukan: RujukanTamu[];
  pakai: number;
  dibuat: string;
  terakhir: string;
}

export interface RekamParagraf extends Rekam {
  tipe: "par";
  kalimatKunci: string[];
  pakai: number;
  dibuat: string;
  terakhir: string;
}

function hashTeks(teks: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < teks.length; i++) {
    const ch = teks.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/** Kunci bank dari kalimat kunci: gabungan token batang kata, terurut. */
export function kunciBankDari(kalimatKunci: string[]): string {
  const token = new Set<string>();
  for (const k of kalimatKunci) for (const t of tokenJudul(k)) token.add(t);
  return hashTeks([...token].sort().join(" "));
}

/** Sidik paragraf: teks ternormalisasi (huruf kecil, tanpa tanda baca). */
export function sidikParagraf(paragraf: string): string {
  const normal = paragraf
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return hashTeks(normal);
}

export async function cariDiBank(kalimatKunci: string[]): Promise<RekamBank | null> {
  const id = `bank:${kunciBankDari(kalimatKunci)}`;
  const rec = (await ambil("tembolok", id)) as RekamBank | null;
  if (!rec || rec.tipe !== "bank" || !Array.isArray(rec.rujukan) || rec.rujukan.length === 0) {
    return null;
  }
  void perbarui("tembolok", id, {
    pakai: (rec.pakai ?? 0) + 1,
    terakhir: new Date().toISOString(),
  }).catch(() => undefined);
  return rec;
}

export async function simpanKeBank(kalimatKunci: string[], rujukan: RujukanTamu[]): Promise<void> {
  if (kalimatKunci.length === 0 || rujukan.length === 0) return;
  const id = `bank:${kunciBankDari(kalimatKunci)}`;
  const kini = new Date().toISOString();
  const lama = (await ambil("tembolok", id)) as RekamBank | null;
  await simpan("tembolok", {
    id,
    tipe: "bank",
    frasa: kalimatKunci,
    rujukan,
    pakai: (lama?.pakai ?? 0) + 1,
    dibuat: lama?.dibuat ?? kini,
    terakhir: kini,
  } satisfies RekamBank);
}

export async function cariSidikParagraf(paragraf: string): Promise<RekamParagraf | null> {
  const id = `par:${sidikParagraf(paragraf)}`;
  const rec = (await ambil("tembolok", id)) as RekamParagraf | null;
  if (!rec || rec.tipe !== "par" || !Array.isArray(rec.kalimatKunci) || rec.kalimatKunci.length === 0) {
    return null;
  }
  void perbarui("tembolok", id, {
    pakai: (rec.pakai ?? 0) + 1,
    terakhir: new Date().toISOString(),
  }).catch(() => undefined);
  return rec;
}

export async function simpanSidikParagraf(paragraf: string, kalimatKunci: string[]): Promise<void> {
  if (kalimatKunci.length === 0) return;
  const id = `par:${sidikParagraf(paragraf)}`;
  const kini = new Date().toISOString();
  const lama = (await ambil("tembolok", id)) as RekamParagraf | null;
  await simpan("tembolok", {
    id,
    tipe: "par",
    kalimatKunci,
    pakai: (lama?.pakai ?? 0) + 1,
    dibuat: lama?.dibuat ?? kini,
    terakhir: kini,
  } satisfies RekamParagraf);
}

const UMUR_SIDIK_MS = 90 * 24 * 60 * 60 * 1000; // sidik paragraf: 90 hari
const MAKS_BANK = 3000;

export interface HasilKelolaBank {
  bankDicek: number;
  paragrafDicek: number;
  rujukanDuplikatDibuang: number;
  rekamDihapus: number;
}

/** Pengelolaan malam hari: dedupe, buang yang basi/kosong, batasi ukuran. */
export async function kelolaBank(): Promise<HasilKelolaBank> {
  const semuaRekam = await semua("tembolok");
  const hasil: HasilKelolaBank = {
    bankDicek: 0,
    paragrafDicek: 0,
    rujukanDuplikatDibuang: 0,
    rekamDihapus: 0,
  };
  const kini = Date.now();
  const bankHidup: RekamBank[] = [];

  for (const rec of semuaRekam) {
    if (rec.tipe === "bank") {
      hasil.bankDicek += 1;
      const bank = rec as unknown as RekamBank;
      const lihat = new Set<string>();
      const unik: RujukanTamu[] = [];
      for (const r of Array.isArray(bank.rujukan) ? bank.rujukan : []) {
        const k = (r.doi ?? r.isbn ?? r.judul ?? "").toLowerCase().trim();
        if (!k || lihat.has(k)) {
          hasil.rujukanDuplikatDibuang += 1;
          continue;
        }
        lihat.add(k);
        unik.push(r);
      }
      if (unik.length === 0) {
        await hapus("tembolok", rec.id);
        hasil.rekamDihapus += 1;
        continue;
      }
      if (unik.length !== (bank.rujukan?.length ?? 0)) {
        await simpan("tembolok", { ...bank, rujukan: unik });
      }
      bankHidup.push({ ...bank, rujukan: unik });
    } else if (rec.tipe === "par") {
      hasil.paragrafDicek += 1;
      const par = rec as unknown as RekamParagraf;
      const dibuat = Date.parse(par.dibuat ?? "");
      if (!Array.isArray(par.kalimatKunci) || par.kalimatKunci.length === 0 ||
          (Number.isFinite(dibuat) && kini - dibuat > UMUR_SIDIK_MS)) {
        await hapus("tembolok", rec.id);
        hasil.rekamDihapus += 1;
      }
    }
  }

  // Batas ukuran: buang bank yang paling jarang dipakai & paling lama diam.
  if (bankHidup.length > MAKS_BANK) {
    const terurut = [...bankHidup].sort(
      (a, b) =>
        (a.pakai ?? 0) - (b.pakai ?? 0) ||
        Date.parse(a.terakhir ?? "") - Date.parse(b.terakhir ?? ""),
    );
    for (const korban of terurut.slice(0, bankHidup.length - MAKS_BANK)) {
      await hapus("tembolok", korban.id);
      hasil.rekamDihapus += 1;
    }
  }
  return hasil;
}
