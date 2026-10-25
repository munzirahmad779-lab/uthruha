"use client";

import { useState } from "react";

/**
 * Panduan menemukan letak persis kutipan di situs kitab.
 *
 * Nomor halaman dari indeks sumber (Turath/Shamela/dll.) mengikuti edisi
 * cetak tertentu dan SERING berbeda dari penomoran halaman web-nya, jadi
 * tautan hasil pencarian bisa mendarat di halaman yang bergeser. Cara yang
 * dapat diandalkan: buka tautan, tekan Ctrl+F, lalu cari teks kutipannya —
 * teks itu unik dan pasti ada di halaman yang benar.
 */
export function PetunjukCtrlF() {
  return (
    <p className="mt-1.5 rounded-lg border border-amber-600/25 bg-amber-50 px-2 py-1.5 text-[10.5px] leading-relaxed text-amber-900">
      Nomor halaman indeks bisa bergeser dari edisi web. Untuk letak persisnya: buka tautan sumber,
      tekan <span className="font-bold">Ctrl+F</span>, lalu cari teks kutipan di atas.
    </p>
  );
}

/** Tombol menyalin teks kutipan utuh untuk ditempel ke Ctrl+F di situs kitab. */
export function TombolSalinCtrlF({ teks }: { teks: string }) {
  const [tersalin, setTersalin] = useState(false);
  async function salin() {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      window.setTimeout(() => setTersalin(false), 2000);
    } catch {
      setTersalin(false);
    }
  }
  return (
    <button type="button" onClick={salin} className="btn-quiet !px-2 !py-1 !text-[11px]">
      {tersalin ? "Tersalin ✓ — tempel di Ctrl+F" : "Salin teks untuk Ctrl+F"}
    </button>
  );
}
