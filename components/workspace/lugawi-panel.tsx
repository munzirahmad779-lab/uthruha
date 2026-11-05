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
import { getBidang } from "@/lib/content/bidang";

const PENANDA_BIDANG_LAIN = [
  "التربية البدنية",
  "علوم الرياضة",
  "sport",
  "علم النفس",
  "psycholog",
  "رواية",
  "novel",
  "الطب",
  "kedokteran",
  "medicine",
];

/** Normalisasi untuk pencocokan judul: buang harakat dan tatwil, samakan ة/ه dan ى/ي. */
function normalisasiTeks(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭ]/g, "")
    .replace(/ـ/g, "")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/أ|إ|آ/g, "ا");
}

function memuatNormal(teks: string, potongan: string): boolean {
  const p = normalisasiTeks(potongan).trim();
  if (!p) return false;
  return normalisasiTeks(teks).includes(p);
}

/**
 * Panel Lugawi & Istilahi — menjawab kesulitan mahasiswa mencari makna kamus
 * (lugawi) dan makna istilah (istilahi) satu kata, termasuk kata serapan dan
 * istilah kontemporer non-Arab: dicek ke kitab, kamus/ensiklopedia terbuka,
 * dan jurnal; kesimpulan bertingkat; bila mentok, prompt siap salin ke Yusuf AI.
 *
 * Aturan Pencarian Valid, lapis kitab (Tahap F; putusan pemilik 5 Nov
 * 2026 15:57, blokir keras penuh, standar tunggal semua jalur):
 *  - Daftar "Pemakaian di jurnal" TIDAK lagi cukup disaring penanda
 *    bidang lokal di peramban. Setiap hits diperiksa ke endpoint
 *    verifikasi yang sama dengan jalur jurnal lain (metadata Crossref
 *    hidup + bidang proyek, POST /api/refs/verifikasi-jurnal) dan
 *    hanya putusan "terverifikasi" yang tampil sebagai pemakaian sah;
 *    sisanya turun ke kelompok terpisah berlabel putusan + alasan.
 *    Kueri istilahnya sendiri tetap istilah tunggal menurut fungsi
 *    panel ini; yang dinaikkan standarnya adalah hasil-hasilnya.
 *  - Entri "Di kitab" menampilkan keadaan verifikasi rekod sumbernya
 *    secara terbuka: bertautan rekod dan tidak bertanda perlu
 *    verifikasi berarti "Terverifikasi ke rekod sumber"; selain itu
 *    berlabel "Belum terverifikasi" beserta alasannya (tautan rekod
 *    tidak bisa dibuka, atau jilid/halaman cetak belum pasti).
 *  - Panel ini tidak mempunyai pintu tambah ke daftar rujukan proyek
 *    (jurnal dan kitab hanya tampil); yang dikunci standarnya adalah
 *    apa yang boleh tampil sebagai sah.
 */

/** Status putusan verifikasi satu kandidat jurnal (cermin
 *  StatusVerifikasi server di lib/server/verifikasi-rujukan.ts,
 *  ditambah "memeriksa" untuk keadaan sebelum putusan tiba). */
type StatusPutusan =
  | "terverifikasi"
  | "gagal-metadata"
  | "gagal-bidang"
  | "belum-terverifikasi"
  | "memeriksa";

interface PutusanKandidat {
  status: StatusPutusan;
  alasan: string;
}

const LENCANA_PUTUSAN: Record<StatusPutusan, { label: string; kelas: string }> = {
  terverifikasi: { label: "Terverifikasi", kelas: "bg-emerald-100 text-emerald-800" },
  "gagal-metadata": { label: "Gagal periksa metadata", kelas: "bg-red-100 text-red-800" },
  "gagal-bidang": { label: "Tidak sesuai bidang", kelas: "bg-red-100 text-red-800" },
  "belum-terverifikasi": { label: "Belum terverifikasi", kelas: "bg-amber-100 text-amber-800" },
  memeriksa: { label: "Memeriksa", kelas: "bg-ink-900/10 text-ink-600" },
};

/** Peringkat tampil sesudah putusan: yang sah di atas, yang gagal
 *  paling bawah (penegasan pemilik: ditandai dan diturunkan). */
function peringkatPutusan(status: StatusPutusan): number {
  if (status === "terverifikasi") return 0;
  if (status === "memeriksa") return 1;
  if (status === "belum-terverifikasi") return 2;
  return 3;
}

export function LugawiPanel({
  online,
  bidangId,
  judulProyek,
}: {
  online: boolean;
  bidangId?: string;
  judulProyek?: string;
}) {
  const [kata, setKata] = useState("");
  const [bentukArab, setBentukArab] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [sudahCari, setSudahCari] = useState(false);
  const [kamus, setKamus] = useState<EntriKamus[]>([]);
  const [etimologi, setEtimologi] = useState("");
  const [padanan, setPadanan] = useState<string | null>(null);
  const [hitsKitab, setHitsKitab] = useState<HitKitabMentah[]>([]);
  const [jurnal, setJurnal] = useState<Sumber[]>([]);
  /** Putusan verifikasi per hits jurnal, dikunci id sumber. Hanya
   *  "terverifikasi" yang tampil sebagai pemakaian sah; keadaan awal
   *  tiap hits adalah "memeriksa". */
  const [putusanJurnal, setPutusanJurnal] = useState<Record<string, PutusanKandidat>>({});
  const [kataKitabDipakai, setKataKitabDipakai] = useState("");
  const [kataDicari, setKataDicari] = useState("");

  /**
   * Periksa sekumpulan hits jurnal ke POST /api/refs/verifikasi-jurnal
   * (maks 15 per panggilan, dipotong di sini) — standar yang sama
   * dengan panel topik dan dirasah: metadata Crossref hidup + bidang
   * proyek. Status awal "memeriksa"; panggilan yang gagal membuat
   * hits-nya "belum-terverifikasi" (tertahan), bukan lolos karena
   * pemeriksanya tidak jalan.
   */
  async function periksaJurnalLugawi(daftar: Sumber[]) {
    if (daftar.length === 0) return;
    setPutusanJurnal((m) => {
      const n = { ...m };
      for (const s of daftar) {
        n[s.id] = { status: "memeriksa", alasan: "Sedang diperiksa ke Crossref dan gerbang bidang." };
      }
      return n;
    });
    for (let i = 0; i < daftar.length; i += 15) {
      const potong = daftar.slice(i, i + 15);
      try {
        const res = await fetch("/api/refs/verifikasi-jurnal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kandidat: potong.map((s) => ({
              id: s.id,
              doi: s.doi,
              judul: s.judul,
              jurnal: s.jurnal,
              tahun: s.tahun,
              sumberImpor: s.sumberImpor,
            })),
            bidangId,
            judulProyek: judulProyek ?? "",
            topikAr: judulProyek ?? "",
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          hasil?: { id: string; status: StatusPutusan; alasan: string }[];
          error?: string;
        } | null;
        if (!res.ok || !data || !Array.isArray(data.hasil)) {
          throw new Error(data?.error ?? "verifikasi gagal");
        }
        const hasilServer = data.hasil;
        setPutusanJurnal((m) => {
          const n = { ...m };
          for (const h of hasilServer) n[h.id] = { status: h.status, alasan: h.alasan };
          for (const s of potong) {
            if (!n[s.id] || n[s.id]!.status === "memeriksa") {
              n[s.id] = {
                status: "belum-terverifikasi",
                alasan: "Hits ini tidak mendapat putusan dari server verifikasi.",
              };
            }
          }
          return n;
        });
      } catch {
        setPutusanJurnal((m) => {
          const n = { ...m };
          for (const s of potong) {
            n[s.id] = {
              status: "belum-terverifikasi",
              alasan: "Pemeriksaan tidak dapat berjalan; periksa makna lagi untuk memeriksanya ulang.",
            };
          }
          return n;
        });
      }
    }
  }

  async function periksa() {
    const k = kata.trim();
    if (!k || sibuk) return;
    setKataDicari(k);
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
      setPutusanJurnal({});
      // Hits jurnal WAJIB diperiksa endpoint verifikasi sebelum ada
      // yang tampil sebagai pemakaian sah (Aturan Pencarian Valid,
      // lapis kitab): metadata Crossref hidup + bidang proyek.
      void periksaJurnalLugawi(jurnalRes.entri);
      setKataKitabDipakai(kataKitab);
      setSudahCari(true);
    } finally {
      setSibuk(false);
    }
  }

  const arab = mengandungArab(kata.trim());
  // Pemakaian jurnal hanya menyokong kesimpulan bila ada hits yang
  // LULUS periksa verifikasi (Aturan Pencarian Valid): temuan yang
  // gagal metadata atau di luar bidang tidak dihitung sebagai bukti
  // pemakaian istilah, berapa pun banyaknya.
  const adaJurnalSah = jurnal.some((s) => putusanJurnal[s.id]?.status === "terverifikasi");
  const kesimpulan = sudahCari
    ? simpulkanLugawi({
        adaKitab: hitsKitab.length > 0,
        adaKamus: arab && kamus.length > 0,
        adaPadanan: !!padanan,
        adaJurnal: adaJurnalSah,
      })
    : null;
  const prompt = promptMuseLugawi(kata.trim() || "…");

  const jurnalTersaring = (() => {
    const kandidatKata = [kataDicari || kata.trim(), bentukArab.trim(), padanan ?? "", kataKitabDipakai].filter(Boolean);
    const keywordsBidang = bidangId ? getBidang(bidangId).keywords : [];
    const dinilai = jurnal.map((s, idx) => {
      const memuatKata = kandidatKata.some((k) => memuatNormal(s.judul, k));
      const asing = PENANDA_BIDANG_LAIN.some((penanda) => {
        if (!memuatNormal(s.judul, penanda) && !memuatNormal(s.jurnal ?? "", penanda)) return false;
        const termasukBidangProyek = keywordsBidang.some((kw) => {
          const kwN = normalisasiTeks(kw);
          const penN = normalisasiTeks(penanda);
          return kwN === penN || kwN.includes(penN) || penN.includes(kwN);
        });
        return !termasukBidangProyek;
      });
      const peringkat = memuatKata && !asing ? 0 : memuatKata && asing ? 1 : 2;
      return { s, idx, memuatKata, asing, peringkat };
    });
    dinilai.sort((a, b) => a.peringkat - b.peringkat || a.idx - b.idx);
    return dinilai;
  })();

  // Standar tunggal Aturan Pencarian Valid: saringan lokal di atas
  // hanya penanda bantu. Yang menentukan satu hits boleh tampil
  // sebagai "Pemakaian di jurnal" adalah putusan server verifikasi:
  // "terverifikasi" masuk kelompok sah (urutan saringan lokal
  // dipertahankan di dalamnya); semua putusan lain turun ke kelompok
  // tidak lulus periksa, diurutkan memeriksa → belum terverifikasi →
  // gagal, dan tidak pernah dicampur setara dengan yang sah.
  const jurnalDinilai = jurnalTersaring.map((d) => ({
    ...d,
    status: (putusanJurnal[d.s.id]?.status ?? "memeriksa") as StatusPutusan,
    alasan: putusanJurnal[d.s.id]?.alasan,
  }));
  const jurnalSah = jurnalDinilai.filter((d) => d.status === "terverifikasi");
  const jurnalTidakSah = jurnalDinilai
    .filter((d) => d.status !== "terverifikasi")
    .sort(
      (a, b) =>
        peringkatPutusan(a.status) - peringkatPutusan(b.status) ||
        a.peringkat - b.peringkat ||
        a.idx - b.idx,
    );

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
          {jurnal.length > 0 && !adaJurnalSah && (
            <span className="mt-1 block text-[11px] opacity-80">
              Ada temuan jurnal untuk kata ini, tetapi belum ada yang lulus periksa metadata dan
              bidang sebagai pemakaian yang sah (lihat daftarnya di bawah), jadi temuan itu tidak
              dihitung pada kesimpulan ini.
            </span>
          )}
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
          {hitsKitab.slice(0, 8).map((h) => {
            // Keadaan verifikasi rekod sumber ditampilkan terbuka
            // (Aturan Pencarian Valid, lapis kitab): entri hanya
            // "Terverifikasi ke rekod sumber" bila membawa tautan
            // rekod yang bisa dibuka DAN tidak bertanda perlu
            // verifikasi dari adapter sumbernya. Selain itu berlabel
            // "Belum terverifikasi" beserta alasannya — tanda
            // perluVerifikasi tidak lagi disembunyikan dari tampilan.
            const urlSah = amanUrl(h.url_sumber);
            const kitabTerverifikasi = !h.perluVerifikasi && !!urlSah;
            const alasanBelum: string[] = [];
            if (!urlSah) alasanBelum.push("entri ini tidak membawa tautan rekod sumber yang bisa dibuka");
            if (h.perluVerifikasi) alasanBelum.push("indeks menemukan frasa ini, tetapi jilid/halaman cetaknya belum pasti");
            return (
            <div key={h.id} className="rounded-xl border border-ink-900/10 bg-white/70 p-3">
              <p className="text-right font-naskh text-[13.5px] font-semibold text-ink-900" dir="rtl">{h.kitab}</p>
              <p className="mt-0.5 text-[11px] text-ink-600">
                {h.penulis ?? ""}{h.jilid ? ` · jilid ${h.jilid}` : ""}{h.halaman_cetak ? ` · hlm. cetak ${h.halaman_cetak}` : ""} · sumber: {h.source}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed">
                {kitabTerverifikasi ? (
                  <>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">Terverifikasi ke rekod sumber</span>{" "}
                    <span className="text-ink-600">Judul kitab, pengarang, dan jilid/halaman di atas mengikuti rekod {h.source}; tetap cocokkan teksnya dengan Ctrl+F sebelum mengutip.</span>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Belum terverifikasi</span>{" "}
                    <span className="text-ink-600">{alasanBelum.join("; ")} — jangan disitasi sebelum rekodnya Anda periksa langsung.</span>
                  </>
                )}
              </p>
              <p className="mt-1 line-clamp-2 text-right font-naskh text-[12.5px] leading-relaxed text-ink-700" dir="rtl">{h.teks_kutipan}</p>
              {urlSah && (
                <a className="btn-quiet mt-1.5 inline-block" href={urlSah} target="_blank" rel="noreferrer">Buka ↗</a>
              )}
            </div>
            );
          })}
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
          <h4 className="text-[12px] font-bold text-ink-900">Pemakaian di jurnal ({jurnalSah.length})</h4>
          <p className="text-[11px] leading-relaxed text-ink-500">
            Hanya pemakaian yang lulus periksa server yang tampil di sini: metadata cocok dengan rekod
            Crossref hidup dan isinya sesuai bidang proyek Anda, dengan standar yang sama seperti
            pencarian jurnal di panel topik. Temuan yang tidak lulus periksa turun ke kelompoknya
            sendiri di bawah, berlabel putusan dan alasannya.
          </p>
          {jurnalSah.length === 0 && (
            <p className="text-[11.5px] leading-relaxed text-ink-500">
              {jurnalTidakSah.some((d) => d.status === "memeriksa")
                ? "Sedang memeriksa pemakaian jurnal ke Crossref dan gerbang bidang…"
                : "Tidak ada pemakaian jurnal yang lulus periksa untuk kata ini."}
            </p>
          )}
          {jurnalSah.slice(0, 8).map(({ s, memuatKata }) => (
            <p key={s.id} className="rounded-lg bg-white/60 px-2.5 py-1.5 text-[12px] text-ink-700">
              <span className="font-semibold text-ink-900">{s.judul}</span> — {s.jurnal} ({s.tahun})
              <span className="ml-2 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                Terverifikasi
              </span>
              {!memuatKata && (
                <span className="ml-2 inline-block rounded bg-ink-900/5 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
                  kata tidak muncul di judul, periksa isinya
                </span>
              )}
            </p>
          ))}
          {jurnalTidakSah.length > 0 && (
            <>
              <h4 className="pt-1 text-[12px] font-bold text-ink-900">
                Temuan jurnal yang tidak lulus periksa ({jurnalTidakSah.length})
              </h4>
              <p className="text-[11px] leading-relaxed text-ink-500">
                Pencari menemukan temuan berikut, tetapi periksa server tidak meluluskannya; temuan ini
                tidak tampil sebagai pemakaian istilah yang sah.
              </p>
              {jurnalTidakSah.slice(0, 8).map(({ s, status, alasan, memuatKata, asing }) => {
                const lencana = LENCANA_PUTUSAN[status];
                return (
                  <div key={s.id} className="rounded-lg bg-white/60 px-2.5 py-1.5 text-[12px] text-ink-700">
                    <p>
                      <span className="font-semibold text-ink-900">{s.judul}</span> — {s.jurnal} ({s.tahun})
                      <span className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${lencana.kelas}`}>
                        {lencana.label}
                      </span>
                      {asing && (
                        <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          di luar bidang proyek Anda
                        </span>
                      )}
                      {!memuatKata && (
                        <span className="ml-2 inline-block rounded bg-ink-900/5 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
                          kata tidak muncul di judul, periksa isinya
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
                      {alasan ?? "Sedang diperiksa ke Crossref dan gerbang bidang."}
                    </p>
                  </div>
                );
              })}
            </>
          )}
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
