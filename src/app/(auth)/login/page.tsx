import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";

export default function LoginPage() {
  return (
    <div>
      <SiteHeader />
      <div className="px-4 py-12">
        <AuthForm mode="login" />
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Belum punya akun?{" "}
          <Link href="/register" className="text-[var(--accent)] underline">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}
