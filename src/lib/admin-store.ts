/**
 * Сотрудники клиники: документ `admins` в слое хранения.
 *
 * Один владелец создаётся автоматически из env при первом обращении (bootstrap).
 * Дальше `ADMIN_PASSWORD` не используется: пароли живут только как scrypt-хэши
 * с индивидуальной солью.
 *
 * Гарды:
 * - нельзя деактивировать себя;
 * - нельзя оставить клинику без активного `owner`;
 * - нельзя занять чужой email;
 * - испорченный документ не заменяется новым владельцем (fail closed).
 *
 * Только сервер. Хэши никогда не покидают этот модуль — наружу отдаётся `AdminUser`.
 */

import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

import type { AdminRole, AdminUser } from "./clinic";
import { getStorage } from "./storage";

/* -------------------------------------------------------------------------- */
/* Константы                                                                  */
/* -------------------------------------------------------------------------- */

export const ADMIN_ROLES: readonly AdminRole[] = ["owner", "manager"];

export const DEFAULT_ADMIN_EMAIL = "owner@svod.dental";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

/** Плейсхолдеры из документации: длина проходит, но паролем не являются. */
const PLACEHOLDER_PASSWORDS = new Set(["change-me-before-deploy", "changeme", "password", "admin"]);

export const MAX_EMAIL_LENGTH = 120;
export const MAX_NAME_LENGTH = 80;

const DOCUMENT_NAME = "admins" as const;
const DOCUMENT_VERSION = 1;

/** Параметры scrypt. Меняются только вместе с форматом хэша. */
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_KEY_BYTES = 64;
/** 128 * N * r = 16 МБ; запас, чтобы Node не отказал на граничных параметрах. */
const SCRYPT_MAX_MEM = 64 * 1024 * 1024;

const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ID_LENGTH = 8;

/* -------------------------------------------------------------------------- */
/* Модель                                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminRecord extends AdminUser {
  /** scrypt-ключ, hex. */
  passwordHash: string;
  /** Соль в hex: у каждого сотрудника своя. */
  salt: string;
}

interface AdminsDocument {
  version: number;
  users: AdminRecord[];
}

/** Представление для API и сессии: без хэша и соли. */
export type PublicAdminUser = AdminUser;

/* -------------------------------------------------------------------------- */
/* Ошибки и результаты                                                        */
/* -------------------------------------------------------------------------- */

/** Внутренний сигнал: документ есть, но его нельзя использовать. Наружу → 500. */
export class AdminsCorruptError extends Error {
  constructor() {
    super("Документ сотрудников повреждён");
    this.name = "AdminsCorruptError";
  }
}

export type AdminReadResult =
  | { ok: true; users: AdminRecord[] }
  | { ok: false; reason: "corrupt" | "not_configured"; message: string };

export type AdminWriteFailure =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "email_taken"; email: string }
  | { ok: false; reason: "last_owner" }
  | { ok: false; reason: "self_deactivate" }
  | { ok: false; reason: "invalid_password"; message: string };

export type AdminWriteResult<T> = { ok: true; value: T } | AdminWriteFailure;

/* -------------------------------------------------------------------------- */
/* Пароли                                                                     */
/* -------------------------------------------------------------------------- */

function scryptKey(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_BYTES, { N: n, r, p, maxmem: SCRYPT_MAX_MEM }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export interface PasswordHash {
  passwordHash: string;
  salt: string;
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = await scryptKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return { passwordHash: derived.toString("hex"), salt: salt.toString("hex") };
}

/** Сравнение в постоянном времени. Любая странность формата → `false`, без исключений. */
export async function verifyPassword(
  password: string,
  stored: Pick<AdminRecord, "passwordHash" | "salt">,
): Promise<boolean> {
  const salt = Buffer.from(stored.salt, "hex");
  const expected = Buffer.from(stored.passwordHash, "hex");
  if (salt.length < 8 || expected.length === 0) return false;

  try {
    const derived = await scryptKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH;
}

/* -------------------------------------------------------------------------- */
/* Валидация полей                                                            */
/* -------------------------------------------------------------------------- */

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  if (value.length === 0 || value.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidName(value: string): boolean {
  return value.length >= 2 && value.length <= MAX_NAME_LENGTH;
}

export function isAdminRole(value: unknown): value is AdminRole {
  return value === "owner" || value === "manager";
}

/* -------------------------------------------------------------------------- */
/* Нормализация документа                                                     */
/* -------------------------------------------------------------------------- */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Строгая проверка: одна битая запись делает документ невалидным (fail closed). */
function normalizeAdmin(value: unknown): AdminRecord | null {
  if (!isPlainObject(value)) return null;

  const { id, email, name, role, active, passwordHash, salt, createdAt, lastLoginAt } = value;
  if (typeof id !== "string" || id === "") return null;
  if (typeof email !== "string" || email === "") return null;
  if (typeof name !== "string" || name === "") return null;
  if (!isAdminRole(role)) return null;
  if (typeof active !== "boolean") return null;
  if (typeof passwordHash !== "string" || passwordHash === "") return null;
  if (typeof salt !== "string" || salt === "") return null;
  if (typeof createdAt !== "string" || createdAt === "") return null;

  const record: AdminRecord = {
    id,
    email: email.toLowerCase(),
    name,
    role,
    active,
    createdAt,
    passwordHash,
    salt,
  };
  const lastLogin = nullableString(lastLoginAt);
  if (lastLogin) record.lastLoginAt = lastLogin;
  return record;
}

function normalizeDocument(value: unknown): AdminsDocument | null {
  if (!isPlainObject(value)) return null;
  const rawUsers = Array.isArray(value.users) ? value.users : null;
  if (!rawUsers) return null;

  const users: AdminRecord[] = [];
  for (const item of rawUsers) {
    const record = normalizeAdmin(item);
    if (!record) return null;
    users.push(record);
  }

  return { version: DOCUMENT_VERSION, users };
}

function toDocument(users: readonly AdminRecord[]): AdminsDocument {
  return { version: DOCUMENT_VERSION, users: [...users] };
}

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                  */
/* -------------------------------------------------------------------------- */

export type BootstrapCredentials =
  | { ok: true; email: string; password: string }
  | { ok: false; message: string };

/** Env нужен только для создания первого владельца. */
export function getBootstrapCredentials(): BootstrapCredentials {
  const password = process.env.ADMIN_PASSWORD?.trim() ?? "";
  const email = normalizeEmail(process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL);

  if (!isValidPassword(password)) {
    return {
      ok: false,
      message: `ADMIN_PASSWORD не задан или короче ${MIN_PASSWORD_LENGTH} символов`,
    };
  }
  if (PLACEHOLDER_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: "ADMIN_PASSWORD оставлен плейсхолдером — задайте свой пароль" };
  }
  if (!isValidEmail(email)) {
    return { ok: false, message: "ADMIN_EMAIL не похож на email" };
  }
  return { ok: true, email, password };
}

function generateAdminId(taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let suffix = "";
    for (let index = 0; index < ID_LENGTH; index += 1) {
      suffix += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
    }
    const id = `adm-${suffix}`;
    if (!taken.has(id)) return id;
  }
  throw new Error("Не удалось сгенерировать id сотрудника");
}

async function bootstrapOwner(): Promise<AdminReadResult> {
  const credentials = getBootstrapCredentials();
  if (!credentials.ok) {
    return { ok: false, reason: "not_configured", message: credentials.message };
  }

  const password = await hashPassword(credentials.password);
  const storage = await getStorage();

  return storage.withLockedDocument<AdminsDocument, AdminReadResult>(
    DOCUMENT_NAME,
    async (current) => {
      if (current !== null) {
        const existing = normalizeDocument(current);
        if (!existing) throw new AdminsCorruptError();
        return { next: existing, result: { ok: true, users: existing.users } };
      }

      const owner: AdminRecord = {
        id: generateAdminId(new Set()),
        email: credentials.email,
        name: "Владелец",
        role: "owner",
        active: true,
        createdAt: new Date().toISOString(),
        ...password,
      };
      const document = toDocument([owner]);
      return { next: document, result: { ok: true, users: document.users } };
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Чтение                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Документ сотрудников.
 * Нет документа → создаём владельца из env (один раз).
 * Документ испорчен → `corrupt`: панель закрыта, доступ никому не выдаётся.
 */
export async function ensureAdmins(): Promise<AdminReadResult> {
  const storage = await getStorage();
  const state = await storage.readDocument<unknown>(DOCUMENT_NAME);

  if (state.state === "corrupt") {
    return { ok: false, reason: "corrupt", message: "Документ сотрудников повреждён" };
  }
  if (state.state === "missing") {
    return bootstrapOwner();
  }

  const document = normalizeDocument(state.value);
  if (!document) {
    return { ok: false, reason: "corrupt", message: "Документ сотрудников повреждён" };
  }
  return { ok: true, users: document.users };
}

export async function findAdminByEmail(email: string): Promise<AdminRecord | undefined> {
  const normalized = normalizeEmail(email);
  const result = await ensureAdmins();
  if (!result.ok) return undefined;
  return result.users.find((user) => user.email === normalized);
}

export async function findAdminById(id: string): Promise<AdminRecord | undefined> {
  const result = await ensureAdmins();
  if (!result.ok) return undefined;
  return result.users.find((user) => user.id === id);
}

export function toPublicAdmin(user: AdminRecord): PublicAdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt } : {}),
  };
}

/** Список для админки: без хэшей, в стабильном порядке (owner → manager → имя). */
export async function listAdminUsers(): Promise<PublicAdminUser[]> {
  const result = await ensureAdmins();
  if (!result.ok) throw new AdminsCorruptError();

  const rank: Record<AdminRole, number> = { owner: 0, manager: 1 };
  return [...result.users]
    .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name, "ru"))
    .map(toPublicAdmin);
}

/* -------------------------------------------------------------------------- */
/* Мутации                                                                    */
/* -------------------------------------------------------------------------- */

async function mutateAdmins<T>(
  mutator: (
    users: AdminRecord[],
  ) => { next?: AdminRecord[]; value: T } | Promise<{ next?: AdminRecord[]; value: T }>,
): Promise<T> {
  const storage = await getStorage();

  return storage.withLockedDocument<AdminsDocument, T>(DOCUMENT_NAME, async (current) => {
    const document = current === null ? null : normalizeDocument(current);
    if (current !== null && !document) throw new AdminsCorruptError();

    const users = document ? document.users : [];
    const outcome = await mutator(users);

    return {
      next: toDocument(outcome.next ?? users),
      result: outcome.value,
    };
  });
}

export interface CreateAdminInput {
  email: string;
  name: string;
  role: AdminRole;
  password: string;
  /** id владельца, который создаёт сотрудника; `null` — bootstrap. */
  createdBy: string | null;
}

export async function createAdmin(input: CreateAdminInput): Promise<AdminWriteResult<PublicAdminUser>> {
  if (!isValidPassword(input.password)) {
    return {
      ok: false,
      reason: "invalid_password",
      message: `Пароль — от ${MIN_PASSWORD_LENGTH} до ${MAX_PASSWORD_LENGTH} символов`,
    };
  }

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { ok: false, reason: "invalid_password", message: "Email указан неверно" };
  }

  const password = await hashPassword(input.password);

  return mutateAdmins<AdminWriteResult<PublicAdminUser>>((users) => {
    if (users.some((user) => user.email === email)) {
      return { value: { ok: false, reason: "email_taken", email } };
    }

    const record: AdminRecord = {
      id: generateAdminId(new Set(users.map((user) => user.id))),
      email,
      name: normalizeName(input.name),
      role: input.role,
      active: true,
      createdAt: new Date().toISOString(),
      ...password,
    };

    return { next: [...users, record], value: { ok: true, value: toPublicAdmin(record) } };
  });
}

export interface UpdateAdminInput {
  name?: string;
  email?: string;
  role?: AdminRole;
  active?: boolean;
}

/**
 * Правка сотрудника. Себя деактивировать нельзя, последнего активного владельца
 * «понизить» тоже: клиника осталась бы без того, кто управляет доступами.
 */
export async function updateAdmin(
  id: string,
  patch: UpdateAdminInput,
  actorId: string,
): Promise<AdminWriteResult<PublicAdminUser>> {
  const email = patch.email === undefined ? undefined : normalizeEmail(patch.email);

  return mutateAdmins<AdminWriteResult<PublicAdminUser>>((users) => {
    const index = users.findIndex((user) => user.id === id);
    const current = users[index];
    if (index === -1 || !current) return { value: { ok: false, reason: "not_found" } };

    if (email !== undefined && email !== current.email) {
      const taken = users.some((user) => user.id !== id && user.email === email);
      if (taken) return { value: { ok: false, reason: "email_taken", email } };
    }

    const nextRole = patch.role ?? current.role;
    const nextActive = patch.active ?? current.active;

    if (actorId === id && current.active && nextActive === false) {
      return { value: { ok: false, reason: "self_deactivate" } };
    }

    const losesOwner = current.role === "owner" && current.active && (nextRole !== "owner" || !nextActive);
    if (losesOwner) {
      const otherOwners = users.filter(
        (user) => user.id !== id && user.role === "owner" && user.active,
      ).length;
      if (otherOwners === 0) return { value: { ok: false, reason: "last_owner" } };
    }

    const updated: AdminRecord = {
      ...current,
      name: patch.name === undefined ? current.name : normalizeName(patch.name),
      email: email ?? current.email,
      role: nextRole,
      active: nextActive,
    };

    const next = [...users];
    next[index] = updated;
    return { next, value: { ok: true, value: toPublicAdmin(updated) } };
  });
}

/** Деактивация: доступ отзывается сразу после следующей проверки сессии. */
export async function deactivateAdmin(
  id: string,
  actorId: string,
): Promise<AdminWriteResult<PublicAdminUser>> {
  return updateAdmin(id, { active: false }, actorId);
}

/**
 * Смена пароля.
 * Свой пароль — только со старым; чужой — владельцем и без старого (роль проверяет роут).
 */
export async function changeAdminPassword(
  id: string,
  options: { newPassword: string; currentPassword?: string; requireCurrent: boolean },
): Promise<AdminWriteResult<PublicAdminUser>> {
  if (!isValidPassword(options.newPassword)) {
    return {
      ok: false,
      reason: "invalid_password",
      message: `Пароль — от ${MIN_PASSWORD_LENGTH} до ${MAX_PASSWORD_LENGTH} символов`,
    };
  }

  const password = await hashPassword(options.newPassword);

  return mutateAdmins<AdminWriteResult<PublicAdminUser>>(async (users) => {
    const index = users.findIndex((user) => user.id === id);
    const record = users[index];
    if (index === -1 || !record) return { value: { ok: false, reason: "not_found" } };

    if (options.requireCurrent) {
      const current = options.currentPassword ?? "";
      if (current === "" || !(await verifyPassword(current, record))) {
        return { value: { ok: false, reason: "invalid_password", message: "Текущий пароль неверен" } };
      }
    }

    const updated: AdminRecord = { ...record, ...password };
    const next = [...users];
    next[index] = updated;
    return { next, value: { ok: true, value: toPublicAdmin(updated) } };
  });
}

/** Отметка успешного входа. Не влияет на доступ, поэтому ошибки не критичны. */
export async function touchLastLogin(id: string): Promise<void> {
  await mutateAdmins((users) => {
    const index = users.findIndex((user) => user.id === id);
    const record = users[index];
    if (index === -1 || !record) return { value: undefined };

    const next = [...users];
    next[index] = { ...record, lastLoginAt: new Date().toISOString() };
    return { next, value: undefined };
  });
}
