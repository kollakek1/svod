/* eslint-disable @next/next/no-img-element -- портреты webp подготовлены заранее, нужен фолбэк на инициалы */
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { selectDoctorForBooking } from "@/lib/booking-events";
import type { ClinicDoctor } from "@/lib/clinic";
import { pluralRu } from "@/lib/format";

export interface DoctorCard extends ClinicDoctor {
  /** Путь к фото, если файл реально лежит в /public; иначе — типографская плита. */
  photoSrc: string | null;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Лента врачей: snap-scroll, стрелки, прогресс. Карточка целиком —
 * кнопка выбора врача, поэтому название остаётся h3, а клик ловит
 * прозрачная кнопка поверх всей карточки.
 */
export function DoctorsRail({ doctors }: { doctors: DoctorCard[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    if (max <= 0) {
      setProgress(1);
      setAtStart(true);
      setAtEnd(true);
      return;
    }
    setProgress(Math.min(1, Math.max(0, node.scrollLeft / max)));
    setAtStart(node.scrollLeft < 4);
    setAtEnd(max - node.scrollLeft < 4);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync, doctors.length]);

  const step = (direction: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>("[data-doctor-card]");
    const amount = (card?.offsetWidth ?? node.clientWidth * 0.8) + 24;
    node.scrollBy({ left: direction * amount, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  if (doctors.length === 0) {
    return (
      <p className="border-t border-line pt-5 text-body text-text-muted">
        Состав клиники обновляется. Позвоните — подскажем, кто принимает сегодня.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <p className="mono-label text-text-muted">
          {doctors.length} {pluralRu(doctors.length, ["врач", "врача", "врачей"])}
        </p>

        <div className="hidden items-center gap-2 lg:flex">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => step(-1)}
            disabled={atStart}
            aria-label="Предыдущие врачи"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => step(1)}
            disabled={atEnd}
            aria-label="Следующие врачи"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="-mx-[var(--spacing-gutter)] mt-4">
        <div
          ref={scrollerRef}
          onScroll={sync}
          className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto px-[var(--spacing-gutter)] pb-5 pt-1 scroll-px-[var(--spacing-gutter)]"
        >
          {doctors.map((doctor) => (
            <article
              key={doctor.id}
              data-doctor-card
              className="group relative w-[min(86vw,20rem)] shrink-0 snap-start"
            >
              <div className="relative aspect-[4/5] overflow-hidden border border-line bg-surface-2">
                {doctor.photoSrc ? (
                  <img
                    src={doctor.photoSrc}
                    alt={`${doctor.name} — ${doctor.role}`}
                    width={800}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-[900ms] ease-[var(--ease-brand)] group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-surface-2 px-6 text-center">
                    <span className="display text-5xl leading-none text-text-muted" aria-hidden="true">
                      {initialsOf(doctor.name)}
                    </span>
                    <span className="mono-label text-text-muted">{doctor.role}</span>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-ink/90 px-4 py-3 text-bone transition-transform duration-300 ease-[var(--ease-brand)] lg:translate-y-[calc(100%+1px)] lg:group-hover:translate-y-0 lg:group-focus-within:translate-y-0">
                  <p className="font-display text-[0.9375rem] italic leading-snug">«{doctor.quote}»</p>
                </div>
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[1.125rem] font-medium leading-tight text-text">{doctor.name}</h3>
                  <span className="mono-num shrink-0 text-text-muted">
                    {doctor.years} {pluralRu(doctor.years, ["год", "года", "лет"])}
                  </span>
                </div>
                <p className="mt-1 text-small text-text-muted">{doctor.role}</p>
                <p className="mt-2 text-small leading-snug text-text-muted">{doctor.focus}</p>
              </div>

              <button
                type="button"
                onClick={() => selectDoctorForBooking(doctor.id)}
                aria-label={`Выбрать врача ${doctor.name} и перейти к записи`}
                className="absolute inset-0 z-10 rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
              />
            </article>
          ))}

          <div aria-hidden="true" className="w-[var(--spacing-gutter)] shrink-0" />
        </div>
      </div>

      <div className="h-[2px] w-full bg-line" aria-hidden="true">
        <div
          className="h-full bg-accent transition-[width] duration-200 ease-[var(--ease-brand)]"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
