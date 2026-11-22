"use client";

import { useState, type RefObject } from "react";

import { CONTACTS } from "@/content/clinic";
import type { ClinicDoctor, ClinicService } from "@/lib/clinic";
import { pluralRu } from "@/lib/format";
import { cn } from "@/lib/utils";

import { initialsOf, workingDaysLabel } from "./booking-utils";
import { StepHeading } from "./step-heading";

function DoctorRow({
  doctor,
  selected,
  onSelect,
}: {
  doctor: ClinicDoctor;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoSrc = doctor.photo ?? null;
  const showPhoto = Boolean(photoSrc) && !photoFailed;

  return (
    <label
      className={cn(
        "group relative flex min-h-11 cursor-pointer items-stretch gap-4 border-b border-line border-l-2 border-l-transparent py-4 pl-3 pr-2 transition-colors duration-200 sm:pl-4",
        "hover:bg-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-focus",
        selected && "border-l-accent bg-bg",
      )}
    >
      <input
        type="radio"
        name="booking-doctor"
        value={doctor.id}
        checked={selected}
        onChange={() => onSelect(doctor.id)}
        className="sr-only"
      />

      <span className="relative block h-24 w-[4.75rem] shrink-0 overflow-hidden border border-line bg-surface-2 sm:h-28 sm:w-[5.5rem]">
        {showPhoto && photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- фото из /public с фолбэком на плиту
          <img
            src={photoSrc}
            alt={`${doctor.name} — ${doctor.role}`}
            width={320}
            height={400}
            loading="lazy"
            decoding="async"
            onError={() => setPhotoFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-1">
            <span className="display text-lg leading-none text-text-muted" aria-hidden="true">
              {initialsOf(doctor.name)}
            </span>
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[1.0625rem] font-medium leading-snug text-text">{doctor.name}</span>
          <span className="mono-label tnum shrink-0 text-text-muted">
            {doctor.years} {pluralRu(doctor.years, ["год", "года", "лет"])}
          </span>
        </span>
        <span className="mt-0.5 block text-small text-text-muted">{doctor.role}</span>
        <span className="mt-1 block text-small leading-snug text-text-muted">{doctor.focus}</span>
        <span className="mono-label mt-2 block text-text-muted">Принимает: {workingDaysLabel(doctor.workingDays)}</span>
      </span>

      <span
        aria-hidden="true"
        className={cn(
          "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
          selected ? "border-accent" : "border-control-border group-hover:border-line-strong",
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full transition-colors duration-200", selected ? "bg-accent" : "bg-transparent")} />
      </span>
    </label>
  );
}

/** Шаг 2 — врач. Только те, кто выполняет выбранную услугу. */
export function DoctorStep({
  doctors,
  selectedDoctorId,
  service,
  onSelect,
  headingRef,
}: {
  doctors: ClinicDoctor[];
  selectedDoctorId: string | null;
  service: ClinicService | null;
  onSelect: (id: string) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const lead = service
    ? `Услугу «${service.name}» ведут ${doctors.length} ${pluralRu(doctors.length, ["врач", "врача", "врачей"])}. Ведёт вас один врач: он знает историю и снимки.`
    : "Сначала выберите услугу — покажем тех, кто её выполняет.";

  return (
    <div>
      <StepHeading headingRef={headingRef} title="Врач" lead={lead} />

      {doctors.length === 0 ? (
        <p className="mt-6 max-w-[42ch] border-t border-line pt-5 text-small leading-relaxed text-text-muted">
          Эту услугу пока некому вести онлайн. Позвоните —{" "}
          <a href={`tel:${CONTACTS.phoneHref}`} className="link-underline text-text">
            {CONTACTS.phone}
          </a>
          , подберём врача и время.
        </p>
      ) : (
        <fieldset className="mt-6 min-w-0">
          <legend className="sr-only">Врач</legend>
          <div className="border-t border-line">
            {doctors.map((doctor) => (
              <DoctorRow
                key={doctor.id}
                doctor={doctor}
                selected={doctor.id === selectedDoctorId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
