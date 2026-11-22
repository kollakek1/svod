"use client";

import { bookingCountLabel, dayNumber, formatDateKey, monthLabel, WEEKDAY_HEADERS, weekdayIndex } from "./date";
import type { CalendarDay } from "./types";

/**
 * Сетка месяца: 7 колонок, волосяные линии, счётчик записей.
 * Сегодня — внутренняя рамка, выбранный день — заливка ink.
 */
export function MonthGrid({
  month,
  days,
  selectedDate,
  today,
  onSelect,
}: {
  month: string;
  days: readonly CalendarDay[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const firstDate = days[0]?.date ?? `${month}-01`;
  const leading = weekdayIndex(firstDate);
  const total = leading + days.length;
  const trailing = (7 - (total % 7)) % 7;

  return (
    <div className="admin-month" role="group" aria-label={`Дни месяца, ${monthLabel(month)}`}>
      {WEEKDAY_HEADERS.map((label) => (
        <div key={label} className="admin-weekday" aria-hidden="true">
          {label}
        </div>
      ))}

      {Array.from({ length: leading }, (_, index) => (
        <div key={`blank-${index}`} className="admin-day admin-day--blank" aria-hidden="true" />
      ))}

      {days.map((day) => {
        const selected = day.date === selectedDate;
        const countLabel = day.count > 0 ? bookingCountLabel(day.count) : "записей нет";

        return (
          <button
            key={day.date}
            type="button"
            className="admin-day"
            aria-pressed={selected}
            aria-label={`${formatDateKey(day.date)}, ${countLabel}`}
            data-today={day.date === today}
            onClick={() => onSelect(day.date)}
          >
            <span className="admin-day-num">{dayNumber(day.date)}</span>
            {day.count > 0 ? (
              <span className="admin-day-count" aria-hidden="true">
                {day.count}
              </span>
            ) : null}
          </button>
        );
      })}

      {Array.from({ length: trailing }, (_, index) => (
        <div key={`tail-${index}`} className="admin-day admin-day--blank" aria-hidden="true" />
      ))}
    </div>
  );
}
