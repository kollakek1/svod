import {
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  clearAdminSessionCookie,
  createAdminSessionToken,
  getSessionSecret,
  requireAdmin,
} from "@/lib/admin-auth";
import {
  ensureAdmins,
  hashPassword,
  normalizeEmail,
  toPublicAdmin,
  touchLastLogin,
  verifyPassword,
  type AdminRecord,
} from "@/lib/admin-store";
import {
  clientIp,
  createRateLimiter,
  errorResponse,
  jsonResponse,
  validationErrorResponse,
} from "@/lib/booking";
import { storageFailureResponse } from "@/lib/storage/http";
import { loginSchema } from "@/lib/validation";

/**
 * /api/admin/auth — вход, проверка сессии и выход.
 *
 * Сессия — HttpOnly cookie `svod_admin` с HMAC-подписью и id сотрудника внутри.
 * Срок 12 часов, SameSite=Lax, Secure на проде.
 */

/** 5 попыток с одного IP за 15 минут. */
const ipLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });
/** И столько же на конкретный email: перебор чужого аккаунта не пройдёт. */
const emailLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

const FALLBACK_MESSAGE = "Не удалось выполнить вход. Попробуйте ещё раз";

/**
 * Хэш-заглушка: выравнивает время ответа, чтобы по задержке нельзя было
 * отличить существующий email от несуществующего.
 */
let decoyHash: Promise<{ passwordHash: string; salt: string }> | null = null;
function getDecoyHash(): Promise<{ passwordHash: string; salt: string }> {
  decoyHash ??= hashPassword("svod-decoy-password-for-timing");
  return decoyHash;
}

async function verifyAgainstDecoy(password: string): Promise<false> {
  await verifyPassword(password, await getDecoyHash());
  return false;
}

function rateLimitResponse(retryAfterSec: number): Response {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return errorResponse(
    429,
    "rate_limited",
    `Слишком много попыток входа. Попробуйте через ${minutes} мин`,
    {
      headers: { "retry-after": String(retryAfterSec) },
      details: { retryAfterSec },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  const secret = getSessionSecret();
  if (!secret) {
    return errorResponse(
      500,
      "not_configured",
      "Админка не настроена: ADMIN_SESSION_SECRET не задан или короче 16 символов. Добавьте его в .env.local и перезапустите сервер",
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Тело запроса должно быть корректным JSON");
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues, 400);
  }

  const ipKey = clientIp(request);
  const ipLimit = ipLimiter.check(ipKey);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSec);

  const email = normalizeEmail(parsed.data.email);
  const emailKey = `email:${email}`;
  const emailLimit = emailLimiter.check(emailKey);
  if (!emailLimit.allowed) return rateLimitResponse(emailLimit.retryAfterSec);

  const admins = await ensureAdmins().catch((error: unknown) =>
    storageFailureResponse(error, "[admin/auth]", FALLBACK_MESSAGE),
  );
  if (admins instanceof Response) return admins;

  if (!admins.ok) {
    const message =
      admins.reason === "not_configured"
        ? `Админка не настроена: ${admins.message}. Добавьте ADMIN_PASSWORD в .env.local`
        : `${admins.message}. Панель закрыта: восстановите документ сотрудников`;
    return errorResponse(500, admins.reason === "not_configured" ? "not_configured" : "server_error", message);
  }

  const record: AdminRecord | undefined = admins.users.find((user) => user.email === email);
  const passwordOk =
    record && record.active
      ? await verifyPassword(parsed.data.password, record)
      : await verifyAgainstDecoy(parsed.data.password);

  // Один и тот же ответ на «нет такого», «деактивирован» и «неверный пароль».
  if (!record || !record.active || !passwordOk) {
    return errorResponse(401, "unauthorized", "Неверный email или пароль");
  }

  emailLimiter.reset(emailKey);
  // Успешный вход не должен приближать блокировку всего офиса за NAT.
  ipLimiter.reset(ipKey);

  try {
    await touchLastLogin(record.id);
  } catch (error) {
    // Отметка аудита не должна мешать входу.
    console.error("[admin/auth] не удалось обновить lastLoginAt", error);
  }

  const now = Date.now();
  const token = createAdminSessionToken(secret, record, ADMIN_SESSION_TTL_SECONDS, now);
  const user = toPublicAdmin(record);

  return jsonResponse(
    {
      user,
      expiresAt: new Date(now + ADMIN_SESSION_TTL_SECONDS * 1000).toISOString(),
    },
    200,
    { "set-cookie": adminSessionCookie(token) },
  );
}

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  return jsonResponse({ user: guard.user });
}

export async function DELETE(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "set-cookie": clearAdminSessionCookie(),
      "cache-control": "no-store",
    },
  });
}
