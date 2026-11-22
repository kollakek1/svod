import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./admin.css";

/**
 * Каркас админки: только метаданные и общий фон.
 * Шапка, вкладки и проверка сессии — в клиентском `AdminShell`.
 */
export const metadata: Metadata = {
  title: { default: "Кабинет", template: "%s — СВОД" },
  description: "Рабочее место сотрудника клиники СВОД: календарь записей и каталог.",
  alternates: { canonical: "/admin" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-shell">{children}</div>;
}
