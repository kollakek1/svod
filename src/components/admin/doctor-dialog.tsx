"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/field";
import { WEEKDAY_LABELS, type ClinicDoctor, type Weekday } from "@/lib/clinic";
import { cn } from "@/lib/utils";

import { ApiError, api, errorMessage, isUnauthorized } from "./api";
import { useAdminSession } from "./session";
import { FormField } from "./ui";

const DAY_ORDER: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];

interface DoctorFormState {
  name: string;
  role: string;
  focus: string;
  years: string;
  quote: string;
  photo: string;
  workingDays: Weekday[];
}

function initialForm(doctor: ClinicDoctor | null): DoctorFormState {
  if (!doctor) {
    return {
      name: "",
      role: "",
      focus: "",
      years: "",
      quote: "",
      photo: "",
      workingDays: [1, 2, 3, 4, 5],
    };
  }

  return {
    name: doctor.name,
    role: doctor.role,
    focus: doctor.focus,
    years: String(doctor.years),
    quote: doctor.quote ?? "",
    photo: doctor.photo ?? "",
    workingDays: [...doctor.workingDays],
  };
}

/** Карточка врача: имя, роль, стаж и рабочие дни. Дни — чипы, как в записи. */
export function DoctorDialog({
  open,
  doctor,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  doctor: ClinicDoctor | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (doctor: ClinicDoctor, mode: "create" | "edit") => void;
}) {
  const { endSession } = useAdminSession();
  const mode: "create" | "edit" = doctor ? "edit" : "create";

  const [form, setForm] = useState<DoctorFormState>(() => initialForm(doctor));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof DoctorFormState>(key: K, value: DoctorFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError(null);
  }

  function toggleDay(day: Weekday) {
    const next = form.workingDays.includes(day)
      ? form.workingDays.filter((value) => value !== day)
      : [...form.workingDays, day];
    update("workingDays", next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = "Имя — от 2 символов";
    if (form.role.trim().length < 2) nextErrors.role = "Укажите специализацию";
    if (form.focus.trim().length < 2) nextErrors.focus = "Опишите, что ведёт врач";
    const years = Number(form.years);
    if (!Number.isInteger(years) || years < 0 || years > 60) {
      nextErrors.years = "Стаж — целое число лет, 0–60";
    }
    if (form.workingDays.length === 0) nextErrors.workingDays = "Выберите хотя бы один день";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setFormError(null);

    const body = {
      name: form.name.trim(),
      role: form.role.trim(),
      focus: form.focus.trim(),
      years,
      quote: form.quote.trim(),
      // Пустая строка — осознанное «убрать фото», поэтому отправляем всегда.
      photo: form.photo.trim(),
      workingDays: form.workingDays,
    };

    try {
      const payload = await api<{ doctor: ClinicDoctor }>(
        mode === "edit" && doctor
          ? `/api/admin/doctors/${encodeURIComponent(doctor.id)}`
          : "/api/admin/doctors",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      onSaved(payload.doctor, mode);
      onOpenChange(false);
    } catch (reason: unknown) {
      if (isUnauthorized(reason)) {
        endSession();
        return;
      }
      if (reason instanceof ApiError && Object.keys(reason.fields).length > 0) {
        setErrors(reason.fields);
      } else {
        setFormError(errorMessage(reason, "Не удалось сохранить врача. Попробуйте ещё раз"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={mode === "edit" ? "Изменить врача" : "Новый врач"}
        description="Рабочие дни участвуют в расчёте свободных слотов — проверьте их."
        className="max-w-xl"
      >
        <form className="flex flex-col gap-1" onSubmit={handleSubmit} noValidate>
          <FormField id="doc-name" label="Имя и фамилия" error={errors.name}>
            <Input
              id="doc-name"
              value={form.name}
              maxLength={80}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "doc-name-error" : undefined}
              onChange={(event) => update("name", event.target.value)}
            />
          </FormField>

          <FormField
            id="doc-role"
            label="Роль"
            error={errors.role}
            hint="Коротко, как на сайте: «терапевт, эндодонтист»."
          >
            <Input
              id="doc-role"
              value={form.role}
              maxLength={80}
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? "doc-role-error" : undefined}
              onChange={(event) => update("role", event.target.value)}
            />
          </FormField>

          <FormField
            id="doc-focus"
            label="Чем занимается"
            error={errors.focus}
            hint="Одна строка для карточки врача."
          >
            <Input
              id="doc-focus"
              value={form.focus}
              maxLength={160}
              aria-invalid={Boolean(errors.focus)}
              aria-describedby={errors.focus ? "doc-focus-error" : undefined}
              onChange={(event) => update("focus", event.target.value)}
            />
          </FormField>

          <div className="grid gap-x-5 sm:grid-cols-[10rem_1fr]">
            <FormField id="doc-years" label="Стаж, лет" error={errors.years}>
              <Input
                id="doc-years"
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                value={form.years}
                aria-invalid={Boolean(errors.years)}
                aria-describedby={errors.years ? "doc-years-error" : undefined}
                onChange={(event) => update("years", event.target.value)}
              />
            </FormField>

            <FormField
              id="doc-photo"
              label="Фото, путь"
              error={errors.photo}
              hint="Необязательно. Например: /images/team/anna-kovaleva.webp"
            >
              <Input
                id="doc-photo"
                value={form.photo}
                maxLength={200}
                aria-invalid={Boolean(errors.photo)}
                aria-describedby={errors.photo ? "doc-photo-error" : undefined}
                onChange={(event) => update("photo", event.target.value)}
              />
            </FormField>
          </div>

          <FormField id="doc-quote" label="Цитата" error={errors.quote} hint="До 240 символов, необязательно.">
            <Textarea
              id="doc-quote"
              className="min-h-16"
              value={form.quote}
              maxLength={240}
              aria-invalid={Boolean(errors.quote)}
              aria-describedby={errors.quote ? "doc-quote-error" : undefined}
              onChange={(event) => update("quote", event.target.value)}
            />
          </FormField>

          <fieldset className="mt-2 border-t border-line pt-4">
            <legend className="mono-label text-text-muted">Рабочие дни</legend>
            <div className="admin-chips mt-2 flex-wrap overflow-visible">
              {DAY_ORDER.map((day) => {
                const active = form.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className="admin-chip"
                    aria-pressed={active}
                    aria-label={WEEKDAY_LABELS[day].long}
                    onClick={() => toggleDay(day)}
                  >
                    <span
                      className={cn(
                        "font-mono text-[0.6875rem] uppercase leading-none tracking-[0.1em]",
                        active ? "text-text" : "text-text-muted",
                      )}
                    >
                      {WEEKDAY_LABELS[day].short}
                    </span>
                  </button>
                );
              })}
            </div>
            <p
              className={cn(
                "mt-1 min-h-5 text-[0.8125rem] leading-snug",
                errors.workingDays ? "text-danger" : "text-text-muted",
              )}
              role={errors.workingDays ? "alert" : undefined}
            >
              {errors.workingDays ?? "В эти дни врач доступен для записи."}
            </p>
          </fieldset>

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
            <Button type="submit" size="md" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
