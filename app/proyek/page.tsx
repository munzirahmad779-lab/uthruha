"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BIDANG } from "@/lib/content/bidang";
import { METODE } from "@/lib/content/metode";
import { KARYA_LABEL } from "@/lib/content/types";
import { getStruktur } from "@/lib/content/struktur";
import {
  daftarProyek,
  hapusProyek,
  duplikatProyek,
  newProject,
  progresProyek,
  simpanProyek,
  kataProyek,
  type Project,
} from "@/lib/engine/project";
import { IconArrowRight, IconBook, IconCopy, IconPlus, IconTrash } from "@/components/icons";
import { Progress } from "@/components/ui";
import { GDriveLogin } from "@/components/workspace/gdrive-login";

/** Kunci localStorage serah-terima dari uji coba tamu (components/uji-coba). */
const KUNCI_JUDUL_UJI = "uthruha.judulUjiCoba";

export default function DaftarProyekPage() {
  const [proyek, setProyek] = useState<Project[] | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null);
  const [catatanUji, setCatatanUji] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    (async () => {
      // Serah-terima judul uji coba: sesudah login dari halaman uji
      // coba, judul yang dicoba tamu diteruskan menjadi draf proyek
      // pertama — dibaca SATU kali lalu kuncinya dibuang.
      try {
        const mentah = localStorage.getItem(KUNCI_JUDUL_UJI);
        if (mentah) {
          localStorage.removeItem(KUNCI_JUDUL_UJI);
          const judul = (JSON.parse(mentah) as { judul?: unknown }).judul;
          if (typeof judul === "string" && judul.trim().length >= 10) {
            const sudahAda = daftarProyek().some(
              (p) => p.judulAr === judul.trim() || p.topikAr === judul.trim(),
            );
            if (!sudahAda) {
              const p = newProject({ judulAr: judul.trim(), topikAr: judul.trim() });
              simpanProyek(p);
              // Daftarkan ke server seperti alur /mulai: 403 (batas
              // proyek lapis) membatalkan draf lokal; 401/jaringan
              // gagal membiarkan draf lokal (dicoba lagi oleh sistem
              // saat footnote pertama, seperti proyek lama).
              try {
                const res = await fetch("/api/lapis/proyek", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: p.id, judul: judul.trim(), kategoriId: "umum" }),
                });
                if (res.status === 403) {
                  const data = (await res.json().catch(() => null)) as { error?: string } | null;
                  hapusProyek(p.id);
                  if (!batal) {
                    setCatatanUji(
                      data?.error ??
                        "Judul uji coba tidak diteruskan karena batas proyek lapis akun Anda.",
                    );
                  }
                } else if (res.ok && !batal) {
                  setCatatanUji(
                    "Judul uji coba Anda sudah diteruskan menjadi draf proyek pertama di bawah ini.",
                  );
                }
              } catch { /* jaringan gagal: draf lokal tetap ada */ }
            }
          }
        }
      } catch { /* abaikan — daftar proyek tetap dimuat */ }
      if (!batal) setProyek(daftarProyek());
    })();
    return () => {
      batal = true;
    };
  }, []);

  function hapus(id: string) {
    hapusProyek(id);
    setProyek(daftarProyek());
    setKonfirmasi(null);
  }

  function duplikat(id: string) {
    duplikatProyek(id);
    setProyek(daftarProyek());
  }

  return (
    <div className="wrap py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Ruang kerja</span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">
            Proyek Anda
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-600">
            Semua proyek tersimpan di peramban ini. Sinkronkan ke Google Drive agar aman.
          </p>
        </div>
        <Link href="/mulai" className="btn-primary">
          <IconPlus className="h-4 w-4" />
          Proyek baru
        </Link>
      </div>

      {/* Google Drive Sync */}
      <div className="mt-6">
        <GDriveLogin />
      </div>

      {catatanUji && (
        <p className="mt-4 rounded-lg bg-gold-100/60 px-3 py-2 text-[13px] text-ink-800">
          {catatanUji}
        </p>
      )}

      {proyek === null && (
        <div className="mt-10 grid gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-ink-900/10 bg-white/50" />
          ))}
        </div>
      )}

      {proyek !== null && proyek.length === 0 && (
        <div className="mt-10 card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-900 text-gold-300">
            <IconBook className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-lg font-bold text-ink-900">Belum ada proyek</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-600">
            Mulai dengan menentukan jenis karya, bidang, dan metode. Konteksnya dipakai ulang
            oleh semua tab di ruang kerja.
          </p>
          <Link href="/mulai" className="btn-gold mt-6">
            Mulai proyek pertama
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {proyek !== null && proyek.length > 0 && (
        <div className="mt-8 grid gap-3">
          {proyek.map((p) => {
            const st = getStruktur(p.jenis);
            const total = st.chapters.reduce((a, c) => a + c.sections.length, 0);
            const progres = progresProyek(p, total);
            const kata = kataProyek(p);
            const bidang = BIDANG.find((b) => b.id === p.bidangId);
            return (
              <div
                key={p.id}
                className="card group flex flex-col gap-4 p-5 transition hover:border-gold-500/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ink-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-parchment-100">
                      {KARYA_LABEL[p.jenis].id}
                    </span>
                    <span className="chip">{METODE[p.metode].labelId}</span>
                    <span className="chip">{bidang?.labelId}</span>
                  </div>
                  <h2
                    className="mt-2.5 truncate text-right font-naskh text-lg leading-relaxed text-ink-900 sm:text-left"
                    dir={p.judulAr ? "rtl" : "ltr"}
                  >
                    {p.judulAr || p.topikAr || "Tanpa judul"}
                  </h2>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {kata.toLocaleString("id-ID")} kata · {Object.keys(p.draf).length} bagian berisi ·
                    diperbarui{" "}
                    {new Date(p.diperbarui).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress nilai={progres} tebal />
                    <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-ink-600">
                      {progres}%
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => duplikat(p.id)}
                    title="Duplikat"
                    className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-900/5 hover:text-ink-900"
                  >
                    <IconCopy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setKonfirmasi(p.id)}
                    title="Hapus"
                    className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                  <Link href={`/proyek/${p.id}`} className="btn-primary !px-4 !py-2.5 text-[12.5px]">
                    Buka
                    <IconArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {konfirmasi && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lift">
            <h3 className="text-base font-bold text-ink-900">Hapus proyek ini?</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
              Draf, istilah, dan daftar rujukan di dalamnya akan hilang dari peramban ini dan
              tidak bisa dikembalikan.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-quiet" onClick={() => setKonfirmasi(null)}>
                Batal
              </button>
              <button
                type="button"
                className="btn bg-red-600 text-white hover:bg-red-700"
                onClick={() => hapus(konfirmasi)}
              >
                Ya, hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
