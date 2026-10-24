"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/brand";
import { IconArrowRight, IconClose, IconMenu } from "@/components/icons";

const NAV = [
  { href: "/#cara-kerja", label: "Cara Kerja" },
  { href: "/#fitur", label: "Fitur" },
  { href: "/#struktur", label: "Struktur" },
  { href: "/alat", label: "Alat" },
  { href: "/jurnal", label: "Jurnal" },
  { href: "/panduan", label: "Panduan" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`no-print sticky top-0 z-40 border-b transition-colors duration-300 ${
        scrolled
          ? "border-ink-900/10 bg-parchment-50/90 backdrop-blur-xl"
          : "border-transparent bg-parchment-50/60 backdrop-blur-sm"
      }`}
    >
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-lg" aria-label="Uthruha — beranda">
          <BrandLockup />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-700 transition hover:bg-ink-900/5 hover:text-ink-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/panduan" className="hidden text-[13px] font-medium text-ink-600 hover:text-ink-900 sm:block">
            Integritas Akademik
          </Link>
          <Link href="/proyek" className="btn-primary !px-4 !py-2.5 text-[13px]">
            Buka Ruang Kerja
            <IconArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            className="grid h-10 w-10 place-items-center rounded-xl border border-ink-900/15 bg-white/70 text-ink-800 lg:hidden"
          >
            {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden">
          <div className="wrap pb-6">
            <nav className="grid gap-1 rounded-2xl border border-ink-900/10 bg-white/90 p-2 shadow-card">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-medium text-ink-800 hover:bg-parchment-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
