// lib/engine/kata-kunci-server.ts
// Prompt + parser + fallback untuk route /api/kata-kunci tahap kurasi v2:
// tahap "kata" (kolam kata kunci) dan tahap "kalimat" (tepat 3 kalimat
// kunci berperan beserta alasannya). Fallback tanpa AI berupa saringan teks
// dan templat per peran — titik awal yang wajib diedit mahasiswa.

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
- "arti": padanan Bahasa Indonesia kalimat itu.
- "alasan": 1 kalimat Bahasa Indonesia menjelaskan kenapa kalimatnya disusun begitu (konsep yang diwakili + kenapa istilah Arab itu dipilih).
- Susun HANYA dari kata kunci terpilih dan judul. Jangan mengarang referensi/DOI/penulis.`;

export interface KataPasangan { ar: string; id: string }
export interface KalimatHasil { teks: string; arti: string; alasan: string; peran: string }

export function parseKata(raw: string): KataPasangan[] | null {
  try {
    const bersih = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(bersih.slice(bersih.indexOf("{"), bersih.lastIndexOf("}") + 1));
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

