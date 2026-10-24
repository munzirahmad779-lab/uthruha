"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MasukForm() {
  const router = useRouter();
  const [kunci, setKunci] = useState("");
  const [ingat, setIngat] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!kunci.trim() || loading) return;
    setLoading(true);
    setPesan(null);
    try {
      const res = await fetch("/api/masuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kunci, ingat }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPesan(data.error ?? "Kunci akses salah.");
        return;
      }
      const lanjut = new URLSearchParams(window.location.search).get("lanjut");
      // Hanya izinkan jalur internal agar tidak menjadi open redirect.
      const tujuan = lanjut && lanjut.startsWith("/") && !lanjut.startsWith("//") ? lanjut : "/";
      router.replace(tujuan);
      router.refresh();
    } catch {
      setPesan("Tidak bisa menghubungi server. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={kirim} className="mt-6 space-y-4">
      <div>
        <label htmlFor="kunci" className="block text-[12px] font-semibold text-ink-800">
          Kunci akses
        </label>
        <input
          id="kunci"
          type="password"
          autoComplete="current-password"
          value={kunci}
          onChange={(e) => setKunci(e.target.value)}
          disabled={loading}
          className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
          placeholder="••••••••••••••••"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-parchment-50 p-3">
        <input
          type="checkbox"
          checked={ingat}
          onChange={(e) => setIngat(e.target.checked)}
          disabled={loading}
          className="mt-0.5 h-4 w-4 shrink-0 accent-gold-600"
        />
        <span className="text-[12px] leading-relaxed text-ink-700">
          <strong className="text-ink-900">Ingat perangkat ini</strong> — perangkat ini langsung
          masuk sendiri selama 1 tahun. Hanya centang pada komputer milik Anda sendiri.
        </span>
      </label>

      {pesan && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-800">
          {pesan}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !kunci.trim()}
        className="w-full rounded-lg bg-gold-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-700 disabled:cursor-not-allowed disabled:bg-ink-300"
      >
        {loading ? "Memeriksa…" : "Buka ruang kerja"}
      </button>
    </form>
  );
}