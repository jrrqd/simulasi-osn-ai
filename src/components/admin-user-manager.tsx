"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, X } from "lucide-react";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  attemptsCount: number;
  avgLifetimeScore: number;
  avgScorePoints: number;
  avgMaxPoints: number;
  practiceTimeMs: number;
  mocksCompleted: number;
  lastActiveAt: string;
};

function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}j ${minutes % 60}m`
    : `${minutes}m`;
}

export function AdminUserManager() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.email.toLowerCase().includes(normalized),
    );
  }, [query, users]);

  async function removeUser(item: ManagedUser) {
    if (!window.confirm(`Hapus ${item.name} beserta seluruh data belajarnya?`)) {
      return;
    }
    const res = await fetch(
      `/api/admin/users?userId=${encodeURIComponent(item.id)}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setMessage(res.ok ? "User dihapus." : data.error || "Gagal menghapus");
    if (res.ok) await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="input max-w-md"
          placeholder="Cari nama atau email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus size={17} />
          Tambah user
        </button>
      </div>

      {message && (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-sm">{message}</p>
      )}

      <div className="panel overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-white/40">
            <tr>
              {[
                "Pengguna",
                "Role",
                "Attempt",
                "Avg skor",
                "Waktu",
                "Mock",
                "Aksi",
              ].map((label) => (
                <th key={label} className="px-4 py-3 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                className="border-b border-[var(--line)] last:border-0"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${item.id}`}
                    className="font-semibold text-[var(--accent)] hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">{item.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      item.role === "admin"
                        ? "bg-[rgba(196,92,38,0.15)] text-[var(--accent-2)]"
                        : "bg-[rgba(15,110,86,0.12)] text-[var(--accent)]"
                    }`}
                  >
                    {item.role}
                  </span>
                </td>
                <td className="px-4 py-3">{item.attemptsCount}</td>
                <td className="px-4 py-3">
                  {item.mocksCompleted
                    ? `${item.avgScorePoints.toFixed(1)}/${Math.round(item.avgMaxPoints)} (${Math.round(item.avgLifetimeScore * 100)}%)`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {formatDuration(item.practiceTimeMs)}
                </td>
                <td className="px-4 py-3">{item.mocksCompleted}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      className="rounded-lg p-2 hover:bg-white"
                      title="Edit"
                      onClick={() => {
                        setCreating(false);
                        setEditing(item);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="rounded-lg p-2 text-[var(--bad)] hover:bg-white"
                      title="Hapus"
                      onClick={() => removeUser(item)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <p className="p-5 text-sm text-[var(--muted)]">Memuat pengguna…</p>
        )}
      </div>

      {(creating || editing) && (
        <UserEditor
          user={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async (text) => {
            setMessage(text);
            setCreating(false);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState(user?.role ?? "student");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: user ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user?.id,
        name,
        email,
        role,
        password: password || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan");
      return;
    }
    onSaved(user ? "User diperbarui." : "User dibuat.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="panel relative w-full max-w-lg space-y-4 rounded-3xl bg-[var(--bg)] p-6 shadow-2xl"
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-white"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <h2 className="display text-3xl">
          {user ? "Edit pengguna" : "Tambah pengguna"}
        </h2>
        <input
          className="input"
          required
          placeholder="Nama"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="input"
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <select
          className="select"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="student">Student</option>
          <option value="admin">Admin</option>
        </select>
        <input
          className="input"
          type="password"
          required={!user}
          minLength={8}
          placeholder={
            user ? "Password baru (opsional)" : "Password minimal 8 karakter"
          }
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        <button className="btn btn-primary w-full" disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </form>
    </div>
  );
}
