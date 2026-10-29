"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { muatGIS } from "@/lib/engine/gdrive-storage";

interface StatusIdentitas {
  pengguna: { id: string; email: string; nama: string; foto: string } | null;
  tier?: string;
  premiumSampai?: string | null;
  kunciGratisTerverifikasi?: boolean;
  bisaMasukTanpaKunci?: boolean;
}

/**
 * Layar masuk (keputusan pemilik, 28 Okt 2026):
 *   Langkah 1 — Masuk dengan Google (identitas saja: nama/foto/email,
 *               tanpa scope Drive). HANYA tampil bila login Google
 *               diaktifkan pemilik (UTH_LOGIN_GOOGLE_AKTIF=1); selama
 *               ditahan, layar ini kembali ke gerbang satu kolom kunci
 *               seperti semula dan bagian Google tidak dirender sama
 *               sekali (bukan tombol nonaktif).
 *   Langkah 2 — Satu kolom "Kunci akses". Server yang memilah jenis
 *               kunci; tidak ada label jenis kunci yang ditampilkan.
 * Identitas yang premiumnya masih aktif atau yang sidik kunci gratisnya
 * cocok dapat memulihkan sesi lewat mode identitas tanpa mengetik kunci.
 * Kunci saja (tanpa Google) tetap bisa, seperti perilaku lama.
 */
export function MasukForm({ googleAktif }: { googleAktif: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusIdentitas | null>(null);
  // Status identitas sudah selesai dibaca? Selama belum, bagian Google
  // menampilkan penahan netral — BUKAN tombol. Tanpa ini, pengunjung yang
  // sesinya masih ada melihat tombol Google lebih dulu (dan tombol itu
  // sempat tergambar di samping identitas sesudah masuk) sebelum panel
  // identitas menggantikannya: kedipan "flash" yang dilaporkan pemilik.
  const [statusDimuat, setStatusDimuat] = useState(false);
  const [kunci, setKunci] = useState("");
  const [ingat, setIngat] = useState(true);
  const [loading, setLoading] = useState(false);
  const [memuatGoogle, setMemuatGoogle] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const wadahGoogle = useRef<HTMLDivElement>(null);

  const segarkanStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status", { cache: "no-store" });
      setStatus((await res.json()) as StatusIdentitas);
    } catch { /* abaikan — formulir kunci tetap bisa dipakai */ }
    finally { setStatusDimuat(true); }
  }, []);

  useEffect(() => {
    if (!googleAktif) return; // status identitas hanya perlu bila Google tampil
    void segarkanStatus();
  }, [segarkanStatus, googleAktif]);

  const antarKeTujuan = useCallback(() => {
    const lanjut = new URLSearchParams(window.location.search).get("lanjut");
    // Hanya izinkan jalur internal agar tidak menjadi open redirect.
    const tujuan = lanjut && lanjut.startsWith("/") && !lanjut.startsWith("//") ? lanjut : "/";
    router.replace(tujuan);
    router.refresh();
  }, [router]);

  // Tombol Google (GIS) — pola yang sama dengan components/login-google,
  // tetapi status dibaca dari /api/auth/status karena gerbang belum terbuka.
  // Saat login Google ditahan pemilik, efek ini tidak berjalan sama sekali.
  useEffect(() => {
    if (!googleAktif) return;
    // Tombol hanya dipasang sesudah status identitas PASTI terbaca dan
    // menyatakan belum ada pengguna — memasangnya lebih awal membuat
    // tombol tampil sesaat lalu tertukar panel identitas (flash).
    if (!statusDimuat || status?.pengguna || !wadahGoogle.current) return;
    let batal = false;
    void muatGIS()
      .then(() => {
        if (batal) return;
        const g = (window as unknown as {
          google?: {
            accounts: {
              id: {
                initialize: (o: Record<string, unknown>) => void;
                renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
              };
            };
          };
        }).google;
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
        if (!g || !clientId || !wadahGoogle.current) return;
        g.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp: { credential?: string }) => {
            if (!resp.credential) return;
            setMemuatGoogle(true);
            setPesan(null);
            try {
              const res = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: resp.credential }),
              });
              const data = await res.json();
              if (!res.ok) {
                setPesan(data.error ?? "Gagal masuk dengan Google.");
                return;
              }
              await segarkanStatus();
            } catch {
              setPesan("Tidak terhubung ke server.");
            } finally {
              setMemuatGoogle(false);
            }
          },
        });
        g.accounts.id.renderButton(wadahGoogle.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
        });
      })
      .catch(() => undefined);
    return () => {
      batal = true;
    };
  }, [status?.pengguna, segarkanStatus, googleAktif, statusDimuat]);

  async function masukViaIdentitas() {
    if (loading) return;
    setLoading(true);
    setPesan(null);
    try {
      const res = await fetch("/api/masuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "identitas", ingat }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPesan(data.error ?? "Tidak bisa memulihkan sesi. Masukkan kunci akses Anda.");
        return;
      }
      antarKeTujuan();
    } catch {
      setPesan("Tidak bisa menghubungi server. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  }

  async function kirimKunci(e: React.FormEvent) {
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
      antarKeTujuan();
    } catch {
      setPesan("Tidak bisa menghubungi server. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  }

  const pengguna = status?.pengguna ?? null;

  return (
    <div className="mt-6">
      {/* Langkah 1 — Google: TIDAK dirender sama sekali selama login
          Google ditahan pemilik (googleAktif=false). */}
      {googleAktif && (
        <>
      <p className="text-[12px] font-semibold text-ink-800">
        Langkah 1 — Masuk dengan Google
      </p>
      {!statusDimuat ? (
        <div className="mt-2 rounded-lg bg-parchment-50 p-3">
          <p className="text-[12px] text-ink-500">Memeriksa sesi…</p>
        </div>
      ) : pengguna ? (
        <div className="mt-2 rounded-lg bg-parchment-50 p-3">
          <div className="flex items-center gap-3">
            {pengguna.foto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pengguna.foto} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
            )}
            <div>
              <p className="text-sm font-semibold text-ink-900">{pengguna.nama || pengguna.email}</p>
              <p className="text-xs text-ink-500">{pengguna.email}</p>
            </div>
          </div>
          {status?.bisaMasukTanpaKunci ? (
            <>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-700">
                Akun ini sudah terverifikasi
                {status.tier === "premium"
                  ? " dan premiumnya masih aktif"
                  : ""}
                {" "}— Anda bisa langsung masuk tanpa mengetik kunci lagi.
              </p>
              <button
                type="button"
                onClick={masukViaIdentitas}
                disabled={loading}
                className="mt-3 w-full rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-parchment-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Memeriksa…" : "Masuk ruang kerja"}
              </button>
            </>
          ) : (
            <p className="mt-2 text-[12px] leading-relaxed text-ink-700">
              Halo, {pengguna.nama?.split(" ")[0] || "kawan"}. Tinggal satu langkah:
              masukkan kunci akses di bawah ini.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2 rounded-lg bg-parchment-50 p-3">
          <div ref={wadahGoogle} className="min-h-[44px]" />
          {memuatGoogle && <p className="mt-1 text-xs text-ink-500">Memproses masuk…</p>}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
            Masuk hanya membaca nama, foto, dan email Anda. Folder Drive Anda tidak
            diminta di sini — akses Drive hanya diminta saat Anda memakai fitur
            penyimpanan/ekspor yang membutuhkannya.
          </p>
        </div>
      )}
        </>
      )}

      {/* Langkah 2 — kunci akses (satu kolom) */}
      <form onSubmit={kirimKunci} className="mt-6 space-y-4">
        <div>
          <label htmlFor="kunci" className="block text-[12px] font-semibold text-ink-800">
            {googleAktif ? "Langkah 2 — Kunci akses" : "Kunci akses"}
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
    </div>
  );
}
