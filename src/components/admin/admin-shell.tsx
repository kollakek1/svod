"use client";

import Link from "next/link";
import { useState } from "react";

import { LogoMark } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import type { AdminRole } from "@/lib/clinic";

import { AdminSessionProvider, useAdminSession } from "./session";
import { CalendarView } from "./calendar-view";
import { CatalogView } from "./catalog-view";
import { ErrorNotice, Skeleton, Tabs } from "./ui";

const ROLE_LABEL: Record<AdminRole, string> = {
  owner: "владелец",
  manager: "администратор",
};

type ViewId = "calendar" | "catalog";

export function AdminShell() {
  return (
    <AdminSessionProvider>
      <Shell />
    </AdminSessionProvider>
  );
}

function Shell() {
  const { user, loading, error, reload, logout } = useAdminSession();
  const [view, setView] = useState<ViewId>("calendar");

  return (
    <>
      <header className="admin-header">
        <div className="admin-wrap flex h-full items-center justify-between gap-4">
          <Link href="/admin" className="admin-brand rounded-[2px]">
            <LogoMark className="h-5 w-5 text-accent-text" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[1.15rem] leading-none tracking-[0.16em] text-text">
                СВОД
              </span>
              <span className="mono-label mt-1 text-[0.5rem] tracking-[0.22em] text-text-muted">
                кабинет
              </span>
            </span>
          </Link>

          {loading ? (
            <div className="flex items-center gap-3" aria-hidden="true">
              <Skeleton className="hidden h-3 w-24 sm:block" />
              <Skeleton className="h-9 w-16" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-3 sm:gap-5">
              <div
                className="text-right"
                title={`${user.name} — ${ROLE_LABEL[user.role]}`}
                aria-label={`${user.name}, ${ROLE_LABEL[user.role]}`}
              >
                <p className="max-w-[8.5rem] truncate text-[0.8125rem] leading-tight text-text sm:max-w-none sm:text-sm">
                  {user.name}
                </p>
                {user.name.trim().toLowerCase() !== ROLE_LABEL[user.role] ? (
                  <p className="mono-label mt-1 hidden text-text-muted sm:block">
                    {ROLE_LABEL[user.role]}
                  </p>
                ) : (
                  <span className="sr-only">{ROLE_LABEL[user.role]}</span>
                )}
              </div>
              <Button
                type="button"
                variant="quiet"
                size="sm"
                className="h-11 border border-line"
                onClick={() => void logout()}
              >
                Выйти
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="admin-wrap">
        <Tabs
          items={[
            { id: "calendar", label: "Календарь" },
            { id: "catalog", label: "Каталог" },
          ]}
          value={view}
          onChange={(id) => setView(id as ViewId)}
          label="Разделы кабинета"
          panelId="admin-panel"
          idPrefix="admin-view"
        />
      </div>

      <main
        id="admin-panel"
        role="tabpanel"
        aria-labelledby={`admin-view-${view}`}
        className="admin-wrap pb-16 pt-6 sm:pt-8"
      >
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <ErrorNotice message={error} onRetry={reload} />
        ) : user ? (
          view === "calendar" ? (
            <CalendarView />
          ) : (
            <CatalogView />
          )
        ) : null}
      </main>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-11" />
          <Skeleton className="h-11 w-11" />
          <Skeleton className="h-11 w-24" />
        </div>
      </div>
      <div className="admin-cal-layout">
        <Skeleton className="h-[360px] w-full sm:h-[440px]" />
        <div className="space-y-px">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}
