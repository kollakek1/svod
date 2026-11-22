"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { ApiError, api, errorMessage, isUnauthorized } from "./api";
import { formatDateKey } from "./date";
import { useAdminSession } from "./session";
import type { ApiErrorPayload } from "./types";

export interface DeleteTarget {
  kind: "service" | "doctor";
  id: string;
  name: string;
}

/**
 * Удаление из каталога. Отказ 409 (`service_has_bookings`, `doctor_in_use`)
 * не прячем в общий текст: показываем причину и конкретные записи.
 */
export function DeleteDialog({
  target,
  onOpenChange,
  onDeleted,
}: {
  target: DeleteTarget | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (message: string) => void;
}) {
  const { endSession } = useAdminSession();
  const open = Boolean(target);

  const [phase, setPhase] = useState<"confirm" | "blocked">("confirm");
  const [blocked, setBlocked] = useState<ApiErrorPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!target || pending) return;
    setPending(true);
    setError(null);

    const path =
      target.kind === "service"
        ? `/api/admin/services/${encodeURIComponent(target.id)}`
        : `/api/admin/doctors/${encodeURIComponent(target.id)}`;

    try {
      await api(path, { method: "DELETE" });
      onDeleted(
        target.kind === "service"
          ? `Услуга «${target.name}» удалена`
          : `Врач ${target.name} удалён из каталога`,
      );
      onOpenChange(false);
    } catch (reason: unknown) {
      if (isUnauthorized(reason)) {
        endSession();
        return;
      }
      if (reason instanceof ApiError && reason.status === 409) {
        setBlocked(reason.payload);
        setPhase("blocked");
      } else {
        setError(errorMessage(reason, "Не удалось удалить. Попробуйте ещё раз"));
      }
    } finally {
      setPending(false);
    }
  }

  const title =
    phase === "blocked"
      ? "Нельзя удалить"
      : target?.kind === "doctor"
        ? "Удалить врача?"
        : "Удалить услугу?";

  const confirmText =
    target?.kind === "doctor"
      ? `«${target.name}» пропадёт с сайта и из формы записи. Если врач ведёт услуги или у него есть будущие записи, удаление остановится с объяснением.`
      : `«${target?.name ?? ""}» исчезнет с сайта и из формы записи. Это необратимо: вернуть можно только созданием заново.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {target ? (
        <DialogContent
          title={title}
          description={
            phase === "blocked"
              ? "Сначала разберите записи, которые держат услугу или врача."
              : "Проверьте название — действие необратимо."
          }
          className="max-w-lg"
        >
          {phase === "blocked" ? (
            <div>
              <p className="text-[0.9375rem] leading-snug text-text">
                {blocked?.message ?? "Удаление невозможно: есть связанные записи."}
              </p>

              {blocked?.bookings && blocked.bookings.length > 0 ? (
                <ul className="mt-4 border-t border-line-strong">
                  {blocked.bookings.map((booking) => (
                    <li
                      key={booking.code}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line py-2"
                    >
                      <span className="font-mono text-[0.8125rem] tracking-[0.04em] text-text">
                        {booking.code}
                      </span>
                      <span className="tnum text-[0.8125rem] text-text">{formatDateKey(booking.date)}</span>
                      <span className="text-[0.8125rem] text-text-muted">{booking.name}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {blocked?.details?.services && blocked.details.services.length > 0 ? (
                <ul className="mt-4 border-t border-line-strong">
                  {blocked.details.services.map((service) => (
                    <li key={service.id} className="border-b border-line py-2 text-[0.875rem] text-text">
                      {service.name}
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="mt-4 text-[0.8125rem] leading-snug text-text-muted">
                Перенесите или отмените эти записи в календаре — тогда удаление станет доступно.
              </p>

              <div className="mt-6 flex justify-end border-t border-line pt-5">
                <Button type="button" variant="outline" size="md" onClick={() => onOpenChange(false)}>
                  Закрыть
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[0.9375rem] leading-snug text-text">{confirmText}</p>

              <div aria-live="polite" className="mt-3 min-h-5">
                {error ? (
                  <p role="alert" className="text-[0.8125rem] text-danger">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-5">
                <Button type="button" variant="quiet" size="md" onClick={() => onOpenChange(false)}>
                  Отмена
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  disabled={pending}
                  onClick={() => void handleDelete()}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  Удалить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
