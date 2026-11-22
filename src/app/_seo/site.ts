export const SITE_NAME = "СВОД";
export const SITE_TITLE = "СВОД — стоматология сохранения в Хамовниках";
export const SITE_DESCRIPTION =
  "Стоматология сохранения в Хамовниках: микроскоп, КТ, прозрачные цены. Приём 60–90 минут, запись онлайн.";

/** Живые фразы, по которым нас реально ищут. Без перечислений через запятую в тексте страницы. */
export const SITE_KEYWORDS = [
  "стоматология в Хамовниках",
  "лечение зубов под микроскопом",
  "эндодонтия Москва",
  "имплантация Straumann",
  "профессиональная гигиена полости рта",
  "детский стоматолог Хамовники",
  "запись к стоматологу онлайн",
] as const;

export const OG_ALT = "СВОД — стоматология сохранения. Ваши зубы — на всю жизнь.";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Дата, когда менялся контент или метаданные. Держим руками: sitemap не должен «дёргаться» на каждый билд. */
export const CONTENT_UPDATED_AT = "2026-11-22";

/** Абсолютный адрес сайта без завершающего слэша. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  const base = siteUrl();
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}
