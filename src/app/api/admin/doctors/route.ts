import { requireAdmin } from "@/lib/admin-auth";
import { errorResponse, jsonResponse, validationErrorResponse } from "@/lib/booking";
import { catalogFailureResponse, createDoctor } from "@/lib/catalog-store";
import { storageFailureResponse } from "@/lib/storage/http";
import { doctorCreateSchema } from "@/lib/validation";

/** POST /api/admin/doctors — новый врач. Каталог получает новую `version`. */

const MAX_BODY_BYTES = 32 * 1024;

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

  const parsed = doctorCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues, 400);
  }

  const result = await createDoctor(parsed.data).catch((error: unknown) =>
    storageFailureResponse(error, "[admin/doctors]", "Не удалось создать врача. Попробуйте ещё раз"),
  );
  if (result instanceof Response) return result;
  if (!result.ok) return catalogFailureResponse(result);

  return jsonResponse({ doctor: result.value }, 201);
}
