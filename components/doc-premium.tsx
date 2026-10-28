"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/engine/project";
import { strukturProyek } from "@/lib/content/struktur";
import { mintaTokenDrive } from "@/lib/engine/gdrive-storage";

/**
 * Tombol "Buat Google Doc proyek" (Fase 3, keputusan K) — Premium saja.
 * Izin drive.file diminta BERTAHAP tepat saat tombol ini ditekan (GIS token
 * client), bukan saat login. Proyek yang dibuat saat masih gratis ikut bisa
 * memakai tombol ini begitu akun naik Premium.
 */
export function DocPremiumButton({ p }: { p: Project }) {
  const [tier, setTier] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [tautan, setTautan] = useState("");

  useEffect(() => {
    void fetch("/api/lapis/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTier(typeof d.tier === "string" ? d.tier : "tamu"))
      .catch(() => setTier("tamu"));
  }, []);

  async function buat() {
    setSibuk(true);
    setPesan("");
    setTautan("");
    try {
      // Persetujuan Drive BERTAHAP: popup GIS muncul hanya sekarang.
      const token = await mintaTokenDrive();
      const st = strukturProyek(p);
      const bagian = st.chapters.flatMap((c) =>
        c.sections
          .filter((s) => (p.draf[s.id] ?? "").trim())
          .map((s) => ({ judul: `${c.labelId} — ${s.labelId}`, teks: p.draf[s.id]! })),
      );
      const res = await fetch("/api/doc/buat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyekId: p.id,
          judulProyek: p.judulAr || p.topikAr || "Proyek Kitabah",
          driveToken: token,
          bagian: bagian.length ? bagian : [{ judul: "Draf", teks: "(Belum ada draf tertulis.)" }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPesan(data.error ?? "Gagal membuat Google Doc.");
        return;
      }
      setTautan(String(data.webViewLink ?? ""));
      setPesan("Google Doc dibuat di folder khusus Drive Anda.");
    } catch (e) {
      setPesan(e instanceof Error ? e.message : "Gagal meminta akses Drive.");
    } finally {
      setSibuk(false);
    }
  }

  if (tier === null) return null;
  if (tier !== "premium") {
    return (
      <a href="/premium" className="btn-quiet !py-1.5">
        Buat Google Doc proyek (Premium)
      </a>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void buat()} disabled={sibuk} className="btn-quiet !py-1.5 disabled:opacity-60">
        {sibuk ? "Membuat Doc…" : "Buat Google Doc proyek"}
      </button>
      {pesan && <span className="text-[11px] text-ink-600">{pesan}</span>}
      {tautan && (
        <a href={tautan} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-gold-700 underline underline-offset-2">
          Buka Doc ↗
        </a>
      )}
    </span>
  );
}
