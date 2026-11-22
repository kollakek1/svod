"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { formatDuration, formatPhoneDisplay, formatRub } from "@/lib/format";
import type { BookingStatus } from "@/lib/clinic";
import { cn } from "@/lib/utils";

import { api, errorMessage, isUnauthorized } from "./api";
import { formatDateKey, formatSlotRange, formatStamp } from "./date";
import { useAdminSession } from "./session";
import type { AdminBooking } from "./types";
import { InlineNote, StatusText } from "./ui";

type ActionVariant = "primary" | "outline" | "quiet" | "danger";

interface StatusAction {
  status: BookingStatus;
  label: string;
  variant: ActionVariant;
}

/** Разрешённые переходы повторяют сервер: лишних кнопок не показываем. */
function actionsFor(status: BookingStatus): StatusAction[] {
  switch (status) {
    case "pending":
      return [
        { status: "confirmed", label: "Подтвердить", variant: "primary" },
        { status: "cancelled", label: "Отменить", variant: "outline" },
        { status: "no-show", label: "Не пришёл", variant: "quiet" },
      ];
    case "confirmed":
      return [
        { status: "done", label: "Принять", variant: "primary" },
        { status: "cancelled", label: "Отменить", variant: "outline" },
        { status: "no-show", label: "Не пришёл", variant: "quiet" },
      ];
    default:
      return [{ status: "confirmed", label: "Вернуть в работу", variant: "outline" }];
  }
}

function actorLabel(by: string): string {
  if (by === "site") return "Сайт";
  if (by === "admin") return "Сотрудник";
  return by;
}

export function BookingCard({
  booking,
  variant = "panel",
  onUpdated,
  onClose,
}: {
  booking: AdminBooking;
  variant?: "panel" | "dialog";
  onUpdated: (booking: AdminBooking) => void;
  onClose?: () => void;
}) {
  const { endSession } = useAdminSession();

  const [pendingAction, setPendingAction] = useState<BookingStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [note, setNote] = useState(booking.note ?? "");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  const noteDirty = note.trim() !== (booking.note ?? "").trim();
  const dateKey = booking.startsAt.slice(0, 10);
  const actions = actionsFor(booking.status);

  async function runAction(status: BookingStatus) {
    if (pendingAction) return;
    setPendingAction(status);
    setActionError(null);

    try {
      const payload = await api<{ booking: AdminBooking }>(
        `/api/admin/bookings/${encodeURIComponent(booking.code)}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      onUpdated(payload.booking);
    } catch (reason: unknown) {
      if (isUnauthorized(reason)) {
        endSession();
        return;
      }
      setActionError(errorMessage(reason, "Не удалось изменить статус. Попробуйте ещё раз"));
    } finally {
      setPendingAction(null);
    }
  }

  async function saveNote() {
    if (noteBusy || !noteDirty) return;
    setNoteBusy(true);
    setNoteError(null);
    setNoteMessage(null);

    try {
      const payload = await api<{ booking: AdminBooking }>(
        `/api/admin/bookings/${encodeURIComponent(booking.code)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ note: note.trim() === "" ? null : note.trim() }),
        },
      );
      onUpdated(payload.booking);
      setNoteMessage("Заметка сохранена");
    } catch (reason: unknown) {
      if (isUnauthorized(reason)) {
        endSession();
        return;
      }
      setNoteError(errorMessage(reason, "Не удалось сохранить заметку. Попробуйте ещё раз"));
    } finally {
      setNoteBusy(false);
    }
  }

  return (
    <article
      aria-labelledby={variant === "panel" ? "booking-card-code" : undefined}
      className={variant === "panel" ? "admin-side" : undefined}
    >
      {variant === "panel" ? (
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="mono-label text-text-muted">Запись</p>
            <p
              id="booking-card-code"
              className="mt-1.5 font-display text-[1.6rem] leading-none tracking-[0.04em] text-text"
            >
              {booking.code}
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text"
              aria-label="Закрыть карточку записи"
              onClick={onClose}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={cn(variant === "panel" ? "px-5 py-5" : undefined)}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-[1.3rem] leading-tight text-text">{formatDateKey(dateKey)}</p>
            <p className="mt-1.5 text-[0.9375rem] leading-tight text-text">
              <span className="tnum">{formatSlotRange(booking.startsAt, booking.endsAt)}</span>
              <span className="text-text-muted"> · {formatDuration(booking.durationMin)}</span>
            </p>
          </div>
          <StatusText status={booking.status} className="mt-1 text-[0.875rem]" />
        </div>

        <div className="admin-meta-grid mt-6">
          <div className="col-span-2">
            <span className="admin-meta-label">Услуга</span>
            <span className="admin-meta-value">{booking.serviceName}</span>
          </div>
          <div>
            <span className="admin-meta-label">Врач</span>
            <span className="admin-meta-value">{booking.doctorName}</span>
          </div>
          <div>
            <span className="admin-meta-label">Цена</span>
            <span className="admin-meta-value tnum">{formatRub(booking.priceRub)}</span>
          </div>
          <div>
            <span className="admin-meta-label">Создана</span>
            <span className="admin-meta-value tnum text-text-muted">{formatStamp(booking.createdAt)}</span>
          </div>
          <div>
            <span className="admin-meta-label">Источник</span>
            <span className="admin-meta-value text-text-muted">
              {booking.source === "admin" ? "Добавлена в клинике" : "Заявка с сайта"}
            </span>
          </div>
        </div>

        <section className="mt-6 border-t border-line pt-5" aria-labelledby="booking-patient">
          <h3 id="booking-patient" className="mono-label text-text-muted">
            Пациент
          </h3>
          <p className="mt-2 text-[1rem] leading-tight text-text">{booking.patient.name}</p>
          <p className="mt-2">
            <a
              href={`tel:${booking.patient.phone}`}
              className="link-underline tnum inline-flex min-h-11 items-center text-[0.9375rem] text-text"
            >
              {formatPhoneDisplay(booking.patient.phone)}
            </a>
          </p>
          {booking.patient.email ? (
            <p>
              <a
                href={`mailto:${booking.patient.email}`}
                className="link-underline inline-flex min-h-11 items-center break-all text-[0.875rem] text-text-muted"
              >
                {booking.patient.email}
              </a>
            </p>
          ) : null}
          {booking.patient.comment ? (
            <p className="mt-1 whitespace-pre-wrap border-l border-line-strong pl-3 text-[0.8125rem] leading-snug text-text-muted">
              {booking.patient.comment}
            </p>
          ) : null}
        </section>

        <section className="mt-5 border-t border-line pt-5" aria-labelledby="booking-actions">
          <h3 id="booking-actions" className="mono-label text-text-muted">
            Действия
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.status}
                type="button"
                size="sm"
                variant={action.variant}
                className="h-11"
                disabled={pendingAction !== null}
                onClick={() => void runAction(action.status)}
              >
                {pendingAction === action.status ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {action.label}
              </Button>
            ))}
          </div>
          {actionError ? (
            <p role="alert" className="mt-3 text-[0.8125rem] leading-snug text-danger">
              {actionError}
            </p>
          ) : null}
        </section>

        <section className="mt-5 border-t border-line pt-5" aria-labelledby="booking-note">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="booking-note" className="mono-label text-text-muted">
              Заметка сотрудника
            </h3>
            <span className="mono-num text-text-muted">{note.length} / 1000</span>
          </div>
          <Label htmlFor={`booking-note-${booking.code}`} className="sr-only">
            Заметка сотрудника
          </Label>
          <Textarea
            id={`booking-note-${booking.code}`}
            className="mt-1 min-h-20"
            maxLength={1000}
            value={note}
            placeholder="Например: предупредить, что придёт с переводчиком"
            aria-invalid={Boolean(noteError)}
            aria-describedby={noteError ? `booking-note-error` : undefined}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteMessage(null);
              setNoteError(null);
            }}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11"
              disabled={!noteDirty || noteBusy}
              onClick={() => void saveNote()}
            >
              {noteBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Сохранить заметку
            </Button>
            <div aria-live="polite">
              {noteError ? (
                <span id="booking-note-error" className="text-[0.8125rem] text-danger">
                  {noteError}
                </span>
              ) : noteMessage ? (
                <InlineNote tone="success">{noteMessage}</InlineNote>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-5 border-t border-line pt-5" aria-labelledby="booking-history">
          <h3 id="booking-history" className="mono-label text-text-muted">
            История
          </h3>
          <ol className="admin-history mt-2">
            {booking.history.map((entry, index) => (
              <li
                key={`${entry.at}-${index}`}
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-line py-2 first:border-t-0 first:pt-0"
              >
                <span className="mono-num text-text-muted">{formatStamp(entry.at)}</span>
                <span
                  className="max-w-[11rem] truncate text-right text-[0.6875rem] text-text-muted"
                  title={actorLabel(entry.by)}
                >
                  {actorLabel(entry.by)}
                </span>
                <span className="col-span-2 text-[0.8125rem] leading-snug text-text">{entry.note}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}
