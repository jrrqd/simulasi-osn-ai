"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { appPath } from "@/lib/app-path";
import { authClient } from "@/lib/auth-client";

export function AccountPrivacy({ email }: { email: string }) {
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onExport() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch(appPath("/api/account"));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal mengekspor data");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "simulasi-osn-ai-data.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengekspor data");
    } finally {
      setExporting(false);
    }
  }

  async function onDelete(e: FormEvent) {
    e.preventDefault();
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(appPath("/api/account"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: confirmEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus akun");
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus akun");
      setDeleting(false);
    }
  }

  return (
    <div className="panel space-y-4 rounded-3xl p-5">
      <h2 className="display text-2xl">Data akun</h2>
      <p className="text-sm text-[var(--muted)]">
        Unduh salinan profil, latihan, dan simulasi. Menghapus akun menghapus
        data tersebut dari aplikasi.
      </p>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={exporting}
        onClick={() => void onExport()}
      >
        {exporting ? "Menyiapkan…" : "Unduh data saya"}
      </button>
      <form onSubmit={onDelete} className="space-y-3 border-t border-[var(--line)] pt-4">
        <p className="text-sm font-medium">Hapus akun</p>
        <p className="text-sm text-[var(--muted)]">
          Ketik <span className="font-medium text-[var(--ink)]">{email}</span> untuk
          mengonfirmasi.
        </p>
        <input
          className="input"
          type="email"
          value={confirmEmail}
          onChange={(event) => setConfirmEmail(event.target.value)}
          placeholder="Email akun"
          autoComplete="off"
        />
        {error ? <p className="text-sm text-[var(--bad)]">{error}</p> : null}
        <button
          type="submit"
          className="btn btn-secondary"
          disabled={deleting || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
        >
          {deleting ? "Menghapus…" : "Hapus akun dan data"}
        </button>
      </form>
    </div>
  );
}
