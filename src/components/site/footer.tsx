import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { BRAND, CONTACTS, HOURS_SUMMARY, NAV } from "@/content/clinic";

/**
 * Футер: тёмная поверхность ink. Часы, адрес, контакты и навигация —
 * четыре колонки на десктопе, две на мобиле. Без реквизитов, которых нет.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer data-theme="ink" className="border-t border-line bg-bg text-text">
      <div className="container-page py-[var(--spacing-section-sm)]">
        <div className="grid-12">
          <div className="col-span-4 md:col-span-8 lg:col-span-4">
            <Logo />
            <p className="mt-5 max-w-[30ch] text-small leading-relaxed text-text-muted">{BRAND.positioning}</p>
            <p className="mono-label mt-6 text-text-muted">
              {BRAND.city} · {BRAND.district} · с {BRAND.since}
            </p>
          </div>

          <div className="col-span-2 mt-8 md:col-span-2 lg:col-span-2 lg:col-start-5 lg:mt-0">
            <p className="mono-label text-text-muted">Часы</p>
            <ul className="mt-3 space-y-1.5">
              {HOURS_SUMMARY.map((row) => (
                <li key={row.days} className="flex justify-between gap-3 text-small tnum text-text">
                  <span>{row.days}</span>
                  <span>{row.time}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.75rem] leading-snug text-text-muted">Приём по записи, вечерние слоты до 21:00.</p>
          </div>

          <div className="col-span-2 mt-8 md:col-span-2 lg:col-span-2 lg:mt-0">
            <p className="mono-label text-text-muted">Адрес</p>
            <address className="mt-3 not-italic">
              <p className="text-small text-text">{CONTACTS.address}</p>
              <p className="mt-1 text-[0.75rem] leading-snug text-text-muted">{CONTACTS.addressNote}</p>
              <p className="mt-1 text-[0.75rem] leading-snug text-text-muted">{CONTACTS.entrance}</p>
            </address>
            <a
              href={CONTACTS.mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline mt-3 inline-flex items-center gap-1.5 text-small text-text"
            >
              На карте
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          <div className="col-span-2 mt-8 md:col-span-2 lg:col-span-2 lg:mt-0">
            <p className="mono-label text-text-muted">Контакты</p>
            <ul className="mt-2">
              <li>
                <a
                  href={`tel:${CONTACTS.phoneHref}`}
                  className="tnum link-underline inline-flex min-h-11 items-center text-small text-text"
                >
                  {CONTACTS.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACTS.email}`}
                  className="link-underline inline-flex min-h-11 items-center text-small text-text"
                >
                  {CONTACTS.email}
                </a>
              </li>
            </ul>
            <p className="text-[0.75rem] leading-snug text-text-muted">
              Подтверждаем запись звонком в течение 15 минут в рабочие часы.
            </p>
          </div>

          <nav aria-label="Навигация в футере" className="col-span-2 mt-8 md:col-span-2 lg:col-span-2 lg:mt-0">
            <p className="mono-label text-text-muted">Навигация</p>
            <ul className="mt-2">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex min-h-11 items-center text-small text-text-muted transition-colors duration-200 hover:text-text"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-5 text-[0.75rem] text-text-muted md:flex-row md:items-center md:justify-between md:gap-6">
          <p>
            © {year} {BRAND.legalName}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/privacy" className="link-underline inline-flex min-h-11 items-center text-text">
              Политика конфиденциальности
            </Link>
            <p>Не является публичной офертой</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
