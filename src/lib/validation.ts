/**
 * Zod-схемы API. Единственное место, где описано, что клиент вправе прислать.
 *
 * Правила:
 * - цена, длительность и статус публичной заявки здесь отсутствуют: эти значения
 *   берутся из серверного каталога и никогда — из тела запроса;
 * - поля ошибок называются так же, как поля формы (`phone`, а не `patient.phone`);
 * - honeypot `website` намеренно принимается схемой: отклонять его — значит
 *   подсказывать боту, что ловушка сработала.
 */

import { z } from "zod";

import { normalizePhone, parseDateKey } from "./booking";
import {
  SERVICE_CATEGORIES,
  type BookingStatus,
  type ServiceCategory,
  type Weekday,
} from "./clinic";

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const dateKeySchema = z
  .string({ error: "Укажите дату" })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD")
  .refine((value) => parseDateKey(value) !== null, "Такой даты не существует");

/* -------------------------------------------------------------------------- */
/* Публичная доступность                                                      */
/* -------------------------------------------------------------------------- */

export const availabilityQuerySchema = z.object({
  serviceId: z.string({ error: "Укажите услугу" }).trim().min(1, "Укажите услугу"),
  doctorId: z.string({ error: "Укажите врача" }).trim().min(1, "Укажите врача"),
  from: dateKeySchema.optional(),
  days: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : Number(value)),
    z
      .number({ error: "days — число дней от 1 до 31" })
      .int("days — целое число")
      .min(1, "days — от 1 до 31")
      .max(31, "days — от 1 до 31")
      .optional(),
  ),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

/* -------------------------------------------------------------------------- */
/* Запись                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Телефон нормализуется прямо в схеме: дальше по коду он всегда `+7XXXXXXXXXX`,
 * а ошибка приходит в поле `phone`, как её ждёт форма.
 */
const phoneSchema = z
  .string({ error: "Укажите телефон" })
  .trim()
  .min(1, "Укажите телефон")
  .max(32, "Слишком длинный номер телефона")
  .refine((value) => normalizePhone(value) !== null, "Укажите российский номер: +7 916 123-45-67")
  .transform((value) => normalizePhone(value) as string);

const patientSchema = z.object({
  name: z
    .string({ error: "Укажите имя" })
    .trim()
    .min(2, "Имя — не короче 2 символов")
    .max(80, "Имя — не длиннее 80 символов"),
  phone: phoneSchema,
  email: z.preprocess(
    emptyToUndefined,
    z.email("Проверьте адрес электронной почты").max(120, "Слишком длинный email").optional(),
  ),
  comment: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500, "Комментарий — не длиннее 500 символов").optional(),
  ),
});

const bookingCoreSchema = z.object({
  serviceId: z.string({ error: "Выберите услугу" }).trim().min(1, "Выберите услугу"),
  doctorId: z.string({ error: "Выберите врача" }).trim().min(1, "Выберите врача"),
  startsAt: z
    .string({ error: "Выберите время" })
    .trim()
    .min(1, "Выберите время")
    .max(40, "Время указано неверно"),
  patient: patientSchema,
});

/**
 * Публичная форма.
 *
 * `website` — ловушка (honeypot): человек её не видит и не заполняет.
 * `formStartedAt` — момент открытия формы; заявка быстрее 3 секунд считается ботом.
 */
export const publicBookingSchema = bookingCoreSchema.extend({
  consent: z.literal(true, { error: "Без согласия на обработку данных записать нельзя" }),
  website: z.string().max(200, "Слишком длинное значение").optional(),
  formStartedAt: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }, z.number().optional()),
});

export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

/** Ручная запись администратора: тот же слот и пациент, статус — по выбору. */
export const adminBookingSchema = bookingCoreSchema.extend({
  status: z.enum(["pending", "confirmed"], { error: "Статус: pending или confirmed" }).optional(),
  note: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000, "Заметка — до 1000 символов").optional(),
  ),
});

export type AdminBookingInput = z.infer<typeof adminBookingSchema>;

export const bookingPatchSchema = z
  .object({
    status: z
      .enum(["pending", "confirmed", "done", "cancelled", "no-show"], {
        error: "Неизвестный статус",
      })
      .optional(),
    /** `null` стирает заметку, отсутствие поля — не менять. */
    note: z
      .string()
      .trim()
      .max(1000, "Заметка — до 1000 символов")
      .nullable()
      .optional(),
  })
  .refine((value) => value.status !== undefined || value.note !== undefined, {
    message: "Нет полей для изменения",
    path: ["status"],
  });

export type BookingPatchInput = z.infer<typeof bookingPatchSchema>;

/** Проверка статуса из query-параметра списка. */
export function parseStatusFilter(value: string | null | undefined): BookingStatus | "all" | null {
  const normalized = (value ?? "all").trim().toLowerCase();
  if (normalized === "" || normalized === "all") return "all";
  const known: BookingStatus[] = ["pending", "confirmed", "done", "cancelled", "no-show"];
  return (known as readonly string[]).includes(normalized) ? (normalized as BookingStatus) : null;
}

/* -------------------------------------------------------------------------- */
/* Вход в админку                                                             */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z
    .string({ error: "Укажите email" })
    .trim()
    .min(1, "Укажите email")
    .max(120, "Слишком длинный email"),
  password: z
    .string({ error: "Укажите пароль" })
    .min(1, "Укажите пароль")
    .max(200, "Слишком длинный пароль"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/* -------------------------------------------------------------------------- */
/* Каталог: услуги                                                            */
/* -------------------------------------------------------------------------- */

function normalizeSlugInput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const slugSchema = z.preprocess(
  normalizeSlugInput,
  z
    .string()
    .min(2, "slug — минимум 2 символа")
    .max(48, "slug — максимум 48 символов")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug: латиница, цифры и дефис между словами"),
);

const nameSchema = z
  .string({ error: "Укажите название" })
  .trim()
  .min(2, "Название — от 2 символов")
  .max(80, "Название — до 80 символов");

const serviceDurationSchema = z.coerce
  .number({ error: "Укажите длительность в минутах" })
  .int("Длительность — целое число минут")
  .min(15, "Минимум 15 минут")
  .max(300, "Максимум 300 минут")
  .refine((value) => value % 15 === 0, "Длительность кратна 15 минутам");

const priceSchema = z.coerce
  .number({ error: "Укажите цену" })
  .int("Цена — целое число рублей")
  .min(0, "Цена не может быть отрицательной")
  .max(1_000_000, "Цена — не больше 1 000 000 ₽");

const doctorIdsSchema = z
  .array(z.string().trim().min(1), { error: "Выберите врачей" })
  .min(1, "Выберите хотя бы одного врача")
  .max(20, "Слишком много врачей")
  .refine((ids) => new Set(ids).size === ids.length, "Врачи не должны повторяться");

export const serviceCreateSchema = z.object({
  name: nameSchema,
  slug: slugSchema.optional(),
  category: z.enum(SERVICE_CATEGORIES, { error: "Выберите категорию из списка" }),
  summary: z
    .string({ error: "Добавьте короткое описание" })
    .trim()
    .min(2, "Короткое описание — от 2 символов")
    .max(160, "Короткое описание — до 160 символов"),
  description: z.string().trim().max(600, "Описание — до 600 символов").optional(),
  durationMin: serviceDurationSchema,
  priceRub: priceSchema,
  priceFrom: z.boolean().optional(),
  doctorIds: doctorIdsSchema,
});

export const servicePatchSchema = serviceCreateSchema.partial();

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServicePatchInput = z.infer<typeof servicePatchSchema>;

/* -------------------------------------------------------------------------- */
/* Каталог: врачи                                                             */
/* -------------------------------------------------------------------------- */

const weekdaySchema = z.coerce
  .number({ error: "День недели — число 0–6" })
  .int("День недели — целое число")
  .min(0, "День недели — 0–6")
  .max(6, "День недели — 0–6");

const workingDaysSchema = z
  .array(weekdaySchema, { error: "Выберите рабочие дни" })
  .min(1, "Выберите хотя бы один рабочий день")
  .refine((days) => new Set(days).size === days.length, "Дни недели не должны повторяться")
  .transform((days) => days as Weekday[]);

export const doctorCreateSchema = z.object({
  name: nameSchema,
  slug: slugSchema.optional(),
  role: z
    .string({ error: "Укажите специализацию" })
    .trim()
    .min(2, "Специализация — от 2 символов")
    .max(80, "Специализация — до 80 символов"),
  focus: z
    .string({ error: "Опишите, что ведёт врач" })
    .trim()
    .min(2, "Строка о враче — от 2 символов")
    .max(160, "Строка о враче — до 160 символов"),
  years: z.coerce
    .number({ error: "Укажите стаж" })
    .int("Стаж — целое число лет")
    .min(0, "Стаж не может быть отрицательным")
    .max(60, "Стаж — не больше 60 лет"),
  quote: z.string().trim().max(240, "Цитата — до 240 символов").optional(),
  workingDays: workingDaysSchema,
  photo: z
    .string()
    .trim()
    .max(200, "Путь к фото — до 200 символов")
    .refine(
      (value) => value === "" || (/^\/images\/[A-Za-z0-9._/-]+$/.test(value) && !value.includes("..")),
      "Путь к фото должен начинаться с /images/ и не содержать ..",
    )
    .optional(),
});

export const doctorPatchSchema = doctorCreateSchema.partial();

export type DoctorCreateInput = z.infer<typeof doctorCreateSchema>;
export type DoctorPatchInput = z.infer<typeof doctorPatchSchema>;

/** Категории услуг — для админского селекта. */
export const serviceCategories: readonly ServiceCategory[] = SERVICE_CATEGORIES;
