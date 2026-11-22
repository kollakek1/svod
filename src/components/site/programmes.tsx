"use client";

import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { PROGRAMMES, SECTION_COPY } from "@/content/clinic";
import { selectServiceForBooking } from "@/lib/booking-events";
import { formatDuration, formatRub, formatVisits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Секция 5 — «Программы».
 * Три сценария в одной панели, разделённые волосяными линиями. Первый —
 * входной (диагностика), поэтому у него фон clay и усиленная линия, без бейджей.
 * Кнопка выбирает услугу программы в записи.
 */
export function Programmes() {
  const copy = SECTION_COPY.programmes;

  return (
    <section
      id="programmes"
      aria-labelledby="programmes-title"
      className="scroll-mt-[72px] border-t border-line bg-surface py-[var(--spacing-section)]"
    >
      <div className="container-page">
        <SectionHeader id="programmes-title" eyebrow={copy.eyebrow} title={copy.title} note={copy.note} />

        <ul className="mt-[var(--spacing-stack)] grid border border-line md:grid-cols-3">
          {PROGRAMMES.map((programme, index) => {
            const featured = index === 0;
            return (
              <li
                key={programme.id}
                className={cn(
                  "flex flex-col border-b border-line px-6 py-8 last:border-b-0 sm:px-8 sm:py-10",
                  "md:border-b-0 md:border-l md:px-4 md:py-8 md:first:border-l-0 lg:px-8 lg:py-10",
                  featured && "bg-surface-2",
                )}
              >
                <span className="display tnum text-[2.75rem] leading-none tracking-[-0.03em] text-accent-text">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <p className="mono-label mt-6 text-text-muted">{programme.kicker}</p>
                <h3 className="mt-2 text-h3 text-text">{programme.name}</h3>
                <p className="mt-3 max-w-[36ch] text-small text-text-muted">{programme.description}</p>

                <ul className="mt-6 border-t border-line">
                  {programme.includes.map((item) => (
                    <li key={item} className="flex gap-2 border-b border-line py-2.5 text-small text-text-muted">
                      <span aria-hidden="true" className="text-text-muted">
                        —
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-h3 tnum text-text">{formatRub(programme.priceRub)}</span>
                    {programme.compareAtRub ? (
                      <span className="text-small tnum text-text-muted line-through decoration-line-strong decoration-1">
                        {formatRub(programme.compareAtRub)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mono-num mt-2 text-text-muted">
                    {formatVisits(programme.visits)} · {formatDuration(programme.durationMin)}
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="mt-5 w-full justify-between"
                    onClick={() => selectServiceForBooking(programme.serviceId)}
                    aria-label={`Выбрать программу «${programme.name}» и перейти к записи`}
                  >
                    Выбрать программу
                    <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
