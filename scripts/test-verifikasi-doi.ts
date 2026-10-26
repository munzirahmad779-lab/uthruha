// Uji panen verifikasi DOI cocok-judul: kemiripan judul murni + jalur hidup Crossref.
import { kemiripanJudul, verifikasiDoi } from "../lib/engine/validasi-ref";

let gagal = 0;
const cek = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!ok) gagal++; };

cek("judul identik = 1", kemiripanJudul("Fiqh ibadah haji", "Fiqh ibadah haji") === 1);
cek("judul beda jauh < 0,2", kemiripanJudul("Ekonomi pasar modal", "Fiqh ibadah haji") < 0.2);
cek("harakat tidak mengacaukan", kemiripanJudul("التَّرْبِيَة الْحَدِيثَة", "التربية الحديثة") > 0.9, String(kemiripanJudul("التَّرْبِيَة الْحَدِيثَة", "التربية الحديثة")));
cek("subjudul tambahan masih cocok", kemiripanJudul("Studi Islam di Indonesia", "Studi Islam di Indonesia: Pendekatan Baru") >= 0.6);

async function main() {
  const format = await verifikasiDoi("bukan-doi", "Judul apa pun");
  cek("format salah ditolak tanpa jaringan", format.status === "format-salah");
  const palsu = await verifikasiDoi("10.1000/xyz123", "Judul apa pun");
  cek("DOI tak terdaftar → tidak-ditemukan", palsu.status === "tidak-ditemukan", palsu.pesan);

  // Jalur hidup: ambil satu DOI nyata dari Crossref, lalu uji cocok & tidak-cocok.
  try {
    const res = await fetch("https://api.crossref.org/works?query.bibliographic=pesantren+kitab+kuning&rows=1&select=DOI,title");
    const item = (await res.json())?.message?.items?.[0];
    const doi = item?.DOI as string; const judul = (item?.title?.[0] ?? "") as string;
    const cocok = await verifikasiDoi(doi, judul);
    cek("DOI asli + judul asli → cocok", cocok.status === "cocok", `${doi} (${Math.round(cocok.kemiripan * 100)}%)`);
    const salah = await verifikasiDoi(doi, "Sejarah Perang Dunia Kedua di Eropa");
    cek("DOI asli + judul karangan → tidak-cocok", salah.status === "tidak-cocok", salah.pesan.slice(0, 90));
  } catch {
    console.log("LEWATI uji hidup Crossref (jaringan tidak tersedia)");
  }

  console.log(gagal === 0 ? "\nSEMUA LULUS" : `\n${gagal} GAGAL`);
    process.exit(gagal ? 1 : 0);
  }
  void main();
