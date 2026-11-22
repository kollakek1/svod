import { WEEKDAY_LABELS, type ClinicDoctor } from "@/lib/clinic";
import { formatTime, pluralRu } from "@/lib/format";

const MOSCOW_NOON = "T12:00:00+03:00";

const WEEKDAY_SHORT = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  weekday: "short",
});

const DAY_NUMBER = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "numeric",
});

/** Полдень московского дня: безопасная точка для форматирования даты-ключа. */
export function dayIso(dateKey: string): string {
  return `${dateKey}${MOSCOW_NOON}`;
}

export function dayWeekdayShort(dateKey: string): string {
  return WEEKDAY_SHORT.format(new Date(dayIso(dateKey))).replace(".", "");
}

export function dayNumber(dateKey: string): string {
  return DAY_NUMBER.format(new Date(dayIso(dateKey)));
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function workingDaysLabel(days: ClinicDoctor["workingDays"]): string {
  if (days.length === 0) return "График уточняется";
  if (days.length === 7) return "Ежедневно";
  return [...days]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAY_LABELS[day].short)
    .join(", ");
}

export function slotCountLabel(count: number): string {
  if (count <= 0) return "—";
  return `${count} ${pluralRu(count, ["окно", "окна", "окон"])}`;
}

export interface SlotGroup {
  id: "morning" | "day" | "evening";
  title: string;
  range: string;
  slots: string[];
}

const SLOT_GROUPS = [
  { id: "morning", title: "Утро", range: "09:00–12:00", from: "00:00", to: "12:00" },
  { id: "day", title: "День", range: "12:00–17:00", from: "12:00", to: "17:00" },
  { id: "evening", title: "Вечер", range: "17:00–21:00", from: "17:00", to: "24:00" },
] as const;

/** Слоты приходят ISO-строками, группируем их по московскому времени. */
export function groupSlots(slots: string[]): SlotGroup[] {
  return SLOT_GROUPS.map((group) => ({
    ...group,
    slots: slots.filter((slot) => {
      const time = formatTime(slot);
      return time >= group.from && time < group.to;
    }),
  })).filter((group) => group.slots.length > 0);
}
