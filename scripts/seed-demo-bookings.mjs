/**
 * Демонстрационные записи для админки и календаря.
 *
 * Запуск: node scripts/seed-demo-bookings.mjs
 * Перезаписывает `.data/bookings.json` (файловый драйвер). Не использовать на проде.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, ".data", "catalog.json");
const bookingsPath = path.join(root, ".data", "bookings.json");

const catalog = fs.existsSync(catalogPath)
  ? JSON.parse(fs.readFileSync(catalogPath, "utf8"))
  : { services: [], doctors: [] };

const service = (id) => {
  const found = catalog.services.find((item) => item.id === id);
  if (!found) throw new Error(`Нет услуги ${id} — сначала откройте сайт, чтобы создать каталог`);
  return found;
};

const doctor = (id) => {
  const found = catalog.doctors.find((item) => item.id === id);
  if (!found) throw new Error(`Нет врача ${id}`);
  return found;
};

const MOSCOW_OFFSET = "+03:00";

function iso(date, time) {
  return `${date}T${time}:00${MOSCOW_OFFSET}`;
}

function addMinutes(isoStart, minutes) {
  const date = new Date(isoStart);
  return new Date(date.getTime() + minutes * 60_000).toISOString().replace(".000Z", MOSCOW_OFFSET);
}

const demo = [
  {
    code: "SVD-4K7M",
    serviceId: "svc-caries",
    doctorId: "dr-kovaleva",
    startsAt: iso("2026-11-23", "10:00"),
    status: "confirmed",
    patient: { name: "Марина Соколова", phone: "+79164821930", comment: "Болит справа при жевании" },
    note: "Пациентка просила предупредить, если приём задержится.",
  },
  {
    code: "SVD-9WQ2",
    serviceId: "svc-hygiene",
    doctorId: "dr-shtein",
    startsAt: iso("2026-11-23", "12:30"),
    status: "pending",
    patient: { name: "Дмитрий Левин", phone: "+79267710418" },
  },
  {
    code: "SVD-6T3A",
    serviceId: "svc-consult",
    doctorId: "dr-gordeev",
    startsAt: iso("2026-11-23", "16:00"),
    status: "confirmed",
    patient: { name: "Ольга Ким", phone: "+79035552711", email: "o.kim@example.com" },
  },
  {
    code: "SVD-2N8F",
    serviceId: "svc-implant",
    doctorId: "dr-aslanov",
    startsAt: iso("2026-11-24", "09:30"),
    status: "confirmed",
    patient: { name: "Артём Гусев", phone: "+79852146602", comment: "Шестёрка снизу, удалена год назад" },
  },
  {
    code: "SVD-5H1C",
    serviceId: "svc-kids",
    doctorId: "dr-eremina",
    startsAt: iso("2026-11-24", "14:00"),
    status: "pending",
    patient: { name: "Полина Ершова", phone: "+79173004577", comment: "Дочь, 6 лет, первый визит" },
  },
  {
    code: "SVD-8B4D",
    serviceId: "svc-crown",
    doctorId: "dr-gordeev",
    startsAt: iso("2026-11-25", "11:00"),
    status: "done",
    patient: { name: "Сергей Волков", phone: "+74951203390" },
  },
  {
    code: "SVD-3C9K",
    serviceId: "svc-whitening",
    doctorId: "dr-shtein",
    startsAt: iso("2026-11-26", "17:30"),
    status: "confirmed",
    patient: { name: "Анна Тихонова", phone: "+79168801245" },
  },
  {
    code: "SVD-7L5P",
    serviceId: "svc-endo",
    doctorId: "dr-kovaleva",
    startsAt: iso("2026-11-27", "10:00"),
    status: "pending",
    patient: { name: "Никита Орлов", phone: "+79256408123", comment: "Направление из другой клиники" },
  },
];

const now = new Date().toISOString();

const bookings = demo.map((item) => {
  const svc = service(item.serviceId);
  const doc = doctor(item.doctorId);
  const endsAt = addMinutes(item.startsAt, svc.durationMin);

  return {
    code: item.code,
    serviceId: svc.id,
    serviceName: svc.name,
    doctorId: doc.id,
    doctorName: doc.name,
    startsAt: item.startsAt,
    endsAt,
    durationMin: svc.durationMin,
    priceRub: svc.priceRub,
    patient: item.patient,
    status: item.status,
    source: "site",
    consentAt: now,
    createdAt: now,
    updatedAt: now,
    history: [
      { at: now, by: "site", note: "Заявка с сайта", status: "pending" },
      ...(item.status !== "pending"
        ? [{ at: now, by: "Владелец", note: "Статус изменён в админке", status: item.status }]
        : []),
    ],
    ...(item.note ? { note: item.note } : {}),
  };
});

fs.mkdirSync(path.dirname(bookingsPath), { recursive: true });
const tmp = `${bookingsPath}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(bookings, null, 2), "utf8");
fs.renameSync(tmp, bookingsPath);

console.log(`Записано ${bookings.length} демонстрационных записей в .data/bookings.json`);
