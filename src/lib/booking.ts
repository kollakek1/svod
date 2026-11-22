/**
 * Логика записи: время в Europe/Moscow, сетка слотов, пересечения, коды броней,
 * телефоны, rate limit и общие HTTP-помощники API.
 *
 * Москва живёт в UTC+3 круглый год (перехода на летнее время нет), поэтому
 * «настенное» время считается сдвигом на 180 минут и никакой tz-библиотеки
 * не требуется. Снаружи — только строки: `YYYY-MM-DD` и `+03:00` в ISO.
 *
 * Модуль чистый: без I/O, без `node:`-импортов и без чтения env, поэтому
 * проверяется тестами напрямую и безопасен для клиентского бандла.
 * `now` всегда приходит аргументом — тесты не зависят от часов машины.
 */

import {
  BOOKING_CODE_ALPHABET,
  BOOKING_STATUS_LABELS,
  type AvailabilityDay,
  type Booking,
  type BookingStatus,
  type ClinicSettings,
  type DayHours,
  type Weekday,
} from "./clinic";

/* -------------------------------------------------------------------------- */
/* Время и часовой пояс                                                       */
/* -------------------------------------------------------------------------- */

/** Смещение Москвы от UTC в минутах. */
export const MOSCOW_OFFSET_MINUTES = 180;

export const TIMEZONE = "Europe/Moscow" as const;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** `+03:00` или `+0300`: других зон у клиники нет. */
const MOSCOW_ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::00)?(?:\.000)?(?:\+03:00|\+0300)$/;

const WEEKDAY_BY_INDEX: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export interface DateParts {
  year: number;
  month: number;
  /** 1–12 */
  day: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Строгий разбор `YYYY-MM-DD` с проверкой календаря.
 * `2026-02-30` вернёт `null`, а не «2 марта».
 */
export function parseDateKey(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 2020 || year > 2100) return null;

  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function formatDateKey(parts: DateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** День недели даты `YYYY-MM-DD`; `null` для битой даты. */
export function weekdayOfDateKey(dateKey: string): Weekday | null {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return WEEKDAY_BY_INDEX[utc.getUTCDay()] ?? null;
}

/** `2026-11-22` + 3 → `2026-11-25`. `null`, если дата битая. */
export function addDays(dateKey: string, days: number): string | null {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + days * MS_PER_DAY);
  return formatDateKey({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  });
}

/** Разница в календарных днях: `to - from`. `NaN`, если дата битая. */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return Number.NaN;
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / MS_PER_DAY);
}

/** `"HH:mm"` → минуты от полуночи; `null`, если формат неверный. */
export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Минуты от полуночи → `"HH:mm"`. */
export function formatMinutes(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

export interface MoscowNow {
  /** Сегодняшняя дата по Москве, `YYYY-MM-DD`. */
  dateKey: string;
  /** Минуты от полуночи по Москве, 0–1439. */
  minutesOfDay: number;
  /** Абсолютный момент времени, мс. */
  timestamp: number;
}

/** Текущее «настенное» время клиники для произвольного момента. */
export function moscowWallClock(instant: Date = new Date()): MoscowNow {
  const shifted = new Date(instant.getTime() + MOSCOW_OFFSET_MINUTES * MS_PER_MINUTE);
  return {
    dateKey: `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`,
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    timestamp: instant.getTime(),
  };
}

/** Абсолютный момент (мс) для московской даты и минут от полуночи. */
export function moscowInstantMs(dateKey: string, minutesOfDay: number): number | null {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  if (!Number.isFinite(minutesOfDay)) return null;
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day) +
    minutesOfDay * MS_PER_MINUTE -
    MOSCOW_OFFSET_MINUTES * MS_PER_MINUTE
  );
}

/** `2026-11-24`, 600 → `2026-11-24T10:00:00+03:00`. */
export function formatMoscowIso(dateKey: string, minutesOfDay: number): string | null {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  const ms = moscowInstantMs(dateKey, minutesOfDay);
  if (ms === null) return null;
  const shifted = new Date(ms + MOSCOW_OFFSET_MINUTES * MS_PER_MINUTE);
  const hours = shifted.getUTCHours();
  const minutes = shifted.getUTCMinutes();
  if (hours * 60 + minutes !== ((minutesOfDay % 1440) + 1440) % 1440) return null;
  return `${formatDateKey({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  })}T${pad2(hours)}:${pad2(minutes)}:00+03:00`;
}

/** Момент (мс) → `2026-11-24T11:30:00+03:00` (для `endsAt`). */
export function formatMoscowIsoFromMs(timestamp: number): string {
  const shifted = new Date(timestamp + MOSCOW_OFFSET_MINUTES * MS_PER_MINUTE);
  return `${formatDateKey({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  })}T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:00+03:00`;
}

export interface MoscowInstant {
  /** `YYYY-MM-DD` по Москве. */
  dateKey: string;
  /** Минуты от полуночи, 0–1439. */
  minutesOfDay: number;
  /** Абсолютный момент, мс. */
  timestamp: number;
}

/**
 * Разбор ISO-момента начала приёма.
 * Принимает `+03:00`, `+0300` и любой другой корректный ISO (тогда переводим
 * в московское время). Секунды и миллисекунды должны быть нулевыми:
 * сетка кратна минутам.
 */
export function parseMoscowInstant(value: string): MoscowInstant | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const direct = MOSCOW_ISO_PATTERN.exec(trimmed);
  if (direct) {
    const dateKey = `${direct[1]}-${direct[2]}-${direct[3]}`;
    const parts = parseDateKey(dateKey);
    if (!parts) return null;
    const minutesOfDay = Number(direct[4]) * 60 + Number(direct[5]);
    const timestamp = moscowInstantMs(dateKey, minutesOfDay);
    if (timestamp === null) return null;
    return { dateKey, minutesOfDay, timestamp };
  }

  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) return null;
  if (timestamp % MS_PER_MINUTE !== 0) return null;
  const wall = moscowWallClock(new Date(timestamp));
  return { dateKey: wall.dateKey, minutesOfDay: wall.minutesOfDay, timestamp };
}

/* -------------------------------------------------------------------------- */
/* Часы работы                                                                */
/* -------------------------------------------------------------------------- */

export interface OpenDay {
  opensAt: number;
  closesAt: number;
}

/** Открыт ли день в графике клиники; `null` — выходной или битые часы. */
export function openDay(hours: readonly DayHours[], weekday: Weekday): OpenDay | null {
  const day = hours.find((item) => item.weekday === weekday);
  if (!day || !day.opensAt || !day.closesAt) return null;
  const opensAt = parseTimeToMinutes(day.opensAt);
  const closesAt = parseTimeToMinutes(day.closesAt);
  if (opensAt === null || closesAt === null || closesAt <= opensAt) return null;
  return { opensAt, closesAt };
}

/* -------------------------------------------------------------------------- */
/* Сетка слотов                                                               */
/* -------------------------------------------------------------------------- */

export interface Schedule {
  settings: Pick<ClinicSettings, "slotStepMin" | "minLeadMinutes" | "horizonDays">;
  hours: readonly DayHours[];
}

/** Стартовые минуты сетки: от открытия, пока приём помещается до закрытия. */
export function gridStarts(day: OpenDay, durationMin: number, stepMin: number): number[] {
  const step = Number.isFinite(stepMin) && stepMin > 0 ? stepMin : 30;
  const duration = Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 0;
  const starts: number[] = [];
  for (let start = day.opensAt; start + duration <= day.closesAt; start += step) {
    starts.push(start);
  }
  return starts;
}

/** Занимает ли бронь время врача. `pending` держит слот: его ещё не подтвердили, но он уже обещан. */
export function occupiesSlot(status: BookingStatus): boolean {
  return status === "pending" || status === "confirmed";
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Интервал брони в абсолютных миллисекундах; `null`, если времена битые. */
export function bookingIntervalMs(booking: Booking): { startMs: number; endMs: number } | null {
  const startMs = Date.parse(booking.startsAt);
  if (!Number.isFinite(startMs)) return null;

  let endMs = Date.parse(booking.endsAt);
  const durationMs =
    Number.isFinite(booking.durationMin) && booking.durationMin > 0 ? booking.durationMin * MS_PER_MINUTE : 0;
  if (!Number.isFinite(endMs) || endMs <= startMs) {
    if (durationMs === 0) return null;
    endMs = startMs + durationMs;
  }
  return { startMs, endMs };
}

/**
 * Занят ли интервал у врача.
 * Бронь, которая заканчивается ровно к началу слота, слот не занимает.
 */
export function isSlotBusy(
  bookings: readonly Booking[],
  doctorId: string,
  startMs: number,
  endMs: number,
): boolean {
  return bookings.some((booking) => {
    if (booking.doctorId !== doctorId) return false;
    if (!occupiesSlot(booking.status)) return false;
    const interval = bookingIntervalMs(booking);
    if (!interval) return false;
    return intervalsOverlap(startMs, endMs, interval.startMs, interval.endMs);
  });
}

export interface DayAvailabilityInput {
  date: string;
  durationMin: number;
  doctorId: string;
  doctorWorkingDays: readonly Weekday[];
  schedule: Schedule;
  bookings: readonly Booking[];
  now: Date;
}

/**
 * Свободные старты одного дня (ISO-строки).
 *
 * Пустой массив возвращается для выходного, прошедшей даты, даты за горизонтом
 * и для дня, где всё занято: интерфейсу нужен список, а не ошибка.
 */
export function availableSlotsForDay(input: DayAvailabilityInput): string[] {
  const { date, durationMin, doctorId, doctorWorkingDays, schedule, bookings } = input;
  const now = input.now;

  const weekday = weekdayOfDateKey(date);
  if (weekday === null) return [];
  if (!doctorWorkingDays.includes(weekday)) return [];
  const day = openDay(schedule.hours, weekday);
  if (!day) return [];

  const wall = moscowWallClock(now);
  if (date < wall.dateKey) return [];
  const ahead = daysBetweenKeys(wall.dateKey, date);
  if (Number.isNaN(ahead) || ahead > schedule.settings.horizonDays) return [];

  const earliestStart = now.getTime() + schedule.settings.minLeadMinutes * MS_PER_MINUTE;
  const slots: string[] = [];

  for (const start of gridStarts(day, durationMin, schedule.settings.slotStepMin)) {
    const startMs = moscowInstantMs(date, start);
    if (startMs === null) continue;
    const endMs = startMs + durationMin * MS_PER_MINUTE;
    if (startMs < earliestStart) continue;
    if (isSlotBusy(bookings, doctorId, startMs, endMs)) continue;

    const iso = formatMoscowIso(date, start);
    if (iso) slots.push(iso);
  }

  return slots;
}

export interface AvailabilityInput extends Omit<DayAvailabilityInput, "date"> {
  /** Первая запрошенная дата, `YYYY-MM-DD`. */
  from: string;
  /** Сколько дней вернуть, включая `from`. */
  days: number;
}

/**
 * Все запрошенные даты, включая пустые: UI показывает закрытые дни явно,
 * а не «дырками» в календаре.
 */
export function availabilityDays(input: AvailabilityInput): AvailabilityDay[] {
  const result: AvailabilityDay[] = [];
  for (let index = 0; index < input.days; index += 1) {
    const date = addDays(input.from, index);
    if (!date) break;
    result.push({ date, slots: availableSlotsForDay({ ...input, date }) });
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Проверка конкретного слота (POST /api/booking)                             */
/* -------------------------------------------------------------------------- */

export type SlotRejectionReason =
  | "invalid_slot"
  | "slot_in_past"
  | "out_of_horizon"
  | "day_off"
  | "slot_taken";

export interface CheckSlotInput {
  startsAt: string;
  durationMin: number;
  doctorId: string;
  doctorWorkingDays: readonly Weekday[];
  schedule: Schedule;
  bookings: readonly Booking[];
  now: Date;
  /** Ручная запись администратора: лид-тайм не действует, прошедшее время — действует. */
  ignoreLeadTime?: boolean;
}

export type SlotCheck =
  | { ok: true; startMs: number; endMs: number; dateKey: string; minutesOfDay: number; iso: string }
  | { ok: false; reason: SlotRejectionReason; message: string };

/**
 * Серверная проверка присланного времени.
 * Клиент присылает только «когда»: длительность и границы берутся из каталога.
 */
export function checkSlot(input: CheckSlotInput): SlotCheck {
  const { durationMin, doctorId, doctorWorkingDays, schedule, bookings } = input;
  const now = input.now;

  const instant = parseMoscowInstant(input.startsAt);
  if (!instant) {
    return { ok: false, reason: "invalid_slot", message: "Время указано неверно" };
  }

  const weekday = weekdayOfDateKey(instant.dateKey);
  if (weekday === null) {
    return { ok: false, reason: "invalid_slot", message: "Дата указана неверно" };
  }

  const wall = moscowWallClock(now);
  if (instant.dateKey < wall.dateKey) {
    return { ok: false, reason: "slot_in_past", message: "Это время уже прошло" };
  }
  const ahead = daysBetweenKeys(wall.dateKey, instant.dateKey);
  if (Number.isNaN(ahead) || ahead > schedule.settings.horizonDays) {
    return {
      ok: false,
      reason: "out_of_horizon",
      message: `Запись открыта на ${schedule.settings.horizonDays} дней вперёд`,
    };
  }

  if (!doctorWorkingDays.includes(weekday)) {
    return { ok: false, reason: "day_off", message: "Врач не ведёт приём в этот день" };
  }
  const day = openDay(schedule.hours, weekday);
  if (!day) {
    return { ok: false, reason: "day_off", message: "Клиника не работает в этот день" };
  }

  const { minutesOfDay } = instant;
  if (minutesOfDay < day.opensAt || minutesOfDay + durationMin > day.closesAt) {
    return {
      ok: false,
      reason: "invalid_slot",
      message: `Приём такой длительности не помещается в часы работы (${formatMinutes(day.opensAt)}–${formatMinutes(day.closesAt)})`,
    };
  }
  const step = schedule.settings.slotStepMin;
  if ((minutesOfDay - day.opensAt) % step !== 0) {
    return {
      ok: false,
      reason: "invalid_slot",
      message: `Время должно быть кратно ${step} минутам от открытия`,
    };
  }

  const leadMinutes = input.ignoreLeadTime ? 0 : schedule.settings.minLeadMinutes;
  if (instant.timestamp < now.getTime() + leadMinutes * MS_PER_MINUTE) {
    return {
      ok: false,
      reason: "slot_in_past",
      message: input.ignoreLeadTime
        ? "Это время уже прошло"
        : `Ближайшая запись — не раньше чем через ${Math.round(leadMinutes / 60)} ч`,
    };
  }

  const endMs = instant.timestamp + durationMin * MS_PER_MINUTE;
  if (isSlotBusy(bookings, doctorId, instant.timestamp, endMs)) {
    return {
      ok: false,
      reason: "slot_taken",
      message: "Это время уже занято. Выберите другой слот",
    };
  }

  return {
    ok: true,
    startMs: instant.timestamp,
    endMs,
    dateKey: instant.dateKey,
    minutesOfDay,
    iso: formatMoscowIso(instant.dateKey, minutesOfDay) ?? input.startsAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Антиспам                                                                   */
/* -------------------------------------------------------------------------- */

/** Быстрее этого человек форму не заполнит. */
export const MIN_FORM_FILL_MS = 3_000;

export interface SpamSignal {
  /** Поле-ловушка: человек его не видит и не заполняет. */
  website?: string;
  /** Момент открытия формы, epoch ms. */
  formStartedAt?: number;
}

/**
 * Признаки бота.
 *
 * - `website` заполнен → бот;
 * - форма «заполнена» быстрее трёх секунд → бот;
 * - устаревшая или будущая метка ботом не считается: старая открытая вкладка —
 *   это нормальный человек, а блокировать его хуже, чем пропустить спамера.
 */
export function looksLikeSpam(signal: SpamSignal, now: number): boolean {
  if (typeof signal.website === "string" && signal.website.trim() !== "") return true;

  const startedAt = signal.formStartedAt;
  if (typeof startedAt === "number" && Number.isFinite(startedAt)) {
    const elapsed = now - startedAt;
    if (elapsed >= 0 && elapsed < MIN_FORM_FILL_MS) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Коды броней                                                                */
/* -------------------------------------------------------------------------- */

export type RandomIndex = (maxExclusive: number) => number;

/** Равномерное число без modulo-смещения; работает и в Node, и в браузере. */
export function cryptoRandomIndex(maxExclusive: number): number {
  const max = Math.max(1, Math.floor(maxExclusive));
  const bucket = Math.floor(65_536 / max) * max;
  const buffer = new Uint16Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < bucket) return value % max;
  }
}

/** Случайный код вида `SVD-7K3M`. Алфавит — из `clinic.ts`, без похожих символов. */
export function generateBookingCode(random: RandomIndex = cryptoRandomIndex): string {
  let suffix = "";
  for (let index = 0; index < 4; index += 1) {
    const letter = BOOKING_CODE_ALPHABET[random(BOOKING_CODE_ALPHABET.length)];
    suffix += letter ?? BOOKING_CODE_ALPHABET[0];
  }
  return `SVD-${suffix}`;
}

/** Код, которого ещё нет среди занятых. */
export function generateUniqueBookingCode(
  takenCodes: ReadonlySet<string>,
  options: { random?: RandomIndex; attempts?: number } = {},
): string {
  const random = options.random ?? cryptoRandomIndex;
  const attempts = options.attempts ?? 50;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = generateBookingCode(random);
    if (!takenCodes.has(code)) return code;
  }

  // 32^4 = 1 048 576 комбинаций: сюда можно попасть только при исчерпании.
  throw new Error("Не удалось сгенерировать уникальный код брони");
}

/* -------------------------------------------------------------------------- */
/* Телефон                                                                    */
/* -------------------------------------------------------------------------- */

const NATIONAL_PHONE_PATTERN = /^[3489]\d{9}$/;

/**
 * Приводит российский номер к `+7XXXXXXXXXX`.
 * Принимает `8 916 123-45-67`, `+7 (916) 123 45 67`, `9161234567`.
 * `null` — если номер не похож на российский.
 */
export function normalizePhone(input: string): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/\D+/g, "");
  let national: string;

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    national = digits.slice(1);
  } else if (digits.length === 10) {
    national = digits;
  } else {
    return null;
  }

  if (!NATIONAL_PHONE_PATTERN.test(national)) return null;
  // 9999999999 формально проходит шаблон, но это не номер.
  if (/^(\d)\1{9}$/.test(national)) return null;

  return `+7${national}`;
}

/** `+79161234567` → `+7 916 123-45-67`. */
export function formatPhoneForDisplay(phone: string): string {
  const national = phone.replace(/\D+/g, "").slice(-10);
  if (national.length !== 10) return phone;
  return `+7 ${national.slice(0, 3)} ${national.slice(3, 6)}-${national.slice(6, 8)}-${national.slice(8)}`;
}

/** Маска для публичных ответов: `+7 9•• ••• 45 67`. */
export function maskPhone(phone: string): string {
  const national = phone.replace(/\D+/g, "").slice(-10);
  if (national.length !== 10) return "+7 ••• ••• •• ••";
  return `+7 ${national.slice(0, 1)}•• ••• ${national.slice(6, 8)} ${national.slice(8)}`;
}

/* -------------------------------------------------------------------------- */
/* Статусы                                                                    */
/* -------------------------------------------------------------------------- */

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "pending",
  "confirmed",
  "done",
  "cancelled",
  "no-show",
];

export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && (BOOKING_STATUSES as readonly string[]).includes(value);
}

/**
 * Разрешённые переходы статусов.
 * Отменённую запись можно вернуть в работу (ошибка администратора), но только
 * если слот ещё свободен — проверка конфликта делается перед записью.
 * Из «принята» и «не пришёл» — только обратно в подтверждённые (исправление).
 */
const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["confirmed", "cancelled", "no-show"],
  confirmed: ["done", "cancelled", "no-show"],
  done: ["confirmed"],
  cancelled: ["pending", "confirmed"],
  "no-show": ["confirmed"],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function bookingTransitionMessage(from: BookingStatus, to: BookingStatus): string {
  if (from === to) return "Статус не изменился";
  return `Нельзя перевести запись из «${BOOKING_STATUS_LABELS[from]}» в «${BOOKING_STATUS_LABELS[to]}»`;
}

/* -------------------------------------------------------------------------- */
/* Месяцы и диапазоны (админка)                                               */
/* -------------------------------------------------------------------------- */

export interface MonthParts {
  year: number;
  month: number;
}

/** `"2026-11"` → `{ year: 2026, month: 11 }`; `null` для мусора. */
export function parseMonthKey(value: string): MonthParts | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100) return null;
  return { year, month };
}

/** Все даты месяца в формате `YYYY-MM-DD`. */
export function monthDateKeys(month: MonthParts): string[] {
  const daysInMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const keys: string[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    keys.push(formatDateKey({ year: month.year, month: month.month, day }));
  }
  return keys;
}

/** Границы месяца для выборки броней. */
export function monthRange(month: MonthParts): { from: string; to: string } {
  const keys = monthDateKeys(month);
  const first = keys[0] ?? formatDateKey({ year: month.year, month: month.month, day: 1 });
  const last = keys[keys.length - 1] ?? first;
  return { from: first, to: last };
}

/** Длина диапазона включительно; `null`, если даты битые. */
export function rangeLengthDays(from: string, to: string): number | null {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (!start || !end) return null;
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtc - startUtc) / MS_PER_DAY) + 1;
}

/* -------------------------------------------------------------------------- */
/* Rate limit                                                                 */
/* -------------------------------------------------------------------------- */

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /** Страховка от роста Map: при переполнении чистим самые старые ключи. */
  maxKeys?: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export interface RateLimiter {
  check(key: string, now?: Date): RateLimitDecision;
  reset(key: string): void;
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs, maxKeys = 5_000 } = options;
  const hits = new Map<string, number[]>();

  function prune(reference: number): void {
    for (const [key, timestamps] of hits) {
      if (timestamps.every((timestamp) => timestamp <= reference)) hits.delete(key);
    }
    if (hits.size <= maxKeys) return;
    for (const key of hits.keys()) {
      hits.delete(key);
      if (hits.size <= maxKeys) break;
    }
  }

  return {
    check(key, now = new Date()) {
      const nowMs = now.getTime();
      const windowStart = nowMs - windowMs;
      const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

      if (recent.length >= limit) {
        const oldest = recent[0] ?? nowMs;
        hits.set(key, recent);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000)),
        };
      }

      recent.push(nowMs);
      hits.set(key, recent);
      if (hits.size > maxKeys) prune(windowStart);
      return { allowed: true, remaining: limit - recent.length, retryAfterSec: 0 };
    },

    reset(key) {
      hits.delete(key);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP-помощники для route handlers                                          */
/* -------------------------------------------------------------------------- */

export type ApiErrorCode =
  | "invalid_request"
  | "unknown_service"
  | "unknown_doctor"
  | "doctor_not_assigned"
  | "invalid_slot"
  | "slot_in_past"
  | "out_of_horizon"
  | "day_off"
  | "slot_taken"
  | "rate_limited"
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "email_taken"
  | "last_owner"
  | "self_deactivate"
  | "invalid_password"
  | "invalid_status"
  | "invalid_transition"
  | "service_has_bookings"
  | "doctor_in_use"
  | "doctor_ids_invalid"
  | "slug_taken"
  | "storage_unavailable"
  | "not_configured"
  | "server_error";

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
  /** Поле → текст ошибки. Ключи — как в теле запроса. */
  fields?: Record<string, string>;
  details?: Record<string, unknown>;
}

export interface ErrorOptions {
  fields?: Record<string, string>;
  details?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export function jsonResponse<T>(body: T, status = 200, headers?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

export function errorResponse(
  status: number,
  error: ApiErrorCode,
  message: string,
  options: ErrorOptions = {},
): Response {
  const body: ApiErrorBody = { error, message };
  if (options.fields && Object.keys(options.fields).length > 0) body.fields = options.fields;
  if (options.details !== undefined) body.details = options.details;
  return jsonResponse(body, status, options.headers);
}

interface ValidationIssue {
  path: readonly PropertyKey[];
  message: string;
}

/** Ошибка валидации: `error` + карта полей. Ключ `patient.phone` сокращается до `phone`. */
export function validationErrorResponse(issues: readonly ValidationIssue[], status = 400): Response {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join(".").replace(/^patient\./, "");
    const key = path.length > 0 ? path : "_";
    if (!(key in fields)) fields[key] = issue.message;
  }
  const first = issues[0]?.message ?? "Проверьте данные запроса";
  return errorResponse(status, "invalid_request", first, { fields });
}

/**
 * IP клиента.
 *
 * Порядок доверия — от самого надёжного источника к наименее:
 * 1. `x-vercel-forwarded-for` — ставит Vercel, клиент его не контролирует;
 * 2. `x-real-ip` — обычно отдаёт обратный прокси;
 * 3. **последний** адрес `x-forwarded-for` — его дописывает ближайший прокси;
 *    первый адрес подделывается клиентом, поэтому брать его нельзя;
 * 4. `unknown` — общий бакет для запросов без IP.
 */
export function clientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  const vercelIp = vercel?.split(",").pop()?.trim();
  if (vercelIp) return vercelIp;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").pop()?.trim();
    if (last) return last;
  }

  return "unknown";
}
