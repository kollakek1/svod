import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";

export const metadata: Metadata = { title: "Страница не найдена" };

export default function AdminNotFound() {
  return (
    <main id="main" className="admin-wrap flex min-h-[70svh] flex-col justify-center py-16">
      <Logo asLink={false} className="mb-10" />
      <p className="mono-label text-text-muted">404 — Кабинет</p>
      <h1 className="mt-4 max-w-[16ch] font-display text-4xl leading-[1.02] text-text">
        Такой страницы в кабинете нет
      </h1>
      <p className="mt-4 max-w-[36ch] text-small text-text-muted">
        Возможно, ссылка устарела или в адресе опечатка. Записи и каталог — на главной
        странице кабинета.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="md">
          <Link href="/admin">В кабинет</Link>
        </Button>
        <Button asChild variant="outline" size="md">
          <Link href="/">На сайт</Link>
        </Button>
      </div>
    </main>
  );
}
