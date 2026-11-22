import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm, LoginSkeleton } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Вход в кабинет", alternates: { canonical: "/admin/login" } };

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
