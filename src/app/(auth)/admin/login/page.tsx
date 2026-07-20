import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";

export default function AdminLoginPage() {
  return (
    <div>
      <SiteHeader />
      <div className="px-4 py-12">
        <AuthForm mode="login" redirectTo="/admin" />
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Login ini hanya membuka dashboard untuk akun dengan role admin.{" "}
          <Link href="/" className="text-[var(--accent)] underline">
            Kembali
          </Link>
        </p>
      </div>
    </div>
  );
}
