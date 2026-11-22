/**
 * Тесты авторизации админки: пароли и подписанные сессии.
 * Ни сети, ни базы: проверяем криптографию и разбор cookie.
 */

import { describe, expect, it } from "vitest";

import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  clearAdminSessionCookie,
  createAdminSessionToken,
  readCookie,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";
import { hashPassword, verifyPassword } from "@/lib/admin-store";

const SECRET = "test-secret-with-enough-length";
const NOW = Date.parse("2026-11-22T09:00:00.000Z");

describe("пароли", () => {
  it("проверяет верный пароль и отвергает неверный", async () => {
    const stored = await hashPassword("test-password-123");
    expect(await verifyPassword("test-password-123", stored)).toBe(true);
    expect(await verifyPassword("svod-demo-2025", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("генерирует новую соль на каждый хэш", async () => {
    const first = await hashPassword("test-password-123");
    const second = await hashPassword("test-password-123");

    expect(first.salt).not.toBe(second.salt);
    expect(first.passwordHash).not.toBe(second.passwordHash);
    // Оба хэша валидны: соль хранится рядом, а не зашита в код.
    expect(await verifyPassword("test-password-123", first)).toBe(true);
    expect(await verifyPassword("test-password-123", second)).toBe(true);
  });

  it("не падает на испорченном хэше", async () => {
    expect(await verifyPassword("что угодно", { passwordHash: "", salt: "" })).toBe(false);
    expect(await verifyPassword("что угодно", { passwordHash: "zz", salt: "zz" })).toBe(false);
    expect(
      await verifyPassword("test-password-123", { passwordHash: "abcdef", salt: "0123456789abcdef" }),
    ).toBe(false);
  });
});

describe("сессия", () => {
  const user = { id: "adm-test01", email: "owner@svod.dental", role: "owner" as const };

  it("подписывает и проверяет токен", () => {
    const token = createAdminSessionToken(SECRET, user, ADMIN_SESSION_TTL_SECONDS, NOW);
    const payload = verifyAdminSessionToken(token, SECRET, NOW);

    expect(payload).toMatchObject({ sub: user.id, email: user.email, role: "owner" });
    expect(payload?.exp).toBe(Math.floor(NOW / 1000) + ADMIN_SESSION_TTL_SECONDS);
  });

  it("считает сессию истёкшей после TTL", () => {
    const token = createAdminSessionToken(SECRET, user, 60, NOW);
    expect(verifyAdminSessionToken(token, SECRET, NOW + 59_000)).not.toBeNull();
    expect(verifyAdminSessionToken(token, SECRET, NOW + 60_000)).toBeNull();
  });

  it("отвергает подделанную подпись и подделанное тело", () => {
    const token = createAdminSessionToken(SECRET, user, 60, NOW);
    const [body, signature] = token.split(".");

    expect(verifyAdminSessionToken(`${body}.${signature?.slice(0, -1)}A`, SECRET, NOW)).toBeNull();
    expect(verifyAdminSessionToken(token, `${SECRET}-чужой`, NOW)).toBeNull();
    expect(verifyAdminSessionToken("без-точки", SECRET, NOW)).toBeNull();
    expect(verifyAdminSessionToken(".", SECRET, NOW)).toBeNull();

    const forged = Buffer.from(
      JSON.stringify({ sub: "adm-forged", role: "owner", email: "evil@example.com", exp: 9_999_999_999 }),
    ).toString("base64url");
    expect(verifyAdminSessionToken(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("отвергает токен с чужой ролью", () => {
    const fake = Buffer.from(
      JSON.stringify({ sub: "adm-1", role: "admin", email: "a@b.ru", exp: 9_999_999_999 }),
    ).toString("base64url");
    const token = createAdminSessionToken(SECRET, user, 60, NOW);
    const signature = token.split(".")[1] ?? "";
    expect(verifyAdminSessionToken(`${fake}.${signature}`, SECRET, NOW)).toBeNull();
  });
});

describe("cookie", () => {
  it("ставит HttpOnly, SameSite=Lax и срок 12 часов", () => {
    const cookie = adminSessionCookie("token-value");
    expect(cookie.startsWith(`${ADMIN_COOKIE_NAME}=token-value;`)).toBe(true);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Max-Age=${12 * 60 * 60}`);
    expect(ADMIN_SESSION_TTL_SECONDS).toBe(12 * 60 * 60);
  });

  it("стирает cookie тем же путём", () => {
    const cookie = clearAdminSessionCookie();
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Path=/");
  });

  it("читает значение из заголовка", () => {
    expect(readCookie("a=1; svod_admin=abc.def; b=2", "svod_admin")).toBe("abc.def");
    expect(readCookie("svod_admin=", "svod_admin")).toBeNull();
    expect(readCookie("other=1", "svod_admin")).toBeNull();
    expect(readCookie(null, "svod_admin")).toBeNull();
  });
});

