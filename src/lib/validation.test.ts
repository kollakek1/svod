/**
 * Тесты схем запросов: границы полей, нормализация телефона, ловушка
 * и заведомо неверные значения. Схемы — единственный вход в API, поэтому
 * проверяем их отдельно от роутов.
 */

import { describe, expect, it } from "vitest";

import {
  adminBookingSchema,
  bookingPatchSchema,
  doctorCreateSchema,
  publicBookingSchema,
  serviceCreateSchema,
} from "@/lib/validation";

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    serviceId: "svc-caries",
    doctorId: "dr-kovaleva",
    startsAt: "2026-11-24T10:00:00+03:00",
    patient: { name: "Мария", phone: "+7 916 123-45-67" },
    consent: true,
    website: "",
    formStartedAt: Date.now() - 10_000,
    ...overrides,
  };
}

describe("публичная заявка", () => {
  it("нормализует телефон из формы", () => {
    for (const phone of ["8 916 123-45-67", "+7 (916) 123 45 67", "9161234567"]) {
      const parsed = publicBookingSchema.safeParse(payload({ patient: { name: "Мария", phone } }));
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.patient.phone).toBe("+79161234567");
    }
  });

  it("отклоняет мусор в телефоне и указывает поле", () => {
    const parsed = publicBookingSchema.safeParse(
      payload({ patient: { name: "Мария", phone: "12345" } }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path.join(".")).toBe("patient.phone");
    }
  });

  it("проверяет имя и комментарий", () => {
    expect(publicBookingSchema.safeParse(payload({ patient: { name: "М", phone: "9161234567" } })).success).toBe(false);
    expect(
      publicBookingSchema.safeParse(
        payload({ patient: { name: "Мария", phone: "9161234567", comment: "я".repeat(501) } }),
      ).success,
    ).toBe(false);
    expect(
      publicBookingSchema.safeParse(
        payload({ patient: { name: "Мария", phone: "9161234567", comment: "" } }),
      ).success,
    ).toBe(true);
  });

  it("требует согласие на обработку данных", () => {
    expect(publicBookingSchema.safeParse(payload({ consent: false })).success).toBe(false);
    expect(publicBookingSchema.safeParse(payload({ consent: undefined })).success).toBe(false);
  });

  it("принимает пустой email и пустую ловушку как норму", () => {
    const parsed = publicBookingSchema.safeParse(
      payload({ patient: { name: "Мария", phone: "9161234567", email: "" } }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.patient.email).toBeUndefined();

    // Заполненную ловушку схема пропускает намеренно: решение принимает роут,
    // иначе бот по коду ошибки поймёт, что ловушка сработала.
    expect(publicBookingSchema.safeParse(payload({ website: "spam" })).success).toBe(true);
  });

  it("приводит formStartedAt к числу и не падает на мусоре", () => {
    const numeric = publicBookingSchema.safeParse(payload({ formStartedAt: "1763900000000" }));
    expect(numeric.success).toBe(true);
    if (numeric.success) expect(numeric.data.formStartedAt).toBe(1763900000000);

    const garbage = publicBookingSchema.safeParse(payload({ formStartedAt: "вчера" }));
    expect(garbage.success).toBe(true);
    if (garbage.success) expect(garbage.data.formStartedAt).toBeUndefined();
  });
});

describe("админская запись и правка", () => {
  it("разрешает сразу подтвердить и не знает про honeypot", () => {
    const parsed = adminBookingSchema.safeParse({
      ...payload(),
      status: "confirmed",
      note: "запись по телефону",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.status).toBe("confirmed");
  });

  it("не даёт создать запись сразу в финальном статусе", () => {
    expect(adminBookingSchema.safeParse({ ...payload(), status: "done" }).success).toBe(false);
  });

  it("правка требует хотя бы одно поле", () => {
    expect(bookingPatchSchema.safeParse({}).success).toBe(false);
    expect(bookingPatchSchema.safeParse({ note: null }).success).toBe(true);
    expect(bookingPatchSchema.safeParse({ status: "confirmed" }).success).toBe(true);
    expect(bookingPatchSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});

describe("каталог", () => {
  const service = {
    name: "Лечение кариеса",
    category: "Терапия",
    summary: "Реставрация под микроскопом",
    durationMin: 90,
    priceRub: 14_500,
    doctorIds: ["dr-kovaleva"],
  };

  it("принимает корректную услугу и считает slug необязательным", () => {
    const parsed = serviceCreateSchema.safeParse(service);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.slug).toBeUndefined();
  });

  it("проверяет категорию, шаг длительности и врачей", () => {
    expect(serviceCreateSchema.safeParse({ ...service, category: "Косметология" }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ ...service, durationMin: 20 }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ ...service, doctorIds: [] }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ ...service, priceRub: -1 }).success).toBe(false);
  });

  const doctor = {
    name: "Анна Ковалёва",
    role: "терапевт, эндодонтист",
    focus: "Каналы и кариес",
    years: 12,
    workingDays: [1, 2, 3],
  };

  it("принимает корректного врача", () => {
    expect(doctorCreateSchema.safeParse(doctor).success).toBe(true);
  });

  it("требует рабочие дни без повторов и валидный путь к фото", () => {
    expect(doctorCreateSchema.safeParse({ ...doctor, workingDays: [] }).success).toBe(false);
    expect(doctorCreateSchema.safeParse({ ...doctor, workingDays: [1, 1] }).success).toBe(false);
    expect(doctorCreateSchema.safeParse({ ...doctor, workingDays: [9] }).success).toBe(false);
    expect(doctorCreateSchema.safeParse({ ...doctor, photo: "../etc/passwd" }).success).toBe(false);
    expect(doctorCreateSchema.safeParse({ ...doctor, photo: "/images/team/a.webp" }).success).toBe(true);
  });
});
