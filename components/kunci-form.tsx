"use client";

/**
 * Formulir Kunci API pribadi (BYOK mahasiswa): status, pasang/ganti,
 * dan hapus kunci Gemini + Groq milik pengguna sendiri. Kunci yang
 * sudah tersimpan TIDAK pernah ditampilkan kembali; yang tampil hanya
 * 4 karakter terakhir dari jawaban server.
 */
import { useCallback, useEffect, useState } from "react";

interface StatusSatu {
  ada: boolean;
  ekor: string | null;
}
interface Status {
  gemini: StatusSatu;
  groq: StatusSatu;
  mahasiswa?: boolean;
}

type Penyedia = "gemini" | "groq";

const INFO: Record<Penyedia, { nama: string; tautan: string; labelTautan: string; petunjuk: string }> = {
  gemini: {
    nama: "Gemini (Google)",
    tautan: "https://aistudio.google.com/apikey",
    labelTautan: "aistudio.google.com/apikey",
    petunjuk: "Masuk dengan akun Google Anda, klik Create API key, lalu salin kuncinya ke sini.",
  },
  groq: {
    nama: "Groq",
    tautan: "https://console.groq.com/keys",
    labelTautan: "console.groq.com/keys",
    petunjuk: "Daftar gratis, buka halaman API Keys, klik Create API Key, lalu salin kuncinya ke sini.",
  },
};

interface HasilUji {
  /** Nilai kolom persis saat diuji; nilai yang berubah membatalkan hasil ini. */
  nilai: string;
  valid: boolean;
  pesan: string;
}

export function KunciForm() {
  const [status, setStatus] = useState<Status | null>(null);
  const [muatGagal, setMuatGagal] = useState("");
  const [nilai, setNilai] = useState<Record<Penyedia, string>>({ gemini: "", groq: "" });
  const [sibuk, setSibuk] = useState<Penyedia | null>(null);
  const [pesan, setPesan] = useState<Record<Penyedia, string>>({ gemini: "", groq: "" });
  // Uji kunci + tampil/sembunyi (perbaikan P1.3): hasil uji terikat
  // pada nilai kolom yang diuji; begitu nilai berubah, hasil lama
  // tidak berlaku lagi dan tombol Simpan kembali bebas.
  const [tampil, setTampil] = useState<Record<Penyedia, boolean>>({ gemini: false, groq: false });
  const [hasilUji, setHasilUji] = useState<Record<Penyedia, HasilUji | null>>({ gemini: null, groq: null });
  const [sibukUji, setSibukUji] = useState<Penyedia | null>(null);

  const muat = useCallback(async () => {
    try {
      const res = await fetch("/api/kunci-pribadi", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      setStatus((await res.json()) as Status);
    } catch {
      setMuatGagal("Status kunci belum bisa dimuat. Pastikan Anda sudah masuk, lalu muat ulang halaman ini.");
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function uji(p: Penyedia) {
    const k = nilai[p].trim();
    if (!k) {
      setHasilUji((s) => ({
        ...s,
        [p]: { nilai: k, valid: false, pesan: "Tempel dulu kunci yang mau diuji." },
      }));
      return;
    }
    setSibukUji(p);
    try {
      const res = await fetch("/api/kunci-pribadi/uji", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ penyedia: p, kunci: k }),
      });
      const j = (await res.json().catch(() => null)) as { valid?: boolean; pesan?: string } | null;
      setHasilUji((s) => ({
        ...s,
        [p]: {
          nilai: k,
          valid: Boolean(j?.valid),
          pesan: j?.pesan ?? "Uji tidak memberi jawaban. Coba lagi.",
        },
      }));
    } catch {
      setHasilUji((s) => ({
        ...s,
        [p]: { nilai: k, valid: false, pesan: "Uji tidak tersambung ke server Kitabah. Coba lagi." },
      }));
    } finally {
      setSibukUji(null);
    }
  }

  async function simpan(p: Penyedia) {
    const k = nilai[p].trim();
    // Nilai yang SUDAH diuji dan terbukti tidak valid (dan belum
    // berubah sejak diuji) tidak boleh tersimpan (P1.3).
    const ujiTerakhir = hasilUji[p];
    if (ujiTerakhir && ujiTerakhir.nilai === k && !ujiTerakhir.valid) {
      setPesan((s) => ({ ...s, [p]: "Kunci tidak valid, belum disimpan." }));
      return;
    }
    if (k.length < 20) {
      setPesan((s) => ({ ...s, [p]: "Tempel dulu kunci lengkapnya (minimal 20 karakter)." }));
      return;
    }
    setSibuk(p);
    setPesan((s) => ({ ...s, [p]: "" }));
    try {
      const res = await fetch("/api/kunci-pribadi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [p]: k }),
      });
      const j = (await res.json().catch(() => null)) as (Status & { error?: string }) | null;
      if (!res.ok || !j) throw new Error(j?.error ?? "Gagal menyimpan.");
      setStatus(j);
      setNilai((s) => ({ ...s, [p]: "" }));
      setPesan((s) => ({ ...s, [p]: "Tersimpan. Kunci ini sekarang dipakai fitur AI akun Anda." }));
    } catch (e) {
      setPesan((s) => ({ ...s, [p]: e instanceof Error ? e.message : "Gagal menyimpan." }));
    } finally {
      setSibuk(null);
    }
  }

  async function hapus(p: Penyedia) {
    setSibuk(p);
    setPesan((s) => ({ ...s, [p]: "" }));
    try {
      const res = await fetch("/api/kunci-pribadi", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ penyedia: p }),
      });
      const j = (await res.json().catch(() => null)) as (Status & { error?: string }) | null;
      if (!res.ok || !j) throw new Error(j?.error ?? "Gagal menghapus.");
      setStatus(j);
      setPesan((s) => ({ ...s, [p]: "Kunci dihapus dari server." }));
    } catch (e) {
      setPesan((s) => ({ ...s, [p]: e instanceof Error ? e.message : "Gagal menghapus." }));
    } finally {
      setSibuk(null);
    }
  }

  if (muatGagal) {
    return (
      <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] leading-relaxed text-red-700">
        {muatGagal}{" "}
        <a href="/masuk?lanjut=/kunci" className="font-semibold underline underline-offset-2">
          Ke halaman masuk
        </a>
      </p>
    );
  }
  if (!status) {
    return <p className="mt-4 text-[13px] text-ink-500">Memuat status kunci Anda…</p>;
  }

  return (
    <div className="mt-5 space-y-4">
      {status.mahasiswa && (
        <p className="rounded-lg bg-parchment-50 px-3 py-2 text-[12px] leading-relaxed text-ink-700">
          Akun Anda terdaftar sebagai mahasiswa: fitur Premium Kitabah berjalan di atas
          kunci API Anda sendiri, bukan kuota pemilik. Isi minimal satu kunci agar fitur
          AI bisa bekerja; dua-duanya lebih baik karena keduanya bergantian bila satu
          sedang habis kuota hariannya. Kunci sekelas dikelola sebagai kelompok dengan
          aturan yang adil: selama Anda masuk pada hari itu, kunci Anda hanya dipakai
          Anda. Bila kunci Anda habis limit hariannya, Anda bisa terbantu kunci teman
          yang sama sekali tidak masuk pada hari itu; dan sebaliknya, pada hari Anda
          sama sekali tidak masuk, kuota kunci Anda bisa membantu teman yang limit.
        </p>
      )}
      {(Object.keys(INFO) as Penyedia[]).map((p) => {
        const info = INFO[p];
        const st = status[p];
        const ujiAktif =
          hasilUji[p] && hasilUji[p]!.nilai === nilai[p].trim() ? hasilUji[p] : null;
        return (
          <div key={p} className="rounded-xl border border-ink-900/10 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-bold text-ink-900">{info.nama}</p>
              <p className={`text-[12px] font-semibold ${st.ada ? "text-emerald-700" : "text-ink-400"}`}>
                {st.ada ? `Terisi ••••${st.ekor ?? ""}` : "Belum diisi"}
              </p>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
              {info.petunjuk} Ambil di{" "}
              <a
                href={info.tautan}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-gold-700 underline underline-offset-2"
              >
                {info.labelTautan}
              </a>{" "}
              (gratis).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type={tampil[p] ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={nilai[p]}
                onChange={(e) => setNilai((s) => ({ ...s, [p]: e.target.value }))}
                placeholder={st.ada ? "Tempel kunci baru untuk mengganti" : "Tempel kunci Anda di sini"}
                className="min-w-0 flex-1 rounded-lg border border-ink-900/15 px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-gold-500"
              />
              <button
                type="button"
                onClick={() => setTampil((s) => ({ ...s, [p]: !s[p] }))}
                className="shrink-0 rounded-lg border border-ink-900/15 px-3 py-2 text-[13px] font-semibold text-ink-700 transition hover:bg-ink-900/5"
              >
                {tampil[p] ? "Sembunyikan" : "Tampilkan"}
              </button>
              <button
                type="button"
                disabled={sibuk === p || sibukUji === p}
                onClick={() => void uji(p)}
                className="shrink-0 rounded-lg border border-ink-900/15 px-3 py-2 text-[13px] font-semibold text-ink-700 transition hover:bg-ink-900/5 disabled:opacity-50"
              >
                {sibukUji === p ? "Menguji…" : "Uji kunci"}
              </button>
              <button
                type="button"
                disabled={sibuk === p}
                onClick={() => void simpan(p)}
                className="shrink-0 rounded-lg bg-ink-900 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-ink-700 disabled:opacity-50"
              >
                {sibuk === p ? "Menyimpan…" : "Simpan"}
              </button>
              {st.ada && (
                <button
                  type="button"
                  disabled={sibuk === p}
                  onClick={() => void hapus(p)}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-[13px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                >
                  Hapus
                </button>
              )}
            </div>
            {ujiAktif && (
              <p
                className={`mt-2 text-[12px] font-semibold leading-relaxed ${
                  ujiAktif.valid ? "text-emerald-700" : "text-red-700"
                }`}
              >
                Hasil uji: {ujiAktif.pesan}
              </p>
            )}
            {pesan[p] && <p className="mt-2 text-[12px] leading-relaxed text-ink-700">{pesan[p]}</p>}
          </div>
        );
      })}
      <p className="text-[11px] leading-relaxed text-ink-500">
        Kunci Anda disimpan terenkripsi di server Kitabah dan hanya dipakai untuk
        permintaan AI dari akun Anda sendiri. Kunci tidak pernah ditampilkan kembali
        sesudah disimpan; yang terlihat hanya 4 karakter terakhirnya. Bila kunci bocor
        atau ingin diganti, buat kunci baru di situs penyedianya lalu tempel di sini.
      </p>
    </div>
  );
}
