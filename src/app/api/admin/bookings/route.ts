import { z } from "zod";

import { HOURS, SETTINGS } from "@/content/clinic";

import { requireAdmin } from "@/lib/admin-auth";
import {
  errorResponse,
  jsonResponse,
  rangeLengthDays,
  TIMEZONE,
  validationErrorResponse,
  type ApiErrorCode,
  type SlotRejectionReason,
} from "@/lib/booking";
import { createBooking, listBookings, toAdminBooking } from "@/lib/booking-store";
import { doctorPerformsService, findDoctor, findService } from "@/lib/catalog-store";
import { storageFailureResponse, storageSafe } from "@/lib/storage/http";
import { adminBookingSchema, dateKeySchema, parseStatusFilter } from "@/lib/validation";

/**
 * /api/admin/bookings
 * GET  — брони за диапазон (не длиннее 62 дней) с фильтром по статусу;
 * POST — ручная запись: гость по телефону или walk-in, лид-тайм не действует.
 */

const MAX_RANGE_DAYS = 62;
const MAX_BODY_BYTES = 32 * 1024;
const FALLBACK_MESSAGE = "Не удалось загрузить записи. Попробуйте ещё раз";

const listQuerySchema = z.object({
  from: dateKeySchema,
  to: dateKeySchema,
  status: z.string().trim().optional(),
});

function slotRejectionResponse(reason: SlotRejectionReason, message: string): Response {
  if (reason === "slot_taken") {
    return errorResponse(409, "slot_taken", message);
  }
  return errorResponse(422, reason as ApiErrorCode, message, { fields: { startsAt: message } });
}

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues, 400);
  }

  const { from, to } = parsed.data;
  const length = rangeLengthDays(from, to);
  if (length === null) {
    return errorResponse(400, "invalid_request", "Дата указана неверно");
  }
  if (length < 1) {
    return errorResponse(400, "invalid_request", "Дата начала позже даты окончания");
  }
  if (length > MAX_RANGE_DAYS) {
    return errorResponse(
      400,
      "invalid_request",
      `Диапазон — не длиннее ${MAX_RANGE_DAYS} дней. Выберите меньший период`,
    );
  }

  const status = parseStatusFilter(parsed.data.status);
  if (status === null) {
    return errorResponse(
      400,
      "invalid_request",
      "Неизвестный статус. Допустимо: all, pending, confirmed, done, cancelled, no-show",
      { fields: { status: "Неизвестный статус" } },
    );
  }

  const stored = await listBookings().catch((error: unknown) =>
    storageFailureResponse(error, "[admin/bookings]", FALLBACK_MESSAGE),
  );
  if (stored instanceof Response) return stored;

  const bookings = stored
    .filter((booking) => {
      const date = booking.startsAt.slice(0, 10);
      if (date < from || date > to) return false;
      if (status !== "all" && booking.status !== status) return false;
      return true;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map(toAdminBooking);

  return jsonResponse({
    from,
    to,
    status,
    timezone: TIMEZONE,
    bookings,
  });
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return errorResponse(413, "invalid_request", "Слишком большой запрос");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Тело запроса должно быть корректным JSON");
  }

  const parsed = adminBookingSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues, 422);
  }
  const data = parsed.data;

  const service = await storageSafe(findService(data.serviceId), "[admin/bookings]", FALLBACK_MESSAGE);
  if (service instanceof Response) return service;
  if (!service) {
    return errorResponse(404, "unknown_service", "Такой услуги нет в каталоге");
  }

  const doctor = await storageSafe(findDoctor(data.doctorId), "[admin/bookings]", FALLBACK_MESSAGE);
  if (doctor instanceof Response) return doctor;
  if (!doctor) {
    return errorResponse(404, "unknown_doctor", "Такого врача нет в каталоге");
  }

  const performs = await storageSafe(
    doctorPerformsService(doctor.id, service.id),
    "[admin/bookings]",
    FALLBACK_MESSAGE,
  );
  if (performs instanceof Response) return performs;
  if (!performs) {
    return errorResponse(422, "doctor_not_assigned", "Этот врач не выполняет выбранную услугу", {
      fields: { doctorId: "Этот врач не выполняет выбранную услугу" },
    });
  }

  const outcome = await createBooking({
    service,
    doctor,
    startsAt: data.startsAt,
    patient: data.patient,
    schedule: { settings: SETTINGS, hours: HOURS },
    source: "admin",
    status: data.status ?? "confirmed",
    note: data.note ?? null,
    actor: guard.user.email,
    now: new Date(),
    ignoreLeadTime: true,
  }).catch((error: unknown) =>
    storageFailureResponse(error, "[admin/bookings]", "Не удалось создать запись. Попробуйте ещё раз"),
  );
  if (outcome instanceof Response) return outcome;

  if (!outcome.ok) return slotRejectionResponse(outcome.reason, outcome.message);

  return jsonResponse({ booking: toAdminBooking(outcome.booking) }, 201);
}
