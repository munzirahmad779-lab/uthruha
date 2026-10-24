import { Fragment, type ReactNode } from "react";
import {
  buangDefinisi,
  kumpulkanFootnote,
  nomorTampil,
  pecahCatatan,
  type DefinisiFootnote,
} from "@/lib/refs/footnote-markdown";

/**
 * Pratinjau naskah dengan dukungan footnote `[^n]`.
 *
 * Footnote ditampilkan sebagai nomor kecil berganda di dalam teks, lalu
 * daftar notaIts dirender di akhir bagian. Bila nomor tidak punya
 * definisi, penandainya tetap terlihat (tidak hilang diam-diam).
 */
export function Manuscript({
  md,
  className = "",
  kosong = "Belum ada draf. Susun dulu di tab Struktur, lalu tekan «Susun draf».",
  angkaArab = true,
}: {
  md: string;
  className?: string;
  kosong?: string;
  angkaArab?: boolean;
}) {
  const definisi = kumpulkanFootnote(md);
  const badan = buangDefinisi(md);

  if (!badan.trim() || (!md || md.trim().length === 0)) {
    return <p className="rounded-xl bg-parchment-100 p-4 text-sm text-ink-600">{kosong}</p>;
  }

  const blok = uraikan(badan);

  return (
    <div dir="rtl" className={`manuscript ${className}`}>
      {blok.map((b, i) => {
        if (b.jenis === "judul") {
          const Tag = (b.level === 1 ? "h1" : b.level === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
          return <Tag key={i}>{inline(b.teks, `h${i}`, definisi)}</Tag>;
        }
        if (b.jenis === "paragraf") return <p key={i}>{inline(b.teks, `p${i}`, definisi)}</p>;
        if (b.jenis === "kutipan")
          return (
            <blockquote key={i} className="rounded-e-md bg-gold-100/40 py-1">
              {inline(b.teks, `q${i}`, definisi)}
            </blockquote>
          );
        if (b.jenis === "garis") return <hr key={i} className="my-6 border-ink-900/10" />;
        if (b.jenis === "tabel")
          return (
            <div key={i} className="my-5 overflow-x-auto no-scrollbar">
              <table>
                <thead>
                  <tr>
                    {b.head.map((h, j) => (
                      <th key={j}>{inline(h, `th${i}${j}`, definisi)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.baris.map((r, j) => (
                    <tr key={j}>
                      {r.map((c, k) => (
                        <td key={k}>{inline(c, `td${i}${j}${k}`, definisi)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        const Tag = b.urut ? "ol" : "ul";
        return (
          <Tag key={i}>
            {b.item.map((it, j) => (
              <li key={j}>{inline(it, `li${i}${j}`, definisi)}</li>
            ))}
          </Tag>
        );
      })}
      <DaftarCatatan definisi={definisi} angkaArab={angkaArab} />
    </div>
  );
}

function DaftarCatatan({
  definisi,
  angkaArab,
}: {
  definisi: DefinisiFootnote;
  angkaArab: boolean;
}) {
  if (definisi.size === 0) return null;
  const urut = Array.from(definisi.keys());

  return (
    <section className="mt-8 border-t border-ink-900/10 pt-4">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">الحواشي</h3>
      <ol className="space-y-1.5">
        {urut.map((nomor) => (
          <li key={nomor} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-700">
            <span className="shrink-0 font-semibold text-ink-500">{nomorTampil(nomor, angkaArab)}</span>
            <span dir="rtl" className="min-w-0">
              {inline(definisi.get(nomor) ?? "", `fn${nomor}`)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function inline(teks: string, keyPrefix: string, definisi?: DefinisiFootnote): ReactNode[] {
  const bagian = teks.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter((s) => s !== "");
  return bagian.map((b, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(b)) return <strong key={key}>{b.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(b)) return <em key={key}>{b.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(b)) {
      return (
        <code key={key} className="rounded bg-ink-900/5 px-1 py-0.5 font-mono text-[0.9em]">
          {b.slice(1, -1)}
        </code>
      );
    }
    // Penanda footnote `[^n]` → nomor superscript.
    if (/\[\^[^\]\s]+\]/.test(b)) {
      return (
        <Fragment key={key}>
          {pecahCatatan(b, definisi ?? new Map()).map((p, j) =>
            p.jenis === "catatan" ? (
              <sup
                key={`${key}-${j}`}
                className={`mx-0.5 text-[0.7em] font-semibold ${
                  p.ada ? "text-ink-700" : "text-red-700"
                }`}
                title={p.ada ? p.isi : "Footnote ini belum punya definisi"}
              >
                {nomorTampil(p.nomor ?? "", true)}
              </sup>
            ) : (
              <Fragment key={`${key}-${j}`}>{p.isi}</Fragment>
            ),
          )}
        </Fragment>
      );
    }
    return <Fragment key={key}>{b}</Fragment>;
  });
}

type Blok =
  | { jenis: "judul"; level: number; teks: string }
  | { jenis: "paragraf"; teks: string }
  | { jenis: "daftar"; urut: boolean; item: string[] }
  | { jenis: "kutipan"; teks: string }
  | { jenis: "tabel"; head: string[]; baris: string[][] }
  | { jenis: "garis" };

function uraikan(md: string): Blok[] {
  const garis = md.replace(/\r\n/g, "\n").split("\n");
  const blok: Blok[] = [];
  let i = 0;

  while (i < garis.length) {
    const trim = garis[i].trim();
    if (!trim) {
      i += 1;
      continue;
    }

    if (/^#{1,4} /.test(trim)) {
      const m = /^(#{1,4}) (.*)$/.exec(trim)!;
      blok.push({ jenis: "judul", level: m[1].length, teks: m[2] });
      i += 1;
      continue;
    }

    if (trim.startsWith("|")) {
      const isi: string[][] = [];
      while (i < garis.length && garis[i].trim().startsWith("|")) {
        const b = garis[i].trim();
        if (!/^\|[\s:|-]+\|$/.test(b)) {
          isi.push(
            b
              .replace(/^\|/, "")
              .replace(/\|$/, "")
              .split("|")
              .map((c) => c.trim()),
          );
        }
        i += 1;
      }
      if (isi.length > 0) blok.push({ jenis: "tabel", head: isi[0], baris: isi.slice(1) });
      continue;
    }

    if (/^[-*] /.test(trim)) {
      const item: string[] = [];
      while (i < garis.length && /^[-*] /.test(garis[i].trim())) {
        item.push(garis[i].trim().slice(2));
        i += 1;
      }
      blok.push({ jenis: "daftar", urut: false, item });
      continue;
    }

    if (/^\d+[.)] /.test(trim)) {
      const item: string[] = [];
      while (i < garis.length && /^\d+[.)] /.test(garis[i].trim())) {
        item.push(garis[i].trim().replace(/^\d+[.)] /, ""));
        i += 1;
      }
      blok.push({ jenis: "daftar", urut: true, item });
      continue;
    }

    if (trim.startsWith("> ")) {
      blok.push({ jenis: "kutipan", teks: trim.slice(2) });
      i += 1;
      continue;
    }

    if (/^---+$/.test(trim)) {
      blok.push({ jenis: "garis" });
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (
      i < garis.length &&
      garis[i].trim() &&
      !/^#{1,4} |^\||^[-*] |^\d+[.)] |^> |^---+$/.test(garis[i].trim())
    ) {
      para.push(garis[i].trim());
      i += 1;
    }
    blok.push({ jenis: "paragraf", teks: para.join(" ") });
  }

  return blok;
}
