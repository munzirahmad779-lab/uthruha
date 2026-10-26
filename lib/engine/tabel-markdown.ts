/** Util tabel Markdown ringan: sel boleh memuat karakter pipa dan garis miring terbalik. */

/** Tulis satu sel tabel dengan aman: pipa dan backslash di-escape agar tidak memecah kolom. */
export function bersihSelTabel(sel: string): string {
  return sel.replace(/\n/g, " ").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function berakhirDenganPipaPemisah(baris: string): boolean {
  if (!baris.endsWith("|")) return false;
  let miring = 0;
  for (let i = baris.length - 2; i >= 0 && baris[i] === "\\"; i -= 1) miring += 1;
  return miring % 2 === 0;
}

/** Pecah satu baris tabel Markdown menjadi sel, menghormati escape `\|` dan `\\`. */
export function pecahBarisTabel(barisMentah: string): string[] {
  const baris = barisMentah.trim();
  const sel: string[] = [];
  let kini = "";
  for (let i = 0; i < baris.length; i += 1) {
    const ch = baris[i] ?? "";
    const berikut = baris[i + 1] ?? "";
    if (ch === "\\" && (berikut === "|" || berikut === "\\")) {
      kini += berikut;
      i += 1;
      continue;
    }
    if (ch === "|") {
      sel.push(kini.trim());
      kini = "";
      continue;
    }
    kini += ch;
  }
  sel.push(kini.trim());
  if (baris.startsWith("|")) sel.shift();
  if (berakhirDenganPipaPemisah(baris)) sel.pop();
  return sel;
}
