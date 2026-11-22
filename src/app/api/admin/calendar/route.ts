import { requireAdmin } from "@/lib/admin-auth";
import {
  errorResponse,
  jsonResponse,
  monthDateKeys,
  monthRange,
  occupiesSlot,
  parseMonthKey,
  TIMEZONE,
} from "@/lib/booking";
import { listBookings, toAdminBooking } from "@/lib/booking-store";
import { storageFailureResponse } from "@/lib/storage/http";

/**
 * GET /api/admin/calendar?month=YYYY-MM
 *
 * Сетка месяца для админки: брони месяца целиком плюс счётчик занятых записей
 * по каждому дню (включая нулевые — месяц рисуется без «дырок»).
 *
 * `count` — записи, которые держат слот (`pending` + `confirmed`).
 * Отменённые и неявки остаются в `bookings`, но нагрузку не создают.
 */

const FALLBACK_MESSAGE = "Не удалось загрузить календарь. Попробуйте ещё раз";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const rawMonth = searchParams.get("month");
  const month = parseMonthKey(rawMonth ?? "");
  if (!month) {
    return errorResponse(400, "invalid_request", "Месяц в формате YYYY-MM, например 2026-11", {
      fields: { month: "Месяц в формате YYYY-MM" },
    });
  }

  const stored = await listBookings().catch((error: unknown) =>
    storageFailureResponse(error, "[admin/calendar]", FALLBACK_MESSAGE),
  );
  if (stored instanceof Response) return stored;

  const { from, to } = monthRange(month);
  const monthBookings = stored
    .filter((booking) => {
      const date = booking.startsAt.slice(0, 10);
      return date >= from && date <= to;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const counters = new Map<string, number>();
  for (const booking of monthBookings) {
    if (!occupiesSlot(booking.status)) continue;
    const date = booking.startsAt.slice(0, 10);
    counters.set(date, (counters.get(date) ?? 0) + 1);
  }

  return jsonResponse({
    month: rawMonth?.trim(),
    from,
    to,
    timezone: TIMEZONE,
    days: monthDateKeys(month).map((date) => ({ date, count: counters.get(date) ?? 0 })),
    bookings: monthBookings.map(toAdminBooking),
  });
}
