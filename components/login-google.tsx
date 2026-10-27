"use client";

import { useEffect, useRef, useState } from "react";
import { muatGIS } from "@/lib/engine/gdrive-storage";

interface StatusLapis {
  pengguna: { id: string; email: string; nama: string; foto: string } | null;
  tier?: string;
  premiumSampai?: string | null;
}

/**
 * Tombol masuk Google IDENTITAS SAJA (keputusan A): memakai alur kredensial
 * GIS (id_token) — scope yang diminta Google hanyalah openid/email/profile.
 * Scope Drive TIDAK diminta di sini; ia diminta bertahap oleh fitur yang
 * membutuhkannya (penyimpanan Drive / Google Doc premium).
 */
export function LoginGoogle({ ringkas = false }: { ringkas?: boolean }) {
  const [status, setStatus] = useState<StatusLapis | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);

  async function segarkan() {
    try {
      const res = await fetch("/api/lapis/status", { cache: "no-store" });
      setStatus((await res.json()) as StatusLapis);
    } catch { /* abaikan */ }
  }

  useEffect(() => {
    void segarkan();
  }, []);

  useEffect(() => {
    if (status?.pengguna || !wadah.current) return;
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
        if (!g || !clientId || !wadah.current) return;
        g.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp: { credential?: string }) => {
            if (!resp.credential) return;
            setMemuat(true);
            setGalat("");
            try {
              const res = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: resp.credential }),
              });
              const data = await res.json();
              if (!res.ok) {
                setGalat(data.error ?? "Gagal masuk.");
                return;
              }
              await segarkan();
            } catch {
              setGalat("Tidak terhubung ke server.");
            } finally {
              setMemuat(false);
            }
          },
        });
        g.accounts.id.renderButton(wadah.current, {
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
  }, [status?.pengguna]);

  if (status?.pengguna) {
    return (
      <div className="flex items-center gap-3">
        {status.pengguna.foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={status.pengguna.foto} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
        )}
        <div className={ringkas ? "hidden sm:block" : ""}>
          <p className="text-sm font-semibold text-ink-900">{status.pengguna.nama || status.pengguna.email}</p>
          <p className="text-xs text-ink-500">
            Lapis: <strong>{status.tier === "premium" ? "Premium" : "Gratis"}</strong>
            {status.tier === "premium" && status.premiumSampai
              ? ` · berlaku s.d. ${new Date(status.premiumSampai).toLocaleDateString("id-ID")}`
              : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div ref={wadah} className="min-h-[44px]" />
      {memuat && <p className="mt-1 text-xs text-ink-500">Memproses masuk…</p>}
      {galat && <p className="mt-1 text-xs text-red-600">{galat}</p>}
      {!ringkas && (
        <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-ink-400">
          Masuk hanya membaca nama, foto, dan email Anda. Folder Drive Anda tidak
          diminta di sini — akses Drive hanya diminta saat Anda memakai fitur
          penyimpanan/ekspor yang membutuhkannya.
        </p>
      )}
    </div>
  );
}
