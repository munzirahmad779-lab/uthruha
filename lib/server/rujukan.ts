/**
 * Pencarian rujukan untuk uji coba tamu (Fase 3, keputusan E):
 * OpenAlex (artikel + filter type:book untuk kitab) → Crossref →
 * Google Books / Open Library. Verifikasi: DOI dicek ke Crossref,
 * ISBN divalidasi digit pemeriksa lalu dicek ke katalog buku.
 * Minimal 1 kitab terverifikasi diusahakan masuk hasil akhir bila ada
 * kandidat yang lolos ambang relevansi — bila tidak ada, dikatakan apa
 * adanya (tidak pernah memaksakan kitab asal-asalan).
 */
import { isbnSah, keISBN13, verifikasiISBN } from "./isbn";

export interface RujukanTamu {
  id: string;
  jenis: "jurnal" | "buku";
  judul: string;
  penulis: string[];
  tahun: string;
  wadah: string; // nama jurnal / penerbit
  doi: string | null;
  isbn: string | null;
  tautan: string;
  terverifikasi: boolean;
  skor: number;
  /** Berapa dari kalimat kunci proyek yang benar-benar disentuh judul ini
   * (0..jumlah kalimat kunci). Dipakai untuk label kecocokan topik dan
   * menyaring hasil yang hanya menumpang frasa umum. */
  kecocokan: number;
  /** Apakah judul ini memuat kata inti frasa pertama (mis. "زكاة" pada
   * frasa "زكاة المهنة"). Membedakan rujukan yang menyentuh pokok judul
   * dari yang hanya menumpang kata ekor frasa (mis. "المهنة" pada artikel
   * etika profesi atau kepustakawanan). */
  inti: boolean;
}

const UA = "Uthruha/1.0 (uji coba tamu; +https://uthruha.vercel.app)";
const AMBANG = 0.08; // ambang tumpang-tindih token judul untuk tampil

/**
 * Normalisasi token Arab/Indonesia agar padanan tidak gagal hanya karena
 * bentuk kata: lepas al- ta'rif, samakan ة/ه dan ى/ي, buang akhiran jamak
 * ات pada kata panjang (مهارات -> مهار, sama dengan batang مهارة -> مهار).
 */
function batangKata(t: string): string {
  let x = t.replace(/^(ال)/, "");
  x = x.replace(/ة/g, "ه").replace(/ى/g, "ي");
  if (x.length > 4 && x.endsWith("ات")) x = x.slice(0, -2);
  else if (x.length > 3 && x.endsWith("ه")) x = x.slice(0, -1);
  return x;
}

function tokenJudul(teks: string): Set<string> {
  return new Set(
    teks
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3)
      .map(batangKata)
      .filter((t) => t.length >= 3),
  );
}

function skorRelevansi(kueri: Set<string>, judul: string): number {
  const t = tokenJudul(judul);
  if (t.size === 0 || kueri.size === 0) return 0;
  let sama = 0;
  for (const x of t) if (kueri.has(x)) sama += 1;
  return sama / Math.max(t.size, 1);
}

async function ambilJSON(url: string, ms = 12_000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function verifikasiDOI(doi: string): Promise<boolean> {
  const j = (await ambilJSON(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, 8_000)) as {
    message?: { DOI?: string };
  } | null;
  return Boolean(j?.message?.DOI);
}

interface Kandidat extends Omit<RujukanTamu, "id" | "skor" | "kecocokan" | "inti"> {
  skorMentah: number;
  frasa: number;
  inti: boolean;
}

export async function cariRujukanTamu(
  judulProyek: string,
  kalimatKunci: string[],
): Promise<RujukanTamu[]> {
  const kueriToken = tokenJudul([judulProyek, ...kalimatKunci].join(" "));
  const kueriUtama = (kalimatKunci[0] || judulProyek).slice(0, 200);
  const frasaToken = kalimatKunci.map((k) => tokenJudul(k)).filter((s) => s.size > 0);
  /** Berapa kalimat kunci yang disentuh judul kandidat (padanan batang kata). */
  const hitungFrasa = (judul: string): number => {
    const t = tokenJudul(judul);
    return frasaToken.filter((s) => [...s].some((x) => t.has(x))).length;
  };
  /** Kata inti = token pertama frasa pertama (pokok judul penelitian). */
  const tokenInti = frasaToken[0] ? [...frasaToken[0]][0] : undefined;
  const kandidat: Kandidat[] = [];
  const lihat = new Set<string>();

  const tambah = (k: Omit<Kandidat, "frasa" | "inti">) => {
    const kunciUnik = (k.doi ?? k.isbn ?? k.judul).toLowerCase();
    if (lihat.has(kunciUnik)) return;
    lihat.add(kunciUnik);
    kandidat.push({
      ...k,
      frasa: hitungFrasa(k.judul),
      inti: tokenInti ? tokenJudul(k.judul).has(tokenInti) : false,
    });
  };

  // — OpenAlex: artikel —
  // Cari dengan SETIAP kalimat kunci, bukan hanya frasa pertama: frasa
  // pertama saja terbukti memancing sempalan yang berbagi satu frasa
  // (audit zakat 29 Okt: etika profesi dan kepustakawanan ikut tampil
  // karena berbagi kata "المهنة"), sementara rujukan tentang frasa kedua
  // dan ketiga (kemiskinan, Indonesia) tidak pernah dicari sama sekali.
  const mailto = process.env.OPENALEX_MAILTO?.trim() || "uthruha@contoh.id";
  const daftarKueri = [...new Set([kueriUtama, ...kalimatKunci.slice(0, 3)])].slice(0, 3);
  const hasilOA: Record<string, unknown>[] = [];
  for (const q of daftarKueri) {
    const oa = (await ambilJSON(
      `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=8&mailto=${encodeURIComponent(mailto)}`,
    )) as { results?: Record<string, unknown>[] } | null;
    for (const w of oa?.results ?? []) hasilOA.push(w);
  }
  for (const w of hasilOA) {
    const doi = typeof w.doi === "string" ? w.doi.replace("https://doi.org/", "") : null;
    const judul = typeof w.title === "string" ? w.title : "";
    if (!judul) continue;
    // Filter bidang OpenAlex: karya yang bidang utamanya Health Sciences
    // adalah sempalan untuk ruang lingkup Kitabah (pendidikan, bahasa,
    // studi Islam). Kasus nyata audit 29 Okt: artikel layanan kesehatan
    // digital lolos hanya karena berbagi frasa "الوسائل الرقمية".
    const bidangUtama = (
      w.primary_topic as { field?: { display_name?: string } } | undefined
    )?.field?.display_name;
    if (bidangUtama === "Health Sciences") continue;
    tambah({
      jenis: (w.type as string) === "book" || (w.type as string) === "book-chapter" ? "buku" : "jurnal",
      judul,
      penulis: ((w.authorships as { author?: { display_name?: string } }[]) ?? [])
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean)
        .slice(0, 4),
      tahun: String(w.publication_year ?? ""),
      wadah: ((w.primary_location as { source?: { display_name?: string } } | undefined)?.source?.display_name ?? ""),
      doi,
      isbn: null,
      tautan: doi ? `https://doi.org/${doi}` : typeof w.id === "string" ? w.id : "",
      terverifikasi: false,
      skorMentah: skorRelevansi(kueriToken, judul),
    });
  }

  // — OpenAlex: khusus buku (type:book) —
  const oaBuku = (await ambilJSON(
    `https://api.openalex.org/works?search=${encodeURIComponent(kueriUtama)}&filter=type:book&per-page=8&mailto=${encodeURIComponent(mailto)}`,
  )) as { results?: Record<string, unknown>[] } | null;
  for (const w of oaBuku?.results ?? []) {
    const doi = typeof w.doi === "string" ? w.doi.replace("https://doi.org/", "") : null;
    const judul = typeof w.title === "string" ? w.title : "";
    if (!judul) continue;
    const bidangBuku = (
      w.primary_topic as { field?: { display_name?: string } } | undefined
    )?.field?.display_name;
    if (bidangBuku === "Health Sciences") continue;
    tambah({
      jenis: "buku",
      judul,
      penulis: ((w.authorships as { author?: { display_name?: string } }[]) ?? [])
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean)
        .slice(0, 4),
      tahun: String(w.publication_year ?? ""),
      wadah: "",
      doi,
      isbn: null,
      tautan: doi ? `https://doi.org/${doi}` : typeof w.id === "string" ? w.id : "",
      terverifikasi: false,
      skorMentah: skorRelevansi(kueriToken, judul),
    });
  }

  // — Crossref (juga jalur utama bila OpenAlex 429) —
  const hasilCR: Record<string, unknown>[] = [];
  for (const q of daftarKueri) {
    const cr = (await ambilJSON(
      `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=8&mailto=${encodeURIComponent(mailto)}`,
    )) as { message?: { items?: Record<string, unknown>[] } } | null;
    for (const it of cr?.message?.items ?? []) hasilCR.push(it);
  }
  for (const it of hasilCR) {
    const judul = Array.isArray(it.title) ? String(it.title[0] ?? "") : "";
    if (!judul) continue;
    const doi = typeof it.DOI === "string" ? it.DOI : null;
    tambah({
      jenis: it.type === "book" || it.type === "monograph" ? "buku" : "jurnal",
      judul,
      penulis: ((it.author as { given?: string; family?: string }[]) ?? [])
        .map((a) => `${a.given ?? ""} ${a.family ?? ""}`.trim())
        .filter(Boolean)
        .slice(0, 4),
      tahun: String(
        (it.published as { "date-parts"?: number[][] } | undefined)?.["date-parts"]?.[0]?.[0] ?? "",
      ),
      wadah: Array.isArray(it["container-title"]) ? String(it["container-title"][0] ?? "") : "",
      doi,
      isbn: Array.isArray(it.ISBN) ? String(it.ISBN[0] ?? "") || null : null,
      tautan: doi ? `https://doi.org/${doi}` : "",
      terverifikasi: false,
      skorMentah: skorRelevansi(kueriToken, judul),
    });
  }

  // — Google Books —
  const gb = (await ambilJSON(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(kueriUtama)}&maxResults=8`,
  )) as { items?: { volumeInfo?: Record<string, unknown> }[] } | null;
  for (const it of gb?.items ?? []) {
    const info = it.volumeInfo;
    if (!info || typeof info.title !== "string") continue;
    const ids = (info.industryIdentifiers as { type?: string; identifier?: string }[]) ?? [];
    const isbnMentah = ids.find((x) => x.type === "ISBN_13" || x.type === "ISBN_10")?.identifier ?? "";
    tambah({
      jenis: "buku",
      judul: info.title,
      penulis: Array.isArray(info.authors) ? info.authors.map(String) : [],
      tahun: typeof info.publishedDate === "string" ? info.publishedDate.slice(0, 4) : "",
      wadah: typeof info.publisher === "string" ? info.publisher : "",
      doi: null,
      isbn: isbnMentah || null,
      tautan: typeof info.infoLink === "string" ? info.infoLink : "",
      terverifikasi: false,
      skorMentah: skorRelevansi(kueriToken, info.title),
    });
  }

  // — Open Library search —
  const ol = (await ambilJSON(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(kueriUtama)}&limit=8`,
  )) as { docs?: Record<string, unknown>[] } | null;
  for (const d of ol?.docs ?? []) {
    if (typeof d.title !== "string") continue;
    const isbnMentah = Array.isArray(d.isbn) ? String(d.isbn[0] ?? "") : "";
    tambah({
      jenis: "buku",
      judul: d.title,
      penulis: Array.isArray(d.author_name) ? d.author_name.map(String).slice(0, 4) : [],
      tahun: String(d.first_publish_year ?? ""),
      wadah: Array.isArray(d.publisher) ? String(d.publisher[0] ?? "") : "",
      doi: null,
      isbn: isbnMentah || null,
      tautan: d.key ? `https://openlibrary.org${String(d.key)}` : "",
      terverifikasi: false,
      skorMentah: skorRelevansi(kueriToken, d.title),
    });
  }

  // — Verifikasi identifier (paralel, dibatasi) —
  const terurut = kandidat.sort((a, b) => b.skorMentah - a.skorMentah).slice(0, 18);
  await Promise.all(
    terurut.map(async (k) => {
      if (k.doi) {
        k.terverifikasi = await verifikasiDOI(k.doi);
      } else if (k.isbn) {
        if (!isbnSah(k.isbn)) {
          k.isbn = null;
          return;
        }
        const meta = await verifikasiISBN(k.isbn);
        if (meta) {
          k.terverifikasi = true;
          k.isbn = keISBN13(k.isbn);
          if (!k.wadah) k.wadah = meta.penerbit;
          if (!k.tahun) k.tahun = meta.tahun;
        }
      }
    }),
  );

  // Saring hasil sempalan bidang, dengan sengaja sempit (audit 29 Okt):
  // penanda domain asing yang kuat pada judul kandidat (kesehatan,
  // pencucian uang, bitcoin) yang tidak disebut kueri sama sekali dibuang.
  // Ini menutup kasus artikel layanan kesehatan dan pencucian uang yang
  // lolos hanya karena berbagi frasa "الوسائل الرقمية". Saringan berbasis
  // skor/frasa yang lebih agresif sudah dicoba dan terbukti membuang juga
  // rujukan pendidikan dan bahasa Arab yang relevan (kebanyakan hanya
  // menyentuh satu kalimat kunci karena kalimat kunci lain sangat khas),
  // jadi sisa keraguan ditangani urutan dan label kecocokan, bukan
  // pembuangan.
  const PENANDA_ASING = new Set(["صحي", "غسيل", "بتكوين", "اعلام", "مكتبي", "ارشيفي", "معلوف"]);
  const lolosMentah = terurut.filter((k) => {
    if (k.skorMentah < AMBANG) return false;
    const tokenKandidat = tokenJudul(k.judul);
    for (const t of tokenKandidat) {
      if (PENANDA_ASING.has(t) && !kueriToken.has(t)) return false;
    }
    return true;
  });
  // Urutan akhir: lebih banyak kalimat kunci disentuh didahulukan, lalu
  // yang memuat kata inti frasa pertama, lalu skor token.
  const lolos = lolosMentah.sort(
    (a, b) =>
      b.frasa - a.frasa ||
      Number(b.inti) - Number(a.inti) ||
      b.skorMentah - a.skorMentah,
  );
  const jurnal = lolos.filter((k) => k.jenis === "jurnal").slice(0, 4);
  const buku = lolos.filter((k) => k.jenis === "buku");
  const bukuTerverifikasi = buku.find((k) => k.terverifikasi);
  const pilihan: Kandidat[] = [...jurnal];
  // Minimal 1 kitab TERverifikasi bila ada yang lolos ambang.
  if (bukuTerverifikasi) pilihan.push(bukuTerverifikasi);
  else if (buku[0]) pilihan.push(buku[0]); // buku belum terverifikasi: tampil apa adanya dengan labelnya
  for (const k of lolos) {
    if (pilihan.length >= 5) break;
    if (!pilihan.includes(k)) pilihan.push(k);
  }

  return pilihan.slice(0, 5).map((k, i) => ({
    id: `ref-${i + 1}`,
    jenis: k.jenis,
    judul: k.judul,
    penulis: k.penulis,
    tahun: k.tahun,
    wadah: k.wadah,
    doi: k.doi,
    isbn: k.isbn,
    tautan: k.tautan,
    terverifikasi: k.terverifikasi,
    skor: Math.round(k.skorMentah * 100) / 100,
    kecocokan: k.frasa,
    inti: k.inti,
  }));
}
