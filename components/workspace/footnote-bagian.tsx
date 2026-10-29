"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/engine/project";
import type { Sumber } from "@/lib/engine/cite";
import { strukturProyek } from "@/lib/content/struktur";
import { composeNaskah, composeSection } from "@/lib/engine/compose";
import { kompilasiMarker } from "@/lib/engine/marker";
import { CopyButton } from "@/components/ui";

/**
 * Footnote bagian aktif — langsung tampil sesuai pedoman kampus (atau gaya
 * proyek), bernomor seperti di naskah utuh. Mahasiswa tidak lagi menyisipkan
 * atau menjaga kode penanda secara manual: pemasangan sitasi berjalan lewat
 * dialog pasang footnote (pratinjau pedoman) dan pencari rujukan (AI).
 * Penomoran per kemunculan (sitasi berulang = bentuk singkat) diambil dari
 * kompilasi naskah yang sebenarnya agar selalu cocok dengan hasil ekspor.
 */

const POLA = /\[\[ref:([^\]|]+)(?:\|hlm:([^\]|]*))?(?:\|jilid:([^\]]*))?\]\]/g;

export interface EntriFootnote {
  nomor: string;
  teks: string;
  kunci: string;
}

export function footnoteBagian(p: Project, bagian: string): EntriFootnote[] {
  const hasil = kompilasiMarker(composeNaskah(p), p);
  const defs = [...hasil.markdown.matchAll(/^\[\^(\d+)\]: (.*)$/gm)].map((m) => ({
    nomor: m[1] ?? "",
    teks: m[2] ?? "",
  }));
  if (defs.length === 0) return [];
  const perId = new Set(p.sumber.map((s) => s.id));
  const st = strukturProyek(p);
  let berjalan = 0;
  for (const c of st.chapters) {
    for (const s of c.sections) {
      // Cerminkan composeNaskah persis: draf mahasiswa dipakai bila ada,
      // selain itu teks susunan otomatis bagian itu.
      const draf = p.draf[s.id];
      const teksBagian = draf && draf.trim().length > 20 ? draf : composeSection(p, s.id).markdown;
      const cocok = [...teksBagian.matchAll(POLA)].filter((m) => perId.has((m[1] ?? "").trim()));
      if (s.id === bagian) {
        return cocok
          .map((_, i) => ({
            nomor: defs[berjalan + i]?.nomor ?? "?",
            teks: defs[berjalan + i]?.teks ?? "",
            kunci: `${s.id}-${berjalan + i}`,
          }))
          .filter((e) => e.teks);
      }
      berjalan += cocok.length;
    }
  }
  return [];
}

export function FootnoteBagian({
  p,
  bagian,
  onCariRujukan,
  onPasang,
  onPasangKursor,
}: {
  p: Project;
  bagian: string;
  onCariRujukan: () => void;
  onPasang: (sumber: Sumber) => void;
  /** Fitur Premium: dialog terbuka dengan paragraf & kalimat dari posisi kursor. */
  onPasangKursor?: (sumber: Sumber) => void;
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
          Footnote bagian ini — langsung sesuai {p.pedoman ? "pedoman kampus" : "gaya sitasi proyek"} ({daftar.length})
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
                    {s.judul.slice(0, 42) || s.id}
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
              {tier === "premium" ? (
                <button
                  type="button"
                  className="btn-quiet !py-1"
                  disabled={!terpilih}
                  title="Taruh kursor di kalimat yang memuat data pada teks di atas, lalu klik ini: paragraf dan kalimat tujuan terisi otomatis"
                  onClick={() => terpilih && onPasangKursor?.(terpilih)}
                >
                  Pasang di posisi kursor
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-quiet !py-1"
                  title="Fitur Premium"
                  onClick={() => setCatatanPremium((v) => !v)}
                >
                  🔒 Pasang di posisi kursor
                </button>
              )}
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
          <button type="button" className="btn-quiet !py-1" onClick={onCariRujukan}>
            Cari rujukan (AI)
          </button>
        </div>
      </div>

      {catatanPremium && tier !== "premium" && (
        <p className="mt-1.5 rounded-lg bg-gold-500/10 px-2.5 py-2 text-[11.5px] leading-relaxed text-ink-700">
          <strong>Pasang di posisi kursor</strong> adalah fitur Premium: taruh kursor di kalimat
          yang memuat data, lalu footnote terpasang tepat di situ tanpa memilih paragraf dan
          kalimat dari daftar. Lapis gratis tetap bisa memasang footnote lewat dialog biasa.{" "}
          <Link href="/premium" className="font-semibold text-gold-700 underline">
            Lihat Premium
          </Link>
        </p>
      )}

      {p.sumber.length === 0 && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
          Tombol <em>Pasang footnote</em> belum aktif karena proyek ini belum memiliki rujukan
          tersimpan. Footnote hanya bisa dipasang dari rujukan yang sudah ada: klik{" "}
          <em>Cari rujukan (AI)</em> untuk mencari dan menambahkan, atau tambah manual di tab
          Rujukan, lalu kembali ke sini.
        </p>
      )}

      {daftar.length === 0 ? (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
          Belum ada sitasi di bagian ini. Caranya: (1) tulis atau tempel teks bagian ini dulu,
          boleh seluruhnya sekaligus; (2) pastikan proyek sudah punya rujukan tersimpan, pilih
          sumber di atas lalu klik <em>Pasang footnote</em>;
          (3) di dialog yang terbuka, tentukan paragraf dan kalimat tempat catatan ini menempel,
          isi halamannya, lalu pasang. Footnote jadinya langsung tampil di sini, terformat pedoman
          dan bernomor. Belum punya sumbernya? Klik <em>Cari rujukan (AI)</em>, atau tambah manual
          di tab Rujukan.
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
