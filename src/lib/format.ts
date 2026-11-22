const RUB = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function formatRub(value: number): string {
  return `${RUB.format(Math.round(value))} ₽`;
}

/** 90 → «1 ч 30 мин», 45 → «45 мин», 120 → «2 ч». */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

/** Только цифры, приведённые к +7XXXXXXXXXX. Возвращает null, если номер неполный. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length !== 11 || !digits.startsWith("7")) return null;
  return `+${digits}`;
}

/** Маска для ввода: +7 999 123-45-67. Не бросает курсор: работает по цифрам. */
export function maskPhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith("7")) digits = `7${digits}`;
  digits = digits.slice(0, 11);

  const parts = ["+7"];
  if (digits.length > 1) parts.push(` ${digits.slice(1, 4)}`);
  if (digits.length > 4) parts.push(` ${digits.slice(4, 7)}`);
  if (digits.length > 7) parts.push(`-${digits.slice(7, 9)}`);
  if (digits.length > 9) parts.push(`-${digits.slice(9, 11)}`);
  return parts.join("");
}

export function formatPhoneDisplay(e164: string): string {
  return maskPhone(e164);
}

const DAY_LONG = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long" });
const DAY_WITH_WEEKDAY = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "numeric",
  month: "long",
  weekday: "short",
});
const TIME = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });

/** «24 ноября» */
export function formatDay(iso: string): string {
  return DAY_LONG.format(new Date(iso));
}

/** «24 ноября, пн» */
export function formatDayWithWeekday(iso: string): string {
  return DAY_WITH_WEEKDAY.format(new Date(iso)).replace(" г.", "");
}

/** «10:00» */
export function formatTime(iso: string): string {
  return TIME.format(new Date(iso));
}

export function pluralRu(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** «3 визита», «1 визит», «5 визитов» */
export function formatVisits(count: number): string {
  return `${count} ${pluralRu(count, ["визит", "визита", "визитов"])}`;
}

/** Локальная дата в Москве в формате YYYY-MM-DD. */
export function moscowDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
