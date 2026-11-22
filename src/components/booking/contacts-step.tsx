"use client";

import { CircleAlert } from "lucide-react";
import type { RefObject } from "react";

import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { CONTACTS } from "@/content/clinic";

import { StepHeading } from "./step-heading";
import type { ContactErrors, ContactValues, SubmitNotice } from "./types";

/** Шаг 4 — контакты. Поля контролируются родителем, чтобы возврат не терял данные. */
export function ContactsStep({
  values,
  errors,
  onChange,
  onBlur,
  headingRef,
  notice,
}: {
  values: ContactValues;
  errors: ContactErrors;
  onChange: (field: keyof ContactValues, value: string | boolean) => void;
  onBlur: (field: "name" | "phone" | "email" | "comment") => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  notice: SubmitNotice | null;
}) {
  const describedBy = (field: "name" | "phone" | "email" | "comment") =>
    errors[field] ? `booking-${field}-error` : undefined;

  return (
    <div>
      <StepHeading
        headingRef={headingRef}
        title="Контакты"
        lead="Позвоним в течение 15 минут в рабочие часы, чтобы подтвердить время. Данные нужны только для записи."
      />

      <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="booking-name">Имя</Label>
          <Input
            id="booking-name"
            name="name"
            autoComplete="name"
            aria-required="true"
            maxLength={80}
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            onBlur={() => onBlur("name")}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={describedBy("name")}
          />
          {errors.name ? <FieldError id="booking-name-error">{errors.name}</FieldError> : null}
        </div>

        <div>
          <Label htmlFor="booking-phone">Телефон</Label>
          <Input
            id="booking-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-required="true"
            maxLength={18}
            value={values.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            onBlur={() => onBlur("phone")}
            aria-invalid={Boolean(errors.phone) || undefined}
            aria-describedby={describedBy("phone")}
          />
          {errors.phone ? <FieldError id="booking-phone-error">{errors.phone}</FieldError> : null}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="booking-email">Email — необязательно</Label>
          <Input
            id="booking-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={120}
            value={values.email}
            onChange={(event) => onChange("email", event.target.value)}
            onBlur={() => onBlur("email")}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={describedBy("email")}
          />
          {errors.email ? <FieldError id="booking-email-error">{errors.email}</FieldError> : null}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="booking-comment">Комментарий — необязательно</Label>
          <Textarea
            id="booking-comment"
            name="comment"
            rows={3}
            maxLength={500}
            value={values.comment}
            onChange={(event) => onChange("comment", event.target.value)}
            onBlur={() => onBlur("comment")}
            aria-invalid={Boolean(errors.comment) || undefined}
            aria-describedby={describedBy("comment")}
          />
          {errors.comment ? <FieldError id="booking-comment-error">{errors.comment}</FieldError> : null}
        </div>
      </div>

      <div className="mt-2">
        <div className="flex items-start gap-3">
          <input
            id="booking-consent"
            name="consent"
            type="checkbox"
            aria-required="true"
            checked={values.consent}
            onChange={(event) => onChange("consent", event.target.checked)}
            aria-invalid={Boolean(errors.consent) || undefined}
            aria-describedby={errors.consent ? "booking-consent-error" : "booking-consent-hint"}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-[2px] accent-accent"
          />
          <div>
            <label htmlFor="booking-consent" className="cursor-pointer text-small leading-relaxed text-text">
              Согласен с обработкой персональных данных
            </label>
            <p id="booking-consent-hint" className="mt-1 text-small leading-relaxed text-text-muted">
              Условия — в{" "}
              <a href="/privacy" className="link-underline text-text">
                политике конфиденциальности
              </a>
              .
            </p>
          </div>
        </div>
        {errors.consent ? <FieldError id="booking-consent-error">{errors.consent}</FieldError> : null}
      </div>

      {/* Honeypot: за пределами экрана, недоступен с клавиатуры и скринридеров. */}
      <div aria-hidden="true" className="pointer-events-none absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="booking-website">Сайт</label>
        <input
          id="booking-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(event) => onChange("website", event.target.value)}
        />
      </div>

      <div aria-live="polite">
        {notice ? (
          <div
            className="mt-6 flex items-start gap-2 border-l-2 border-danger pl-3 text-small leading-relaxed text-danger"
            role="alert"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              {notice.message}
              {notice.kind === "rate" ? (
                <>
                  {" "}
                  <a href={`tel:${CONTACTS.phoneHref}`} className="link-underline font-medium">
                    {CONTACTS.phone}
                  </a>
                  .
                </>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
