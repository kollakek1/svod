"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/field";
import { SERVICE_CATEGORIES, type ClinicDoctor, type ClinicService, type ServiceCategory } from "@/lib/clinic";
import { cn } from "@/lib/utils";

import { ApiError, api, errorMessage, isUnauthorized } from "./api";
import { useAdminSession } from "./session";
import { FormField, Select } from "./ui";

interface ServiceFormState {
  name: string;
  slug: string;
  category: ServiceCategory;
  summary: string;
  description: string;
  durationMin: string;
  priceRub: string;
  priceFrom: boolean;
  doctorIds: string[];
}

function initialForm(service: ClinicService | null): ServiceFormState {
  if (!service) {
    return {
      name: "",
      slug: "",
      category: "Терапия",
      summary: "",
      description: "",
      durationMin: "60",
      priceRub: "",
      priceFrom: false,
      doctorIds: [],
    };
  }

  return {
    name: service.name,
    slug: service.slug,
    category: service.category,
    summary: service.summary,
    description: service.description,
    durationMin: String(service.durationMin),
    priceRub: String(service.priceRub),
    priceFrom: service.priceFrom,
    doctorIds: [...service.doctorIds],
  };
}

/**
 * Услуга каталога. Создание и правка — одна форма:
 * цена, длительность и врачи уходят на сервер, ошибки возвращаются в `fields`.
 */
export function ServiceDialog({
  open,
  service,
  doctors,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  service: ClinicService | null;
  doctors: readonly ClinicDoctor[];
  onOpenChange: (open: boolean) => void;
  onSaved: (service: ClinicService, mode: "create" | "edit") => void;
}) {
  const { endSession } = useAdminSession();
  const mode: "create" | "edit" = service ? "edit" : "create";

  const [form, setForm] = useState<ServiceFormState>(() => initialForm(service));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError(null);
  }

  function toggleDoctor(doctorId: string) {
    const next = form.doctorIds.includes(doctorId)
      ? form.doctorIds.filter((id) => id !== doctorId)
      : [...form.doctorIds, doctorId];
    update("doctorIds", next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = "Название — от 2 символов";
    if (form.summary.trim().length < 2) nextErrors.summary = "Добавьте короткое описание";
    const duration = Number(form.durationMin);
    if (!Number.isInteger(duration) || duration < 15 || duration > 300 || duration % 15 !== 0) {
      nextErrors.durationMin = "Целое число минут, 15–300, кратно 15";
    }
    const price = Number(form.priceRub);
    if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
      nextErrors.priceRub = "Целое число рублей, 0–1 000 000";
    }
    if (form.doctorIds.length === 0) nextErrors.doctorIds = "Выберите хотя бы одного врача";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setFormError(null);

    const body = {
      name: form.name.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      category: form.category,
      summary: form.summary.trim(),
      description: form.description.trim(),
      durationMin: duration,
      priceRub: price,
      priceFrom: form.priceFrom,
      doctorIds: form.doctorIds,
    };

    try {
      const payload = await api<{ service: ClinicService }>(
        mode === "edit" && service
          ? `/api/admin/services/${encodeURIComponent(service.id)}`
          : "/api/admin/services",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      onSaved(payload.service, mode);
      onOpenChange(false);
    } catch (reason: unknown) {
      if (isUnauthorized(reason)) {
        endSession();
        return;
      }
      if (reason instanceof ApiError && Object.keys(reason.fields).length > 0) {
        setErrors(reason.fields);
      } else {
        setFormError(errorMessage(reason, "Не удалось сохранить услугу. Попробуйте ещё раз"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={mode === "edit" ? "Изменить услугу" : "Новая услуга"}
        description="Название, цена и врачи сразу появятся на сайте и в форме записи."
        className="max-w-2xl"
      >
        <form className="flex flex-col gap-1" onSubmit={handleSubmit} noValidate>
          <FormField id="svc-name" label="Название" error={errors.name}>
            <Input
              id="svc-name"
              value={form.name}
              maxLength={80}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "svc-name-error" : undefined}
              onChange={(event) => update("name", event.target.value)}
            />
          </FormField>

          <div className="grid gap-x-5 sm:grid-cols-2">
            <FormField
              id="svc-slug"
              label="Адрес (slug)"
              error={errors.slug}
              hint="Латиница и дефис. Можно оставить пустым."
            >
              <Input
                id="svc-slug"
                value={form.slug}
                maxLength={48}
                aria-invalid={Boolean(errors.slug)}
                aria-describedby={errors.slug ? "svc-slug-error" : undefined}
                onChange={(event) => update("slug", event.target.value)}
              />
            </FormField>

            <FormField id="svc-category" label="Категория" error={errors.category}>
              <Select
                id="svc-category"
                value={form.category}
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? "svc-category-error" : undefined}
                onChange={(event) => update("category", event.target.value as ServiceCategory)}
              >
                {SERVICE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField
            id="svc-summary"
            label="Короткое описание"
            error={errors.summary}
            hint="Одна строка для карточки и выбора услуги — до 160 символов."
          >
            <Input
              id="svc-summary"
              value={form.summary}
              maxLength={160}
              aria-invalid={Boolean(errors.summary)}
              aria-describedby={errors.summary ? "svc-summary-error" : undefined}
              onChange={(event) => update("summary", event.target.value)}
            />
          </FormField>

          <FormField
            id="svc-description"
            label="Описание"
            error={errors.description}
            hint="Что входит и чем отличается. До 600 символов."
          >
            <Textarea
              id="svc-description"
              className="min-h-20"
              value={form.description}
              maxLength={600}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "svc-description-error" : undefined}
              onChange={(event) => update("description", event.target.value)}
            />
          </FormField>

          <div className="grid gap-x-5 sm:grid-cols-2">
            <FormField id="svc-duration" label="Длительность, мин" error={errors.durationMin}>
              <Input
                id="svc-duration"
                type="number"
                inputMode="numeric"
                min={15}
                max={300}
                step={15}
                value={form.durationMin}
                aria-invalid={Boolean(errors.durationMin)}
                aria-describedby={errors.durationMin ? "svc-duration-error" : undefined}
                onChange={(event) => update("durationMin", event.target.value)}
              />
            </FormField>

            <FormField id="svc-price" label="Цена, ₽" error={errors.priceRub}>
              <Input
                id="svc-price"
                type="number"
                inputMode="numeric"
                min={0}
                max={1_000_000}
                step={100}
                value={form.priceRub}
                aria-invalid={Boolean(errors.priceRub)}
                aria-describedby={errors.priceRub ? "svc-price-error" : undefined}
                onChange={(event) => update("priceRub", event.target.value)}
              />
            </FormField>
          </div>

          <label className="admin-check-row mt-1">
            <input
              type="checkbox"
              className="admin-check"
              checked={form.priceFrom}
              onChange={(event) => update("priceFrom", event.target.checked)}
            />
            <span>
              Цена «от»{" "}
              <span className="ml-2 text-[0.8125rem] text-text-muted">
                итог зависит от объёма работы
              </span>
            </span>
          </label>

          <fieldset className="mt-4 border-t border-line pt-4">
            <legend className="mono-label text-text-muted">Врачи</legend>
            <div className="mt-1 grid gap-x-5 sm:grid-cols-2">
              {doctors.map((doctor) => (
                <label key={doctor.id} className="admin-check-row">
                  <input
                    type="checkbox"
                    className="admin-check"
                    checked={form.doctorIds.includes(doctor.id)}
                    onChange={() => toggleDoctor(doctor.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] leading-tight">{doctor.name}</span>
                    <span className="block truncate text-[0.75rem] leading-tight text-text-muted">
                      {doctor.role}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p
              className={cn(
                "mt-1 min-h-5 text-[0.8125rem] leading-snug",
                errors.doctorIds ? "text-danger" : "text-text-muted",
              )}
              role={errors.doctorIds ? "alert" : undefined}
            >
              {errors.doctorIds ?? "Отметьте тех, кто выполняет услугу."}
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
