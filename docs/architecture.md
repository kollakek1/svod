# СВОД — архитектура, API и границы файлов

## 1. Стек

- Next.js 16.4.6 (App Router, Turbopack), React 19, TypeScript strict.
- Tailwind CSS v4 (`@tailwindcss/turbopack`), shadcn-подход (Radix + cva), lucide-react.
- Хранилище: файловый драйвер (`.data/*.json`) для разработки, Postgres/Neon при заданном `DATABASE_URL`.
- Валидация: zod. Пароли: `node:crypto` scrypt + `timingSafeEqual`.

Правила Next 16: перед изменением поведения сверяться с `node_modules/next/dist/docs/`.
Параметры динамических route handlers — `Promise` (`params: Promise<{ code: string }>`).

## 2. Структура

```
src/
  app/
    page.tsx                 лендинг (сборка секций)
    layout.tsx               шрифты, метаданные, skip-link, зерно
    globals.css              токены и общие классы (владелец: оркестратор)
    privacy/page.tsx         политика конфиденциальности
    admin/                   админка: login, календарь, каталог
    api/                     публичное API и API админки
    not-found.tsx, error.tsx, global-error.tsx
    icon.svg, apple-icon.tsx, opengraph-image.tsx, manifest.ts, robots.ts, sitemap.ts
    _seo/                    метаданные и JSON-LD
  components/
    ui/                      киты: button, field, dialog, accordion, reveal, eyebrow, section-header
    site/                    секции лендинга
    booking/                 форма записи по шагам
    admin/                   интерфейс админки
  content/clinic.ts          контент и сид каталога
  lib/
    clinic.ts                доменные типы и чистые помощники (владелец: оркестратор)
    format.ts                форматирование (цена, телефон, дата)
    storage/                 драйверы файл/Postgres
    catalog-store.ts         чтение/запись каталога
    booking.ts               сетка слотов, проверка пересечений
    booking-store.ts         создание брони, статусы
    admin-auth.ts            пароли, сессии, guard
    admin-store.ts           сотрудники и их CRUD
    validation.ts            zod-схемы API
```

## 3. Данные

Типы — в `src/lib/clinic.ts`. Сид — `src/content/clinic.ts`.

Документы хранилища:
- `catalog` → `Catalog { version, updatedAt, services[], doctors[] }`;
- `bookings` → `Booking[]`;
- `admins` → `{ users: AdminRecord[] }`, где `AdminRecord` = `AdminUser` + `passwordHash`, `salt`.

Правила:
- id услуг и врачей стабильны (`svc-caries`, `dr-kovaleva`), не выводятся из имени.
- В брони пишутся снапшоты `serviceName`, `doctorName`, `priceRub`, `durationMin`.
- Время — ISO 8601 с `+03:00`; зона `Europe/Moscow`; даты в API — `YYYY-MM-DD` по Москве.
- Удаление услуги с будущими бронями (`pending`/`confirmed`, `startsAt > now`) запрещено, ответ 409
  со списком броней. Врача нельзя удалить, если он указан в услугах или имеет будущие брони.
- Смена статуса пишет запись в `history`.

## 4. API (контракт)

Формат ошибок: `{ "error": "code", "message": "человеческий текст", "fields": { "phone": "..." } }`.
Публичные ответы: `Cache-Control: no-store`.

### 4.1 `GET /api/catalog`

```json
{ "services": ClinicService[], "doctors": ClinicDoctor[], "updatedAt": "2026-11-22T10:00:00.000Z" }
```

Если документ пуст — создаётся из сида. Порядок услуг — как в сиде/каталоге.

### 4.2 `GET /api/availability`

Query: `serviceId` (обязательно), `doctorId` (обязательно), `from` (`YYYY-MM-DD`, опционально, по умолчанию сегодня),
`days` (1–31, по умолчанию 14).

```json
{
  "serviceId": "svc-caries",
  "doctorId": "dr-kovaleva",
  "durationMin": 90,
  "priceRub": 14500,
  "timezone": "Europe/Moscow",
  "days": [{ "date": "2026-11-23", "slots": ["2026-11-23T09:00:00+03:00"] }]
}
```

- Возвращаются все запрошенные даты, включая пустые (`slots: []`), чтобы UI показал закрытые дни.
- Слот валиден, если: день рабочий у врача и клиники, старт по сетке `slotStepMin`, старт + длительность ≤ закрытия,
  старт ≥ now + `minLeadMinutes`, нет пересечения с активными бронями, дата в пределах `horizonDays`.
- Ошибки: 400 (параметры), 404 (услуга/врач), 422 (врач не выполняет услугу).

### 4.3 `POST /api/booking`

```json
{
  "serviceId": "svc-caries",
  "doctorId": "dr-kovaleva",
  "startsAt": "2026-11-24T10:00:00+03:00",
  "patient": { "name": "Мария", "phone": "+7 916 123-45-67", "email": "m@example.com", "comment": "Болит справа" },
  "consent": true,
  "website": "",
  "formStartedAt": 1763900000000
}
```

- 201: `{ "booking": { "code": "SVD-7K3M", "serviceName": "...", "doctorName": "...", "startsAt": "...", "endsAt": "...", "durationMin": 90, "priceRub": 14500, "status": "pending" } }`.
- 409 `slot_taken` — слот уже занят (включая гонку). Клиент обязан сбросить выбранное время.
- 422 — ошибки полей: имя ≥ 2, телефон нормализуется в `+7XXXXXXXXXX`, email опционально валиден,
  комментарий ≤ 500, согласие обязательно.
- Антиспам: `website` должен быть пустым; `formStartedAt` — не раньше 3 секунд и не старше 2 часов;
  rate limit: 10 заявок/час на IP, 3/час на телефон. 429 `rate_limited`.
- Цена, длительность и доступность берутся только с сервера.
- Создание атомарно: блокировка документа `bookings`, повторная проверка пересечения, вставка.

### 4.4 `GET /api/booking/[code]`

Публичная карточка брони без личных данных: `{ code, serviceName, doctorName, startsAt, endsAt, priceRub, status }`.
404 для неизвестного кода.

### 4.5 Админка

| Метод | Путь | Тело / query | Ответ |
| --- | --- | --- | --- |
| POST | `/api/admin/auth` | `{ email, password }` | `{ user }` + HttpOnly cookie |
| GET | `/api/admin/auth` | — | `{ user }` или 401 |
| DELETE | `/api/admin/auth` | — | 204 |
| GET | `/api/admin/calendar` | `?month=2026-11` | `{ month, days: [{date,count}], bookings }` |
| GET | `/api/admin/bookings` | `?from&to&status` | `{ bookings }` |
| POST | `/api/admin/bookings` | как публичная + `status?` | `{ booking }` |
| PATCH | `/api/admin/bookings/[code]` | `{ status?, note? }` | `{ booking }` |
| GET | `/api/admin/catalog` | — | `{ catalog }` |
| POST | `/api/admin/services` | услуга без id | `{ service }` |
| PATCH | `/api/admin/services/[id]` | частичное | `{ service }` |
| DELETE | `/api/admin/services/[id]` | — | 204 или 409 `service_has_bookings` |
| POST | `/api/admin/doctors` | врач без id | `{ doctor }` |
| PATCH | `/api/admin/doctors/[id]` | частичное | `{ doctor }` |
| DELETE | `/api/admin/doctors/[id]` | — | 204 или 409 `doctor_in_use` |

- Все `/api/admin/*`, кроме `auth`, требуют cookie `svod_admin`.
- Сессия: HMAC-SHA256(payload) с `ADMIN_SESSION_SECRET`, 12 часов, HttpOnly, SameSite=Lax, Path=/, Secure на проде.
- Пароли — scrypt с солью; сравнение `timingSafeEqual`. Первый вход при пустом списке сотрудников создаёт owner
  из `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Нельзя удалить себя, нельзя оставить клинику без активного owner, нельзя занять чужой email.
- Rate limit входа: 5 попыток / 15 минут на IP+email.

## 5. Правила слотов (эталон для тестов)

```
slotStarts = [opensAt, opensAt+step, …], пока start + durationMin <= closesAt
валиден, если:
  день открыт в HOURS и day.weekday ∈ doctor.workingDays
  start >= now + minLeadMinutes
  date <= today + horizonDays
  для всех active booking: start >= b.endsAt || start + durationMin <= b.startsAt
```

Часовой пояс фиксированный UTC+3, переходов на летнее время нет.
Сетка считается в московском времени; в тестах `now` передаётся аргументом.

## 6. Границы файлов (один файл — один владелец)

**Оркестратор (не трогать без согласования):**
`src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/**`,
`src/components/site/{logo,top-bar,hero,hero-plate,tooth-arch}.tsx`, `src/content/clinic.ts`, `src/lib/{clinic,format,utils,assets.server}.ts`.

**Backend:**
`src/lib/storage/**`, `src/lib/{catalog-store,booking,booking-store,admin-auth,admin-store,validation}.ts`,
`src/lib/*.test.ts`, `src/app/api/**`, `vitest.config.ts`.

**Frontend (лендинг):**
`src/components/site/**` кроме файлов оркестратора, `src/components/booking/**`.

**Frontend (админка):**
`src/app/admin/**`, `src/components/admin/**`, `src/app/api/admin/**` не менять.

**SEO:**
`src/app/_seo/**`, `icon.svg`, `apple-icon.tsx`, `opengraph-image.tsx`, `twitter-image.tsx`,
`manifest.ts`, `robots.ts`, `sitemap.ts`, `privacy/page.tsx`, `docs/seo.md`.

Служебные страницы `not-found.tsx`, `error.tsx`, `global-error.tsx` — frontend.

## 7. Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | канонические ссылки, OG, sitemap |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | первый owner |
| `ADMIN_SESSION_SECRET` | подпись cookie |
| `DATABASE_URL` | Postgres; без него — `.data/*.json` |

Секреты только в env. В документации — плейсхолдеры.

## 8. Проверка

- `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.
- Сборку запускает оркестратор: два параллельных билда в одном `.next` ломают кэш.
- E2E: запись → код → бронь в админке → статус → правка каталога видна на сайте.
