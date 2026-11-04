/**
 * Gerbang relevansi bidang untuk rujukan hasil pencarian AI.
 *
 * Latar (laporan koreksi rekaman tutorial, 4 Nov 2026): Generate Footnote
 * pernah memasang artikel sosiologi Durkheim (Majalah Sosiologi, 2020,
 * tanpa halaman) ke proyek Fiqh dan Ushul Fiqh tanpa peringatan apa pun.
 * Gerbang ini memastikan kandidat maraji' web dinilai terhadap bidang
 * proyek sebelum dipasang:
 *
 *  1. ATURAN KERAS bidang (deterministik, tanpa model): penanda bidang
 *     asing yang kuat pada judul artikel atau nama jurnal langsung
 *     menahan kandidat, walau seluruh model AI mati.
 *  2. PENILAIAN MODEL (kolam premium, meneruskan opsi BYOK pemanggil):
 *     model menilai kesesuaian kandidat dengan kalimat tujuan dan bidang
 *     proyek, dari isi atau abstrak kandidat bila sumber menyediakannya.
 *     Bila model gagal total, statusnya "tidak-dinilai", skor TIDAK
 *     dikarang, dan gerbang GAGAL TERTUTUP (Tahap 4, menutup temuan S1
 *     telaah komit koreksi): kandidat ditahan sebagai perluKonfirmasi
 *     dengan alasan terus terang, tidak lolos diam-diam hanya karena
 *     aturan kerasnya bersih.
 *
 * Hasil tertahan bukan penolakan mutlak: pemanggil mengembalikannya
 * sebagai perluKonfirmasi agar pengguna bisa memutuskan sendiri, dan
 * hanya memasangnya (dengan tanda perluVerifikasi) bila pengguna
 * memaksa lewat paksaKonfirmasi.
 */
import { panggilKolam } from "./kolam";
import { normalisasi } from "@/lib/refs/score";

/** Ambang skor model (0..100) agar kandidat dinyatakan sesuai bidang.
 *  60 dipilih karena penilaian model bersifat kasar: di bawah ini model
 *  sendiri ragu, jadi kandidat tidak boleh terpasang diam-diam. */
export const AMBANG_SKOR_MODEL = 60;

/** Konteks bidang proyek tempat footnote akan dipasang. */
export interface KonteksProyek {
  /** Id bidang dari lib/content/bidang.ts, mis. "fiqh". Boleh kosong. */
  bidangId: string;
  /** Label bidang yang terbaca manusia, mis. "Fiqh & Ushul Fiqh". */
  bidangLabel: string;
  judulProyek: string;
  topik: string;
}

/** Kandidat rujukan yang dinilai gerbang. */
export interface KandidatRelevansi {
  judul: string;
  /** Nama jurnal atau wadah terbit. */
  wadah?: string;
  /** Alias wadah untuk pemanggil yang memakai nama kolom jurnal. */
  jurnal?: string;
  /** "jurnal" | "buku" | jenis lain dari pipeline rujukan. */
  jenis?: string;
  /** Isi nyata kandidat dari sumbernya (abstrak artikel, atau cuplikan
   *  teks kitab dari Turath/Shamela). Bila terisi, model menilai
   *  dukungan isi terhadap kalimat tujuan, bukan hanya kemasan judul
   *  (poin A8 audit kode). Tidak pernah diisi karangan pemanggil. */
  isi?: string;
}

/** Opsi kolam yang diteruskan apa adanya ke panggilKolam (BYOK). */
export type OpsiKolamGerbang = {
  pribadi?: { userId: string; gemini?: string; groq?: string };
  wajibPribadi?: boolean;
  pinjaman?: { userId: string; gemini?: string; groq?: string }[];
};

export interface HasilGerbang {
  lolos: boolean;
  /** True bila kandidat tertahan dan keputusan diserahkan ke pengguna. */
  perluKonfirmasi: boolean;
  /** Bidang asal sumber menurut aturan keras atau model. "" bila tidak terdeteksi. */
  bidangSumber: string;
  alasan: string;
  /** Skor model 0..100. Tidak ada (undefined) bila model tidak menilai. */
  skorModel?: number;
  /** "dinilai" = model menjawab; "tidak-dinilai" = model gagal total;
   *  "aturan-keras" = diputuskan aturan keras tanpa memanggil model. */
  statusPenilaian: "dinilai" | "tidak-dinilai" | "aturan-keras";
}

interface PenandaBidang {
  /** Nama bidang yang dilaporkan ke pengguna. */
  bidang: string;
  /** Penanda pada judul artikel ATAU nama jurnal. */
  penanda: string[];
  /** Penanda tambahan yang hanya berlaku pada NAMA JURNAL, karena kata
   *  yang sama pada judul artikel bisa bermakna lain. */
  penandaJurnal?: string[];
  /** Kata penanda bidang proyek sendiri: bila konteks proyek memuat
   *  salah satunya, bidang ini BUKAN bidang asing untuk proyek itu. */
  penandaProyekSendiri: string[];
}

/**
 * Peta penanda bidang asing. Disengaja sempit dan spesifik: penanda yang
 * kabur lebih berbahaya daripada penanda yang terlewat, karena penanda
 * kabur menahan rujukan yang sah. Kasus yang wajib tertangkap di sini:
 * sosiologi (Durkheim), pendidikan jasmani, legitimasi organisasi,
 * psikologi, kedokteran, sastra novel, dan ekonomi murni.
 */
const PENANDA_BIDANG_ASING: PenandaBidang[] = [
  {
    bidang: "Sosiologi",
    penanda: [
      "sosiologi",
      "sociology",
      "sociological",
      "علم الاجتماع",
      "دوركايم",
      "دوركهايم",
      "durkheim",
    ],
    // "الاجتماعية" sendirian pada judul artikel bisa berarti relasi
    // sosial dalam studi Islam; pada NAMA JURNAL ia penanda jurnal
    // sosiologi atau ilmu sosial.
    penandaJurnal: ["الاجتماعية", "العلوم الاجتماعية", "الدراسات الاجتماعية"],
    penandaProyekSendiri: ["sosiologi", "sociology", "علم الاجتماع"],
  },
  {
    bidang: "Pendidikan jasmani dan olahraga",
    penanda: [
      "التربية البدنية",
      "علوم الرياضة",
      "pendidikan jasmani",
      "olahraga",
      "physical education",
      "sports science",
      "sport science",
    ],
    penandaProyekSendiri: ["jasmani", "olahraga", "sports", "التربية البدنية"],
  },
  {
    bidang: "Manajemen dan administrasi",
    penanda: [
      "الشرعية التنظيمية",
      "legitimasi organisasi",
      "organizational legitimacy",
      "manajemen organisasi",
      "إدارة الأعمال",
      "business administration",
    ],
    penandaProyekSendiri: ["manajemen", "administrasi", "management", "إدارة"],
  },
  {
    bidang: "Psikologi",
    penanda: ["علم النفس", "psikologi", "psychology", "psychological"],
    penandaProyekSendiri: ["psikologi", "psychology", "علم النفس"],
  },
  {
    bidang: "Kedokteran dan kesehatan",
    // "طب" TIDAK dimasukkan sebagai penanda lepas: ia adalah potongan
    // kata lain (تطبيق، مطبعة) dan akan menahan rujukan yang sah.
    // Bentuk katanya yang utuh (الطب، الطبي، الطبية) yang dipakai.
    penanda: [
      "الطب",
      "الطبي",
      "الطبية",
      "kedokteran",
      "kesehatan masyarakat",
      "public health",
      "medicine",
      "medical",
    ],
    penandaProyekSendiri: ["kedokteran", "kesehatan", "medicine", "medical", "الطب"],
  },
  {
    bidang: "Sastra dan novel",
    penanda: ["رواية", "novel", "الأدب الروائي"],
    // Bidang Bahasa & Sastra Arab memang membaktikan diri pada sastra,
    // jadi untuk proyek bidang itu novel bukan bidang asing.
    penandaProyekSendiri: ["bahasa", "sastra", "الأدب", "اللغة"],
  },
  {
    bidang: "Ekonomi murni",
    penanda: ["اقتصاد", "economics", "economy"],
    // Pengecualian ketetapan: proyek ekonomi syariah boleh memakai
    // sumber ekonomi umum sebagai pembanding.
    penandaProyekSendiri: ["iqtishad", "ekonomi"],
  },
];

/** Penanda bahwa sumber ekonomi memang ekonomi SYARIAH, bukan murni. */
const PENANDA_EKONOMI_SYARIAH = ["الإسلامي", "الإسلامية", "الشرعي", "الشرعية", "syariah", "islamic"];

function teksCari(teks: string): string {
  return normalisasi(teks.toLowerCase());
}

/**
 * Kecocokan satu penanda pada teks yang sudah dinormalisasi.
 * Penanda berfrasa dicocokkan sebagai potongan teks; penanda satu kata
 * Arab pendek dicocokkan per token agar tidak menempel pada kata lain.
 */
function cocokPenanda(teks: string, token: Set<string>, penandaMentah: string): boolean {
  const penanda = teksCari(penandaMentah);
  if (!penanda) return false;
  if (penanda.includes(" ")) return teks.includes(penanda);
  if (/[\u0600-\u06FF]/u.test(penanda) && penanda.length <= 4) return token.has(penanda);
  return teks.includes(penanda);
}

/**
 * Deteksi bidang sumber dari judul artikel dan nama jurnal.
 * Mengembalikan nama bidang asing yang terdeteksi, atau null bila tidak
 * ada penanda bidang asing yang kuat. Murni dan tanpa jaringan.
 */
export function deteksiBidangSumber(judul: string, namaJurnal?: string): string | null {
  const tJudul = teksCari(judul ?? "");
  const tJurnal = teksCari(namaJurnal ?? "");
  const tokenJudul = new Set(tJudul.split(" ").filter(Boolean));
  const tokenJurnal = new Set(tJurnal.split(" ").filter(Boolean));
  const gabungan = `${tJudul} ${tJurnal}`;
  for (const p of PENANDA_BIDANG_ASING) {
    const kena =
      p.penanda.some((x) => cocokPenanda(tJudul, tokenJudul, x) || cocokPenanda(tJurnal, tokenJurnal, x)) ||
      (p.penandaJurnal ?? []).some((x) => cocokPenanda(tJurnal, tokenJurnal, x));
    if (!kena) continue;
    // Ekonomi yang menyebut dirinya syariah bukan ekonomi murni.
    if (p.bidang === "Ekonomi murni" && PENANDA_EKONOMI_SYARIAH.some((x) => gabungan.includes(teksCari(x)))) {
      continue;
    }
    return p.bidang;
  }
  return null;
}

/**
 * True bila bidang sumber yang terdeteksi sebenarnya bidang proyek itu
 * sendiri (mis. psikologi untuk proyek psikologi, ekonomi untuk proyek
 * ekonomi syariah, sastra untuk proyek Bahasa & Sastra Arab).
 */
export function bidangMilikProyek(bidangSumber: string, konteks: KonteksProyek): boolean {
  const p = PENANDA_BIDANG_ASING.find((x) => x.bidang === bidangSumber);
  if (!p) return false;
  const teksProyek = teksCari(
    [konteks.bidangId, konteks.bidangLabel, konteks.judulProyek, konteks.topik].filter(Boolean).join(" "),
  );
  const tokenProyek = new Set(teksProyek.split(" ").filter(Boolean));
  return p.penandaProyekSendiri.some((x) => cocokPenanda(teksProyek, tokenProyek, x));
}

const SISTEM_GERBANG = `Anda adalah penilai relevansi rujukan akademik yang KETAT untuk naskah berbahasa Arab di perguruan tinggi keislaman Indonesia.
Tugas Anda HANYA menilai apakah satu kandidat rujukan sesuai untuk dipasang sebagai footnote pada kalimat tujuan, mengingat bidang proyek penulis.
Aturan:
- Keluarkan HANYA JSON valid, tanpa penjelasan, tanpa markdown:
  {"sesuai": boolean, "skor": 0-100, "bidangSumber": "...", "alasan": "..."}
- "sesuai" true hanya bila topik kandidat benar-benar menunjang kalimat tujuan DAN bidang kandidat sejalan dengan bidang proyek.
- Artikel dari bidang lain (mis. sosiologi umum, manajemen organisasi, pendidikan jasmani, kedokteran) yang hanya berbagi satu dua kata umum dengan kalimat tujuan dinilai sesuai: false dengan skor rendah.
- "skor" adalah angka 0 sampai 100 untuk kekuatan kesesuaian, bukan persen keyakinan.
- "bidangSumber" isi dengan nama bidang kandidat menurut bacaan Anda.
- "alasan" satu kalimat Bahasa Indonesia yang menyebut bukti pada judul, nama jurnal, atau isi kandidat.
- Bila isi atau abstrak kandidat diberikan, nilai dari ISI itu: apakah isi tersebut benar-benar mendukung makna kalimat tujuan, bukan sekadar berbagi kata umum. Isi yang tidak mendukung kalimat tujuan berarti sesuai: false walau judulnya terdengar dekat.
- Bila makna kalimat tujuan menurut analisis konteks diberikan, pakai rumusan makna itu sebagai acuan utama, bukan bunyi kalimatnya saja.
- Jangan mengarang isi artikel di luar yang diberikan.`;

interface NilaiModelMentah {
  sesuai: boolean;
  skor: number;
  bidangSumber: string;
  alasan: string;
}

function parseNilaiModel(raw: string): NilaiModelMentah | null {
  try {
    const bersih = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(bersih.slice(bersih.indexOf("{"), bersih.lastIndexOf("}") + 1)) as Record<string, unknown>;
    if (typeof json.sesuai !== "boolean") return null;
    const skor = typeof json.skor === "number" && Number.isFinite(json.skor) ? Math.max(0, Math.min(100, Math.round(json.skor))) : null;
    if (skor === null) return null;
    return {
      sesuai: json.sesuai,
      skor,
      bidangSumber: typeof json.bidangSumber === "string" ? json.bidangSumber.trim() : "",
      alasan: typeof json.alasan === "string" ? json.alasan.trim() : "",
    };
  } catch {
    return null;
  }
}

/**
 * Nilai satu kandidat terhadap konteks proyek dan kalimat tujuan.
 *
 * Urutan keputusan:
 *  1. Aturan keras bidang asing terdeteksi dan bukan bidang proyek:
 *     tertahan TANPA memanggil model (kasus Durkheim tertangkap di sini
 *     walau model mati, dan kuota model hemat).
 *  2. Model menilai (dari isi kandidat bila ada). sesuai true dan skor
 *     >= AMBANG_SKOR_MODEL: lolos. Selain itu: tertahan sebagai
 *     perluKonfirmasi.
 *  3. Model gagal total atau balasannya tidak terbaca: status
 *     "tidak-dinilai", skor tidak dikarang, gerbang GAGAL TERTUTUP:
 *     kandidat tertahan sebagai perluKonfirmasi dengan alasan terus
 *     terang. Tidak ada kandidat yang terpasang tanpa penilaian.
 */
export async function nilaiRelevansi(
  kandidat: KandidatRelevansi,
  konteks: KonteksProyek,
  kalimatTujuan: string,
  opsiKolam?: OpsiKolamGerbang,
  opsi?: {
    /** Rumusan makna kalimat tujuan dari analisis konteks paragraf
     *  (klaim + dukungan yang dibutuhkan), agar model menilai makna,
     *  bukan bunyi kalimat saja. */
    maknaKalimat?: string;
  },
): Promise<HasilGerbang> {
  const wadah = kandidat.wadah ?? kandidat.jurnal ?? "";
  const bidangKeras = deteksiBidangSumber(kandidat.judul, wadah);
  if (bidangKeras && !bidangMilikProyek(bidangKeras, konteks)) {
    return {
      lolos: false,
      perluKonfirmasi: true,
      bidangSumber: bidangKeras,
      alasan: `Judul atau nama jurnal menunjukkan bidang ${bidangKeras}, sedangkan proyek ini bidang ${konteks.bidangLabel || konteks.bidangId || "yang dipilih penulis"}.`,
      statusPenilaian: "aturan-keras",
    };
  }

  const pengguna = [
    `Bidang proyek: ${konteks.bidangLabel || konteks.bidangId || "(tidak diisi)"}`,
    `Judul proyek: ${konteks.judulProyek || "(tidak diisi)"}`,
    `Topik proyek: ${konteks.topik || "(tidak diisi)"}`,
    `Kalimat tujuan tempat footnote menempel: ${kalimatTujuan.slice(0, 600)}`,
    ...(opsi?.maknaKalimat
      ? [`Makna kalimat tujuan menurut analisis konteks paragraf: ${opsi.maknaKalimat.slice(0, 600)}`]
      : []),
    `Judul kandidat: ${kandidat.judul}`,
    `Jurnal atau wadah kandidat: ${wadah || "(tidak diketahui)"}`,
    `Jenis kandidat: ${kandidat.jenis || "(tidak diketahui)"}`,
    ...(kandidat.isi
      ? [`Isi kandidat dari sumbernya (abstrak atau cuplikan teks): ${kandidat.isi.slice(0, 1200)}`]
      : []),
  ].join("\n");

  let nilai: NilaiModelMentah | null = null;
  try {
    const hasil = await panggilKolam({
      sistem: SISTEM_GERBANG,
      pengguna,
      maksToken: 300,
      json: true,
      premium: true,
      pribadi: opsiKolam?.pribadi,
      wajibPribadi: opsiKolam?.wajibPribadi,
      pinjaman: opsiKolam?.pinjaman,
    });
    if (hasil.teks) nilai = parseNilaiModel(hasil.teks);
  } catch {
    nilai = null;
  }

  if (!nilai) {
    // GAGAL TERTUTUP (Tahap 4): model yang tidak bisa menilai bukan
    // alasan meloloskan. Kandidat ditahan dan keputusan diserahkan ke
    // pengguna dengan alasan yang terus terang.
    return {
      lolos: false,
      perluKonfirmasi: true,
      bidangSumber: bidangKeras ?? "",
      alasan:
        "Penilaian model tidak tersedia (model gagal menjawab, misalnya kuota kunci habis atau layanan AI sedang terganggu), sehingga kandidat ini BELUM dinilai kesesuaiannya. Aturan keras bidang bersih bukan bukti sesuai. Periksa sendiri isi sumbernya, atau pasang paksa dengan tanggung jawab Anda.",
      statusPenilaian: "tidak-dinilai",
    };
  }

  const bidangSumber = nilai.bidangSumber || bidangKeras || "";
  if (nilai.sesuai && nilai.skor >= AMBANG_SKOR_MODEL) {
    return {
      lolos: true,
      perluKonfirmasi: false,
      bidangSumber,
      alasan: nilai.alasan || "Model menilai kandidat sesuai bidang proyek dan kalimat tujuan.",
      skorModel: nilai.skor,
      statusPenilaian: "dinilai",
    };
  }
  return {
    lolos: false,
    perluKonfirmasi: true,
    bidangSumber,
    alasan:
      nilai.alasan ||
      `Model menilai kandidat belum sesuai (skor ${nilai.skor} dari ambang ${AMBANG_SKOR_MODEL}).`,
    skorModel: nilai.skor,
    statusPenilaian: "dinilai",
  };
}

/** Bentuk minimal kandidat Cari Rujukan yang dinilai gerbang. `kunci`
 *  adalah kunci dedupe pemanggil: kandidat yang sama dari beberapa
 *  kalimat berbagi satu putusan. */
export interface BentukKandidatCari {
  kunci: string;
  judul: string;
  wadah?: string;
  jenis?: string;
  /** Kalimat asal tempat kandidat ini akan dipasang. */
  kalimat: string;
}

/**
 * Nilai kandidat-kandidat Cari Rujukan dengan gerbang yang sama dengan
 * Generate Footnote (Tahap 4, menutup temuan S3 telaah komit koreksi:
 * jalur ini dulu tidak melewati penilaian bidang sama sekali).
 *
 * Kandidat dinilai unik per kunci dedupe, urut seperti diberikan
 * pemanggil (pemanggil mengurutkan skor tertinggi lebih dulu), dibatasi
 * `maksDinilai` penilaian agar satu pencarian tidak berubah menjadi
 * belasan panggilan model. Kandidat di luar batas tidak mendapat
 * putusan (pemanggil wajib menyatakannya sebagai belum dinilai, bukan
 * menyembunyikannya). Aturan keras tidak memakai jatah penilaian model
 * tetapi tetap dihitung sebagai putusan.
 */
export async function nilaiUntukCariRujukan(
  daftar: BentukKandidatCari[],
  konteks: KonteksProyek,
  opsiKolam?: OpsiKolamGerbang,
  maksDinilai = 6,
): Promise<{ putusan: Map<string, HasilGerbang>; belumDinilai: number }> {
  const putusan = new Map<string, HasilGerbang>();
  const unik = new Map<string, BentukKandidatCari>();
  for (const k of daftar) {
    if (!unik.has(k.kunci)) unik.set(k.kunci, k);
  }
  let dinilai = 0;
  let belumDinilai = 0;
  for (const k of unik.values()) {
    const bidangKeras = deteksiBidangSumber(k.judul, k.wadah ?? "");
    const kerasMenolak = Boolean(bidangKeras && !bidangMilikProyek(bidangKeras, konteks));
    if (!kerasMenolak && dinilai >= maksDinilai) {
      belumDinilai += 1;
      continue;
    }
    if (!kerasMenolak) dinilai += 1;
    putusan.set(
      k.kunci,
      await nilaiRelevansi(
        { judul: k.judul, wadah: k.wadah, jenis: k.jenis },
        konteks,
        k.kalimat,
        opsiKolam,
      ),
    );
  }
  return { putusan, belumDinilai };
}
