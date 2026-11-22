import { ArrowDown, ArrowUpRight } from "lucide-react";

import { HeroPlate } from "@/components/site/hero-plate";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { BRAND, CONTACTS, HOURS_SUMMARY, PROGRAMMES, TRUST_MARKS } from "@/content/clinic";
import { publicFileExists } from "@/lib/assets.server";
import { formatRub } from "@/lib/format";

const HERO_IMAGE = "/images/hero-enamel.webp";

export function Hero() {
  const firstVisit = PROGRAMMES[0];
  const heroSrc = publicFileExists(HERO_IMAGE) ? HERO_IMAGE : null;

  return (
    <section className="relative pt-[72px]" aria-labelledby="hero-title">
      <div className="container-page">
        <div className="grid-12">
          <div className="col-span-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 pt-7 md:col-span-8 lg:col-span-12">
            <Eyebrow>
              {BRAND.city} · {BRAND.district} · с {BRAND.since}
            </Eyebrow>
            <p className="mono-label hidden text-text-muted sm:block">Стоматология сохранения</p>
          </div>

          <div className="col-span-4 pt-[clamp(28px,4.4vw,64px)] md:col-span-5 lg:col-span-7 lg:pt-[clamp(40px,5vw,76px)]">
            <h1 id="hero-title" className="display enter text-display text-text">
              <span className="block">Ваши зубы —</span>
              <span className="block">
                на всю <em className="italic">жизнь.</em>
              </span>
            </h1>

            <p
              className="enter mt-6 max-w-[36ch] text-lead text-text-muted sm:mt-7"
              style={{ "--enter-delay": "90ms" } as React.CSSProperties}
            >
              Клиника сохранения в Хамовниках. Лечим под микроскопом, показываем снимки на экране и не предлагаем менять
              то, что можно сохранить.
            </p>

            <div
              className="enter mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center"
              style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            >
              <Button asChild size="lg" className="w-full sm:w-auto">
                <a href="#booking">
                  Записаться на приём
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <a href="#services">
                  Услуги и цены
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            </div>

            <p
              className="enter mt-5 max-w-[48ch] text-small text-text-muted"
              style={{ "--enter-delay": "220ms" } as React.CSSProperties}
            >
              Первый визит — диагностика и план с ценами: {firstVisit.durationMin} минут, {formatRub(firstVisit.priceRub)},
              зачитываем в лечение.
            </p>
          </div>

          <div className="col-span-4 mt-10 md:col-span-3 md:col-start-6 lg:col-span-5 lg:col-start-8 lg:mt-0 lg:pt-[clamp(32px,4vw,64px)]">
            <div
              className="enter mx-auto w-full max-w-[24rem] md:ml-auto md:mr-0 md:max-w-[19rem] lg:max-w-[26rem]"
              style={{ "--enter-delay": "120ms" } as React.CSSProperties}
            >
              <HeroPlate
                src={heroSrc}
                alt="Керамическая коронка на листе костяной бумаги, макро-съёмка при дневном свете"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-[clamp(36px,4.5vw,64px)] border-t border-line">
        <div className="container-page">
          <dl className="grid grid-cols-2 gap-y-6 py-6 sm:grid-cols-4 sm:gap-0">
            <div className="col-span-1 pr-4 sm:border-r sm:border-line sm:px-6 sm:first:pl-0">
              <dt className="mono-label text-text-muted">Часы</dt>
              <dd className="mt-2 text-small text-text">
                {HOURS_SUMMARY.map((row) => (
                  <span key={row.days} className="tnum block">
                    {row.days} {row.time}
                  </span>
                ))}
              </dd>
            </div>
            <div className="col-span-1 pl-4 sm:border-r sm:border-line sm:px-6 sm:pl-6">
              <dt className="mono-label text-text-muted">Адрес</dt>
              <dd className="mt-2 text-small text-text">
                {CONTACTS.addressShort}
                <span className="block text-text-muted">{BRAND.district}</span>
              </dd>
            </div>
            <div className="col-span-1 pr-4 sm:border-r sm:border-line sm:px-6 sm:pl-6">
              <dt className="mono-label text-text-muted">Телефон</dt>
              <dd className="mt-2 text-small">
                <a href={`tel:${CONTACTS.phoneHref}`} className="tnum link-underline text-text">
                  {CONTACTS.phone}
                </a>
                <span className="block text-text-muted">Отвечаем до 15 минут</span>
              </dd>
            </div>
            <div className="col-span-1 pl-4 sm:px-6 sm:pl-6">
              <dt className="mono-label text-text-muted">Оборудование</dt>
              <dd className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-small text-text-muted">
                {TRUST_MARKS.slice(0, 3).map((mark) => (
                  <span key={mark}>{mark}</span>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
