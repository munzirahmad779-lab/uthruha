/**
 * Uji hidup Tahap F (Aturan Pencarian Valid, lapis kitab): endpoint
 * verifikasi yang dipakai panel Lugawi & Istilahi untuk daftar
 * "Pemakaian di jurnal", diuji ujung ke ujung lewat HTTP ke server
 * dev lokal — Crossref HIDUP dan model penilai NYATA lewat jembatan
 * LLM lokal. Kandidat dibangun PERSIS dari rekod Crossref hidupnya,
 * pada konteks proyek takamul yang sama dengan uji tahap sebelumnya:
 *  - DOI 10.12816/0032787 (ekonomi, jurnal التكامل الاقتصادي) adalah
 *    jenis temuan yang lazim menyusup pada pencarian istilah tunggal
 *    (istilah التكامل telanjang) → WAJIB gagal-bidang, tidak boleh
 *    tampil sebagai pemakaian sah.
 *  - DOI 10.21580/ihya.20.2.4048 (Ushul Fiqh, Ihya' 'Ulum al-Din)
 *    → WAJIB terverifikasi.
 *
 * Syarat jalan (pola uji hidup tahap sebelumnya):
 *  - Server dev berjalan dengan UTH_MODE_UJI=1, store temp yang
 *    sudah di-seed fixture (npx tsx scripts/seed-uji.ts), tanpa
 *    UTH_ACCESS_KEY (gerbang nonaktif di dev), dan
 *    KOLAM_UJI_BASE=http://127.0.0.1:3458.
 *  - Jembatan LLM hidup di 127.0.0.1:3458 dengan model
 *    gemini-3.5-flash-lite.
 *  - Alamat server dari TAHAP_F_UJI_BASE (bawaan
 *    http://127.0.0.1:3217).
 *
 * Jalankan: npx tsx scripts/test-tahap-f-hidup.ts
 */

const BASE = process.env.TAHAP_F_UJI_BASE ?? "http://127.0.0.1:3217";
const JUDUL_PROYEK = "التكامل المعرفي بين علوم القرآن وأصول الفقه";

let gagal = 0;
let lulus = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? " — " + detail : ""}`);
  if (ok) lulus++;
  else gagal++;
};

interface RekodHidup {
  judul: string;
  jurnal: string;
  tahun: string;
}

async function ambilRekod(doi: string): Promise<RekodHidup> {
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { "User-Agent": "UthruhaAcademic/1.0 (mailto:peneliti@uthruha.id)" },
  });
  if (!res.ok) throw new Error(`Crossref menjawab ${res.status} untuk ${doi}`);
  const m = (await res.json()) as {
    message: {
      title?: string[];
      "container-title"?: string[];
      issued?: { "date-parts"?: number[][] };
    };
  };
  return {
    judul: (m.message.title?.[0] ?? "").trim(),
    jurnal: (m.message["container-title"]?.[0] ?? "").trim(),
    tahun: String(m.message.issued?.["date-parts"]?.[0]?.[0] ?? ""),
  };
}

async function main() {
  const [rekodEkonomi, rekodIhya] = await Promise.all([
    ambilRekod("10.12816/0032787"),
    ambilRekod("10.21580/ihya.20.2.4048"),
  ]);
  const kandidat = [
    { id: "f-hidup-ekonomi", doi: "10.12816/0032787", ...rekodEkonomi },
    { id: "f-hidup-ihya", doi: "10.21580/ihya.20.2.4048", ...rekodIhya },
  ];

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/refs/verifikasi-jurnal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-uji-user": "UJI-PREMIUM",
        Origin: BASE,
      },
      body: JSON.stringify({
        kandidat,
        bidangId: "fiqh",
        judulProyek: JUDUL_PROYEK,
        topikAr: JUDUL_PROYEK,
      }),
    });
  } catch (e) {
    console.error(
      `UJI HIDUP TAHAP F TIDAK BISA JALAN: server dev di ${BASE} tidak menjawab. ` +
        `Pastikan server dev + jembatan LLM hidup sesuai syarat di kepala berkas. (${e instanceof Error ? e.message : e})`,
    );
    process.exit(2);
  }
  const data = (await res.json().catch(() => null)) as {
    hasil?: { id: string; status: string; alasan: string }[];
    error?: string;
  } | null;
  if (!res.ok || !data || !Array.isArray(data.hasil)) {
    console.error(
      `UJI HIDUP TAHAP F TIDAK BISA JALAN: endpoint menjawab ${res.status} ${data?.error ?? ""}`,
    );
    process.exit(2);
  }
  const putusan = new Map(data.hasil.map((h) => [h.id, h]));

  const ekonomi = putusan.get("f-hidup-ekonomi");
  cek(
    "H1 kandidat ekonomi penyusup istilah (DOI 10.12816/0032787) gagal-bidang di endpoint panel Lugawi",
    ekonomi?.status === "gagal-bidang",
    (ekonomi?.alasan ?? `status=${ekonomi?.status ?? "tanpa putusan"}`).slice(0, 110),
  );

  const ihya = putusan.get("f-hidup-ihya");
  cek(
    "H2 kandidat Ihya Ushul Fiqh (DOI 10.21580/ihya.20.2.4048) terverifikasi di endpoint panel Lugawi",
    ihya?.status === "terverifikasi",
    (ihya?.alasan ?? `status=${ihya?.status ?? "tanpa putusan"}`).slice(0, 110),
  );

  console.log(`\nHASIL: ${lulus} PASS, ${gagal} FAIL`);
  process.exit(gagal > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("UJI HIDUP TAHAP F GAGAL JALAN:", e);
  process.exit(2);
});
