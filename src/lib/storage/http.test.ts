/**
 * Ответы на недоступное хранилище: код 503 и Retry-After, а не 500.
 * Тонкий слой, но именно он определяет поведение API при холодном старте Neon.
 */

import { describe, expect, it } from "vitest";

import { StorageUnavailableError } from "@/lib/storage/types";
import {
  isStorageUnavailable,
  STORAGE_RETRY_AFTER_SEC,
  storageFailureResponse,
  storageUnavailableResponse,
} from "@/lib/storage/http";

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("ответы хранилища", () => {
  it("отдаёт 503 и Retry-After без деталей драйвера", async () => {
    const response = storageUnavailableResponse();
    const body = await bodyOf(response);

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe(String(STORAGE_RETRY_AFTER_SEC));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.error).toBe("storage_unavailable");
    expect(JSON.stringify(body)).not.toContain("Error");
  });

  it("различает недоступное хранилище и обычную ошибку", async () => {
    const unavailable = storageFailureResponse(
      new StorageUnavailableError("нет соединения"),
      "[test]",
      "Не получилось",
    );
    expect(unavailable.status).toBe(503);

    const unexpected = storageFailureResponse(new Error("boom"), "[test]", "Не получилось");
    const body = await bodyOf(unexpected);
    expect(unexpected.status).toBe(500);
    expect(body.message).toBe("Не получилось");
    expect(JSON.stringify(body)).not.toContain("boom");
  });

  it("узнаёт ошибку хранилища по типу", () => {
    expect(isStorageUnavailable(new StorageUnavailableError())).toBe(true);
    expect(isStorageUnavailable(new Error("другое"))).toBe(false);
    expect(isStorageUnavailable(null)).toBe(false);
  });
});
