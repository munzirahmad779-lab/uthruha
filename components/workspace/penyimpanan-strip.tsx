"use client";

import { useEffect, useRef, useState } from "react";
import { ukurPenyimpanan } from "@/lib/engine/project";

/**
 * Strip kuota penyimpanan peramban (C.7). Ambang: peringatan 70%, kritis 85%.
 * Pada 95% simpan akan ditolak dengan pesan (SimpanPenuhError) — strip ini
 * memberi tahu SEBELUM itu terjadi dan mengarahkan ke ekspor cadangan.
 *
 * Umpan balik pengukuran (perbaikan P0.3, laporan perekaman tutorial
 * macro 10 Nov 2026): dulu tombol "Ukur ulang" tidak menunjukkan tanda
 * apa pun bahwa pengukuran terjadi, sehingga terbaca rusak padahal
 * angkanya memang tidak berubah. Kini setiap pengukuran (klik maupun
 * berkala) memperbarui cap "Terakhir diukur", dan klik memberi status
 * singkat di sampingnya.
 */
export function PenyimpananStrip() {
  const [info, setInfo] = useState<{ terpakai: number; persen: number } | null>(null);
  const [terakhir, setTerakhir] = useState("");
  const [statusKlik, setStatusKlik] = useState("");
  const jedaStatus = useRef<number | null>(null);

  function ukur() {
    const u = ukurPenyimpanan();
    setInfo({ terpakai: u.terpakai, persen: u.persen });
    setTerakhir(
      new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    );
  }

  function ukurDariKlik() {
    ukur();
    setStatusKlik("Sudah diukur ulang.");
    if (jedaStatus.current) window.clearTimeout(jedaStatus.current);
    jedaStatus.current = window.setTimeout(() => setStatusKlik(""), 3000);
  }

  useEffect(() => {
    ukur();
    const t = window.setInterval(ukur, 30_000);
    return () => {
      window.clearInterval(t);
      if (jedaStatus.current) window.clearTimeout(jedaStatus.current);
    };
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
        {level === "waspada" && " — mulai rapikan: ekspor cadangan proyek lama atau hapus yang tidak dipakai."}
        {level === "kritis" && " — hampir penuh! Ekspor cadangan sekarang; penyimpanan bisa ditolak peramban pada 95%."}
        {terakhir && (
          <span className="text-ink-500">
            {" "}· Terakhir diukur {terakhir}
            {statusKlik && <b> · {statusKlik}</b>}
          </span>
        )}
      </span>
      <button type="button" className="btn-quiet !py-0.5" onClick={ukurDariKlik}>
        Ukur ulang
      </button>
    </div>
  );
}
