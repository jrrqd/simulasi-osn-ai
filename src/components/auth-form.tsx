"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForm({
  mode,
  redirectTo = "/study",
}: {
  mode: "login" | "register";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });
        if (res.error) throw new Error(res.error.message || "Gagal daftar");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message || "Gagal masuk");
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel mx-auto w-full max-w-md space-y-4 rounded-3xl p-6">
      <h1 className="display text-3xl">
        {mode === "login" ? "Masuk" : "Buat akun"}
      </h1>
      <p className="text-sm text-[var(--muted)]">
        Progress dan pengaturan AI tersimpan per akun.
      </p>
      {mode === "register" && (
        <input
          className="input"
          placeholder="Nama"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}
      <input
        className="input"
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="input"
        type="password"
        required
        minLength={8}
        placeholder="Password (min. 8)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
      <button className="btn btn-primary w-full" disabled={loading} type="submit">
        {loading ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}
      </button>
    </form>
  );
}
