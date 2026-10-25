"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/engine/project";
import { sumberBaru, type Sumber } from "@/lib/engine/cite";
import { cariDuplikat } from "@/lib/engine/referensi";
import {
  cariJurnalTopik,
  cariKitabKalimat,
  cariLokalBM25,
  ekstrakKataKunci,
  parseTempelanSitasi,
  type HasilLokal,
  type HitKitabMentah,
  type KataKunci,
} from "@/lib/engine/pencarian-topik";
import { Field, Note } from "@/components/ui";
import { PetunjukCtrlF, TombolSalinCtrlF } from "@/components/workspace/ctrl-f";

type Mode = "jurnal" | "kitab" | "lokal";

type HitKitab = HitKitabMentah;

export function PencarianTopikPanel({ p, ubah }: { p: Project; ubah: (patch: Partial<Project>) => void }) {
  const [mode, setMode] = useState<Mode>("jurnal");
  const [teks, setTeks] = useState(p.topikAr || p.judulAr || "");
  const [kk, setKk] = useState<KataKunci | null>(null);
  const [hasilJurnal, setHasilJurnal] = useState<Sumber[]>([]);
  const [statusJurnal, setStatusJurnal] = useState<{ sumber: string; ok: boolean; pesan?: string }[]>([]);
  const [hasilKitab, setHasilKitab] = useState<HitKitab[]>([]);
  const [hasilLokal, setHasilLokal] = useState<HasilLokal[]>([]);
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState("");
  const [tempel, setTempel] = useState("");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const perbarui = () => setOnline(navigator.onLine);
    perbarui();
    window.addEventListener("online", perbarui);
    window.addEventListener("offline", perbarui);
    return () => {
      window.removeEventListener("online", perbarui);
      window.removeEventListener("offline", perbarui);
    };
  }, []);

  function tambah(s: Sumber) {
    if (cariDuplikat(s, p.sumber)) {
      setPesan(`"${s.judul}" tampaknya sudah ada di referensi Anda — dilewati.`);
      return;
    }
    ubah({ sumber: [...p.sumber, s] });
    setPesan(`Ditambahkan sebagai draf: ${s.judul}${s.perluVerifikasi ? " (bertanda perlu verifikasi)" : ""}`);
  }

  async function jalankanJurnal() {
    setSibuk("jurnal");
    setPesan("");
    try {
      const kunci = await ekstrakKataKunci(teks);
      setKk(kunci);
      const hasil = await cariJurnalTopik(kunci);
      setHasilJurnal(hasil.entri);
      setStatusJurnal(hasil.status);
      if (hasil.entri.length === 0) setPesan("Tidak ditemukan. Coba persempit topik atau ubah kata kunci di bawah.");
    } catch {
      setPesan("Pencarian jurnal gagal — periksa koneksi, lalu coba lagi. Pencarian lokal tetap bisa dipakai.");
    } finally {
      setSibuk("");
    }
  }

  async function jalankanKitab() {
    setSibuk("kitab");
    setPesan("");
    try {
      // Rancangan awal: yang dicari adalah KALIMAT KUNCI (frasa utuh), bukan
      // kata lepas. Susun kalimat kunci Arab dari topik lewat AI helper;
      // bila AI tidak tersedia, teks user dipakai apa adanya sebagai kalimat.
      let frasaArab: string[] = [];
      try {
        const kunci = await ekstrakKataKunci(teks);
        setKk(kunci);
        frasaArab = kunci.arab;
      } catch {
        /* jatuh ke teks apa adanya */
      }
      const { hits, frasaDipakai } = await cariKitabKalimat(frasaArab, teks);
      setHasilKitab(hits);
      if (hits.length === 0) {
        setPesan(
          `Tidak ada kecocokan frasa di kitab untuk kalimat kunci: ${frasaDipakai.join(" · ")}. Coba kalimat kunci lain, atau buka pencarian mendalam di Turath.io.`,
        );
      }
    } catch {
      setPesan("Pencarian kitab gagal — server tidak menjawab. Coba lagi sebentar.");
    } finally {
      setSibuk("");
    }
  }

  function jalankanLokal() {
    setHasilLokal(cariLokalBM25(teks, p));
  }

  const tautanTurath = `https://app.turath.io/search?q=${encodeURIComponent(teks.slice(0, 180))}`;
  const tautanShamela = `https://shamela.ws/search?query=${encodeURIComponent(teks.slice(0, 180))}`;
  const tautanGaruda = `https://garuda.kemdiktisaintek.go.id/?s=${encodeURIComponent(teks.slice(0, 180))}`;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-bold text-ink-900">Cari referensi dari topik</h3>
        <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-ink-600">
          Tulis topik atau rumusan masalah Anda. Hasil pencarian masuk sebagai <b>draf berlabel
          sumber</b> — tidak ada yang ditambahkan tanpa Anda menekan Tambah, dan aplikasi tidak
          mengarang referensi.
        </p>
      </div>

      <div className="flex gap-1" role="tablist" aria-label="Mode pencarian">
        {(
          [
            { id: "jurnal", label: "Jurnal ilmiah" },
            { id: "kitab", label: "Kitab & scan" },
            { id: "lokal", label: "Di referensi saya" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
              mode === t.id ? "bg-ink-900 text-parchment-100" : "text-ink-600 hover:bg-ink-900/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <textarea
          className="input min-h-16 flex-1 text-[13px]"
          dir="auto"
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="cth: Pengaruh metode sorogan terhadap kemampuan membaca kitab kuning santri"
        />
        {mode === "jurnal" && (
          <button type="button" className="btn-primary !py-2.5" disabled={!online || sibuk !== "" || teks.trim().length < 10} onClick={jalankanJurnal}>
            {sibuk === "jurnal" ? "Mencari…" : "Susun kalimat kunci & cari"}
          </button>
        )}
        {mode === "kitab" && (
          <button type="button" className="btn-primary !py-2.5" disabled={!online || sibuk !== "" || teks.trim().length < 3} onClick={jalankanKitab}>
            {sibuk === "kitab" ? "Mencari…" : "Cari di kitab"}
          </button>
        )}
        {mode === "lokal" && (
          <button type="button" className="btn-primary !py-2.5" disabled={teks.trim().length < 3} onClick={jalankanLokal}>
            Cari lokal
          </button>
        )}
      </div>

      {!online && mode !== "lokal" && (
        <Note>Anda sedang offline. Mode ini butuh internet — pencarian &quot;Di referensi saya&quot; tetap bekerja penuh.</Note>
      )}
      {mode === "kitab" && (
        <Note>
          Pencarian kitab tidak sepresisi jurnal: ia mencocokkan frasa di dalam isi kitab
          (Turath/Shamela) dan metadata scan tidak terstandar. Anggap hasil sebagai petunjuk
          lokasi — periksa edisi &amp; halaman cetaknya sebelum memakai.
        </Note>
      )}

      {kk && mode !== "lokal" && (
        <div className="rounded-xl bg-parchment-100/70 px-3 py-2 text-[11.5px] text-ink-700">
          <span className="font-semibold">Kalimat kunci</span> (frasa pencarian, sumber: {kk.sumber}) — Arab:{" "}
          <span dir="rtl" className="font-naskh">{kk.arab.join(" · ")}</span> · Indonesia:{" "}
          {kk.indonesia.join(" · ")} · Inggris: {kk.inggris.join(" · ")}
          {statusJurnal.length > 0 && (
            <span className="block pt-0.5 text-ink-500">
              Status sumber: {statusJurnal.map((s) => `${s.sumber} ${s.ok ? "✓" : `✗ ${s.pesan ?? ""}`}`).join(" · ")}
            </span>
          )}
        </div>
      )}

      {pesan && <p className="text-[12px] text-ink-700">{pesan}</p>}

      {mode === "jurnal" && hasilJurnal.length > 0 && (
        <div className="space-y-2">
          {hasilJurnal.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-900/10 bg-white/70 p-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink-900">{s.judul}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-600">
                  {s.penulis} — {s.jurnal} ({s.tahun}){s.doi ? ` · DOI ${s.doi}` : ""}
                </p>
                <span className="mt-1 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-700">
                  dari {s.sumberImpor}
                </span>
              </div>
              <button type="button" className="btn-quiet shrink-0" onClick={() => tambah(s)}>
                Tambah
              </button>
            </div>
          ))}
        </div>
      )}

      {mode === "kitab" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <a className="btn-quiet" href={tautanTurath} target="_blank" rel="noreferrer">Pencarian mendalam di Turath.io ↗</a>
            <a className="btn-quiet" href={tautanShamela} target="_blank" rel="noreferrer">Buka di Shamela ↗</a>
            <a className="btn-quiet" href={tautanGaruda} target="_blank" rel="noreferrer">Buka di Garuda ↗</a>
          </div>
          {hasilKitab.map((h) => (
            <div key={h.id} className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-right font-naskh text-[14px] font-semibold text-ink-900" dir="rtl">{h.kitab}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-600">
                    {h.penulis ?? ""}{h.jilid ? ` · jilid ${h.jilid}` : ""}{h.halaman_cetak ? ` · hlm. cetak ${h.halaman_cetak}` : ""} · sumber: {h.source}
                    {h.perluVerifikasi ? " · perlu verifikasi" : ""}
                  </p>
                  <p className="mt-1 line-clamp-2 text-right font-naskh text-[12.5px] leading-relaxed text-ink-700" dir="rtl">
                    {h.teks_kutipan}
                  </p>
                  <PetunjukCtrlF />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <a className="btn-quiet text-center" href={h.url_sumber} target="_blank" rel="noreferrer">Buka ↗</a>
                  <TombolSalinCtrlF teks={h.teks_kutipan} />
                  <button
                    type="button"
                    className="btn-quiet"
                    onClick={() =>
                      tambah({
                        ...sumberBaru("kitab"),
                        id: `src-${Math.random().toString(36).slice(2, 9)}`,
                        penulis: h.penulis ?? "",
                        judul: h.kitab,
                        jilid: h.jilid ? String(h.jilid) : undefined,
                        halaman: h.halaman_cetak ? String(h.halaman_cetak) : undefined,
                        url: h.url_sumber,
                        sumberImpor: h.source,
                        perluVerifikasi: true,
                      })
                    }
                  >
                    Tambah draf
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-dashed border-ink-900/15 bg-white/50 p-3">
            <Field label="Sudah menemukan sitasi di situs sumber? Tempel di sini">
              <textarea
                className="input min-h-14 w-full font-naskh text-[12.5px]"
                dir="auto"
                value={tempel}
                onChange={(e) => setTempel(e.target.value)}
                placeholder="cth: ابن حجر العسقلاني، فتح الباري، ج 6، ص 274"
              />
            </Field>
            <button
              type="button"
              className="btn-quiet mt-2"
              disabled={tempel.trim().length < 8}
              onClick={() => tambah(parseTempelanSitasi(tempel))}
            >
              Buat draf dari tempelan
            </button>
            <span className="ml-2 text-[10.5px] text-ink-500">Hasil tempel selalu bertanda perlu verifikasi.</span>
          </div>
        </div>
      )}

      {mode === "lokal" && hasilLokal.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-ink-500">Pencarian kata kunci (BM25) di data Anda sendiri — bukan pencarian semantik.</p>
          {hasilLokal.map((h, i) => (
            <div key={i} className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
              <p className="text-[12.5px] font-semibold text-ink-900">
                {h.sumber ? h.sumber.judul : `Bagian naskah: ${h.sectionId}`}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-600">{h.cuplikan}</p>
              <p className="mt-0.5 text-[10.5px] text-ink-400">skor kata kunci {h.skor}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
