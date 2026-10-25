"use client";

import { useState, useEffect, useCallback } from "react";
import {
  mintaTokenDrive,
  muatGIS,
  simpanTokenDrive,
  ambilTokenDrive,
  hapusTokenDrive,
  galatToken,
  browserDalamAplikasi,
  listProyekDiDrive,
  simpanProyekKeDrive,
  muatProyekDariDrive,
} from "@/lib/engine/gdrive-storage";
import type { ProyekTersimpan } from "@/lib/engine/gdrive-storage";

interface GDriveLoginProps {
  onLogin?: (token: string) => void;
  onProyekDimuat?: (proyek: ProyekTersimpan) => void;
}

export function GDriveLogin({ onLogin, onProyekDimuat }: GDriveLoginProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proyekList, setProyekList] = useState<Array<{ id: string; name: string; modified: string }>>([]);
  const [showProyek, setShowProyek] = useState(false);
  const [dalamAplikasi, setDalamAplikasi] = useState(false);

  // Pra-muat Google Identity Services + pulihkan token sesi yang belum kedaluwarsa
  useEffect(() => {
    setDalamAplikasi(browserDalamAplikasi());
    void muatGIS().catch(() => undefined);
    const saved = ambilTokenDrive();
    if (saved) {
      setToken(saved);
      onLogin?.(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const accessToken = await mintaTokenDrive();
      setToken(accessToken);
      simpanTokenDrive(accessToken);
      onLogin?.(accessToken);

      // Load daftar proyek
      const list = await listProyekDiDrive(accessToken);
      setProyekList(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal login ke Google Drive.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    hapusTokenDrive();
    setProyekList([]);
    setShowProyek(false);
  };

  const handleMuatProyek = async (projectId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      let proyek = null;
      try {
        proyek = await muatProyekDariDrive(token, projectId);
      } catch (e1) {
        // Token basi di tengah sesi: coba segarkan sekali secara diam-diam.
        if (!(e1 instanceof Error) || !galatToken(e1.message)) throw e1;
        const segar = await mintaTokenDrive();
        setToken(segar);
        simpanTokenDrive(segar);
        onLogin?.(segar);
        proyek = await muatProyekDariDrive(segar, projectId);
      }
      if (proyek) {
        onProyekDimuat?.(proyek);
      } else {
        setError("Proyek tidak ditemukan di Drive.");
      }
    } catch (err) {
      const pesan = err instanceof Error ? err.message : "Gagal memuat proyek.";
      if (galatToken(pesan)) {
        hapusTokenDrive();
        setToken(null);
        setError("Sesi Google sudah berakhir (token berlaku ±1 jam). Silakan masuk lagi.");
      } else {
        setError(pesan);
      }
    } finally {
      setLoading(false);
    }
  };

  if (token) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">✅</span>
            <span className="text-sm font-medium text-green-900">Terhubung ke Google Drive</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Logout
          </button>
        </div>

        {proyekList.length > 0 && (
          <div>
            <button
              onClick={() => setShowProyek(!showProyek)}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {showProyek ? "Sembunyikan proyek tersimpan" : `📂 Lihat ${proyekList.length} proyek tersimpan`}
            </button>

            {showProyek && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {proyekList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleMuatProyek(p.id)}
                    disabled={loading}
                    className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-100 rounded hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium text-gray-900">{p.id}</div>
                    <div className="text-xs text-gray-500">
                      Diubah: {new Date(p.modified).toLocaleString("id-ID")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dalamAplikasi && (
        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-[13px] leading-relaxed text-amber-900">
          Kamu membuka web ini dari browser di dalam aplikasi (WhatsApp/Instagram/dsb.) — login Google
          <strong> pasti ditolak</strong> di sini. Ketuk menu <strong>⋮</strong> lalu pilih
          <strong> “Buka di Chrome”</strong> / “Buka di browser”, baru masuk dari sana.
        </div>
      )}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 shadow-sm"
      >
        {loading ? (
          <span className="text-sm text-gray-600">Menghubungkan...</span>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-sm font-medium text-gray-700">Masuk dengan Google Drive</span>
          </>
        )}
      </button>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {error}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Proyek Anda akan disimpan di Google Drive pribadi. Data tidak disimpan di server kami.
        Gunakan akun Google yang sudah didaftarkan pengelola sebagai pengguna uji.
      </p>

      <details className="text-xs text-gray-600">
        <summary className="cursor-pointer font-medium text-gray-700">Login gagal? Cek 4 hal ini</summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-relaxed">
          <li>Buka web ini di <strong>Google Chrome</strong> — bukan browser di dalam WhatsApp/Instagram (Google menolak login di sana).</li>
          <li><strong>Izinkan popup</strong> untuk situs ini; login Google muncul sebagai jendela popup.</li>
          <li>Jangan pakai <strong>mode incognito/penyamaran</strong> dan jangan blokir cookie — login Google membutuhkannya.</li>
          <li>Pakai <strong>akun yang terdaftar</strong> sebagai pengguna uji oleh pengelola, dan setujui izin Drive-nya. Akun lain akan ditolak Google selama aplikasi masih mode pengujian.</li>
        </ul>
      </details>
    </div>
  );
}
