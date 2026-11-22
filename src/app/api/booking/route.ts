import { HOURS, SETTINGS } from "@/content/clinic";

import {
  checkSlot,
  clientIp,
  createRateLimiter,
  errorResponse,
  formatMoscowIsoFromMs,
  generateBookingCode,
  jsonResponse,
  looksLikeSpam,
  parseMoscowInstant,
  validationErrorResponse,
  type ApiErrorCode,
  type SlotRejectionReason,
} from "@/lib/booking";
import { createBooking, listBookings, toBookingConfirmation } from "@/lib/booking-store";
import { doctorPerformsService, findDoctor, findService } from "@/lib/catalog-store";
import { storageFailureResponse, storageSafe } from "@/lib/storage/http";
import { publicBookingSchema } from "@/lib/validation";

/**
 * POST /api/booking — создание заявки с сайта.
 *
 * Доверяем клиенту только выбор услуги, врача и времени. Цена, длительность
 * и занятость всегда пересчитываются по серверному каталогу.
 *
 * Порядок проверок: тело → схема → IP-лимит → каталог → антиспам → лимит телефона
 * → слот → атомарная запись (повторная проверка слота внутри блокировки).
 */

/** 10 заявок с одного IP в час. */
const ipLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60_000 });
/** 3 заявки в час на один телефон: спам «одним номером» не пройдёт. */
const phoneLimiter = createRateLimiter({ limit: 3, windowMs: 60 * 60_000 });

/** Форма с комментарием — сотни байт; 16 КБ хватает с запасом. */
const MAX_BODY_BYTES = 16 * 1024;

const FALLBACK_MESSAGE = "Не удалось создать запись. Попробуйте ещё раз";

function rateLimitResponse(retryAfterSec: number, scope: "ip" | "phone"): Response {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  const message =
    scope === "phone"
      ? `С этого номера сегодня уже записывались. Попробуйте через ${minutes} мин или позвоните в клинику`
      : `Слишком много заявок с этого адреса. Попробуйте через ${minutes} мин`;
  return errorResponse(429, "rate_limited", message, {
    headers: { "retry-after": String(retryAfterSec) },
    details: { retryAfterSec },
  });
}

/**
 * Признаки бота.
 *
 * - `website` — поле-ловушка: человек его не видит и не заполняет;
 * - `formStartedAt` — если форма «заполнена» быстрее 3 секунд, это бот.
 *   Устаревшая метка (старая открытая вкладка) ботом не считается: живого
 *   гостя блокировать хуже, чем пропустить одного спамера.
 */
function decoyResponse(input: {
  startsAt: string;
  serviceName: string;
  doctorName: string;
  durationMin: number;
  priceRub: number;
  priceFrom: boolean;
}): Response {
  const instant = parseMoscowInstant(input.startsAt);
  const endsAt = instant
    ? formatMoscowIsoFromMs(instant.timestamp + input.durationMin * 60_000)
    : input.startsAt;

  return jsonResponse(
    {
      booking: {
        code: generateBookingCode(),
        serviceName: input.serviceName,
        doctorName: input.doctorName,
        startsAt: input.startsAt,
        endsAt,
        durationMin: input.durationMin,
        priceRub: input.priceRub,
        priceFrom: input.priceFrom,
        status: "pending" as const,
      },
    },
    201,
  );
}

function slotRejectionResponse(reason: SlotRejectionReason, message: string): Response {
  if (reason === "slot_taken") {
    return errorResponse(409, "slot_taken", message);
  }
  return errorResponse(422, reason as ApiErrorCode, message, { fields: { startsAt: message } });
}

export async function POST(request: Request): Promise<Response> {
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

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return errorResponse(400, "invalid_request", "Тело запроса должно быть JSON-объектом");
  }

  const parsed = publicBookingSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues, 422);
  }
  const data = parsed.data;

  const ipLimit = ipLimiter.check(clientIp(request));
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSec, "ip");

  const service = await storageSafe(findService(data.serviceId), "[booking]", FALLBACK_MESSAGE);
  if (service instanceof Response) return service;
  if (!service) {
    return errorResponse(404, "unknown_service", "Такой услуги нет в каталоге");
  }

  const doctor = await storageSafe(findDoctor(data.doctorId), "[booking]", FALLBACK_MESSAGE);
  if (doctor instanceof Response) return doctor;
  if (!doctor) {
    return errorResponse(404, "unknown_doctor", "Такого врача нет в каталоге");
  }

  const performs = await storageSafe(
    doctorPerformsService(doctor.id, service.id),
    "[booking]",
    FALLBACK_MESSAGE,
  );
  if (performs instanceof Response) return performs;
  if (!performs) {
    return errorResponse(422, "doctor_not_assigned", "Этот врач не выполняет выбранную услугу", {
      fields: { doctorId: "Этот врач не выполняет выбранную услугу" },
    });
  }

  if (looksLikeSpam(data, Date.now())) {
    return decoyResponse({
      startsAt: data.startsAt,
      serviceName: service.name,
      doctorName: doctor.name,
      durationMin: service.durationMin,
      priceRub: service.priceRub,
      priceFrom: service.priceFrom,
    });
  }

  const phoneLimit = phoneLimiter.check(data.patient.phone);
  if (!phoneLimit.allowed) return rateLimitResponse(phoneLimit.retryAfterSec, "phone");

  const bookings = await storageSafe(listBookings(), "[booking]", FALLBACK_MESSAGE);
  if (bookings instanceof Response) return bookings;

  // Быстрая проверка без блокировки: большинство отказов отсекается здесь.
  const preliminary = checkSlot({
    startsAt: data.startsAt,
    durationMin: service.durationMin,
    doctorId: doctor.id,
    doctorWorkingDays: doctor.workingDays,
    schedule: { settings: SETTINGS, hours: HOURS },
    bookings,
    now: new Date(),
  });
  if (!preliminary.ok) return slotRejectionResponse(preliminary.reason, preliminary.message);

  // Проверка и вставка — в одной критической секции: иначе два гостя
  // могут одновременно занять один слот.
  const outcome = await createBooking({
    service,
    doctor,
    startsAt: data.startsAt,
    patient: data.patient,
    schedule: { settings: SETTINGS, hours: HOURS },
    source: "site",
    status: "pending",
    actor: "site",
    now: new Date(),
  }).catch((error: unknown) => storageFailureResponse(error, "[booking]", FALLBACK_MESSAGE));
  if (outcome instanceof Response) return outcome;

  if (!outcome.ok) return slotRejectionResponse(outcome.reason, outcome.message);

  return jsonResponse({ booking: { ...toBookingConfirmation(outcome.booking), priceFrom: service.priceFrom } }, 201);
}
