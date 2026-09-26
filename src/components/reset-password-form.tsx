"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token")?.trim() || "",
    [searchParams],
  );
  const tokenError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(
    tokenError === "INVALID_TOKEN"
      ? "Tautan reset tidak valid atau sudah kedaluwarsa."
      : "",
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Tautan reset tidak lengkap. Minta ulang dari halaman lupa password.");
      return;
    }
    if (password !== confirm) {
      setError("Password konfirmasi tidak sama.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (res.error) {
        throw new Error(res.error.message || "Gagal mengatur password");
      }
      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="panel mx-auto w-full max-w-md space-y-4 rounded-3xl p-6"
    >
      <h1 className="display text-3xl">Password baru</h1>
      <p className="text-sm text-[var(--muted)]">
        Masukkan password baru untuk akunmu (minimal 8 karakter).
      </p>
      <input
        className="input"
        type="password"
        required
        minLength={8}
        placeholder="Password baru"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        className="input"
        type="password"
        required
        minLength={8}
        placeholder="Ulangi password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
      <button
        className="btn btn-primary w-full"
        disabled={loading || !token}
        type="submit"
      >
        {loading ? "Menyimpan…" : "Simpan password"}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        <Link href="/forgot-password" className="text-[var(--accent)] underline">
          Minta tautan baru
        </Link>
      </p>
    </form>
  );
}
