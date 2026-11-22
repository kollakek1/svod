"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  WEEKDAY_LABELS,
  type ClinicDoctor,
  type ClinicService,
  type Weekday,
} from "@/lib/clinic";
import { formatDuration, formatRub, pluralRu } from "@/lib/format";

import { api, errorMessage, isAbortError, isUnauthorized } from "./api";
import { DeleteDialog, type DeleteTarget } from "./delete-dialog";
import { DoctorDialog } from "./doctor-dialog";
import { ServiceDialog } from "./service-dialog";
import { useAdminSession } from "./session";
import type { Catalog } from "./types";
import { ErrorNotice, Skeleton, Tabs } from "./ui";
import { formatStamp } from "./date";
import { useTriggerFocus } from "./use-trigger-focus";

function priceLabel(service: ClinicService): string {
  return service.priceFrom ? `от ${formatRub(service.priceRub)}` : formatRub(service.priceRub);
}

function daysLabel(days: readonly Weekday[]): string {
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((day) => WEEKDAY_LABELS[day].short)
    .join(", ");
}

function yearsLabel(years: number): string {
  return `${years} ${pluralRu(years, ["год", "года", "лет"])}`;
}

/**
 * Каталог: услуги и врачи. После каждой мутации — перезапрос:
 * сайт читает тот же документ, поэтому изменения видны сразу.
 */
export function CatalogView() {
  const { endSession } = useAdminSession();
  const { remember: rememberTrigger, restore: restoreTrigger } = useTriggerFocus();

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seq, setSeq] = useState(0);

  const [tab, setTab] = useState<"services" | "doctors">("services");
  const [notice, setNotice] = useState<string | null>(null);

  const [serviceDialog, setServiceDialog] = useState<{ service: ClinicService | null } | null>(null);
  const [doctorDialog, setDoctorDialog] = useState<{ doctor: ClinicDoctor | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [serviceKey, setServiceKey] = useState(0);
  const [doctorKey, setDoctorKey] = useState(0);
  const [deleteKey, setDeleteKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    api<{ catalog: Catalog }>("/api/admin/catalog", { signal: controller.signal })
      .then((payload) => {
        setCatalog(payload.catalog);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason) || controller.signal.aborted) return;
        if (isUnauthorized(reason)) {
          endSession();
          return;
        }
        setError(errorMessage(reason, "Не удалось загрузить каталог. Попробуйте ещё раз"));
      });

    return () => controller.abort();
  }, [seq, endSession]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  function refresh() {
    setSeq((value) => value + 1);
  }

  function openService(service: ClinicService | null) {
    rememberTrigger();
    setServiceKey((value) => value + 1);
    setServiceDialog({ service });
  }

  function openDoctor(doctor: ClinicDoctor | null) {
    rememberTrigger();
    setDoctorKey((value) => value + 1);
    setDoctorDialog({ doctor });
  }

  function openDelete(target: DeleteTarget) {
    rememberTrigger();
    setDeleteKey((value) => value + 1);
    setDeleteTarget(target);
  }

  const services = catalog?.services ?? [];
  const doctors = catalog?.doctors ?? [];
  const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

  function serviceDoctors(service: ClinicService): string {
    const names = service.doctorIds
      .map((id) => doctorNames.get(id))
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(", ") : "—";
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-5 border-t border-line-strong pt-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Eyebrow>Каталог</Eyebrow>
          <h1 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.75rem)] leading-none tracking-[-0.02em] text-text">
            Услуги и врачи
          </h1>
          <p className="mt-2 text-small text-text-muted">
            {catalog
              ? `Обновлено ${formatStamp(catalog.updatedAt)} · изменения сразу видны на сайте`
              : "Загружаем каталог"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="md"
            id="catalog-add"
            onClick={() =>
              tab === "services" ? openService(null) : openDoctor(null)
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {tab === "services" ? "Добавить услугу" : "Добавить врача"}
          </Button>
        </div>
      </div>

      <div>
        <Tabs
          items={[
            { id: "services", label: "Услуги", count: services.length },
            { id: "doctors", label: "Врачи", count: doctors.length },
          ]}
          value={tab}
          onChange={(id) => setTab(id as "services" | "doctors")}
          label="Разделы каталога"
          panelId="catalog-panel"
          idPrefix="catalog-tab"
        />

        <div
          id="catalog-panel"
          role="tabpanel"
          aria-labelledby={`catalog-tab-${tab}`}
          className="pt-5"
        >
          <div aria-live="polite" className="min-h-0">
            {notice ? <p className="mb-3 text-[0.8125rem] text-accent-text">{notice}</p> : null}
          </div>

          {error ? (
            <ErrorNotice
              className="mb-4"
              message={error}
              onRetry={() => {
                setError(null);
                refresh();
              }}
            />
          ) : null}

          {!catalog && !error ? (
            <TableSkeleton />
          ) : tab === "services" ? (
            services.length === 0 ? (
              <EmptyCatalog
                title="В каталоге пока нет услуг"
                text="Добавьте первую — она появится на сайте и в форме записи."
                actionLabel="Добавить услугу"
                onAction={() => openService(null)}
              />
            ) : (
              <ServicesPanel
                services={services}
                serviceDoctors={serviceDoctors}
                onEdit={(service) => openService(service)}
                onDelete={(service) =>
                  openDelete({ kind: "service", id: service.id, name: service.name })
                }
              />
            )
          ) : doctors.length === 0 ? (
            <EmptyCatalog
              title="В каталоге пока нет врачей"
              text="Без врача услугу нельзя записать — добавьте хотя бы одного."
              actionLabel="Добавить врача"
              onAction={() => openDoctor(null)}
            />
          ) : (
            <DoctorsPanel
              doctors={doctors}
              onEdit={(doctor) => openDoctor(doctor)}
              onDelete={(doctor) =>
                openDelete({ kind: "doctor", id: doctor.id, name: doctor.name })
              }
            />
          )}

          {tab === "services" && services.length > 0 ? (
            <p className="mt-5 text-[0.75rem] leading-snug text-text-muted">
              Удаление физическое: архивной копии нет. Услугу с будущими записями удалить нельзя —
              сначала перенесите или отмените их.
            </p>
          ) : null}
        </div>
      </div>

      <ServiceDialog
        key={`service-${serviceKey}`}
        open={serviceDialog !== null}
        service={serviceDialog?.service ?? null}
        doctors={doctors}
        onOpenChange={(open) => {
          if (!open) {
            setServiceDialog(null);
            restoreTrigger("#catalog-add");
          }
        }}
        onSaved={(saved, mode) => {
          setNotice(
            mode === "create"
              ? `Услуга «${saved.name}» добавлена`
              : `Услуга «${saved.name}» сохранена`,
          );
          setServiceDialog(null);
          refresh();
        }}
      />

      <DoctorDialog
        key={`doctor-${doctorKey}`}
        open={doctorDialog !== null}
        doctor={doctorDialog?.doctor ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setDoctorDialog(null);
            restoreTrigger("#catalog-add");
          }
        }}
        onSaved={(saved, mode) => {
          setNotice(
            mode === "create" ? `Врач ${saved.name} добавлен` : `Врач ${saved.name} сохранён`,
          );
          setDoctorDialog(null);
          refresh();
        }}
      />

      <DeleteDialog
        key={`delete-${deleteKey}`}
        target={deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            restoreTrigger("#catalog-add");
          }
        }}
        onDeleted={(message) => {
          setNotice(message);
          setDeleteTarget(null);
          refresh();
        }}
      />
    </div>
  );
}

/* ─── Услуги ──────────────────────────────────────────────────────────────── */

function ServicesPanel({
  services,
  serviceDoctors,
  onEdit,
  onDelete,
}: {
  services: readonly ClinicService[];
  serviceDoctors: (service: ClinicService) => string;
  onEdit: (service: ClinicService) => void;
  onDelete: (service: ClinicService) => void;
}) {
  return (
    <>
      <div className="admin-table-view">
        <table className="admin-table">
          <caption className="sr-only">Услуги каталога</caption>
          <thead>
            <tr>
              <th scope="col">Услуга</th>
              <th scope="col">Категория</th>
              <th scope="col">Длительность</th>
              <th scope="col">Цена</th>
              <th scope="col">Врачи</th>
              <th scope="col">
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td>
                  <span className="block text-[0.9375rem] leading-tight text-text">{service.name}</span>
                  <span className="mt-1 hidden text-[0.75rem] leading-tight text-text-muted xl:block">
                    {service.summary}
                  </span>
                </td>
                <td className="whitespace-nowrap text-[0.8125rem] text-text-muted">{service.category}</td>
                <td className="tnum whitespace-nowrap text-[0.8125rem] text-text">
                  {formatDuration(service.durationMin)}
                </td>
                <td className="tnum whitespace-nowrap text-[0.875rem] text-text">
                  {priceLabel(service)}
                </td>
                <td
                  className="admin-cell-clip text-[0.8125rem] leading-snug text-text-muted"
                  title={serviceDoctors(service)}
                >
                  {serviceDoctors(service)}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11"
                      aria-label={`Изменить услугу «${service.name}»`}
                      onClick={() => onEdit(service)}
                    >
                      Изменить
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="h-11"
                      aria-label={`Удалить услугу «${service.name}»`}
                      onClick={() => onDelete(service)}
                    >
                      Удалить
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-card-view">
        {services.map((service) => (
          <article key={service.id} className="admin-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[1.1rem] leading-tight text-text">{service.name}</p>
                <p className="mt-1 text-[0.8125rem] leading-snug text-text-muted">{service.summary}</p>
              </div>
              <p className="tnum shrink-0 text-[0.9375rem] text-text">{priceLabel(service)}</p>
            </div>
            <div className="admin-card-meta">
              <span>{service.category}</span>
              <span className="tnum">{formatDuration(service.durationMin)}</span>
              <span>{serviceDoctors(service)}</span>
            </div>
            <div className="admin-card-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11"
                aria-label={`Изменить услугу «${service.name}»`}
                onClick={() => onEdit(service)}
              >
                Изменить
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="h-11"
                aria-label={`Удалить услугу «${service.name}»`}
                onClick={() => onDelete(service)}
              >
                Удалить
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/* ─── Врачи ───────────────────────────────────────────────────────────────── */

function DoctorsPanel({
  doctors,
  onEdit,
  onDelete,
}: {
  doctors: readonly ClinicDoctor[];
  onEdit: (doctor: ClinicDoctor) => void;
  onDelete: (doctor: ClinicDoctor) => void;
}) {
  return (
    <>
      <div className="admin-table-view">
        <table className="admin-table">
          <caption className="sr-only">Врачи каталога</caption>
          <thead>
            <tr>
              <th scope="col">Врач</th>
              <th scope="col">Роль</th>
              <th scope="col">Стаж</th>
              <th scope="col">Рабочие дни</th>
              <th scope="col">
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doctor) => (
              <tr key={doctor.id}>
                <td>
                  <span className="block text-[0.9375rem] leading-tight text-text">{doctor.name}</span>
                  <span className="mt-1 hidden text-[0.75rem] leading-tight text-text-muted xl:block">
                    {doctor.focus}
                  </span>
                </td>
                <td className="text-[0.8125rem] text-text-muted">{doctor.role}</td>
                <td className="tnum whitespace-nowrap text-[0.8125rem] text-text">
                  {yearsLabel(doctor.years)}
                </td>
                <td className="whitespace-nowrap text-[0.8125rem] text-text-muted">
                  {daysLabel(doctor.workingDays)}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11"
                      aria-label={`Изменить врача ${doctor.name}`}
                      onClick={() => onEdit(doctor)}
                    >
                      Изменить
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="h-11"
                      aria-label={`Удалить врача ${doctor.name}`}
                      onClick={() => onDelete(doctor)}
                    >
                      Удалить
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-card-view">
        {doctors.map((doctor) => (
          <article key={doctor.id} className="admin-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[1.1rem] leading-tight text-text">{doctor.name}</p>
                <p className="mt-1 text-[0.8125rem] leading-snug text-text-muted">{doctor.role}</p>
              </div>
              <p className="tnum shrink-0 text-[0.8125rem] text-text-muted">{yearsLabel(doctor.years)}</p>
            </div>
            <div className="admin-card-meta">
              <span>{doctor.focus}</span>
              <span>Дни: {daysLabel(doctor.workingDays)}</span>
            </div>
            <div className="admin-card-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11"
                aria-label={`Изменить врача ${doctor.name}`}
                onClick={() => onEdit(doctor)}
              >
                Изменить
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="h-11"
                aria-label={`Удалить врача ${doctor.name}`}
                onClick={() => onDelete(doctor)}
              >
                Удалить
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/* ─── Служебные состояния ─────────────────────────────────────────────────── */

function EmptyCatalog({
  title,
  text,
  actionLabel,
  onAction,
}: {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="border-t border-line-strong py-10">
      <p className="text-[0.9375rem] text-text">{title}</p>
      <p className="mt-1 text-small text-text-muted">{text}</p>
      <Button type="button" size="md" className="mt-5" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-px" aria-hidden="true">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-t border-line py-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
          <Skeleton className="hidden h-3 w-20 sm:block" />
          <Skeleton className="hidden h-3 w-16 sm:block" />
          <Skeleton className="h-9 w-32" />
        </div>
      ))}
    </div>
  );
}
