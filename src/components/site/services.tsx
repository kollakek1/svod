"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SectionHeader } from "@/components/ui/section-header";
import { SECTION_COPY, SERVICE_CATEGORY_ORDER } from "@/content/clinic";
import { selectServiceForBooking } from "@/lib/booking-events";
import type { ClinicService } from "@/lib/clinic";
import { formatDuration, formatRub, pluralRu } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ServiceGroup {
  id: string;
  category: ClinicService["category"];
  offset: number;
  items: ClinicService[];
}

/**
 * Секция 4 — «Услуги».
 * Таблица из десяти строк и sticky-оглавление категорий. Строка целиком —
 * кнопка выбора услуги: событие уходит в форму записи, страница едет к `#booking`.
 * Название остаётся h3, клик ловит прозрачная кнопка поверх строки.
 */
export function Services({ services }: { services: ClinicService[] }) {
  const copy = SECTION_COPY.services;

  const groups = useMemo<ServiceGroup[]>(() => {
    let offset = 0;
    const result: ServiceGroup[] = [];

    for (const [index, category] of SERVICE_CATEGORY_ORDER.entries()) {
      const items = services.filter((service) => service.category === category);
      if (items.length === 0) continue;
      result.push({ id: `services-cat-${index + 1}`, category, offset, items });
      offset += items.length;
    }

    return result;
  }, [services]);

  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null);

  useEffect(() => {
    if (groups.length === 0 || typeof IntersectionObserver === "undefined") return;

    const nodes = groups
      .map((group) => document.getElementById(group.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.15, 0.4, 0.75] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [groups]);

  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="scroll-mt-[72px] border-t border-line bg-bg py-[var(--spacing-section)]"
    >
      <div className="container-page">
        <SectionHeader id="services-title" eyebrow={copy.eyebrow} title={copy.title} note={copy.note} />

        <div className="mt-[var(--spacing-stack)] grid-12">
          <div className="col-span-4 md:col-span-8 lg:col-span-2">
            <nav aria-label="Категории услуг" className="lg:sticky lg:top-[6.5rem]">
              <p className="mono-label hidden text-text-muted lg:block">Категории</p>
              <ul className="no-scrollbar -mx-[var(--spacing-gutter)] flex gap-5 overflow-x-auto px-[var(--spacing-gutter)] pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0">
                {groups.map((group, index) => {
                  const active = activeId === group.id;
                  return (
                    <li
                      key={group.id}
                      className={cn(
                        "shrink-0 lg:border-t lg:border-line",
                        active && "lg:border-line-strong",
                      )}
                    >
                      <a
                        href={`#${group.id}`}
                        aria-current={active ? "true" : undefined}
                        onClick={() => setActiveId(group.id)}
                        className={cn(
                          "mono-label inline-flex items-center gap-2 whitespace-nowrap py-2 transition-colors duration-200 lg:w-full lg:py-3",
                          active ? "text-accent-text" : "text-text-muted hover:text-text",
                        )}
                      >
                        <span className="tnum text-[0.625rem] tracking-[0.1em]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {group.category}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <div className="col-span-4 mt-6 md:col-span-8 lg:col-span-9 lg:col-start-4 lg:mt-0">
            {groups.length === 0 ? (
              <p className="max-w-[42ch] border-t border-line pt-5 text-body text-text-muted">
                Каталог сейчас обновляют. Позвоните — назовём цену и ближайшее время, без записи.
              </p>
            ) : (
              <div>
                {groups.map((group) => (
                  <div key={group.id} id={group.id} className="scroll-mt-28 [&+div]:mt-10">
                    <div className="flex items-baseline justify-between gap-4 border-b border-line-strong pb-2">
                      <p className="mono-label text-text-muted">{group.category}</p>
                      <p className="mono-label tnum hidden text-text-muted sm:block">
                        {group.items.length} {pluralRu(group.items.length, ["услуга", "услуги", "услуг"])}
                      </p>
                    </div>

                    <ul>
                      {group.items.map((service, itemIndex) => {
                        const number = String(group.offset + itemIndex + 1).padStart(2, "0");
                        return (
                          <li
                            key={service.id}
                            className="group relative border-t border-line transition-colors duration-200 first:border-t-0 hover:bg-surface has-[:focus-visible]:bg-surface"
                          >
                            <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_8.5rem_1.25rem] sm:items-center sm:gap-x-6">
                              <span className="mono-label tnum pt-1 text-text-muted sm:pt-0">{number}</span>

                              <div className="min-w-0">
                                <h3 className="font-display text-[1.0625rem] leading-snug text-text sm:text-h3">
                                  {service.name}
                                </h3>
                                <p className="mt-1 max-w-[46ch] text-small text-text-muted">{service.summary}</p>

                                <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:hidden">
                                  <span className="mono-num text-text-muted">
                                    {formatDuration(service.durationMin)}
                                  </span>
                                  <span className="whitespace-nowrap text-price tnum text-text">
                                    {service.priceFrom ? (
                                      <span className="text-small text-text-muted">от </span>
                                    ) : null}
                                    {formatRub(service.priceRub)}
                                  </span>
                                </p>
                              </div>

                              <span className="mono-num hidden text-text-muted sm:block">
                                {formatDuration(service.durationMin)}
                              </span>

                              <span className="hidden whitespace-nowrap text-right text-price tnum text-text sm:block">
                                {service.priceFrom ? (
                                  <span className="text-small text-text-muted">от </span>
                                ) : null}
                                {formatRub(service.priceRub)}
                              </span>

                              <span className="hidden justify-end text-text-muted sm:flex">
                                <ArrowUpRight
                                  className="h-4 w-4 transition-transform duration-200 ease-[var(--ease-brand)] group-hover:translate-x-1"
                                  aria-hidden="true"
                                />
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => selectServiceForBooking(service.id)}
                              aria-label={`Выбрать услугу «${service.name}» и перейти к записи`}
                              className="absolute inset-0 z-10 w-full rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
