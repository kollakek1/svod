import { requireAdmin } from "@/lib/admin-auth";
import { errorResponse, jsonResponse, validationErrorResponse } from "@/lib/booking";
import { futureBookings, listBookings } from "@/lib/booking-store";
import { catalogFailureResponse, deleteDoctor, findDoctor, updateDoctor } from "@/lib/catalog-store";
import { pluralRu } from "@/lib/format";
import { storageFailureResponse, storageSafe } from "@/lib/storage/http";
import { doctorPatchSchema } from "@/lib/validation";

/**
 * /api/admin/doctors/[id]
 * PATCH  — правка врача (принимаем id или slug в пути);
 * DELETE — удаление из каталога.
 *
 * Врача нельзя удалить, если он указан в услугах (услуга осталась бы без
 * исполнителя) или у него есть будущие брони. Оба случая — 409 `doctor_in_use`
 * со списком того, что мешает.
 */

const MAX_BODY_BYTES = 32 * 1024;
const FALLBACK_MESSAGE = "Не удалось сохранить врача. Попробуйте ещё раз";

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

  const parsed = doctorPatchSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues, 400);
  }
  if (Object.keys(parsed.data).length === 0) {
    return errorResponse(400, "invalid_request", "Нет полей для изменения");
  }

  const result = await updateDoctor(id, parsed.data).catch((error: unknown) =>
    storageFailureResponse(error, "[admin/doctors/[id]]", FALLBACK_MESSAGE),
  );
  if (result instanceof Response) return result;
  if (!result.ok) return catalogFailureResponse(result);

  return jsonResponse({ doctor: result.value });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  const doctor = await storageSafe(
    findDoctor(id),
    "[admin/doctors/[id]]",
    "Не удалось удалить врача",
  );
  if (doctor instanceof Response) return doctor;
  if (!doctor) return errorResponse(404, "not_found", "Такого врача нет в каталоге");

  const bookings = await storageSafe(
    listBookings(),
    "[admin/doctors/[id]]",
    "Не удалось проверить будущие записи",
  );
  if (bookings instanceof Response) return bookings;

  const future = futureBookings(bookings, (booking) => booking.doctorId === doctor.id);
  if (future.length > 0) {
    const count = future.length;
    return jsonResponse(
      {
        error: "doctor_in_use",
        message: `У врача ${doctor.name} ${count} ${pluralRu(count, ["будущая запись", "будущие записи", "будущих записей"])}. Сначала перенесите или отмените их`,
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

  // Проверка «указан в услугах» живёт в сторе: это целостность каталога, а не броней.
  const result = await deleteDoctor(doctor.id).catch((error: unknown) =>
    storageFailureResponse(error, "[admin/doctors/[id]]", "Не удалось удалить врача"),
  );
  if (result instanceof Response) return result;
  if (!result.ok) return catalogFailureResponse(result);

  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
