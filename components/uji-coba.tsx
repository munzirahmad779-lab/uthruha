"use client";

import { useEffect, useRef, useState } from "react";

interface Rujukan {
  id: string;
  jenis: "jurnal" | "buku";
  judul: string;
  penulis: string[];
  tahun: string;
  wadah: string;
  doi: string | null;
  isbn: string | null;
  tautan: string;
  terverifikasi: boolean;
  skor: number;
  kecocokan?: number;
}

/** Label kecocokan topik dari jumlah kalimat kunci yang disentuh judul. */
function labelKecocokan(r: Rujukan): { teks: string; kelas: string } {
  const k = r.kecocokan;
  if (k === undefined) {
    return r.skor >= 0.35
      ? { teks: "Kecocokan topik: sedang, periksa dulu isinya", kelas: "text-amber-700" }
      : { teks: "Kecocokan topik: rendah, tidak disarankan untuk judul ini", kelas: "font-semibold text-red-700" };
  }
  if (k >= 2) return { teks: "Kecocokan topik: tinggi", kelas: "font-semibold text-emerald-700" };
  if (k === 1) return { teks: "Kecocokan topik: sebagian, periksa dulu isinya", kelas: "text-amber-700" };
  return { teks: "Kecocokan topik: rendah, tidak disarankan untuk judul ini", kelas: "font-semibold text-red-700" };
}

/** Contoh bentuk footnote jadi dari rujukan paling cocok (data apa adanya;
 * nomor halaman memang diisi dari sumber asli di ruang kerja). */
function contohFootnoteDari(refs: Rujukan[]): string | null {
  if (!refs.length) return null;
  const r = [...refs].sort(
    (a, b) => (b.kecocokan ?? 0) - (a.kecocokan ?? 0) || b.skor - a.skor,
  )[0]!;
  const penulis = r.penulis.join(", ") || "Penulis";
  if (r.jenis === "buku") {
    const kurung = r.wadah
      ? ` (${r.wadah}${r.tahun ? `, ${r.tahun}` : ""})`
      : r.tahun
        ? ` (${r.tahun})`
        : "";
    return `${penulis}, ${r.judul}${kurung}, hlm. …`;
  }
  return `${penulis}, "${r.judul}," ${r.wadah || "Nama jurnal"}${r.tahun ? ` (${r.tahun})` : ""}, hlm. …`;
}

interface HasilUji {
  sesiId: string;
  kalimatKunci: string[];
  khalfiyah: string[];
  isykaliyat: string[];
  ahdaf: string[];
  refs: Rujukan[];
  dariTembolok?: boolean;
}

const KUNCI_PERANGKAT = "uthruha.perangkatId";
const KUNCI_SUDAH = "uthruha.ujiCobaSudah";
/** Judul uji coba yang menunggu diteruskan menjadi proyek pertama
 *  sesudah login (dibaca sekali oleh halaman daftar proyek). */
const KUNCI_JUDUL_UJI = "uthruha.judulUjiCoba";

function perangkatId(): string {
  try {
    let v = localStorage.getItem(KUNCI_PERANGKAT);
    if (!v) {
      v = `pg-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(KUNCI_PERANGKAT, v);
    }
    return v;
  } catch {
    return "perangkat-tidak-dikenal";
  }
}

/** Blokir salin/pilih pada hasil uji coba (keputusan E: hasil TERKUNCI). */
function kunciSalin(e: React.SyntheticEvent) {
  e.preventDefault();
}

export function UjiCobaTamu({ googleAktif }: { googleAktif: boolean }) {
  const [judul, setJudul] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [mengembangkan, setMengembangkan] = useState(false);
  const [hasil, setHasil] = useState<HasilUji | null>(null);
  const [paragrafKembang, setParagrafKembang] = useState<string[] | null>(null);
  const [galat, setGalat] = useState("");
  const [wajibLogin, setWajibLogin] = useState(false);
  const [pernahCoba, setPernahCoba] = useState(false);
  const kotakHasil = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setPernahCoba(localStorage.getItem(KUNCI_SUDAH) === "1");
    } catch { /* abaikan */ }
  }, []);

  async function mulai() {
    setGalat("");
    if (judul.trim().length < 10) {
      setGalat("Tulis judul penelitian Anda dulu (minimal 10 karakter).");
      return;
    }
    setMemuat(true);
    try {
      const res = await fetch("/api/uji-coba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judul: judul.trim(), perangkatId: perangkatId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.kode === "WAJIB_LOGIN") setWajibLogin(true);
        setGalat(data.error ?? "Uji coba gagal.");
        return;
      }
      setHasil(data as HasilUji);
      setParagrafKembang(null);
      try {
        localStorage.setItem(KUNCI_SUDAH, "1");
        setPernahCoba(true);
      } catch { /* abaikan */ }
    } catch {
      setGalat("Tidak terhubung ke server. Periksa jaringan Anda.");
    } finally {
      setMemuat(false);
    }
  }

  async function kembangkan() {
    if (!hasil) return;
    setMengembangkan(true);
    setGalat("");
    try {
      const res = await fetch("/api/uji-coba/kembangkan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesiId: hasil.sesiId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGalat(data.error ?? "Pengembangan gagal.");
        return;
      }
      setParagrafKembang(data.paragraf as string[]);
    } catch {
      setGalat("Tidak terhubung ke server.");
    } finally {
      setMengembangkan(false);
    }
  }

  const tampilParagraf = paragrafKembang ?? hasil?.khalfiyah ?? [];
  const contohFootnote = hasil ? contohFootnoteDari(hasil.refs) : null;

  /**
   * CTA masuk dari uji coba: judul yang sedang dicoba disimpan dulu,
   * lalu pengguna diantar ke layar masuk. Sesudah masuk, halaman daftar
   * proyek meneruskan judul ini menjadi draf proyek pertama secara
   * otomatis (satu kali). Label tombol mengikuti keadaan login Google:
   * selama login Google ditahan pemilik (googleAktif=false), ajakannya
   * adalah masuk dengan kunci akses — tombol Google tidak dirender.
   */
  function loginDariUjiCoba() {
    try {
      const j = judul.trim();
      if (j.length >= 10) {
        localStorage.setItem(
          KUNCI_JUDUL_UJI,
          JSON.stringify({ judul: j, sesiId: hasil?.sesiId ?? null, pada: new Date().toISOString() }),
        );
      }
    } catch { /* penyimpanan tidak tersedia: tetap antar ke halaman masuk */ }
    window.location.href = "/masuk?lanjut=/proyek";
  }

  return (
    <section id="uji-coba" className="wrap scroll-mt-24 pb-4 pt-2 sm:pb-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-gold-300/60 bg-white/70 p-6 shadow-sm sm:p-8">
        <span className="eyebrow">Uji coba tanpa daftar</span>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">
          Coba dari judul Anda — satu kali, gratis.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Masukkan judul penelitian. Kitabah menyusun kalimat kunci, khalfiyah tiga paragraf,
          isykaliyat, dan ahdaf — lalu mencarikan rujukan asli yang bisa diverifikasi.
          Teks susunan hasil uji coba <strong>terkunci</strong> (tidak bisa disalin),
          tetapi daftar rujukannya bisa Anda salin dan periksa sendiri. Untuk menyusun,
          mengedit, dan memasang footnote, masuk gratis.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="مثال: أثر طريقة المناقشة في تنمية مهارة الكلام لدى طلاب…"
            className="w-full flex-1 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none focus:border-gold-500"
            dir="auto"
            maxLength={300}
          />
          <button
            onClick={mulai}
            disabled={memuat}
            className="btn-primary shrink-0 disabled:opacity-60"
          >
            {memuat ? "Menyusun…" : "Mulai uji coba"}
          </button>
        </div>
        {pernahCoba && !hasil && (
          <p className="mt-3 text-xs text-ink-500">
            Perangkat ini sudah pernah memakai uji coba tamu. Percobaan berikutnya lewat server
            akan diarahkan untuk masuk gratis.
          </p>
        )}
        {galat && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{galat}</p>
        )}
        {wajibLogin && (
          <div className="mt-3">
            <button type="button" onClick={loginDariUjiCoba} className="btn-primary">
              {googleAktif ? "Login gratis dengan Google" : "Masuk dengan kunci akses"}
            </button>
            <p className="mt-2 text-xs text-ink-500">
              {googleAktif
                ? "Judul yang Anda coba akan diteruskan menjadi proyek pertama Anda."
                : "Percobaan berikutnya masuk dengan kunci akses yang dibagikan pemilik lewat salurannya. Judul yang Anda coba akan diteruskan menjadi proyek pertama Anda."}
            </p>
          </div>
        )}

        {hasil && (
          <>
          <div
            ref={kotakHasil}
            className="mt-6 select-none"
            onCopy={kunciSalin}
            onCut={kunciSalin}
            onContextMenu={kunciSalin}
            aria-label="Hasil uji coba terkunci"
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">
              Kalimat kunci
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2" dir="rtl">
              {hasil.kalimatKunci.map((k) => (
                <li key={k} className="rounded-full bg-parchment-100 px-3 py-1 font-arabic text-sm text-ink-800">
                  {k}
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink-500">
              Khalfiyah (خلفية البحث)
            </h3>
            <div className="mt-2 space-y-3 rounded-2xl bg-parchment-50 p-4">
              {tampilParagraf.map((p, i) => (
                <p key={i} dir="rtl" lang="ar" className="font-arabic text-[15px] leading-loose text-ink-900">
                  {p}
                </p>
              ))}
            </div>
            {!paragrafKembang && (
              <button
                onClick={kembangkan}
                disabled={mengembangkan}
                className="btn-quiet mt-3 disabled:opacity-60"
              >
                {mengembangkan ? "Menyisipkan rujukan…" : "Kembangkan paragraf ini dengan rujukan valid"}
              </button>
            )}
            {paragrafKembang && (
              <div className="mt-3 rounded-xl border border-gold-300/60 bg-gold-50 p-3.5">
                <p className="text-xs leading-relaxed text-ink-600">
                  Penanda [[fn:…]] di atas menunjukkan tempat footnote akan
                  terpasang di ruang kerja penuh. Penanda itu bukan teks rusak:
                  di ruang kerja ia berubah menjadi footnote bernomor seperti
                  contoh berikut.
                </p>
                {contohFootnote && (
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs leading-relaxed text-ink-800">
                    <span className="font-semibold">Contoh footnote jadi:</span>{" "}
                    {contohFootnote}
                    <span className="mt-1 block text-ink-500">
                      Nomor halaman (hlm.) diisi dari sumber aslinya saat Anda
                      memasang footnote di ruang kerja.
                    </span>
                  </p>
                )}
                <button type="button" onClick={loginDariUjiCoba} className="btn-primary mt-3">
                  Masuk untuk mengembangkan paragraf ini
                </button>
                <p className="mt-2 text-xs text-ink-500">
                  Sesudah masuk, judul dan paragraf ini terbawa menjadi proyek
                  pertama Anda, dan pengembangan dilanjutkan di panel
                  Kembangkan dengan rujukan yang bisa Anda periksa satu per
                  satu.
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">Isykaliyat</h3>
                <ul className="mt-2 list-disc space-y-1 pr-5" dir="rtl">
                  {hasil.isykaliyat.map((s) => (
                    <li key={s} className="font-arabic text-sm text-ink-800">{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">Ahdaf</h3>
                <ul className="mt-2 list-disc space-y-1 pr-5" dir="rtl">
                  {hasil.ahdaf.map((s) => (
                    <li key={s} className="font-arabic text-sm text-ink-800">{s}</li>
                  ))}
                </ul>
              </div>
            </div>

          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">
              Rujukan yang ditemukan (cek lewat DOI/ISBN)
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Daftar rujukan ini sengaja tidak dikunci: salin judul, DOI, atau
              ISBN-nya untuk Anda periksa sendiri. Label "DOI/ISBN ketemu"
              hanya berarti nomor itu terdaftar, bukan berarti isinya sudah
              dibaca atau pasti cocok dengan judul Anda, jadi perhatikan juga
              label kecocokan topiknya. Tahun terbit yang tampak lebih baru
              bisa berasal dari data terbitan online-first.
            </p>
            <ul className="mt-2 space-y-2">
              {hasil.refs.map((r) => (
                <li key={r.id} className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm">
                  <span className="mr-2 rounded bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {r.jenis === "buku" ? "KITAB" : "JURNAL"}
                  </span>
                  <span className="font-semibold text-ink-900">{r.judul}</span>
                  <span className="text-ink-600">
                    {" "}— {r.penulis.join(", ")}{r.tahun ? ` (${r.tahun})` : ""}{r.wadah ? ` · ${r.wadah}` : ""}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {r.doi && (
                      <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" className="font-mono text-gold-700 underline underline-offset-2">
                        DOI: {r.doi}
                      </a>
                    )}
                    {r.isbn && <span className="font-mono text-gold-700">ISBN: {r.isbn}</span>}
                    {r.tautan && (
                      <a href={r.tautan} target="_blank" rel="noreferrer" className="text-gold-700 underline underline-offset-2">
                        {r.tautan.includes("openalex.org") ? "Lihat metadata di OpenAlex ↗" : "Buka sumber ↗"}
                      </a>
                    )}
                    <span className={r.terverifikasi ? "font-semibold text-emerald-700" : "text-ink-400"}>
                      {r.doi || r.isbn
                        ? r.terverifikasi
                          ? "✓ DOI/ISBN ketemu"
                          : "DOI/ISBN belum ketemu"
                        : "Tanpa DOI/ISBN"}
                    </span>
                    <span className={labelKecocokan(r).kelas}>{labelKecocokan(r).teks}</span>
                  </span>
                </li>
              ))}
              {hasil.refs.length === 0 && (
                <li className="text-sm text-ink-500">
                  Rujukan terverifikasi tidak ditemukan untuk judul ini saat ini — di ruang kerja
                  penuh Anda bisa mencari dengan kalimat kunci yang lebih spesifik.
                </li>
              )}
            </ul>

            <div className="mt-6 rounded-2xl bg-ink-900 p-4 text-center">
              <p className="text-sm font-semibold text-parchment-100">
                {googleAktif
                  ? "Ingin lebih lanjut? Silakan login gratis."
                  : "Ingin lebih lanjut? Masuk dengan kunci akses yang dibagikan pemilik lewat salurannya."}
              </p>
              <button type="button" onClick={loginDariUjiCoba} className="btn-primary mt-3 inline-block">
                {googleAktif ? "Login gratis dengan Google" : "Masuk dengan kunci akses"}
              </button>
              <p className="mt-2 text-xs text-parchment-100/70">
                Judul yang Anda coba di atas akan diteruskan menjadi proyek pertama Anda.
              </p>
            </div>
          </div>
          </>
        )}
      </div>
    </section>
  );
}
