import { BRAND, CONTACTS, FAQ, HOURS } from "@/content/clinic";
import type { ClinicDoctor, ClinicService } from "@/lib/clinic";

import { absoluteUrl, siteUrl } from "./site";

/**
 * Структурированные данные клиники.
 *
 * Правила файла:
 * - только реальные данные: адрес без выдуманного индекса, часы из `HOURS`,
 *   услуги и цены из живого каталога, который передаёт вызывающий код;
 * - `sameAs` не выводим: соцсетей у клиники нет;
 * - длительность приёма — текстом в описании услуги: в schema.org у `Service`
 *   нет поля длительности, а придумывать несуществующее свойство нельзя.
 */

const SCHEMA = "https://schema.org";
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Порядок как в неделе клиники: понедельник → воскресенье. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

interface BuildInput {
  services: ClinicService[];
  doctors: ClinicDoctor[];
}

function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU").replace(/\u202F|\u00A0/g, " ")} ₽`;
}

function priceRange(services: ClinicService[]): string {
  if (services.length === 0) return "по запросу";
  const prices = services.map((service) => service.priceRub);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatRub(min) : `${formatRub(min)} – ${formatRub(max)}`;
}

function openingHoursSpecification() {
  const groups = new Map<string, { opens: string; closes: string; days: string[] }>();

  for (const weekday of WEEK_ORDER) {
    const day = HOURS.find((item) => item.weekday === weekday);
    if (!day?.opensAt || !day.closesAt) continue;

    const key = `${day.opensAt}-${day.closesAt}`;
    const group = groups.get(key) ?? { opens: day.opensAt, closes: day.closesAt, days: [] };
    group.days.push(WEEKDAY_NAMES[weekday]);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: group.days,
    opens: group.opens,
    closes: group.closes,
  }));
}

function serviceOffer(service: ClinicService, clinicId: string) {
  return {
    "@type": "Offer",
    "@id": `${siteUrl()}/#offer-${service.slug}`,
    url: `${absoluteUrl("/")}#booking`,
    price: service.priceRub,
    priceCurrency: "RUB",
    availability: `${SCHEMA}/InStock`,
    ...(service.priceFrom
      ? { description: `Стоимость от ${formatRub(service.priceRub)}; точная сумма — после диагностики.` }
      : {}),
    itemOffered: {
      "@type": "Service",
      "@id": `${siteUrl()}/#service-${service.slug}`,
      name: service.name,
      serviceType: service.category,
      description: `${service.description} Приём — ${service.durationMin} минут.`,
      provider: { "@id": clinicId },
      areaServed: { "@type": "City", name: BRAND.city },
    },
  };
}

export function buildClinicJsonLd({ services, doctors }: BuildInput): object {
  const base = siteUrl();
  const clinicId = `${base}/#clinic`;
  const websiteId = `${base}/#website`;
  const catalogId = `${base}/#services`;
  const faqId = `${base}/#faq`;

  const streetAddress = CONTACTS.address.replace(/^[^,]+,\s*/, "");

  return {
    "@context": SCHEMA,
    "@graph": [
      {
        "@type": "Dentist",
        "@id": clinicId,
        name: `${BRAND.name} — стоматология`,
        alternateName: BRAND.legalName,
        description: BRAND.description,
        slogan: BRAND.promise,
        url: `${base}/`,
        telephone: CONTACTS.phoneHref,
        email: CONTACTS.email,
        image: absoluteUrl("/opengraph-image"),
        logo: absoluteUrl("/icon.svg"),
        priceRange: priceRange(services),
        currenciesAccepted: "RUB",
        paymentAccepted: "Наличные, банковская карта, рассрочка",
        medicalSpecialty: "Dentistry",
        address: {
          "@type": "PostalAddress",
          streetAddress,
          addressLocality: BRAND.city,
          addressRegion: BRAND.city,
          addressCountry: "RU",
        },
        areaServed: [
          { "@type": "AdministrativeArea", name: BRAND.district },
          { "@type": "City", name: BRAND.city },
        ],
        openingHoursSpecification: openingHoursSpecification(),
        hasMap: CONTACTS.mapHref,
        hasOfferCatalog: { "@id": catalogId },
        employee: doctors.map((doctor) => ({
          "@type": "Person",
          "@id": `${base}/#doctor-${doctor.slug}`,
          name: doctor.name,
          jobTitle: doctor.role,
          description: doctor.focus,
          worksFor: { "@id": clinicId },
        })),
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: `${base}/`,
        name: BRAND.name,
        description: BRAND.shortDescription,
        inLanguage: "ru-RU",
        publisher: { "@id": clinicId },
      },
      {
        "@type": "OfferCatalog",
        "@id": catalogId,
        name: "Услуги и цены",
        url: `${base}/#services`,
        numberOfItems: services.length,
        itemListElement: services.map((service) => serviceOffer(service, clinicId)),
      },
      {
        "@type": "FAQPage",
        "@id": faqId,
        url: `${base}/#faq`,
        inLanguage: "ru-RU",
        isPartOf: { "@id": websiteId },
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}

/**
 * JSON.stringify + экранирование `<`, чтобы в HTML не попал `</script>`
 * и любой другой тег из текста услуги.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, (char) =>
    char === "\u2028" ? "\\u2028" : "\\u2029",
  );
}
