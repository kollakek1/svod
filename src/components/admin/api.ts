import type { ApiErrorPayload } from "./types";

/**
 * Запрос к API админки.
 *
 * Отличия от голого `fetch`: JSON по умолчанию, `no-store`, разбор ошибки
 * в `ApiError` с полями формы. 401 не обрабатывается здесь — экран сам решает,
 * вернуть сотрудника на вход или показать ошибку.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly fields: Record<string, string>;
  readonly payload: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message?.trim() || fallbackMessage(status));
    this.name = "ApiError";
    this.status = status;
    this.code = payload.error ?? null;
    this.fields = payload.fields ?? {};
    this.payload = payload;
  }
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Нужно войти заново";
  if (status === 403) return "Недостаточно прав";
  if (status === 404) return "Запись не найдена";
  if (status === 409) return "Действие не выполнено: есть конфликт";
  if (status === 429) return "Слишком много попыток. Подождите 15 минут";
  if (status >= 500) return "Сервис не ответил. Попробуйте ещё раз";
  return "Не получилось. Попробуйте ещё раз";
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function errorMessage(error: unknown, fallback = "Не получилось. Попробуйте ещё раз"): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

/** Ключ ошибки поля из ответа API; для вложенных путей — последний сегмент. */
export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return error.fields[field];
}

export async function api<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  if (response.status === 204) return undefined as T;

  let body: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const payload: ApiErrorPayload =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as ApiErrorPayload)
        : { message: typeof body === "string" ? body : undefined };
    throw new ApiError(response.status, payload);
  }

  return body as T;
}
