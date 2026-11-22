import { formatDay, formatDayWithWeekday, formatTime, moscowDateKey, pluralRu } from "@/lib/format";

/**
 * Даты админки. Все ключи — `YYYY-MM-DD` по Москве, как в API.
 * Локальные даты парсим в полдень по Москве, чтобы сдвиг зоны не перекинул день.
 */

const MONTH_LONG = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  month: "long",
  year: "numeric",
});
const WEEKDAY_SHORT = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  weekday: "short",
});
const TIME = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  hour: "2-digit",
  minute: "2-digit",
});

export const WEEKDAY_HEADERS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

export function todayKey(): string {
  return moscowDateKey(new Date());
}

export function monthOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function monthLabel(monthKey: string): string {
  const value = MONTH_LONG.format(new Date(`${monthKey}-15T12:00:00+03:00`)).replace(" г.", "");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function currentMonthLabel(): string {
  return monthLabel(monthOf(todayKey()));
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Понедельник = 0 … воскресенье = 6. */
export function weekdayIndex(dateKey: string): number {
  return (new Date(`${dateKey}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function weekdayShort(dateKey: string): string {
  return WEEKDAY_SHORT.format(new Date(`${dateKey}T12:00:00+03:00`)).replace(".", "");
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** «24 ноября, пн» — для заголовка дня. */
export function formatDateKey(dateKey: string): string {
  return formatDayWithWeekday(`${dateKey}T12:00:00+03:00`);
}

/** «24 ноября» — для списков и подписей. */
export function formatDateKeyShort(dateKey: string): string {
  return formatDay(`${dateKey}T12:00:00+03:00`);
}

/** «24» — крупное число в сетке. */
export function dayNumber(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

export function formatSlotRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatDateKeyShort(moscowDateKey(date))}, ${TIME.format(date)}`;
}

export function bookingCountLabel(count: number): string {
  return `${count} ${pluralRu(count, ["запись", "записи", "записей"])}`;
}
