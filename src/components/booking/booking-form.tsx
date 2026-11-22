"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  BOOK_DOCTOR_EVENT,
  BOOK_SERVICE_EVENT,
  type BookDoctorEvent,
  type BookServiceEvent,
} from "@/lib/booking-events";
import type { AvailabilityResponse, ClinicDoctor, ClinicService } from "@/lib/clinic";
import { maskPhone, normalizePhone } from "@/lib/format";

import { ContactsStep } from "./contacts-step";
import { DoctorStep } from "./doctor-step";
import { ServiceStep } from "./service-step";
import { Stepper } from "./stepper";
import { BookingSuccess } from "./success";
import { MobileSummaryBar, SummaryAside } from "./summary";
import { TimeStep } from "./time-step";
import type {
  AvailabilityStatus,
  BookingConfirmation,
  BookingStep,
  ContactErrors,
  ContactField,
  ContactValues,
  SubmitNotice,
} from "./types";

const TOTAL_DAYS = 21;
const BOOKED_EVENT = "svod:booked";

const EMPTY_CONTACTS: ContactValues = {
  name: "",
  phone: "",
  email: "",
  comment: "",
  consent: false,
  website: "",
};

const FIELD_ORDER: ContactField[] = ["name", "phone", "email", "comment", "consent"];

interface ApiErrorBody {
  message?: string;
  fields?: Record<string, string>;
}

function readApiError(payload: unknown): ApiErrorBody {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const fields =
    record.fields && typeof record.fields === "object" ? (record.fields as Record<string, string>) : undefined;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    fields,
  };
}

function validateField(field: ContactField, values: ContactValues): string | null {
  switch (field) {
    case "name": {
      const name = values.name.trim();
      if (name.length < 2) return "Имя — не короче 2 символов";
      if (name.length > 80) return "Имя — не длиннее 80 символов";
      return null;
    }
    case "phone": {
      const normalized = normalizePhone(values.phone);
      if (!normalized) return "Укажите российский номер: +7 916 123-45-67";
      // Те же правила, что у сервера: мобильные коды 3/4/8/9 и не «9999999999».
      const national = normalized.slice(2);
      if (!/^[3489]\d{9}$/.test(national) || /^(\d)\1{9}$/.test(national)) {
        return "Укажите российский номер: +7 916 123-45-67";
      }
      return null;
    }
    case "email": {
      const email = values.email.trim();
      if (!email) return null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? null : "Проверьте адрес электронной почты";
    }
    case "comment":
      return values.comment.trim().length > 500 ? "Комментарий — не длиннее 500 символов" : null;
    case "consent":
      return values.consent ? null : "Без согласия записать нельзя";
    default:
      return null;
  }
}

function validateContacts(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  for (const field of FIELD_ORDER) {
    const message = validateField(field, values);
    if (message) errors[field] = message;
  }
  return errors;
}

/**
 * Форма записи: четыре шага, серверные слоты и один честный summary.
 *
 * Выбор хранится в одном месте: возврат назад ничего не теряет,
 * смена услуги сбрасывает врача и время, смена врача — время.
 */
export function BookingForm({ services, doctors }: { services: ClinicService[]; doctors: ClinicDoctor[] }) {
  const [step, setStep] = useState<BookingStep>(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("idle");
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  const [contacts, setContacts] = useState<ContactValues>(EMPTY_CONTACTS);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [formStartedAt, setFormStartedAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<SubmitNotice | null>(null);
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);

  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  /**
   * Когда пользователь нажал «Далее» на шаге 3, кнопка находится там же,
   * где окажется «Записаться». Браузер может дослать клик уже в новую кнопку —
   * это выглядит как отправка пустой формы с ошибками. Гасим такой фантом.
   */
  const stepEnteredAt = useRef(0);
  useEffect(() => {
    stepEnteredAt.current = Date.now();
  }, [step]);
  const focusKeyRef = useRef<string>("1-form");

  const service = serviceId ? (services.find((item) => item.id === serviceId) ?? null) : null;
  const doctor = doctorId ? (doctors.find((item) => item.id === doctorId) ?? null) : null;
  const serviceDoctors = service ? doctors.filter((item) => service.doctorIds.includes(item.id)) : [];
  const selectedDayData = availability?.days.find((day) => day.date === selectedDay) ?? null;
  const slotIsValid = Boolean(startsAt && selectedDayData?.slots.includes(startsAt));

  const canAdvance =
    step === 1 ? Boolean(service) : step === 2 ? Boolean(doctor) : step === 3 ? slotIsValid : true;

  /* Фокус на заголовок шага: смена шага не должна оставлять человека в пустоте.
     Первый рендер не трогаем — иначе страница прыгает к форме при загрузке. */
  useEffect(() => {
    const key = `${step}-${booking ? "success" : "form"}`;
    if (focusKeyRef.current === key) return;
    focusKeyRef.current = key;
    headingRef.current?.focus();
  }, [step, booking]);

  /* formStartedAt ставится при входе на шаг контактов (см. goNext), а не эффектом:
     так метка честно переживает возврат назад. */

  /* События соседних секций: выбрать услугу или врача и раскрыть нужный шаг. */
  useEffect(() => {
    const handleService = (event: Event) => {
      const detail = (event as BookServiceEvent).detail;
      if (!detail?.serviceId) return;

      const next = services.find((item) => item.id === detail.serviceId || item.slug === detail.serviceId);
      if (!next) return;

      setBooking(null);
      setSubmitNotice(null);
      setSlotError(null);
      setConflictNotice(null);

      if (next.id !== serviceId) {
        setServiceId(next.id);
        setDoctorId(null);
        setSelectedDay(null);
        setStartsAt(null);
        setAvailability(null);
        setAvailabilityStatus("idle");
      }

      const hasDoctors = doctors.some((item) => next.doctorIds.includes(item.id));
      setStep(hasDoctors ? 2 : 1);
    };

    const handleDoctor = (event: Event) => {
      const detail = (event as BookDoctorEvent).detail;
      if (!detail?.doctorId) return;

      const nextDoctor = doctors.find((item) => item.id === detail.doctorId || item.slug === detail.doctorId);
      if (!nextDoctor) return;

      setBooking(null);
      setSubmitNotice(null);
      setSlotError(null);
      setConflictNotice(null);

      const currentService = services.find((item) => item.id === serviceId) ?? null;
      const targetService =
        currentService && currentService.doctorIds.includes(nextDoctor.id)
          ? currentService
          : (services.find((item) => item.doctorIds.includes(nextDoctor.id)) ?? null);

      if (!targetService) {
        setServiceId(null);
        setDoctorId(null);
        setStep(1);
        return;
      }

      const serviceChanged = targetService.id !== serviceId;
      const doctorChanged = nextDoctor.id !== doctorId;

      setServiceId(targetService.id);
      setDoctorId(nextDoctor.id);

      if (serviceChanged || doctorChanged) {
        setSelectedDay(null);
        setStartsAt(null);
        setAvailability(null);
      }

      beginAvailabilityLoad();
      setReloadKey((key) => key + 1);
      setStep(3);
    };

    window.addEventListener(BOOK_SERVICE_EVENT, handleService);
    window.addEventListener(BOOK_DOCTOR_EVENT, handleDoctor);
    return () => {
      window.removeEventListener(BOOK_SERVICE_EVENT, handleService);
      window.removeEventListener(BOOK_DOCTOR_EVENT, handleDoctor);
    };
  }, [services, doctors, serviceId, doctorId]);

  /* Доступность: 21 день, только серверные слоты, отмена устаревших ответов. */
  useEffect(() => {
    if (booking || step !== 3 || !serviceId || !doctorId) return;

    const controller = new AbortController();

    const params = new URLSearchParams({ serviceId, doctorId, days: String(TOTAL_DAYS) });

    fetch(`/api/availability?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;

        if (!response.ok) {
          setAvailabilityStatus("error");
          setAvailabilityError(readApiError(payload).message ?? "Не удалось загрузить окна. Попробуйте ещё раз.");
          return;
        }

        const next = payload as AvailabilityResponse | null;
        if (!next || !Array.isArray(next.days)) {
          setAvailabilityStatus("error");
          setAvailabilityError("Не удалось загрузить окна. Попробуйте ещё раз.");
          return;
        }

        setAvailability(next);
        setAvailabilityStatus("ready");
        setSelectedDay((current) => {
          if (current && next.days.some((day) => day.date === current)) return current;
          return next.days.find((day) => day.slots.length > 0)?.date ?? next.days[0]?.date ?? null;
        });
        setStartsAt((current) =>
          current && next.days.some((day) => day.slots.includes(current)) ? current : null,
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAvailabilityStatus("error");
        setAvailabilityError("Не удалось загрузить окна. Проверьте связь и попробуйте ещё раз.");
      });

    return () => controller.abort();
  }, [booking, step, serviceId, doctorId, reloadKey]);

  function handleSelectService(id: string) {
    if (id === serviceId) return;
    setServiceId(id);
    setDoctorId(null);
    setSelectedDay(null);
    setStartsAt(null);
    setAvailability(null);
    setAvailabilityStatus("idle");
    setSlotError(null);
    setConflictNotice(null);
    setSubmitNotice(null);
  }

  function handleSelectDoctor(id: string) {
    if (id === doctorId) return;
    setDoctorId(id);
    setSelectedDay(null);
    setStartsAt(null);
    setAvailability(null);
    setAvailabilityStatus("idle");
    setSlotError(null);
    setConflictNotice(null);
    setSubmitNotice(null);
  }

  function handleSelectDay(date: string) {
    if (date === selectedDay) return;
    setSelectedDay(date);
    setStartsAt(null);
    setSlotError(null);
    setConflictNotice(null);
    setSubmitNotice(null);
  }

  function handleSelectSlot(slot: string) {
    setStartsAt(slot);
    setSlotError(null);
    setConflictNotice(null);
    setSubmitNotice(null);
  }

  function beginAvailabilityLoad() {
    setAvailabilityStatus("loading");
    setAvailabilityError(null);
  }

  function handleRetry() {
    setSlotError(null);
    beginAvailabilityLoad();
    setReloadKey((key) => key + 1);
  }

  function goNext() {
    setSubmitNotice(null);

    if (step === 1) {
      if (service) setStep(2);
      return;
    }

    if (step === 2) {
      if (doctor) {
        beginAvailabilityLoad();
        setStep(3);
      }
      return;
    }

    if (step === 3) {
      if (!startsAt || !slotIsValid) {
        setSlotError("Это окно уже недоступно. Выберите другое — расписание обновили.");
        beginAvailabilityLoad();
        setReloadKey((key) => key + 1);
        return;
      }
      setFormStartedAt((current) => current ?? Date.now());
      setStep(4);
    }
  }

  function goBack() {
    setSubmitNotice(null);
    if (step <= 1) return;
    const target = (step - 1) as BookingStep;
    if (target === 3) beginAvailabilityLoad();
    setStep(target);
  }

  function navigateTo(target: BookingStep) {
    if (target >= step) return;
    setSubmitNotice(null);
    if (target === 3) beginAvailabilityLoad();
    setStep(target);
  }

  function updateContact(field: keyof ContactValues, value: string | boolean) {
    const normalizedValue =
      field === "phone" && typeof value === "string"
        ? value.replace(/\D/g, "").length === 0
          ? ""
          : maskPhone(value)
        : value;
    const next = { ...contacts, [field]: normalizedValue } as ContactValues;
    setContacts(next);
    setSubmitNotice(null);

    if (field !== "website" && errors[field as ContactField]) {
      const contactField = field as ContactField;
      const message = validateField(contactField, next);
      setErrors((current) => {
        const copy = { ...current };
        if (message) copy[contactField] = message;
        else delete copy[contactField];
        return copy;
      });
    }
  }

  function blurContact(field: "name" | "phone" | "email" | "comment") {
    const message = validateField(field, contacts);
    setErrors((current) => {
      const copy = { ...current };
      if (message) copy[field] = message;
      else delete copy[field];
      return copy;
    });
  }

  function focusFirstError(nextErrors: ContactErrors) {
    const first = FIELD_ORDER.find((field) => nextErrors[field]);
    if (!first) return;
    const node = document.getElementById(`booking-${first}`);
    if (node instanceof HTMLElement) node.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    // Клик, «проскочивший» в новую кнопку сразу после смены шага.
    if (Date.now() - stepEnteredAt.current < 350) return;

    const nextErrors = validateContacts(contacts);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitNotice(null);
      focusFirstError(nextErrors);
      return;
    }

    if (!serviceId || !doctorId || !startsAt) {
      setSubmitNotice({ kind: "retry", message: "Вернитесь и выберите услугу, врача и время." });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitNotice(null);

    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId,
          doctorId,
          startsAt,
          patient: {
            name: contacts.name.trim(),
            phone: contacts.phone,
            email: contacts.email.trim() || undefined,
            comment: contacts.comment.trim() || undefined,
          },
          consent: contacts.consent,
          website: contacts.website,
          formStartedAt: formStartedAt ?? Date.now(),
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      const apiError = readApiError(payload);

      if (response.status === 201) {
        const confirmation = (payload as { booking?: BookingConfirmation } | null)?.booking;
        if (confirmation?.code) {
          setBooking(confirmation);
          setFormStartedAt(null);
          window.dispatchEvent(new CustomEvent(BOOKED_EVENT, { detail: { code: confirmation.code } }));
          return;
        }
      }

      if (response.status === 409) {
        setStartsAt(null);
        setSlotError(null);
        setConflictNotice("Это время только что заняли. Выберите другое — окна обновили.");
        beginAvailabilityLoad();
        setStep(3);
        setReloadKey((key) => key + 1);
        return;
      }

      if (response.status === 422) {
        const serverFields = apiError.fields ?? {};
        const fieldErrors: ContactErrors = {};
        for (const field of FIELD_ORDER) {
          const message = serverFields[field];
          if (typeof message === "string" && message) fieldErrors[field] = message;
        }
        setErrors(fieldErrors);

        if (serverFields.startsAt) {
          setStartsAt(null);
          setSlotError(serverFields.startsAt);
          beginAvailabilityLoad();
          setStep(3);
          setReloadKey((key) => key + 1);
          return;
        }

        if (Object.keys(fieldErrors).length > 0) {
          focusFirstError(fieldErrors);
          return;
        }

        setSubmitNotice({ kind: "validation", message: apiError.message ?? "Проверьте данные и попробуйте снова." });
        return;
      }

      if (response.status === 429) {
        setSubmitNotice({ kind: "rate", message: "Слишком много попыток. Позвоните нам —" });
        return;
      }

      setSubmitNotice({
        kind: "retry",
        message: apiError.message ?? "Не удалось отправить. Проверьте связь и попробуйте снова.",
      });
    } catch {
      setSubmitNotice({ kind: "retry", message: "Не удалось отправить. Проверьте связь и попробуйте снова." });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function resetBooking() {
    setBooking(null);
    setStep(1);
    setServiceId(null);
    setDoctorId(null);
    setSelectedDay(null);
    setStartsAt(null);
    setAvailability(null);
    setAvailabilityStatus("idle");
    setAvailabilityError(null);
    setContacts({ ...EMPTY_CONTACTS });
    setErrors({});
    setSubmitNotice(null);
    setSlotError(null);
    setConflictNotice(null);
    setFormStartedAt(null);
    submittingRef.current = false;
    setSubmitting(false);
  }

  if (booking) {
    return (
      <div className="grid gap-8">
        <BookingSuccess booking={booking} onReset={resetBooking} headingRef={headingRef} />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_clamp(23.75rem,34vw,26rem)] lg:gap-10 xl:gap-16">
      <div className="min-w-0 lg:max-w-[40rem]">
        <MobileSummaryBar
          service={service}
          doctor={doctor}
          dateKey={selectedDay}
          startsAt={startsAt}
          availability={availability}
        />

        <Stepper step={step} onNavigate={navigateTo} />

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-busy={submitting}
          className="relative mt-8"
        >
          {step === 1 ? (
            <ServiceStep services={services} serviceId={serviceId} onSelect={handleSelectService} headingRef={headingRef} />
          ) : null}

          {step === 2 ? (
            <DoctorStep
              doctors={serviceDoctors}
              selectedDoctorId={doctorId}
              service={service}
              onSelect={handleSelectDoctor}
              headingRef={headingRef}
            />
          ) : null}

          {step === 3 && service && doctor ? (
            <TimeStep
              service={service}
              doctor={doctor}
              status={availabilityStatus}
              availability={availability}
              error={availabilityError}
              selectedDay={selectedDay}
              startsAt={startsAt}
              onSelectDay={handleSelectDay}
              onSelectSlot={handleSelectSlot}
              onRetry={handleRetry}
              slotError={slotError}
              notice={conflictNotice}
              headingRef={headingRef}
            />
          ) : null}

          {step === 4 ? (
            <ContactsStep
              values={contacts}
              errors={errors}
              onChange={updateContact}
              onBlur={blurContact}
              headingRef={headingRef}
              notice={submitNotice}
            />
          ) : null}

          <div
            className={`mt-8 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center ${
              step > 1 ? "sm:justify-between" : "sm:justify-end"
            }`}
          >
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Назад
              </Button>
            ) : null}

            {step < 4 ? (
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                disabled={!canAdvance}
                className="w-full sm:w-auto"
              >
                Далее
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                aria-busy={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? "Отправляем…" : "Записаться"}
              </Button>
            )}
          </div>
        </form>
      </div>

      <SummaryAside
        service={service}
        doctor={doctor}
        dateKey={selectedDay}
        startsAt={startsAt}
        availability={availability}
        onNext={step < 4 ? goNext : undefined}
        nextDisabled={!canAdvance}
      />
    </div>
  );
}
