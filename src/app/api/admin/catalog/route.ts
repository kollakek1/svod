import { requireAdmin } from "@/lib/admin-auth";
import { jsonResponse } from "@/lib/booking";
import { getCatalogForAdmin } from "@/lib/catalog-store";
import { storageFailureResponse } from "@/lib/storage/http";

/**
 * GET /api/admin/catalog — каталог целиком для редактора админки.
 *
 * Отдаём и `version`, и `updatedAt`: UI видит, что данные свежие, а конфликт
 * двух открытых вкладок хотя бы заметен по номеру версии.
 */

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const catalog = await getCatalogForAdmin().catch((error: unknown) =>
    storageFailureResponse(error, "[admin/catalog]", "Не удалось загрузить каталог. Попробуйте ещё раз"),
  );
  if (catalog instanceof Response) return catalog;

  return jsonResponse({ catalog });
}
