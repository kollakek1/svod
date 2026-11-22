"use client";

import { cn } from "@/lib/utils";

import type { BookingStep } from "./types";

const STEPS: { step: BookingStep; label: string }[] = [
  { step: 1, label: "Услуга" },
  { step: 2, label: "Врач" },
  { step: 3, label: "Время" },
  { step: 4, label: "Контакты" },
];

/**
 * Шаги записи. Пройденные — кнопки (возврат не теряет выбор),
 * текущий помечен `aria-current`, будущие — `aria-disabled`.
 */
export function Stepper({
  step,
  onNavigate,
}: {
  step: BookingStep;
  onNavigate: (step: BookingStep) => void;
}) {
  return (
    <div>
      <ol className="grid grid-cols-4 gap-2" aria-label="Шаги записи">
        {STEPS.map((item) => {
          const state = item.step < step ? "done" : item.step === step ? "current" : "future";

          return (
            <li key={item.step}>
              <button
                type="button"
                onClick={() => {
                  if (item.step < step) onNavigate(item.step);
                }}
                aria-disabled={item.step > step || undefined}
                aria-current={item.step === step ? "step" : undefined}
                className={cn(
                  "flex min-h-11 w-full flex-col items-start gap-1 py-2 text-left transition-colors duration-200 sm:flex-row sm:items-baseline sm:gap-2",
                  state === "current" && "text-accent-text",
                  state === "done" && "text-text hover:text-accent-text",
                  state === "future" && "cursor-default text-text-muted/70",
                )}
              >
                <span className="mono-label tnum">{String(item.step).padStart(2, "0")}</span>
                <span className={cn("text-[0.75rem] leading-tight sm:text-small", state === "current" && "font-medium")}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div
        className="mt-2 h-0.5 bg-line"
        role="progressbar"
        aria-label="Пройдено шагов"
        aria-valuemin={1}
        aria-valuemax={4}
        aria-valuenow={step}
        aria-valuetext={`Шаг ${step} из 4`}
      >
        <div
          className="h-full origin-left bg-accent-text transition-transform duration-200 ease-[var(--ease-brand)] motion-reduce:transition-none"
          style={{ transform: `scaleX(${step / 4})` }}
        />
      </div>
    </div>
  );
}
