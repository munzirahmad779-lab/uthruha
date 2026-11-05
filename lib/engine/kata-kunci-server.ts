// lib/engine/kata-kunci-server.ts
// Prompt + parser + fallback untuk route /api/kata-kunci tahap kurasi v2:
// tahap "kata" (kolam kata kunci) dan tahap "kalimat" (tepat 3 kalimat
// kunci berperan beserta alasannya). Fallback tanpa AI berupa saringan teks
// dan templat per peran — titik awal yang wajib diedit mahasiswa.
//
// Tahap G2 (6 Nov 2026): tahap "kalimat" kini berjalan di atas SKEMA
// KETAT lib/engine/skema-pencarian.ts (PROMPT_PENCARIAN di bawah +
// validasiKeluaranPencarian di route): keluaran model pencarian tidak
// boleh memuat field bibliografis apa pun, dan keluaran tidak sah
// berakhir gagal tertutup di route, bukan fallback karangan. Parser
// lama parseKata/parseKalimat ikut dikeraskan: field bibliografis
// atau pola DOI pada keluaran membuatnya gugur (null).

export const PROMPT_KATA = `Anda adalah pengekstrak KATA KUNCI (konsep) untuk literatur akademik Islam.
Tugas Anda HANYA mengekstrak kata kunci dari judul/rumusan pengguna.
Aturan:
- Keluarkan HANYA JSON valid: {"kata":[{"ar":"...","id":"..."}]}
- 8-12 kata kunci. Kata kunci adalah KONSEP (1-3 kata), BUKAN kalimat dan BUKAN frasa pencarian.
- "ar": istilah Arabnya (huruf Arab), "id": padanan Bahasa Indonesianya.
- Urutkan dari konsep paling pokok. Jangan mengarang nama penulis/judul/DOI.`;

export const PROMPT_KALIMAT = `Anda adalah penyusun KALIMAT KUNCI pencarian literatur akademik Islam.
Dari JUDUL dan KATA KUNCI TERPILIH pengguna, susun TEPAT 3 kalimat kunci.
Aturan:
- Keluarkan HANYA JSON valid: {"kalimat":[{"teks":"...","arti":"...","alasan":"...","peran":"taswir|aqwal|tarjih"}]}
- Tepat 3 item, peran berurutan: "taswir" (gambaran/definisi masalah), "aqwal" (pendapat ulama & dalil), "tarjih" (analisis & penetapan jawaban).
- "teks": kalimat kunci HURUF ARAB, frasa utuh 3-7 kata yang khas untuk dicari persis di kitab.
- "teks" DILARANG menyempit menjadi satu kata ambigu yang berdiri sendiri (kata umum tanpa pasangan konsepnya): kalimat kunci wajib frasa utuh bermakna lengkap yang berjangkar pada judul, karena kata tunggal ambigu menarik literatur bidang lain yang tidak relevan.
- "arti": padanan Bahasa Indonesia kalimat itu.
- "alasan": 1 kalimat Bahasa Indonesia menjelaskan kenapa kalimatnya disusun begitu (konsep yang diwakili + kenapa istilah Arab itu dipilih).
- Susun HANYA dari kata kunci terpilih dan judul. Jangan mengarang referensi/DOI/penulis.`;

/**
 * Prompt skema ketat untuk tahap "kalimat" (Tahap G2): model
 * mengeluarkan SARAN PENCARIAN dalam bentuk search_output.schema
 * (lihat lib/engine/skema-pencarian.ts), BUKAN rujukan. Larangan
 * bibliografis dinyatakan eksplisit karena validator menolak
 * keluaran yang melanggarnya dan route gagal tertutup sesudah satu
 * kali coba ulang.
 */
export const PROMPT_PENCARIAN = `Anda adalah penyusun KUNCI PENCARIAN literatur akademik Islam. Keluaran Anda adalah SARAN PENCARIAN (istilah dan frasa kueri), BUKAN rujukan.

Keluarkan HANYA JSON valid dengan bentuk PERSIS ini, tanpa field lain:
{"status":"siap","kata_kunci_inti":[{"istilah":"...","bahasa":"ar","pendamping_konteks":["..."]}],"perluasan_kueri":[{"teks":"...","bahasa":"ar","jenis":"inti","sumber_target":["shamela","turath"]}],"bidang_utama":"fikih_munakahat","bidang_pendukung":[]}

Aturan bentuk:
- "status" satu dari: "siap", "perlu_disambiguasi", "tidak_ditemukan".
- "kata_kunci_inti": 1-12 butir; "istilah" adalah konsep pokok (Arab/Indonesia/Inggris sesuai "bahasa": "ar"|"id"|"en"); "pendamping_konteks" 1-5 frasa pendek (maks 80 aksara) yang MENYERTAI istilah itu agar tidak ambigu.
- "perluasan_kueri": 1-10 butir frasa pencarian UTUH (5-200 aksara, MINIMAL 2 kata) yang siap diketik ke sumbernya; "jenis" satu dari "inti"|"sinonim"|"lebih_luas"|"lebih_sempit"|"terkait"; "sumber_target" 1-5 dari "crossref"|"doaj"|"openalex"|"shamela"|"turath". Susun perluasan berbahasa Arab lebih dulu (inti, lalu sinonim/terkait), karena tiga perluasan Arab pertama menjadi kalimat kunci utama panel.
- "bidang_utama"/"bidang_pendukung": HANYA dari enum ini: fikih_munakahat, ushul_fikih, akidah_tauhid, tafsir_ulum_quran, hadis_ulum_hadis, maqashid_syarie, pemikiran_islam, integrasi_keilmuan, lainnya_studi_islam, di_luar_studi_islam, tidak_jelas.

LARANGAN KERAS (melanggar = keluaran dibuang):
- DILARANG mengeluarkan field bibliografis dalam bentuk apa pun: tidak ada judul artikel/kitab, DOI, nama penulis, nama jurnal, tahun, penerbit, atau daftar kandidat rujukan. Anda menyusun KUNCI PENCARIAN, bukan daftar pustaka.
- DILARANG menulis pola DOI (mis. 10.xxxx/...) di teks mana pun.
- DILARANG membuat kueri satu kata: setiap perluasan adalah frasa utuh bermakna lengkap. Kata umum yang ambigu (mis. التكامل sendirian) WAJIB disertai pendamping konteksnya di dalam frasa.

Status khusus:
- Bila istilah pokoknya AMBIGU (satu istilah, beberapa makna yang bidangnya berbeda jauh, mis. التكامل bisa berarti integrasi keilmuan, integrasi ekonomi, kalkulus, atau integrasi sosial): keluarkan {"status":"perlu_disambiguasi","ambiguitas":{"istilah_ambigu":"...","kemungkinan_makna":[{"makna":"...","bidang":"<enum>"}]}} TANPA kata_kunci_inti/perluasan_kueri.
- Bila topiknya di luar studi Islam, terlalu umum, atau informasinya tidak cukup: keluarkan {"status":"tidak_ditemukan","alasan_tidak_ditemukan":"di_luar_studi_islam"|"topik_tidak_spesifik"|"tidak_cukup_informasi"} TANPA kata kunci/kueri apa pun. Jawaban tidak_ditemukan yang jujur lebih baik daripada kunci karangan.`;

export interface KataPasangan { ar: string; id: string }
export interface KalimatHasil { teks: string; arti: string; alasan: string; peran: string }

/**
 * Penjaga bibliografis untuk parser lama (Tahap G2): objek keluaran
 * model yang membawa field bibliografis di tingkat atas, atau nilai
 * teks yang memuat pola DOI, BUKAN keluaran pencarian yang sah.
 */
function mengandungBibliografis(json: unknown): boolean {
  if (typeof json !== "object" || json === null) return false;
  const FIELD = ["judul", "doi", "penulis", "pengarang", "kandidat", "referensi", "tahun", "jurnal", "penerbit", "isbn", "issn", "title", "author", "authors", "year", "journal", "publisher"];
  for (const k of Object.keys(json as Record<string, unknown>)) {
    if (FIELD.includes(k)) return true;
  }
  const tumpukan: unknown[] = [json];
  while (tumpukan.length > 0) {
    const x = tumpukan.pop();
    if (typeof x === "string") {
      if (/10\.\d{4,9}\/\S+|doi\.org\//i.test(x)) return true;
    } else if (Array.isArray(x)) {
      tumpukan.push(...x);
    } else if (typeof x === "object" && x !== null) {
      tumpukan.push(...Object.values(x as Record<string, unknown>));
    }
  }
  return false;
}

export function parseKata(raw: string): KataPasangan[] | null {
  try {
    const bersih = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(bersih.slice(bersih.indexOf("{"), bersih.lastIndexOf("}") + 1));
    if (mengandungBibliografis(json)) return null;
    const kata: KataPasangan[] = Array.isArray(json.kata)
      ? json.kata
          .filter((k: unknown) => typeof k === "object" && k !== null && typeof (k as KataPasangan).ar === "string")
          .map((k: KataPasangan) => ({ ar: k.ar.trim(), id: typeof k.id === "string" ? k.id.trim() : k.ar.trim() }))
          .filter((k: KataPasangan) => k.ar.length > 0)
          .slice(0, 12)
      : [];
    return kata.length > 0 ? kata : null;
  } catch {
    return null;
  }
}

export function parseKalimat(raw: string): KalimatHasil[] | null {
  try {
    const bersih = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(bersih.slice(bersih.indexOf("{"), bersih.lastIndexOf("}") + 1));
    if (mengandungBibliografis(json)) return null;
    const peranSah = ["taswir", "aqwal", "tarjih"];
    const items: KalimatHasil[] = Array.isArray(json.kalimat)
      ? json.kalimat
          .filter((k: unknown) => typeof k === "object" && k !== null && typeof (k as KalimatHasil).teks === "string")
          .map((k: KalimatHasil, i: number) => ({
            teks: k.teks.trim(),
            arti: typeof k.arti === "string" ? k.arti.trim() : "",
            alasan: typeof k.alasan === "string" ? k.alasan.trim() : "",
            peran: peranSah.includes(k.peran) ? k.peran : (peranSah[i] ?? "taswir"),
          }))
          .filter((k: KalimatHasil) => k.teks.length > 0)
          // Kalimat kunci wajib frasa utuh: item yang teksnya kurang
          // dari 3 token adalah kata ambigu telanjang (larangan pada
          // PROMPT_KALIMAT) dan dibuang di sini; pemanggil jatuh ke
          // cadangan jujur bila semua item gugur.
          .filter((k: KalimatHasil) => k.teks.split(/\s+/).filter(Boolean).length >= 3)
          .slice(0, 3)
      : [];
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

/** Fallback kata tanpa AI: token bermakna dari teks (Arab/Latin). */
export function kataTanpaAI(teks: string): KataPasangan[] {
  const stop = new Set(["yang", "dan", "di", "ke", "dari", "untuk", "dalam", "pada", "adalah", "ini", "itu", "dengan", "the", "of", "and", "in", "a", "an"]);
  const frek = new Map<string, number>();
  for (const w of teks.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 3 || stop.has(w)) continue;
    frek.set(w, (frek.get(w) ?? 0) + 1);
  }
  return [...frek.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => ({ ar: w, id: w }));
}

/** Fallback kalimat tanpa AI: templat per peran dari kata terpilih — titik awal untuk diedit. */
export function kalimatTanpaAI(judul: string, kata: string[]): KalimatHasil[] {
  const k0 = kata[0] ?? judul.slice(0, 40);
  const k1 = kata[1] ?? k0;
  return [
    { teks: `تصوير مسألة ${k0}`, arti: `Gambaran masalah ${k0}`, alasan: "Templat tanpa AI: kalimat gambaran memakai konsep pokok pertama. Edit agar menjadi frasa yang benar-benar khas.", peran: "taswir" },
    { teks: `أقوال العلماء في ${k0} و${k1}`, arti: `Pendapat ulama tentang ${k0} dan ${k1}`, alasan: "Templat tanpa AI: kalimat pendapat menggabungkan dua konsep pokok. Edit istilah Arabnya sesuai kitab yang Anda kenal.", peran: "aqwal" },
    { teks: `حكم ${k0} وتحليل أدلته والترجيح`, arti: `Hukum ${k0} beserta analisis dalil dan tarjihnya`, alasan: "Templat tanpa AI: kalimat analisis untuk bab penutup. Edit agar menunjuk jawaban akhir yang dicari judul Anda.", peran: "tarjih" },
  ];
}

