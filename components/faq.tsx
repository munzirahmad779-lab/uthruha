"use client";

import { useState } from "react";
import { IconChevronDown } from "@/components/icons";

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  const [buka, setBuka] = useState<number | null>(0);

  return (
    <div className="divide-y divide-ink-900/10 rounded-2xl border border-ink-900/10 bg-white/70">
      {items.map((item, i) => {
        const aktif = buka === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setBuka(aktif ? null : i)}
              aria-expanded={aktif}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-[14px] font-semibold text-ink-900">{item.q}</span>
              <IconChevronDown
                className={`h-4 w-4 shrink-0 text-ink-500 transition-transform duration-300 ${
                  aktif ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className="grid overflow-hidden transition-all duration-300"
              style={{ gridTemplateRows: aktif ? "1fr" : "0fr" }}
            >
              <div className="min-h-0">
                <p className="px-5 pb-5 text-[13px] leading-relaxed text-ink-700">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
