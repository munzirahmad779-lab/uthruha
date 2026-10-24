export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Uthruha"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="uthruha-gold" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e5c877" />
          <stop offset="0.55" stopColor="#c39b32" />
          <stop offset="1" stopColor="#a17c22" />
        </linearGradient>
      </defs>
      <rect x="1.25" y="1.25" width="45.5" height="45.5" rx="13" fill="#0e2c26" />
      <rect
        x="1.25"
        y="1.25"
        width="45.5"
        height="45.5"
        rx="13"
        stroke="url(#uthruha-gold)"
        strokeWidth="1.5"
      />
      <path
        d="M24 7.5 27.9 15.6 36.8 16.9 30.4 23.1 32 32 24 27.8 16 32 17.6 23.1 11.2 16.9 20.1 15.6Z"
        fill="none"
        stroke="url(#uthruha-gold)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <path
        d="M24 15.5v13.2"
        stroke="#f3ebd7"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M19.6 20.2c1.1-1.5 2.6-2.2 4.4-2.2 1.8 0 3.3.7 4.4 2.2"
        stroke="#f3ebd7"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="24" cy="32.2" r="2" fill="#e5c877" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className="h-9 w-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-arabic text-[17px] font-bold tracking-tight text-ink-900">
          أُطروحة
        </span>
        {!compact && (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-400">
            Uthruha
          </span>
        )}
      </span>
    </span>
  );
}
