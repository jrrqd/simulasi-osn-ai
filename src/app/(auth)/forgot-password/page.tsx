import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Lupa password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <SiteHeader />
      <div className="px-4 py-12">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
