"use client";

/**
 * Formulir masuk akun uji coba (perintah pemilik, 6 Nov 2026):
 * satu kolom email dan satu tombol Masuk, tampil seperti login biasa,
 * dirender di /masuk DI BAWAH tombol masuk Google HANYA saat jalur
 * akun uji menyala (server yang memutuskan; komponen ini tidak tahu
 * daftar email apa pun). Server memeriksa email terhadap daftar putih;
 * kegagalan menampilkan pesan umum dari server apa adanya, dan
 * keberhasilan mengantar ke tujuan sesudah masuk yang sama dengan
 * alur Google (parameter lanjut bila internal, selain itu ruang
 * kerja proyek /proyek).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function MasukUjiForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (sibuk || !email.trim()) return;
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalat(data.error ?? "Tidak dapat masuk dengan email ini.");
        return;
      }
      // Tujuan sesudah masuk sama seperti alur Google di MasukForm:
      // parameter lanjut dipakai hanya bila internal; bawaannya ruang
      // kerja proyek (/proyek), bukan beranda, dan tujuan "/" atau
      // "/masuk" sendiri dipetakan ke /proyek agar tidak muter balik.
      const lanjut = new URLSearchParams(window.location.search).get("lanjut");
      const tujuan =
        lanjut &&
        lanjut.startsWith("/") &&
        !lanjut.startsWith("//") &&
        lanjut !== "/" &&
        lanjut !== "/masuk" &&
        !lanjut.startsWith("/masuk?") &&
        !lanjut.startsWith("/masuk#")
          ? lanjut
          : "/proyek";
      router.replace(tujuan);
      router.refresh();
    } catch {
      setGalat("Tidak bisa menghubungi server. Periksa koneksi Anda.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div id="masuk-uji" className="mt-6 border-t border-ink-900/10 pt-5">
      <p className="text-sm font-semibold text-ink-900">Masuk dengan email</p>
      <p className="mt-1 text-sm text-ink-500">
        Untuk akun uji coba yang terdaftar. Email di luar daftar tidak dapat masuk lewat
        jalur ini.
      </p>
      <form onSubmit={kirim} className="mt-3 space-y-3">
        <div>
          <label htmlFor="email-uji" className="text-xs font-medium text-ink-500">
            Alamat email
          </label>
          <input
            id="email-uji"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@contoh.id"
            className="mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
          />
        </div>
        {galat && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800 ring-1 ring-red-200"
          >
            {galat}
          </p>
        )}
        <button
          type="submit"
          disabled={sibuk || !email.trim()}
          className="w-full rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sibuk ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </div>
  );
}
