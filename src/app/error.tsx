"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { CONTACTS } from "@/content/clinic";

/**
 * Ошибка рендера внутри лендинга. Никаких стектрейсов и digest в интерфейсе:
 * человеку нужен выход, а не техническая информация.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[svod] render error", error.message);
  }, [error]);

  return (
    <main className="flex min-h-svh items-center">
      <div className="container-page">
        <div className="grid-12 py-20">
          <div className="col-span-4 md:col-span-8 lg:col-span-7">
            <p className="mono-label flex items-center gap-3 text-text-muted">
              <span className="h-px w-6 bg-line-strong" aria-hidden="true" />
              Что-то пошло не так
            </p>
            <h1 className="display mt-6 text-h1 text-text">
              Страница не
              <br />
              открылась
            </h1>
            <p className="measure mt-6 text-body text-text-muted">
              Мы уже знаем об ошибке. Попробуйте обновить страницу — если не поможет, позвоните нам, и мы запишем вас
              вручную.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={reset}>
                Попробовать снова
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/">На главную</Link>
              </Button>
            </div>
            <p className="mt-8 text-small text-text-muted">
              <a href={`tel:${CONTACTS.phoneHref}`} className="tnum link-underline text-text">
                {CONTACTS.phone}
              </a>
              {" · "}
              {CONTACTS.addressShort}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
