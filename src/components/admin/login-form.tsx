"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

import { ApiError, api, errorMessage, isAbortError } from "./api";
import { markAdminSession } from "./session-hint";
import { Skeleton } from "./ui";
import type { AdminUser } from "./types";

/**
 * Вход в кабинет.
 *
 * Ошибка одна и та же, существует ли почта — не подсказываем. После входа
 * уводим на `/admin`; если сотрудник уже вошёл, страницу входа он не увидит.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    api<{ user: AdminUser }>("/api/admin/auth", { signal: controller.signal })
      .then(() => {
        markAdminSession();
        router.replace("/admin");
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason) || controller.signal.aborted) return;
        // Не вошёл — это нормальное состояние страницы входа.
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });

    return () => controller.abort();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await api<{ user: AdminUser }>("/api/admin/auth", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      markAdminSession();
      router.replace("/admin");
      router.refresh();
    } catch (reason: unknown) {
      if (reason instanceof ApiError) {
        if (reason.status === 401) {
          setError("Почта или пароль не подошли");
        } else if (reason.status === 429) {
          setError("Слишком много попыток. Подождите 15 минут");
        } else {
          setError(errorMessage(reason, "Не удалось войти. Попробуйте ещё раз"));
        }
      } else {
        setError("Не удалось войти. Попробуйте ещё раз");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main id="main" className="admin-login">
      <div className="admin-login-card">
        <Logo asLink={false} />

        <p className="mono-label mt-10 text-text-muted">Кабинет</p>
        <h1 className="mt-2 font-display text-[2rem] leading-[1.05] tracking-[-0.02em] text-text">
          Вход в кабинет
        </h1>

        {checking ? (
          <div className="mt-8 space-y-5" aria-hidden="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            <p className="mt-3 text-small text-text-muted">
              Календарь записей и каталог услуг — для сотрудников клиники.
            </p>

            {expired ? (
              <p className="admin-notice mt-6" role="status">
                Войдите снова — сессия закончилась.
              </p>
            ) : null}

            <form className="mt-7 flex flex-col" onSubmit={handleSubmit} noValidate>
              <div>
                <Label htmlFor="admin-email">Почта</Label>
                <Input
                  id="admin-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoFocus
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="mt-4">
                <Label htmlFor="admin-password">Пароль</Label>
                <Input
                  id="admin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              <p
                role="alert"
                className="mt-3 min-h-5 text-[0.8125rem] leading-snug text-danger"
              >
                {error}
              </p>

              <Button type="submit" size="lg" className="mt-3 w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Входим
                  </>
                ) : (
                  "Войти"
                )}
              </Button>
            </form>
          </>
        )}

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-4">
          <p className="mono-label text-text-muted">СВОД · стоматология</p>
          <Link
            href="/"
            className="text-[0.8125rem] text-text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-text"
          >
            На сайт
          </Link>
        </div>
      </div>
    </main>
  );
}

export function LoginSkeleton() {
  return (
    <main className="admin-login" aria-hidden="true">
      <div className="admin-login-card">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="mt-10 h-3 w-16" />
        <Skeleton className="mt-3 h-8 w-48" />
        <div className="mt-8 space-y-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </main>
  );
}
