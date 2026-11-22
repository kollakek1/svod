import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  className?: string;
  id?: string;
  size?: "default" | "large";
}

export function SectionHeader({ eyebrow, title, note, action, className, id, size = "default" }: SectionHeaderProps) {
  return (
    <header className={cn("border-t border-line pt-5", className)}>
      <div className="grid-12">
        <div className="col-span-4 md:col-span-8 lg:col-span-9">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2
            id={id}
            className={cn(
              "display mt-5 max-w-[20ch] text-text",
              size === "large" ? "text-h1" : "text-h2",
            )}
          >
            {title}
          </h2>
        </div>
        {note ? (
          <div className="col-span-4 md:col-span-8 lg:col-span-3 lg:pt-9">
            <p className="max-w-[var(--container-note)] text-small leading-relaxed text-text-muted">{note}</p>
          </div>
        ) : null}
        {action ? <div className="col-span-4 mt-2 md:col-span-8 lg:col-span-3 lg:pt-9">{action}</div> : null}
      </div>
    </header>
  );
}
