/**
 * Orkestrator Khalfiyah Al-Bahts: Workflow lengkap dari judul hingga narasi.
 */
import {
  type KlasterJudul,
  type ArtikelJurnal,
  type MarajiTurats,
  type HasilKhalfiyah,
  dekonstruksiJudul,
  identifikasiKonsepTurats,
  susunParagrafKhalfiyah,
  susunNarasiLengkap,
  ekstrakResearchGap,
} from "@/lib/engine/khalfiyah";
import {
  agregasiJurnalKlaster,
  cariPersilanganMasalah,
} from "@/lib/refs/adapters/google-scholar";
import { cariRujukan } from "@/lib/refs";
import type { RefHit } from "@/lib/refs/types";

/**
 * Workflow lengkap penyusunan Khalfiyah Al-Bahts.
 */
export async function susunKhalfiyah(judul: string): Promise<HasilKhalfiyah> {
  // Tahap 1: Dekonstruksi judul menjadi 3 klaster (LLM first, heuristik fallback)
  const hasilDekonstruksi = await dekonstruksiJudul(judul);
  const klaster = hasilDekonstruksi.klaster;

  // Tahap 2: Agregasi jurnal per klaster (deterministik web)
  const [artikelK1, artikelK2, artikelK3] = await Promise.all([
    agregasiJurnalKlaster(klaster.klaster1.kalimatKunci, 1, 6),
    agregasiJurnalKlaster(klaster.klaster2.kalimatKunci, 2, 6),
    agregasiJurnalKlaster(klaster.klaster3.kalimatKunci, 3, 6),
  ]);

  const artikel = [...artikelK1, ...artikelK2, ...artikelK3];

  // Tahap 2.5: Analisis persilangan masalah
  const persilanganK1K2 = cariPersilanganMasalah(artikelK1, artikelK2);
  const persilanganK2K3 = cariPersilanganMasalah(artikelK2, artikelK3);

  // Tahap 3: Identifikasi konsep turats yang butuh maraji'
  const konsepTurats = new Set<string>();
  for (const k of [
    ...klaster.klaster1.kalimatKunci,
    ...klaster.klaster2.kalimatKunci,
    ...klaster.klaster3.kalimatKunci,
  ]) {
    const konsep = identifikasiKonsepTurats(k);
    konsep.forEach((x) => konsepTurats.add(x));
  }

  // Tahap 4: Penelusuran maraji' turats untuk konsep yang teridentifikasi
  const maraji: MarajiTurats[] = [];
  const konsepArray = Array.from(konsepTurats).slice(0, 6); // batasi agar tidak overload

  for (const konsep of konsepArray) {
    try {
      const hasil = await cariRujukan({
        sentences: [konsep],
        sources: ["turath", "shamela"],
        mode: "konsep",
        tanpaLLM: true, // gunakan deterministik untuk konsistensi
      });

      // Konversi RefHit ke MarajiTurats
      for (const hit of hasil.hasil.slice(0, 2)) {
        maraji.push({
          konsep,
          namaKitab: hit.kitab,
          pengarang: hit.penulis || "غير معروف",
          jilid: hit.jilid,
          halaman: hit.halaman_cetak,
          kutipan: hit.teks_kutipan.slice(0, 200),
          url: hit.url_sumber,
        });
      }
    } catch (error) {
      console.warn(`Gagal mencari maraji untuk konsep "${konsep}":`, error);
    }
  }

  // Tahap 5: Susun paragraf khalfiyah berdasarkan struktur tri-fokus
  const paragraf = susunParagrafKhalfiyah(klaster, artikel, maraji);

  // Tahap 6: Susun narasi lengkap
  const narasiLengkap = susunNarasiLengkap(paragraf);

  // Tahap 7: Ekstrak research gap
  const researchGap = ekstrakResearchGap(paragraf);

  return {
    judul,
    klaster,
    artikel,
    maraji,
    paragraf,
    narasiLengkap,
    researchGap,
    metodeDekonstruksi: hasilDekonstruksi.metode,
    penyediaDekonstruksi: hasilDekonstruksi.penyedia,
  };
}

/**
 * Versi incremental: susun khalfiyah per tahap untuk UI streaming.
 */
export async function* susunKhalfiyahStreaming(judul: string) {
  // Tahap 1
  yield { tahap: "dekonstruksi", status: "mulai" };
  const hasilDekonstruksi = await dekonstruksiJudul(judul);
  const klaster = hasilDekonstruksi.klaster;
  yield {
    tahap: "dekonstruksi",
    status: "selesai",
    data: { klaster, metode: hasilDekonstruksi.metode, penyedia: hasilDekonstruksi.penyedia },
  };

  // Tahap 2: Klaster 1
  yield { tahap: "agregasi-k1", status: "mulai" };
  const artikelK1 = await agregasiJurnalKlaster(
    klaster.klaster1.kalimatKunci,
    1,
    6,
  );
  yield { tahap: "agregasi-k1", status: "selesai", data: artikelK1 };

  // Tahap 2: Klaster 2
  yield { tahap: "agregasi-k2", status: "mulai" };
  const artikelK2 = await agregasiJurnalKlaster(
    klaster.klaster2.kalimatKunci,
    2,
    6,
  );
  yield { tahap: "agregasi-k2", status: "selesai", data: artikelK2 };

  // Tahap 2: Klaster 3
  yield { tahap: "agregasi-k3", status: "mulai" };
  const artikelK3 = await agregasiJurnalKlaster(
    klaster.klaster3.kalimatKunci,
    3,
    6,
  );
  yield { tahap: "agregasi-k3", status: "selesai", data: artikelK3 };

  const artikel = [...artikelK1, ...artikelK2, ...artikelK3];

  // Tahap 3: Identifikasi konsep
  yield { tahap: "identifikasi-konsep", status: "mulai" };
  const konsepTurats = new Set<string>();
  for (const k of [
    ...klaster.klaster1.kalimatKunci,
    ...klaster.klaster2.kalimatKunci,
    ...klaster.klaster3.kalimatKunci,
  ]) {
    const konsep = identifikasiKonsepTurats(k);
    konsep.forEach((x) => konsepTurats.add(x));
  }
  const konsepArray = Array.from(konsepTurats).slice(0, 6);
  yield {
    tahap: "identifikasi-konsep",
    status: "selesai",
    data: konsepArray,
  };

  // Tahap 4: Penelusuran maraji'
  yield { tahap: "penelusuran-maraji", status: "mulai" };
  const maraji: MarajiTurats[] = [];
  for (const konsep of konsepArray) {
    try {
      const hasil = await cariRujukan({
        sentences: [konsep],
        sources: ["turath", "shamela"],
        mode: "konsep",
        tanpaLLM: true,
      });

      for (const hit of hasil.hasil.slice(0, 2)) {
        maraji.push({
          konsep,
          namaKitab: hit.kitab,
          pengarang: hit.penulis || "غير معروف",
          jilid: hit.jilid,
          halaman: hit.halaman_cetak,
          kutipan: hit.teks_kutipan.slice(0, 200),
          url: hit.url_sumber,
        });
      }
    } catch (error) {
      console.warn(`Gagal mencari maraji untuk konsep "${konsep}":`, error);
    }
  }
  yield { tahap: "penelusuran-maraji", status: "selesai", data: maraji };

  // Tahap 5: Penyusunan paragraf
  yield { tahap: "penyusunan-paragraf", status: "mulai" };
  const paragraf = susunParagrafKhalfiyah(klaster, artikel, maraji);
  yield { tahap: "penyusunan-paragraf", status: "selesai", data: paragraf };

  // Tahap 6: Narasi lengkap
  yield { tahap: "narasi-lengkap", status: "mulai" };
  const narasiLengkap = susunNarasiLengkap(paragraf);
  const researchGap = ekstrakResearchGap(paragraf);
  yield {
    tahap: "narasi-lengkap",
    status: "selesai",
    data: { narasiLengkap, researchGap },
  };

  // Tahap final
  yield {
    tahap: "selesai",
    status: "selesai",
    data: {
      judul,
      klaster,
      artikel,
      maraji,
      paragraf,
      narasiLengkap,
      researchGap,
      metodeDekonstruksi: hasilDekonstruksi.metode,
      penyediaDekonstruksi: hasilDekonstruksi.penyedia,
    } satisfies HasilKhalfiyah,
  };
}
