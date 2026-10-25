"use client";

import { useEffect, useState } from "react";
import { ukurPenyimpanan } from "@/lib/engine/project";

/**
 * Strip kuota penyimpanan peramban (C.7). Ambang: peringatan 70%, kritis 85%.
 * Pada 95% simpan akan ditolak dengan pesan (SimpanPenuhError) — strip ini
 * memberi tahu SEBELUM itu terjadi dan mengarahkan ke ekspor/GDrive.
 */
export function PenyimpananStrip() {
  const [info, setInfo] = useState<{ terpakai: number; persen: number } | null>(null);

  function ukur() {
    const u = ukurPenyimpanan();
    setInfo({ terpakai: u.terpakai, persen: u.persen });
  }

  useEffect(() => {
    ukur();
    const t = window.setInterval(ukur, 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (!info) return null;
  const mb = (info.terpakai / (1024 * 1024)).toFixed(2).replace(".", ",");
  const level = info.persen >= 85 ? "kritis" : info.persen >= 70 ? "waspada" : "aman";

  return (
    <div
      className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11.5px] ${
        level === "kritis"
          ? "border-red-200 bg-red-50 text-red-800"
          : level === "waspada"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-ink-900/10 bg-white/50 text-ink-600"
      }`}
      role={level !== "aman" ? "alert" : undefined}
    >
      <span>
        Penyimpanan peramban: <b>{info.persen}%</b> (±{mb} MB dari perkiraan 5 MB)
        {level === "waspada" && " — mulai rapikan: ekspor proyek lama atau sinkronkan ke Google Drive."}
        {level === "kritis" && " — hampir penuh! Ekspor/GDrive sekarang; penyimpanan bisa ditolak peramban pada 95%."}
      </span>
      <button type="button" className="btn-quiet !py-0.5" onClick={ukur}>
        Ukur ulang
      </button>
    </div>
  );
}
