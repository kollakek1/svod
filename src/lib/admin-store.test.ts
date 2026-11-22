/**
 * Сотрудники и их гарды: bootstrap владельца из env, занятость email,
 * «нельзя остаться без owner» и «нельзя деактивировать себя».
 * Файловый драйвер во временной папке, без сети.
 */

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  changeAdminPassword,
  createAdmin,
  deactivateAdmin,
  ensureAdmins,
  findAdminById,
  isValidPassword,
  listAdminUsers,
  updateAdmin,
  verifyPassword,
} from "@/lib/admin-store";

const PASSWORD = "test-password-123";
const EMAIL = "owner@svod.dental";

let dir: string;
let savedEnv: Record<string, string | undefined>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "svod-admins-"));
  savedEnv = {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  };
  process.env.ADMIN_EMAIL = EMAIL;
  process.env.ADMIN_PASSWORD = PASSWORD;
});

afterAll(() => {
  delete process.env.SVOD_DATA_DIR;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.SVOD_DATA_DIR = dir;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
});

async function bootstrapOwner() {
  const result = await ensureAdmins();
  if (!result.ok) throw new Error(result.message);
  const owner = result.users.find((user) => user.role === "owner");
  if (!owner) throw new Error("владелец не создан");
  return owner;
}

describe("bootstrap", () => {
  it("создаёт владельца из env один раз и проверяет его пароль", async () => {
    const owner = await bootstrapOwner();

    expect(owner.email).toBe(EMAIL);
    expect(owner.role).toBe("owner");
    expect(owner.active).toBe(true);
    expect(await verifyPassword(PASSWORD, owner)).toBe(true);
    expect(await verifyPassword("чужой-пароль", owner)).toBe(false);

    const again = await ensureAdmins();
    expect(again.ok && again.users).toHaveLength(1);
  });

  it("не отдаёт наружу хэши и соль", async () => {
    await bootstrapOwner();
    const users = await listAdminUsers();
    const serialized = JSON.stringify(users);

    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("salt");
    expect(users[0]?.email).toBe(EMAIL);
  });
});

describe("создание и правка", () => {
  it("занимает email и не даёт создать дубль", async () => {
    await bootstrapOwner();

    const created = await createAdmin({
      email: "manager@svod.dental",
      name: "Марина",
      role: "manager",
      password: "manager-pass-2026",
      createdBy: null,
    });
    expect(created.ok).toBe(true);

    const duplicate = await createAdmin({
      email: "MANAGER@svod.dental",
      name: "Другой",
      role: "manager",
      password: "manager-pass-2026",
      createdBy: null,
    });
    expect(duplicate).toMatchObject({ ok: false, reason: "email_taken" });
  });

  it("не даёт деактивировать себя", async () => {
    const owner = await bootstrapOwner();
    const result = await deactivateAdmin(owner.id, owner.id);
    expect(result).toMatchObject({ ok: false, reason: "self_deactivate" });
  });

  it("не оставляет клинику без активного владельца", async () => {
    const owner = await bootstrapOwner();

    const demote = await updateAdmin(owner.id, { role: "manager" }, "adm-кто-то");
    expect(demote).toMatchObject({ ok: false, reason: "last_owner" });

    const second = await createAdmin({
      email: "owner2@svod.dental",
      name: "Второй",
      role: "owner",
      password: "second-pass-2026",
      createdBy: owner.id,
    });
    if (!second.ok) throw new Error("второй владелец не создан");

    // Владельцев двое — понизить одного можно.
    const demoted = await updateAdmin(owner.id, { role: "manager" }, second.value.id);
    expect(demoted.ok).toBe(true);

    // Но последнего — уже нет.
    const blocked = await updateAdmin(second.value.id, { active: false }, owner.id);
    expect(blocked).toMatchObject({ ok: false, reason: "last_owner" });
  });

  it("деактивирует сотрудника и отзывает запись", async () => {
    const owner = await bootstrapOwner();
    const created = await createAdmin({
      email: "manager@svod.dental",
      name: "Марина",
      role: "manager",
      password: "manager-pass-2026",
      createdBy: owner.id,
    });
    if (!created.ok) throw new Error("сотрудник не создан");

    const deactivated = await deactivateAdmin(created.value.id, owner.id);
    expect(deactivated.ok && deactivated.value.active).toBe(false);

    const stored = await findAdminById(created.value.id);
    expect(stored?.active).toBe(false);
  });
});

describe("смена пароля", () => {
  it("требует текущий пароль и затем принимает новый", async () => {
    const owner = await bootstrapOwner();

    const wrong = await changeAdminPassword(owner.id, {
      newPassword: "новый-пароль-2026",
      currentPassword: "неверный",
      requireCurrent: true,
    });
    expect(wrong).toMatchObject({ ok: false, reason: "invalid_password" });

    const changed = await changeAdminPassword(owner.id, {
      newPassword: "новый-пароль-2026",
      currentPassword: PASSWORD,
      requireCurrent: true,
    });
    expect(changed.ok).toBe(true);

    const stored = await findAdminById(owner.id);
    expect(stored && (await verifyPassword("новый-пароль-2026", stored))).toBe(true);
    expect(stored && (await verifyPassword(PASSWORD, stored))).toBe(false);
  });

  it("проверяет минимальную длину", async () => {
    expect(isValidPassword("короткий")).toBe(false);
    expect(isValidPassword(PASSWORD)).toBe(true);

    const owner = await bootstrapOwner();
    const result = await changeAdminPassword(owner.id, {
      newPassword: "123",
      requireCurrent: false,
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_password" });
  });
});

