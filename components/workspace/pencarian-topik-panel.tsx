"use client";

import { useEffect, useMemo, useState } from "react";
import type { KalimatKunci, Project, SetKunci } from "@/lib/engine/project";
import { sumberBaru, type Sumber } from "@/lib/engine/cite";
import { cariDuplikat } from "@/lib/engine/referensi";
import { strukturProyek } from "@/lib/content/struktur";
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
import { PasangFootnote } from "@/components/workspace/pasang-footnote";

type Mode = "jurnal" | "kitab" | "lokal";
type HitKitab = HitKitabMentah;

const PERAN_LABEL: Record<KalimatKunci["peran"], string> = {
  taswir: "Gambaran masalah",
  aqwal: "Pendapat & dalil",
  tarjih: "Analisis & jawaban",
};
const URUT_PERAN: KalimatKunci["peran"][] = ["taswir", "aqwal", "tarjih"];

const SET_KOSONG: SetKunci = { kata: [], kataDipakai: [], kalimat: [] };

function hitKeSumber(h: HitKitab): Sumber {
  return {
    ...sumberBaru("kitab"),
    id: `src-${Math.random().toString(36).slice(2, 9)}`,
    penulis: h.penulis ?? "",
    judul: h.kitab,
    jilid: h.jilid ? String(h.jilid) : undefined,
    halaman: h.halaman_cetak ? String(h.halaman_cetak) : undefined,
    url: h.url_sumber,
    sumberImpor: h.source,
    perluVerifikasi: true,
  };
}

function catatanHit(h: HitKitab): string {
  if (h.source === "archive") return "Dari scan Archive.org: metadata tidak terstandar — cocokkan dengan Ctrl+F dan verifikasi edisinya sebelum memakai.";
  if (h.perluVerifikasi) return "Indeks menemukan frasa ini, tetapi nomor halamannya bisa bergeser — cocokkan teksnya dengan Ctrl+F.";
  return "Frasa ditemukan di indeks kitab — tetap cocokkan nomor halamannya dengan Ctrl+F sebelum mengutip.";
}

export function PencarianTopikPanel({ p, ubah }: { p: Project; ubah: (patch: Partial<Project>) => void }) {
  const [mode, setMode] = useState<Mode>("jurnal");
  const [teks, setTeks] = useState(p.topikAr || p.judulAr || "");
  const [judul, setJudul] = useState(p.judulAr || p.topikAr || "");
  const [kk, setKk] = useState<KataKunci | null>(null);
  const [hasilJurnal, setHasilJurnal] = useState<Sumber[]>([]);
  const [statusJurnal, setStatusJurnal] = useState<{ sumber: string; ok: boolean; pesan?: string }[]>([]);
  const [hasilKitab, setHasilKitab] = useState<HitKitab[]>([]);
  const [hasilLokal, setHasilLokal] = useState<HasilLokal[]>([]);
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState("");
  const [tempel, setTempel] = useState("");
  const [online, setOnline] = useState(true);
  const [kataArti, setKataArti] = useState<Record<string, string>>({});
  const [kataBaru, setKataBaru] = useState("");
  const [pasangTarget, setPasangTarget] = useState<{ sumber: Sumber; kutipan?: string } | null>(null);

  const babPilihan = useMemo(() => {
    const st = strukturProyek(p);
    const petaIsykal = new Map((p.daftarIsi ?? []).map((b) => [b.id, b.isykalKe]));
    return [
      ...st.chapters.map((c) => ({ id: c.id, label: c.labelId, isykalKe: petaIsykal.get(c.id) })),
      { id: "umum", label: "Umum (tidak per bab)", isykalKe: undefined },
    ];
  }, [p]);
  const [babKey, setBabKey] = useState<string>(() => {
    const babIsykal = (p.daftarIsi ?? []).find((b) => b.isykalKe != null);
    if (babIsykal) return babIsykal.id;
    const st = strukturProyek(p);
    return st.chapters[0]?.id ?? "umum";
  });
  const setKunci: SetKunci = p.kunciPencarian?.[babKey] ?? SET_KOSONG;
  const babAktif = babPilihan.find((b) => b.id === babKey);
  const bagianAwalId = useMemo(() => {
    const st = strukturProyek(p);
    const bab = st.chapters.find((c) => c.id === babKey);
    return bab?.sections[0]?.id;
  }, [p, babKey]);

  function simpanSet(setBaru: SetKunci) {
    ubah({ kunciPencarian: { ...(p.kunciPencarian ?? {}), [babKey]: setBaru } });
  }

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

  function simpanTemuan(s: Sumber, kutipan: string) {
    ubah({
      temuan: [
        ...(p.temuan ?? []),
        {
          id: `temuan-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
          babId: babKey,
          sumber: s,
          kutipan,
          dibuat: new Date().toISOString(),
        },
      ],
    });
    setPesan(`Tersimpan di kotak temuan ${babAktif?.label ?? ""}: ${s.judul}`);
  }

  /* ── Tahap 1: generate kata kunci ─────────────────────────────────────── */
  async function generateKata() {
    setSibuk("kata");
    setPesan("");
    try {
      const rumusanBab =
        babAktif?.isykalKe != null ? (p.rumusan[babAktif.isykalKe - 1] ?? "") : "";
      const bahan = [judul.trim(), rumusanBab, teks.trim()].filter(Boolean).join("\n");
      const res = await fetch("/api/kata-kunci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tahap: "kata", teks: bahan }),
      });
      const data = await res.json();
      const kata: Array<{ ar: string; id: string }> = Array.isArray(data.kata) ? data.kata : [];
      if (kata.length === 0) throw new Error("kosong");
      const ars = [...new Set(kata.map((k) => k.ar))];
      setKataArti((lama) => ({ ...lama, ...Object.fromEntries(kata.map((k) => [k.ar, k.id])) }));
      simpanSet({ kata: ars, kataDipakai: ars, kalimat: setKunci.kalimat });
      setPesan(
        data.sumber === "tanpa-ai"
          ? "Kata kunci disaring dari teks Anda sendiri (AI tidak tersedia) — periksa dan edit dulu."
          : `${ars.length} kata kunci tersusun. Pilih yang dipakai, hapus yang tidak cocok, tambah yang kurang.`,
      );
    } catch {
      setPesan("Generate kata kunci gagal — periksa koneksi lalu coba lagi, atau tulis kata kunci manual lewat kolom tambah.");
    } finally {
      setSibuk("");
    }
  }

  /* ── Tahap 2: susun tepat 3 kalimat kunci ─────────────────────────────── */
  async function susunKalimat() {
    setSibuk("kalimat");
    setPesan("");
    try {
      const kataDipakai = setKunci.kataDipakai.length > 0 ? setKunci.kataDipakai : setKunci.kata;
      const res = await fetch("/api/kata-kunci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tahap: "kalimat", teks: judul.trim() || teks.trim(), judul: judul.trim(), kata: kataDipakai }),
      });
      const data = await res.json();
      const hasil: Array<{ teks: string; arti: string; alasan: string; peran: string }> = Array.isArray(data.kalimat) ? data.kalimat : [];
      if (hasil.length === 0) throw new Error("kosong");
      const kalimat: KalimatKunci[] = URUT_PERAN.map((peran, i) => {
        const terkunci = setKunci.kalimat.find((k) => k.peran === peran && k.dikunci);
        if (terkunci) return terkunci;
        const dari = hasil.find((h) => h.peran === peran) ?? hasil[i];
        return {
          teks: dari?.teks ?? "",
          arti: dari?.arti ?? "",
          alasan: dari?.alasan ?? "",
          peran,
          ...(setKunci.kalimat.find((k) => k.peran === peran)?.dikunci ? { dikunci: true } : {}),
        };
      });
      simpanSet({ ...setKunci, kalimat });
      setPesan(
        data.sumber === "tanpa-ai"
          ? "Kalimat berupa templat per peran (AI tidak tersedia) — edit setiap kalimat agar khas sebelum mencari."
          : "3 kalimat kunci tersusun dengan alasannya. Baca, edit bila perlu, kunci yang sudah pas.",
      );
    } catch {
      setPesan("Menyusun kalimat kunci gagal — periksa koneksi lalu coba lagi, atau tulis manual.");
    } finally {
      setSibuk("");
    }
  }

  function ubahKalimat(i: number, patch: Partial<KalimatKunci>) {
    simpanSet({
      ...setKunci,
      kalimat: setKunci.kalimat.map((k, j) => (j === i ? { ...k, ...patch } : k)),
    });
  }

  const kataBelumTerwakili = useMemo(() => {
    const dipakai = setKunci.kataDipakai.length > 0 ? setKunci.kataDipakai : setKunci.kata;
    if (setKunci.kalimat.length === 0) return [];
    const gabungan = setKunci.kalimat.map((k) => k.teks.replace(/\s+/g, " ")).join(" ");
    return dipakai.filter((k) => !gabungan.includes(k));
  }, [setKunci]);

  /* ── Pencarian memakai set kurasi ─────────────────────────────────────── */
  async function jalankanJurnal() {
    setSibuk("jurnal");
    setPesan("");
    try {
      let kunci: KataKunci;
      if (setKunci.kalimat.length > 0) {
        kunci = {
          arab: setKunci.kalimat.map((k) => k.teks),
          indonesia: setKunci.kalimat.map((k) => k.arti).filter(Boolean),
          inggris: [],
          sumber: "kurasi Anda",
        };
      } else {
        kunci = await ekstrakKataKunci(teks);
        setPesan("Belum ada kalimat kunci kurasi — pencarian memakai ekstrak otomatis dari teks. Lebih baik susun kalimat kunci dulu di atas.");
      }
      setKk(kunci);
      const hasil = await cariJurnalTopik(kunci);
      setHasilJurnal(hasil.entri);
      setStatusJurnal(hasil.status);
      if (hasil.entri.length === 0) setPesan("Tidak ditemukan. Coba ubah kalimat kunci kurasi Anda.");
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
      const frasaArab =
        setKunci.kalimat.length > 0 ? setKunci.kalimat.map((k) => k.teks) : [];
      if (frasaArab.length === 0) {
        setPesan("Belum ada kalimat kunci kurasi — pencarian memakai teks topik apa adanya. Lebih baik susun kalimat kunci dulu di atas.");
      }
      const { hits, frasaDipakai } = await cariKitabKalimat(frasaArab, teks);
      setHasilKitab(hits);
      if (hits.length === 0) {
        setPesan(
          `Tidak ada kecocokan frasa di kitab untuk kalimat kunci: ${frasaDipakai.join(" · ")}. Coba kalimat kunci lain, atau minta bot bantu cari di bawah.`,
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

  const teksUntukTautan = (setKunci.kalimat[0]?.teks || teks).slice(0, 180);
  const tautanTurath = `https://app.turath.io/search?q=${encodeURIComponent(teksUntukTautan)}`;
  const tautanShamela = `https://shamela.ws/search?query=${encodeURIComponent(teksUntukTautan)}`;
  const tautanGaruda = `https://garuda.kemdiktisaintek.go.id/?s=${encodeURIComponent(teksUntukTautan)}`;
  const teksMintaBot = [
    `Tolong carikan di kitab untuk penelitian saya.`,
    `Judul: ${judul || p.judulAr || "-"}`,
    setKunci.kalimat.length > 0
      ? `Kalimat kunci: ${setKunci.kalimat.map((k) => k.teks).join("؛ ")}`
      : `Topik: ${teks}`,
    `Balas dengan kutipan persisnya, nama kitab, jilid, dan halaman — untuk saya verifikasi dengan Ctrl+F.`,
  ].join("\n");
  const tautanMintaBot = `https://t.me/share/url?url=${encodeURIComponent("https://uthruha.vercel.app")}&text=${encodeURIComponent(teksMintaBot)}`;

  const temuanBabIni = (p.temuan ?? []).filter((t) => t.babId === babKey);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-bold text-ink-900">Cari referensi dari topik</h3>
        <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-ink-600">
          Alurnya: <b>judul → kata kunci → 3 kalimat kunci kurasi Anda → pencarian</b>. Yang menjalankan
          pencarian adalah kalimat kunci yang sudah Anda periksa — bukan ekstrak otomatis. Hasil masuk
          sebagai draf berlabel sumber; tidak ada yang ditambahkan tanpa Anda menekan tombolnya.
        </p>
      </div>

      {/* ── Kurasi kalimat kunci ─────────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl border border-gold-600/30 bg-gold-500/5 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] font-semibold text-ink-800">
            Bab tujuan{" "}
            <select className="input ms-1 !w-auto !py-1 text-[12px]" value={babKey} onChange={(e) => setBabKey(e.target.value)}>
              {babPilihan.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>
          <span className="text-[10.5px] text-ink-500">Set kalimat kunci tersimpan per bab di proyek ini.</span>
        </div>

        <Field label="Judul penelitian (wajib — jangkar kata & kalimat kunci)">
          <input
            className="input w-full font-naskh text-[13px]"
            dir="auto"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="cth: حكم شرب بول الفرس في الفقه الإسلامي"
          />
        </Field>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-ink-800">Langkah 1 · Kata kunci</span>
            <button type="button" className="btn-quiet !py-1 !text-[11.5px]" disabled={!online || sibuk !== "" || judul.trim().length < 8} onClick={generateKata}>
              {sibuk === "kata" ? "Menyusun…" : "Generate kata kunci"}
            </button>
          </div>
          {setKunci.kata.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {setKunci.kata.map((k) => {
                const dipakai = setKunci.kataDipakai.length === 0 || setKunci.kataDipakai.includes(k);
                return (
                  <span key={k} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11.5px] ${dipakai ? "border-gold-600 bg-white text-ink-900" : "border-ink-900/15 bg-white/50 text-ink-400 line-through"}`}>
                    <button
                      type="button"
                      onClick={() => {
                        const dasar = setKunci.kataDipakai.length > 0 ? setKunci.kataDipakai : [...setKunci.kata];
                        simpanSet({ ...setKunci, kataDipakai: dipakai ? dasar.filter((x) => x !== k) : [...dasar, k] });
                      }}
                      className="font-naskh"
                      dir="rtl"
                      title={dipakai ? "Klik untuk tidak memakai" : "Klik untuk memakai"}
                    >
                      {k}
                    </button>
                    {kataArti[k] && kataArti[k] !== k && <span className="text-[10px] text-ink-500">{kataArti[k]}</span>}
                    <button
                      type="button"
                      aria-label={`Hapus kata ${k}`}
                      onClick={() => simpanSet({ ...setKunci, kata: setKunci.kata.filter((x) => x !== k), kataDipakai: setKunci.kataDipakai.filter((x) => x !== k) })}
                      className="text-ink-400 hover:text-ink-800"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            <input
              className="input !w-52 !py-1 text-[12px]"
              dir="auto"
              value={kataBaru}
              onChange={(e) => setKataBaru(e.target.value)}
              placeholder="Tambah kata kunci sendiri…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && kataBaru.trim()) {
                  e.preventDefault();
                  const k = kataBaru.trim();
                  if (!setKunci.kata.includes(k)) simpanSet({ ...setKunci, kata: [...setKunci.kata, k], kataDipakai: [...(setKunci.kataDipakai.length > 0 ? setKunci.kataDipakai : setKunci.kata), k] });
                  setKataBaru("");
                }
              }}
            />
            <span className="self-center text-[10.5px] text-ink-500">Enter untuk menambah. Klik chip untuk memakai/melepas.</span>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-ink-800">Langkah 2 · Kalimat kunci (tepat 3, berperan)</span>
            <button type="button" className="btn-quiet !py-1 !text-[11.5px]" disabled={!online || sibuk !== "" || (setKunci.kata.length === 0 && judul.trim().length < 8)} onClick={susunKalimat}>
              {sibuk === "kalimat" ? "Menyusun…" : "Susun 3 kalimat kunci"}
            </button>
            {setKunci.kalimat.length < 3 && (
              <button
                type="button"
                className="btn-quiet !py-1 !text-[11.5px]"
                onClick={() => {
                  const peranKurang = URUT_PERAN.find((r) => !setKunci.kalimat.some((k) => k.peran === r)) ?? "taswir";
                  simpanSet({ ...setKunci, kalimat: [...setKunci.kalimat, { teks: "", arti: "", alasan: "Ditulis manual oleh mahasiswa.", peran: peranKurang, dikunci: true }] });
                }}
              >
                + Tulis manual
              </button>
            )}
          </div>
          {setKunci.kalimat.length > 0 && (
            <div className="mt-2 space-y-2">
              {setKunci.kalimat.map((k, i) => (
                <div key={i} className="rounded-xl border border-ink-900/10 bg-white/80 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-ink-900/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-600">
                      {i + 1} · {PERAN_LABEL[k.peran]}
                    </span>
                    <div className="flex gap-1">
                      <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[10.5px]" onClick={() => ubahKalimat(i, { dikunci: !k.dikunci })}>
                        {k.dikunci ? "🔒 Dikunci" : "🔓 Kunci"}
                      </button>
                      <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[10.5px]" onClick={() => simpanSet({ ...setKunci, kalimat: setKunci.kalimat.filter((_, j) => j !== i) })}>
                        Hapus
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="input mt-1.5 min-h-10 w-full text-right font-naskh text-[13px]"
                    dir="rtl"
                    value={k.teks}
                    onChange={(e) => ubahKalimat(i, { teks: e.target.value })}
                    placeholder="Kalimat kunci Arab…"
                  />
                  <input
                    className="input mt-1.5 w-full !py-1 text-[11.5px]"
                    value={k.arti}
                    onChange={(e) => ubahKalimat(i, { arti: e.target.value })}
                    placeholder="Padanan Bahasa Indonesia (untuk pencarian jurnal)"
                  />
                  {k.alasan && <p className="mt-1 text-[10.5px] italic leading-relaxed text-ink-500">Kenapa begini: {k.alasan}</p>}
                </div>
              ))}
            </div>
          )}
          {kataBelumTerwakili.length > 0 && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">
              Kata terpilih yang belum terwakili di kalimat kunci:{" "}
              <span className="font-naskh" dir="rtl">{kataBelumTerwakili.join(" · ")}</span> — pertimbangkan
              memasukkannya atau melepasnya dari pilihan.
            </p>
          )}
        </div>
      </div>

      {/* ── Mode & jalankan pencarian ────────────────────────────────────── */}
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
          placeholder="Topik / paragraf yang sedang dibahas (bahan cadangan & pencarian lokal)"
        />
        {mode === "jurnal" && (
          <button type="button" className="btn-primary !py-2.5" disabled={!online || sibuk !== ""} onClick={jalankanJurnal}>
            {sibuk === "jurnal" ? "Mencari…" : "Cari jurnal"}
          </button>
        )}
        {mode === "kitab" && (
          <button type="button" className="btn-primary !py-2.5" disabled={!online || sibuk !== ""} onClick={jalankanKitab}>
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
          Pencarian kitab mencocokkan frasa di isi kitab (Turath/Shamela) dan metadata scan tidak
          terstandar. Anggap hasil sebagai petunjuk lokasi — periksa edisi &amp; halaman cetaknya
          dengan Ctrl+F sebelum memakai.
        </Note>
      )}

      {kk && mode !== "lokal" && (
        <div className="rounded-xl bg-parchment-100/70 px-3 py-2 text-[11.5px] text-ink-700">
          <span className="font-semibold">Kalimat kunci terpakai</span> (sumber: {kk.sumber}) — Arab:{" "}
          <span dir="rtl" className="font-naskh">{kk.arab.join(" · ")}</span>
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
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" className="btn-quiet" onClick={() => tambah(s)}>Tambah</button>
                <button type="button" className="btn-quiet" onClick={() => setPasangTarget({ sumber: s })}>Pasang footnote</button>
                <button type="button" className="btn-quiet" onClick={() => simpanTemuan(s, "")}>Simpan temuan</button>
              </div>
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
            <a className="btn-quiet" href={tautanMintaBot} target="_blank" rel="noreferrer">Minta bot bantu cari ↗</a>
            <a className="btn-quiet" href="https://t.me/Utruhah_musebot" target="_blank" rel="noreferrer">Buka bot Telegram ↗</a>
          </div>
          {hasilKitab.map((h) => {
            const sHit = hitKeSumber(h);
            return (
              <div key={h.id} className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-right font-naskh text-[14px] font-semibold text-ink-900" dir="rtl">{h.kitab}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-600">
                      {h.penulis ?? ""}{h.jilid ? ` · jilid ${h.jilid}` : ""}{h.halaman_cetak ? ` · hlm. cetak ${h.halaman_cetak}` : ""} · sumber: {h.source}
                    </p>
                    <p className="mt-1 line-clamp-2 text-right font-naskh text-[12.5px] leading-relaxed text-ink-700" dir="rtl">
                      {h.teks_kutipan}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-ink-500">{catatanHit(h)}</p>
                    <PetunjukCtrlF />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <a className="btn-quiet text-center" href={h.url_sumber} target="_blank" rel="noreferrer">Buka ↗</a>
                    <TombolSalinCtrlF teks={h.teks_kutipan} />
                    <button type="button" className="btn-quiet" onClick={() => tambah(sHit)}>Tambah draf</button>
                    <button type="button" className="btn-quiet" onClick={() => setPasangTarget({ sumber: sHit, kutipan: h.teks_kutipan })}>Pasang footnote</button>
                    <button type="button" className="btn-quiet" onClick={() => simpanTemuan(sHit, h.teks_kutipan)}>Simpan temuan</button>
                  </div>
                </div>
              </div>
            );
          })}

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

      {/* ── Kotak temuan bab ini ─────────────────────────────────────────── */}
      {temuanBabIni.length > 0 && (
        <div className="rounded-2xl border border-ink-900/10 bg-white/70 p-3.5">
          <h4 className="text-[12.5px] font-bold text-ink-900">
            Kotak temuan — {babAktif?.label} ({temuanBabIni.length})
          </h4>
          <div className="mt-2 space-y-1.5">
            {temuanBabIni.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-parchment-100/60 px-2.5 py-1.5">
                <p className="min-w-0 truncate font-naskh text-[12px] text-ink-800" dir="rtl">{t.sumber.judul}</p>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[11px]" onClick={() => setPasangTarget({ sumber: t.sumber, kutipan: t.kutipan || undefined })}>
                    Pasang footnote
                  </button>
                  <button
                    type="button"
                    className="btn-quiet !px-2 !py-0.5 !text-[11px]"
                    onClick={() => ubah({ temuan: (p.temuan ?? []).filter((x) => x.id !== t.id) })}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pasangTarget && (
        <PasangFootnote
          p={p}
          ubah={ubah}
          sumber={pasangTarget.sumber}
          kutipan={pasangTarget.kutipan}
          babAwalId={bagianAwalId}
          onTutup={() => setPasangTarget(null)}
          onTerpasang={(m) => setPesan(m)}
        />
      )}
    </div>
  );
}
