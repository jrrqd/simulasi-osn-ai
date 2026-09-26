import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div>
      <SiteHeader />
      <div className="px-4 py-12">
        <Suspense
          fallback={
            <div className="panel mx-auto w-full max-w-md rounded-3xl p-6 text-sm text-[var(--muted)]">
              Memuat…
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
