/**
 * Контракты админки на клиенте.
 *
 * Повторяют ответы `/api/admin/*` один в один. Серверные типы (`booking-store`)
 * сюда не импортируются: файл попадает в клиентский бандл, а рядом с бронями
 * живёт хранилище.
 */

import type { AdminUser, AvailabilityResponse, Booking, Catalog } from "@/lib/clinic";

export type { AdminUser, AvailabilityResponse, Catalog };

/** Полная карточка: то же, что `AdminBooking` в `booking-store`. */
export type AdminBooking = Booking & { note: string | null };

export interface CalendarDay {
  /** `YYYY-MM-DD` по Москве. */
  date: string;
  /** Записи, которые держат слот (`pending` + `confirmed`). */
  count: number;
}

export interface CalendarResponse {
  month: string;
  from: string;
  to: string;
  timezone: string;
  days: CalendarDay[];
  bookings: AdminBooking[];
}

export interface BookingsResponse {
  from: string;
  to: string;
  status: string;
  timezone: string;
  bookings: AdminBooking[];
}

/** Будущая бронь, которая мешает удалить услугу или врача. */
export interface BlockingBooking {
  code: string;
  date: string;
  startsAt?: string;
  name: string;
}

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  /** Ошибки полей формы: `name`, `phone`, `durationMin`, `doctorIds`… */
  fields?: Record<string, string>;
  bookings?: BlockingBooking[];
  details?: {
    services?: { id: string; name: string }[];
    invalidIds?: string[];
    retryAfterSec?: number;
  };
}
