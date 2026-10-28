"use client";

import { useEffect, useRef, useState } from "react";

interface Pesan {
  dari: "saya" | "agen";
  teks: string;
}

/**
 * Widget chat agen (keputusan J): tampil untuk semua orang.
 * - Premium: chat AI instan lewat kolam mesin (POST /api/agen/chat).
 * - Bukan premium / belum masuk: panel penawaran Premium.
 * Ini MENGGANTIKAN widget estafet mailbox lama sebagai bawaan; skrip lama
 * hanya dimuat bila env WIDGET_MAILBOX_AKTIF=1 (lihat app/layout.tsx).
 */
export function AgenWidget() {
  const [buka, setBuka] = useState(false);
  const [tier, setTier] = useState<string | null>(null);
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [ketik, setKetik] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const bawah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!buka || tier !== null) return;
    void fetch("/api/lapis/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTier(typeof d.tier === "string" ? d.tier : "tamu"))
      .catch(() => setTier("tamu"));
  }, [buka, tier]);

  useEffect(() => {
    bawah.current?.scrollIntoView({ behavior: "smooth" });
  }, [pesan, buka]);

  async function kirim() {
    const teks = ketik.trim();
    if (!teks || mengirim) return;
    setKetik("");
    setPesan((p) => [...p, { dari: "saya", teks }]);
    setMengirim(true);
    try {
      const res = await fetch("/api/agen/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesan: teks }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.kode === "PREMIUM" || data.kode === "WAJIB_LOGIN") {
          setTier("gratis");
          setPesan((p) => [...p, { dari: "agen", teks: "Maaf, chat agen khusus Premium. Lihat penawaran di panel ini." }]);
          return;
        }
        throw new Error(data.error ?? "gagal");
      }
      setPesan((p) => [...p, { dari: "agen", teks: String(data.jawaban ?? "") }]);
    } catch {
      setPesan((p) => [...p, { dari: "agen", teks: "Agen sedang tidak bisa menjawab. Coba lagi sebentar lagi." }]);
    } finally {
      setMengirim(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setBuka((b) => !b)}
        className="fixed bottom-5 right-5 z-50 rounded-full bg-ink-900 px-5 py-3 text-sm font-bold text-parchment-100 shadow-xl hover:bg-ink-800"
        aria-expanded={buka}
      >
        {buka ? "Tutup" : "Chat Agen"}
      </button>

      {buka && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[480px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-2xl">
          <div className="bg-ink-900 px-4 py-3">
            <p className="text-sm font-bold text-parchment-100">Agen Kitabah</p>
            <p className="text-[11px] text-parchment-100/70">
              {tier === "premium" ? "Premium — jawaban AI instan" : "Fitur Premium"}
            </p>
          </div>

          {tier === "premium" ? (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {pesan.length === 0 && (
                  <p className="text-sm text-ink-500">
                    Halo! Tanya apa saja seputar penulisan Anda — khalfiyah, rumusan masalah,
                    rujukan, footnote. Saya menjawab langsung di sini.
                  </p>
                )}
                {pesan.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.dari === "saya"
                        ? "ml-8 rounded-2xl rounded-br-sm bg-gold-100 px-3 py-2 text-sm text-ink-900"
                        : "mr-8 rounded-2xl rounded-bl-sm bg-parchment-100 px-3 py-2 text-sm text-ink-900"
                    }
                  >
                    {m.teks}
                  </div>
                ))}
                <div ref={bawah} />
              </div>
              <div className="flex gap-2 border-t border-ink-100 p-3">
                <input
                  value={ketik}
                  onChange={(e) => setKetik(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void kirim()}
                  placeholder="Tulis pertanyaan…"
                  className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
                  maxLength={2000}
                />
                <button onClick={() => void kirim()} disabled={mengirim} className="btn-primary shrink-0 disabled:opacity-60">
                  {mengirim ? "…" : "Kirim"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm leading-relaxed text-ink-700">
                Chat agen dengan jawaban AI instan adalah fitur <strong>Premium</strong>.
                Lapis gratis tetap bisa memakai seluruh ruang kerja dan bot Telegram
                (@Deepmusee_bot) untuk bertanya.
              </p>
              <a href="/premium" className="btn-primary">
                Lihat Premium — Rp10.000/bulan
              </a>
              {tier === "tamu" && (
                <p className="text-xs text-ink-400">Anda belum masuk dengan Google.</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
