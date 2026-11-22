"use client";

import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { CONTACTS } from "@/content/clinic";
import { formatDayWithWeekday, formatDuration, formatRub, formatTime } from "@/lib/format";

import type { BookingConfirmation } from "./types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-line py-3">
      <dt className="mono-label text-text-muted">{label}</dt>
      <dd className="max-w-[70%] text-right text-small leading-snug text-text">{value}</dd>
    </div>
  );
}

/** Экран успеха: код, детали и честное «что дальше». */
export function BookingSuccess({
  booking,
  onReset,
  headingRef,
}: {
  booking: BookingConfirmation;
  onReset: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="max-w-[40rem]">
      <p className="mono-label text-accent-text">Запись создана</p>

      <h3 ref={headingRef} tabIndex={-1} className="display mt-3 scroll-mt-24 text-h1 text-text focus:outline-none">
        Вы записаны
      </h3>

      <p className="mt-6 text-small text-text-muted">Код записи — назовите его при звонке или на ресепшене.</p>
      <p className="display mt-1 text-[clamp(2.15rem,5vw,3.25rem)] leading-none tracking-[0.05em] tnum text-text">
        {booking.code}
      </p>

      <dl className="mt-8 border-b border-line">
        <Row label="Услуга" value={booking.serviceName} />
        <Row label="Врач" value={booking.doctorName} />
        <Row label="Дата" value={formatDayWithWeekday(booking.startsAt)} />
        <Row label="Время" value={`${formatTime(booking.startsAt)} · ${formatDuration(booking.durationMin)}`} />
        <Row
          label="Итог"
          value={booking.priceFrom ? `от ${formatRub(booking.priceRub)}` : formatRub(booking.priceRub)}
        />
      </dl>

      <p className="mt-5 max-w-[46ch] text-small leading-relaxed text-text-muted">
        Администратор позвонит в течение 15 минут в рабочие часы, чтобы подтвердить время. Если планы изменятся —
        предупредите за 6 часов.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="button" size="lg" onClick={onReset} className="w-full sm:w-auto">
          Записать ещё
        </Button>
        <Button asChild variant="quiet" size="lg" className="w-full sm:w-auto">
          <a href={`tel:${CONTACTS.phoneHref}`}>Позвонить в клинику</a>
        </Button>
      </div>

      <p className="mt-5 text-small text-text-muted">
        Условия обработки данных — в{" "}
        <a href="/privacy" className="link-underline text-text">
          политике конфиденциальности
        </a>
        .
      </p>
    </div>
  );
}
