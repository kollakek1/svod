import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      <path
        d="M3.5 21V10.2a8.5 8.5 0 0 1 17 0V21"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="square"
      />
      <path d="M8 21v-8.5" stroke="currentColor" strokeWidth="1.15" strokeLinecap="square" />
      <path d="M16 21v-8.5" stroke="currentColor" strokeWidth="1.15" strokeLinecap="square" />
    </svg>
  );
}

export function Logo({ className, asLink = true }: { className?: string; asLink?: boolean }) {
  const content = (
    <span className={cn("flex items-baseline gap-3", className)}>
      <LogoMark className="h-5 w-5 shrink-0 self-center text-accent-text" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] leading-none tracking-[0.16em] text-text">СВОД</span>
        <span className="mono-label mt-1.5 text-[0.5625rem] tracking-[0.22em] text-text-muted">стоматология</span>
      </span>
    </span>
  );

  if (!asLink) return content;

  return (
    <Link href="/" aria-label="СВОД — на главную" className="inline-flex focus-visible:outline-offset-6">
      {content}
    </Link>
  );
}
