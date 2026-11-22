"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Eyebrow } from "@/components/ui/eyebrow";
import { pluralRu } from "@/lib/format";

import { api, errorMessage, isAbortError, isUnauthorized } from "./api";
import { BookingCard } from "./booking-card";
import {
  bookingCountLabel,
  monthLabel,
  monthOf,
  shiftMonth,
  todayKey,
  WEEKDAY_HEADERS,
} from "./date";
import { DayAgenda } from "./day-agenda";
import { MonthGrid } from "./month-grid";
import { NewBookingDialog } from "./new-booking-dialog";
import { useAdminSession } from "./session";
import type { AdminBooking, CalendarResponse } from "./types";
import { ErrorNotice, Skeleton } from "./ui";
import { useMediaQuery } from "./use-media-query";
import { useTriggerFocus } from "./use-trigger-focus";

/**
 * Главный экран: месяц, день, карточка записи.
 *
 * На ≥1280 карточка — третья колонка, ниже — диалог. Данные месяца приходят
 * одним запросом: сетка и список дня не рассинхронизируются.
 */
export function CalendarView() {
  const { endSession } = useAdminSession();
  const isWide = useMediaQuery("(min-width: 80rem)");
  const { remember: rememberTrigger, restore: restoreTrigger } = useTriggerFocus();
  const [today] = useState(todayKey);

  const [month, setMonth] = useState(() => monthOf(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [refreshSeq, setRefreshSeq] = useState(0);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newKey, setNewKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    api<CalendarResponse>(`/api/admin/calendar?month=${encodeURIComponent(month)}`, {
      signal: controller.signal,
    })
      .then((payload) => {
        setData(payload);
        setError(null);
        setSelectedDate((current) =>
          payload.days.some((day) => day.date === current)
            ? current
            : payload.days.some((day) => day.date === today)
              ? today
              : (payload.days[0]?.date ?? current),
        );
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason) || controller.signal.aborted) return;
        if (isUnauthorized(reason)) {
          endSession();
          return;
        }
        setError(errorMessage(reason, "Не удалось загрузить календарь. Попробуйте ещё раз"));
      });

    return () => controller.abort();
  }, [month, attempt, refreshSeq, today, endSession]);

  function refresh() {
    setRefreshSeq((value) => value + 1);
  }

  function openNewBooking() {
    rememberTrigger();
    setNewKey((value) => value + 1);
    setNewOpen(true);
  }

  function goMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setError(null);
    setSelectedCode(null);
    setSelectedDate(monthOf(today) === next ? today : `${next}-01`);
  }

  function goToday() {
    setMonth(monthOf(today));
    setError(null);
    setSelectedDate(today);
    setSelectedCode(null);
  }

  function handleUpdated(updated: AdminBooking) {
    setData((current) =>
      current
        ? {
            ...current,
            bookings: current.bookings.map((booking) =>
              booking.code === updated.code ? updated : booking,
            ),
          }
        : current,
    );
    refresh();
  }

  function handleCreated(booking: AdminBooking) {
    const date = booking.startsAt.slice(0, 10);
    setMonth(monthOf(date));
    setSelectedDate(date);
    setSelectedCode(booking.code);
    refresh();
  }

  function closePanel() {
    const code = selectedCode;
    setSelectedCode(null);
    if (code) {
      requestAnimationFrame(() => {
        document.getElementById(`booking-row-${code}`)?.focus();
      });
    }
  }

  function closeDialog(open: boolean) {
    if (open) return;
    const code = selectedCode;
    setSelectedCode(null);
    if (code) {
      requestAnimationFrame(() => {
        document.getElementById(`booking-row-${code}`)?.focus();
      });
    }
  }

  useEffect(() => {
    if (!isWide || !selectedCode) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // closePanel читает актуальный selectedCode в момент нажатия
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWide, selectedCode]);

  const hasMonthData = Boolean(data && data.month === month);
  const showSkeleton = !hasMonthData && !error;

  // Счётчик дня — все записи, кроме отменённых: завершённая запись была,
  // и прятать её из календаря значит соврать о загрузке дня.
  const visibleBookings = (hasMonthData && data ? data.bookings : []).filter(
    (booking) => booking.status !== "cancelled",
  );
  const countByDate = new Map<string, number>();
  for (const booking of visibleBookings) {
    const key = booking.startsAt.slice(0, 10);
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  }

  const days =
    hasMonthData && data
      ? data.days.map((day) => ({ date: day.date, count: countByDate.get(day.date) ?? 0 }))
      : [];

  const dayBookings = (hasMonthData && data ? data.bookings : [])
    .filter((booking) => booking.startsAt.slice(0, 10) === selectedDate)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const panelBooking = data?.bookings.find((booking) => booking.code === selectedCode) ?? null;
  const hasPanel = Boolean(panelBooking) && isWide;

  const monthTotal = visibleBookings.length;
  const doneTotal = visibleBookings.filter((booking) => booking.status === "done").length;
  const monthSummary = showSkeleton
    ? "Загружаем записи"
    : `${bookingCountLabel(monthTotal)} за месяц${
        doneTotal > 0
          ? ` · ${doneTotal} ${pluralRu(doneTotal, ["завершена", "завершены", "завершено"])}`
          : ""
      }`;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-5 border-t border-line-strong pt-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Eyebrow>Календарь</Eyebrow>
          <h1 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.75rem)] leading-none tracking-[-0.02em] text-text">
            {monthLabel(month)}
          </h1>
          <p className="mt-2 text-small text-text-muted">
            {monthSummary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Предыдущий месяц"
            onClick={() => goMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Следующий месяц"
            onClick={() => goMonth(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="quiet" size="md" onClick={goToday}>
            Сегодня
          </Button>
          <Button type="button" size="md" id="calendar-add" onClick={openNewBooking}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Добавить запись
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorNotice
          message={error}
          onRetry={() => {
            setData(null);
            setError(null);
            setAttempt((value) => value + 1);
          }}
        />
      ) : null}

      <div className="admin-cal-layout" data-has-selection={hasPanel}>
        <section aria-label="Месяц" className="min-w-0">
          {showSkeleton ? (
            <MonthSkeleton />
          ) : days.length > 0 ? (
            <MonthGrid
              month={month}
              days={days}
              selectedDate={selectedDate}
              today={today}
              onSelect={(date) => {
                setSelectedDate(date);
                setSelectedCode(null);
              }}
            />
          ) : null}
        </section>

        <div className="admin-sticky">
          <DayAgenda
            date={selectedDate}
            bookings={dayBookings}
            loading={showSkeleton}
            activeCode={selectedCode}
            onSelect={(booking) => setSelectedCode(booking.code)}
            onAdd={openNewBooking}
          />
        </div>

        {hasPanel && panelBooking ? (
          <div className="admin-sticky">
            <BookingCard
              key={panelBooking.code}
              booking={panelBooking}
              variant="panel"
              onUpdated={handleUpdated}
              onClose={closePanel}
            />
          </div>
        ) : null}
      </div>

      <NewBookingDialog
        key={newKey}
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open) restoreTrigger("#calendar-add");
        }}
        onCreated={handleCreated}
      />

      <Dialog
        open={Boolean(panelBooking) && !isWide}
        onOpenChange={closeDialog}
      >
        {panelBooking ? (
          <DialogContent
            title={`Запись ${panelBooking.code}`}
            description="Статус, пациент, заметка и история записи."
            className="max-w-lg"
          >
            <BookingCard
              key={panelBooking.code}
              booking={panelBooking}
              variant="dialog"
              onUpdated={handleUpdated}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function MonthSkeleton() {
  return (
    <div className="admin-month" aria-hidden="true">
      {WEEKDAY_HEADERS.map((label) => (
        <div key={label} className="admin-weekday">
          {label}
        </div>
      ))}
      {Array.from({ length: 35 }, (_, index) => (
        <div key={index} className="admin-day">
          <Skeleton className="h-3.5 w-4" />
          <Skeleton className="h-2 w-3 self-end" />
        </div>
      ))}
    </div>
  );
}
