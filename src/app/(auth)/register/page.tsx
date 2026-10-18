import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { publicSiteUrl } from "@/lib/seo-public";

const SITE_URL = publicSiteUrl();

export const metadata: Metadata = {
  title: "Daftar gratis",
  description:
    "Buat akun Simulasi OSN AI gratis. Tidak ada biaya daftar — mulai latihan EKKA/OSN AI 2026 untuk pelajar Indonesia.",
  alternates: {
    canonical: `${SITE_URL}/register`,
  },
  robots: { index: true, follow: true },
  openGraph: {
    url: `${SITE_URL}/register`,
    title: "Daftar gratis · Simulasi OSN AI 2026",
    description:
      "Akun gratis untuk materi, bank soal, simulasi berwaktu, dan pelacak performa OSN AI 2026.",
  },
};

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
