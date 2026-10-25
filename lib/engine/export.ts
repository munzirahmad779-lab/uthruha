/** Penulis DOCX minimal (tanpa dependensi) dengan dukungan RTL Arab. */
import {
  buangDefinisi,
  kumpulkanFootnote,
  nomorTampil,
  pecahCatatan,
} from "@/lib/refs/footnote-markdown";

const TEKS = new TextEncoder();

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let tabelCrc: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!tabelCrc) {
    tabelCrc = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelCrc[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = (crc >>> 8) ^ tabelCrc[(crc ^ data[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

interface Entri {
  nama: string;
  isi: Uint8Array;
}

function zip(entri: Entri[]): Uint8Array {
  const lokal: Uint8Array[] = [];
  const pusat: Uint8Array[] = [];
  let offset = 0;
  const waktu = 0;
  const tanggal = 0x0021; // 1980-01-01

  for (const e of entri) {
    const nama = TEKS.encode(e.nama);
    const crc = crc32(e.isi);
    const ukuran = e.isi.length;

    const lh = new Uint8Array(30 + nama.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, waktu, true);
    dv.setUint16(12, tanggal, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, ukuran, true);
    dv.setUint32(22, ukuran, true);
    dv.setUint16(26, nama.length, true);
    dv.setUint16(28, 0, true);
    lh.set(nama, 30);
    lokal.push(lh, e.isi);

    const ch = new Uint8Array(46 + nama.length);
    const dv2 = new DataView(ch.buffer);
    dv2.setUint32(0, 0x02014b50, true);
    dv2.setUint16(4, 20, true);
    dv2.setUint16(6, 20, true);
    dv2.setUint16(8, 0x0800, true);
    dv2.setUint16(10, 0, true);
    dv2.setUint16(12, waktu, true);
    dv2.setUint16(14, tanggal, true);
    dv2.setUint32(16, crc, true);
    dv2.setUint32(20, ukuran, true);
    dv2.setUint32(24, ukuran, true);
    dv2.setUint16(28, nama.length, true);
    dv2.setUint16(30, 0, true);
    dv2.setUint16(32, 0, true);
    dv2.setUint16(34, 0, true);
    dv2.setUint16(36, 0, true);
    dv2.setUint32(38, 0, true);
    dv2.setUint32(42, offset, true);
    ch.set(nama, 46);
    pusat.push(ch);

    offset += lh.length + ukuran;
  }

  const ukuranPusat = pusat.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(22);
  const dv3 = new DataView(eocd.buffer);
  dv3.setUint32(0, 0x06054b50, true);
  dv3.setUint16(4, 0, true);
  dv3.setUint16(6, 0, true);
  dv3.setUint16(8, entri.length, true);
  dv3.setUint16(10, entri.length, true);
  dv3.setUint32(12, ukuranPusat, true);
  dv3.setUint32(16, offset, true);
  dv3.setUint16(20, 0, true);

  const total = offset + ukuranPusat + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const bagian of [...lokal, ...pusat, eocd]) {
    out.set(bagian, pos);
    pos += bagian.length;
  }
  return out;
}

/** Pengaturan dokumen yang bisa ditimpa pedoman kampus. */
export interface OpsiDokumen {
  font: string;
  /** Ukuran naskah dalam pt. */
  ukuranNaskah: number;
  /** Ukuran footnote dalam pt. */
  ukuranFootnote: number;
  /** Kelipatan spasi (1, 1.5, 2). */
  spasi: number;
  /** Margin halaman dalam cm. */
  marginCm: number;
}

export const DOK_DEFAULT: OpsiDokumen = {
  font: "Traditional Arabic",
  ukuranNaskah: 16,
  ukuranFootnote: 14,
  spasi: 1.5,
  marginCm: 2.5,
};

let DOK: OpsiDokumen = { ...DOK_DEFAULT };

/** Setel pengaturan dokumen untuk pemanggilan berikutnya (sinkron). */
export function setelDokumen(o?: Partial<OpsiDokumen>) {
  DOK = { ...DOK_DEFAULT, ...o };
}

const RPR = (tebal: boolean, ukuran: number) =>
  `<w:rPr><w:rFonts w:ascii="${esc(DOK.font)}" w:hAnsi="${esc(DOK.font)}" w:cs="${esc(DOK.font)}" w:eastAsia="${esc(DOK.font)}"/>${
    tebal ? "<w:b/><w:bCs/>" : ""
  }<w:sz w:val="${ukuran}"/><w:szCs w:val="${ukuran}"/></w:rPr>`;

/**
 * Pecah teks menjadi run Word. Penanda footnote `[^n]` menjadi run
 * dengan Superscript + FootnoteReference (bukan teks mentah).
 */
function runs(teks: string, tebal: boolean, ukuran: number, catatan?: CatatanKaki): string {
  const def = catatan?.definisi ?? CATATAN?.definisi ?? new Map();
  const idUntuk = catatan?.idUntuk ?? CATATAN?.idUntuk;
  const bagian = teks.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return bagian
    .map((b) => {
      const isTebal = /^\*\*[^*]+\*\*$/.test(b);
      const isi = isTebal ? b.slice(2, -2) : b.replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1");
      if (!/\[\^[^\]\s]+\]/.test(isi)) {
        return `<w:r>${RPR(tebal || isTebal, ukuran)}<w:t xml:space="preserve">${esc(isi)}</w:t></w:r>`;
      }
      return pecahCatatan(isi, def)
        .map((pot) => {
          if (pot.jenis === "teks") {
            return `<w:r>${RPR(tebal || isTebal, ukuran)}<w:t xml:space="preserve">${esc(pot.isi)}</w:t></w:r>`;
          }
          const id = idUntuk?.(pot.nomor ?? "");
          if (id === undefined) {
            // Tanpa definisi: tampilkan penandainya apa adanya, jangan dihapus.
            return `<w:r>${RPR(tebal || isTebal, ukuran)}<w:t xml:space="preserve">${esc(pot.isi)}</w:t></w:r>`;
          }
          return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
        })
        .join("");
    })
    .join("");
}

/**
 * Kumpulan footnote untuk ekspor Word: definisi `[^n]` → teks, plus
 * pemetaan nomor penanda ke id internal Word.
 */
export interface CatatanKaki {
  definisi: Map<string, string>;
  idUntuk: (nomor: string) => number | undefined;
}

/** Id internal Word: 0 dan -1 dipakai separator; footnote asli mulai dari 1. */
let CATATAN: CatatanKaki | undefined;

function buatCatatanKaki(md: string): { catatan: CatatanKaki; dipakai: string[] } {
  const definisi = kumpulkanFootnote(md);
  const dipakai = Array.from(definisi.keys());
  const peta = new Map<string, number>();
  dipakai.forEach((nomor, i) => peta.set(nomor, i + 1));
  return {
    catatan: {
      definisi,
      idUntuk: (nomor) => peta.get(nomor),
    },
    dipakai,
  };
}

interface OpsiPar {
  tebal?: boolean;
  ukuran?: number;
  rata?: "both" | "center" | "right" | "left";
  indent?: boolean;
  jarak?: number;
}

/** Baris spasi dalam twips: 240 = spasi tunggal. */
function barisSpasi(): number {
  return Math.round(240 * DOK.spasi);
}

function par(teks: string, opsi: OpsiPar = {}): string {
  const { tebal = false, ukuran = Math.round(DOK.ukuranNaskah * 2), rata = "both", indent = true, jarak = 240 } = opsi;
  return `<w:p><w:pPr><w:bidi/><w:jc w:val="${rata}"/><w:spacing w:line="${barisSpasi()}" w:lineRule="auto" w:before="${jarak}" w:after="${jarak / 2}"/>${
    indent ? '<w:ind w:firstLine="567"/>' : ""
  }${RPR(tebal, ukuran)}</w:pPr>${runs(teks, tebal, ukuran)}</w:p>`;
}

function tabelWord(baris: string[][]): string {
  const kolom = Math.max(...baris.map((r) => r.length));
  const lebar = Math.floor(9000 / kolom);
  const batas =
    "<w:tblBorders>" +
    ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`)
      .join("") +
    "</w:tblBorders>";
  const rows = baris
    .map(
      (r, i) =>
        `<w:tr>${Array.from({ length: kolom })
          .map(
            (_, c) =>
              `<w:tc><w:tcPr><w:tcW w:w="${lebar}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr>${runs(
                r[c] ?? "",
                i === 0,
                24,
              )}</w:p></w:tc>`,
          )
          .join("")}</w:tr>`,
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/>${batas}<w:bidiVisual/></w:tblPr><w:tblGrid>${Array.from(
    { length: kolom },
    () => `<w:gridCol w:w="${lebar}"/>`,
  ).join("")}</w:tblGrid>${rows}</w:tbl>`;
}

/**
 * Konversi markdown ringan (yang dipakai aplikasi ini) menjadi
 * WordprocessingML, sekaligus menyiapkan bagian footnote (footnotes.xml).
 */
function dokumenDanCatatan(md: string): { body: string; footnotes: string } {
  const { catatan, dipakai } = buatCatatanKaki(md);
  CATATAN = catatan;
  const garis = buangDefinisi(md).replace(/\r\n/g, "\n").split("\n");
  const hasil: string[] = [];
  let i = 0;

  while (i < garis.length) {
    const baris = garis[i];
    const trim = baris.trim();

    if (!trim) {
      i += 1;
      continue;
    }

    if (trim.startsWith("|")) {
      const blok: string[] = [];
      while (i < garis.length && garis[i].trim().startsWith("|")) {
        blok.push(garis[i].trim());
        i += 1;
      }
      const isi = blok
        .filter((b) => !/^\|[\s:-]+\|$/.test(b))
        .map((b) =>
          b
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim()),
        );
      if (isi.length) hasil.push(tabelWord(isi));
      continue;
    }

    if (trim.startsWith("### ")) {
      hasil.push(par(trim.slice(4), { tebal: true, ukuran: Math.round(DOK.ukuranNaskah * 2) + 4, rata: "right", indent: false }));
      i += 1;
      continue;
    }
    if (trim.startsWith("## ")) {
      hasil.push(par(trim.slice(3), { tebal: true, ukuran: Math.round(DOK.ukuranNaskah * 2) + 2, rata: "right", indent: false }));
      i += 1;
      continue;
    }
    if (trim.startsWith("# ")) {
      hasil.push(par(trim.slice(2), { tebal: true, ukuran: Math.round(DOK.ukuranNaskah * 2) + 8, rata: "center", indent: false }));
      i += 1;
      continue;
    }
    if (trim.startsWith("> ")) {
      hasil.push(
        `<w:p><w:pPr><w:bidi/><w:jc w:val="both"/><w:ind w:right="567" w:left="567"/><w:pBdr><w:right w:val="single" w:sz="12" w:space="8" w:color="C39B32"/></w:pBdr></w:pPr>${runs(
          trim.slice(2),
          false,
          24,
        )}</w:p>`,
      );
      i += 1;
      continue;
    }
    if (/^[-*] /.test(trim)) {
      hasil.push(
        `<w:p><w:pPr><w:bidi/><w:jc w:val="both"/><w:ind w:right="567" w:hanging="284"/><w:spacing w:after="80" w:line="${barisSpasi()}" w:lineRule="auto"/></w:pPr>${runs(
          "• " + trim.slice(2),
          false,
          28,
        )}</w:p>`,
      );
      i += 1;
      continue;
    }
    if (/^\d+[.)] /.test(trim)) {
      hasil.push(
        `<w:p><w:pPr><w:bidi/><w:jc w:val="both"/><w:ind w:right="567" w:hanging="284"/><w:spacing w:after="80" w:line="${barisSpasi()}" w:lineRule="auto"/></w:pPr>${runs(
          trim,
          false,
          28,
        )}</w:p>`,
      );
      i += 1;
      continue;
    }
    if (/^---+$/.test(trim)) {
      hasil.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C39B32"/></w:pBdr></w:pPr></w:p>');
      i += 1;
      continue;
    }

    hasil.push(par(trim));
    i += 1;
  }

  return { body: hasil.join(""), footnotes: footnotesXml(dipakai, catatan.definisi) };
}

/** Konversi markdown ringan menjadi WordprocessingML (tanpa bagian footnote). */
export function markdownKeWord(md: string): string {
  return dokumenDanCatatan(md).body;
}

/**
 * Run-run isi footnote: segmen *miring* menjadi run <w:i/> (judul kitab/jurnal
 * pada gaya Turabian/Chicago), segmen lain teks polos. Penanda ** tidak dipakai
 * di footnote.
 */
function runsFootnote(teks: string, ukuran: number): string {
  return teks
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((seg) => {
      const miring = /^\*[^*]+\*$/.test(seg);
      const isi = miring ? seg.slice(1, -1) : seg;
      return `<w:r><w:rPr>${miring ? "<w:i/><w:iCs/>" : ""}<w:sz w:val="${ukuran}"/><w:szCs w:val="${ukuran}"/></w:rPr><w:t xml:space="preserve">${esc(isi)}</w:t></w:r>`;
    })
    .join("");
}

/** Bangun `word/footnotes.xml` berisi definisi footnote. */
function footnotesXml(dipakai: string[], definisi: Map<string, string>): string {
  const ukuran = Math.round(DOK.ukuranFootnote * 2);
  const isi = dipakai
    .map((nomor, i) => {
      const teks = definisi.get(nomor) ?? "";
      return `<w:footnote w:id="${i + 1}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/><w:bidi/><w:jc w:val="both"/><w:spacing w:after="0" w:line="${barisSpasi()}" w:lineRule="auto"/><w:rPr><w:sz w:val="${ukuran}"/><w:szCs w:val="${ukuran}"/></w:rPr></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/><w:sz w:val="${ukuran}"/><w:szCs w:val="${ukuran}"/></w:rPr><w:footnoteRef/></w:r><w:r><w:rPr><w:sz w:val="${ukuran}"/><w:szCs w:val="${ukuran}"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r>${runsFootnote(teks, ukuran)}</w:p></w:footnote>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>
<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
${isi}
</w:footnotes>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
</Relationships>`;

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${esc(DOK.font)}" w:hAnsi="${esc(DOK.font)}" w:cs="${esc(DOK.font)}"/><w:sz w:val="${Math.round(DOK.ukuranNaskah * 2)}"/><w:szCs w:val="${Math.round(DOK.ukuranNaskah * 2)}"/><w:lang w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:bidi/><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:pPr><w:bidi/><w:jc w:val="both"/></w:pPr><w:rPr><w:sz w:val="${Math.round(DOK.ukuranFootnote * 2)}"/><w:szCs w:val="${Math.round(DOK.ukuranFootnote * 2)}"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
</w:styles>`;
}

export function buatDocx(judul: string, markdown: string, opsi?: Partial<OpsiDokumen>): Blob {
  setelDokumen(opsi);
  const { body, footnotes } = dokumenDanCatatan(markdown);
  const dok = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${Math.round(DOK.marginCm * 567)}" w:right="${Math.round(DOK.marginCm * 567)}" w:bottom="${Math.round(DOK.marginCm * 567)}" w:left="${Math.round(DOK.marginCm * 567)}" w:header="709" w:footer="709" w:gutter="0"/><w:bidi/><w:docGrid w:linePitch="360"/></w:sectPr>
</w:body>
</w:document>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(judul)}</dc:title><dc:creator>Uthruha</dc:creator><cp:lastModifiedBy>Uthruha</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`;

  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Uthruha</Application></Properties>`;

  const bytes = zip([
    { nama: "[Content_Types].xml", isi: TEKS.encode(CONTENT_TYPES) },
    { nama: "_rels/.rels", isi: TEKS.encode(RELS) },
    { nama: "word/document.xml", isi: TEKS.encode(dok) },
    { nama: "word/_rels/document.xml.rels", isi: TEKS.encode(DOC_RELS) },
    { nama: "word/styles.xml", isi: TEKS.encode(stylesXml()) },
    { nama: "word/footnotes.xml", isi: TEKS.encode(footnotes) },
    { nama: "docProps/core.xml", isi: TEKS.encode(core) },
    { nama: "docProps/app.xml", isi: TEKS.encode(app) },
  ]);

  return new Blob([bytes as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function unduh(blob: Blob, namaBerkas: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
