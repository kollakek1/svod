import Link from "next/link";
import type { Metadata } from "next";

import { LogoMark } from "@/components/site/logo";
import { TopBar } from "@/components/site/top-bar";
import { Button } from "@/components/ui/button";
import { CONTACTS, HOURS_SUMMARY } from "@/content/clinic";

export const metadata: Metadata = {
  title: "Страница не найдена",
  description: "Такой страницы на сайте клиники СВОД нет. Запишитесь на приём или вернитесь на главную.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main id="main" className="pt-[72px]">
        <div className="container-page">
          <div className="grid-12 min-h-[calc(100svh-72px)] items-center py-16">
            <div className="col-span-4 md:col-span-8 lg:col-span-7">
              <p className="mono-label flex items-center gap-3 text-text-muted">
                <span className="h-px w-6 bg-line-strong" aria-hidden="true" />
                404 — страница не найдена
              </p>
              <h1 className="display mt-6 text-h1 text-text">
                Такой страницы
                <br />
                здесь нет
              </h1>
              <p className="measure mt-6 text-body text-text-muted">
                Возможно, ссылка устарела или в адресе опечатка. Ничего страшного: зубы на месте, запись работает.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/">На главную</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/#booking">Записаться на приём</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-5 text-small text-text-muted">
                <a href={`tel:${CONTACTS.phoneHref}`} className="tnum link-underline text-text">
                  {CONTACTS.phone}
                </a>
                {HOURS_SUMMARY.map((row) => (
                  <span key={row.days} className="tnum">
                    {row.days} {row.time}
                  </span>
                ))}
              </div>
            </div>

            <div className="col-span-4 mt-12 md:col-span-8 lg:col-span-4 lg:col-start-9 lg:mt-0" aria-hidden="true">
              <div className="relative mx-auto max-w-[22rem]">
                <div className="arch flex aspect-[4/5] items-center justify-center border border-line-strong bg-surface">
                  <LogoMark className="h-24 w-24 text-accent-text" />
                </div>
                <span className="mono-label absolute -top-3 left-4 bg-bg px-2 text-text-muted">схема · 404</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
