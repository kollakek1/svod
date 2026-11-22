"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { CONTACTS, NAV } from "@/content/clinic";

export function TopBar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className="fixed inset-x-0 top-0 z-50 border-b border-transparent bg-transparent transition-[background-color,border-color] duration-300 data-[scrolled=true]:border-line data-[scrolled=true]:bg-bg"
    >
      <div className="container-page flex h-[72px] items-center justify-between gap-6">
        <Logo />

        <nav aria-label="Основная навигация" className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {NAV.slice(0, 5).map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="link-underline text-[0.8125rem] tracking-[0.02em] text-text-muted transition-colors hover:text-text"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={`tel:${CONTACTS.phoneHref}`}
            className="hidden items-center gap-2 text-[0.8125rem] text-text-muted transition-colors hover:text-text md:flex"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tnum">{CONTACTS.phone}</span>
          </a>
          <Button asChild size="md" className="hidden sm:inline-flex">
            <a href="#booking">Записаться</a>
          </Button>

          <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogPrimitive.Trigger
              className="flex h-11 w-11 items-center justify-center border border-line-strong text-text lg:hidden"
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[rgb(20_22_15/0.6)]" />
              <DialogPrimitive.Content className="fixed inset-0 z-[85] flex flex-col bg-bg px-5 pb-8 pt-5">
                <div className="flex items-center justify-between">
                  <DialogPrimitive.Title className="sr-only">Меню</DialogPrimitive.Title>
                  <Logo asLink={false} />
                  <DialogPrimitive.Close
                    className="flex h-11 w-11 items-center justify-center border border-line-strong text-text"
                    aria-label="Закрыть меню"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </DialogPrimitive.Close>
                </div>

                <nav aria-label="Мобильная навигация" className="mt-10 flex-1">
                  <ul className="flex flex-col">
                    {NAV.map((item, index) => (
                      <li key={item.href} className="border-t border-line">
                        <a
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-baseline gap-4 py-5 font-display text-3xl text-text"
                        >
                          <span className="mono-label w-7 text-text-muted">{String(index + 1).padStart(2, "0")}</span>
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>

                <div className="space-y-4">
                  <Button asChild size="lg" className="w-full">
                    <a href="#booking" onClick={() => setMenuOpen(false)}>
                      Записаться на приём
                    </a>
                  </Button>
                  <div className="flex items-center justify-between border-t border-line pt-4 text-small text-text-muted">
                    <a href={`tel:${CONTACTS.phoneHref}`} className="tnum link-underline">
                      {CONTACTS.phone}
                    </a>
                    <span>Хамовники</span>
                  </div>
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>
      </div>
    </header>
  );
}
