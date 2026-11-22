/**
 * Тесты логики записи. `booking.ts` сознательно чистый — ни базы, ни
 * `next/headers`, — поэтому проверяется напрямую, без моков и без сервера.
 *
 * Фиксированное «сейчас»: 20 ноября 2026, 10:00 по Москве (пятница).
 * Рабочий день для большинства тестов — понедельник 23 ноября 2026.
 */

import { describe, expect, it } from "vitest";

import { HOURS, SETTINGS } from "@/content/clinic";

import {
  addDays,
  availabilityDays,
  availableSlotsForDay,
  bookingTransitionMessage,
  canTransitionBooking,
  checkSlot,
  createRateLimiter,
  formatMoscowIso,
  formatMoscowIsoFromMs,
  generateBookingCode,
  generateUniqueBookingCode,
  gridStarts,
  intervalsOverlap,
  isSlotBusy,
  looksLikeSpam,
  maskPhone,
  moscowInstantMs,
  moscowWallClock,
  normalizePhone,
  occupiesSlot,
  openDay,
  parseDateKey,
  parseMoscowInstant,
  weekdayOfDateKey,
  type Schedule,
} from "@/lib/booking";
import { isBookingCode, type Booking, type Weekday } from "@/lib/clinic";

const NOW = new Date("2026-11-20T07:00:00.000Z"); // 10:00 по Москве, пятница
const TODAY = "2026-11-20";
const MONDAY = "2026-11-23";

const SCHEDULE: Schedule = { settings: SETTINGS, hours: HOURS };
const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5];

function ms(dateKey: string, minutes: number): number {
  const value = moscowInstantMs(dateKey, minutes);
  if (value === null) throw new Error(`bad moment ${dateKey} ${minutes}`);
  return value;
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    code: "SVD-TEST",
    serviceId: "svc-caries",
    serviceName: "Лечение кариеса под микроскопом",
    doctorId: "dr-kovaleva",
    doctorName: "Анна Ковалёва",
    startsAt: `${MONDAY}T11:00:00+03:00`,
    endsAt: `${MONDAY}T12:30:00+03:00`,
    durationMin: 90,
    priceRub: 14_500,
    patient: { name: "Мария", phone: "+79161234567" },
    status: "pending",
    source: "site",
    consentAt: NOW.toISOString(),
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    history: [],
    ...overrides,
  };
}

function slotsFor(date: string, overrides: Partial<Parameters<typeof availableSlotsForDay>[0]> = {}) {
  return availableSlotsForDay({
    date,
    durationMin: 90,
    doctorId: "dr-kovaleva",
    doctorWorkingDays: WEEKDAYS,
    schedule: SCHEDULE,
    bookings: [],
    now: NOW,
    ...overrides,
  });
}

describe("даты, время и часовой пояс", () => {
  it("разбирает корректную дату и отбрасывает несуществующую", () => {
    expect(parseDateKey("2026-11-23")).toEqual({ year: 2026, month: 11, day: 23 });
    expect(parseDateKey("2026-02-30")).toBeNull();
    expect(parseDateKey("23.11.2026")).toBeNull();
    expect(parseDateKey("2026-13-01")).toBeNull();
  });

  it("считает день недели", () => {
    expect(weekdayOfDateKey("2026-11-22")).toBe(0); // воскресенье
    expect(weekdayOfDateKey("2026-11-23")).toBe(1); // понедельник
    expect(weekdayOfDateKey("2026-11-28")).toBe(6); // суббота
  });

  it("переводит московское время в UTC+3 без DST", () => {
    expect(moscowInstantMs(MONDAY, 10 * 60)).toBe(Date.UTC(2026, 10, 23, 7, 0));
    expect(moscowInstantMs(MONDAY, 10 * 60)).toBe(Date.parse("2026-11-23T10:00:00+03:00"));
    expect(moscowWallClock(NOW)).toMatchObject({ dateKey: TODAY, minutesOfDay: 600 });
  });

  it("печатает и разбирает ISO с явной зоной", () => {
    expect(formatMoscowIso(MONDAY, 600)).toBe("2026-11-23T10:00:00+03:00");
    expect(formatMoscowIsoFromMs(ms(MONDAY, 600) + 90 * 60_000)).toBe("2026-11-23T11:30:00+03:00");

    expect(parseMoscowInstant("2026-11-23T10:00:00+03:00")).toMatchObject({
      dateKey: MONDAY,
      minutesOfDay: 600,
    });
    // Любой корректный ISO переводится в московское настенное время.
    expect(parseMoscowInstant("2026-11-23T07:00:00.000Z")).toMatchObject({
      dateKey: MONDAY,
      minutesOfDay: 600,
    });
    // Секунды ломают сетку.
    expect(parseMoscowInstant("2026-11-23T10:00:30+03:00")).toBeNull();
    expect(parseMoscowInstant("не время")).toBeNull();
  });

  it("складывает дни через границу года", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays(TODAY, 60)).toBe("2027-01-19");
  });
});

describe("сетка слотов", () => {
  it("идёт от открытия до closesAt − duration", () => {
    const day = openDay(HOURS, 1);
    expect(day).not.toBeNull();
    const starts = gridStarts(day!, 90, 30);
    expect(starts[0]).toBe(9 * 60);
    expect(starts[starts.length - 1]).toBe(19 * 60 + 30); // 19:30 + 1:30 = 21:00
    expect(starts).toHaveLength(22);
    // Старт ровно в закрытие в сетку не попадает.
    expect(starts).not.toContain(21 * 60);
  });

  it("отдаёт все свободные старты дня в ISO", () => {
    const slots = slotsFor(MONDAY);
    expect(slots[0]).toBe("2026-11-23T09:00:00+03:00");
    expect(slots[slots.length - 1]).toBe("2026-11-23T19:30:00+03:00");
    expect(slots).toHaveLength(22);
  });

  it("уважает рабочие дни врача", () => {
    expect(slotsFor("2026-11-22")).toEqual([]); // воскресенье: врач не работает
    expect(slotsFor(MONDAY, { doctorWorkingDays: [0] })).toEqual([]);
  });

  it("уважает лид-тайм: сегодня видно только время не раньше now + 120 минут", () => {
    const slots = slotsFor(TODAY, { doctorWorkingDays: [5] });
    expect(slots).not.toContain("2026-11-20T10:00:00+03:00");
    expect(slots).not.toContain("2026-11-20T11:30:00+03:00");
    expect(slots[0]).toBe("2026-11-20T12:00:00+03:00");
  });

  it("уважает горизонт записи", () => {
    const lastDay = addDays(TODAY, SETTINGS.horizonDays) as string;
    const beyond = addDays(TODAY, SETTINGS.horizonDays + 1) as string;

    expect(slotsFor(lastDay).length).toBeGreaterThan(0);
    expect(slotsFor(beyond)).toEqual([]);
  });

  it("вычитает занятые интервалы", () => {
    const slots = slotsFor(MONDAY, { bookings: [makeBooking()] });
    // 11:00–12:30 занимает слоты 10:00 (10:00–11:30), 11:00 и 12:00.
    expect(slots).not.toContain("2026-11-23T10:00:00+03:00");
    expect(slots).not.toContain("2026-11-23T11:00:00+03:00");
    expect(slots).not.toContain("2026-11-23T12:00:00+03:00");
    // Приём заканчивается ровно к 12:30 — этот слот свободен.
    expect(slots).toContain("2026-11-23T12:30:00+03:00");
  });

  it("не считает занятой бронь, которая заканчивается к началу слота", () => {
    const booking = makeBooking({
      startsAt: `${MONDAY}T09:00:00+03:00`,
      endsAt: `${MONDAY}T10:30:00+03:00`,
    });
    const startMs = ms(MONDAY, 10 * 60 + 30);
    expect(isSlotBusy([booking], "dr-kovaleva", startMs, startMs + 90 * 60_000)).toBe(false);
    // А перекрытие на минуту — уже занято.
    expect(isSlotBusy([booking], "dr-kovaleva", startMs - 60_000, startMs + 90 * 60_000)).toBe(true);
  });

  it("отменённая бронь и неявка слот не держат", () => {
    const cancelled = makeBooking({ status: "cancelled" });
    const noShow = makeBooking({ status: "no-show", code: "SVD-AAAA" });
    expect(slotsFor(MONDAY, { bookings: [cancelled, noShow] })).toHaveLength(22);
    expect(occupiesSlot("pending")).toBe(true);
    expect(occupiesSlot("confirmed")).toBe(true);
    expect(occupiesSlot("done")).toBe(false);
    expect(intervalsOverlap(0, 10, 10, 20)).toBe(false);
  });

  it("возвращает все запрошенные даты, включая пустые", () => {
    const days = availabilityDays({
      from: "2026-11-21", // суббота
      days: 3, // сб, вс, пн
      durationMin: 90,
      doctorId: "dr-kovaleva",
      doctorWorkingDays: [1, 2, 3, 4, 5],
      schedule: SCHEDULE,
      bookings: [],
      now: NOW,
    });

    expect(days.map((day) => day.date)).toEqual(["2026-11-21", "2026-11-22", "2026-11-23"]);
    expect(days[0]?.slots).toEqual([]); // врач не работает в субботу
    expect(days[1]?.slots).toEqual([]); // воскресенье
    expect(days[2]?.slots.length).toBeGreaterThan(0);
  });
});

describe("проверка присланного времени", () => {
  function check(startsAt: string, overrides: Partial<Parameters<typeof checkSlot>[0]> = {}) {
    return checkSlot({
      startsAt,
      durationMin: 90,
      doctorId: "dr-kovaleva",
      doctorWorkingDays: WEEKDAYS,
      schedule: SCHEDULE,
      bookings: [],
      now: NOW,
      ...overrides,
    });
  }

  it("принимает корректный слот", () => {
    const result = check("2026-11-23T10:00:00+03:00");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.startMs).toBe(ms(MONDAY, 600));
      expect(result.endMs).toBe(ms(MONDAY, 690));
    }
  });

  it("отклоняет время вне сетки", () => {
    const result = check("2026-11-23T10:15:00+03:00");
    expect(result).toMatchObject({ ok: false, reason: "invalid_slot" });
  });

  it("отклоняет старт ровно в закрытие", () => {
    const result = check("2026-11-23T21:00:00+03:00");
    expect(result).toMatchObject({ ok: false, reason: "invalid_slot" });
  });

  it("отклоняет прошедшую дату и слишком близкий слот", () => {
    expect(check("2026-11-19T10:00:00+03:00")).toMatchObject({
      ok: false,
      reason: "slot_in_past",
    });
    expect(check("2026-11-20T11:00:00+03:00")).toMatchObject({
      ok: false,
      reason: "slot_in_past",
    });
    // Админская запись лид-тайм игнорирует, но не прошлое.
    expect(check("2026-11-20T11:00:00+03:00", { ignoreLeadTime: true }).ok).toBe(true);
    expect(check("2026-11-20T09:30:00+03:00", { ignoreLeadTime: true })).toMatchObject({
      ok: false,
      reason: "slot_in_past",
    });
  });

  it("отклоняет дату за горизонтом и выходной врача", () => {
    expect(check(`${addDays(TODAY, 61)}T10:00:00+03:00`)).toMatchObject({
      ok: false,
      reason: "out_of_horizon",
    });
    expect(check("2026-11-22T12:00:00+03:00")).toMatchObject({ ok: false, reason: "day_off" });
  });

  it("отклоняет занятое время", () => {
    const result = check("2026-11-23T11:00:00+03:00", { bookings: [makeBooking()] });
    expect(result).toMatchObject({ ok: false, reason: "slot_taken" });
  });

  it("разрешает слот сразу после чужой брони", () => {
    const result = check("2026-11-23T12:30:00+03:00", { bookings: [makeBooking()] });
    expect(result.ok).toBe(true);
  });
});

describe("код брони", () => {
  it("генерируется из алфавита без похожих символов", () => {
    expect(generateBookingCode(() => 0)).toBe("SVD-2222");
    expect(generateBookingCode(() => 31)).toBe("SVD-ZZZZ");
    expect(isBookingCode("SVD-7K3M")).toBe(true);
    expect(isBookingCode("SVD-0O1I")).toBe(false); // 0, O, 1, I исключены
    expect(isBookingCode("SVD-7K3")).toBe(false);
  });

  it("обходит коллизию", () => {
    const values = [0, 0, 0, 0, 1, 1, 1, 1];
    let cursor = 0;
    const random = () => values[cursor++] ?? 0;

    const code = generateUniqueBookingCode(new Set(["SVD-2222"]), { random });
    expect(code).toBe("SVD-3333");
  });

  it("падает, если свободных кодов не осталось", () => {
    expect(() =>
      generateUniqueBookingCode(new Set(["SVD-2222"]), { random: () => 0, attempts: 3 }),
    ).toThrow();
  });
});

describe("телефон", () => {
  it("приводит разные записи к +7XXXXXXXXXX", () => {
    expect(normalizePhone("8 916 123-45-67")).toBe("+79161234567");
    expect(normalizePhone("+7 (916) 123 45 67")).toBe("+79161234567");
    expect(normalizePhone("9161234567")).toBe("+79161234567");
    expect(normalizePhone("8(916)1234567")).toBe("+79161234567");
  });

  it("отбрасывает мусор и фальшивые номера", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("9999999999")).toBeNull();
    expect(normalizePhone("+1 415 555 0100")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("маскирует номер для публичных ответов", () => {
    expect(maskPhone("+79161234567")).toBe("+7 9•• ••• 45 67");
    expect(maskPhone("мусор")).toBe("+7 ••• ••• •• ••");
  });
});

describe("антиспам", () => {
  const now = NOW.getTime();

  it("ловит заполненную ловушку", () => {
    expect(looksLikeSpam({ website: "https://spam.example" }, now)).toBe(true);
    expect(looksLikeSpam({ website: "  " }, now)).toBe(false);
    expect(looksLikeSpam({}, now)).toBe(false);
  });

  it("ловит слишком быструю отправку", () => {
    expect(looksLikeSpam({ formStartedAt: now - 1_000 }, now)).toBe(true);
    expect(looksLikeSpam({ formStartedAt: now - 3_000 }, now)).toBe(false);
    expect(looksLikeSpam({ formStartedAt: now - 10 * 60_000 }, now)).toBe(false);
  });

  it("не считает ботом старую вкладку и метку из будущего", () => {
    expect(looksLikeSpam({ formStartedAt: now - 5 * 60 * 60_000 }, now)).toBe(false);
    expect(looksLikeSpam({ formStartedAt: now + 60_000 }, now)).toBe(false);
  });
});

describe("rate limit", () => {
  it("считает попадания в окне и отдаёт Retry-After", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
    const at = new Date("2026-11-20T10:00:00.000Z");

    expect(limiter.check("ip", at).allowed).toBe(true);
    expect(limiter.check("ip", at).allowed).toBe(true);

    const blocked = limiter.check("ip", at);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);

    // Через окно счётчик снова пуст.
    const later = new Date(at.getTime() + 1_001);
    expect(limiter.check("ip", later).allowed).toBe(true);
  });

  it("сбрасывается вручную и не смешивает ключи", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);

    limiter.reset("a");
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("статусы", () => {
  it("разрешает рабочие переходы и запрещает бессмысленные", () => {
    expect(canTransitionBooking("pending", "confirmed")).toBe(true);
    expect(canTransitionBooking("confirmed", "done")).toBe(true);
    expect(canTransitionBooking("pending", "cancelled")).toBe(true);
    expect(canTransitionBooking("cancelled", "confirmed")).toBe(true);
    expect(canTransitionBooking("no-show", "confirmed")).toBe(true);
    expect(canTransitionBooking("cancelled", "done")).toBe(false);
    expect(canTransitionBooking("done", "pending")).toBe(false);
    expect(canTransitionBooking("pending", "pending")).toBe(true);
  });

  it("объясняет запрет человеческим текстом", () => {
    expect(bookingTransitionMessage("cancelled", "done")).toContain("Нельзя перевести запись");
  });
});
