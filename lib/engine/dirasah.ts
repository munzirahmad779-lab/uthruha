/**
 * Dirasah sabiqoh (الدراسات السابقة) — Pembangunan Ulang Tahap 7.
 *
 * Keadaan lama (audit A9): TIDAK ada pencarian dirasah sama sekali.
 * Bagian dirasat pada susunan otomatis diisi tabel perbandingan berisi
 * placeholder mentah "[اسم الباحث]" dan kawanannya, tanpa satu pun
 * studi nyata. Modul ini menggantinya dengan tiga hal yang jujur:
 *
 *  1. Penanda dan hitungan: kajian terpilih adalah Sumber proyek biasa
 *     yang membawa inti dirasah (bidang `dirasah` pada Sumber), jadi ia
 *     hidup di jalur sumber yang sah (id stabil, penjaga duplikat,
 *     bisa disitasi, masuk daftar pustaka), bukan tabel data terpisah
 *     yang yatim.
 *  2. Penanaman: tanamKajian menempelkan kajian ke proyek lewat
 *     penjaga duplikat yang sama dengan titik tanam lain (id stabil,
 *     DOI bersih, judul ternormalisasi).
 *  3. Penyusunan: rangkaiDirasah merangkai teks bagian الدراسات
 *     السابقة dari kajian yang BENAR-BENAR dipilih mahasiswa, sebagai
 *     prosa paragraf yang mengalir per kajian, ditutup sintesis
 *     persamaan, perbedaan, dan celah. Unsur per entri mengikuti
 *     SPEC-PEDOMAN: As'adiyah mewajibkan nama peneliti, judul, tujuan,
 *     HASIL (النتائج), lalu persamaan dan perbedaan; Mangkoso hanya
 *     mensyaratkan keterkaitan dengan topik, jadi tidak ada unsur
 *     wajib karangan yang dipindahkan ke sana. Unsur yang datanya
 *     tidak tersedia dinyatakan tidak tersedia di dalam prosa, tidak
 *     pernah dikarang.
 *
 * Angka minimal 3 kajian adalah ATURAN USER (pemilik web), bukan
 * bunyi pedoman mana pun; SPEC-PEDOMAN mencatat jumlah minimal entri
 * dirasah tidak ditemukan di kedua pedoman. Penegakannya di sini
 * berbentuk penanda kelengkapan yang jujur, bukan karangan pengisi.
 */
import { getBidang } from "@/lib/content/bidang";
import { getMetode } from "@/lib/content/metode";
import { bersihkanJudul, type Sumber } from "@/lib/engine/cite";
import type { Project } from "@/lib/engine/project";
import { normalisasiDoi, normalisasiJudul } from "@/lib/engine/referensi";

/** Minimal kajian dirasah terpilih: aturan user, bukan pedoman. */
export const MIN_KAJIAN_DIRASAH = 3;

/** Putusan gerbang relevansi pada satu kandidat kajian (cermin bentuk
 *  putusan pada RefHit.gerbang jalur Cari Rujukan). */
export interface PutusanGerbangKajian {
  lolos: boolean;
  perluKonfirmasi: boolean;
  bidangSumber: string;
  alasan: string;
  statusPenilaian: "dinilai" | "tidak-dinilai" | "aturan-keras";
  skorModel?: number;
}

/** Satu kandidat kajian dari pencarian server, siap dipilih mahasiswa. */
export interface KandidatDirasah {
  /** Sumber siap tanam: id stabil, inti dirasah sudah menempel. */
  sumber: Sumber;
  /** Abstrak nyata dari indeks, bila sumber menyediakannya. */
  abstrak?: string;
  /** Tautan ke halaman sumber di indeksnya (DOI atau halaman karya). */
  tautan: string;
  /** Identifier (DOI/ISBN) lolos pemeriksaan indeks. */
  terverifikasi: boolean;
  /** Skor relevansi pencarian 0..1 dari jalurnya, apa adanya. */
  skor: number;
  /** True bila inti (masalah/tujuan/metode/temuan) dirumuskan model
   *  dari abstrak pada pencarian ini. */
  intiDariModel: boolean;
  /** Putusan gerbang bidang; tidak terisi berarti penilaian model
   *  tidak berjalan untuk akun ini dan aturan kerasnya bersih. */
  gerbang?: PutusanGerbangKajian;
}

/** Hasil satu pencarian dirasah dari server. */
export interface HasilCariDirasah {
  kajian: KandidatDirasah[];
  /** Jumlah kandidat unik yang tidak sempat dinilai model. */
  belumDinilai: number;
  /** Catatan jujur pencarian: yang dibuang dan alasannya, kekurangan
   *  jumlah, kegagalan perumusan inti. */
  catatan: string[];
}

/** Kajian terpilih proyek: sumber berpenanda dirasah, terurut tahun
 *  menaik lalu judul, urutan lazim paparan kajian terdahulu. */
export function kajianDirasah(p: Project): Sumber[] {
  return p.sumber
    .filter((s) => s.dirasah)
    .sort(
      (a, b) =>
        (a.tahun || "9999").localeCompare(b.tahun || "9999") ||
        bersihkanJudul(a.judul).localeCompare(bersihkanJudul(b.judul)),
    );
}

/** Keadaan kelengkapan dirasah proyek terhadap aturan minimal user. */
export function statusDirasah(p: Project): { jumlah: number; cukup: boolean; kurang: number } {
  const jumlah = kajianDirasah(p).length;
  return { jumlah, cukup: jumlah >= MIN_KAJIAN_DIRASAH, kurang: Math.max(0, MIN_KAJIAN_DIRASAH - jumlah) };
}

export type StatusTanamKajian = "baru" | "penanda-ditempel" | "sudah-ada";

/**
 * Tanam satu kajian terpilih ke proyek. Penjaga duplikatnya sama
 * dengan titik tanam footnote (Tahap 6): id stabil, DOI bersih, atau
 * judul ternormalisasi. Bila karya yang sama sudah ada sebagai sumber
 * biasa, penanda dan inti dirasah ditempelkan ke rekam yang ADA (inti
 * lama yang terisi tidak ditimpa inti baru yang kosong); tidak pernah
 * lahir baris sumber kedua untuk karya yang sama.
 */
export function tanamKajian(
  p: Project,
  kajian: Sumber,
): { proyek: Project; status: StatusTanamKajian } {
  // Kedua pemanggil (panel dirasah: pilih dan pilihManual) hanya
  // memanggil fungsi ini sesudah putusan endpoint "terverifikasi"
  // untuk kajian itu, dan keduanya menjaga dua kali (keadaan tombol
  // + penjaga di badan fungsi). Kajian yang tertanam karena itu
  // dicap terverifikasi, supaya gerbang pasang footnote
  // (putusanPasangSumber, perbaikan QA 6 Nov 2026) mengenalinya
  // sebagai entri yang sudah lolos verifikasi, termasuk entri manual
  // yang di panel ini diverifikasi lewat endpoint yang sama seperti
  // tab Rujukan.
  const bersih: Sumber = {
    ...kajian,
    judul: bersihkanJudul(kajian.judul),
    statusVerifikasi: "terverifikasi",
  };
  const ada = p.sumber.find(
    (s) =>
      s.id === bersih.id ||
      (bersih.doi && s.doi && normalisasiDoi(s.doi) === normalisasiDoi(bersih.doi)) ||
      normalisasiJudul(s.judul) === normalisasiJudul(bersih.judul),
  );
  if (!ada) {
    return { proyek: { ...p, sumber: [...p.sumber, bersih] }, status: "baru" };
  }
  if (ada.dirasah) {
    const intiLama = ada.dirasah;
    const intiBaru = bersih.dirasah;
    const gabung =
      intiBaru && (!intiLama.abstrak || !intiLama.tujuan || !intiLama.metode || !intiLama.temuan)
        ? {
            abstrak: intiLama.abstrak || intiBaru.abstrak,
            masalah: intiLama.masalah || intiBaru.masalah,
            tujuan: intiLama.tujuan || intiBaru.tujuan,
            metode: intiLama.metode || intiBaru.metode,
            temuan: intiLama.temuan || intiBaru.temuan,
            dariAbstrak: intiLama.dariAbstrak || intiBaru.dariAbstrak,
          }
        : intiLama;
    if (gabung === intiLama) {
      // Inti tidak berubah. Cap verifikasi ditempelkan hanya bila
      // belum ada, supaya kontrak lama panel tetap berlaku: proyek
      // yang sama sekali tidak berubah dikembalikan apa adanya
      // (panel membedakan "sudah terpilih" dari identitas objek).
      if (ada.statusVerifikasi === "terverifikasi") return { proyek: p, status: "sudah-ada" };
      return {
        proyek: {
          ...p,
          sumber: p.sumber.map((s) =>
            s.id === ada.id ? { ...s, statusVerifikasi: "terverifikasi" as const } : s,
          ),
        },
        status: "sudah-ada",
      };
    }
    return {
      proyek: {
        ...p,
        sumber: p.sumber.map((s) =>
          s.id === ada.id
            ? { ...s, dirasah: gabung, statusVerifikasi: "terverifikasi" as const }
            : s,
        ),
      },
      status: "sudah-ada",
    };
  }
  return {
    proyek: {
      ...p,
      sumber: p.sumber.map((s) =>
        s.id === ada.id
          ? { ...s, dirasah: bersih.dirasah, statusVerifikasi: "terverifikasi" as const }
          : s,
      ),
    },
    status: "penanda-ditempel",
  };
}

/** Lepas penanda dirasah dari satu sumber. Sumbernya sendiri tetap di
 *  daftar rujukan proyek; yang hilang hanya status kajian terpilihnya. */
export function lepasKajian(p: Project, sumberId: string): Project {
  return {
    ...p,
    sumber: p.sumber.map((s) => {
      if (s.id !== sumberId || !s.dirasah) return s;
      const { dirasah: _dibuang, ...sisa } = s;
      return sisa;
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Penyusunan teks dirasah                                             */
/* ------------------------------------------------------------------ */

function teks(v: string | undefined): string {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

/** Akhiri potongan inti sebagai kalimat: buang titik akhir bawaan agar
 *  penjahitan klausa tidak melahirkan titik ganda. */
function tanpaTitikAkhir(v: string): string {
  return teks(v).replace(/[.\u200f]+$/, "").trim();
}

function kutipJudul(judul: string): string {
  return `«${bersihkanJudul(judul)}»`;
}

const URUTAN_KAJIAN = ["أولًا", "ثانيًا", "ثالثًا", "رابعًا", "خامسًا", "سادسًا", "سابعًا", "ثامنًا"];

/**
 * Kutipan harfiah dari abstrak nyata kajian: satu sampai dua kalimat
 * pertamanya, dipotong pada batas kalimat. Yang dikutip selalu teks
 * sumber apa adanya; fungsi ini hanya memilih potongannya. Dipakai
 * bila inti model tidak tersedia tetapi abstraknya ada, agar isi
 * kajian tetap bisa ditelusur ke abstrak sumbernya.
 */
export function kutipanAbstrak(abstrak: string | undefined, maksKarakter = 320): string {
  const t = teks(abstrak);
  if (!t) return "";
  if (t.length <= maksKarakter) return t;
  const potong = t.slice(0, maksKarakter);
  const batas = Math.max(
    potong.lastIndexOf(". "),
    potong.lastIndexOf("! "),
    potong.lastIndexOf("؟ "),
    potong.lastIndexOf("。"),
  );
  if (batas > 80) return potong.slice(0, batas + 1).trim();
  return `${potong.replace(/\s+\S*$/, "").trim()}…`;
}

/** Paragraf satu kajian: unsur pedoman dijalin sebagai prosa. */
function paragrafKajian(p: Project, s: Sumber, indeks: number, asadiyah: boolean): string {
  const inti = s.dirasah;
  const kalimat: string[] = [];
  const wadah: string[] = [];
  if (s.jurnal) {
    wadah.push(`المنشورة في ${teks(s.jurnal)}`);
    if (s.volume) wadah.push(`المجلد ${teks(s.volume)}`);
    if (s.nomor) wadah.push(`العدد ${teks(s.nomor)}`);
  } else if (s.jenis === "skripsi" && s.penerbit) {
    wadah.push(`وهي رسالة علمية قُدّمت إلى ${teks(s.penerbit)}`);
  } else if (s.penerbit) {
    wadah.push(`الصادرة عن ${teks(s.penerbit)}`);
  }
  kalimat.push(
    `${URUTAN_KAJIAN[indeks] ?? `الدراسة رقم ${indeks + 1}`}: دراسة ${teks(s.penulis)}${s.tahun ? ` (${teks(s.tahun)})` : ""} الموسومة بـ${kutipJudul(s.judul)}${wadah.length > 0 ? `، ${wadah.join("، ")}` : ""}.`,
  );
  if (inti?.masalah) {
    kalimat.push(`وقد انطلقت هذه الدراسة من مشكلة مفادها: ${tanpaTitikAkhir(inti.masalah)}.`);
  }
  if (inti?.tujuan) {
    kalimat.push(`وهدفت إلى ${tanpaTitikAkhir(inti.tujuan)}.`);
  } else {
    // Unsur tujuan tidak tersedia di data: dinyatakan, bukan dikarang.
    kalimat.push("ولم يصرّح ملخص هذه الدراسة المنشور بهدف محدد لها في البيانات المتاحة للباحث.");
  }
  if (inti?.metode) {
    kalimat.push(`واتّبعت في ذلك ${tanpaTitikAkhir(inti.metode)}.`);
  }
  if (inti?.temuan) {
    kalimat.push(`وانتهت إلى نتائج من أبرزها: ${tanpaTitikAkhir(inti.temuan)}.`);
  } else {
    // Unsur HASIL (النتائج) tidak tersedia di data: dinyatakan terus
    // terang di dalam prosa, hasil kajian tidak pernah dikarang.
    kalimat.push(
      "أما نتائجها فلم تُتح في ملخصها المنشور ضمن البيانات التي وصل إليها الباحث، فاكتفى بعرض ما ثبت من بياناتها دون أن ينسب إليها نتيجة لم ترد فيها.",
    );
  }
  if (!inti?.masalah && !inti?.tujuan && !inti?.metode && !inti?.temuan && inti?.abstrak) {
    // Tanpa inti model, isi kajian ditelusurkan ke abstraknya sendiri:
    // kutipan harfiah dari abstrak sumber, bukan ringkasan karangan.
    const kutipan = kutipanAbstrak(inti.abstrak);
    if (kutipan) kalimat.push(`وجاء في ملخصها المنشور: «${kutipan}»`);
  }
  if (asadiyah) {
    // Persamaan dan perbedaan per entri (wajib As'adiyah), dibangun
    // hanya dari judul kedua kajian dan bidang proyek: dua data yang
    // benar-benar ada, tanpa klaim isi.
    kalimat.push(
      `وتشترك هذه الدراسة مع دراسة الباحث في انتمائها إلى مجال ${getBidang(p.bidangId).labelAr}، وتفترق عنها في موضوعها وحدودها؛ إذ تقف عند ${kutipJudul(s.judul)}، بينما تتناول دراسة الباحث ${kutipJudul(p.judulAr || p.topikAr || "موضوعه المحدد في عنوانه")}.`,
    );
  }
  return kalimat.join(" ");
}

/**
 * Rangkai teks bagian الدراسات السابقة dari kajian yang dipilih
 * mahasiswa pada proyek ini. Tanpa kajian terpilih, keluarannya
 * pengantar jujur + penanda editorial: tidak ada studi rekaan, tidak
 * ada tabel placeholder. `kalimatFenomena` adalah kalimat fenomena
 * proyek yang SUDAH dirumuskan pemanggil sebagai kalimat tersendiri
 * (penggolong fenomena berbentuk kalimat Tahap 3 di compose.ts);
 * fungsi ini tidak pernah menyematkan fenomena ke tengah frasa.
 */
export function rangkaiDirasah(p: Project, opsi?: { kalimatFenomena?: string }): string {
  const kajian = kajianDirasah(p);
  const namaPedoman = p.strukturPedoman?.namaPedoman ?? "";
  const asadiyah = /as'adiyah/i.test(namaPedoman);
  const bidang = getBidang(p.bidangId).labelAr;
  const judulProyek = p.judulAr || p.topikAr || "";
  const paragraf: string[] = ["## الدراسات السابقة"];

  paragraf.push(
    `يستعرض الباحث في هذا الموضع الدراسات السابقة ذات الصلة بموضوع بحثه${judulProyek ? ` ${kutipJudul(judulProyek)}` : ""}، ليقف على ما انتهت إليه جهود الباحثين في مجال ${bidang}، ويحدّد موضع دراسته منها؛ حتى لا يكرّر ما قيل، وإنما يبني عليه ويستكمله ويستدرك ما فات أصحابه.`,
  );

  if (kajian.length === 0) {
    paragraf.push(
      "[تنبيه للباحث: لم تُختر بعد دراسات سابقة موثقة لهذا الموضع. ابحث من لوحة الدراسات السابقة في تبويب الهيكل واختر الدراسات الحقيقية ذات الصلة بموضوعك، فيُبنى نص هذا الموضع منها؛ ولم تُدرج هنا دراسات جاهزة، حتى لا تُنسب إلى الباحثين دراسات لم يقم بها أحد]",
    );
    return paragraf.join("\n\n");
  }

  kajian.forEach((s, i) => paragraf.push(paragrafKajian(p, s, i, asadiyah)));

  // Sintesis penutup: persamaan, perbedaan, dan celah, dibangun dari
  // data yang ada (bidang, judul-judul, metode proyek) tanpa klaim isi
  // di luar inti dan abstrak yang benar-benar didapat.
  const sintesis: string[] = [
    `وبالمقارنة بين هذه الدراسات ودراسة الباحث يتبيّن أنها تشترك معها في الانتماء إلى مجال ${bidang} وفي الاهتمام بقضايا متصلة بموضوع هذا البحث، وتختلف عنها في زوايا المعالجة وحدودها؛ فكل دراسة منها وقفت عند جانب من الموضوع كما يدل عليه عنوانها، بينما تتناول دراسة الباحث موضوعه من زاويته المحددة في عنوانه وبمنهجه المعتمد، وهو ${getMetode(p.metode).labelAr}.`,
  ];
  if (opsi?.kalimatFenomena) sintesis.push(opsi.kalimatFenomena);
  sintesis.push(
    "ومن هنا يظهر الفراغ الذي تسعى هذه الدراسة إلى ملئه: تقديم معالجة علمية موثّقة لموضوعها في حدوده التي لم تستوفها الدراسات المعروضة مجتمعة، وبذلك تثبت جدّتها وموضعها بينها دون إعادة ولا تكرار.",
  );
  paragraf.push(sintesis.join(" "));

  const st = statusDirasah(p);
  if (!st.cukup) {
    const sebutan = st.jumlah === 1 ? "دراسة واحدة" : st.jumlah === 2 ? "دراستان" : `${st.jumlah} دراسات`;
    paragraf.push(
      `[تنبيه للباحث: الدراسات المعروضة هنا ${sebutan} فقط، والحد الأدنى المقرر في هذا الموقع ${MIN_KAJIAN_DIRASAH} دراسات سابقة؛ أضف ${st.kurang === 1 ? "دراسة أخرى" : `${st.kurang} دراسات أخرى`} ذات صلة من لوحة الدراسات السابقة حتى يكتمل العدد]`,
    );
  }
  return paragraf.join("\n\n");
}
