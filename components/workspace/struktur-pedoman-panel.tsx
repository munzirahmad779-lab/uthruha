"use client";

import { useState } from "react";
import type { Project } from "@/lib/engine/project";
import {
  PROMPT_PAKET_STRUKTUR,
  buatPromptPerbaikan,
  strukturKeDaftarIsi,
  validasiTempelanStruktur,
  type GalatBidang,
  type StrukturPedoman,
} from "@/lib/pedoman/skema-struktur";
import { CopyButton, Note } from "@/components/ui";
import { IconCheck, IconSparkle } from "@/components/icons";

const AI_LUAR = [
  { nama: "ChatGPT", url: "https://chatgpt.com" },
  { nama: "Claude", url: "https://claude.ai" },
  { nama: "Gemini", url: "https://gemini.google.com" },
  { nama: "Meta AI", url: "https://www.meta.ai" },
];

const MAKS_PUTARAN = 3;

/**
 * Panel STRUKTUR PEDOMAN (Fase 3, keputusan F): mahasiswa mengulik PDF
 * pedoman di AI luar memakai paket prompt resmi (skema tetap), menempel
 * hasilnya di sini, dan server... klien memvalidasinya dengan skema Zod
 * yang sama. Gagal → daftar error per bidang + prompt perbaikan siap salin
 * (maks 3 putaran). Lolos → pratinjau → terapkan menjadi daftar isi proyek.
 */
export function StrukturPedomanPanel({
  p,
  ubah,
}: {
  p: Project;
  ubah: (patch: Partial<Project>) => void;
}) {
  const [tempel, setTempel] = useState("");
  const [galat, setGalat] = useState<GalatBidang[]>([]);
  const [putaran, setPutaran] = useState(0);
  const [pratinjau, setPratinjau] = useState<StrukturPedoman | null>(null);
  const [pesan, setPesan] = useState("");

  function periksa() {
    setPesan("");
    const hasil = validasiTempelanStruktur(tempel);
    if (!hasil.ok || !hasil.data) {
      setGalat(hasil.galat);
      setPratinjau(null);
      return;
    }
    setGalat([]);
    setPratinjau(hasil.data);
  }

  function terapkan() {
    if (!pratinjau) return;
    ubah({
      strukturPedoman: pratinjau,
      daftarIsi: strukturKeDaftarIsi(pratinjau),
    });
    setPesan(
      `Struktur "${pratinjau.namaPedoman}" diterapkan: daftar isi proyek kini mengikuti ${pratinjau.bab.length} bab pedoman. Lihat di tab Struktur.`,
    );
    setPratinjau(null);
    setTempel("");
    setPutaran(0);
  }

  return (
    <div className="rounded-xl border border-ink-900/10 bg-white/60 p-4">
      <h3 className="text-[13px] font-bold text-ink-900">Struktur pedoman → daftar isi otomatis</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
        Ulik buku pedoman kampus Anda (PDF) dengan bantuan AI luar, lalu tempel hasilnya di sini.
        Uthruha memvalidasinya dengan skema tetap dan menyusun daftar isi proyek mengikuti logika
        pedoman itu — bab demi bab, lengkap dengan aturan wajibnya.
      </p>

      <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-ink-700">
        <li>
          Salin <strong>paket prompt</strong> di bawah.
        </li>
        <li>
          Buka AI pilihan Anda, unggah PDF pedoman, lalu tempel prompt-nya:{" "}
          {AI_LUAR.map((a, i) => (
            <span key={a.nama}>
              {i > 0 && " · "}
              <a href={a.url} target="_blank" rel="noreferrer" className="font-semibold text-gold-700 underline underline-offset-2">
                {a.nama} ↗
              </a>
            </span>
          ))}
        </li>
        <li>Salin blok JSON hasil AI dan tempel ke kolom di bawah, lalu periksa.</li>
      </ol>

      <details className="mt-3 rounded-lg border border-ink-900/10 p-3">
        <summary className="cursor-pointer text-[12px] font-semibold text-ink-800">
          Paket prompt resmi Uthruha
        </summary>
        <div className="mt-2 flex justify-end">
          <CopyButton teks={PROMPT_PAKET_STRUKTUR} />
        </div>
        <pre className="doc-scroll mt-1 max-h-56 overflow-auto rounded-lg bg-parchment-100/80 p-3 text-[11px] leading-relaxed text-ink-700">
          {PROMPT_PAKET_STRUKTUR}
        </pre>
      </details>

      <label className="label mt-4">Tempel hasil ulikan (blok JSON dari AI luar)</label>
      <textarea
        value={tempel}
        onChange={(e) => setTempel(e.target.value)}
        className="input min-h-28 font-mono text-[11.5px]"
        placeholder='{"versiSkema":"pedoman-struktur-v1","namaPedoman":"…","bab":[…]}'
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={periksa} disabled={!tempel.trim()} className="btn-quiet disabled:opacity-40">
          <IconCheck className="h-3.5 w-3.5" /> Periksa struktur
        </button>
        {p.strukturPedoman && (
          <span className="text-[11px] text-emerald-700">
            Struktur aktif: {p.strukturPedoman.namaPedoman} ({p.strukturPedoman.bab.length} bab)
          </span>
        )}
      </div>

      {galat.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-[12px] font-bold text-red-800">
            Belum sesuai skema — {galat.length} hal harus diperbaiki:
          </p>
          <ul className="mt-1.5 space-y-1">
            {galat.map((g, i) => (
              <li key={i} className="text-[12px] text-red-700">
                · <span className="font-mono font-semibold">{g.jalur}</span>: {g.pesan}
              </li>
            ))}
          </ul>
          {putaran < MAKS_PUTARAN ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-quiet"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(buatPromptPerbaikan(tempel, galat));
                  } catch { /* clipboard ditolak; pengguna bisa menyalin manual dari daftar error */ }
                  setPutaran((n) => n + 1);
                }}
              >
                Salin prompt perbaikan
              </button>
              <span className="text-[11px] text-red-600">
                Salin prompt perbaikan ini ke AI yang sama (putaran {putaran + 1} dari {MAKS_PUTARAN}).
              </span>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-red-700">
              Sudah {MAKS_PUTARAN} putaran perbaikan. Gunakan jalur manual: susun daftar isi langsung
              di tab Struktur, atau tempel pedoman teks lewat panel Pedoman di atas.
            </p>
          )}
        </div>
      )}

      {pratinjau && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-900">
            <IconSparkle className="h-3.5 w-3.5" /> Pratinjau — {pratinjau.namaPedoman}
          </p>
          <ul className="mt-2 space-y-1.5">
            {pratinjau.bab.map((b) => (
              <li key={b.nomor} className="text-[12px] leading-relaxed text-ink-800">
                <strong>
                  Bab {b.nomor}. {b.nama}
                </strong>
                {b.subBab.length > 0 && (
                  <span className="text-ink-600"> — {b.subBab.map((s) => s.nama).join("; ")}</span>
                )}
                {b.aturan.length > 0 && (
                  <span className="text-ink-500"> ({b.aturan.length} aturan)</span>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={terapkan} className="btn-primary mt-3">
            Terapkan jadi daftar isi proyek
          </button>
        </div>
      )}

      {pesan && (
        <div className="mt-3">
          <Note jenis="info">{pesan}</Note>
        </div>
      )}
    </div>
  );
}
