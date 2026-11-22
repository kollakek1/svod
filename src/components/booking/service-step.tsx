"use client";

import type { RefObject } from "react";

import { CONTACTS, SERVICE_CATEGORY_ORDER } from "@/content/clinic";
import type { ClinicService } from "@/lib/clinic";
import { formatDuration, formatRub } from "@/lib/format";
import { cn } from "@/lib/utils";

import { StepHeading } from "./step-heading";

function ServiceRow({
  service,
  selected,
  name,
  onSelect,
}: {
  service: ClinicService;
  selected: boolean;
  name: string;
  onSelect: (id: string) => void;
}) {
  return (
    <label
      className={cn(
        "group relative flex min-h-11 cursor-pointer items-start gap-3 border-b border-line border-l-2 border-l-transparent py-4 pl-3 pr-2 transition-colors duration-200 sm:gap-4 sm:pl-4",
        "hover:bg-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-focus",
        selected && "border-l-accent bg-bg",
      )}
    >
      <input
        type="radio"
        name={name}
        value={service.id}
        checked={selected}
        onChange={() => onSelect(service.id)}
        className="sr-only"
      />

      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
          selected ? "border-accent" : "border-control-border group-hover:border-line-strong",
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full transition-colors duration-200", selected ? "bg-accent" : "bg-transparent")} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="font-display text-[1.0625rem] leading-snug text-text sm:text-h3">{service.name}</span>
        <span className="mt-1 block max-w-[48ch] text-small leading-snug text-text-muted">{service.summary}</span>
        <span className="mt-2 flex items-baseline justify-between gap-3 sm:hidden">
          <span className="mono-num tnum text-text-muted">{formatDuration(service.durationMin)}</span>
          <span className="whitespace-nowrap text-price tnum text-text">
            {service.priceFrom ? <span className="text-small text-text-muted">от </span> : null}
            {formatRub(service.priceRub)}
          </span>
        </span>
      </span>

      <span className="mono-num hidden w-[5.5rem] shrink-0 whitespace-nowrap pt-1 text-text-muted sm:block">
        {formatDuration(service.durationMin)}
      </span>

      <span className="hidden w-[7rem] shrink-0 pt-0.5 text-right text-price tnum text-text sm:block">
        {service.priceFrom ? <span className="text-small text-text-muted">от </span> : null}
        {formatRub(service.priceRub)}
      </span>
    </label>
  );
}

/** Шаг 1 — услуга. Группы по категориям, radio-строки. */
export function ServiceStep({
  services,
  serviceId,
  onSelect,
  headingRef,
}: {
  services: ClinicService[];
  serviceId: string | null;
  onSelect: (id: string) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const groups = SERVICE_CATEGORY_ORDER.map((category) => ({
    category,
    items: services.filter((service) => service.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div>
      <StepHeading
        headingRef={headingRef}
        title="Услуга"
        lead="Выберите, с чем прийти. Длительность и цену показываем сразу — их подтвердит администратор при звонке."
      />

      {groups.length === 0 ? (
        <p className="mt-6 max-w-[42ch] border-t border-line pt-5 text-small leading-relaxed text-text-muted">
          Каталог сейчас обновляют. Позвоните —{" "}
          <a href={`tel:${CONTACTS.phoneHref}`} className="link-underline text-text">
            {CONTACTS.phone}
          </a>
          , назовём цену и ближайшее время.
        </p>
      ) : (
        <fieldset className="mt-6 min-w-0">
          <legend className="sr-only">Услуга</legend>
          {groups.map((group) => (
            <div key={group.category} className="mt-7 first:mt-0">
              <p className="mono-label border-b border-line-strong pb-2 text-text-muted">{group.category}</p>
              <div className="border-t border-line">
                {group.items.map((service) => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    name="booking-service"
                    selected={service.id === serviceId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      )}
    </div>
  );
}
