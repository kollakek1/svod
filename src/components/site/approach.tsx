import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeader } from "@/components/ui/section-header";
import { PROGRAMMES, SECTION_COPY, VISIT_STEPS } from "@/content/clinic";
import { formatRub } from "@/lib/format";

/**
 * Секция 3 — «Приём».
 * Четыре шага визита снимают страх неизвестности: что будет происходить,
 * сколько это займёт и когда платить. Линия над шагом на десктопе,
 * слева — на мобиле.
 */
export function Approach() {
  const copy = SECTION_COPY.approach;
  const firstVisit = PROGRAMMES[0];

  return (
    <section
      id="approach"
      aria-labelledby="approach-title"
      className="scroll-mt-[72px] border-t border-line bg-surface py-[var(--spacing-section)]"
    >
      <div className="container-page">
        <SectionHeader id="approach-title" eyebrow={copy.eyebrow} title={copy.title} note={copy.note} />

        <Reveal delay={40}>
          <ol className="mt-[var(--spacing-stack)] grid gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4 lg:gap-x-8">
            {VISIT_STEPS.map((step) => (
              <li
                key={step.index}
                className="border-l border-line pl-5 sm:border-l-0 sm:border-t sm:pl-0 sm:pt-5"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="mono-label tnum text-accent-text">{step.index}</span>
                  <span className="mono-num text-right text-text-muted">{step.duration}</span>
                </div>
                <h3 className="mt-3 text-h3 text-text">{step.title}</h3>
                <p className="mt-2 max-w-[34ch] text-small text-text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <div className="mt-[var(--spacing-stack)] flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
          <p className="max-w-[52ch] text-body text-text">
            Первый визит —{" "}
            <span className="tnum">{firstVisit.durationMin} минут</span>,{" "}
            <span className="tnum">{formatRub(firstVisit.priceRub)}</span>, зачитываем в лечение.
          </p>
          <Button asChild variant="link" size="none" className="self-start text-small sm:self-auto">
            <a href="#booking">
              Записаться на первый визит
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
