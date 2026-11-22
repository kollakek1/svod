"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { api, errorMessage, isAbortError, isUnauthorized } from "./api";
import { clearAdminSessionHint, consumeAdminSessionHint, markAdminSession } from "./session-hint";
import type { AdminUser } from "./types";

/**
 * Сессия админки: проверка при загрузке, выход, реакция на истёкшую сессию.
 *
 * 401 от любого запроса — это не «ошибка», а конец сессии: сотрудника
 * возвращаем на вход с человеческим сообщением «Войдите снова».
 */

interface SessionContextValue {
  user: AdminUser | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  logout: () => Promise<void>;
  endSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    api<{ user: AdminUser }>("/api/admin/auth", { signal: controller.signal })
      .then((payload) => {
        markAdminSession();
        setUser(payload.user);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason) || controller.signal.aborted) return;
        if (isUnauthorized(reason)) {
          // Первый заход без сессии — обычный вход без «сессия закончилась».
          router.replace(consumeAdminSessionHint() ? "/admin/login?expired=1" : "/admin/login");
          return;
        }
        setError(errorMessage(reason, "Не удалось проверить вход. Попробуйте ещё раз"));
        setLoading(false);
      });

    return () => controller.abort();
  }, [attempt, router]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((value) => value + 1);
  }, []);
  const endSession = useCallback(() => {
    clearAdminSessionHint();
    router.replace("/admin/login?expired=1");
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await api("/api/admin/auth", { method: "DELETE" });
    } catch {
      // Даже если сервер не ответил, уводим на вход: cookie истечёт сама.
    }
    clearAdminSessionHint();
    router.replace("/admin/login");
    router.refresh();
  }, [router]);

  return (
    <SessionContext.Provider value={{ user, loading, error, reload, logout, endSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useAdminSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useAdminSession используется вне AdminSessionProvider");
  return value;
}
