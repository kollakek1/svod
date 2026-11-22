import {
  clientIp,
  createRateLimiter,
  errorResponse,
  jsonResponse,
  TIMEZONE,
} from "@/lib/booking";
import { findBookingByCode, toPublicBooking } from "@/lib/booking-store";
import { isBookingCode } from "@/lib/clinic";
import { storageFailureResponse } from "@/lib/storage/http";

/**
 * GET /api/booking/[code] — карточка записи по коду.
 *
 * Код — единственный «ключ доступа», поэтому:
 * - отдаём только безопасную проекцию: без телефона, email, комментария и заметок;
 * - ограничиваем перебор кодов по IP.
 */

const lookupLimiter = createRateLimiter({ limit: 60, windowMs: 10 * 60_000 });
const FALLBACK_MESSAGE = "Не удалось загрузить запись. Попробуйте ещё раз";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  const limit = lookupLimiter.check(clientIp(request));
  if (!limit.allowed) {
    return errorResponse(429, "rate_limited", "Слишком много запросов. Попробуйте позже", {
      headers: { "retry-after": String(limit.retryAfterSec) },
    });
  }

  const { code: rawCode } = await context.params;
  const code = rawCode.trim().toUpperCase();

  // Неизвестный и просто битый код неразличимы снаружи: 404 в обоих случаях.
  if (!isBookingCode(code)) {
    return errorResponse(404, "not_found", "Записи с таким кодом нет");
  }

  const booking = await findBookingByCode(code).catch((error: unknown) =>
    storageFailureResponse(error, "[booking/[code]]", FALLBACK_MESSAGE),
  );
  if (booking instanceof Response) return booking;
  if (!booking) {
    return errorResponse(404, "not_found", "Записи с таким кодом нет");
  }

  return jsonResponse({ timezone: TIMEZONE, booking: toPublicBooking(booking) });
}
