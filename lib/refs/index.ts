/**
 * Registri adapter + rantai pencarian berantai.
 * Urutan fallback: turath → shamela → ketabonline → usul.
 * Sumber ber-mode `deeplink` tidak menghasilkan kandidat berskor; ia
 * dikembalikan terpisah sebagai "pintu" (tautan buka manual) supaya
 * pengguna tidak mengira ada hasil otomatis yang sebenarnya tidak ada.
 */
import type {
  AsalIstilah,
  ModeCari,
  RefCandidate,
  RefHit,
  SearchRequest,
  SearchResponse,
  SourceId,
  SourceStatus,
} from "@/lib/refs/types";
import { BATAS, SOURCE_INFO } from "@/lib/refs/types";
import { ekstrakKonsep } from "@/lib/refs/konsep";
import { istilahDariParagraf } from "@/lib/refs/llm/istilah";
import * as turath from "@/lib/refs/adapters/turath";
import * as shamela from "@/lib/refs/adapters/shamela";
import * as ketabonline from "@/lib/refs/adapters/ketabonline";
import * as usul from "@/lib/refs/adapters/usul";
import { cariJurnal } from "@/lib/refs/adapters/jurnal";
import { cariArchive } from "@/lib/refs/adapters/archive";
import type { OpsiAdapter } from "@/lib/refs/adapters/http";

export const URUTAN: SourceId[] = ["turath", "shamela", "ketabonline", "usul"];

interface ModulAdapter {
  info: { mode: "api" | "deeplink" };
  cari?: (kalimat: string, opsi: OpsiAdapter) => Promise<RefCandidate[]>;
  /** Hanya Turath yang punya, karena butuh metadata judul bab. */
  cariKonsep?: (konsep: string[], opsi: OpsiAdapter) => Promise<RefCandidate[]>;
  deeplink: (kalimat: string) => RefCandidate;
}

const MODUL: Record<SourceId, ModulAdapter> = {
  turath: turath as unknown as ModulAdapter,
  shamela: shamela as unknown as ModulAdapter,
  ketabonline: ketabonline as unknown as ModulAdapter,
  usul: usul as unknown as ModulAdapter,
};

export { MODUL };

/** Ringkasan kemampuan tiap sumber — ditampilkan apa adanya di UI. */
export function kemampuanSumber(): { id: SourceId; mode: "api" | "deeplink"; nama: string; api: string }[] {
  return URUTAN.map((id) => ({
    id,
    mode: MODUL[id].info.mode,
    nama: SOURCE_INFO[id].nama,
    api: SOURCE_INFO[id].api,
  }));
}

function idUnik(): string {
  return `h-${Math.random().toString(36).slice(2, 9)}`;
}

function kunciKandidat(c: RefCandidate): string {
  return [c.source, c.kitab, c.jilid ?? "", c.halaman_cetak ?? ""].join("|");
}

export async function cariRujukan(req: SearchRequest): Promise<SearchResponse> {
  const mode: ModeCari = req.mode === "konsep" ? "konsep" : "kata";
  const kalimatList = (req.sentences ?? [])
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, BATAS.maksKalimat)
    .map((s) => s.slice(0, BATAS.maksPanjangKalimat));

  const peringatan: string[] = [];
  if (kalimatList.length === 0) {
    return { hasil: [], pintu: [], status: [], peringatan: ["Tidak ada kalimat untuk dicari."], mode };
  }

  const diminta = new Set<SourceId>(req.sources && req.sources.length > 0 ? req.sources : URUTAN);
  const status = new Map<SourceId, SourceStatus>();
  for (const id of URUTAN) {
    status.set(id, {
      source: id,
      mode: MODUL[id].info.mode,
      status: diminta.has(id) ? "lewati" : "lewati",
      jumlah: 0,
    });
  }

  const hasil: RefHit[] = [];
  const pintu: RefHit[] = [];
  const sudahAda = new Set<string>();

  // Konsep diambil dari SELURUH paragraf, bukan per kalimat: topik sebuah
  // paragraf ditentukan keseluruhannya, bukan satu kalimat saja.
  //
  // Urutan: LLM dulu (kalau ada yang siap) karena ia memahami maksud paragraf
  // dan menghasilkan istilah yang benar-benar dipakai kitab. Kalau LLM mati
  // atau diabaikan, jatuh ke pengekstrakan konsep deterministik.
  let konsep: string[] = [];
  let asal: AsalIstilah | undefined;

  if (mode === "konsep") {
    if (req.konsepKustom && req.konsepKustom.length > 0) {
      konsep = req.konsepKustom;
      asal = { jenis: "aturan", alasan: "Pilihan & input manual peneliti" };
    } else {
      const teksParagraf = kalimatList.join(" ");

      if (!req.tanpaLLM) {
        const llm = await istilahDariParagraf(teksParagraf, {
          hanya: req.penyediaLLM,
          kunci: req.kunciLLM,
        });
        if (!llm.gagal && llm.istilah.length > 0) {
          konsep = llm.istilah;
          asal = { jenis: "llm", penyedia: llm.penyedia, model: llm.model };
        } else {
          konsep = ekstrakKonsep(teksParagraf);
          asal = { jenis: "aturan", alasan: llm.alasan };
        }
      } else {
        konsep = ekstrakKonsep(teksParagraf);
        asal = { jenis: "aturan" };
      }
    }
  }

  if (mode === "konsep" && konsep.length === 0) {
    peringatan.push("Paragraf terlalu pendek untuk diambil konsepnya. Coba mode «Kata».");
    return { hasil, pintu, status: Array.from(status.values()), peringatan, mode, konsep, asal };
  }

  // Mode konsep bekerja pada topik paragraf, bukan per kalimat — satu
  // putaran saja. Mode kata tetap per kalimat agar footnote bisa dipetakan
  // ke kalimat asalnya.
  const satuanCari = mode === "konsep" ? [kalimatList.join(" ")] : kalimatList;

  for (const kalimat of satuanCari) {
    for (const id of URUTAN) {
      const st = status.get(id)!;
      if (!diminta.has(id)) continue;
      const modul = MODUL[id];

      if (modul.info.mode === "deeplink" || !modul.cari) {
        continue;
      }

      try {
        let kandidat: RefCandidate[] = [];

        if (mode === "konsep" && (id === "turath" || id === "shamela") && (modul as ModulAdapter).cariKonsep) {
          kandidat = await (modul as ModulAdapter).cariKonsep!(konsep, { kunci: req.kunci?.[id], maks: 6 });
        } else if (mode === "kata") {
          kandidat = await modul.cari(kalimat, { kunci: req.kunci?.[id], maks: 6 });
        }

        if (kandidat.length > 0) {
          st.status = "ok";
          for (const c of kandidat) {
            const kk = kunciKandidat(c);
            if (sudahAda.has(kk)) continue;
            sudahAda.add(kk);
            hasil.push({ ...c, id: idUnik(), kalimat });
          }
          st.jumlah += kandidat.length;
        } else if (st.status !== "ok" && st.status !== "gagal") {
          // Jangan turunkan "gagal" menjadi "kosong" hanya karena kalimat
          // berikutnya tidak menghasilkan apa-apa: sumbernya tetap rusak.
          st.status = "kosong";
        }
      } catch (e) {
        st.status = "gagal";
        st.pesan = e instanceof Error ? e.message.slice(0, 120) : "gagal memanggil sumber";
      }
    }
  }

  // Panggil juga sumber pendukung ilmiah: Jurnal Akademik (Crossref/OpenAlex) & Internet Archive
  if (konsep.length > 0) {
    const kueriKoleksi = konsep.slice(0, 3).join(" ");
    try {
      const [hasilJurnal, hasilArchive] = await Promise.all([
        cariJurnal(kueriKoleksi, { maks: 3 }),
        cariArchive(kueriKoleksi, { maks: 3 }),
      ]);

      for (const item of [...hasilJurnal, ...hasilArchive]) {
        const kk = kunciKandidat(item);
        if (!sudahAda.has(kk)) {
          sudahAda.add(kk);
          hasil.push({ ...item, id: idUnik(), kalimat: satuanCari[0] || "" });
        }
      }
    } catch {
      // Abaikan jika jaringan jurnal offline
    }
  }

  // Pintu manual: satu tautan per sumber tanpa API, memakai gabungan
  // kalimat sebagai kueri agar pengguna tetap bisa memeriksa korpus lain.
  const kueriGabung = kalimatList.join(" ").slice(0, 200);
  for (const id of URUTAN) {
    const st = status.get(id)!;
    if (!diminta.has(id)) continue;
    if (MODUL[id].info.mode !== "deeplink") continue;
    const d = MODUL[id].deeplink(kueriGabung);
    pintu.push({ ...d, id: idUnik(), kalimat: kueriGabung });
    st.status = "kosong";
    st.pesan = "Tanpa akses API — hanya tautan buka manual.";
  }

  hasil.sort((a, b) => b.skor - a.skor || (a.jilid ?? 0) - (b.jilid ?? 0));

  const apiAktif = URUTAN.filter((id) => diminta.has(id) && MODUL[id].info.mode === "api");
  if (apiAktif.length === 0) {
    peringatan.push("Tidak ada sumber ber-API aktif. Semua tautan di bawah harus dibuka manual.");
  }
  if (hasil.some((h) => h.source === "shamela")) {
    peringatan.push(
      "Shamela mengirim nama kitab, penulis, jilid, halaman, dan kutipan — tetapi tidak mengirim penerbit, kota, dan tahun. Kolom itu bertanda [ ! verifikasi ].",
    );
  }
  if (hasil.some((h) => h.source === "turath")) {
    peringatan.push(
      "Turath mengirim nama kitab, penulis, jilid, dan halaman — tetapi tidak mengirim penerbit, kota, dan tahun. Kolom itu bertanda [ ! verifikasi ].",
    );
  }
  if (mode === "konsep") {
    if (asal?.jenis === "llm") {
      peringatan.push(
        `Istilah pencarian disusun oleh ${asal.penyedia} (${asal.model}), lalu kata itu dicari ke Turath. Nama kitab, jilid, dan halaman tetap datang dari Turath — bukan dari model.`,
      );
    } else if (asal?.alasan) {
      peringatan.push(
        `LLM tidak dipakai (${asal.alasan}). Istilah diambil dari aturan kata, jadi lebih kasar — hasilnya tetap sah, hanya kurang tepat sasaran.`,
      );
    }
    peringatan.push(
      "Skor tinggi berarti halaman itu membahas topik yang sama — bukan berarti halaman itu memuat kalimat Anda. Baca dulu sebelum mengutip.",
    );
    if (hasil.length > 0 && hasil.every((h) => (h.skor_jenis ?? "") === "konsep")) {
      peringatan.push(
        "Sumber lain (Shamela, Ketabonline, Usul) belum mendukung mode konsep karena butuh metadata judul bab. Pakai mode «Kata» untuk sumber itu.",
      );
    }
  }

  return { hasil, pintu, status: Array.from(status.values()), peringatan, mode, konsep, asal };
}
