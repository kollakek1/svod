/**
 * Каталог клиники: услуги и врачи.
 *
 * `src/content/clinic.ts` остаётся источником типов и сида. Данные живут в слое
 * хранения (`storage/`): файл `.data/catalog.json` локально или строка `catalog`
 * в Postgres на проде. Документа нет — каталог создаётся из сида при первом
 * обращении, и только потом админка его меняет.
 *
 * Удаление физическое. История броней не страдает: в каждой брони уже лежат
 * снапшоты `serviceName`, `doctorName`, `priceRub`, `durationMin`.
 *
 * Только сервер. Клиентские компоненты получают каталог через API.
 *
 * Гарантии записи обеспечивает драйвер: очередь/транзакция, атомарная замена,
 * `.bak` и откат при битом JSON. Здесь — модель, валидация и кэш на секунду.
 */

import { DOCTORS_SEED, SERVICES_SEED } from "@/content/clinic";

import { cryptoRandomIndex, errorResponse } from "./booking";
import {
  SERVICE_CATEGORIES,
  type Catalog,
  type ClinicDoctor,
  type ClinicService,
  type ServiceCategory,
  type Weekday,
} from "./clinic";
import { getStorage } from "./storage";
import type {
  DoctorCreateInput,
  DoctorPatchInput,
  ServiceCreateInput,
  ServicePatchInput,
} from "./validation";

/* -------------------------------------------------------------------------- */
/* Константы                                                                  */
/* -------------------------------------------------------------------------- */

const DOCUMENT_VERSION = 1;

/** Каталог не читается из БД чаще, чем раз в секунду: слот не платит за запрос. */
const CACHE_TTL_MS = 1_000;

const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ID_LENGTH = 8;

/* -------------------------------------------------------------------------- */
/* Результаты операций                                                        */
/* -------------------------------------------------------------------------- */

export type CatalogFailureReason =
  | "not_found"
  | "slug_taken"
  | "doctor_ids_invalid"
  | "doctor_in_use";

export type CatalogFailure = {
  ok: false;
  reason: CatalogFailureReason;
  slug?: string;
  /** id врачей, которых нет в каталоге. */
  invalidIds?: string[];
  /** Услуги, которые держат врача: удалить его нельзя. */
  services?: { id: string; name: string }[];
};

export type CatalogResult<T> = { ok: true; value: T } | CatalogFailure;

/**
 * Готовый ответ API на отказ каталога.
 *
 * Живёт рядом с `CatalogFailure`, чтобы четыре роута (услуги/врачи) не повторяли
 * один и тот же маппинг кодов. Ошибки хранилища сюда не попадают — их ловит
 * `storageFailureResponse` в роуте.
 */
export function catalogFailureResponse(failure: CatalogFailure): Response {
  switch (failure.reason) {
    case "not_found":
      return errorResponse(404, "not_found", "Запись каталога не найдена");
    case "slug_taken":
      return errorResponse(409, "slug_taken", `Адрес «${failure.slug}» уже занят`, {
        fields: { slug: `Адрес «${failure.slug}» уже занят` },
      });
    case "doctor_ids_invalid":
      return errorResponse(422, "doctor_ids_invalid", "Некоторые врачи не найдены в каталоге", {
        fields: { doctorIds: "Некоторые врачи не найдены" },
        details: { invalidIds: failure.invalidIds ?? [] },
      });
    case "doctor_in_use": {
      const services = failure.services ?? [];
      const names = services.map((service) => service.name).join(", ");
      return errorResponse(
        409,
        "doctor_in_use",
        names.length > 0
          ? `Врач указан в услугах: ${names}. Сначала уберите его из услуг`
          : "Врача нельзя удалить: он указан в услугах",
        { details: { services } },
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Сид и нормализация                                                         */
/* -------------------------------------------------------------------------- */

function cloneService(service: ClinicService): ClinicService {
  return { ...service, doctorIds: [...service.doctorIds] };
}

function cloneDoctor(doctor: ClinicDoctor): ClinicDoctor {
  return { ...doctor, workingDays: [...doctor.workingDays] };
}

function seedCatalog(): Catalog {
  return {
    version: DOCUMENT_VERSION,
    updatedAt: new Date().toISOString(),
    services: SERVICES_SEED.map(cloneService),
    doctors: DOCTORS_SEED.map(cloneDoctor),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asCategory(value: unknown): ServiceCategory | null {
  return typeof value === "string" && (SERVICE_CATEGORIES as readonly string[]).includes(value)
    ? (value as ServiceCategory)
    : null;
}

function asWeekday(value: unknown): Weekday | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6
    ? (value as Weekday)
    : null;
}

/** Возвращает `null`, если запись нечитаема: одна битая строка не рушит каталог. */
function normalizeService(value: unknown): ClinicService | null {
  if (!isPlainObject(value)) return null;

  const id = asString(value.id);
  const slug = asString(value.slug);
  const name = asString(value.name);
  const category = asCategory(value.category);
  const durationMin = asNumber(value.durationMin);
  const priceRub = asNumber(value.priceRub);
  if (!id || !slug || !name || !category || durationMin === null || priceRub === null) return null;

  const rawDoctors = Array.isArray(value.doctorIds) ? value.doctorIds : [];
  const doctorIds: string[] = [];
  for (const item of rawDoctors) {
    const doctorId = asString(item);
    if (doctorId && !doctorIds.includes(doctorId)) doctorIds.push(doctorId);
  }

  return {
    id,
    slug,
    name,
    category,
    summary: asString(value.summary) ?? "",
    description: asString(value.description) ?? "",
    durationMin,
    priceRub,
    priceFrom: value.priceFrom === true,
    doctorIds,
  };
}

function normalizeDoctor(value: unknown): ClinicDoctor | null {
  if (!isPlainObject(value)) return null;

  const id = asString(value.id);
  const slug = asString(value.slug);
  const name = asString(value.name);
  const years = asNumber(value.years);
  if (!id || !slug || !name || years === null) return null;

  const rawDays = Array.isArray(value.workingDays) ? value.workingDays : [];
  const workingDays: Weekday[] = [];
  for (const item of rawDays) {
    const day = asWeekday(item);
    if (day !== null && !workingDays.includes(day)) workingDays.push(day);
  }

  const photo = asString(value.photo);
  const doctor: ClinicDoctor = {
    id,
    slug,
    name,
    role: asString(value.role) ?? "",
    focus: asString(value.focus) ?? "",
    years,
    quote: asString(value.quote) ?? "",
    workingDays,
  };
  if (photo) doctor.photo = photo;
  return doctor;
}

/** Документ → каталог. `null` — документ не той формы (вызывающий решает, что делать). */
function normalizeCatalog(value: unknown): Catalog | null {
  if (!isPlainObject(value)) return null;
  const servicesRaw = Array.isArray(value.services) ? value.services : null;
  const doctorsRaw = Array.isArray(value.doctors) ? value.doctors : null;
  if (!servicesRaw || !doctorsRaw) return null;

  const services: ClinicService[] = [];
  const seenServices = new Set<string>();
  for (const item of servicesRaw) {
    const record = normalizeService(item);
    if (!record || seenServices.has(record.id)) continue;
    seenServices.add(record.id);
    services.push(record);
  }

  const doctors: ClinicDoctor[] = [];
  const seenDoctors = new Set<string>();
  for (const item of doctorsRaw) {
    const record = normalizeDoctor(item);
    if (!record || seenDoctors.has(record.id)) continue;
    seenDoctors.add(record.id);
    doctors.push(record);
  }

  return {
    version: asNumber(value.version) ?? DOCUMENT_VERSION,
    updatedAt: asString(value.updatedAt) ?? new Date().toISOString(),
    services,
    doctors,
  };
}

/* -------------------------------------------------------------------------- */
/* Чтение                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Кэш живёт секунду. В файловом режиме это экономит чтение на каждый слот,
 * в Postgres-режиме — лишний запрос при серии обращений подряд. Дольше держать
 * нельзя: инстансы на проде друг о друге не знают.
 */
let cache: { catalog: Catalog; at: number } | null = null;

function invalidateCache(): void {
  cache = null;
}

function remember(catalog: Catalog): Catalog {
  cache = { catalog, at: Date.now() };
  return catalog;
}

/** Первый запуск: документ создаётся из сида один раз и под блокировкой. */
async function seedOnce(): Promise<Catalog> {
  const storage = await getStorage();
  const catalog = await storage.withLockedDocument<Catalog, Catalog>("catalog", async (current) => {
    if (current !== null) {
      const existing = normalizeCatalog(current) ?? seedCatalog();
      return { next: existing, result: existing };
    }
    const seeded = seedCatalog();
    return { next: seeded, result: seeded };
  });
  return remember(catalog);
}

/** Текущий каталог (с кэшем на секунду). Пустой документ создаётся из сида. */
export async function getCatalog(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.catalog;

  const storage = await getStorage();
  const state = await storage.readDocument<unknown>("catalog");

  if (state.state === "ok") {
    const normalized = normalizeCatalog(state.value);
    if (normalized) return remember(normalized);
    // Документ есть, но не той формы: работаем на сиде и не перезаписываем —
    // владелец должен увидеть проблему, а не потерять данные молча.
    console.warn("[catalog] документ каталога не читается, отдаю сид");
    return seedCatalog();
  }

  if (state.state === "corrupt") {
    console.warn("[catalog] документ каталога повреждён, отдаю сид");
    return seedCatalog();
  }

  return seedOnce();
}

export async function getCatalogForAdmin(): Promise<Catalog> {
  const catalog = await getCatalog();
  return {
    version: catalog.version,
    updatedAt: catalog.updatedAt,
    services: catalog.services.map(cloneService),
    doctors: catalog.doctors.map(cloneDoctor),
  };
}

function matchesIdOrSlug(item: { id: string; slug: string }, key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return item.id.toLowerCase() === normalized || item.slug.toLowerCase() === normalized;
}

export async function findService(
  idOrSlug: string | null | undefined,
): Promise<ClinicService | undefined> {
  if (!idOrSlug || idOrSlug.trim() === "") return undefined;
  const catalog = await getCatalog();
  return catalog.services.find((service) => matchesIdOrSlug(service, idOrSlug));
}

export async function findDoctor(
  idOrSlug: string | null | undefined,
): Promise<ClinicDoctor | undefined> {
  if (!idOrSlug || idOrSlug.trim() === "") return undefined;
  const catalog = await getCatalog();
  return catalog.doctors.find((doctor) => matchesIdOrSlug(doctor, idOrSlug));
}

/** Врачи, которые выполняют услугу (порядок — как в услуге). */
export async function doctorsForService(serviceId: string): Promise<ClinicDoctor[]> {
  const catalog = await getCatalog();
  const service = catalog.services.find((item) => item.id === serviceId);
  if (!service) return [];
  return service.doctorIds
    .map((id) => catalog.doctors.find((doctor) => doctor.id === id))
    .filter((doctor): doctor is ClinicDoctor => Boolean(doctor));
}

/** Выполняет ли врач эту услугу. Единственный источник правды — `service.doctorIds`. */
export async function doctorPerformsService(doctorId: string, serviceId: string): Promise<boolean> {
  const catalog = await getCatalog();
  const service = catalog.services.find((item) => item.id === serviceId);
  return Boolean(service && service.doctorIds.includes(doctorId));
}

/* -------------------------------------------------------------------------- */
/* Запись                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Атомарное «прочитать → изменить → записать» через слой хранения.
 * Каждая мутация поднимает `version` и обновляет `updatedAt`.
 */
async function mutateCatalog<T>(
  mutator: (catalog: Catalog) => { next?: Catalog; value: T } | Promise<{ next?: Catalog; value: T }>,
): Promise<T> {
  const storage = await getStorage();

  try {
    return await storage.withLockedDocument<Catalog, T>("catalog", async (current) => {
      const catalog = normalizeCatalog(current) ?? seedCatalog();
      const outcome = await mutator(catalog);
      const base = outcome.next ?? catalog;

      const next: Catalog = {
        version: Math.max(base.version, catalog.version) + 1,
        updatedAt: new Date().toISOString(),
        services: base.services.map(cloneService),
        doctors: base.doctors.map(cloneDoctor),
      };

      return { next, result: outcome.value };
    });
  } finally {
    // Даже при ошибке следующий читатель пойдёт в хранилище, а не в старый кэш.
    invalidateCache();
  }
}

/* -------------------------------------------------------------------------- */
/* Slug и id                                                                  */
/* -------------------------------------------------------------------------- */

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** «Лечение каналов» → `lechenie-kanalov`. */
export function slugify(value: string): string {
  const transliterated = value
    .toLowerCase()
    .split("")
    .map((char) => TRANSLIT[char] ?? char)
    .join("");

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

  return slug.length >= 2 ? slug : `item-${slug || "x"}`;
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let attempt = 2; attempt <= 99; attempt += 1) {
    const candidate = `${base}-${attempt}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * id генерируется случайно, а не из slug: иначе удалённая и заново созданная
 * услуга с тем же slug получила бы тот же id и «приклеила» старые брони.
 */
function generateId(prefix: "svc" | "dr", taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let suffix = "";
    for (let index = 0; index < ID_LENGTH; index += 1) {
      suffix += ID_ALPHABET[cryptoRandomIndex(ID_ALPHABET.length)];
    }
    const id = `${prefix}-${suffix}`;
    if (!taken.has(id)) return id;
  }
  throw new Error("Не удалось сгенерировать id записи каталога");
}

/* -------------------------------------------------------------------------- */
/* Мутации: услуги                                                            */
/* -------------------------------------------------------------------------- */

function validateDoctorIds(
  catalog: Catalog,
  doctorIds: readonly string[],
): { invalidIds: string[] } {
  const known = new Set(catalog.doctors.map((doctor) => doctor.id));
  const invalidIds: string[] = [];
  for (const id of doctorIds) {
    if (!known.has(id)) invalidIds.push(id);
  }
  return { invalidIds };
}

export async function createService(
  input: ServiceCreateInput,
): Promise<CatalogResult<ClinicService>> {
  return mutateCatalog<CatalogResult<ClinicService>>((catalog) => {
    const takenSlugs = new Set(catalog.services.map((service) => service.slug));
    if (input.slug && takenSlugs.has(input.slug)) {
      return { value: { ok: false, reason: "slug_taken", slug: input.slug } };
    }

    const check = validateDoctorIds(catalog, input.doctorIds);
    if (check.invalidIds.length > 0) {
      return { value: { ok: false, reason: "doctor_ids_invalid", ...check } };
    }

    const takenIds = new Set(catalog.services.map((service) => service.id));
    const record: ClinicService = {
      id: generateId("svc", takenIds),
      slug: uniqueSlug(input.slug ?? slugify(input.name), takenSlugs),
      category: input.category,
      name: input.name,
      summary: input.summary,
      description: input.description ?? "",
      durationMin: input.durationMin,
      priceRub: input.priceRub,
      priceFrom: input.priceFrom ?? false,
      doctorIds: [...input.doctorIds],
    };

    return {
      next: { ...catalog, services: [...catalog.services, record] },
      value: { ok: true, value: record },
    };
  });
}

export async function updateService(
  idOrSlug: string,
  patch: ServicePatchInput,
): Promise<CatalogResult<ClinicService>> {
  return mutateCatalog<CatalogResult<ClinicService>>((catalog) => {
    const index = catalog.services.findIndex((service) => matchesIdOrSlug(service, idOrSlug));
    const current = catalog.services[index];
    if (index === -1 || !current) return { value: { ok: false, reason: "not_found" } };

    if (patch.slug && patch.slug !== current.slug) {
      const taken = new Set(
        catalog.services.filter((service) => service.id !== current.id).map((service) => service.slug),
      );
      if (taken.has(patch.slug)) {
        return { value: { ok: false, reason: "slug_taken", slug: patch.slug } };
      }
    }

    if (patch.doctorIds) {
      const check = validateDoctorIds(catalog, patch.doctorIds);
      if (check.invalidIds.length > 0) {
        return { value: { ok: false, reason: "doctor_ids_invalid", ...check } };
      }
    }

    const updated: ClinicService = {
      ...current,
      name: patch.name ?? current.name,
      slug: patch.slug ?? current.slug,
      category: patch.category ?? current.category,
      summary: patch.summary ?? current.summary,
      description: patch.description ?? current.description,
      durationMin: patch.durationMin ?? current.durationMin,
      priceRub: patch.priceRub ?? current.priceRub,
      priceFrom: patch.priceFrom ?? current.priceFrom,
      doctorIds: patch.doctorIds ? [...patch.doctorIds] : current.doctorIds,
    };

    const services = [...catalog.services];
    services[index] = updated;
    return { next: { ...catalog, services }, value: { ok: true, value: updated } };
  });
}

/**
 * Удаляет услугу из каталога. Будущие брони проверяет роут (нужны две коллекции),
 * здесь — только целостность каталога.
 */
export async function deleteService(idOrSlug: string): Promise<CatalogResult<ClinicService>> {
  return mutateCatalog<CatalogResult<ClinicService>>((catalog) => {
    const index = catalog.services.findIndex((service) => matchesIdOrSlug(service, idOrSlug));
    const current = catalog.services[index];
    if (index === -1 || !current) return { value: { ok: false, reason: "not_found" } };

    return {
      next: { ...catalog, services: catalog.services.filter((service) => service.id !== current.id) },
      value: { ok: true, value: current },
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Мутации: врачи                                                             */
/* -------------------------------------------------------------------------- */

export async function createDoctor(input: DoctorCreateInput): Promise<CatalogResult<ClinicDoctor>> {
  return mutateCatalog<CatalogResult<ClinicDoctor>>((catalog) => {
    const takenSlugs = new Set(catalog.doctors.map((doctor) => doctor.slug));
    if (input.slug && takenSlugs.has(input.slug)) {
      return { value: { ok: false, reason: "slug_taken", slug: input.slug } };
    }

    const takenIds = new Set(catalog.doctors.map((doctor) => doctor.id));
    const record: ClinicDoctor = {
      id: generateId("dr", takenIds),
      slug: uniqueSlug(input.slug ?? slugify(input.name), takenSlugs),
      name: input.name,
      role: input.role,
      focus: input.focus,
      years: input.years,
      quote: input.quote ?? "",
      workingDays: [...input.workingDays],
    };
    if (input.photo) record.photo = input.photo;

    return {
      next: { ...catalog, doctors: [...catalog.doctors, record] },
      value: { ok: true, value: record },
    };
  });
}

export async function updateDoctor(
  idOrSlug: string,
  patch: DoctorPatchInput,
): Promise<CatalogResult<ClinicDoctor>> {
  return mutateCatalog<CatalogResult<ClinicDoctor>>((catalog) => {
    const index = catalog.doctors.findIndex((doctor) => matchesIdOrSlug(doctor, idOrSlug));
    const current = catalog.doctors[index];
    if (index === -1 || !current) return { value: { ok: false, reason: "not_found" } };

    if (patch.slug && patch.slug !== current.slug) {
      const taken = new Set(
        catalog.doctors.filter((doctor) => doctor.id !== current.id).map((doctor) => doctor.slug),
      );
      if (taken.has(patch.slug)) {
        return { value: { ok: false, reason: "slug_taken", slug: patch.slug } };
      }
    }

    const updated: ClinicDoctor = {
      ...current,
      name: patch.name ?? current.name,
      slug: patch.slug ?? current.slug,
      role: patch.role ?? current.role,
      focus: patch.focus ?? current.focus,
      years: patch.years ?? current.years,
      quote: patch.quote ?? current.quote,
      workingDays: patch.workingDays ? [...patch.workingDays] : current.workingDays,
    };

    if (patch.photo === undefined) {
      if (current.photo) updated.photo = current.photo;
    } else if (patch.photo === "") {
      delete updated.photo;
    } else {
      updated.photo = patch.photo;
    }

    const doctors = [...catalog.doctors];
    doctors[index] = updated;
    return { next: { ...catalog, doctors }, value: { ok: true, value: updated } };
  });
}

/**
 * Удаляет врача. Если он ещё указан в услугах — отказ `doctor_in_use`
 * со списком услуг: иначе услуга осталась бы без исполнителя.
 * Будущие брони проверяет роут.
 */
export async function deleteDoctor(idOrSlug: string): Promise<CatalogResult<ClinicDoctor>> {
  return mutateCatalog<CatalogResult<ClinicDoctor>>((catalog) => {
    const index = catalog.doctors.findIndex((doctor) => matchesIdOrSlug(doctor, idOrSlug));
    const current = catalog.doctors[index];
    if (index === -1 || !current) return { value: { ok: false, reason: "not_found" } };

    const holding = catalog.services.filter((service) => service.doctorIds.includes(current.id));
    if (holding.length > 0) {
      return {
        value: {
          ok: false,
          reason: "doctor_in_use",
          services: holding.map((service) => ({ id: service.id, name: service.name })),
        },
      };
    }

    return {
      next: { ...catalog, doctors: catalog.doctors.filter((doctor) => doctor.id !== current.id) },
      value: { ok: true, value: current },
    };
  });
}

