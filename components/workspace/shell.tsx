"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BIDANG } from "@/lib/content/bidang";
import { METODE } from "@/lib/content/metode";
import { KARYA_LABEL } from "@/lib/content/types";
import { strukturProyek } from "@/lib/content/struktur";
import {
  ambilProyek,
  progresProyek,
  simpanProyek,
  kataProyek,
  type Project,
} from "@/lib/engine/project";
import { composeSection } from "@/lib/engine/compose";
import { IconArrowRight, IconCheck, IconSparkle } from "@/components/icons";
import { Progress, Tabs } from "@/components/ui";
import { OverviewTab } from "@/components/workspace/overview";
import { StrukturTab } from "@/components/workspace/struktur-tab";
import { TulisTab } from "@/components/workspace/tulis-tab";
import { IstilahTab } from "@/components/workspace/istilah-tab";
import { RefTab } from "@/components/workspace/refs-tab";
import { AuditTab } from "@/components/workspace/audit-tab";
import { ExportTab } from "@/components/workspace/export-tab";
import { LoginGoogle } from "@/components/login-google";
import { PenyimpananStrip } from "@/components/workspace/penyimpanan-strip";

const TAB = [
  { id: "ringkas", label: "Ringkasan", ar: "نظرة" },
  { id: "struktur", label: "Struktur", ar: "الهيكل" },
  { id: "tulis", label: "Tulis", ar: "الكتابة" },
  { id: "istilah", label: "Istilah", ar: "المصطلحات" },
  { id: "rujukan", label: "Rujukan", ar: "المراجع" },
  { id: "periksa", label: "Periksa", ar: "التدقيق" },
  { id: "ekspor", label: "Ekspor", ar: "التصدير" },
];

export function Workspace({ id }: { id: string }) {
  const [proyek, setProyek] = useState<Project | null>(null);
  const [hilang, setHilang] = useState(false);
  const [galatSimpan, setGalatSimpan] = useState("");
  const [tab, setTab] = useState("ringkas");
  const [bagian, setBagian] = useState<string>("khalfiya");
  const [tersimpan, setTersimpan] = useState(true);

  useEffect(() => {
    let p: Project | null = null;
    try {
      p = ambilProyek(id);
    } catch {
      // VersiLebihBaruError dsb: perlakukan sebagai tidak bisa dibuka di sini.
      p = null;
    }
    if (!p) {
      setHilang(true);
      return;
    }
    setProyek(p);
    const pertama = strukturProyek(p).chapters[0]?.sections[0]?.id;
    if (pertama) setBagian(pertama);
  }, [id]);

  const ubah = useCallback((patch: Partial<Project>) => {
    setProyek((lama) => {
      if (!lama) return lama;
      const baru = { ...lama, ...patch };
      try {
        const disimpan = simpanProyek(baru);
        queueMicrotask(() => setGalatSimpan(""));
        return disimpan;
      } catch (e) {
        // Simpan gagal (mis. localStorage penuh): JANGAN senyap. Tampilkan
        // alasannya; perubahan tetap hidup di memori sesi ini.
        queueMicrotask(() =>
          setGalatSimpan(
            e instanceof Error ? e.message : "Penyimpanan gagal. Ekspor proyek Anda sebagai cadangan.",
          ),
        );
        return baru;
      }
    });
    setTersimpan(false);
    window.setTimeout(() => setTersimpan(true), 900);
  }, []);

  const susun = useCallback(
    (sectionId: string, seedBaru = 0) => {
      setProyek((lama) => {
        if (!lama) return lama;
        const hasil = composeSection(lama, sectionId, seedBaru);
        const baru = simpanProyek({
          ...lama,
          draf: { ...lama.draf, [sectionId]: hasil.markdown },
        });
        return baru;
      });
    },
    [],
  );

  const stat = useMemo(() => {
    if (!proyek) return null;
    const st = strukturProyek(proyek);
    const total = st.chapters.reduce((a, c) => a + c.sections.length, 0);
    return {
      total,
      progres: progresProyek(proyek, total),
      kata: kataProyek(proyek),
      target: st.chapters.reduce(
        (a, c) => a + c.sections.reduce((b, s) => b + s.targetKata, 0),
        0,
      ),
    };
  }, [proyek]);

  if (hilang) {
    return (
      <div className="wrap py-20 text-center">
        <h1 className="text-2xl font-extrabold text-ink-900">Proyek tidak ditemukan</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
          Proyek tersimpan di peramban perangkat ini. Bila Anda membuka tautan dari perangkat
          atau peramban lain, datanya tidak ikut pindah.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/proyek" className="btn-primary">
            Daftar proyek
          </Link>
          <Link href="/mulai" className="btn-ghost">
            Buat baru
          </Link>
        </div>
      </div>
    );
  }

  if (!proyek || !stat) {
    return (
      <div className="wrap py-14">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-ink-900/10" />
        <div className="mt-6 h-40 animate-pulse rounded-2xl border border-ink-900/10 bg-white/50" />
      </div>
    );
  }

  const bidang = BIDANG.find((b) => b.id === proyek.bidangId);
  const bagianTerpilih = bagian;

  function bukaBagian(sectionId: string) {
    setBagian(sectionId);
    setTab("tulis");
  }

  return (
    <div className="wrap py-6 sm:py-10">
      <nav className="flex items-center gap-2 text-[11px] text-ink-500" aria-label="Breadcrumb">
        <Link href="/proyek" className="hover:text-ink-900">
          Proyek
        </Link>
        <span>/</span>
        <span className="truncate text-ink-700">{proyek.topikAr || proyek.judulAr || "Tanpa judul"}</span>
      </nav>

      <header className="mt-4 rounded-2xl border border-ink-900/10 bg-white/70 p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-ink-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-parchment-100">
                {KARYA_LABEL[proyek.jenis].id}
              </span>
              <span className="chip">{METODE[proyek.metode].labelId}</span>
              <span className="chip">{bidang?.labelId ?? proyek.bidangId}</span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                  tersimpan ? "text-emerald-700" : "text-ink-400"
                }`}
              >
                <IconCheck className="h-3 w-3" />
                {tersimpan ? "Tersimpan" : "Menyimpan…"}
              </span>
            </div>
            <input
              value={proyek.judulAr || proyek.topikAr}
              onChange={(e) => ubah({ judulAr: e.target.value })}
              dir="rtl"
              placeholder="عنوان البحث"
              className="mt-2.5 w-full rounded-lg bg-transparent font-naskh text-xl leading-relaxed text-ink-900 outline-none placeholder:text-ink-300 focus:bg-white/60 focus:px-2 sm:text-2xl"
            />
          </div>
          <div className="w-full sm:w-56">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink-600">
              <span>Progres bagian</span>
              <span>{stat.progres}%</span>
            </div>
            <div className="mt-1.5">
              <Progress nilai={stat.progres} tebal />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-ink-600">
              Progres kata: {stat.kata.toLocaleString("id-ID")} dari target ±
              {stat.target.toLocaleString("id-ID")} kata (
              {stat.target > 0
                ? Math.min(100, Math.round((stat.kata / stat.target) * 100))
                : 0}
              %)
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-ink-500">
              Persen bagian menghitung bab yang sudah terisi; persen kata
              mengukur kedekatan ke naskah jadi. Keduanya memang bisa berbeda
              jauh.
            </p>
            <Link href="/mulai" className="btn-quiet mt-2 !px-0 text-[11px]">
              Ubah konteks proyek <IconArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Akun Kitabah — login Google IDENTITAS SAJA (Fase 3, keputusan A):
            masuk tidak meminta akses Drive sama sekali. */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-ink-900/10 pt-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Akun Kitabah</p>
            <div className="mt-1.5">
              <LoginGoogle />
            </div>
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Lapis</p>
            <Link href="/premium" className="text-[11px] font-semibold text-gold-700 underline underline-offset-2">
              Tentang Premium
            </Link>
          </div>
        </div>

      </header>

      <PenyimpananStrip />

      {galatSimpan && (
        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          <b>Gagal menyimpan:</b> {galatSimpan} Perubahan terakhir Anda masih tampil di layar
          tetapi belum tersimpan permanen — jangan tutup halaman ini sebelum mengekspor cadangan.
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-ink-900/10 bg-parchment-100/40">
        <div className="border-b border-ink-900/10 bg-white/60 px-3 py-2.5">
          <Tabs items={TAB} aktif={tab} onChange={setTab} />
        </div>

        <div className="p-4 sm:p-6">
          {tab === "ringkas" && (
            <OverviewTab p={proyek} ubah={ubah} onBuka={bukaBagian} onSusun={susun} />
          )}
          {tab === "struktur" && (
            <StrukturTab p={proyek} ubah={ubah} onBuka={bukaBagian} onSusun={susun} />
          )}
          {tab === "tulis" && (
            <TulisTab
              p={proyek}
              ubah={ubah}
              bagian={bagianTerpilih}
              setBagian={setBagian}
              onSusun={susun}
              onKembangkan={() => setTab("rujukan")}
            />
          )}
          {tab === "istilah" && <IstilahTab p={proyek} ubah={ubah} />}
          {tab === "rujukan" && <RefTab p={proyek} ubah={ubah} />}
          {tab === "periksa" && <AuditTab p={proyek} ubah={ubah} bagian={bagian} />}
          {tab === "ekspor" && <ExportTab p={proyek} onBuka={bukaBagian} />}
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-500">
        <IconSparkle className="h-3.5 w-3.5 text-gold-600" />
        Draf disusun dari konteks proyek dan bank frasa. Isi data, temuan, dan rujukan Anda
        sendiri sebelum dibawa ke bimbingan.
      </p>
    </div>
  );
}
