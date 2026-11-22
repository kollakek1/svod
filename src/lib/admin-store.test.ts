/**
 * РЎРѕС‚СЂСѓРґРЅРёРєРё Рё РёС… РіР°СЂРґС‹: bootstrap РІР»Р°РґРµР»СЊС†Р° РёР· env, Р·Р°РЅСЏС‚РѕСЃС‚СЊ email,
 * В«РЅРµР»СЊР·СЏ РѕСЃС‚Р°С‚СЊСЃСЏ Р±РµР· ownerВ» Рё В«РЅРµР»СЊР·СЏ РґРµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ СЃРµР±СЏВ».
 * Р¤Р°Р№Р»РѕРІС‹Р№ РґСЂР°Р№РІРµСЂ РІРѕ РІСЂРµРјРµРЅРЅРѕР№ РїР°РїРєРµ, Р±РµР· СЃРµС‚Рё.
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
  if (!owner) throw new Error("РІР»Р°РґРµР»РµС† РЅРµ СЃРѕР·РґР°РЅ");
  return owner;
}

describe("bootstrap", () => {
  it("СЃРѕР·РґР°С‘С‚ РІР»Р°РґРµР»СЊС†Р° РёР· env РѕРґРёРЅ СЂР°Р· Рё РїСЂРѕРІРµСЂСЏРµС‚ РµРіРѕ РїР°СЂРѕР»СЊ", async () => {
    const owner = await bootstrapOwner();

    expect(owner.email).toBe(EMAIL);
    expect(owner.role).toBe("owner");
    expect(owner.active).toBe(true);
    expect(await verifyPassword(PASSWORD, owner)).toBe(true);
    expect(await verifyPassword("С‡СѓР¶РѕР№-РїР°СЂРѕР»СЊ", owner)).toBe(false);

    const again = await ensureAdmins();
    expect(again.ok && again.users).toHaveLength(1);
  });

  it("РЅРµ РѕС‚РґР°С‘С‚ РЅР°СЂСѓР¶Сѓ С…СЌС€Рё Рё СЃРѕР»СЊ", async () => {
    await bootstrapOwner();
    const users = await listAdminUsers();
    const serialized = JSON.stringify(users);

    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("salt");
    expect(users[0]?.email).toBe(EMAIL);
  });
});

describe("СЃРѕР·РґР°РЅРёРµ Рё РїСЂР°РІРєР°", () => {
  it("Р·Р°РЅРёРјР°РµС‚ email Рё РЅРµ РґР°С‘С‚ СЃРѕР·РґР°С‚СЊ РґСѓР±Р»СЊ", async () => {
    await bootstrapOwner();

    const created = await createAdmin({
      email: "manager@svod.dental",
      name: "РњР°СЂРёРЅР°",
      role: "manager",
      password: "manager-pass-2026",
      createdBy: null,
    });
    expect(created.ok).toBe(true);

    const duplicate = await createAdmin({
      email: "MANAGER@svod.dental",
      name: "Р”СЂСѓРіРѕР№",
      role: "manager",
      password: "manager-pass-2026",
      createdBy: null,
    });
    expect(duplicate).toMatchObject({ ok: false, reason: "email_taken" });
  });

  it("РЅРµ РґР°С‘С‚ РґРµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ СЃРµР±СЏ", async () => {
    const owner = await bootstrapOwner();
    const result = await deactivateAdmin(owner.id, owner.id);
    expect(result).toMatchObject({ ok: false, reason: "self_deactivate" });
  });

  it("РЅРµ РѕСЃС‚Р°РІР»СЏРµС‚ РєР»РёРЅРёРєСѓ Р±РµР· Р°РєС‚РёРІРЅРѕРіРѕ РІР»Р°РґРµР»СЊС†Р°", async () => {
    const owner = await bootstrapOwner();

    const demote = await updateAdmin(owner.id, { role: "manager" }, "adm-РєС‚Рѕ-С‚Рѕ");
    expect(demote).toMatchObject({ ok: false, reason: "last_owner" });

    const second = await createAdmin({
      email: "owner2@svod.dental",
      name: "Р’С‚РѕСЂРѕР№",
      role: "owner",
      password: "second-pass-2026",
      createdBy: owner.id,
    });
    if (!second.ok) throw new Error("РІС‚РѕСЂРѕР№ РІР»Р°РґРµР»РµС† РЅРµ СЃРѕР·РґР°РЅ");

    // Р’Р»Р°РґРµР»СЊС†РµРІ РґРІРѕРµ вЂ” РїРѕРЅРёР·РёС‚СЊ РѕРґРЅРѕРіРѕ РјРѕР¶РЅРѕ.
    const demoted = await updateAdmin(owner.id, { role: "manager" }, second.value.id);
    expect(demoted.ok).toBe(true);

    // РќРѕ РїРѕСЃР»РµРґРЅРµРіРѕ вЂ” СѓР¶Рµ РЅРµС‚.
    const blocked = await updateAdmin(second.value.id, { active: false }, owner.id);
    expect(blocked).toMatchObject({ ok: false, reason: "last_owner" });
  });

  it("РґРµР°РєС‚РёРІРёСЂСѓРµС‚ СЃРѕС‚СЂСѓРґРЅРёРєР° Рё РѕС‚Р·С‹РІР°РµС‚ Р·Р°РїРёСЃСЊ", async () => {
    const owner = await bootstrapOwner();
    const created = await createAdmin({
      email: "manager@svod.dental",
      name: "РњР°СЂРёРЅР°",
      role: "manager",
      password: "manager-pass-2026",
      createdBy: owner.id,
    });
    if (!created.ok) throw new Error("СЃРѕС‚СЂСѓРґРЅРёРє РЅРµ СЃРѕР·РґР°РЅ");

    const deactivated = await deactivateAdmin(created.value.id, owner.id);
    expect(deactivated.ok && deactivated.value.active).toBe(false);

    const stored = await findAdminById(created.value.id);
    expect(stored?.active).toBe(false);
  });
});

describe("СЃРјРµРЅР° РїР°СЂРѕР»СЏ", () => {
  it("С‚СЂРµР±СѓРµС‚ С‚РµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ Рё Р·Р°С‚РµРј РїСЂРёРЅРёРјР°РµС‚ РЅРѕРІС‹Р№", async () => {
    const owner = await bootstrapOwner();

    const wrong = await changeAdminPassword(owner.id, {
      newPassword: "РЅРѕРІС‹Р№-РїР°СЂРѕР»СЊ-2026",
      currentPassword: "РЅРµРІРµСЂРЅС‹Р№",
      requireCurrent: true,
    });
    expect(wrong).toMatchObject({ ok: false, reason: "invalid_password" });

    const changed = await changeAdminPassword(owner.id, {
      newPassword: "РЅРѕРІС‹Р№-РїР°СЂРѕР»СЊ-2026",
      currentPassword: PASSWORD,
      requireCurrent: true,
    });
    expect(changed.ok).toBe(true);

    const stored = await findAdminById(owner.id);
    expect(stored && (await verifyPassword("РЅРѕРІС‹Р№-РїР°СЂРѕР»СЊ-2026", stored))).toBe(true);
    expect(stored && (await verifyPassword(PASSWORD, stored))).toBe(false);
  });

  it("РїСЂРѕРІРµСЂСЏРµС‚ РјРёРЅРёРјР°Р»СЊРЅСѓСЋ РґР»РёРЅСѓ", async () => {
    expect(isValidPassword("РєРѕСЂРѕС‚РєРёР№")).toBe(false);
    expect(isValidPassword(PASSWORD)).toBe(true);

    const owner = await bootstrapOwner();
    const result = await changeAdminPassword(owner.id, {
      newPassword: "123",
      requireCurrent: false,
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_password" });
  });
});

