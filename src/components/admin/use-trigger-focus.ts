"use client";

import { useCallback, useRef } from "react";

/**
 * Возврат фокуса на элемент, который открыл диалог.
 *
 * Radix умеет это сам только через `DialogTrigger`. Диалоги админки
 * открываются из таблиц и списков, где триггер — обычная кнопка,
 * поэтому запоминаем активный элемент перед открытием.
 */
export function useTriggerFocus() {
  const trigger = useRef<HTMLElement | null>(null);

  const remember = useCallback(() => {
    const active = document.activeElement;
    trigger.current = active instanceof HTMLElement ? active : null;
  }, []);

  const restore = useCallback((fallbackSelector?: string) => {
    const element = trigger.current;
    requestAnimationFrame(() => {
      if (element?.isConnected) {
        element.focus();
        return;
      }
      if (fallbackSelector) {
        const fallback = document.querySelector<HTMLElement>(fallbackSelector);
        fallback?.focus();
      }
    });
  }, []);

  return { remember, restore };
}
