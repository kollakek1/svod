"use client";

/**
 * Пометка «в этом браузере уже входили».
 *
 * Cookie сессии HttpOnly — прочитать её на клиенте нельзя. Эта метка нужна
 * только для одного: отличить первый заход (молча показать вход) от
 * истёкшей сессии (сказать «Войдите снова»).
 */
const SESSION_HINT_KEY = "svod.admin.session";

export function markAdminSession(): void {
  try {
    window.localStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {
    // Приватный режим или запрет storage — просто не покажем сообщение.
  }
}

export function clearAdminSessionHint(): void {
  try {
    window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Ничего не ломается: метка необязательна.
  }
}

/** Читает и сразу удаляет метку. */
export function consumeAdminSessionHint(): boolean {
  try {
    const value = window.localStorage.getItem(SESSION_HINT_KEY);
    window.localStorage.removeItem(SESSION_HINT_KEY);
    return value === "1";
  } catch {
    return false;
  }
}
