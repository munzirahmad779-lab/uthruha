/**
 * Uji rantai pencarian rujukan terhadap sumber nyata.
 * Jalankan: npx tsx scripts/qa-refs.ts
 */
import { cariRujukan, kemampuanSumber } from "../lib/refs";
import { parsePedoman, ringkasPedoman, PROMPT_PEDOMAN } from "../lib/refs/pedoman";
import { footnoteDari, entriPustakaDari, hitungBatas } from "../lib/refs/footnote";
import { uraiSitasi, kolomKosong } from "../lib/refs/adapters/manual";
import { buatDocx } from "../lib/engine/export";
import { kumpulkanFootnote, buangDefinisi, pecahCatatan } from "../lib/refs/footnote-markdown";
import { jendelaKueri } from "../lib/refs/adapters/turath";
import { uraiHasil, bacaHalaman } from "../lib/refs/adapters/shamela";
import { ekstrakKonsep, skorKonsep } from "../lib/refs/konsep";
import { bersihkanJawaban } from "../lib/refs/llm/istilah";
import { inflateRawSync } from "node:zlib";

/** Baca entri dari paket ZIP (metode store/deflate) tanpa dependensi. */
function bacaZip(buf: Buffer, nama: string): string | null {
  const sig = 0x04034b50;
  let off = 0;
  while (off + 30 <= buf.length) {
    if (buf.readUInt32LE(off) !== sig) break;
    const metode = buf.readUInt16LE(off + 8);
    const ukuran = buf.readUInt32LE(off + 18);
    const namaLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const namaFile = buf.toString("utf8", off + 30, off + 30 + namaLen);
    const dataStart = off + 30 + namaLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + ukuran);
    if (namaFile === nama) {
      return metode === 0 ? data.toString("utf8") : inflateRawSync(data).toString("utf8");
    }
    off = dataStart + ukuran;
  }
  return null;
}

function cek(nama: string, lulus: boolean, info = "") {
  console.log(`${lulus ? "PASS" : "GAGAL"} ${nama}${info ? ` - ${info}` : ""}`);
  if (!lulus) prosesGagal++;
}
let prosesGagal = 0;

async function utama() {
  console.log("kemampuan sumber:", kemampuanSumber().map((s) => `${s.id}:${s.mode}`).join(" | "));

  const kalimat = [
    "الحمد لله الذي أنعم علينا بنعمة الإسلام",
    "العلم نور والجهل ظلام في حياة الإنسان",
  ];
  const res = await cariRujukan({ sentences: kalimat });
  console.log(`hasil=${res.hasil.length} pintu=${res.pintu.length} status=${res.status.map((s) => `${s.source}:${s.status}(${s.jumlah})`).join(",")}`);
  for (const h of res.hasil.slice(0, 3)) {
    console.log(`  [${h.source} ${h.skor}] ${h.kitab} | ج${h.jilid ?? "?"} ص${h.halaman_cetak ?? "?"} | ${h.teks_kutipan.slice(0, 60)}`);
    console.log(`     url: ${h.url_sumber}`);
  }

  cek("Turath mengembalikan kandidat", res.hasil.some((h) => h.source === "turath"), `${res.hasil.length} kandidat`);
  cek("setiap kandidat punya url + skor", res.hasil.every((h) => h.url_sumber.startsWith("http") && h.skor >= 0 && h.skor <= 1));
  cek(
    "kolom ragu ditandai verifikasi",
    res.hasil.every((h) => (h.penulis && h.jilid && h.halaman_cetak ? true : h.perluVerifikasi)),
  );
  cek("sumber deeplink jadi pintu, bukan hasil", res.pintu.length > 0 && res.pintu.every((p) => p.mode === "deeplink" && p.skor === 0));

  // Pedoman
  const md = `# Pedoman Penulisan Universitas Islam Negeri Sunan Kalijaga
## Format Naskah
- Font Arab: Traditional Arabic 16 pt
- Ukuran footnote: 14 pt
- Spasi: 1,5
- Margin: 3 cm
- Angka: Arab
## Sitasi
- Gaya: catatan kaki
- Penomoran footnote: per bab
- Contoh: النووي، الأذكار، (بيروت: دار الفكر، 2000)، ص 12.
`;
  const p = parsePedoman(md, "pedoman-uin.md");
  for (const r of ringkasPedoman(p)) console.log("  " + r);
  cek("pedoman terbaca: nama lembaga", p.namaKampus.includes("Sunan Kalijaga"), p.namaKampus);
  cek("pedoman terbaca: ukuran", p.ukuranNaskah === 16 && p.ukuranFootnote === 14);
  cek("pedoman terbaca: spasi", p.spasi === 1.5);
  cek("pedoman terbaca: margin", p.marginCm === 3);
  cek("batas keras tetap 2 footnote", p.maksFootnotePerParagraf === 2);
  cek("prompt AI non-kosong", PROMPT_PEDOMAN.length > 400);

  const kosong = parsePedoman("");
  cek("pedoman kosong mencatat default", kosong.default.length >= 3, kosong.default.join("; ").slice(0, 80));

  // Footnote
  const h = res.hasil[0];
  if (h) {
    const fn = footnoteDari(h, p);
    const pu = entriPustakaDari(h, p);
    console.log("  footnote:", fn);
    console.log("  pustaka :", pu);
    cek("footnote memakai angka Arab", /[٠-٩]/.test(fn) || !/\d/.test(fn));
    cek("footnote menandai kolom kosong", fn.includes("[ ! verifikasi ]") || Boolean(h.kota && h.penerbit && h.tahun));
    cek("entri pustaka terisi", pu.length > 10);
  }

  // Batas
  const draf = "الفقرة الأولى نص عربي طويل نسبيا يحتاج إلى ربط بالمصادر.[^1] ثم تكملة.[^2]\n\nالفقرة الثانية نص آخر.[^3]";
  const b = hitungBatas(draf, p);
  console.log(`  batas: paragraf=${JSON.stringify(b.paragraf)} kata=${b.kata} halaman=${b.halamanPerkiraan}`);
  cek("deteksi footnote per paragraf", b.paragraf[0].jumlah === 2 && b.paragraf[1].jumlah === 1);
  cek("paragraf > batas ditandai", b.paragraf.some((x) => x.lebih) === false);

  const lebih = hitungBatas("أ[^1] ب[^2] ج[^3]", p);
  cek("3 footnote dalam satu paragraf dilanggar", lebih.pelanggaran.length > 0, lebih.pelanggaran[0]);

  // Manual
  const s = uraiSitasi("النووي، الأذكار، (بيروت: دار الفكر، 2000)، ج 1، ص 23.");
  console.log("  manual:", JSON.stringify(s));
  cek("urai sitasi manual", s.judul.length > 0 && s.penerbit === "دار الفكر", `${s.penulis}|${s.judul}|${s.kota}|${s.penerbit}|${s.tahun}`);
  cek("kolom kosong dilaporkan", Array.isArray(kolomKosong(s)));

  // DOCX mengikuti pedoman
  const blob = buatDocx("اختبار", "## عنوان\n\nنص عربي للاختبار", {
    font: p.fontArab,
    ukuranNaskah: p.ukuranNaskah,
    ukuranFootnote: p.ukuranFootnote,
    spasi: p.spasi,
    marginCm: p.marginCm,
  });
  const buf = Buffer.from(await blob.arrayBuffer());
  const xml = buf.toString("latin1");
  cek("docx berisi font dari pedoman", xml.includes("Traditional Arabic"), `${buf.length} byte`);
  cek("docx 16 pt (sz 32)", xml.includes('w:sz w:val="32"'));
  cek("docx margin pedoman (3 cm = 1701)", xml.includes('w:mar' + 'ginCm') === false && xml.includes('w:top="1701"'));
  cek("docx tetap RTL", xml.includes("<w:bidi/>"));

  // ---- Footnote: pratinjau + ekspor Word ----
  const mdFn = "## مقدمة\n\nالحمد لله رب العالمين.[^1] وهذا نص.[^2]\n\n[^1]: ابن القيم، الجواب الكافي.\n[^2]: ابن تيمية، مجموع الفتاوى.\n";
  const defs = kumpulkanFootnote(mdFn);
  cek("footnote terdefinisi 2 buah", defs.size === 2, `size=${defs.size}`);
  cek("isi footnote terbaca", (defs.get("1") ?? "").includes("الجواب الكافي"));
  cek("definisi dibuang dari badan", !buangDefinisi(mdFn).includes("[^1]:"));
  const pot = pecahCatatan("نص.[^1] lanjutan", defs);
  cek("penanda dipecah jadi potongan", pot.length === 3 && pot[1].jenis === "catatan", `len=${pot.length}`);
  cek("penanda punya definisi", pot[1].ada === true);
  cek("penanda tanpa definisi ditandai", pecahCatatan("teks[^9]", defs)[1].ada === false);

  const blobFn = buatDocx("اختبار", mdFn, {
    font: p.fontArab,
    ukuranNaskah: p.ukuranNaskah,
    ukuranFootnote: p.ukuranFootnote,
    spasi: p.spasi,
    marginCm: p.marginCm,
  });
  const bufFn = Buffer.from(await blobFn.arrayBuffer());
  const fnXml = bacaZip(bufFn, "word/footnotes.xml");
  const docXml = bacaZip(bufFn, "word/document.xml") ?? "";
  cek("docx punya footnotes.xml", fnXml !== null);
  cek("docx punya footnoteReference", docXml.includes("<w:footnoteReference"));
  cek("docx penanda footnote bukan teks mentah", !docXml.includes("[^1]") && !docXml.includes("[^2]"));
  cek("docx isi footnote ikut terbawa", (fnXml ?? "").includes("الجواب الكافي"), "di footnotes.xml");
  cek("docx isi footnote 2 ikut terbawa", (fnXml ?? "").includes("مجموع الفتاوى"));
  cek("docx punya separator footnote", (fnXml ?? "").includes('w:type="separator"'));
  const ctypes = bacaZip(bufFn, "[Content_Types].xml") ?? "";
  cek("content types mendaftarkan footnotes", ctypes.includes("footnotes+xml"));
  const drels = bacaZip(bufFn, "word/_rels/document.xml.rels") ?? "";
  cek("rels mendaftarkan footnotes", drels.includes("footnotes.xml"));

  // ---- Regresi: kueri Turath harus dipecah jadi jendela kata ----
  // Turath mencocokkan frasa persis; mengirim kalimat utuh 19 kata selalu
  // menghasilkan 0. Ini pernah jadi bug yang membuat pencarian "tidak work".
  const kalimatPanjang =
    "كما أورد أمثلة أخرى عند حديثه عن المدني والمكي، مبينًا ما اتفق العلماء عليه وما وقع فيه الخلاف بينهم.";
  const jw = jendelaKueri(kalimatPanjang);
  cek("jendela kueri dipecah", jw.length >= 2 && jw.length <= 4, `${jw.length} jendela`);
  cek(
    "jendela kueri pendek (4-6 kata)",
    jw.every((q) => {
      const n = q.split(/\s+/).length;
      return n >= 4 && n <= 6;
    }),
    jw[0],
  );
  cek(
    "jendela kueri tidak memuat tanda baca",
    jw.every((q) => !/[،.؟!:؛]/.test(q)),
  );
  cek("jendela kueri kalimat pendek utuh", jendelaKueri("رب زدني علما")[0] === "رب زدني علما");
  cek("jendela kueri teks kosong", jendelaKueri("   ").length === 0);

  // ---- Mode konsep ("makna") ----
  const konsepPar = ekstrakKonsep(kalimatPanjang);
  cek("konsep diekstrak", konsepPar.length >= 1, konsepPar.join(","));
  cek(
    "konsep membuang kata wacana",
    !konsepPar.includes("امثله") && !konsepPar.includes("وقع") && !konsepPar.includes("اخري"),
    konsepPar.join(","),
  );
  cek("konsep menyimpan topik nyata", konsepPar.includes("مدني") || konsepPar.includes("مكي"));
  cek(
    "konsep membuang imbuhan",
    !konsepPar.some((k) => /^(و|ب|ف|ك|ل)ال/.test(k)),
    konsepPar.join(","),
  );

  const sk = skorKonsep(["مدني", "مكي"], ["فوائد معرفة المكي والمدني"], "");
  cek("skor konsep menghitung judul bab", sk.diHeading === 2, `diHeading=${sk.diHeading}`);
  cek("skor konsep 0..1", sk.skor > 0 && sk.skor <= 1, String(sk.skor));
  const sk0 = skorKonsep(["مدني"], ["باب الطهارة"], "");
  cek("skor konsep nol bila topik tak cocok", sk0.skor === 0);
  cek("skor konsep tanpa konsep", skorKonsep([], ["apa pun"], "").skor === 0);

  // ---- Lapisan LLM: pembersih jawaban model ----
  const jwb = bersihkanJawaban(
    [
      "1. المدني والمكي",
      "2) أسباب النزول",
      "- الترجيح بين الأقوال",
      '"القرآن الكريم"',
      "كلمة", // 1 kata → buang
      "هذا شرح طويل جدا وليس مصطلحا بحثيا ابدا على الاطلاق", // >5 kata → buang
      "not arabic at all", // bukan Arab → buang
      "المدني والمكي", // duplikat → buang
    ].join("\n"),
  );
  cek("llm membuang penomoran", jwb.includes("المدني والمكي"), jwb.join("|"));
  cek("llm membuang butir", jwb.includes("الترجيح بين الأقوال"));
  cek("llm membuang tanda kutip", jwb.includes("القرآن الكريم") && !jwb.some((x) => x.includes('"')));
  cek("llm membuang kata tunggal", !jwb.includes("كلمة"));
  cek("llm membuang kalimat panjang", !jwb.some((x) => x.split(" ").length > 5));
  cek("llm membuang teks non-Arab", !jwb.some((x) => /[a-zA-Z]/.test(x)));
  cek("llm membuang duplikat", jwb.filter((x) => x === "المدني والمكي").length === 1);
  cek("llm jawaban kosong", bersihkanJawaban("").length === 0);

  // ---- Mode konsep: frasa multi-kata ----
  const frasa = skorKonsep(["المدني والمكي"], ["فوائد معرفة المكي والمدني"], "");
  cek("frasa utuh di judul bab dapat nilai penuh", frasa.diHeading === 1, JSON.stringify(frasa));
  const frasaSebagian = skorKonsep(["المدني والمكي"], ["باب المدني"], "");
  cek(
    "frasa sebagian tidak dianggap cocok penuh",
    frasaSebagian.diHeading === 0,
    JSON.stringify(frasaSebagian),
  );

  // ---- Shamela: parser hasil HTML (tanpa jaringan) ----
  // Bentuk HTML ini disalin dari respons sungguhan POST /ajax/search.
  const htmlShamela =
    `<div><a target="_blank" href="https://shamela.ws/book/36/1460">` +
    `<b><span class="text-primaryy">لباب التفاسير للكرماني</span></b> ` +
    `<span class="text-gray">[أبو القاسم الكرماني]</span></a> ` +
    `<span class="text-gray srch-page-ref">(ص 1460)</span></div>` +
    `<p class="srch-snippet"> <span class="srch-snippet-text">` +
    `ومعنى {يُقْضَى إِلَيْكَ وَحْيُهُ} <em>رب</em> <em>زدني</em> سل الله أن يزيد علماً` +
    `</span></p>`;
  const urai = uraiHasil(htmlShamela, "رب زدني علما");
  cek("Shamela: satu hasil terurai", urai.length === 1, `jumlah=${urai.length}`);
  cek("Shamela: nama kitab terbaca", urai[0]?.kitab === "لباب التفاسير للكرماني", urai[0]?.kitab);
  cek("Shamela: penulis terbaca", urai[0]?.penulis === "أبو القاسم الكرماني", urai[0]?.penulis);
  cek("Shamela: halaman terbaca", urai[0]?.halaman_cetak === 1460, String(urai[0]?.halaman_cetak));
  cek(
    "Shamela: tautan sumber utuh",
    urai[0]?.url_sumber === "https://shamela.ws/book/36/1460",
    urai[0]?.url_sumber,
  );
  cek(
    "Shamela: tag <em> dibersihkan dari kutipan",
    urai[0] !== undefined && !urai[0].teks_kutipan.includes("<"),
    urai[0]?.teks_kutipan,
  );
  cek(
    "Shamela: kolom yang tidak dikirim ditandai butuh verifikasi",
    urai[0]?.perluVerifikasi === true && Boolean(urai[0]?.catatanVerifikasi),
    String(urai[0]?.catatanVerifikasi),
  );

  // Jilid & halaman harus dibedakan — "(ج 6، ص 274)" bukan halaman 6.
  const hal1 = bacaHalaman("(ج 6، ص 274)");
  cek("Shamela: jilid & halaman dipisah", hal1.jilid === 6 && hal1.halaman === 274, JSON.stringify(hal1));
  const hal2 = bacaHalaman("(ص ١٤٦٠)");
  cek(
    "Shamela: angka Arab-Indic dibaca",
    hal2.halaman === 1460 && hal2.jilid === undefined,
    JSON.stringify(hal2),
  );

  console.log(prosesGagal === 0 ? "SEMUA PASS" : `${prosesGagal} GAGAL`);
  process.exit(prosesGagal === 0 ? 0 : 1);
}

void utama();
