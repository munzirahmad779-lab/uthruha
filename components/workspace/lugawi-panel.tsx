"use client";

import { useState } from "react";
import type { Sumber } from "@/lib/engine/cite";
import {
  cariJurnalTopik,
  cariKitabKalimat,
  type HitKitabMentah,
} from "@/lib/engine/pencarian-topik";
import {
  cekWikipediaArab,
  cekWikipediaIndonesia,
  cekWiktionary,
  etimologiDari,
  mengandungArab,
  padananArabDari,
  promptMuseLugawi,
  simpulkanLugawi,
  amanUrl,
  KETERANGAN_JAM_CHAT,
  TAUTAN_BOT_TELEGRAM,
  type EntriKamus,
} from "@/lib/engine/lugawi";
import { CopyButton, Note } from "@/components/ui";
import { PetunjukCtrlF } from "@/components/workspace/ctrl-f";

/**
 * Panel Lugawi & Istilahi — menjawab kesulitan mahasiswa mencari makna kamus
 * (lugawi) dan makna istilah (istilahi) satu kata, termasuk kata serapan dan
 * istilah kontemporer non-Arab: dicek ke kitab, kamus/ensiklopedia terbuka,
 * dan jurnal; kesimpulan bertingkat; bila mentok, prompt siap salin ke Yusuf AI.
 */
export function LugawiPanel({ online }: { online: boolean }) {
  const [kata, setKata] = useState("");
  const [bentukArab, setBentukArab] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [sudahCari, setSudahCari] = useState(false);
  const [kamus, setKamus] = useState<EntriKamus[]>([]);
  const [etimologi, setEtimologi] = useState("");
  const [padanan, setPadanan] = useState<string | null>(null);
  const [hitsKitab, setHitsKitab] = useState<HitKitabMentah[]>([]);
  const [jurnal, setJurnal] = useState<Sumber[]>([]);
  const [kataKitabDipakai, setKataKitabDipakai] = useState("");

  async function periksa() {
    const k = kata.trim();
    if (!k || sibuk) return;
    setSibuk(true);
    setSudahCari(false);
    try {
      const arab = mengandungArab(k);
      const [wikt, wiki] = await Promise.all([
        cekWiktionary(k),
        arab ? cekWikipediaArab(k) : cekWikipediaIndonesia(k),
      ]);
      const pad = wikt ? padananArabDari(wikt.mentah) : null;
      const kataKitab = arab ? k : bentukArab.trim() || pad || "";
      const [kitabRes, jurnalRes] = await Promise.all([
        kataKitab
          ? cariKitabKalimat([kataKitab], "")
          : Promise.resolve({ hits: [] as HitKitabMentah[] }),
        cariJurnalTopik({
          arab: arab ? [k] : [],
          indonesia: arab ? [] : [k],
          inggris: arab ? [] : [k],
          sumber: "lugawi-istilahi",
        }),
      ]);
      setKamus([wikt, wiki].filter((e): e is EntriKamus => !!e));
      setEtimologi(wikt ? etimologiDari(wikt.mentah) : "");
      setPadanan(pad);
      setHitsKitab(kitabRes.hits);
      setJurnal(jurnalRes.entri);
      setKataKitabDipakai(kataKitab);
      setSudahCari(true);
    } finally {
      setSibuk(false);
    }
  }

  const arab = mengandungArab(kata.trim());
  const kesimpulan = sudahCari
    ? simpulkanLugawi({
        adaKitab: hitsKitab.length > 0,
        adaKamus: arab && kamus.length > 0,
        adaPadanan: !!padanan,
        adaJurnal: jurnal.length > 0,
      })
    : null;
  const prompt = promptMuseLugawi(kata.trim() || "…");

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-ink-600">
        Periksa makna <strong>lugawi</strong> (kamus) &amp; <strong>istilahi</strong> (istilah) satu kata —
        termasuk kata serapan dan istilah kontemporer dari bahasa apa pun (Inggris, Belanda, Swiss, dst).
        Web menelusuri kitab, kamus/ensiklopedia terbuka, dan jurnal, lalu menyimpulkan status kata itu.
      </p>

      <div className="flex flex-wrap items-start gap-2">
        <input
          className="input min-w-44 flex-1 !py-2 text-[13px]"
          dir="auto"
          value={kata}
          onChange={(e) => setKata(e.target.value)}
          placeholder="Kata yang dicari maknanya — Arab atau bahasa lain, cth: بوفية / bufiyah"
        />
        {!arab && (
          <input
            className="input w-44 !py-2 text-right font-naskh text-[13px]"
            dir="rtl"
            value={bentukArab}
            onChange={(e) => setBentukArab(e.target.value)}
            placeholder="Bentuk Arabnya (bila tahu)"
          />
        )}
        <button type="button" className="btn-primary !py-2" disabled={!online || sibuk || kata.trim().length < 2} onClick={periksa}>
          {sibuk ? "Memeriksa…" : "Periksa makna"}
        </button>
      </div>
      {!online && <Note>Anda sedang offline — pemeriksaan makna butuh internet.</Note>}

      {kesimpulan && (
        <div
          className={`rounded-xl border p-3 text-[12.5px] leading-relaxed ${
            kesimpulan.tingkat === "di-kitab"
              ? "border-emerald-600/30 bg-emerald-50 text-emerald-900"
              : kesimpulan.tingkat === "ada-padanan"
                ? "border-amber-500/40 bg-amber-50 text-amber-900"
                : "border-ink-900/15 bg-parchment-100/80 text-ink-800"
          }`}
        >
          <span className="font-bold">
            {kesimpulan.tingkat === "di-kitab" ? "Ditemukan di kitab Arab. " : kesimpulan.tingkat === "di-kamus" ? "Ada entri kamus terbuka. " : kesimpulan.tingkat === "ada-padanan" ? "Istilah kontemporer / kata serapan. " : "Belum ditemukan. "}
          </span>
          {kesimpulan.pesan}
          {kataKitabDipakai && (
            <span className="mt-1 block text-[11px] opacity-80">
              Bentuk yang ditelusuri di kitab: <span dir="rtl" className="font-naskh">{kataKitabDipakai}</span>
            </span>
          )}
        </div>
      )}

      {sudahCari && hitsKitab.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[12px] font-bold text-ink-900">Di kitab ({hitsKitab.length})</h4>
          <PetunjukCtrlF />
          {hitsKitab.slice(0, 8).map((h) => (
            <div key={h.id} className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
              <p className="text-right font-naskh text-[13.5px] font-semibold text-ink-900" dir="rtl">{h.kitab}</p>
              <p className="mt-0.5 text-[11px] text-ink-600">
                {h.penulis ?? ""}{h.jilid ? ` · jilid ${h.jilid}` : ""}{h.halaman_cetak ? ` · hlm. cetak ${h.halaman_cetak}` : ""} · sumber: {h.source}
              </p>
              <p className="mt-1 line-clamp-2 text-right font-naskh text-[12.5px] leading-relaxed text-ink-700" dir="rtl">{h.teks_kutipan}</p>
              {amanUrl(h.url_sumber) && (
                <a className="btn-quiet mt-1.5 inline-block" href={amanUrl(h.url_sumber)} target="_blank" rel="noreferrer">Buka ↗</a>
              )}
            </div>
          ))}
        </div>
      )}

      {padanan && (
        <p className="rounded-xl bg-parchment-100/80 px-3 py-2 text-[12.5px] text-ink-800">
          Padanan Arab menurut Wiktionary: <span dir="rtl" className="font-naskh text-[14px] font-semibold">{padanan}</span>
        </p>
      )}

      {etimologi && (
        <div className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
          <h4 className="text-[12px] font-bold text-ink-900">Asal kata (etimologi) — Wiktionary</h4>
          <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-ink-700">{etimologi}</p>
        </div>
      )}

      {sudahCari && kamus.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[12px] font-bold text-ink-900">Kamus &amp; ensiklopedia</h4>
          {kamus.map((e) => (
            <div key={e.url} className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
              <p className="text-[12.5px] font-semibold text-ink-900">
                {e.judul} <span className="ml-1 rounded bg-ink-900/5 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-ink-600">{e.sumber}</span>
              </p>
              <p className="mt-1 line-clamp-4 whitespace-pre-line text-[12px] leading-relaxed text-ink-700">{e.ringkasan}</p>
              <a className="btn-quiet mt-1.5 inline-block" href={e.url} target="_blank" rel="noreferrer">Buka sumber ↗</a>
            </div>
          ))}
        </div>
      )}

      {sudahCari && jurnal.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[12px] font-bold text-ink-900">Pemakaian di jurnal ({jurnal.length})</h4>
          {jurnal.slice(0, 8).map((s) => (
            <p key={s.id} className="rounded-lg bg-white/60 px-2.5 py-1.5 text-[12px] text-ink-700">
              <span className="font-semibold text-ink-900">{s.judul}</span> — {s.jurnal} ({s.tahun})
            </p>
          ))}
        </div>
      )}

      {/* ── Mentok? Tanya Yusuf AI ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-dashed border-ink-900/20 bg-white/60 p-3">
        <h4 className="text-[12.5px] font-bold text-ink-900">Masih mentok? Tanyakan ke Yusuf AI</h4>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600">
          Salin prompt siap pakai ini, lalu tempel di chat Yusuf AI (tombol <strong>“Tanya Yusuf AI”</strong> di pojok
          halaman ini, atau bot Telegram) — Yusuf AI akan langsung menelusuri lugawi, istilahi, asal kata, dan
          statusnya di kitab untukmu.
        </p>
        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-parchment-100/80 p-2.5 text-[11px] leading-relaxed text-ink-700">{prompt}</pre>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CopyButton teks={prompt} label="Salin prompt" />
          <a className="btn-quiet" href={TAUTAN_BOT_TELEGRAM} target="_blank" rel="noreferrer">Buka bot Telegram ↗</a>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{KETERANGAN_JAM_CHAT}</p>
      </div>
    </div>
  );
}
