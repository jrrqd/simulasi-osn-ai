"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { appPath } from "@/lib/app-path";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${appPath("/reset-password")}`
          : appPath("/reset-password");
      const res = await authClient.requestPasswordReset({
        email,
        redirectTo,
      });
      if (res.error) {
        throw new Error(res.error.message || "Gagal mengirim email reset");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="panel mx-auto w-full max-w-md space-y-4 rounded-3xl p-6">
        <h1 className="display text-3xl">Cek email</h1>
        <p className="text-sm text-[var(--muted)]">
          Jika email terdaftar, kami mengirim tautan reset password. Periksa
          juga folder spam.
        </p>
        <Link href="/login" className="btn btn-primary inline-flex">
          Kembali ke masuk
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="panel mx-auto w-full max-w-md space-y-4 rounded-3xl p-6"
    >
      <h1 className="display text-3xl">Lupa password</h1>
      <p className="text-sm text-[var(--muted)]">
        Masukkan email akun. Kami kirim tautan untuk mengatur password baru.
      </p>
      <input
        className="input"
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
      <button className="btn btn-primary w-full" disabled={loading} type="submit">
        {loading ? "Mengirim…" : "Kirim tautan reset"}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        <Link href="/login" className="text-[var(--accent)] underline">
          Kembali ke masuk
        </Link>
      </p>
    </form>
  );
}
