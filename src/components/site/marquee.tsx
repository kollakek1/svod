"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const EDGE_MASK =
  "linear-gradient(90deg, transparent 0, black clamp(16px, 4vw, 56px), black calc(100% - clamp(16px, 4vw, 56px)), transparent 100%)";

interface MarqueeProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

/**
 * Маркиза с паузой. Движение останавливается кнопкой, наведением и фокусом
 * внутри ленты. При `prefers-reduced-motion` — обычный горизонтальный скролл
 * без анимации и без кнопки: контент остаётся целиком.
 */
export function Marquee({ children, label, className }: MarqueeProps) {
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  if (reduced) {
    return (
      <div
        className={cn(
          "no-scrollbar -mx-[var(--spacing-gutter)] mt-8 overflow-x-auto px-[var(--spacing-gutter)]",
          className,
        )}
      >
        <div className="flex w-max items-stretch">{children}</div>
      </div>
    );
  }

  const held = paused || hovered || focused;

  return (
    <div className={cn("mt-8", className)}>
      <div className="mb-4 flex items-center justify-between gap-4 border-t border-line pt-4">
        {label ? <p className="mono-label text-text-muted">{label}</p> : <span />}
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          aria-label={paused ? "Продолжить движение отзывов" : "Поставить отзывы на паузу"}
          className="flex h-11 w-11 items-center justify-center border border-line-strong text-text transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <div
        className="relative overflow-hidden"
        style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={() => setFocused(false)}
      >
        <div className="flex w-max animate-marquee" style={{ animationPlayState: held ? "paused" : "running" }}>
          <div className="flex items-stretch pl-[var(--spacing-gutter)]">{children}</div>
          <div className="flex items-stretch pl-[var(--spacing-gutter)]" aria-hidden="true">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
