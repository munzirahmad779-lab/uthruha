"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/engine/project";
import { bersihkanJudul, type Sumber } from "@/lib/engine/cite";
import { strukturProyek } from "@/lib/content/struktur";
import { composeNaskah, composeNaskahPerBab, composeSection } from "@/lib/engine/compose";
import {
  buatKompilator,
  cariMarker,
  kompilasiMarker,
  type EntriKompilasi,
  type HasilKompilasi,
  type MarkerSitasi,
} from "@/lib/engine/marker";
import { kampusProyek, modePerBab } from "@/lib/engine/hawamisy";
import { CopyButton } from "@/components/ui";

/**
 * Footnote bagian aktif — langsung tampil sesuai pedoman kampus (atau gaya
 * proyek), bernomor seperti di naskah utuh. Mahasiswa tidak lagi menyisipkan
 * atau menjaga kode penanda secara manual: pemasangan sitasi berjalan lewat
 * dialog pasang footnote (pratinjau pedoman) dan pencari rujukan (AI).
 * Penomoran per kemunculan (sitasi berulang = bentuk singkat) diambil dari
 * kompilasi naskah yang sebenarnya agar selalu cocok dengan hasil ekspor.
 */

export interface EntriFootnote {
  nomor: string;
  teks: string;
  kunci: string;
}

/** Teks efektif satu bagian, mencerminkan composeNaskah persis: draf
 *  mahasiswa dipakai bila ada, selain itu teks susunan otomatis. Untuk
 *  bagian yang sedang disunting (bagianId === aktifId), teksAktif
 *  (isi editor langsung) menang atas draf tersimpan. */
function teksBagian(p: Project, bagianId: string, aktifId?: string, teksAktif?: string): string {
  if (aktifId !== undefined && bagianId === aktifId && teksAktif !== undefined) return teksAktif;
  const draf = p.draf[bagianId];
  return draf && draf.trim().length > 20 ? draf : composeSection(p, bagianId).markdown;
}

export interface HasilKompilasiBagian {
  /** Teks bagian dengan penanda terkompilasi + definisi footnote bagian ini. */
  markdown: string;
  /** Entri footnote yang lahir dari bagian ini, bernomor dokumen. */
  entri: EntriKompilasi[];
  /** Penanda tak dikenal yang muncul di bagian ini. */
  takDikenal: MarkerSitasi[];
}

/**
 * Kompilasi SATU bagian dengan penomoran dokumen utuh: keadaan
 * kompilator disemai dari semua bagian sebelumnya (urutan struktur,
 * teks efektif yang sama dengan composeNaskah), jadi nomor dan bentuk
 * penuh/singkat di bagian ini persis seperti hasil ekspor dokumen.
 */
export function kompilasiBagian(p: Project, bagian: string, teksAktif?: string): HasilKompilasiBagian {
  const k = buatKompilator(p);
  const st = strukturProyek(p);
  for (const c of st.chapters) {
    // Batas bab eksplisit dari struktur: pada mode per-bab kompilator
    // menyetel ulang nomor + keadaan sudah-dikutip di sini (no-op
    // pada mode bersambung).
    k.babBaru();
    for (const s of c.sections) {
      if (s.id === bagian) {
        const sebelum = k.takDikenal.length;
        const { diganti, entriBaru } = k.proses(teksBagian(p, s.id, bagian, teksAktif));
        const definisi = entriBaru.map((e) => `[^${e.nomor}]: ${e.teks}`).join("\n");
        return {
          markdown: entriBaru.length > 0 ? `${diganti}\n\n${definisi}` : diganti,
          entri: entriBaru,
          takDikenal: k.takDikenal.slice(sebelum),
        };
      }
      k.proses(teksBagian(p, s.id));
    }
  }
  return { markdown: "", entri: [], takDikenal: [] };
}

export interface KemunculanPenanda {
  id: string;
  halaman?: string;
  jilid?: string;
  /** Nomor footnote dokumen untuk kemunculan ini; null = rujukan tak dikenal. */
  nomor: number | null;
  posisi: number;
}

/**
 * Nomor tampil tiap penanda di satu bagian, dalam urutan kemunculan di
 * teks bagian itu — dipakai chip editor agar nomornya selalu sama
 * dengan kompilasi dokumen. teksAktif menimpa teks efektif bagian yang
 * sedang disunting (isi editor langsung, belum tersimpan).
 */
export function kemunculanBagian(p: Project, bagian: string, teksAktif?: string): KemunculanPenanda[] {
  const perId = new Set(p.sumber.map((s) => s.id));
  const st = strukturProyek(p);
  const perBab = modePerBab(p);
  let berjalan = 0;
  for (const c of st.chapters) {
    if (perBab) berjalan = 0;
    for (const s of c.sections) {
      const teks = teksBagian(p, s.id, bagian, s.id === bagian ? teksAktif : undefined);
      const semua = cariMarker(teks);
      if (s.id === bagian) {
        return semua.map((m) => {
          const dikenal = perId.has(m.id);
          if (dikenal) berjalan++;
          return {
            id: m.id,
            halaman: m.halaman,
            jilid: m.jilid,
            nomor: dikenal ? berjalan : null,
            posisi: m.posisi,
          };
        });
      }
      berjalan += semua.filter((m) => perId.has(m.id)).length;
    }
  }
  return [];
}

/**
 * Kompilasi DOKUMEN utuh dengan batas bab eksplisit. Pada mode
 * bersambung hasilnya persis kompilasiMarker(composeNaskah(p))
 * (jalur lama, byte-identik). Pada mode per-bab (As'adiyah), tiap
 * bab dikompilasi dengan kompilator yang sama sesudah babBaru():
 * nomor mulai dari 1 per bab, bentuk penuh terulang pada kemunculan
 * pertama tiap bab, dan definisi footnote ditaruh di akhir babnya
 * masing-masing — bukan ditebak dari teks (syarat REVIEW-TAHAP-5).
 * Semua permukaan dokumen (ekspor, tab Rujukan, pratinjau dialog
 * Pasang) memakai fungsi ini agar nomornya selalu sepakat.
 */
export function kompilasiDokumen(p: Project): HasilKompilasi {
  if (!modePerBab(p)) return kompilasiMarker(composeNaskah(p), p);
  const k = buatKompilator(p);
  const { awal, bab } = composeNaskahPerBab(p);
  const potongan: string[] = [k.proses(awal).diganti];
  for (const babMd of bab) {
    k.babBaru();
    const { diganti, entriBaru } = k.proses(babMd);
    const definisi = entriBaru.map((e) => `[^${e.nomor}]: ${e.teks}`).join("\n");
    potongan.push(entriBaru.length > 0 ? `${diganti}\n\n${definisi}` : diganti);
  }
  return {
    markdown: potongan.join("\n\n---\n\n"),
    takDikenal: k.takDikenal,
    fragmen: k.fragmen,
    jumlah: k.jumlah,
  };
}

export function footnoteBagian(p: Project, bagian: string): EntriFootnote[] {
  return kompilasiBagian(p, bagian).entri.map((e) => ({
    nomor: String(e.nomor),
    teks: e.teks,
    kunci: `${bagian}-${e.nomor}`,
  }));
}

export function FootnoteBagian({
  p,
  bagian,
  onCariRujukan,
  onPasang,
  onGenerate,
  sibukGenerate,
}: {
  p: Project;
  bagian: string;
  onCariRujukan: () => void;
  onPasang: (sumber: Sumber) => void;
  /** Fitur Premium: generate footnote otomatis dari paragraf tempat kursor. */
  onGenerate: () => void;
  sibukGenerate?: boolean;
}) {
  const [sumberId, setSumberId] = useState("");
  const [tier, setTier] = useState<string | null>(null);
  const [catatanPremium, setCatatanPremium] = useState(false);
  useEffect(() => {
    let hidup = true;
    void fetch("/api/lapis/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (hidup) setTier(typeof d?.tier === "string" ? d.tier : "tamu");
      })
      .catch(() => {
        if (hidup) setTier("tamu");
      });
    return () => {
      hidup = false;
    };
  }, []);
  const daftar = useMemo(() => footnoteBagian(p, bagian), [p, bagian]);
  const terpilih = p.sumber.find((s) => s.id === (sumberId || p.sumber[0]?.id));

  return (
    <div className="mt-3 rounded-xl border border-ink-900/10 bg-white/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-ink-800">
          Footnote bagian ini — langsung sesuai {p.pedoman ? "pedoman kampus" : kampusProyek(p) ? "hawamisy template pedoman kampus" : "gaya sitasi proyek"} ({daftar.length})
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.sumber.length > 0 ? (
            <>
              <select
                className="input !w-auto max-w-52 !py-1 text-[12px]"
                value={sumberId || p.sumber[0]?.id}
                onChange={(e) => setSumberId(e.target.value)}
                aria-label="Pilih rujukan untuk dipasang"
              >
                {p.sumber.map((s) => (
                  <option key={s.id} value={s.id}>
                    {bersihkanJudul(s.judul).slice(0, 42) || s.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-quiet !py-1"
                disabled={!terpilih}
                onClick={() => terpilih && onPasang(terpilih)}
              >
                Pasang footnote
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-quiet !py-1"
              disabled
              title="Belum ada rujukan tersimpan di proyek ini"
            >
              Pasang footnote
            </button>
          )}
          {tier === "premium" ? (
            <button
              type="button"
              className="btn-quiet !py-1"
              disabled={sibukGenerate}
              title="Taruh kursor di paragraf yang mau diberi footnote, lalu klik ini: AI menyusun kalimat kunci, mencari rujukan di web, dan footnote langsung terpasang di kalimat yang tepat"
              onClick={onGenerate}
            >
              {sibukGenerate ? "Sedang menggenerate…" : "✦ Generate footnote"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-quiet !py-1"
              title="Fitur Premium"
              onClick={() => setCatatanPremium((v) => !v)}
            >
              🔒 Generate footnote
            </button>
          )}
          <button type="button" className="btn-quiet !py-1" onClick={onCariRujukan}>
            Cari rujukan (AI)
          </button>
        </div>
      </div>

      {catatanPremium && tier !== "premium" && (
        <p className="mt-1.5 rounded-lg bg-gold-500/10 px-2.5 py-2 text-[11.5px] leading-relaxed text-ink-700">
          <strong>Generate footnote</strong> adalah fitur Premium: taruh kursor di paragraf
          yang memuat data, AI menyusun kalimat kunci, mencari rujukan di web, dan footnote
          langsung terpasang di kalimat yang tepat, tanpa dialog dan tanpa memilih sendiri.
          Lapis gratis tetap bisa memasang footnote lewat dialog <em>Pasang footnote</em>.{" "}
          <Link href="/premium" className="font-semibold text-gold-700 underline">
            Lihat Premium
          </Link>
        </p>
      )}

      {p.sumber.length === 0 && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
          Tombol <em>Pasang footnote</em> belum aktif karena proyek ini belum memiliki rujukan
          tersimpan. Footnote manual hanya bisa dipasang dari rujukan yang sudah ada: klik{" "}
          <em>Cari rujukan (AI)</em> untuk mencari dan menambahkan, atau tambah manual di tab
          Rujukan, lalu kembali ke sini. Akun Premium bisa langsung memakai{" "}
          <em>Generate footnote</em>: AI mencarikan rujukan baru dari web dan memasangnya
          otomatis.
        </p>
      )}

      {daftar.length === 0 ? (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
          Belum ada sitasi di bagian ini. Caranya: (1) tulis atau tempel teks bagian ini dulu,
          boleh seluruhnya sekaligus; (2) akun Premium: taruh kursor di paragraf yang memuat
          data lalu klik <em>Generate footnote</em>, footnote langsung terpasang otomatis;
          (3) cara manual untuk semua lapis: pastikan proyek sudah punya rujukan tersimpan,
          pilih sumber di atas lalu klik <em>Pasang footnote</em>, lalu tentukan paragraf dan
          kalimat tempat catatan ini menempel dan isi halamannya. Footnote jadinya langsung
          tampil di sini, terformat pedoman dan bernomor. Belum punya sumbernya? Klik{" "}
          <em>Cari rujukan (AI)</em>, atau tambah manual di tab Rujukan.
        </p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {daftar.map((f) => (
            <li key={f.kunci} className="flex items-start justify-between gap-2 rounded-lg bg-parchment-100/70 px-2.5 py-1.5">
              <span className="font-naskh text-[12.5px] leading-relaxed text-ink-800" dir="rtl">
                <span className="ms-1 font-sans text-[11px] font-bold text-ink-500">{f.nomor}.</span>
                {f.teks}
              </span>
              <CopyButton teks={`${f.nomor}. ${f.teks}`} label="Salin" />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
