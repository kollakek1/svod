"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { CONTACTS } from "@/content/clinic";
import type { AvailabilityResponse, ClinicDoctor, ClinicService } from "@/lib/clinic";
import { formatDayWithWeekday, formatDuration, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { dayIso, dayNumber, dayWeekdayShort, groupSlots, slotCountLabel } from "./booking-utils";
import { StepHeading } from "./step-heading";
import type { AvailabilityStatus } from "./types";

function DayRibbonSkeleton() {
  return (
    <div className="flex gap-1.5 overflow-hidden sm:grid sm:grid-cols-7" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="h-[4.25rem] w-[4.75rem] shrink-0 animate-pulse bg-surface-2 motion-reduce:animate-none sm:w-auto"
        />
      ))}
    </div>
  );
}

function SlotsSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse bg-surface-2 motion-reduce:animate-none" />
      ))}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 border-l-2 border-danger pl-3 text-small leading-snug text-danger" role="alert">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Шаг 3 — дата и время. Все данные о слотах приходят только из API. */
export function TimeStep({
  service,
  doctor,
  status,
  availability,
  error,
  selectedDay,
  startsAt,
  onSelectDay,
  onSelectSlot,
  onRetry,
  slotError,
  notice,
  headingRef,
}: {
  service: ClinicService;
  doctor: ClinicDoctor;
  status: AvailabilityStatus;
  availability: AvailabilityResponse | null;
  error: string | null;
  selectedDay: string | null;
  startsAt: string | null;
  onSelectDay: (date: string) => void;
  onSelectSlot: (iso: string) => void;
  onRetry: () => void;
  slotError: string | null;
  notice: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const durationMin = availability?.durationMin ?? service.durationMin;
  const loading = status === "idle" || status === "loading";
  const hasAnySlots = Boolean(availability?.days.some((day) => day.slots.length > 0));
  const selectedDayData = availability?.days.find((day) => day.date === selectedDay) ?? null;
  const nearestDays = (availability?.days ?? []).filter((day) => day.date !== selectedDay && day.slots.length > 0).slice(0, 2);
  const groups = selectedDayData && selectedDayData.slots.length > 0 ? groupSlots(selectedDayData.slots) : [];

  return (
    <div>
      <StepHeading
        headingRef={headingRef}
        title="Дата и время"
        lead={`${doctor.name} · ${service.name} · ${formatDuration(durationMin)}. Окна показываем из расписания клиники в московском времени.`}
      />

      {loading ? (
        <div className="mt-6" aria-busy="true" aria-live="polite">
          <span className="sr-only">Загружаем свободные окна</span>
          <DayRibbonSkeleton />
          <SlotsSkeleton />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-6 border-t border-line pt-5">
          <p className="flex items-start gap-2 text-small leading-snug text-danger" role="alert">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error ?? "Не удалось загрузить окна. Проверьте связь и попробуйте ещё раз."}</span>
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
            Повторить
          </Button>
        </div>
      ) : null}

      {status === "ready" && availability ? (
        <div className="mt-6" aria-live="polite">
          {hasAnySlots ? (
            <>
              <div className="-mx-[var(--spacing-gutter)] sm:mx-0">
                <div
                  className="no-scrollbar flex gap-1.5 overflow-x-auto px-[var(--spacing-gutter)] pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0"
                  role="group"
                  aria-label="Даты"
                >
                  {availability.days.map((day) => {
                    const empty = day.slots.length === 0;
                    const isSelected = day.date === selectedDay && !empty;

                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={empty}
                        aria-pressed={isSelected}
                        aria-label={`${formatDayWithWeekday(dayIso(day.date))} — ${slotCountLabel(day.slots.length)}`}
                        onClick={() => onSelectDay(day.date)}
                        className={cn(
                          "flex min-h-[4.25rem] w-[4.75rem] shrink-0 flex-col items-start justify-center gap-1 border px-2 py-2 text-left transition-colors duration-200 sm:w-auto",
                          isSelected
                            ? "border-accent bg-accent text-on-accent"
                            : "border-line bg-transparent text-text hover:border-line-strong hover:bg-bg",
                          empty && "cursor-not-allowed border-line text-text-disabled hover:border-line hover:bg-transparent",
                        )}
                      >
                        <span className={cn("mono-label", isSelected ? "text-on-accent/80" : "text-text-muted")}>
                          {dayWeekdayShort(day.date)}
                        </span>
                        <span className="text-base leading-none tnum">{dayNumber(day.date)}</span>
                        <span className={cn("text-[0.6875rem] leading-none tnum", isSelected ? "text-on-accent/80" : "text-text-muted")}>
                          {empty ? "—" : slotCountLabel(day.slots.length)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {notice ? <Notice>{notice}</Notice> : null}
              {slotError ? <Notice>{slotError}</Notice> : null}

              {!selectedDayData ? (
                <p className="mt-6 border-t border-line pt-5 text-small text-text-muted">Выберите день в ленте выше.</p>
              ) : selectedDayData.slots.length === 0 ? (
                <div className="mt-6 border-t border-line pt-5">
                  <p className="flex items-start gap-2 text-small leading-snug text-text">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                    <span>На этот день окон нет.</span>
                  </p>
                  {nearestDays.length > 0 ? (
                    <>
                      <p className="mono-label mt-4 text-text-muted">Ближайшие окна</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {nearestDays.map((day) => (
                          <Button
                            key={day.date}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11"
                            onClick={() => onSelectDay(day.date)}
                          >
                            {formatDayWithWeekday(dayIso(day.date))}
                          </Button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="mt-6 border-t border-line pt-5">
                  <p className="mono-label text-text-muted">{formatDayWithWeekday(dayIso(selectedDayData.date))}</p>
                  {groups.map((group) => (
                    <div key={group.id} className="mt-5 first:mt-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="mono-label text-text-muted">{group.title}</p>
                        <p className="mono-num text-text-muted">{group.range}</p>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {group.slots.map((slot) => {
                          const isSelected = slot === startsAt;

                          return (
                            <button
                              key={slot}
                              type="button"
                              aria-pressed={isSelected}
                              aria-label={`${formatDayWithWeekday(dayIso(selectedDayData.date))}, ${formatTime(slot)}`}
                              onClick={() => onSelectSlot(slot)}
                              className={cn(
                                "flex h-12 items-center justify-center border text-sm tnum transition-colors duration-200",
                                isSelected
                                  ? "border-accent bg-accent text-on-accent"
                                  : "border-line bg-transparent text-text hover:border-line-strong hover:bg-bg",
                              )}
                            >
                              {formatTime(slot)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="border-t border-line pt-5">
              <p className="flex items-start gap-2 text-small leading-snug text-text">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                <span>Свободных окон на три недели вперёд нет. Позвоните — подберём время вручную.</span>
              </p>
              <Button asChild variant="outline" className="mt-4">
                <a href={`tel:${CONTACTS.phoneHref}`}>{CONTACTS.phone}</a>
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
