"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { AvailabilityResponse, ClinicDoctor, ClinicService } from "@/lib/clinic";
import { formatDayWithWeekday, formatDuration, formatRub, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { dayIso } from "./booking-utils";

export interface SummaryProps {
  service: ClinicService | null;
  doctor: ClinicDoctor | null;
  dateKey: string | null;
  startsAt: string | null;
  availability: AvailabilityResponse | null;
  /** Шаг можно продолжить, не прокручивая длинный список услуг. */
  onNext?: () => void;
  nextDisabled?: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-line py-3 first:border-t-0 first:pt-0">
      <dt className="mono-label pt-1 text-text-muted">{label}</dt>
      <dd className="max-w-[62%] text-right text-small leading-snug text-text">{children}</dd>
    </div>
  );
}

function Empty() {
  return <span className="text-text-muted">не выбрано</span>;
}

function SummaryBody({ service, doctor, dateKey, startsAt, availability }: SummaryProps) {
  const priceRub = availability?.priceRub ?? service?.priceRub ?? null;
  const durationMin = availability?.durationMin ?? service?.durationMin ?? null;
  const priceFrom = Boolean(service?.priceFrom);

  return (
    <div>
      <p className="mono-label text-text-muted">Ваша запись</p>

      <dl className="mt-5">
        <Row label="Услуга">
          {service ? (
            <span>
              <span className="block">{service.name}</span>
              {durationMin ? (
                <span className="mono-num mt-1 block text-text-muted">{formatDuration(durationMin)}</span>
              ) : null}
            </span>
          ) : (
            <Empty />
          )}
        </Row>

        <Row label="Врач">
          {doctor ? (
            <span>
              <span className="block">{doctor.name}</span>
              <span className="mt-1 block text-text-muted">{doctor.role}</span>
            </span>
          ) : (
            <Empty />
          )}
        </Row>

        <Row label="Дата">
          {dateKey ? formatDayWithWeekday(dayIso(dateKey)) : <Empty />}
        </Row>

        <Row label="Время">
          {startsAt ? <span className="tnum">{formatTime(startsAt)}</span> : <Empty />}
        </Row>
      </dl>

      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-line-strong pt-4">
        <span className="mono-label text-text-muted">Итог</span>
        <span className="text-price tnum text-text">
          {priceRub === null ? (
            <span className="text-small text-text-muted">—</span>
          ) : (
            <>
              {priceFrom ? <span className="text-small text-text-muted">от </span> : null}
              {formatRub(priceRub)}
            </>
          )}
        </span>
      </div>

      <p className="mt-4 text-small leading-relaxed text-text-muted">Оплата после приёма. Отмена — за 6 часов.</p>
      <a href="/privacy" className="mono-label link-underline mt-3 inline-block text-text-muted hover:text-text">
        Политика конфиденциальности
      </a>
    </div>
  );
}

export function SummaryAside(props: SummaryProps) {
  const { onNext, nextDisabled } = props;
  return (
    <aside className="hidden lg:block" aria-label="Детали записи">
      <div className="sticky top-24">
        <div className="border border-line-strong bg-bg p-6 xl:p-7">
          <SummaryBody {...props} />
          {onNext ? (
            <Button type="button" size="md" className="mt-5 w-full" onClick={onNext} disabled={nextDisabled}>
              Далее
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/** На мобиле — свёрнутый бар над формой; детали открываются в диалоге. */
export function MobileSummaryBar(props: SummaryProps) {
  const { service, doctor, dateKey, startsAt, availability } = props;
  const priceRub = availability?.priceRub ?? service?.priceRub ?? null;
  const meta = dateKey
    ? `${formatDayWithWeekday(dayIso(dateKey))}${startsAt ? `, ${formatTime(startsAt)}` : ", время"}`
    : "Выберите услугу и время";

  return (
    <div className="mb-6 flex items-center justify-between gap-3 border border-line-strong bg-bg px-4 py-2.5 lg:hidden">
      <div className="min-w-0 flex-1">
        <p className="truncate text-small font-medium text-text">{service?.name ?? "Запись на приём"}</p>
        <p className="mt-0.5 truncate text-[0.75rem] leading-snug text-text-muted">
          {dateKey ? meta : doctor ? `Врач: ${doctor.name}` : meta}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className={cn("text-small tnum", priceRub === null ? "text-text-muted" : "text-text")}>
          {priceRub === null ? "—" : `${service?.priceFrom ? "от " : ""}${formatRub(priceRub)}`}
        </span>

        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="none" className="min-h-11 px-3 text-small">
              Детали
            </Button>
          </DialogTrigger>
          <DialogContent title="Детали записи" description="Выбранные услуга, врач, дата и время">
            <SummaryBody {...props} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
