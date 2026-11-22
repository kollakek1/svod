/**
 * Авторизация админки СВОД: сессия, проверка доступа, роли.
 *
 * Cookie `svod_admin` содержит HMAC-подписанный токен `{ sub, role, email, exp }`.
 * Подпись подтверждает, что токен выдал сервер, но **не** заменяет проверку
 * сотрудника: `requireAdmin` на каждом запросе смотрит, что сотрудник существует
 * и активен, а роль берёт из документа, а не из токена. Кэш — 5 секунд, чтобы
 * отзыв доступа применялся почти сразу.
 *
 * Конфигурация — env:
 * - `ADMIN_SESSION_SECRET` — ключ подписи, минимум 16 символов (обязателен всегда);
 * - `ADMIN_PASSWORD` / `ADMIN_EMAIL` — только для создания первого владельца.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { ensureAdmins, toPublicAdmin, type AdminRecord, type PublicAdminUser } from "./admin-store";
import { errorResponse } from "./booking";
import type { AdminRole } from "./clinic";
import { isStorageUnavailable, storageUnavailableResponse } from "./storage/http";

export const ADMIN_COOKIE_NAME = "svod_admin";
/** 12 часов: смена рабочего дня, а не «запомнить навсегда». */
export const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;

const MIN_SECRET_LENGTH = 16;
/** Значения из .env.example: длина проходит, но это не секрет. */
const PLACEHOLDER_SECRETS = new Set(["replace-with-32-byte-hex", "change-me", "dev-secret", "secret"]);
/** Сколько живёт кэш «сотрудник активен и его роль». */
const ADMIN_CACHE_TTL_MS = 5_000;

export interface AdminSessionPayload {
  /** id сотрудника (`adm-…`). */
  sub: string;
  role: AdminRole;
  email: string;
  /** Момент истечения, Unix-секунды. */
  exp: number;
}

/** Секрет подписи или `null`, если админка не настроена. */
export function getSessionSecret(): string | null {
  const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();
  if (secret.length < MIN_SECRET_LENGTH) return null;
  // Плейсхолдер из .env.example проходит проверку длины — закрываем его явно.
  if (PLACEHOLDER_SECRETS.has(secret.toLowerCase())) return null;
  return secret;
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64url");
}

/** Токен формата `<base64url(payload)>.<base64url(hmac)>`. */
export function createAdminSessionToken(
  secret: string,
  user: { id: string; email: string; role: AdminRole },
  ttlSeconds: number = ADMIN_SESSION_TTL_SECONDS,
  now: number = Date.now(),
): string {
  const payload: AdminSessionPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    exp: Math.floor(now / 1000) + ttlSeconds,
  };
  const body = toBase64Url(JSON.stringify(payload));
  return `${body}.${signBody(body, secret)}`;
}

function isSessionPayload(value: unknown): value is AdminSessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sub === "string" &&
    candidate.sub.length > 0 &&
    (candidate.role === "owner" || candidate.role === "manager") &&
    typeof candidate.email === "string" &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp)
  );
}

/** Проверка подписи, формата и срока. Любая проблема — `null`. */
export function verifyAdminSessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): AdminSessionPayload | null {
  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expectedSignature = signBody(body, secret);

  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!isSessionPayload(payload)) return null;
  if (payload.exp * 1000 <= now) return null;
  return payload;
}

/** Достаёт значение cookie из заголовка `Cookie`. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

/**
 * Атрибуты сессионной cookie.
 * `Secure` только на проде: локально сайт живёт на http, и браузер её бы не сохранил.
 */
function sessionCookieAttributes(maxAge: number): string {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** `Set-Cookie` для входа. */
export function adminSessionCookie(token: string, maxAge: number = ADMIN_SESSION_TTL_SECONDS): string {
  return `${ADMIN_COOKIE_NAME}=${token}; ${sessionCookieAttributes(maxAge)}`;
}

/** `Set-Cookie` для выхода: тот же путь, нулевой срок жизни. */
export function clearAdminSessionCookie(): string {
  return `${ADMIN_COOKIE_NAME}=; ${sessionCookieAttributes(0)}`;
}

/* -------------------------------------------------------------------------- */
/* Проверка актуальности сотрудника                                           */
/* -------------------------------------------------------------------------- */

interface CacheEntry {
  user: PublicAdminUser | null;
  at: number;
}

const userCache = new Map<string, CacheEntry>();

/** Сброс кэша после правки сотрудника (роль, активность, удаление). */
export function invalidateAdminCache(id?: string): void {
  if (id === undefined) userCache.clear();
  else userCache.delete(id);
}

type ResolveResult =
  | { ok: true; user: PublicAdminUser | null }
  | { ok: false; reason: "corrupt" | "not_configured" | "unavailable"; message: string };

/**
 * Сотрудник по id с кэшем ≤ 5 c.
 * `user: null` — такого нет или он деактивирован (доступ отозван).
 * `unavailable` — хранилище не ответило (холодный старт): это 503, а не 500.
 */
async function resolveUser(id: string): Promise<ResolveResult> {
  const cached = userCache.get(id);
  if (cached && Date.now() - cached.at < ADMIN_CACHE_TTL_MS) {
    return { ok: true, user: cached.user };
  }

  let result;
  try {
    result = await ensureAdmins();
  } catch (error) {
    if (isStorageUnavailable(error)) {
      return { ok: false, reason: "unavailable", message: "Хранилище временно недоступно" };
    }
    throw error;
  }

  if (!result.ok) {
    // Испорченный документ не кэшируем: как только его починят, доступ вернётся.
    return { ok: false, reason: result.reason, message: result.message };
  }

  const record: AdminRecord | undefined = result.users.find((user) => user.id === id);
  const user = record && record.active ? toPublicAdmin(record) : null;
  userCache.set(id, { user, at: Date.now() });
  return { ok: true, user };
}

function notConfiguredResponse(): Response {
  return errorResponse(
    500,
    "not_configured",
    "Админка не настроена: ADMIN_SESSION_SECRET не задан или короче 16 символов. Добавьте его в .env.local и перезапустите сервер",
  );
}

function adminsBrokenResponse(message: string): Response {
  return errorResponse(
    500,
    "server_error",
    `${message}. Панель закрыта: восстановите документ сотрудников`,
  );
}

export type AdminGuard =
  | { ok: true; user: PublicAdminUser }
  | { ok: false; response: Response };

/**
 * Обязательная проверка для админ-роутов.
 * Возвращает готовый 401/403/500-ответ, если доступа нет.
 */
export async function requireAdmin(request: Request): Promise<AdminGuard> {
  const secret = getSessionSecret();
  if (!secret) return { ok: false, response: notConfiguredResponse() };

  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!token) {
    return { ok: false, response: errorResponse(401, "unauthorized", "Требуется вход в админку") };
  }

  const session = verifyAdminSessionToken(token, secret);
  if (!session) {
    return {
      ok: false,
      response: errorResponse(401, "unauthorized", "Сессия истекла. Войдите заново"),
    };
  }

  const resolved = await resolveUser(session.sub);
  if (!resolved.ok) {
    if (resolved.reason === "unavailable") {
      return { ok: false, response: storageUnavailableResponse() };
    }
    return { ok: false, response: adminsBrokenResponse(resolved.message) };
  }
  if (!resolved.user) {
    return {
      ok: false,
      response: errorResponse(401, "unauthorized", "Доступ отозван. Войдите заново"),
    };
  }

  return { ok: true, user: resolved.user };
}

/** Дополнительно требует роль владельца. */
export async function requireOwner(request: Request): Promise<AdminGuard> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard;

  if (guard.user.role !== "owner") {
    return {
      ok: false,
      response: errorResponse(403, "forbidden", "Раздел доступен только владельцу клиники"),
    };
  }
  return guard;
}

/** Для `GET /api/admin/auth`: текущий сотрудник или `null`, без кодов ошибок. */
export async function getAdminSession(request: Request): Promise<PublicAdminUser | null> {
  const guard = await requireAdmin(request);
  return guard.ok ? guard.user : null;
}
