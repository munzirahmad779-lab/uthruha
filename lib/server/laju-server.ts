/**
 * Pembatas laju PERSISTEN untuk rute yang membakar kuota AI.
 *
 * Mengapa ada modul ini (audit keamanan 3 Nov 2026, temuan T-2):
 * `bolehLaju` di lib/security/laju.ts menyimpan hitungan di memori
 * proses. Di Vercel serverless itu berarti per instance: cold start
 * dan redeploy mengosongkan hitungan, dan batas "global" berlipat
 * mengikuti jumlah instance yang hidup. Untuk rute murah itu cukup;
 * untuk rute yang memanggil LLM, batas harus berlaku untuk layanan,
 * bukan untuk instance.
 *
 * Cara kerja: jendela tetap (fixed window). Setiap kombinasi
 * (kunci, ember waktu) adalah satu rekam di koleksi "laju" berisi
 * hitungan. Rekam ember sebelumnya dihapus sambil lalu agar koleksi
 * tidak tumbuh. Baca-tulis di store bukan operasi atomik, jadi
 * serbuan paralel masih bisa meloloskan sedikit di atas batas; itu
 * diterima secara sadar karena jauh lebih ketat daripada hitungan
 * per instance, dan skala layanan ini satu angkatan.
 *
 * Bila store tidak bisa dijangkau, fungsi ini jatuh ke pembatas
 * memori proses agar layanan tidak mati hanya karena pembatasnya
 * gagal (fail-open ke rem kasar, bukan ke tanpa rem).
 */
import { createHash } from "node:crypto";
import { bolehLaju } from "@/lib/security/laju";
import { ambil, hapus, simpan } from "./store";

function idRekam(kunci: string, jendelaMs: number, ember: number): string {
  const hash = createHash("sha256").update(`${kunci}|${ember}`).digest("hex").slice(0, 24);
  return `laju:${hash}`;
}

export async function bolehLajuServer(
  kunci: string,
  batas: number,
  jendelaMs: number,
  sekarang = Date.now(),
): Promise<{ boleh: boolean; sisa: number; ulangDetik: number }> {
  try {
    const ember = Math.floor(sekarang / jendelaMs);
    const id = idRekam(kunci, jendelaMs, ember);
    const lama = (await ambil("laju", id)) as { n?: unknown } | null;
    const n = (typeof lama?.n === "number" ? lama.n : 0) + 1;
    await simpan("laju", { id, n, kunci: kunci.slice(0, 80), dibuat: new Date(sekarang).toISOString() });
    // Bersihkan ember sebelumnya agar satu kunci hanya menyisakan
    // paling banyak dua rekam (ember berjalan + yang baru dihapus).
    void hapus("laju", idRekam(kunci, jendelaMs, ember - 1)).catch(() => undefined);
    const boleh = n <= batas;
    const ulangDetik = boleh ? 0 : Math.ceil((jendelaMs - (sekarang % jendelaMs)) / 1000);
    return { boleh, sisa: Math.max(0, batas - n), ulangDetik };
  } catch {
    return bolehLaju(kunci, batas, jendelaMs, sekarang);
  }
}
