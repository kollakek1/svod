import { HOURS, SETTINGS } from "@/content/clinic";

import {
  availabilityDays,
  clientIp,
  createRateLimiter,
  errorResponse,
  jsonResponse,
  moscowWallClock,
  TIMEZONE,
  validationErrorResponse,
} from "@/lib/booking";
import { doctorPerformsService, findDoctor, findService } from "@/lib/catalog-store";
import { listBookings } from "@/lib/booking-store";
import type { AvailabilityResponse } from "@/lib/clinic";
import { storageSafe } from "@/lib/storage/http";
import { availabilityQuerySchema } from "@/lib/validation";

/**
 * GET /api/availability?serviceId=&doctorId=&from=YYYY-MM-DD&days=1..31
 *
 * Отдаёт все запрошенные даты, включая пустые: интерфейс показывает закрытые
 * дни явно, а не «дырками» в календаре.
 *
 * Ошибки: 400 — параметры, 404 — услуга/врач, 422 — врач не выполняет услугу.
 * Занятость считается по актуальным броням (`pending` + `confirmed`).
 */

const DEFAULT_DAYS = 14;
const FALLBACK_MESSAGE = "Не удалось загрузить расписание. Попробуйте ещё раз";
/** Публичное чтение расписания: защита от перебора, но с большим запасом для UI. */
const availabilityLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export async function GET(request: Request): Promise<Response> {
  const limit = availabilityLimiter.check(clientIp(request));
  if (!limit.allowed) {
    return errorResponse(429, "rate_limited", "Слишком много запросов расписания. Подождите минуту", {
      headers: { "retry-after": String(limit.retryAfterSec) },
    });
  }

  const { searchParams } = new URL(request.url);

  const parsed = availabilityQuerySchema.safeParse({
    serviceId: searchParams.get("serviceId") ?? undefined,
    doctorId: searchParams.get("doctorId") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    days: searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues, 400);
  }

  const { serviceId, doctorId, days } = parsed.data;

  const service = await storageSafe(findService(serviceId), "[availability]", FALLBACK_MESSAGE);
  if (service instanceof Response) return service;
  if (!service) {
    return errorResponse(404, "unknown_service", "Такой услуги нет в каталоге");
  }

  const doctor = await storageSafe(findDoctor(doctorId), "[availability]", FALLBACK_MESSAGE);
  if (doctor instanceof Response) return doctor;
  if (!doctor) {
    return errorResponse(404, "unknown_doctor", "Такого врача нет в каталоге");
  }

  const performs = await storageSafe(
    doctorPerformsService(doctor.id, service.id),
    "[availability]",
    FALLBACK_MESSAGE,
  );
  if (performs instanceof Response) return performs;
  if (!performs) {
    return errorResponse(422, "doctor_not_assigned", "Этот врач не выполняет выбранную услугу");
  }

  const bookings = await storageSafe(listBookings(), "[availability]", FALLBACK_MESSAGE);
  if (bookings instanceof Response) return bookings;

  const now = new Date();
  const from = parsed.data.from ?? moscowWallClock(now).dateKey;

  const daysResult = availabilityDays({
    from,
    days: days ?? DEFAULT_DAYS,
    durationMin: service.durationMin,
    doctorId: doctor.id,
    doctorWorkingDays: doctor.workingDays,
    schedule: { settings: SETTINGS, hours: HOURS },
    bookings,
    now,
  });

  const body: AvailabilityResponse = {
    serviceId: service.id,
    doctorId: doctor.id,
    durationMin: service.durationMin,
    priceRub: service.priceRub,
    timezone: TIMEZONE,
    days: daysResult,
  };

  return jsonResponse(body);
}
