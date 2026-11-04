"use client";

import { useEffect, useRef } from "react";
import type { SegmenPenanda } from "@/lib/engine/marker";
import { nomorTampil } from "@/lib/refs/footnote-markdown";

/**
 * Editor tulis Tahap 5: permukaan sunting yang merender penanda sitasi
 * [[ref:…]] sebagai CHIP bernomor footnote di dalam teks — teks mentah
 * penanda tidak pernah terlihat dan tidak bisa rusak sebagian.
 *
 * Model datanya tetap string draf yang sama (format simpan tidak
 * berubah): komponen ini memelihara DOM secara imperatif dari segmen
 * pecahSegmen(), dan setiap perubahan DOM diserialisasi kembali ke
 * string lewat `mentah` tiap segmen (round-trip persis). Offset seleksi
 * yang dilaporkan ke induk adalah offset pada STRING serial, sama
 * seperti selectionStart textarea lama, jadi alur Generate Footnote
 * (blok teks + tanam sesudah seleksi) bekerja tanpa perubahan makna.
 */

export interface FokusPenanda {
  jenis: "penanda" | "fragmen";
  id?: string;
  nomor: number | null;
  halaman?: string;
  jilid?: string;
  mentah: string;
}

interface Props {
  nilai: string;
  segmen: SegmenPenanda[];
  /** Nomor footnote per segmen penanda, sejajar urutan kemunculan
   *  segmen penanda di `segmen`; null = rujukan tak dikenal. */
  nomorSegmen: (number | null)[];
  angkaArab: boolean;
  placeholder?: string;
  onUbah: (teks: string) => void;
  /** nilaiKini = serialisasi DOM saat ini (selalu mutakhir, mendahului
   *  render ulang induk) agar induk memotong teks yang benar. */
  onSeleksi: (awal: number, akhir: number, nilaiKini: string) => void;
  onFokus: (info: FokusPenanda | null) => void;
}

function serialisasiNode(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? "";
  if (node.nodeType !== 1) {
    let out = "";
    node.childNodes.forEach((c) => {
      out += serialisasiNode(c);
    });
    return out;
  }
  const el = node as HTMLElement;
  if (el.dataset.penanda !== undefined || el.dataset.fragmen !== undefined) {
    return el.dataset.mentah ?? "";
  }
  if (el.tagName === "BR") return "\n";
  let out = "";
  el.childNodes.forEach((c) => {
    out += serialisasiNode(c);
  });
  if ((el.tagName === "DIV" || el.tagName === "P") && out && !out.endsWith("\n")) out += "\n";
  return out;
}

export function EditorPenanda({
  nilai,
  segmen,
  nomorSegmen,
  angkaArab,
  placeholder,
  onUbah,
  onSeleksi,
  onFokus,
}: Props) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ segmen, nomorSegmen, angkaArab, nilai });
  propsRef.current = { segmen, nomorSegmen, angkaArab, nilai };
  const terakhirRef = useRef<{ nilai: string; tanda: string }>({ nilai: "\u0000", tanda: "" });
  const offsetRef = useRef(0);
  const cbRef = useRef({ onUbah, onSeleksi, onFokus });
  cbRef.current = { onUbah, onSeleksi, onFokus };

  const tanda =
    nomorSegmen.join(",") +
    "|" +
    segmen.map((s) => (s.jenis === "penanda" ? `p:${s.id}` : s.jenis === "fragmen" ? "f" : "t")).join(",");

  function bacaSeleksi(): { awal: number; akhir: number } | null {
    const el = wadahRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
    const ukur = (node: Node, offset: number) => {
      const r = document.createRange();
      r.setStart(el, 0);
      r.setEnd(node, offset);
      return serialisasiNode(r.cloneContents()).length;
    };
    const a = ukur(range.startContainer, range.startOffset);
    const b = ukur(range.endContainer, range.endOffset);
    return a <= b ? { awal: a, akhir: b } : { awal: b, akhir: a };
  }

  function tempatkanKaret(offset: number) {
    const el = wadahRef.current;
    if (!el) return;
    const { segmen: segs } = propsRef.current;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let sisa = Math.max(0, offset);
    const anak = Array.from(el.childNodes);
    for (let idx = 0; idx < anak.length; idx++) {
      const s = segs[idx];
      const node = anak[idx];
      if (!s || !node) break;
      if (s.jenis === "teks") {
        if (sisa <= s.mentah.length) {
          range.setStart(node, Math.min(sisa, (node.textContent ?? "").length));
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        sisa -= s.mentah.length;
      } else {
        if (sisa === 0) {
          range.setStartBefore(node);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        if (sisa <= s.mentah.length) {
          range.setStartAfter(node);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        sisa -= s.mentah.length;
      }
    }
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function bangun() {
    const el = wadahRef.current;
    if (!el) return;
    const { segmen: segs, nomorSegmen: nomor, angkaArab: aa } = propsRef.current;
    const punyaFokus = document.activeElement === el;
    el.textContent = "";
    let idxPenanda = -1;
    for (const s of segs) {
      if (s.jenis === "teks") {
        el.appendChild(document.createTextNode(s.mentah));
        continue;
      }
      const chip = document.createElement("span");
      chip.contentEditable = "false";
      chip.dataset.mentah = s.mentah;
      if (s.jenis === "penanda") {
        idxPenanda++;
        const no = nomor[idxPenanda] ?? null;
        chip.dataset.penanda = "1";
        chip.dataset.id = s.id;
        if (no !== null) chip.dataset.nomor = String(no);
        if (s.halaman) chip.dataset.halaman = s.halaman;
        if (s.jilid) chip.dataset.jilid = s.jilid;
        if (no !== null) {
          chip.className =
            "mx-0.5 inline-block cursor-pointer select-none rounded-md bg-gold-500/20 px-1 align-super font-sans text-[10.5px] font-bold leading-normal text-ink-900";
          chip.textContent = nomorTampil(String(no), aa);
          chip.title = `Footnote ${no} — klik untuk melihat sumbernya`;
        } else {
          chip.className =
            "mx-0.5 inline-block cursor-pointer select-none rounded-md bg-red-100 px-1 align-super font-sans text-[10.5px] font-bold leading-normal text-red-800 ring-1 ring-red-300";
          chip.textContent = "⚠";
          chip.title = `Rujukan tidak ditemukan: ${s.id} — klik untuk rincian`;
        }
      } else {
        chip.dataset.fragmen = "1";
        chip.className =
          "mx-0.5 inline-block cursor-pointer select-none rounded-md bg-amber-100 px-1 font-sans text-[10.5px] font-bold leading-normal text-amber-900 ring-1 ring-dashed ring-amber-400";
        chip.textContent = "⚠ penanda rusak";
        chip.title = "Fragmen penanda sitasi rusak — klik untuk rincian";
      }
      el.appendChild(chip);
    }
    terakhirRef.current = { nilai: propsRef.current.nilai, tanda };
    if (punyaFokus) tempatkanKaret(Math.min(offsetRef.current, propsRef.current.nilai.length));
  }

  // Bangun ulang hanya bila isi berubah dari luar editor ini, atau
  // nomor/label chip berubah (penanda ditambah/dihapus/digeser).
  useEffect(() => {
    if (terakhirRef.current.nilai !== nilai || terakhirRef.current.tanda !== tanda) bangun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nilai, tanda]);

  // Laporkan seleksi (offset string serial) setiap kali berubah di editor.
  useEffect(() => {
    const dengar = () => {
      const el = wadahRef.current;
      if (!el || document.activeElement !== el) return;
      const s = bacaSeleksi();
      if (s) {
        offsetRef.current = s.akhir;
        cbRef.current.onSeleksi(s.awal, s.akhir, serialisasiNode(el));
      }
    };
    document.addEventListener("selectionchange", dengar);
    return () => document.removeEventListener("selectionchange", dengar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tanganiInput() {
    const el = wadahRef.current;
    if (!el) return;
    const hasil = serialisasiNode(el);
    const s = bacaSeleksi();
    if (s) offsetRef.current = s.akhir;
    terakhirRef.current = { nilai: hasil, tanda };
    if (hasil !== propsRef.current.nilai) cbRef.current.onUbah(hasil);
  }

  function sisipTeks(pengganti: string) {
    const s = bacaSeleksi() ?? { awal: offsetRef.current, akhir: offsetRef.current };
    const kini = propsRef.current.nilai;
    const baru = kini.slice(0, s.awal) + pengganti + kini.slice(s.akhir);
    offsetRef.current = s.awal + pengganti.length;
    cbRef.current.onUbah(baru);
    // Nilai prop berubah → effect membangun ulang DOM dan menaruh
    // karet pada offsetRef lewat bangun().
  }

  return (
    <div
      ref={wadahRef}
      contentEditable
      suppressContentEditableWarning
      dir="rtl"
      role="textbox"
      aria-multiline="true"
      aria-label="Editor naskah"
      spellCheck={false}
      data-placeholder={placeholder}
      onInput={tanganiInput}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sisipTeks("\n");
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const teksTempel = e.clipboardData.getData("text/plain");
        if (teksTempel) sisipTeks(teksTempel);
      }}
      onCopy={(e) => {
        const s = bacaSeleksi();
        if (s && s.akhir > s.awal) {
          e.preventDefault();
          e.clipboardData.setData("text/plain", propsRef.current.nilai.slice(s.awal, s.akhir));
        }
      }}
      onCut={(e) => {
        const s = bacaSeleksi();
        if (s && s.akhir > s.awal) {
          e.preventDefault();
          e.clipboardData.setData("text/plain", propsRef.current.nilai.slice(s.awal, s.akhir));
          sisipTeks("");
        }
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const chip = target.closest<HTMLElement>("[data-penanda],[data-fragmen]");
        const el = wadahRef.current;
        if (chip && el && el.contains(chip)) {
          if (chip.dataset.penanda !== undefined) {
            cbRef.current.onFokus({
              jenis: "penanda",
              id: chip.dataset.id,
              nomor: chip.dataset.nomor ? Number(chip.dataset.nomor) : null,
              halaman: chip.dataset.halaman,
              jilid: chip.dataset.jilid,
              mentah: chip.dataset.mentah ?? "",
            });
          } else {
            cbRef.current.onFokus({ jenis: "fragmen", nomor: null, mentah: chip.dataset.mentah ?? "" });
          }
        } else {
          cbRef.current.onFokus(null);
        }
      }}
      className="doc-scroll min-h-[26rem] w-full cursor-text overflow-auto whitespace-pre-wrap break-words rounded-xl border border-ink-900/15 bg-white p-4 text-right font-naskh text-[15.5px] leading-[2.1] text-ink-900 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 empty:before:pointer-events-none empty:before:text-ink-400 empty:before:content-[attr(data-placeholder)]"
    />
  );
}
