/**
 * Хранилище броней на реальном файловом драйвере (временная папка, без сети):
 * атомарность, снапшоты, статусы, история и публичные представления.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DOCTORS_SEED, HOURS, SERVICES_SEED, SETTINGS } from "@/content/clinic";

import {
  createBooking,
  findBookingByCode,
  futureBookings,
  listBookings,
  toAdminBooking,
  toPublicBooking,
  updateBooking,
  type CreateBookingInput,
} from "@/lib/booking-store";
import { isBookingCode, type ClinicDoctor, type ClinicService } from "@/lib/clinic";
import { documentFilePath } from "@/lib/storage/file-driver";

const NOW = new Date("2026-11-20T07:00:00.000Z"); // 10:00 по Москве, пятница
const TUESDAY_10 = "2026-11-24T10:00:00+03:00";
const ACTOR = "owner@svod.dental";

const SERVICE = SERVICES_SEED.find((service) => service.id === "svc-caries") as ClinicService;
const DOCTOR = DOCTORS_SEED.find((doctor) => doctor.id === "dr-kovaleva") as ClinicDoctor;

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "svod-bookings-"));
});

afterAll(() => {
  delete process.env.SVOD_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.SVOD_DATA_DIR = dir;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
});

function input(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
  return {
    service: SERVICE,
    doctor: DOCTOR,
    startsAt: TUESDAY_10,
    patient: { name: "Мария", phone: "+79161234567", comment: "Болит справа" },
    schedule: { settings: SETTINGS, hours: HOURS },
    source: "site",
    status: "pending",
    actor: "site",
    now: NOW,
    ...overrides,
  };
}

describe("создание брони", () => {
  it("пишет pending со снапшотами и кодом SVD-XXXX", async () => {
    const result = await createBooking(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const booking = result.booking;
    expect(isBookingCode(booking.code)).toBe(true);
    expect(booking.status).toBe("pending");
    expect(booking.source).toBe("site");
    expect(booking.serviceId).toBe(SERVICE.id);
    expect(booking.serviceName).toBe(SERVICE.name);
    expect(booking.doctorId).toBe(DOCTOR.id);
    expect(booking.doctorName).toBe(DOCTOR.name);
    expect(booking.durationMin).toBe(SERVICE.durationMin);
    expect(booking.priceRub).toBe(SERVICE.priceRub);
    expect(booking.startsAt).toBe(TUESDAY_10);
    expect(booking.endsAt).toBe("2026-11-24T11:30:00+03:00");
    expect(booking.consentAt).toBeTruthy();
    expect(booking.history).toHaveLength(1);
    expect(booking.history[0]?.by).toBe("site");
  });

  it("не даёт занять один слот дважды и ничего не дописывает", async () => {
    const first = await createBooking(input());
    expect(first.ok).toBe(true);

    const second = await createBooking(
      input({ patient: { name: "Пётр", phone: "+79161234568" } }),
    );
    expect(second).toMatchObject({ ok: false, reason: "slot_taken" });
    expect(await listBookings()).toHaveLength(1);
  });

  it("атомарен при одновременных запросах на один слот", async () => {
    const results = await Promise.all([
      createBooking(input({ patient: { name: "Мария", phone: "+79161234567" } })),
      createBooking(input({ patient: { name: "Пётр", phone: "+79161234568" } })),
      createBooking(input({ patient: { name: "Ольга", phone: "+79161234569" } })),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.reason === "slot_taken")).toHaveLength(2);
    expect(await listBookings()).toHaveLength(1);
  });

  it("хранит документ как массив броней", async () => {
    await createBooking(input());
    const raw: unknown = JSON.parse(readFileSync(documentFilePath("bookings"), "utf8"));
    expect(Array.isArray(raw)).toBe(true);
  });

  it("не принимает время вне сетки и прошедшую дату", async () => {
    const offGrid = await createBooking(input({ startsAt: "2026-11-24T10:15:00+03:00" }));
    expect(offGrid).toMatchObject({ ok: false, reason: "invalid_slot" });

    const past = await createBooking(input({ startsAt: "2026-11-19T10:00:00+03:00" }));
    expect(past).toMatchObject({ ok: false, reason: "slot_in_past" });
    expect(await listBookings()).toEqual([]);
  });
});

describe("представления", () => {
  it("публичная карточка не содержит личных данных", async () => {
    const result = await createBooking(input());
    if (!result.ok) throw new Error("бронь не создалась");

    const card = toPublicBooking(result.booking);
    expect(Object.keys(card).sort()).toEqual(
      ["code", "doctorName", "endsAt", "priceRub", "serviceName", "startsAt", "status"].sort(),
    );
    expect(JSON.stringify(card)).not.toContain("9161234567");
    expect(JSON.stringify(card)).not.toContain("Болит справа");
  });

  it("админская карточка отдаёт телефон, комментарий и заметку", async () => {
    const result = await createBooking(input({ source: "admin", status: "confirmed", note: "по телефону" }));
    if (!result.ok) throw new Error("бронь не создалась");

    const view = toAdminBooking(result.booking);
    expect(view.patient.phone).toBe("+79161234567");
    expect(view.patient.comment).toBe("Болит справа");
    expect(view.note).toBe("по телефону");
    expect(view.status).toBe("confirmed");
  });
});

describe("статусы и история", () => {
  it("меняет статус и пишет историю", async () => {
    const created = await createBooking(input());
    if (!created.ok) throw new Error("бронь не создалась");

    const updated = await updateBooking(created.booking.code, {
      status: "confirmed",
      actor: ACTOR,
      now: NOW,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(updated.booking.status).toBe("confirmed");
    expect(updated.booking.history).toHaveLength(2);
    expect(updated.booking.history[1]).toMatchObject({ by: ACTOR, status: "confirmed" });
    expect(updated.booking.updatedAt).not.toBe(created.booking.updatedAt);
  });

  it("запрещает бессмысленный переход", async () => {
    const created = await createBooking(input());
    if (!created.ok) throw new Error("бронь не создалась");

    await updateBooking(created.booking.code, { status: "confirmed", actor: ACTOR, now: NOW });
    const back = await updateBooking(created.booking.code, {
      status: "pending",
      actor: ACTOR,
      now: NOW,
    });

    expect(back).toMatchObject({ ok: false, reason: "invalid_transition" });
  });

  it("не возвращает в расписание бронь на уже занятое время", async () => {
    const first = await createBooking(input());
    if (!first.ok) throw new Error("бронь не создалась");

    // Отмена освобождает слот — второй гость может занять это время.
    const cancelled = await updateBooking(first.booking.code, {
      status: "cancelled",
      actor: ACTOR,
      now: NOW,
    });
    expect(cancelled.ok).toBe(true);

    const second = await createBooking(
      input({ patient: { name: "Пётр", phone: "+79161234568" } }),
    );
    expect(second.ok).toBe(true);

    const restore = await updateBooking(first.booking.code, {
      status: "confirmed",
      actor: ACTOR,
      now: NOW,
    });
    expect(restore).toMatchObject({ ok: false, reason: "slot_taken" });
  });

  it("пишет заметку администратора и не теряет статус", async () => {
    const created = await createBooking(input());
    if (!created.ok) throw new Error("бронь не создалась");

    const noted = await updateBooking(created.booking.code, {
      note: "Просила позвонить за час",
      actor: ACTOR,
      now: NOW,
    });
    expect(noted.ok).toBe(true);
    if (!noted.ok) return;

    expect(noted.booking.status).toBe("pending");
    expect(noted.booking.note).toBe("Просила позвонить за час");
    expect(noted.booking.history.at(-1)?.note).toBe("Заметка обновлена");

    const cleared = await updateBooking(created.booking.code, {
      note: null,
      actor: ACTOR,
      now: NOW,
    });
    expect(cleared.ok && cleared.booking.note).toBeNull();
  });

  it("ищет бронь по коду без учёта регистра", async () => {
    const created = await createBooking(input());
    if (!created.ok) throw new Error("бронь не создалась");

    const found = await findBookingByCode(created.booking.code.toLowerCase());
    expect(found?.code).toBe(created.booking.code);
  });
});

describe("гард удаления каталога", () => {
  it("видит только будущие активные брони", async () => {
    const created = await createBooking(input());
    if (!created.ok) throw new Error("бронь не создалась");

    const all = await listBookings();
    const serviceMatch = (code: string) => (booking: { serviceId: string }) =>
      booking.serviceId === code;

    expect(futureBookings(all, serviceMatch(SERVICE.id), NOW)).toHaveLength(1);
    // Через сутки после приёма бронь уже в прошлом — удалять услугу можно.
    expect(futureBookings(all, serviceMatch(SERVICE.id), new Date("2026-11-25T10:00:00+03:00"))).toHaveLength(0);

    await updateBooking(created.booking.code, { status: "cancelled", actor: ACTOR, now: NOW });
    const afterCancel = await listBookings();
    expect(futureBookings(afterCancel, serviceMatch(SERVICE.id), NOW)).toHaveLength(0);
  });

  it("возвращает код, дату и имя для списка конфликтов", async () => {
    const created = await createBooking(input());
    if (!created.ok) throw new Error("бронь не создалась");

    const conflicts = futureBookings(
      await listBookings(),
      (booking) => booking.doctorId === DOCTOR.id,
      NOW,
    );
    expect(conflicts[0]).toMatchObject({
      code: created.booking.code,
      date: "2026-11-24",
      name: "Мария",
    });
  });
});
