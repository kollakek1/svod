import { requireAdmin } from "@/lib/admin-auth";
import {
  errorResponse,
  jsonResponse,
  TIMEZONE,
  validationErrorResponse,
} from "@/lib/booking";
import { findBookingByCode, toAdminBooking, updateBooking } from "@/lib/booking-store";
import { isBookingCode } from "@/lib/clinic";
import { storageFailureResponse } from "@/lib/storage/http";
import { bookingPatchSchema } from "@/lib/validation";

/**
 * /api/admin/bookings/[code]
 * GET   — полная карточка: телефон, email, комментарий, заметка, история;
 * PATCH — смена статуса и/или заметки.
 *
 * Отмена освобождает слот: публичная доступность учитывает `pending` и `confirmed`.
 * Возврат в работу проверяет, что время ещё свободно.
 */

const FALLBACK_MESSAGE = "Не удалось обновить запись. Попробуйте ещё раз";
const NOT_FOUND_MESSAGE = "Записи с таким кодом нет";

function normalizeCode(rawCode: string): string | null {
  const code = rawCode.trim().toUpperCase();
  return isBookingCode(code) ? code : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { code: rawCode } = await context.params;
  const code = normalizeCode(rawCode);
  if (!code) return errorResponse(404, "not_found", NOT_FOUND_MESSAGE);

  const booking = await findBookingByCode(code).catch((error: unknown) =>
    storageFailureResponse(error, "[admin/bookings/[code]]", FALLBACK_MESSAGE),
  );
  if (booking instanceof Response) return booking;
  if (!booking) return errorResponse(404, "not_found", NOT_FOUND_MESSAGE);

  return jsonResponse({ timezone: TIMEZONE, booking: toAdminBooking(booking) });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { code: rawCode } = await context.params;
  const code = normalizeCode(rawCode);
  if (!code) return errorResponse(404, "not_found", NOT_FOUND_MESSAGE);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Тело запроса должно быть корректным JSON");
  }

  const parsed = bookingPatchSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues, 400);
  }

  const outcome = await updateBooking(code, {
    status: parsed.data.status,
    note: parsed.data.note === undefined ? undefined : parsed.data.note?.trim() || null,
    actor: guard.user.email,
    now: new Date(),
  }).catch((error: unknown) =>
    storageFailureResponse(error, "[admin/bookings/[code]]", FALLBACK_MESSAGE),
  );
  if (outcome instanceof Response) return outcome;

  if (!outcome.ok) {
    if (outcome.reason === "not_found") {
      return errorResponse(404, "not_found", NOT_FOUND_MESSAGE);
    }
    if (outcome.reason === "invalid_transition") {
      return errorResponse(400, "invalid_transition", outcome.message);
    }
    return errorResponse(409, "slot_taken", outcome.message);
  }

  return jsonResponse({ booking: toAdminBooking(outcome.booking) });
}
