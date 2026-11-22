"use client";

import { useRef, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";

import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/clinic";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Label } from "@/components/ui/field";

/* ─── Вкладки ─────────────────────────────────────────────────────────────── */

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  label,
  panelId,
  idPrefix,
  className,
}: {
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  panelId: string;
  idPrefix: string;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    const next = items[nextIndex];
    if (!next) return;
    onChange(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={cn("admin-tabs", className)}>
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[item.id] = node;
            }}
            id={`${idPrefix}-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className="admin-tab"
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className="tnum text-[0.75rem] text-text-muted">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Статус ──────────────────────────────────────────────────────────────── */

const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: "text-accent-text",
  confirmed: "text-text",
  done: "text-text-muted",
  cancelled: "text-text-muted",
  "no-show": "text-danger",
};

export function StatusText({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  return (
    <span className={cn("whitespace-nowrap text-[0.8125rem] leading-tight", STATUS_CLASS[status], className)}>
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}

/* ─── Скелетоны ───────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("admin-skeleton block", className)} />;
}

export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-px", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex min-h-14 items-center gap-4 border-t border-line py-2">
          <Skeleton className="h-3 w-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/* ─── Ошибка загрузки ─────────────────────────────────────────────────────── */

export function ErrorNotice({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-4 border border-line-strong bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-small text-text">{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" className="h-11 shrink-0" onClick={onRetry}>
          Повторить
        </Button>
      ) : null}
    </div>
  );
}

/* ─── Поле формы ──────────────────────────────────────────────────────────── */

export function FormField({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : hint ? (
        <FieldHint>{hint}</FieldHint>
      ) : (
        <div className="min-h-5" aria-hidden="true" />
      )}
    </div>
  );
}

/** Нативный select в стиле поля: только нижняя граница, высота 52. */
export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("admin-select", className)} {...props} />;
}

export function InlineNote({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" | "success" }) {
  const toneClass =
    tone === "danger" ? "text-danger" : tone === "success" ? "text-accent-text" : "text-text-muted";
  return (
    <p role={tone === "danger" ? "alert" : undefined} className={cn("text-[0.8125rem] leading-snug", toneClass)}>
      {children}
    </p>
  );
}
