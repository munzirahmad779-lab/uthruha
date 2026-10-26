"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/lib/engine/project";
import type { Sumber } from "@/lib/engine/cite";
import { pedomanDefault, type PedomanRules } from "@/lib/refs/pedoman";
import { footnoteDari, entriPustakaDari, hitungBatas, kandidatKeSumber } from "@/lib/refs/footnote";
import { kandidatManual } from "@/lib/refs/adapters/manual";
import {
  SOURCE_INFO,
  VERIF_INFO,
  namaSumber,
  type ModeCari,
  type RefHit,
  type SearchResponse,
  type SourceId,
} from "@/lib/refs/types";
import { IconCheck, IconExternal, IconPen, IconScale, IconSearch, IconSparkle, IconTrash } from "@/components/icons";
import { Note } from "@/components/ui";
import { BatasStrip } from "@/components/workspace/batas-strip";
import { PetunjukCtrlF, TombolSalinCtrlF } from "@/components/workspace/ctrl-f";

const URUTAN: SourceId[] = ["turath", "shamela", "ketabonline", "usul"];

/** Pecah paragraf menjadi kalimat Arab (maks 8). */
export function pecahKalimat(teks: string): string[] {
  return teks
    .split(/(?<=[.؟!])\s+/u)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 12)
    .slice(0, 8);
}

const LABEL_MODE: Record<string, string> = {
  api: "pencarian otomatis",
  deeplink: "tautan manual",
};

export function RefFinder({
  p,
  onSisip,
  onPasang,
  tutup,
}: {
  p: Project;
  onSisip: (blok: string, sumber: Sumber[]) => void;
  /** Pasang footnote terarah (pilih paragraf & kalimat) — disediakan tab Tulis. */
  onPasang?: (sumber: Sumber, kutipan: string) => void;
  tutup: () => void;
}) {
  const pedoman: PedomanRules = p.pedoman ?? pedomanDefault();
  const [paragraf, setParagraf] = useState("");
  const [sumber, setSumber] = useState<SourceId[]>([...URUTAN]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [pilih, setPilih] = useState<RefHit[]>([]);
  const [batas, setBatas] = useState<ReturnType<typeof hitungBatas> | null>(null);
  const [manual, setManual] = useState("");
  const [manualDipilih, setManualDipilih] = useState<RefHit | null>(null);
  const [mode, setMode] = useState<ModeCari>("kata");
  const [pakaiLLM, setPakaiLLM] = useState(true);
  const [istilahKustom, setIstilahKustom] = useState("");
  const [konsepTerpilih, setKonsepTerpilih] = useState<string[]>([]);
  const [kunciPribadi, setKunciPribadi] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("uthruha_user_llm_key") || "";
    }
    return "";
  });
  const [bukaSetelanKunci, setBukaSetelanKunci] = useState(false);

  const kalimat = useMemo(() => pecahKalimat(paragraf), [paragraf]);
  const bolehPilih = pilih.length < pedoman.maksFootnotePerParagraf;

  /** Kelompokkan hasil per kalimat — sesuai spesifikasi: cocok per kalimat. */
  const perKalimat = useMemo(() => {
    if (!res) return [];
    const map = new Map<string, RefHit[]>();
    for (const h of res.hasil) {
      const arr = map.get(h.kalimat) ?? [];
      arr.push(h);
      map.set(h.kalimat, arr);
    }
    return Array.from(map.entries()).map(([k, list]) => ({ kalimat: k, hasil: list }));
  }, [res]);

  async function cari(overrideKonsep?: string[]) {
    setGalat("");
    setRes(null);
    setPilih([]);
    setBatas(null);
    if (kalimat.length === 0) {
      setGalat("Tuliskan dulu satu paragraf Arab (minimal satu kalimat).");
      return;
    }
    setMemuat(true);
    try {
      const r = await fetch("/api/refs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentences: kalimat,
          sources: sumber,
          mode,
          tanpaLLM: !pakaiLLM,
          kunciLLM: kunciPribadi.trim() || undefined,
          konsepKustom: overrideKonsep && overrideKonsep.length > 0 ? overrideKonsep : undefined,
        }),
      });
      const data = (await r.json()) as SearchResponse & { error?: string };
      if (!r.ok) {
        setGalat(data.error ?? `Permintaan gagal (${r.status}).`);
        return;
      }
      setRes(data);
      if (data.konsep) {
        setKonsepTerpilih(data.konsep);
      }
    } catch {
      setGalat("Tidak dapat menghubungi pencari rujukan. Periksa koneksi server.");
    } finally {
      setMemuat(false);
    }
  }

  function toggle(h: RefHit) {
    setPilih((kini) => {
      const ada = kini.find((x) => x.id === h.id);
      if (ada) return kini.filter((x) => x.id !== h.id);
      if (kini.length >= pedoman.maksFootnotePerParagraf) return kini;
      return [...kini, h];
    });
  }

  /** Tambah kandidat manual ke daftar terpilih. */
  function tambahManual() {
    if (!manual.trim()) return;
    const kandidat = kandidatManual(manual, kalimat[0] ?? "");
    setPilih((kini) => {
      if (kini.length >= pedoman.maksFootnotePerParagraf) return kini;
      if (kini.some((x) => x.id === kandidat.id)) return kini;
      return [...kini, kandidat];
    });
    setManualDipilih(kandidat);
    setManual("");
  }

  function sisip() {
    if (pilih.length === 0) return;
    const urut = [...pilih].sort((a, b) => {
      const pa = paragraf.indexOf(a.kalimat);
      const pb = paragraf.indexOf(b.kalimat);
      return (pa < 0 ? 9999 : pa) - (pb < 0 ? 9999 : pb);
    });
    let isi = paragraf.trim();
    const definisi: string[] = [];

    urut.forEach((h, i) => {
      const n = i + 1;
      const pos = isi.indexOf(h.kalimat);
      if (pos >= 0) {
        const akhir = pos + h.kalimat.length;
        isi = `${isi.slice(0, akhir)}[^${n}]${isi.slice(akhir)}`;
      } else {
        isi = `${isi}[^${n}]`;
      }
      const sumberTeks = h.url_sumber ? ` ${h.url_sumber}` : "";
      definisi.push(`[^${n}]: ${footnoteDari(h, pedoman)}${sumberTeks}`);
    });

    const blok = `${isi}\n\n${definisi.join("\n")}`;
    const sumberBaru = pilih.map((h) => kandidatKeSumber(h));
    onSisip(blok, sumberBaru);

    // Periksa batas segera setelah sisip.
    setBatas(hitungBatas(`${p.draf[""] ?? ""}\n\n${blok}`, pedoman));
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink-900/30 backdrop-blur-[2px]">
      <div className="doc-scroll flex h-full w-full max-w-xl flex-col overflow-y-auto border-s border-ink-900/15 bg-parchment-50 shadow-lift">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ink-900/10 bg-parchment-50/95 px-4 py-3 backdrop-blur">
          <div>
            <p className="font-arabic text-base font-bold text-ink-900" dir="rtl">
              البحث عن المراجع
            </p>
            <p className="text-[11px] text-ink-500">
              Turath dicari otomatis · sumber lain lewat tautan · maksimal {pedoman.maksFootnotePerParagraf} footnote per paragraf
            </p>
          </div>
          <button type="button" onClick={tutup} className="btn-quiet shrink-0">
            Tutup
          </button>
        </header>

        <div className="space-y-3 p-4">
          <div>
            <label className="label">Paragraf Arab (satu paragraf)</label>
            <textarea
              value={paragraf}
              onChange={(e) => setParagraf(e.target.value)}
              dir="rtl"
              className="input min-h-28 font-naskh text-[14px] leading-loose"
              placeholder="الصق هنا فقرة عربية واحدة…"
            />
            <p className="mt-1 text-[10.5px] text-ink-500">
              {kalimat.length} kalimat terdeteksi · dicari maksimal 8 kalimat
            </p>
          </div>

          <div>
            <p className="label">Cara mencari</p>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Cara mencari">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "kata"}
                data-testid="mode-kata"
                onClick={() => setMode("kata")}
                className={`rounded-xl border px-2.5 py-2 text-start transition ${
                  mode === "kata"
                    ? "border-ink-900 bg-ink-900 text-parchment-100"
                    : "border-ink-900/15 bg-parchment-50 text-ink-700 hover:border-ink-900/30"
                }`}
              >
                <span className="block text-[11.5px] font-semibold">Kata</span>
                <span className={`block text-[10px] ${mode === "kata" ? "text-parchment-100/70" : "text-ink-500"}`}>
                  Cocokkan kata paragraf apa adanya
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "konsep"}
                data-testid="mode-konsep"
                onClick={() => setMode("konsep")}
                className={`rounded-xl border px-2.5 py-2 text-start transition ${
                  mode === "konsep"
                    ? "border-ink-900 bg-ink-900 text-parchment-100"
                    : "border-ink-900/15 bg-parchment-50 text-ink-700 hover:border-ink-900/30"
                }`}
              >
                <span className="block text-[11.5px] font-semibold">Makna</span>
                <span className={`block text-[10px] ${mode === "konsep" ? "text-parchment-100/70" : "text-ink-500"}`}>
                  Cocokkan topik lewat konsep
                </span>
              </button>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-500">
              {mode === "kata" ? (
                <>Mencari halaman yang <span className="font-semibold">memuat kata/frasa</span> paragraf Anda. Ini yang paling aman untuk kutipan langsung.</>
              ) : (
                <>
                  Mencari halaman yang <span className="font-semibold">membahas topik</span> yang sama, walau katanya berbeda.
                  Paragraf dipahami lebih dulu untuk mengambil istilah Arab yang lazim dipakai kitab, lalu istilah itu dicari
                  ke Turath. <span className="font-semibold">Sitasi tetap dari Turath</span> — bukan karangan model.
                  Cocok untuk mencari bahan; jangan dikutip sebagai kalimat Anda.
                </>
              )}
            </p>

            {mode === "konsep" && (
              <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-600">
                  <input
                    type="checkbox"
                    checked={pakaiLLM}
                    onChange={(e) => setPakaiLLM(e.target.checked)}
                    data-testid="pakai-llm"
                    className="mt-0.5 h-3 w-3 shrink-0 accent-ink-900"
                  />
                  <span>
                    Pakai AI untuk memahami makna paragraf.{" "}
                    {pakaiLLM ? (
                      <>
                        Istilah dirumuskan oleh AI (server / kunci pribadi). Bila kuota AI habis, pencarian otomatis turun ke aturan deterministik tanpa error.
                      </>
                    ) : (
                      <>Mati: istilah diambil dari aturan kata, tanpa jaringan AI.</>
                    )}
                  </span>
                </label>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setBukaSetelanKunci(!bukaSetelanKunci)}
                    className="text-[10.5px] font-semibold text-gold-700 hover:underline flex items-center gap-1"
                  >
                    ⚙️ {bukaSetelanKunci ? "Tutup Pengaturan Kunci Pribadi" : "Punya Kunci AI Sendiri? (Opsi Bebas Limit)"}
                  </button>

                  {bukaSetelanKunci && (
                    <div className="mt-1.5 p-2.5 rounded-xl border border-ink-900/15 bg-parchment-100/80 space-y-2">
                      <p className="text-[10px] text-ink-600 leading-relaxed">
                        Mahasiswa dapat memasukkan token/kunci AI pribadi (GitHub / Groq / Gemini). Kunci ini tersimpan di browser Anda sendiri dan tidak membebani kuota server:
                      </p>
                      <input
                        type="password"
                        value={kunciPribadi}
                        onChange={(e) => {
                          setKunciPribadi(e.target.value);
                          if (typeof window !== "undefined") {
                            localStorage.setItem("uthruha_user_llm_key", e.target.value);
                          }
                        }}
                        placeholder="Tempelkan API Key / Token pribadi Anda..."
                        className="w-full rounded-lg border border-ink-900/20 bg-white px-2.5 py-1 text-[11px] text-ink-900 focus:outline-none focus:border-ink-900"
                      />
                      {kunciPribadi && (
                        <p className="text-[9.5px] text-emerald-700 font-semibold">
                          ✓ Kunci pribadi aktif tersimpan di peramban Anda.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="label">Sumber</p>
            <div className="flex flex-wrap gap-1.5">
              {URUTAN.map((id) => {
                const on = sumber.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSumber((s) => (on ? s.filter((x) => x !== id) : [...s, id]))}
                    title={SOURCE_INFO[id].api}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                      on
                        ? "border-ink-900 bg-ink-900 text-parchment-100"
                        : "border-ink-900/20 text-ink-600 hover:border-ink-900/40"
                    }`}
                  >
                    {SOURCE_INFO[id].nama}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void cari()} disabled={memuat} className="btn-primary disabled:opacity-50">
              <IconSearch className="h-4 w-4" /> {memuat ? "Mencari rujukan…" : "Cari Rujukan"}
            </button>
            <button
              type="button"
              onClick={() => {
                setParagraf("");
                setRes(null);
                setPilih([]);
                setBatas(null);
                setGalat("");
              }}
              className="btn-quiet"
            >
              <IconTrash className="h-3.5 w-3.5" /> Bersihkan
            </button>
          </div>

          {memuat && (
            <div className="flex items-center gap-3 rounded-xl border border-ink-900/15 bg-parchment-100/70 p-3 text-ink-800 shadow-sm animate-pulse">
              <div className="h-4 w-4 shrink-0 rounded-full border-2 border-ink-900 border-t-transparent animate-spin" />
              <div className="text-[12px] leading-relaxed">
                <p className="font-semibold text-ink-900">Harap menunggu...</p>
                <p className="text-[11px] text-ink-600">
                  {mode === "konsep" && pakaiLLM
                    ? "Model AI lokal sedang memproses dan mengekstrak istilah kitab, lalu mencari naskah aslinya."
                    : "Sedang mencocokkan naskah rujukan ke pangkalan data kitab..."}
                </p>
              </div>
            </div>
          )}

          {galat && <Note jenis="warn">{galat}</Note>}

          {res && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {res.status.map((s) => (
                  <span
                    key={s.source}
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                      s.status === "ok"
                        ? "bg-emerald-600/10 text-emerald-800"
                        : s.status === "gagal"
                          ? "bg-red-600/10 text-red-800"
                          : "bg-ink-900/5 text-ink-600"
                    }`}
                    title={s.pesan ?? LABEL_MODE[s.mode]}
                  >
                    {namaSumber(s.source as SourceId)}: {s.status}
                    {s.jumlah ? ` (${s.jumlah})` : ""}
                  </span>
                ))}
              </div>

              {res.konsep && res.konsep.length > 0 && (
                <div className="rounded-xl border border-ink-900/10 bg-white/70 p-3.5 space-y-3" data-testid="konsep-dipakai">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-700">Pilar Makna Temuan AI</p>
                    <span
                      data-testid="asal-istilah"
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        res.asal?.jenis === "llm"
                          ? "bg-gold-500/20 text-ink-800 border border-gold-500/30"
                          : "bg-ink-900/5 text-ink-500"
                      }`}
                    >
                      {res.asal?.jenis === "llm" ? "AI Semantik" : "Aturan kata"}
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-ink-600 leading-relaxed">
                    Centang pilar makna yang ingin dicari, atau tambahkan sudut pandang Anda sendiri di bawah:
                  </p>

                  <div className="flex flex-wrap gap-1.5" dir="rtl">
                    {res.konsep.map((k) => {
                      const aktif = konsepTerpilih.includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setKonsepTerpilih((prev) =>
                              aktif ? prev.filter((x) => x !== k) : [...prev, k]
                            );
                          }}
                          className={`rounded-full px-3 py-1 font-naskh text-[12.5px] transition border ${
                            aktif
                              ? "bg-ink-900 text-parchment-100 border-ink-900 shadow-sm"
                              : "bg-ink-900/5 text-ink-600 border-transparent hover:border-ink-900/20"
                          }`}
                        >
                          {aktif ? "✓ " : ""}{k}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-ink-900/10">
                    <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                      Ketik fokus makna / rujukan khusus yang Anda inginkan:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        dir="rtl"
                        value={istilahKustom}
                        onChange={(e) => setIstilahKustom(e.target.value)}
                        placeholder="مثال: شروط المبتدئين في التعلم، مقاصد التأليف..."
                        className="flex-1 rounded-lg border border-ink-900/20 bg-parchment-50 px-3 py-1.5 font-naskh text-[13px] text-ink-900 focus:border-ink-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const kustom = istilahKustom.trim();
                          const daftar = [...konsepTerpilih];
                          if (kustom && !daftar.includes(kustom)) {
                            daftar.push(kustom);
                            setKonsepTerpilih(daftar);
                            setIstilahKustom("");
                          }
                          void cari(daftar);
                        }}
                        disabled={memuat}
                        className="btn-primary !py-1.5 !px-3 text-[11.5px] shrink-0"
                      >
                        Terapkan & Cari
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {res.peringatan.length > 0 && (
                <div className="rounded-xl bg-parchment-100/80 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Catatan jujur</p>
                  <ul className="mt-1 space-y-1">
                    {res.peringatan.map((w) => (
                      <li key={w} className="text-[11.5px] leading-relaxed text-ink-700">
                        · {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {res.hasil.length === 0 ? (
                res.status.some((s) => s.status === "gagal") ? (
                  <Note jenis="warn">
                    Sumber tidak menjawab, jadi ini <span className="font-semibold">bukan</span> berarti tidak ada
                    rujukan. Coba lagi sebentar, atau pakai pintu manual di bawah.
                  </Note>
                ) : (
                  <Note jenis="info">
                    Tidak ada kandidat otomatis untuk kalimat ini. Gunakan pintu manual di bawah, atau isi sendiri
                    sitasinya pada panel «Rujukan manual».
                  </Note>
                )
              ) : (
                <div className="space-y-4">
                  {perKalimat.map((grup) => (
                    <section key={grup.kalimat} className="space-y-2">
                      <p
                        className="rounded-lg bg-parchment-100/70 px-2.5 py-1.5 font-naskh text-[12px] leading-relaxed text-ink-800"
                        dir="rtl"
                      >
                        {grup.kalimat}
                      </p>
                      {grup.hasil.map((h) => {
                        const dipilih = pilih.some((x) => x.id === h.id);
                        return (
                          <article
                            key={h.id}
                            className={`rounded-xl border p-3 transition ${
                              dipilih ? "border-gold-500 bg-gold-500/5" : "border-ink-900/10 bg-white/70"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="rounded-full bg-ink-900/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-600">
                                  {namaSumber(h.source)}
                                </span>
                                <p className="mt-1 font-arabic text-[13px] font-bold text-ink-900" dir="rtl">
                                  {h.kitab || "[ ! verifikasi ]"}
                                </p>
                                <p className="text-[11px] text-ink-500">
                                  {[
                                    h.penulis,
                                    h.jilid ? `ج ${h.jilid}` : "",
                                    h.halaman_cetak ? `ص ${h.halaman_cetak}` : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[10px] font-semibold text-ink-500">skor</p>
                                <p className="text-sm font-bold text-ink-900">{Math.round(h.skor * 100)}%</p>
                              </div>
                            </div>

                        <p className="mt-2 rounded-lg bg-parchment-100/70 p-2 font-naskh text-[12.5px] leading-relaxed text-ink-800" dir="rtl">
                          {h.teks_kutipan.slice(0, 220)}
                        </p>
                        <PetunjukCtrlF />

                        {h.judul_bab && (
                          <p className="mt-1.5 rounded-lg border border-ink-900/10 bg-white/60 p-2 text-[10.5px] leading-relaxed text-ink-600">
                            <span className="font-bold uppercase tracking-wide text-ink-500">Judul bab · </span>
                            <span className="font-naskh text-[12px] text-ink-800" dir="rtl">
                              {h.judul_bab}
                            </span>
                            {h.konsep_cocok && h.konsep_cocok.length > 0 && (
                              <span className="mt-1 block text-ink-500">
                                Konsep cocok: <span className="font-naskh text-ink-800" dir="rtl">{h.konsep_cocok.join(" · ")}</span>
                              </span>
                            )}
                          </p>
                        )}

                        {h.perluVerifikasi && h.catatanVerifikasi && (
                          <p className="mt-1.5 text-[10.5px] leading-relaxed text-amber-800">! {h.catatanVerifikasi}</p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggle(h)}
                            disabled={!dipilih && !bolehPilih}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                              dipilih
                                ? "bg-ink-900 text-parchment-100"
                                : "border border-ink-900/20 text-ink-700 hover:border-ink-900/50 disabled:opacity-40"
                            }`}
                          >
                            {dipilih ? <IconCheck className="me-1 inline h-3 w-3" /> : null}
                            {dipilih ? "Dipilih" : "Pilih"}
                          </button>
                          <TombolSalinCtrlF teks={h.teks_kutipan} />
                          {onPasang && (
                            <button
                              type="button"
                              onClick={() => onPasang(kandidatKeSumber(h), h.teks_kutipan)}
                              className="btn-quiet !px-2 !py-1 !text-[11px]"
                            >
                              Pasang footnote
                            </button>
                          )}
                          {h.url_sumber ? (
                            <a href={h.url_sumber} target="_blank" rel="noopener noreferrer" className="btn-quiet !px-2 !py-1 !text-[11px]">
                              <IconExternal className="h-3 w-3" /> Sumber
                            </a>
                          ) : null}
                          <a
                            href={`https://waqfeya.com/search?q=${encodeURIComponent(h.kitab)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-quiet !px-2 !py-1 !text-[11px]"
                            title={VERIF_INFO.waqfeya.peran}
                          >
                            <IconScale className="h-3 w-3" /> Verifikasi
                          </a>
                        </div>
                      </article>
                        );
                      })}
                    </section>
                  ))}
                </div>
              )}

              {res.pintu.length > 0 && (
                <div className="rounded-xl border border-ink-900/10 bg-white/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">
                    Pintu manual (tanpa API)
                  </p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-ink-500">
                    Sumber ini tidak menyediakan pencarian otomatis; tautan membuka pencarian di situsnya dan hasilnya
                    tidak bisa dipilih otomatis.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {res.pintu.map((d) => (
                      <a
                        key={d.id}
                        href={d.url_sumber}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-quiet !px-2 !py-1 !text-[11px]"
                      >
                        <IconExternal className="h-3 w-3" /> {namaSumber(d.source)}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Panel manual tetap tersedia walau belum ada hasil pencarian. */}
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-ink-900/10 bg-white/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Rujukan manual</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-500">
                  Bila kalimat Anda tidak ada di korpus mana pun, tempel baris sitasi dari kitab cetak. Aplikasi
                  hanya mengurai yang Anda tulis — kolom yang tidak terbaca ditandai{" "}
                  <span className="font-semibold">[ ! verifikasi ]</span>, tidak pernah dikarang.
                </p>
                <textarea
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  dir="rtl"
                  data-testid="rujukan-manual"
                  className="input mt-2 min-h-16 font-naskh text-[12.5px] leading-relaxed"
                  placeholder="النووي، الأذكار، (بيروت: دار الفكر، 2000)، ج 1، ص 23"
                />
                <button
                  type="button"
                  onClick={tambahManual}
                  disabled={!manual.trim() || !bolehPilih}
                  data-testid="tambah-manual"
                  className="btn-quiet mt-1.5 !px-2.5 !py-1 !text-[11px] disabled:opacity-40"
                >
                  <IconPen className="h-3 w-3" /> Tambahkan sebagai kandidat
                </button>
                {manualDipilih && (
                  <div className="mt-2 rounded-lg bg-gold-500/5 p-2">
                    <p className="text-[10px] font-semibold text-ink-500">Hasil penguraian</p>
                    <p className="font-naskh text-[12px] leading-relaxed text-ink-800" dir="rtl">
                      {footnoteDari(manualDipilih, pedoman)}
                    </p>
                    {manualDipilih.catatanVerifikasi && (
                      <p className="mt-0.5 text-[10.5px] text-amber-800">! {manualDipilih.catatanVerifikasi}</p>
                    )}
                  </div>
                )}
              </div>

              {pilih.length > 0 && (
                <div className="space-y-2 rounded-xl border border-gold-500/60 bg-gold-500/5 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-600">
                    Footnote terpilih ({pilih.length}/{pedoman.maksFootnotePerParagraf})
                  </p>
                  {pilih.map((h, i) => (
                    <div key={h.id}>
                      <p className="text-[10px] font-semibold text-ink-500">
                        [^{i + 1}] · {namaSumber(h.source)}
                        {h.source === "manual" ? " (tanpa skor)" : ""}
                      </p>
                      <p className="font-naskh text-[12px] leading-relaxed text-ink-800" dir="rtl">
                        {footnoteDari(h, pedoman)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ink-500" dir="rtl">
                        {entriPustakaDari(h, pedoman)}
                      </p>
                    </div>
                  ))}
                  <button type="button" onClick={sisip} className="btn-primary w-full">
                    <IconSparkle className="h-4 w-4" /> Sisipkan ke naskah
                  </button>
                </div>
              )}

              {batas && (
                <div className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Periksa batas</p>
                  <p className="mt-1 text-[11.5px] text-ink-700">
                    {batas.footnoteTotal} footnote · ±{batas.kata} kata · ±{batas.halamanPerkiraan} halaman A4 ·
                    target {batas.target.font} {batas.target.ukuran} pt spasi {String(batas.target.spasi).replace(".", ",")}
                  </p>
                  {batas.pelanggaran.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {batas.pelanggaran.map((v) => (
                        <li key={v} className="text-[11px] text-amber-800">
                          ! {v}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[11px] text-emerald-800">Batas terpenuhi (perkiraan, bukan pengukuran Word).</p>
                  )}
                </div>
              )}

              <BatasStrip teks={paragraf} pedoman={pedoman} label="Periksa batas paragraf" ringkas testId="batas-panel" />
          </div>
        </div>
      </div>
    </div>
  );
}
