import { jsonResponse } from "@/lib/booking";
import { getCatalog } from "@/lib/catalog-store";
import type { PublicCatalogResponse } from "@/lib/clinic";
import { storageFailureResponse } from "@/lib/storage/http";

/**
 * GET /api/catalog — живой каталог для лендинга и формы записи.
 *
 * Источник — хранилище, не `content/clinic.ts`: правка в админке видна на сайте
 * сразу после сохранения. Пустой документ создаётся из сида при первом обращении.
 */

export async function GET(): Promise<Response> {
  const catalog = await getCatalog().catch((error: unknown) =>
    storageFailureResponse(error, "[catalog]", "Не удалось загрузить услуги. Попробуйте ещё раз"),
  );
  if (catalog instanceof Response) return catalog;

  const body: PublicCatalogResponse = {
    services: catalog.services,
    doctors: catalog.doctors,
    updatedAt: catalog.updatedAt,
  };

  return jsonResponse(body);
}
