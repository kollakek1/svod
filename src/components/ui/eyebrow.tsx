import { cn } from "@/lib/utils";

export function Eyebrow({
  children,
  className,
  dot = false,
  lines = true,
}: {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  lines?: boolean;
}) {
  return (
    <p className={cn("flex items-center gap-3 text-text-muted", className)}>
      {lines ? <span className="h-px w-6 bg-line-strong" aria-hidden="true" /> : null}
      <span className="mono-label">{children}</span>
      {dot ? <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" /> : null}
    </p>
  );
}
