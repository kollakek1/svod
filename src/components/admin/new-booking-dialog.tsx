"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { SERVICE_CATEGORIES } from "@/lib/clinic";
import {
  formatDuration,
  formatRub,
  formatTime,
  maskPhone,
  normalizePhone,
  pluralRu,
} from "@/lib/format";

import { ApiError, api, errorMessage, isAbortError, isUnauthorized } from "./api";
import { dayNumber, formatDateKey, weekdayShort } from "./date";
import { useAdminSession } from "./session";
import type { AdminBooking, AvailabilityResponse, Catalog } from "./types";
import { ErrorNotice, FormField, Select, Skeleton } from "./ui";

const DAYS_AHEAD = 14;

function slotsLabel(count: number): string {
  return `${count} ${pluralRu(count, ["слот", "слота", "слотов"])}`;
}

/**
 * Ручная запись: услуга → врач → дата → слот → имя и телефон.
 *
 * Цена и длительность не вводятся: их подтверждает сервер в ответе
 * `/api/availability`, а `POST /api/admin/bookings` создаёт запись атомарно.
 */
export function NewBookingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (booking: AdminBooking) => void;
}) {
  const { endSession } = useAdminSession();

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  const [serviceId, setServiceId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [availabilityState, setAvailabilityState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+7");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Каждый показ диалога — чистая форма: компонент монтируется заново по key.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();

    api<{ catalog: Catalog }>("/api/admin/catalog", { signal: controller.signal })
      .then((payload) => {
        setCatalog(payload.catalog);
        setCatalogState("ready");
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason) || controller.signal.aborted) return;
        if (isUnauthorized(reason)) {
          endSession();
          return;
        }
        setCatalogError(errorMessage(reason, "Не удалось загрузить услуги. Попробуйте ещё раз"));
        setCatalogState("error");
      });

    return () => controller.abort();
  }, [open, catalogAttempt, endSession]);

  useEffect(() => {
    if (!serviceId || !doctorId) return;

    const controller = new AbortController();

    const query = new URLSearchParams({
      serviceId,
      doctorId,
      days: String(DAYS_AHEAD),
    });

    api<AvailabilityResponse>(`/api/availability?${query.toString()}`, {
      signal: controller.signal,
    })
      .then((payload) => {
        setAvailability(payload);
        setAvailabilityState("ready");
        const firstOpen = payload.days.find((day) => day.slots.length > 0);
        setDateKey((current) =>
          current && payload.days.some((day) => day.date === current)
            ? current
            : (firstOpen?.date ?? null),
        );
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason) || controller.signal.aborted) return;
        if (isUnauthorized(reason)) {
          endSession();
          return;
        }
        setAvailabilityError(
          errorMessage(reason, "Не удалось загрузить свободное время. Попробуйте ещё раз"),
        );
        setAvailabilityState("error");
      });

    return () => controller.abort();
  }, [serviceId, doctorId, availabilityAttempt, endSession]);

  const services = catalog?.services ?? [];
  const service = services.find((item) => item.id === serviceId) ?? null;
  const doctors = service
    ? (catalog?.doctors ?? []).filter((doctor) => service.doctorIds.includes(doctor.id))
    : [];

  const days = availability?.days ?? [];
  const activeDay = days.find((day) => day.date === dateKey) ?? null;
  const slots = activeDay?.slots ?? [];

  const grouped = SERVICE_CATEGORIES.map((category) => ({
    category,
    items: services.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: Record<string, string> = {};
    if (!serviceId) nextErrors.serviceId = "Выберите услугу";
    if (!doctorId) nextErrors.doctorId = "Выберите врача";
    if (!slot) nextErrors.startsAt = "Выберите свободное время";
    if (name.trim().length < 2) nextErrors.name = "Укажите имя — не короче 2 символов";
    if (normalizePhone(phone) === null) {
      nextErrors.phone = "Укажите российский номер: +7 916 123-45-67";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = await api<{ booking: AdminBooking }>("/api/admin/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceId,
          doctorId,
          startsAt: slot,
          patient: { name: name.trim(), phone },
          status: "confirmed",
        }),
      });
      onCreated(payload.booking);
      onOpenChange(false);
    } catch (reason: unknown) {
      if (isUnauthorized(reason)) {
        endSession();
        return;
      }
      if (reason instanceof ApiError && reason.status === 409) {
        setFormError("Это время только что заняли. Выберите другое.");
        setSlot(null);
        setAvailabilityAttempt((value) => value + 1);
      } else if (reason instanceof ApiError && Object.keys(reason.fields).length > 0) {
        setErrors(reason.fields);
        if (reason.fields.startsAt) {
          setSlot(null);
          setAvailabilityAttempt((value) => value + 1);
        }
      } else {
        setFormError(errorMessage(reason, "Не удалось создать запись. Попробуйте ещё раз"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Новая запись"
        description="Свободное время и цена приходят с сервера. После создания откроется карточка записи."
        className="max-w-2xl"
      >
        {catalogState === "loading" ? (
          <div className="space-y-4" aria-hidden="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : catalogState === "error" ? (
          <ErrorNotice
            message={catalogError}
            onRetry={() => {
              setCatalogState("loading");
              setCatalogError("");
              setCatalogAttempt((value) => value + 1);
            }}
          />
        ) : (
          <form className="flex flex-col gap-1" onSubmit={handleSubmit} noValidate>
            <FormField
              id="nb-service"
              label="Услуга"
              error={errors.serviceId}
              hint="Длительность и цена подставятся из каталога."
            >
              <Select
                id="nb-service"
                value={serviceId}
                aria-invalid={Boolean(errors.serviceId)}
                aria-describedby={errors.serviceId ? "nb-service-error" : undefined}
                onChange={(event) => {
                  setServiceId(event.target.value);
                  setDoctorId("");
                  setAvailability(null);
                  setAvailabilityState("idle");
                  setAvailabilityError("");
                  setDateKey(null);
                  setSlot(null);
                  setErrors({});
                  setFormError(null);
                }}
              >
                <option value="">Выберите услугу</option>
                {grouped.map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </FormField>

            <FormField
              id="nb-doctor"
              label="Врач"
              error={errors.doctorId}
              hint={serviceId ? "Показываем только тех, кто выполняет услугу." : undefined}
            >
              <Select
                id="nb-doctor"
                value={doctorId}
                disabled={!service}
                aria-invalid={Boolean(errors.doctorId)}
                aria-describedby={errors.doctorId ? "nb-doctor-error" : undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setDoctorId(value);
                  setAvailability(null);
                  setAvailabilityState(value ? "loading" : "idle");
                  setAvailabilityError("");
                  setDateKey(null);
                  setSlot(null);
                  setErrors({});
                  setFormError(null);
                }}
              >
                <option value="">{service ? "Выберите врача" : "Сначала услуга"}</option>
                {doctors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.role}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="mt-4 border-t border-line pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="mono-label text-text-muted">Дата</p>
                {availability ? (
                  <p className="text-[0.8125rem] text-text-muted">
                    <span className="tnum">{formatDuration(availability.durationMin)}</span>
                    <span> · </span>
                    <span className="tnum">{formatRub(availability.priceRub)}</span>
                  </p>
                ) : null}
              </div>

              {availabilityState === "idle" ? (
                <p className="mt-2 text-[0.8125rem] text-text-muted">
                  Выберите услугу и врача — покажем свободные дни на две недели вперёд.
                </p>
              ) : availabilityState === "loading" ? (
                <div className="mt-3 flex gap-2 overflow-hidden" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} className="h-[52px] w-[60px] shrink-0" />
                  ))}
                </div>
              ) : availabilityState === "error" ? (
                <ErrorNotice
                  className="mt-3"
                  message={availabilityError}
                  onRetry={() => {
                    setAvailabilityState("loading");
                    setAvailabilityError("");
                    setAvailabilityAttempt((value) => value + 1);
                  }}
                />
              ) : (
                <>
                  <div className="admin-chips mt-2" role="group" aria-label="Свободные дни">
                    {days.map((day) => {
                      const available = day.slots.length > 0;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          className="admin-chip"
                          aria-pressed={day.date === dateKey}
                          aria-label={`${formatDateKey(day.date)}, ${
                            available ? slotsLabel(day.slots.length) : "нет свободного времени"
                          }`}
                          disabled={!available}
                          onClick={() => {
                            setDateKey(day.date);
                            setSlot(null);
                          }}
                        >
                          <span className="font-mono text-[0.5625rem] uppercase leading-none tracking-[0.12em] text-text-muted">
                            {weekdayShort(day.date)}
                          </span>
                          <span className="tnum text-[0.9375rem] leading-none text-text">
                            {dayNumber(day.date)}
                          </span>
                          <span className="tnum text-[0.5625rem] leading-none text-text-muted">
                            {available ? day.slots.length : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-baseline justify-between gap-2">
                    <p className="mono-label text-text-muted">Время</p>
                    {activeDay ? (
                      <p className="text-[0.8125rem] text-text-muted">
                        {formatDateKey(activeDay.date)}
                      </p>
                    ) : null}
                  </div>

                  {slots.length === 0 ? (
                    <p className="mt-2 text-[0.8125rem] text-text-muted">
                      {activeDay
                        ? "На этот день свободного времени нет. Выберите другой день."
                        : "В ближайшие две недели свободного времени нет."}
                    </p>
                  ) : (
                    <div
                      className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
                      role="group"
                      aria-label="Свободное время"
                    >
                      {slots.map((iso) => (
                        <button
                          key={iso}
                          type="button"
                          className="admin-slot"
                          aria-pressed={slot === iso}
                          aria-label={`${formatTime(iso)} — свободно`}
                          onClick={() => {
                            setSlot(iso);
                            setErrors((current) => {
                              const next = { ...current };
                              delete next.startsAt;
                              return next;
                            });
                          }}
                        >
                          {formatTime(iso)}
                        </button>
                      ))}
                    </div>
                  )}

                  {errors.startsAt ? (
                    <p id="nb-startsAt-error" role="alert" className="mt-2 text-[0.8125rem] text-danger">
                      {errors.startsAt}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="mt-4 grid gap-x-5 gap-y-1 border-t border-line pt-5 sm:grid-cols-2">
              <FormField id="nb-name" label="Имя пациента" error={errors.name}>
                <Input
                  id="nb-name"
                  name="name"
                  autoComplete="off"
                  value={name}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "nb-name-error" : undefined}
                  onChange={(event) => setName(event.target.value)}
                />
              </FormField>

              <FormField id="nb-phone" label="Телефон" error={errors.phone} hint="Например, +7 916 123-45-67">
                <Input
                  id="nb-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={phone}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "nb-phone-error" : undefined}
                  onChange={(event) => setPhone(maskPhone(event.target.value))}
                />
              </FormField>
            </div>

            <div aria-live="polite" className="min-h-5">
              {formError ? (
                <p role="alert" className="text-[0.8125rem] text-danger">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-line pt-5">
              <Button type="button" variant="quiet" size="md" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" size="md" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Создать запись
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
