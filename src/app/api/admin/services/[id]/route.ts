import { requireAdmin } from "@/lib/admin-auth";
import { errorResponse, jsonResponse, validationErrorResponse } from "@/lib/booking";
import { futureBookings, listBookings } from "@/lib/booking-store";
import { catalogFailureResponse, deleteService, findService, updateService } from "@/lib/catalog-store";
import { pluralRu } from "@/lib/format";
import { storageFailureResponse, storageSafe } from "@/lib/storage/http";
import { servicePatchSchema } from "@/lib/validation";

/**
 * /api/admin/services/[id]
 * PATCH  — правка услуги (принимаем id или slug в пути);
 * DELETE — удаление из каталога.
 *
 * Удаление физическое. Старые брони не пересчитываются: цена, длительность
 * и названия в них — снапшот момента записи.
 *
 * Гард: услугу с будущими бронями (`pending`/`confirmed`, начало позже сейчас)
 * удалить нельзя — иначе гость придёт в пустоту. Ответ 409 `service_has_bookings`
 * со списком мешающих броней.
 */

const MAX_BODY_BYTES = 32 * 1024;
const FALLBACK_MESSAGE = "Не удалось сохранить услугу. Попробуйте ещё раз";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

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

  const parsed = servicePatchSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues, 400);
  }
  if (Object.keys(parsed.data).length === 0) {
    return errorResponse(400, "invalid_request", "Нет полей для изменения");
  }

  const result = await updateService(id, parsed.data).catch((error: unknown) =>
    storageFailureResponse(error, "[admin/services/[id]]", FALLBACK_MESSAGE),
  );
  if (result instanceof Response) return result;
  if (!result.ok) return catalogFailureResponse(result);

  return jsonResponse({ service: result.value });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  const service = await storageSafe(
    findService(id),
    "[admin/services/[id]]",
    "Не удалось удалить услугу",
  );
  if (service instanceof Response) return service;
  if (!service) return errorResponse(404, "not_found", "Такой услуги нет в каталоге");

  const bookings = await storageSafe(
    listBookings(),
    "[admin/services/[id]]",
    "Не удалось проверить будущие записи",
  );
  if (bookings instanceof Response) return bookings;

  const future = futureBookings(bookings, (booking) => booking.serviceId === service.id);
  if (future.length > 0) {
    const count = future.length;
    return jsonResponse(
      {
        error: "service_has_bookings",
        message: `У услуги «${service.name}» ${count} ${pluralRu(count, ["будущая запись", "будущие записи", "будущих записей"])}. Сначала перенесите или отмените их`,
        bookings: future.map((booking) => ({
          code: booking.code,
          date: booking.date,
          startsAt: booking.startsAt,
          name: booking.name,
        })),
      },
      409,
    );
  }

  const result = await deleteService(service.id).catch((error: unknown) =>
    storageFailureResponse(error, "[admin/services/[id]]", "Не удалось удалить услугу"),
  );
  if (result instanceof Response) return result;
  if (!result.ok) return catalogFailureResponse(result);

  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
