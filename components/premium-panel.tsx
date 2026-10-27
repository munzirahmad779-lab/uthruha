"use client";

import { useCallback, useEffect, useState } from "react";
import { LoginGoogle } from "@/components/login-google";

interface KonfigBayar {
  terkonfigurasi: boolean;
  clientKey: string;
  snapJs: string;
  harga: number;
  produksi: boolean;
}

interface StatusLapis {
  pengguna: { email: string; nama: string } | null;
  tier?: string;
  premiumSampai?: string | null;
}

declare global {
  interface Window {
    snap?: { pay: (token: string, opsi: Record<string, unknown>) => void };
  }
}

/**
 * Panel Premium: status lapis, tombol bayar Snap (bila gerbang aktif),
 * teks JAMINAN ADMIN persis keputusan pemilik (tidak ada pengembalian
 * otomatis; Laporkan Kendala → standar ≤6 jam atau refund manual penuh),
 * dan formulir laporan kendala.
 */
export function PremiumPanel() {
  const [konfig, setKonfig] = useState<KonfigBayar | null>(null);
  const [status, setStatus] = useState<StatusLapis | null>(null);
  const [pesan, setPesan] = useState("");
  const [info, setInfo] = useState("");
  const [galat, setGalat] = useState("");
  const [proses, setProses] = useState(false);

  const segarkan = useCallback(async () => {
    try {
      const [k, s] = await Promise.all([
        fetch("/api/bayar/buat", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/lapis/status", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setKonfig(k as KonfigBayar);
      setStatus(s as StatusLapis);
    } catch { /* abaikan */ }
  }, []);

  useEffect(() => {
    void segarkan();
  }, [segarkan]);

  useEffect(() => {
    if (!konfig?.terkonfigurasi || !konfig.clientKey) return;
    const skrip = document.createElement("script");
    skrip.src = konfig.snapJs;
    skrip.setAttribute("data-client-key", konfig.clientKey);
    document.body.appendChild(skrip);
    return () => {
      skrip.remove();
    };
  }, [konfig?.terkonfigurasi, konfig?.clientKey, konfig?.snapJs]);

  async function bayar() {
    setGalat("");
    setInfo("");
    setProses(true);
    try {
      const res = await fetch("/api/bayar/buat", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setGalat(data.error ?? "Gagal membuat transaksi.");
        return;
      }
      if (window.snap) {
        window.snap.pay(String(data.token), {
          onSuccess: () => {
            setInfo("Pembayaran diterima gerbang. Premium aktif begitu server menerima konfirmasi terverifikasi (biasanya < 1 menit).");
            setTimeout(() => void segarkan(), 4000);
          },
          onPending: () => setInfo("Menunggu pembayaran Anda selesai di gerbang."),
          onError: () => setGalat("Pembayaran gagal di gerbang. Tidak ada dana yang diambil."),
          onClose: () => setInfo("Jendela pembayaran ditutup sebelum selesai."),
        });
      } else if (data.redirectUrl) {
        window.location.href = String(data.redirectUrl);
      } else {
        setGalat("Skrip pembayaran belum termuat. Muat ulang halaman ini.");
      }
    } catch {
      setGalat("Tidak terhubung ke server pembayaran.");
    } finally {
      setProses(false);
    }
  }

  async function lapor() {
    setGalat("");
    setInfo("");
    if (pesan.trim().length < 10) {
      setGalat("Ceritakan kendalanya dulu (minimal 10 karakter).");
      return;
    }
    setProses(true);
    try {
      const res = await fetch("/api/bayar/insiden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesan: pesan.trim(), konteks: "halaman premium" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGalat(data.error ?? "Laporan gagal terkirim.");
        return;
      }
      setPesan("");
      setInfo(
        `Laporan tercatat (ID ${data.insiden.id}). Standar kami: dibereskan paling lambat ${new Date(data.insiden.tenggat).toLocaleString("id-ID")} (6 jam). Bila kegagalannya dari sistem kami dan tidak pulih dalam tenggat itu, dana Anda kembali PENUH lewat refund manual admin.`,
      );
    } catch {
      setGalat("Tidak terhubung ke server.");
    } finally {
      setProses(false);
    }
  }

  const premiumAktif = status?.tier === "premium";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-3xl border border-gold-300/60 bg-white/70 p-6 shadow-sm sm:p-8">
        <span className="eyebrow">Uthruha Premium</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">
          Rp10.000 / bulan <span className="text-base font-semibold text-ink-500">(harga promo pembuka)</span>
        </h1>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-700">
          <li>✓ Proyek tanpa batas jumlah (gratis: 1 proyek)</li>
          <li>✓ Footnote tanpa batas dalam satu paragraf (gratis: maks 3)</li>
          <li>✓ Ganti ruang lingkup lewat proyek baru tanpa kehilangan proyek lama</li>
          <li>✓ Chat agen AI instan di dalam web</li>
          <li>✓ Google Doc per proyek di Drive Anda sendiri</li>
          <li>✓ Proyek gratis lama Anda ikut terbuka fitur premiumnya</li>
        </ul>

        <div className="mt-6 rounded-2xl bg-parchment-100 p-4 text-sm leading-relaxed text-ink-700">
          <p className="font-bold text-ink-900">Jaminan admin — baca sebelum membayar</p>
          <p className="mt-1">
            Pembayaran diproses gerbang resmi (QRIS & e-wallet). <strong>Tidak ada pengembalian
            dana otomatis.</strong> Bila ada kendala, gunakan tombol <em>Laporkan Kendala</em> di
            bawah: laporan Anda menjadi catatan insiden untuk admin dengan standar beres{" "}
            <strong>paling lambat 6 jam</strong>. Bila kendala terbukti berasal dari sistem kami
            dan tidak pulih dalam tenggat itu, <strong>dana Anda kembali penuh</strong> — diproses
            admin secara manual dari dasbor gerbang pembayaran (sampainya ke rekening/e-wallet
            mengikuti proses bank, bisa beberapa hari kerja). Tidak ada pengembalian untuk alasan
            berubah pikiran.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <LoginGoogle />
          <div className="sm:ml-auto">
            {premiumAktif ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                Premium aktif
                {status?.premiumSampai
                  ? ` sampai ${new Date(status.premiumSampai).toLocaleDateString("id-ID")}`
                  : ""}
                .
              </p>
            ) : konfig && !konfig.terkonfigurasi ? (
              <p className="max-w-sm rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Gerbang pembayaran <strong>belum diaktifkan pemilik</strong> (pendaftaran gerbang
                pembayaran sedang diproses). Belum ada tombol bayar dan tidak ada dana yang bisa
                diambil dari Anda saat ini.
              </p>
            ) : (
              <button onClick={() => void bayar()} disabled={proses || !status?.pengguna} className="btn-primary disabled:opacity-60">
                {proses ? "Memproses…" : status?.pengguna ? "Bayar dengan QRIS / e-wallet" : "Masuk dulu untuk membayar"}
              </button>
            )}
          </div>
        </div>

        {info && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
        {galat && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{galat}</p>}

        <div className="mt-8 border-t border-ink-100 pt-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">Laporkan Kendala</h2>
          <textarea
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ceritakan kendala Anda: fitur apa, kapan terjadi, pesan error bila ada…"
            className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
          <button onClick={() => void lapor()} disabled={proses} className="btn-quiet mt-2 disabled:opacity-60">
            Kirim laporan ke admin
          </button>
        </div>
      </div>
    </div>
  );
}
