import type { AvailabilityResponse } from "@/lib/clinic";

export type BookingStep = 1 | 2 | 3 | 4;

export type AvailabilityStatus = "idle" | "loading" | "ready" | "error";

export interface ContactValues {
  name: string;
  phone: string;
  email: string;
  comment: string;
  consent: boolean;
  /** Honeypot: человек это поле не видит и не заполняет. */
  website: string;
}

export type ContactField = "name" | "phone" | "email" | "comment" | "consent";

export type ContactErrors = Partial<Record<ContactField, string>>;

/** Подтверждение из ответа 201 — снапшоты с сервера, клиент их не считает. */
export interface BookingConfirmation {
  code: string;
  serviceName: string;
  doctorName: string;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  priceRub: number;
  priceFrom?: boolean;
  status: string;
}

export type SubmitNoticeKind = "rate" | "retry" | "validation";

export interface SubmitNotice {
  kind: SubmitNoticeKind;
  message: string;
}

export interface AvailabilityState {
  status: AvailabilityStatus;
  data: AvailabilityResponse | null;
  error: string | null;
}
