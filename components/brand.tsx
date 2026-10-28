// Tanda Kitabah — diambil persis dari galeri logo pemilik:
// persegi bulat Coklat Tinta #4A3A22, mata qalam Kertas Gading #FAF6EB,
// titik tinta, lengkung goresan + garis dasar Emas #D9A441.
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Kitabah"
      className={className}
    >
      <rect width="64" height="64" rx="14" fill="#4A3A22" />
      <path
        d="M40 8c5 8 5 18-1 26l-7 10H20l8-11C34 24 37 16 40 8Z"
        fill="#FAF6EB"
      />
      <circle cx="31" cy="30" r="2.4" fill="#4A3A22" />
      <path
        d="M32 44c-1 4 1 7 4 8"
        fill="none"
        stroke="#D9A441"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M14 54h28"
        fill="none"
        stroke="#D9A441"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className="h-9 w-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-arabic text-[17px] font-bold tracking-tight text-ink-900">
          كِتَابَة
        </span>
        {!compact && (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-400">
            Kitabah
          </span>
        )}
      </span>
    </span>
  );
}
