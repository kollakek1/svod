import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = { title: "Календарь" };

export default function AdminPage() {
  return <AdminShell />;
}
