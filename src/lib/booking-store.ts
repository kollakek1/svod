/**
 * Брони: нормализация и операции поверх слоя хранения.
 *
 * Драйвер (`storage/`) решает, где лежат данные — файл `.data/bookings.json`
 * локально или строка `bookings` в Postgres на проде. Здесь только модель:
 * разбор записей, атомарные мутации, статусы и представления для API.
 *
 * Атомарность записи: проверка слота и вставка живут в одной критической секции
 * (`withLockedDocument`). Вне её проверять время бессмысленно — между проверкой
 * и записью слот может занять другой гость.
 *
 * Только серверный модуль.
 */

import {
  bookingIntervalMs,
  canTransitionBooking,
  checkSlot,
  formatMoscowIsoFromMs,
  generateUniqueBookingCode,
  isBookingStatus,
  isSlotBusy,
  occupiesSlot,
  type Schedule,
  type SlotRejectionReason,
} from "./booking";
import {
  BOOKING_STATUS_LABELS,
  type Booking,
  type BookingHistoryEntry,
  type BookingPatient,
  type BookingStatus,
  type ClinicDoctor,
  type ClinicService,
} from "./clinic";
import { getStorage } from "./storage";

const DOCUMENT_NAME = "bookings" as const;

/* -------------------------------------------------------------------------- */
/* Модель                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Бронь в хранилище: контракт `Booking` плюс внутренняя заметка администратора.
 * `note` не входит в публичные ответы и не меняет тип из `clinic.ts`.
 */
export type StoredBooking = Booking & { note?: string | null };

/** Полная карточка для админки: телефон целиком, комментарий, заметка, история. */
export type AdminBooking = Booking & { note: string | null };

/** Публичная карточка: ни телефона, ни комментария, ни заметки. */
export interface PublicBooking {
  code: string;
  serviceName: string;
  doctorName: string;
  startsAt: string;
  endsAt: string;
  priceRub: number;
  /** «от» для услуг с плавающей ценой: нужно на экране успеха. */
  priceFrom?: boolean;
  status: BookingStatus;
}

/** Ответ на создание: то же плюс длительность, которую подтвердил сервер. */
export interface BookingConfirmation extends PublicBooking {
  durationMin: number;
}

/* -------------------------------------------------------------------------- */
/* Разбор и нормализация                                                     */
/* -------------------------------------------------------------------------- */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePatient(value: unknown): BookingPatient | null {
  if (!isPlainObject(value)) return null;
  const name = asString(value.name);
  const phone = asString(value.phone);
  if (!name || !phone) return null;

  const patient: BookingPatient = { name, phone };
  const email = asString(value.email);
  const comment = asString(value.comment);
  if (email) patient.email = email;
  if (comment) patient.comment = comment;
  return patient;
}

function normalizeHistory(
  value: unknown,
  fallback: { at: string; status: BookingStatus; by: string },
): BookingHistoryEntry[] {
  const entries: BookingHistoryEntry[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isPlainObject(item)) continue;
      const at = asString(item.at);
      if (!at) continue;
      const entry: BookingHistoryEntry = {
        at,
        by: asString(item.by) ?? fallback.by,
        note: typeof item.note === "string" ? item.note : "",
      };
      if (isBookingStatus(item.status)) entry.status = item.status;
      entries.push(entry);
    }
  }

  if (entries.length > 0) return entries;
  return [{ at: fallback.at, by: fallback.by, note: "Бронь создана", status: fallback.status }];
}

/** Строгая проверка каркаса: одна битая запись не должна ломать список. */
function normalizeBooking(value: unknown): StoredBooking | null {
  if (!isPlainObject(value)) return null;

  const code = asString(value.code);
  const serviceId = asString(value.serviceId);
  const doctorId = asString(value.doctorId);
  const serviceName = asString(value.serviceName);
  const doctorName = asString(value.doctorName);
  const startsAt = asString(value.startsAt);
  const endsAt = asString(value.endsAt);
  const durationMin = asNumber(value.durationMin);
  const priceRub = asNumber(value.priceRub);
  const patient = normalizePatient(value.patient);
  const status = isBookingStatus(value.status) ? value.status : null;
  const createdAt = asString(value.createdAt);

  if (!code || !serviceId || !doctorId || !serviceName || !doctorName) return null;
  if (!startsAt || !endsAt || durationMin === null || priceRub === null) return null;
  if (!patient || !status || !createdAt) return null;

  const source: Booking["source"] = value.source === "admin" ? "admin" : "site";
  const updatedAt = asString(value.updatedAt) ?? createdAt;
  const consentAt = asString(value.consentAt) ?? createdAt;

  return {
    code,
    serviceId,
    serviceName,
    doctorId,
    doctorName,
    startsAt,
    endsAt,
    durationMin,
    priceRub,
    patient,
    status,
    source,
    consentAt,
    createdAt,
    updatedAt,
    note: typeof value.note === "string" ? value.note : null,
    history: normalizeHistory(value.history, {
      at: createdAt,
      status,
      by: source === "admin" ? "admin" : "site",
    }),
  };
}

/**
 * Документ → список броней. Поддерживаем массив (контракт) и `{ bookings: [] }`
 * на случай ручной правки. Дубли кодов отбрасываем, оставляя первое вхождение.
 */
function normalizeDocument(value: unknown): StoredBooking[] {
  const list = Array.isArray(value)
    ? value
    : isPlainObject(value) && Array.isArray(value.bookings)
      ? value.bookings
      : null;
  if (list === null) return [];

  const seen = new Set<string>();
  const bookings: StoredBooking[] = [];
  for (const item of list) {
    const record = normalizeBooking(item);
    if (!record) continue;
    const code = record.code.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    bookings.push(record);
  }
  return bookings;
}

/* -------------------------------------------------------------------------- */
/* Чтение                                                                    */
/* -------------------------------------------------------------------------- */

/** Все брони, включая отменённые. */
export async function listBookings(): Promise<StoredBooking[]> {
  const storage = await getStorage();
  return normalizeDocument(await storage.getDocument<unknown>(DOCUMENT_NAME));
}

/** Бронь по коду; регистр не важен. */
export async function findBookingByCode(code: string): Promise<StoredBooking | undefined> {
  const normalized = code.trim().toUpperCase();
  const bookings = await listBookings();
  return bookings.find((booking) => booking.code.toUpperCase() === normalized);
}

/**
 * Атомарное «прочитать → изменить → записать».
 * Вся проверка конфликтов и уникальности кода должна происходить внутри `mutator`.
 */
async function mutateBookings<T>(
  mutator: (
    bookings: StoredBooking[],
  ) => { bookings?: readonly StoredBooking[]; value: T } | Promise<{ bookings?: readonly StoredBooking[]; value: T }>,
): Promise<T> {
  const storage = await getStorage();

  return storage.withLockedDocument<unknown, T>(DOCUMENT_NAME, async (current) => {
    const bookings = normalizeDocument(current);
    const outcome = await mutator(bookings);
    return {
      next: outcome.bookings ? [...outcome.bookings] : bookings,
      result: outcome.value,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Создание                                                                  */
/* -------------------------------------------------------------------------- */

export interface CreateBookingInput {
  service: ClinicService;
  doctor: ClinicDoctor;
  /** ISO 8601 с зоной (`+03:00`), как пришло от клиента. */
  startsAt: string;
  patient: { name: string; phone: string; email?: string; comment?: string };
  schedule: Schedule;
  source: "site" | "admin";
  /** Сайт всегда создаёт `pending`; админка может сразу подтвердить. */
  status?: Extract<BookingStatus, "pending" | "confirmed">;
  note?: string | null;
  /** Кто создал: `site` или email сотрудника. */
  actor: string;
  now: Date;
  /** Ручная запись: лид-тайм не действует. */
  ignoreLeadTime?: boolean;
}

export type CreateBookingResult =
  | { ok: true; booking: StoredBooking }
  | { ok: false; reason: SlotRejectionReason; message: string };

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { service, doctor, schedule } = input;

  return mutateBookings<CreateBookingResult>((bookings) => {
    // Пересечение проверяется повторно внутри блокировки: до неё состояние
    // могло измениться, и «свободный» слот уже занят.
    const check = checkSlot({
      startsAt: input.startsAt,
      durationMin: service.durationMin,
      doctorId: doctor.id,
      doctorWorkingDays: doctor.workingDays,
      schedule,
      bookings,
      now: input.now,
      ignoreLeadTime: input.ignoreLeadTime,
    });

    if (!check.ok) {
      return { value: { ok: false, reason: check.reason, message: check.message } };
    }

    const status: BookingStatus =
      input.status ?? (input.source === "site" ? "pending" : "confirmed");
    const takenCodes = new Set(bookings.map((booking) => booking.code.toUpperCase()));
    const createdAt = new Date().toISOString();

    const record: StoredBooking = {
      code: generateUniqueBookingCode(takenCodes),
      serviceId: service.id,
      serviceName: service.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      startsAt: check.iso,
      endsAt: formatMoscowIsoFromMs(check.endMs),
      durationMin: service.durationMin,
      priceRub: service.priceRub,
      patient: {
        name: input.patient.name,
        phone: input.patient.phone,
        ...(input.patient.email ? { email: input.patient.email } : {}),
        ...(input.patient.comment ? { comment: input.patient.comment } : {}),
      },
      status,
      source: input.source,
      consentAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      note: input.note ?? null,
      history: [
        {
          at: createdAt,
          by: input.actor,
          note: input.source === "site" ? "Заявка с сайта" : "Запись создана администратором",
          status,
        },
      ],
    };

    return { bookings: [...bookings, record], value: { ok: true, booking: record } };
  });
}

/* -------------------------------------------------------------------------- */
/* Изменение статуса и заметки                                                */
/* -------------------------------------------------------------------------- */

export type UpdateBookingResult =
  | { ok: true; booking: StoredBooking }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_transition"; message: string }
  | { ok: false; reason: "slot_taken"; message: string };

export interface UpdateBookingInput {
  status?: BookingStatus;
  /** `null` стирает заметку, `undefined` — не менять. */
  note?: string | null;
  actor: string;
  now: Date;
}

export async function updateBooking(
  code: string,
  input: UpdateBookingInput,
): Promise<UpdateBookingResult> {
  const normalized = code.trim().toUpperCase();

  return mutateBookings<UpdateBookingResult>((bookings) => {
    const index = bookings.findIndex((booking) => booking.code.toUpperCase() === normalized);
    const current = bookings[index];
    if (index === -1 || !current) return { value: { ok: false, reason: "not_found" } };

    const target = input.status ?? current.status;
    if (!canTransitionBooking(current.status, target)) {
      return {
        value: {
          ok: false,
          reason: "invalid_transition",
          message: `Статус «${BOOKING_STATUS_LABELS[current.status]}» нельзя сменить на «${BOOKING_STATUS_LABELS[target]}»`,
        },
      };
    }

    // Возврат в расписание занимает слот — проверяем, что время ещё свободно.
    if (!occupiesSlot(current.status) && occupiesSlot(target)) {
      const interval = bookingIntervalMs(current);
      const others = bookings.filter((booking) => booking.code.toUpperCase() !== normalized);
      if (interval && isSlotBusy(others, current.doctorId, interval.startMs, interval.endMs)) {
        return {
          value: {
            ok: false,
            reason: "slot_taken",
            message: "Это время уже занято другой бронью: сначала разберите её",
          },
        };
      }
    }

    const statusChanged = target !== current.status;
    const noteChanged = input.note !== undefined && input.note !== (current.note ?? null);
    const at = new Date().toISOString();

    const updated: StoredBooking = {
      ...current,
      status: target,
      note: input.note === undefined ? (current.note ?? null) : input.note,
      updatedAt: at,
      history:
        statusChanged || noteChanged
          ? [
              ...current.history,
              {
                at,
                by: input.actor,
                status: target,
                note: statusChanged
                  ? input.note?.trim()
                    ? `Статус: ${BOOKING_STATUS_LABELS[target]} · ${input.note.trim()}`
                    : `Статус: ${BOOKING_STATUS_LABELS[target]}`
                  : "Заметка обновлена",
              },
            ]
          : current.history,
    };

    const next = [...bookings];
    next[index] = updated;
    return { bookings: next, value: { ok: true, booking: updated } };
  });
}

/* -------------------------------------------------------------------------- */
/* Представления                                                             */
/* -------------------------------------------------------------------------- */

export function toPublicBooking(booking: Booking): PublicBooking {
  return {
    code: booking.code,
    serviceName: booking.serviceName,
    doctorName: booking.doctorName,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    priceRub: booking.priceRub,
    status: booking.status,
  };
}

export function toBookingConfirmation(booking: Booking): BookingConfirmation {
  return { ...toPublicBooking(booking), durationMin: booking.durationMin };
}

export function toAdminBooking(booking: StoredBooking): AdminBooking {
  return { ...booking, note: booking.note ?? null };
}

/* -------------------------------------------------------------------------- */
/* Гарды каталога                                                            */
/* -------------------------------------------------------------------------- */

export interface FutureBookingRef {
  code: string;
  /** `YYYY-MM-DD` по Москве. */
  date: string;
  startsAt: string;
  name: string;
  serviceName: string;
  doctorName: string;
}

/**
 * Будущие брони, которые держат слот (`pending` + `confirmed`) и подходят под
 * предикат. Именно они запрещают удалять услугу или врача: гость пришёл бы
 * в пустоту.
 */
export function futureBookings(
  bookings: readonly Booking[],
  match: (booking: Booking) => boolean,
  now: Date = new Date(),
): FutureBookingRef[] {
  const nowMs = now.getTime();

  return bookings
    .filter((booking) => {
      if (!occupiesSlot(booking.status)) return false;
      if (!match(booking)) return false;
      const startMs = Date.parse(booking.startsAt);
      return Number.isFinite(startMs) && startMs > nowMs;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((booking) => ({
      code: booking.code,
      date: booking.startsAt.slice(0, 10),
      startsAt: booking.startsAt,
      name: booking.patient.name,
      serviceName: booking.serviceName,
      doctorName: booking.doctorName,
    }));
}
