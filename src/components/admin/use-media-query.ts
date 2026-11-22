"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Медиазапрос без мигания: серверный снимок — `false`, после гидратации
 * подписка отдаёт реальное значение и компонент перерисовывается один раз.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
