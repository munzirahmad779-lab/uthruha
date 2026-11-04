"use client";

import { useState } from "react";
import {
  penyediaSerah,
  siapkanSerahKembangkan,
  type KonteksKembangkan,
} from "@/lib/engine/ai-handoff";
import { IconCheck, IconClose, IconCopy, IconExternal, IconSparkle } from "@/components/icons";

/**
 * Panel "Kembangkan di AI luar" (Pembangunan Ulang Tahap 8).
 *
 * Satu sumber kebenaran: string yang tampil di textarea, yang disalin
 * ke papan klip, dan yang mendampingi pembukaan tab penyedia adalah
 * `serah.prompt` yang sama dari siapkanSerahKembangkan. Panel tidak
 * mengirim apa pun ke mana pun: penyalinan hanya terjadi atas tekan
 * tombol mahasiswa, dan hasilnya ia tempel kembali sendiri.
 */

async function salinTeks(teks: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = teks;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export function SerahAiPanel({
  konteks,
  labelTeks,
  onTutup,
}: {
  konteks: KonteksKembangkan;
  /** Penjelasan asal teks yang diserahkan, mis. "teks yang Anda blok di editor". */
  labelTeks: string;
  onTutup: () => void;
}) {
  const daftar = penyediaSerah();
  const [idAktif, setIdAktif] = useState(daftar[0]?.id ?? "gpt");
  const [tersalin, setTersalin] = useState(false);
  const [gagalSalin, setGagalSalin] = useState(false);
  const serah = siapkanSerahKembangkan(konteks, idAktif);

  async function salin(): Promise<boolean> {
    if (!serah) return false;
    const ok = await salinTeks(serah.prompt);
    setGagalSalin(!ok);
    if (ok) {
      setTersalin(true);
      window.setTimeout(() => setTersalin(false), 2000);
    }
    return ok;
  }

  async function salinDanBuka() {
    if (!serah) return;
    const ok = await salin();
    // Tab penyedia hanya dibuka bila prompt benar-benar tersalin, agar
    // mahasiswa tidak tiba di situs luar dengan tangan kosong.
    if (ok) window.open(serah.provider.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-3 rounded-xl border border-ink-900/15 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink-900">
          <IconSparkle className="h-4 w-4 text-gold-600" /> Kembangkan di AI luar
        </p>
        <button type="button" onClick={onTutup} className="btn-ghost !py-1 !text-[11px]">
          <IconClose className="h-3.5 w-3.5" /> Tutup panel
        </button>
      </div>

      <p className="mt-1 text-[12px] leading-relaxed text-ink-700">
        Pengembangan dilakukan di situs AI luar, bukan di dalam Kitabah, dan tidak ada yang
        terkirim otomatis. Tekan tombol salin, tempel prompt-nya di situs penyedia pilihan
        Anda, kembangkan teksnya di sana, lalu tempel hasilnya kembali ke draf Anda sendiri.
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-700">
        Teks yang diserahkan: <strong>{labelTeks}</strong>
        {serah ? (
          <>
            {" "}
            ({serah.jumlahKata.toLocaleString("id-ID")} kata). Yang ikut tersalin hanya judul
            penelitian, nama bagian, konteks pedoman, dan teks ini.
          </>
        ) : null}
      </p>

      {!serah ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
          Bagian ini belum ada teksnya, jadi belum ada prompt yang bisa disusun. Tulis dulu
          drafnya (atau blok teks di editor), lalu buka lagi panel ini.
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Pilih AI luar">
            {daftar.map((pvd) => {
              const on = pvd.id === idAktif;
              return (
                <button
                  key={pvd.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setIdAktif(pvd.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                    on
                      ? "border-ink-900 bg-ink-900 text-parchment-100"
                      : "border-ink-900/15 bg-white text-ink-700 hover:bg-ink-900/5"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: pvd.warna }}
                    aria-hidden
                  />
                  {pvd.nama}
                </button>
              );
            })}
          </div>

          <textarea
            readOnly
            value={serah.prompt}
            dir="rtl"
            rows={10}
            aria-label="Prompt siap salin"
            className="input mt-2.5 w-full font-naskh text-[13px] leading-relaxed"
            onFocus={(e) => e.currentTarget.select()}
          />

          {serah.terpotong && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
              Prompt ini terpotong dari {serah.panjangAsli.toLocaleString("id-ID")} karakter ke
              batas aman {serah.provider.nama} di dalam aplikasi (
              {serah.provider.batasKarakter.toLocaleString("id-ID")} karakter), jadi teks yang
              tampil di atas tidak utuh. Kembangkan bagian yang tampil ini dulu, lalu ulangi
              panel ini untuk sisanya.
            </p>
          )}
          {gagalSalin && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] leading-relaxed text-red-800">
              Penyalinan otomatis gagal. Klik kotak prompt di atas (teksnya akan terblok), salin
              manual dengan Ctrl+C, lalu buka situs {serah.provider.nama} sendiri.
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void salin()} className="btn-primary !py-1.5 !text-[12px]">
              {tersalin ? (
                <>
                  <IconCheck className="h-3.5 w-3.5" /> Prompt tersalin
                </>
              ) : (
                <>
                  <IconCopy className="h-3.5 w-3.5" /> Salin prompt
                </>
              )}
            </button>
            <button type="button" onClick={() => void salinDanBuka()} className="btn-quiet !py-1.5 !text-[12px]">
              <IconExternal className="h-3.5 w-3.5" /> Salin &amp; buka {serah.provider.nama}
            </button>
            <span className="text-[11px] text-ink-500">
              Tombol kedua menyalin prompt yang sama persis dengan yang tampil, lalu membuka{" "}
              {serah.provider.nama} di tab baru.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
