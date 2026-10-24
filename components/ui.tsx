"use client";

import { useState, type ReactNode } from "react";
import { IconCheck, IconCopy } from "@/components/icons";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-ink-500">{hint}</span>}
    </label>
  );
}

export function Progress({ nilai, tebal = false }: { nilai: number; tebal?: boolean }) {
  return (
    <span
      className={`block overflow-hidden rounded-full bg-ink-900/10 ${tebal ? "h-2" : "h-1.5"}`}
      role="progressbar"
      aria-valuenow={nilai}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="block h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-[width] duration-500"
        style={{ width: `${Math.max(2, Math.min(100, nilai))}%` }}
      />
    </span>
  );
}

export function CopyButton({
  teks,
  label = "Salin",
  className = "btn-quiet",
}: {
  teks: string;
  label?: string;
  className?: string;
}) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = teks;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 1600);
      }}
    >
      {ok ? <IconCheck className="h-3.5 w-3.5 text-gold-600" /> : <IconCopy className="h-3.5 w-3.5" />}
      {ok ? "Tersalin" : label}
    </button>
  );
}

export function Tabs({
  items,
  aktif,
  onChange,
}: {
  items: { id: string; label: string; ar?: string }[];
  aktif: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist">
      {items.map((t) => {
        const on = t.id === aktif;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition ${
              on
                ? "bg-ink-900 text-parchment-100 shadow-card"
                : "text-ink-600 hover:bg-ink-900/5 hover:text-ink-900"
            }`}
          >
            {t.label}
            {t.ar && (
              <span
                className={`ms-1.5 font-arabic text-[11px] ${on ? "text-gold-300" : "text-ink-400"}`}
                dir="rtl"
              >
                {t.ar}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({ label, nilai }: { label: string; nilai: string | number }) {
  return (
    <div className="rounded-xl border border-ink-900/10 bg-white/70 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-0.5 text-base font-bold text-ink-900">{nilai}</p>
    </div>
  );
}

export function Note({
  children,
  jenis = "info",
}: {
  children: ReactNode;
  jenis?: "info" | "warn" | "aman";
}) {
  const gaya =
    jenis === "warn"
      ? "border-amber-500/30 bg-amber-50/80 text-amber-900"
      : jenis === "aman"
        ? "border-emerald-600/25 bg-emerald-50/70 text-emerald-900"
        : "border-ink-900/10 bg-parchment-100/80 text-ink-700";
  return (
    <div className={`rounded-xl border px-4 py-3 text-[12px] leading-relaxed ${gaya}`}>{children}</div>
  );
}
