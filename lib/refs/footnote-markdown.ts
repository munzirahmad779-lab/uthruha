/**
 * Parser footnote Markdown (`[^1]: teks`) yang dipakai bersama oleh
 * pratinjau (React) dan ekspor DOCX.
 *
 * Aturan penting: penomoran tidak pernah dikarang. Kalau naskah memakai
 * penomoran lain (mis. `[1]`), fungsi ini tidak menebak — ia hanya
 *_what_ yang ada: definisi yang ditulis penulis sendiri.
 */

/** Definisi footnote yang ditemukan: nomor → teks. */
export type DefinisiFootnote = Map<string, string>;

const POLA_DEFINISI = /^\[\^([^\]\s]+)\]:\s*(.*)$/;

/**
 * Kumpulkan definisi footnote dari markdown.
 * Baris lanjutan (indentasi) ikut digabung ke definisi sebelumnya.
 */
export function kumpulkanFootnote(md: string): DefinisiFootnote {
  const def = new Map<string, string>();
  const baris = md.replace(/\r\n/g, "\n").split("\n");
  let nomorAktif: string | null = null;

  for (const b of baris) {
    const m = b.match(POLA_DEFINISI);
    if (m) {
      nomorAktif = m[1];
      def.set(nomorAktif, m[2].trim());
      continue;
    }
    // Baris lanjutan: indentasi dan bukan definisi baru.
    if (nomorAktif && /^\s{2,}\S/.test(b) && !POLA_DEFINISI.test(b)) {
      const isi = b.trim();
      if (isi) def.set(nomorAktif, `${def.get(nomorAktif) ?? ""} ${isi}`.trim());
      continue;
    }
    if (b.trim() === "") {
      nomorAktif = null;
      continue;
    }
    nomorAktif = null;
  }

  return def;
}

/** Buang baris definisi footnote dari badan naskah (dipakai pratinjau & ekspor). */
export function buangDefinisi(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((b) => !POLA_DEFINISI.test(b))
    .join("\n");
}

/**
 * Pecah teks menjadi potongan: teks biasa dan penanda footnote.
 * Penanda yang tidak punya definisi tetap ditampilkan sebagai teks apa
 * adanya — lebih baik terlihat daripada hilang diam-diam.
 */
export interface Potongan {
  jenis: "teks" | "catatan";
  isi: string;
  nomor?: string;
  ada?: boolean;
}

export function pecahCatatan(teks: string, def: DefinisiFootnote): Potongan[] {
  const out: Potongan[] = [];
  const re = /\[\^([^\]\s]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(teks)) !== null) {
    if (m.index > last) out.push({ jenis: "teks", isi: teks.slice(last, m.index) });
    const nomor = m[1];
    out.push({
      jenis: "catatan",
      isi: def.get(nomor) ?? m[0],
      nomor,
      ada: def.has(nomor),
    });
    last = m.index + m[0].length;
  }
  if (last < teks.length) out.push({ jenis: "teks", isi: teks.slice(last) });
  return out;
}

/**
 * Nomor footnote siap tampil: pakai angka Arab bila diminta, dengan
 * penanda pemisah bila angkanya kecil (١) supaya tidak menyatu dengan
 * huruf sebelumnya pada teks Arab.
 */
export function nomorTampil(nomor: string, angkaArab: boolean): string {
  if (!angkaArab) return nomor;
  const digit = "٠١٢٣٤٥٦٧٨٩";
  const arab = nomor.replace(/\d/g, (d) => digit[Number(d)]);
  return arab.length <= 2 ? `(${arab})` : `(${arab})`;
}
