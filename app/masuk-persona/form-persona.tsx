"use client";

/**
 * Formulir masuk persona uji: satu kolom email dan satu tombol, meniru
 * langkah masuk Google. Email yang diketik TIDAK diverifikasi dan tidak
 * menjadi identitas (server selalu memasukkan persona tunggal); kolom
 * ini ada agar langkah masuknya terbaca jelas sebagai langkah login.
 * Kunci jalur diterima sebagai prop dari halaman server yang sudah
 * memeriksanya; kunci tidak pernah ditulis ke markup selain sebagai
 * nilai prop komponen ini.
 */
import { useState } from "react";

export function FormPersona({ kunci }: { kunci: string }) {
  const [email, setEmail] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (sibuk) return;
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kunci, email }),
      });
      if (res.ok) {
        window.location.assign("/");
        return;
      }
      // 400 berarti isi formulir yang ditolak server; pesan diarahkan
      // ke kolom email. Status lain (404, 429, jaringan) mendapat pesan
      // umum yang sama agar tidak membocorkan keadaan jalur.
      if (res.status === 400) {
        setGalat("Tidak dapat masuk. Periksa kembali email Anda lalu coba lagi.");
      } else {
        setGalat("Tidak dapat masuk. Coba lagi beberapa saat lagi.");
      }
    } catch {
      setGalat("Tidak dapat masuk. Coba lagi beberapa saat lagi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={kirim} className="mt-8">
      <div>
        <label htmlFor="email-persona" className="sr-only">
          Email
        </label>
        <input
          id="email-persona"
          type="text"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={sibuk}
          placeholder="Email"
          className="w-full rounded-md border border-neutral-300 bg-white px-3.5 py-3 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/25 disabled:opacity-60"
        />
      </div>

      {galat && (
        <p role="alert" className="mt-3 text-[13px] leading-relaxed text-red-700">
          {galat}
        </p>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
        Dengan melanjutkan, Anda masuk sebagai akun persona uji Kitabah.
      </p>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={sibuk}
          className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sibuk ? "Memproses..." : "Berikutnya"}
        </button>
      </div>
    </form>
  );
}
