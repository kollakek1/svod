/**
 * Доменные типы клиники СВОД.
 *
 * Это контракт между сайтом, API и админкой. Меняя поле здесь, нужно
 * обновить `src/content/clinic.ts` (сид каталога) и документацию `docs/api.md`.
 *
 * Правила, которые держит этот файл:
 * - id стабильны и не выводятся из имени: переименование услуги не ломает брони;
 * - цена и длительность всегда приходят с сервера из каталога, клиент их не присылает;
 * - время хранится в ISO 8601 с зоной, все вычисления — в `Europe/Moscow`.
 */

/** 0 — воскресенье, 6 — суббота (как `Date#getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export const WEEKDAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  0: { short: "вс", long: "воскресенье" },
  1: { short: "пн", long: "понедельник" },
  2: { short: "вт", long: "вторник" },
  3: { short: "ср", long: "среда" },
  4: { short: "чт", long: "четверг" },
  5: { short: "пт", long: "пятница" },
  6: { short: "сб", long: "суббота" },
};

export const SERVICE_CATEGORIES = [
  "Диагностика",
  "Гигиена",
  "Терапия",
  "Ортопедия",
  "Имплантация",
  "Дети",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export interface ClinicService {
  /** Стабильный id: `svc-caries`. Никогда не равен имени и не меняется при переименовании. */
  id: string;
  slug: string;
  category: ServiceCategory;
  name: string;
  /** Одна строка для карточки и предпросмотра в записи. */
  summary: string;
  /** 1–3 предложения: что входит, чем отличается. */
  description: string;
  durationMin: number;
  priceRub: number;
  /** Показывать «от», если итоговая цена зависит от объёма. */
  priceFrom: boolean;
  /** Кто выполняет услугу. Обратная связь мастера → услуги выводится из этого поля. */
  doctorIds: string[];
}

export interface ClinicDoctor {
  id: string;
  slug: string;
  name: string;
  /** Короткая роль в интерфейсе: «терапевт, эндодонтист». */
  role: string;
  /** Чем занимается, одна строка. */
  focus: string;
  years: number;
  /** Цитата врача для карточки. Одна фраза, без пафоса. */
  quote: string;
  workingDays: Weekday[];
  /** Путь к фото в /public. Если нет — карточка показывает типографскую плиту. */
  photo?: string;
}

export interface DayHours {
  weekday: Weekday;
  /** `null` — клиника закрыта. Формат `HH:MM`, локальное время клиники. */
  opensAt: string | null;
  closesAt: string | null;
}

export interface ClinicSettings {
  name: string;
  timezone: "Europe/Moscow";
  /** Шаг сетки слотов в минутах. */
  slotStepMin: number;
  /** Сколько минут нужно до начала приёма, чтобы записаться онлайн. */
  minLeadMinutes: number;
  /** На сколько дней вперёд открыта запись. */
  horizonDays: number;
  hours: DayHours[];
}

export interface Catalog {
  version: number;
  updatedAt: string;
  services: ClinicService[];
  doctors: ClinicDoctor[];
}

export type BookingStatus = "pending" | "confirmed" | "done" | "cancelled" | "no-show";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Новая",
  confirmed: "Подтверждена",
  done: "Принята",
  cancelled: "Отменена",
  "no-show": "Не пришёл",
};

export interface BookingPatient {
  name: string;
  phone: string;
  email?: string;
  comment?: string;
}

export interface BookingHistoryEntry {
  at: string;
  /** Кто изменил: `site`, `admin` или имя сотрудника. */
  by: string;
  note: string;
  status?: BookingStatus;
}

export interface Booking {
  code: string;
  serviceId: string;
  /** Снапшот названия на момент записи: услугу можно переименовать и даже удалить. */
  serviceName: string;
  doctorId: string;
  doctorName: string;
  /** ISO 8601 с явной зоной, например `2026-11-24T10:00:00+03:00`. */
  startsAt: string;
  endsAt: string;
  durationMin: number;
  priceRub: number;
  patient: BookingPatient;
  status: BookingStatus;
  source: "site" | "admin";
  consentAt: string;
  createdAt: string;
  updatedAt: string;
  history: BookingHistoryEntry[];
}

export interface AvailabilityDay {
  /** `YYYY-MM-DD` в зоне клиники. */
  date: string;
  /** ISO-метки начал свободных слотов, отсортированы. */
  slots: string[];
}

export interface AvailabilityResponse {
  serviceId: string;
  doctorId: string;
  durationMin: number;
  priceRub: number;
  timezone: string;
  days: AvailabilityDay[];
}

export interface PublicCatalogResponse {
  services: ClinicService[];
  doctors: ClinicDoctor[];
  updatedAt: string;
}

export type AdminRole = "owner" | "manager";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/* ─── Чистые помощники, общие для сервера и клиента ─────────────────────── */

export function servicesForDoctor(catalog: Catalog, doctorId: string): ClinicService[] {
  return catalog.services.filter((service) => service.doctorIds.includes(doctorId));
}

export function resolveService(catalog: Catalog, idOrSlug: string | null | undefined): ClinicService | undefined {
  const key = (idOrSlug ?? "").trim().toLowerCase();
  if (!key) return undefined;
  return catalog.services.find((service) => service.id === key || service.slug === key);
}

export function resolveDoctor(catalog: Catalog, idOrSlug: string | null | undefined): ClinicDoctor | undefined {
  const key = (idOrSlug ?? "").trim().toLowerCase();
  if (!key) return undefined;
  return catalog.doctors.find((doctor) => doctor.id === key || doctor.slug === key);
}

export function doctorsForService(catalog: Catalog, serviceId: string): ClinicDoctor[] {
  const service = catalog.services.find((item) => item.id === serviceId);
  if (!service) return [];
  return service.doctorIds
    .map((id) => catalog.doctors.find((doctor) => doctor.id === id))
    .filter((doctor): doctor is ClinicDoctor => Boolean(doctor));
}

export function isDoctorAvailableForService(catalog: Catalog, doctorId: string, serviceId: string): boolean {
  const service = catalog.services.find((item) => item.id === serviceId);
  return Boolean(service && service.doctorIds.includes(doctorId));
}

/** Стабильный код брони: SVD-7K3M, без похожих символов (0/O, 1/I). */
export const BOOKING_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function isBookingCode(value: string): boolean {
  return /^SVD-[2-9A-HJ-NP-Z]{4}$/.test(value.trim().toUpperCase());
}
