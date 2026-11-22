# СВОД — SEO, иконки и видимость в поиске

Всё, что нужно, чтобы страница честно описывала себя машинам: заголовки, превью ссылки, иконки, robots,
sitemap и структурированные данные. Источник данных — `src/content/clinic.ts` (цены, услуги, часы, контакты),
адрес сайта — `NEXT_PUBLIC_SITE_URL` через `siteUrl()`.

## 1. Что сделано

| Файл | Что внутри |
| --- | --- |
| `src/app/layout.tsx` (блок metadata/viewport) | `metadataBase`, `title.default` + `template`, `description`, `canonical: "/"`, OG (`ru_RU`, `website`, `siteName`, `url`), Twitter `summary_large_image`, `robots` + `googleBot.max-image-preview: large`, `keywords`, `themeColor #f2eee4` |
| `src/app/_seo/site.ts` | имя, заголовок, описание, ключевые фразы, `siteUrl()`, `absoluteUrl()`, дата контента |
| `src/app/icon.svg` | знак-арка 32×32: фон `#14160F`, линии `#F2EEE4`, читается на 16 px |
| `src/app/apple-icon.png` | 180×180, костяной фон `#F2EEE4`, арка `#1E5B49`; собирается `node scripts/generate-apple-icon.mjs` (sharp) |
| `src/app/manifest.ts` | `СВОД — стоматология`, `short_name СВОД`, `theme_color`/`background_color #f2eee4`, `standalone`, `start_url /`, `lang ru`, иконки |
| `src/app/opengraph-image.tsx` | 1200×630 через `next/og`, локальные TTF (Spectral + Golos Text), кириллица проверена глазами |
| `src/app/twitter-image.tsx` | реэкспорт того же кадра |
| `src/app/_seo/og-frame.tsx` | сам макет превью: сетка 96 px, обещание, арка ×25, адрес |
| `src/app/robots.ts` | allow `/`, disallow `/admin`, `/api`, `/preview`, sitemap и host |
| `src/app/sitemap.ts` | `/` (1.0) и `/privacy` (0.3), `lastModified` = `CONTENT_UPDATED_AT` |
| `src/app/_seo/jsonld.ts` | `buildClinicJsonLd()` и `serializeJsonLd()` |
| `src/app/_seo/json-ld.tsx` | `<JsonLd data>` — тег `application/ld+json` с экранированием `<` |
| `src/app/_seo/clinic-json-ld.tsx` | `<ClinicJsonLd services doctors>` и `<ClinicJsonLdFromContent>` |
| `src/app/privacy/page.tsx` | политика конфиденциальности, canonical `/privacy`, `robots: index` |

Дефолтных `next.svg` / `vercel.svg` / `file.svg` в `public/` нет.

## 2. JSON-LD: как вставить

Граф `@graph`: `Dentist` (адрес, телефон, часы, врачи, `hasOfferCatalog`), `WebSite`, `OfferCatalog`
с `Offer` + `Service` на каждую услугу, `FAQPage` из шести вопросов со страницы.

Страница статическая — достаточно одной строки в `src/app/page.tsx` (внутрь `<main>`):

```tsx
import { ClinicJsonLdFromContent } from "@/app/_seo/clinic-json-ld";

// ...
<ClinicJsonLdFromContent />
```

Если каталог читается из хранилища (правки из админки), передайте живые массивы:

```tsx
<ClinicJsonLd services={catalog.services} doctors={catalog.doctors} />
```

Правила разметки, которые нельзя нарушать при правках:

- цена, название и длительность берутся из каталога, а не пишутся в компоненте;
- индекс не выдумываем: в адресе только улица, город и регион;
- `sameAs` не выводим, пока у клиники нет соцсетей;
- длительность приёма — текстом в `Service.description` («Приём — 90 минут»): в schema.org у `Service`
  нет поля длительности, а выдумывать несуществующее свойство хуже, чем написать это словами;
- отзывы и рейтинги в разметку не попадают: на странице нет проверяемых агрегатов.

## 3. Как проверить

```bash
npx tsc --noEmit        # типы
npm run lint            # eslint
```

В браузере (dev на `http://localhost:3001`):

| URL | Ожидание |
| --- | --- |
| `/` | в `<head>`: `title`, `description`, `canonical`, `og:image` 1200×630 (абсолютный), `twitter:card`, `icon.svg`, `apple-touch-icon`, `manifest` |
| `/opengraph-image` | 200, `image/png`, 1200×630, кириллица живьём |
| `/twitter-image` | 200, `image/png`, тот же кадр |
| `/icon.svg`, `/apple-icon.png` | 200, `image/svg+xml` / `image/png` |
| `/robots.txt` | `Allow: /`, `Disallow: /admin`, `/api`, `/preview`, `Sitemap` + `Host` |
| `/sitemap.xml` | 200, `application/xml`, две ссылки, без админки |
| `/manifest.webmanifest` | 200, `application/manifest+json` |
| `/privacy` | 200, `robots: index, follow`, `canonical /privacy`, `og:image`, ссылка «На главную» |

JSON-LD: DevTools → Elements → поиск `application/ld+json` → скопировать в
[валидатор schema.org](https://validator.schema.org/) и в
[Rich Results Test](https://search.google.com/test/rich-results). Ни одного `Error`, `Warning` по полям,
которых нет на странице, быть не должно. Локальная копия последней проверки — `.artifacts/seo/jsonld.json`.

Скриншоты: `.artifacts/seo/og.png`, `.artifacts/seo/privacy-1440.png`, `.artifacts/seo/privacy-360.png`,
`.artifacts/seo/icon-16-preview.png` (16 px, увеличен ×12).

Lighthouse: гонять после `next build && next start`, не на dev. Цель — SEO ≥ 95.

**Особенность dev-сервера:** Turbopack не пересобирает Tailwind-бандл при появлении новых файлов — классы из
свежесозданной страницы могут не попасть в CSS до перезапуска `next dev`. Если новая вёрстка «раздета»,
перезапустите dev-сервер, а не правьте классы.

## 4. Что осталось другим командам

- **Frontend (лендинг):** вставить `<ClinicJsonLdFromContent />` на страницу; добавить ссылку «Политика
  конфиденциальности» в футер и рядом с чекбоксом согласия в форме записи (`/privacy`).
- **Frontend (админка):** на `/admin` и `/admin/login` — `export const metadata = { robots: { index: false,
  follow: false } }` (или `layout.tsx` админки), плюс `noindex` в заголовках, чтобы раздел не индексировался
  даже при прямом обходе. Ссылки на админку с сайта не ставим.
- **Backend:** каталог с ценами отдаётся API без `no-store` там, где это безопасно, но страницы не должны
  зависеть от `no-store`; цены в JSON-LD должны совпадать с теми, что видит пациент.
- **Оркестратор / DevOps:** `NEXT_PUBLIC_SITE_URL` на проде (без него canonical, sitemap и OG уедут на
  `localhost`); после деплоя — Search Console и Яндекс.Вебмастер: подтверждение владения (мета-тег
  верификации кладём в `metadata.verification`, токен — в env) и отправка `sitemap.xml`.
- **Контент:** `CONTENT_UPDATED_AT` в `src/app/_seo/site.ts` обновлять при правке текстов, иначе `lastModified`
  в sitemap врёт.

## 5. Колокольчики, которые важно не погасить

- Не добавлять аналитику и пиксели без согласия: сейчас на сайте их нет вовсе, и это заявлено в `/privacy`.
- Не дублировать `og:image` в `openGraph` корневого layout — картинку подставляет конвенция
  `opengraph-image.tsx`. Дочерние страницы со своей `openGraph`-секцией (как `/privacy`) ссылаются на неё явно.
- `canonical` из корневого layout (`"/"`) наследуется всеми страницами: у каждой новой публичной страницы
  должен быть свой `alternates.canonical`, иначе поиск склеит её с главной.
- Заголовок страницы ≤ 60 символов, описание ≤ 160: длиннее — обрежется в выдаче.
