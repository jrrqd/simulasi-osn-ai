import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";

export default function RegisterPage() {
  return (
    <div>
      <SiteHeader />
      <div className="px-4 py-12">
        <AuthForm mode="register" />
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-[var(--accent)] underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
