/**
 * Смоук-тест API на живом сервере.
 *
 * Запуск:
 *   BASE_URL=http://localhost:3002 ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/smoke.mjs
 *
 * Проверяет: каталог → слоты → запись → карточку по коду → вход в админку →
 * смену статуса → создание и удаление услуги. Ничего не оставляет после себя,
 * кроме одной записи (её нельзя удалить через API — это часть продукта).
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

let failures = 0;

function check(name, condition, extra = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

async function json(path, init) {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

function phone() {
  const tail = String(Date.now()).slice(-9);
  return `+79${tail}`;
}

console.log(`СВОД smoke: ${BASE}`);

const catalog = await json("/api/catalog");
check("GET /api/catalog 200", catalog.response.status === 200, String(catalog.response.status));
const service = catalog.body?.services?.find((item) => item.doctorIds?.length > 0);
const doctor = catalog.body?.doctors?.find((item) => service?.doctorIds?.includes(item.id));
check("каталог содержит услуги и врачей", Boolean(service && doctor));

const availability = await json(
  `/api/availability?serviceId=${encodeURIComponent(service.id)}&doctorId=${encodeURIComponent(doctor.id)}&days=14`,
);
check("GET /api/availability 200", availability.response.status === 200, String(availability.response.status));
const slot = availability.body?.days?.flatMap((day) => day.slots ?? [])[0];
check("есть хотя бы один свободный слот", Boolean(slot));

if (slot) {
  const created = await json("/api/booking", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      serviceId: service.id,
      doctorId: doctor.id,
      startsAt: slot,
      patient: { name: "Смоук Тест", phone: phone() },
      consent: true,
      website: "",
      formStartedAt: Date.now() - 10_000,
    }),
  });
  check("POST /api/booking 201", created.response.status === 201, JSON.stringify(created.body));
  const code = created.body?.booking?.code;
  check("выдан код SVD-XXXX", /^SVD-[2-9A-HJ-NP-Z]{4}$/.test(code ?? ""), code);

  if (code) {
    const publicCard = await json(`/api/booking/${code}`);
    check("GET /api/booking/[code] 200", publicCard.response.status === 200);
    check("публичная карточка без телефона", !JSON.stringify(publicCard.body).includes("phone"));

    const duplicate = await json("/api/booking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: service.id,
        doctorId: doctor.id,
        startsAt: slot,
        patient: { name: "Смоук Дубль", phone: phone() },
        consent: true,
        website: "",
        formStartedAt: Date.now() - 10_000,
      }),
    });
    check("повторная запись на слот → 409", duplicate.response.status === 409, String(duplicate.response.status));

    if (EMAIL && PASSWORD) {
      const login = await json("/api/admin/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      check("вход в админку 200", login.response.status === 200, String(login.response.status));
      const cookie = login.response.headers.get("set-cookie")?.split(";")[0] ?? "";
      const auth = { cookie };

      const patch = await json(`/api/admin/bookings/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...auth },
        body: JSON.stringify({ status: "confirmed", note: "Смоук-тест" }),
      });
      check("смена статуса 200", patch.response.status === 200, JSON.stringify(patch.body));
      check("статус confirmed", patch.body?.booking?.status === "confirmed");

      const temp = await json("/api/admin/services", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth },
        body: JSON.stringify({
          name: "Смоук-услуга",
          category: "Диагностика",
          summary: "Временная услуга для проверки",
          description: "Создаётся и удаляется смоук-тестом.",
          durationMin: 30,
          priceRub: 1000,
          priceFrom: false,
          doctorIds: [doctor.id],
        }),
      });
      check("создание услуги 201", temp.response.status === 201, JSON.stringify(temp.body));
      const tempId = temp.body?.service?.id;

      if (tempId) {
        const publicAfter = await json("/api/catalog");
        check(
          "новая услуга видна публично",
          publicAfter.body?.services?.some((item) => item.id === tempId),
        );
        const removed = await fetch(`${BASE}/api/admin/services/${tempId}`, {
          method: "DELETE",
          headers: auth,
        });
        check("удаление услуги 204", removed.status === 204, String(removed.status));
      }

      const logout = await fetch(`${BASE}/api/admin/auth`, { method: "DELETE", headers: auth });
      check("выход 204", logout.status === 204, String(logout.status));
    } else {
      console.log("  skip админка: не заданы ADMIN_EMAIL/ADMIN_PASSWORD");
    }
  }
}

console.log(failures === 0 ? "\\nСмоук пройден." : `\\nПровалено проверок: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
