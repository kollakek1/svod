/* eslint-disable @next/next/no-img-element -- локальные webp подготовлены скриптом, нужен onError-фолбэк */
"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface HeroPlateProps {
  src: string | null;
  alt: string;
  className?: string;
}

/**
 * Плита героя: арочная рамка, макро-съёмка керамики и чертёжные метки.
 * Если файла нет — остаётся фарфоровая плита с аркой, без «битой» картинки.
 */
export function HeroPlate({ src, alt, className }: HeroPlateProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <figure className={cn("relative", className)}>
      <div
        className="pointer-events-none absolute -inset-3 rounded-t-[999px] border border-line sm:-inset-4"
        aria-hidden="true"
      />

      <div className="arch relative aspect-[4/5] overflow-hidden border border-line-strong bg-[linear-gradient(180deg,var(--color-porcelain)_0%,var(--color-clay)_62%,var(--color-sage)_100%)]">
        {showImage ? (
          <img
            src={src ?? ""}
            alt={alt}
            width={1200}
            height={1500}
            fetchPriority="high"
            decoding="async"
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover text-transparent transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-end justify-center overflow-hidden bg-[linear-gradient(180deg,var(--color-porcelain)_0%,var(--color-clay)_62%,var(--color-sage)_100%)]">
            <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <path d="M60 500V260a140 140 0 0 1 280 0v240" fill="none" stroke="var(--color-line-strong)" strokeWidth="1" />
              <path d="M110 500V280a90 90 0 0 1 180 0v220" fill="none" stroke="var(--color-line)" strokeWidth="1" />
              <line x1="200" y1="20" x2="200" y2="500" stroke="var(--color-line)" strokeDasharray="2 6" />
            </svg>
            <span className="mono-label relative z-10 mb-24 text-text-muted">эмаль · фарфор</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(20_22_15/0.12)_0%,transparent_26%,transparent_74%,rgb(20_22_15/0.24)_100%)]" />

        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 text-[#f8f4ea] sm:inset-x-5 sm:bottom-5">
          <span className="flex flex-col gap-1.5">
            <span className="mono-label">01 — эмаль</span>
            <span className="mono-label opacity-75">СВОД · лаборатория</span>
          </span>
          <span className="flex flex-col items-end gap-1.5">
            <span className="mono-label">×25</span>
            <span className="mono-label opacity-75">2014</span>
          </span>
        </div>

        <span
          className="pointer-events-none absolute left-3 top-1/2 h-6 w-px -translate-y-1/2 bg-[#f8f4ea]/40"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute right-3 top-1/2 h-6 w-px -translate-y-1/2 bg-[#f8f4ea]/40"
          aria-hidden="true"
        />
      </div>

      <figcaption className="mt-4 flex items-start justify-between gap-6 border-t border-line pt-3 text-[0.75rem] leading-snug text-text-muted">
        <span className="max-w-[26ch]">Керамическая реставрация, лаборатория СВОД. Съёмка при дневном свете.</span>
        <span className="mono-label tnum shrink-0">рис. 01</span>
      </figcaption>
    </figure>
  );
}
