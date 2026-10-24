"use client";

import { useRef, useState } from "react";
import type { Project } from "@/lib/engine/project";
import { parsePedoman, ringkasPedoman, pedomanDefault, PROMPT_PEDOMAN, type PedomanRules } from "@/lib/refs/pedoman";
import { IconCheck, IconDoc, IconDownload, IconSparkle, IconTrash } from "@/components/icons";
import { CopyButton, Note } from "@/components/ui";

export function PedomanPanel({
  p,
  ubah,
}: {
  p: Project;
  ubah: (patch: Partial<Project>) => void;
}) {
  const pedoman: PedomanRules | null = p.pedoman ?? null;
  const [tempel, setTempel] = useState("");
  const [galat, setGalat] = useState("");
  const [promptBuka, setPromptBuka] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  function pakai(teks: string, nama: string) {
    setGalat("");
    if (teks.trim().length < 40) {
      setGalat("Isi pedoman terlalu pendek untuk dibaca. Tempel bagian aturan format dan sitasi.");
      return;
    }
    ubah({ pedoman: parsePedoman(teks, nama) });
    setTempel("");
  }

  async function bacaBerkas(f: File | undefined) {
    if (!f) return;
    if (!/\.(md|markdown|txt)$/i.test(f.name)) {
      setGalat("Gunakan berkas .md (markdown). Berkas lain belum didukung.");
      return;
    }
    if (f.size > 400_000) {
      setGalat("Berkas terlalu besar (maksimal 400 KB).");
      return;
    }
    const teks = await f.text();
    pakai(teks, f.name);
  }

  function unduhContoh() {
    const contoh = `# Pedoman Penulisan Universitas Contoh
## Format Naskah
- Font Arab: Traditional Arabic 16 pt
- Ukuran footnote: 14 pt
- Spasi: 1,5
- Margin: 2,5 cm
- Angka: Arab
## Sitasi
- Gaya: catatan kaki
- Penomoran footnote: per bab
- Contoh footnote: النووي، الأذكار، (بيروت: دار الفكر، 2000)، ص 12.
- Contoh daftar pustaka: النووي. الأذكار. بيروت: دار الفكر، 2000.
## Aturan lain
- Kutipan langsung lebih dari 5 baris ditulis menjorok tanpa tanda kutip.
`;
    const blob = new Blob([contoh], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pedoman-contoh.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ink-900/10 bg-white/70 p-4">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-600">Pedoman kampus</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-700">
          Unggah berkas <span className="font-semibold">.md</span> hasil olahan AI (DeepSeek, Meta AI, dll.) dari buku
          pedoman kampus Anda. Uthruha membaca aturan format dan sitasi, lalu memakainya untuk footnote, daftar pustaka,
          dan berkas Word.
        </p>

        {!pedoman ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => berkas.current?.click()} className="btn-primary">
                <IconDoc className="h-4 w-4" /> Unggah pedoman.md
              </button>
              <button type="button" onClick={() => setPromptBuka((v) => !v)} className="btn-quiet">
                <IconSparkle className="h-3.5 w-3.5" /> Buat Prompt untuk AI
              </button>
              <button type="button" onClick={unduhContoh} className="btn-quiet">
                <IconDownload className="h-3.5 w-3.5" /> Contoh .md
              </button>
            </div>
            <input
              ref={berkas}
              type="file"
              accept=".md,.markdown,.txt,text/markdown"
              onChange={(e) => void bacaBerkas(e.target.files?.[0])}
              className="hidden"
            />

            <div className="mt-3">
              <label className="label">Atau tempel isi pedoman di sini</label>
              <textarea
                value={tempel}
                onChange={(e) => setTempel(e.target.value)}
                className="input min-h-24 text-[12px]"
                placeholder="Tempel aturan format dan sitasi dari pedoman kampus…"
              />
              <button
                type="button"
                onClick={() => pakai(tempel, "tempel.md")}
                className="btn-quiet mt-2"
                disabled={!tempel.trim()}
              >
                <IconCheck className="h-3.5 w-3.5" /> Baca pedoman
              </button>
            </div>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800">
                terbaca: {pedoman.namaBerkas}
              </span>
              {pedoman.namaKampus && (
                <span className="text-[11px] text-ink-600">{pedoman.namaKampus}</span>
              )}
              <button
                type="button"
                onClick={() => ubah({ pedoman: null })}
                className="btn-quiet !px-2 !py-1 !text-[11px]"
              >
                <IconTrash className="h-3 w-3" /> Hapus
              </button>
              <button type="button" onClick={() => berkas.current?.click()} className="btn-quiet !px-2 !py-1 !text-[11px]">
                Ganti berkas
              </button>
              <input
                ref={berkas}
                type="file"
                accept=".md,.markdown,.txt,text/markdown"
                onChange={(e) => void bacaBerkas(e.target.files?.[0])}
                className="hidden"
              />
            </div>

            <div className="rounded-lg bg-parchment-100/80 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Aturan yang dipakai</p>
              <ul className="mt-1 space-y-1">
                {ringkasPedoman(pedoman).map((r) => (
                  <li key={r} className="text-[12px] leading-relaxed text-ink-800">
                    · {r}
                  </li>
                ))}
              </ul>
            </div>

            {pedoman.catatan.length > 0 && (
              <details className="rounded-lg border border-ink-900/10 p-3">
                <summary className="cursor-pointer text-[11.5px] font-semibold text-ink-700">
                  Asal setiap nilai ({pedoman.catatan.length}) — untuk audit
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {pedoman.catatan.map((c) => (
                    <li key={c.label + c.nilai} className="text-[11px] leading-relaxed text-ink-600">
                      <span className="font-semibold text-ink-800">{c.label}:</span> {c.nilai}
                      <br />
                      <span className="text-ink-400">dari: {c.asal || "—"}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {pedoman.default.length > 0 && (
              <Note jenis="warn">
                Tidak terbaca dari berkas, jadi memakai nilai bawaan: {pedoman.default.join("; ")}. Periksa manual bila
                kampus Anda berbeda.
              </Note>
            )}
          </div>
        )}

        {galat && <div className="mt-3"><Note jenis="warn">{galat}</Note></div>}
      </div>

      {promptBuka && (
        <div className="rounded-xl border border-gold-500/50 bg-gold-500/5 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-600">Prompt untuk AI</h4>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-700">
                Salin prompt ini ke DeepSeek atau Meta AI bersama teks pedoman kampus Anda. AI akan mengubahnya menjadi
                berkas <span className="font-semibold">.md</span> yang bisa diunggah di atas. Uthruha sendiri tidak
                memanggil AI.
              </p>
            </div>
            <CopyButton teks={PROMPT_PEDOMAN} />
          </div>
          <pre className="doc-scroll mt-2 max-h-64 overflow-auto rounded-lg bg-white/80 p-3 text-[11px] leading-relaxed text-ink-700">
            {PROMPT_PEDOMAN}
          </pre>
        </div>
      )}

      {!pedoman && (
        <Note jenis="info">
          Tanpa pedoman, Uthruha memakai bawaan: {pedomanDefault().fontArab} {pedomanDefault().ukuranNaskah} pt, footnote{" "}
          {pedomanDefault().ukuranFootnote} pt, spasi 1,5. Footnote tidak diklaim sesuai pedoman kampus Anda.
        </Note>
      )}
    </div>
  );
}
