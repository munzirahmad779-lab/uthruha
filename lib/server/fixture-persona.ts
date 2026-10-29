/**
 * Delapan persona mahasiswa dummy untuk audit Kitabah (cabang uji-persona).
 *
 * Persona mengikuti 8 peran pada audit Cue 29 Okt 2026. Semua identitas
 * rekaan (@uji.local), tanpa data mahasiswa sungguhan. Enam lapis gratis
 * dan dua premium (Dewi: butuh direktori + ekspor; Agus: sensitif harga,
 * untuk memeriksa tampilan Premium tanpa membayar). Premium fixture
 * berlaku 30 hari sejak pertama dibuat.
 *
 * Provisioning bersifat idempoten dan malas: pengguna dibuat saat pertama
 * diminta (login uji atau header x-uji-user), di store lokal mode uji.
 */
import { semua, simpan } from "./store";
import type { Pengguna } from "./identitas";

export interface PersonaUji {
  /** Nama fixture untuk header x-uji-user dan tombol masuk. */
  namaUji: string;
  /** Id rekam pengguna. */
  id: string;
  /** Nama tampilan di ruang kerja. */
  nama: string;
  tier: "gratis" | "premium";
  /** Peran audit yang diwakili persona ini. */
  peran: string;
}

export const PERSONA_UJI: PersonaUji[] = [
  { namaUji: "UJI-RAFI", id: "uji-rafi", nama: "Rafi (uji)", tier: "gratis", peran: "Nol dasar, HP saja" },
  { namaUji: "UJI-SINTA", id: "uji-sinta", nama: "Sinta (uji)", tier: "gratis", peran: "Pemburu footnote" },
  { namaUji: "UJI-FAJAR", id: "uji-fajar", nama: "Fajar (uji)", tier: "gratis", peran: "Penulis buntu" },
  { namaUji: "UJI-NADIA", id: "uji-nadia", nama: "Nadia (uji)", tier: "gratis", peran: "Verifikator DOI" },
  { namaUji: "UJI-BIMA", id: "uji-bima", nama: "Bima (uji)", tier: "gratis", peran: "Terburu-buru, komputer bersama" },
  { namaUji: "UJI-DEWI", id: "uji-dewi", nama: "Dewi (uji)", tier: "premium", peran: "Butuh jurnal + ekspor .docx" },
  { namaUji: "UJI-AGUS", id: "uji-agus", nama: "Agus (uji)", tier: "premium", peran: "Pekerja paruh waktu, sensitif harga" },
  { namaUji: "UJI-LINA", id: "uji-lina", nama: "Lina (uji)", tier: "gratis", peran: "Hati-hati data dan legal" },
];

export function personaDariNamaUji(namaUji: string): PersonaUji | null {
  return PERSONA_UJI.find((p) => p.namaUji === namaUji) ?? null;
}

/** Buat rekam pengguna fixture yang belum ada; kembalikan rekam persona. */
export async function pastikanPersonaUji(persona: PersonaUji): Promise<Pengguna> {
  const ada = (await semua("pengguna")).find((p) => p.id === persona.id);
  if (ada) return ada as unknown as Pengguna;
  const rekam: Pengguna = {
    id: persona.id,
    email: `${persona.id}@uji.local`,
    nama: persona.nama,
    foto: "",
    tier: persona.tier,
    premiumSampai:
      persona.tier === "premium"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    dibuat: new Date().toISOString(),
    namaUji: persona.namaUji,
  };
  await simpan("pengguna", rekam as unknown as Record<string, unknown> & { id: string });
  return rekam;
}

/** Provisioning semua persona sekaligus (dipakai panel masuk uji). */
export async function pastikanSemuaPersonaUji(): Promise<void> {
  for (const p of PERSONA_UJI) await pastikanPersonaUji(p);
}
