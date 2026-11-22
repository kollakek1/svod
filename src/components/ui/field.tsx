import * as React from "react";

import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mono-label block text-text-muted mb-2", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-13 w-full rounded-[2px] border-0 border-b border-control-border bg-transparent px-0 py-2",
        "text-base text-text placeholder:text-text-muted",
        "transition-colors duration-200 hover:border-line-strong",
        "focus-visible:border-b-2 focus-visible:border-focus focus-visible:bg-surface focus-visible:outline-none",
        "aria-[invalid=true]:border-b-2 aria-[invalid=true]:border-danger",
        "disabled:text-text-disabled disabled:border-line",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-y rounded-[2px] border-0 border-b border-control-border bg-transparent px-0 py-2",
        "text-base text-text placeholder:text-text-muted",
        "transition-colors duration-200 hover:border-line-strong",
        "focus-visible:border-b-2 focus-visible:border-focus focus-visible:bg-surface focus-visible:outline-none",
        "aria-[invalid=true]:border-b-2 aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 min-h-5 text-[0.8125rem] leading-snug text-danger" role="alert">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[0.8125rem] leading-snug text-text-muted">{children}</p>;
}
