"use client";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";

import { bookingCountLabel, formatDateKey } from "./date";
import type { AdminBooking } from "./types";
import { SkeletonRows, StatusText } from "./ui";

/** Список записей выбранного дня. Под календарём и в правой колонке на десктопе. */
export function DayAgenda({
  date,
  bookings,
  loading,
  activeCode,
  onSelect,
  onAdd,
}: {
  date: string;
  bookings: readonly AdminBooking[];
  loading: boolean;
  activeCode: string | null;
  onSelect: (booking: AdminBooking) => void;
  onAdd: () => void;
}) {
  return (
    <section aria-labelledby="agenda-title" className="min-w-0">
      <div className="flex items-start justify-between gap-3 border-t border-line-strong pt-4">
        <div className="min-w-0">
          <p className="mono-label text-text-muted">День</p>
          <h2
            id="agenda-title"
            className="mt-1.5 font-display text-[1.5rem] leading-[1.1] tracking-[-0.01em] text-text"
          >
            {formatDateKey(date)}
          </h2>
          <p className="mt-1 text-small text-text-muted">
            {loading ? "Загружаем записи" : bookingCountLabel(bookings.length)}
          </p>
        </div>
        {loading || bookings.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 shrink-0"
            onClick={onAdd}
          >
            Добавить
          </Button>
        ) : null}
      </div>

      {loading ? (
        <SkeletonRows rows={3} className="mt-3" />
      ) : bookings.length === 0 ? (
        <div className="mt-3 border-t border-line py-8">
          <p className="text-[0.9375rem] text-text">На этот день записей нет</p>
          <p className="mt-1 text-small text-text-muted">
            Свободное время можно занять вручную — у ресепшена или по телефону.
          </p>
          <Button type="button" size="md" className="mt-5" onClick={onAdd}>
            Добавить запись
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          {bookings.map((booking) => {
            const active = booking.code === activeCode;
            return (
              <button
                key={booking.code}
                id={`booking-row-${booking.code}`}
                type="button"
                className="admin-row"
                data-active={active}
                aria-current={active ? "true" : undefined}
                aria-label={`${formatTime(booking.startsAt)}, ${booking.patient.name}, ${booking.serviceName}, ${booking.doctorName}`}
                onClick={() => onSelect(booking)}
              >
                <span className="tnum pt-0.5 font-mono text-[0.8125rem] leading-none text-text">
                  {formatTime(booking.startsAt)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem] leading-tight text-text">
                    {booking.patient.name}
                  </span>
                  <span className="mt-1 block truncate text-[0.8125rem] leading-tight text-text-muted">
                    {booking.serviceName} · {booking.doctorName}
                  </span>
                </span>
                <StatusText status={booking.status} className="justify-self-end pt-0.5" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
