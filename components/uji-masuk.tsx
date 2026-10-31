"use client";

import { useEffect, useState } from "react";

interface PersonaRingkas {
  namaUji: string;
  nama: string;
  tier: "gratis" | "premium";
  peran: string;
}

/**
 * Panel masuk persona dummy (cabang uji-persona). Merender dirinya hanya
 * bila server menjawab mode uji aktif (GET /api/uji/status); di produksi
 * komponen ini tidak menampilkan apa pun. Daftar persona di bawah harus
 * sejalan dengan lib/server/fixture-persona.ts.
 */
const PERSONA: PersonaRingkas[] = [
  { namaUji: "UJI-RAFI", nama: "Rafi (uji)", tier: "gratis", peran: "Nol dasar, HP saja" },
  { namaUji: "UJI-SINTA", nama: "Sinta (uji)", tier: "gratis", peran: "Pemburu footnote" },
  { namaUji: "UJI-FAJAR", nama: "Fajar (uji)", tier: "gratis", peran: "Penulis buntu" },
  { namaUji: "UJI-NADIA", nama: "Nadia (uji)", tier: "gratis", peran: "Verifikator DOI" },
  { namaUji: "UJI-BIMA", nama: "Bima (uji)", tier: "gratis", peran: "Terburu-buru, komputer bersama" },
  { namaUji: "UJI-DEWI", nama: "Dewi (uji)", tier: "premium", peran: "Butuh jurnal + ekspor .docx" },
  { namaUji: "UJI-AGUS", nama: "Agus (uji)", tier: "premium", peran: "Pekerja paruh waktu, sensitif harga" },
  { namaUji: "UJI-LINA", nama: "Lina (uji)", tier: "gratis", peran: "Hati-hati data dan legal" },
  { namaUji: "UJI-TANIA", nama: "Tania (uji)", tier: "gratis", peran: "Mahasiswa baru, laptop pinjaman" },
  { namaUji: "UJI-RIZKI", nama: "Rizki (uji)", tier: "gratis", peran: "Sering ganti perangkat" },
  { namaUji: "UJI-MAYA", nama: "Maya (uji)", tier: "gratis", peran: "Penulis teliti" },
  { namaUji: "UJI-DEDI", nama: "Dedi (uji)", tier: "gratis", peran: "Koneksi lambat" },
  { namaUji: "UJI-SARI", nama: "Sari (uji)", tier: "premium", peran: "Butuh masadir kitab" },
  { namaUji: "UJI-BUDI", nama: "Budi (uji)", tier: "premium", peran: "Ekspor untuk pembimbing" },
  { namaUji: "UJI-RINA", nama: "Rina (uji)", tier: "premium", peran: "Pemakai Chat Agen" },
  { namaUji: "UJI-ANDI", nama: "Andi (uji)", tier: "premium", peran: "Dua proyek paralel" },
  { namaUji: "UJI-FITRI", nama: "Fitri (uji)", tier: "premium", peran: "Verifikator sitasi" },
  { namaUji: "UJI-JOKO", nama: "Joko (uji)", tier: "premium", peran: "Pemakai malam hari" },
  { namaUji: "UJI-ANI", nama: "Ani (uji)", tier: "premium", peran: "Butuh direktori jurnal" },
  { namaUji: "UJI-BAMBANG", nama: "Bambang (uji)", tier: "premium", peran: "Sensitif kuota" },
];

export function UjiMasukPanel() {
  const [aktif, setAktif] = useState(false);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    void fetch("/api/uji/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAktif(d.aktif === true))
      .catch(() => setAktif(false));
  }, []);

  async function masuk(namaUji: string) {
    setSibuk(namaUji);
    setGalat("");
    try {
      const res = await fetch("/api/uji/masuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profil: namaUji }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(d?.error ?? "Gagal masuk sebagai persona uji.");
      }
      window.location.href = "/proyek";
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal masuk sebagai persona uji.");
      setSibuk(null);
    }
  }

  if (!aktif) return null;

  return (
    <section className="mt-6 rounded-2xl border-2 border-dashed border-gold-500/70 bg-gold-100/40 p-4">
      <h2 className="text-sm font-bold text-ink-900">Mode uji persona (lingkungan staging)</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-600">
        Dua puluh identitas dummy untuk pengujian audit. Pilih persona untuk
        masuk tanpa sandi; setiap persona adalah akun terpisah di lingkungan
        ini. Pada audit 20 pengujian, tiap persona memakai asal stagingnya
        sendiri dan hanya persona pemilik asal itu yang boleh dipilih di
        sini, agar proyek lokalnya tidak tercampur. Lingkungan ini terisolasi
        dari data produksi.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {PERSONA.map((p) => (
          <button
            key={p.namaUji}
            type="button"
            disabled={sibuk !== null}
            onClick={() => void masuk(p.namaUji)}
            className="rounded-xl border border-ink-900/15 bg-white px-3 py-2 text-left transition hover:border-gold-500 disabled:opacity-60"
          >
            <span className="block text-[13px] font-bold text-ink-900">
              {p.nama}{" "}
              <span className={p.tier === "premium" ? "text-gold-700" : "text-ink-400"}>
                · {p.tier === "premium" ? "Premium" : "Gratis"}
              </span>
            </span>
            <span className="block text-[11px] text-ink-500">{p.peran}</span>
            {sibuk === p.namaUji && <span className="block text-[11px] text-ink-500">Memasukkan…</span>}
          </button>
        ))}
      </div>
      {galat && <p className="mt-2 text-xs font-semibold text-red-700">{galat}</p>}
    </section>
  );
}
