"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  parseUserType,
  USER_TYPE_LABELS,
  USER_TYPE_VALUES,
  type UserType,
} from "@/lib/user/user-type";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  userType: string;
  attemptsCount: number;
  avgLifetimeScore: number;
  avgScorePoints: number;
  avgMaxPoints: number;
  practiceTimeMs: number;
  mocksCompleted: number;
  lastActiveAt: string;
};

type TypeFilterKey = UserType | "admin";

const HIDE_TEST_KEY = "admin-users-hide-test";
const TYPE_FILTER_KEY = "admin-users-type-filter";

const ALL_TYPE_FILTERS: TypeFilterKey[] = [
  "free",
  "vip",
  "test",
  "admin",
];

function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}j ${minutes % 60}m`
    : `${minutes}m`;
}

function displayType(item: ManagedUser): TypeFilterKey {
  return item.role === "admin" ? "admin" : parseUserType(item.userType);
}

function typeLabel(key: TypeFilterKey) {
  return key === "admin" ? "Admin" : USER_TYPE_LABELS[key];
}

function typeBadgeClass(key: TypeFilterKey) {
  if (key === "admin") {
    return "bg-[rgba(196,92,38,0.15)] text-[var(--accent-2)]";
  }
  if (key === "vip") {
    return "bg-[rgba(180,140,40,0.18)] text-[var(--accent-2)]";
  }
  if (key === "test") {
    return "bg-[rgba(100,100,120,0.15)] text-[var(--muted)]";
  }
  return "bg-[rgba(15,110,86,0.12)] text-[var(--accent)]";
}

function loadHideTest(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(HIDE_TEST_KEY);
  if (raw == null) return true;
  return raw !== "0";
}

function loadTypeFilters(): Set<TypeFilterKey> {
  if (typeof window === "undefined") {
    return new Set(ALL_TYPE_FILTERS);
  }
  try {
    const raw = window.localStorage.getItem(TYPE_FILTER_KEY);
    if (!raw) return new Set(ALL_TYPE_FILTERS);
    const parsed = JSON.parse(raw) as string[];
    const next = new Set<TypeFilterKey>();
    for (const item of parsed) {
      if (
        item === "admin" ||
        item === "free" ||
        item === "vip" ||
        item === "test"
      ) {
        next.add(item);
      }
    }
    return next.size ? next : new Set(ALL_TYPE_FILTERS);
  } catch {
    return new Set(ALL_TYPE_FILTERS);
  }
}

export function AdminUserManager() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [hideTest, setHideTest] = useState(true);
  const [typeFilters, setTypeFilters] = useState<Set<TypeFilterKey>>(
    () => new Set(ALL_TYPE_FILTERS),
  );
  const [typeSort, setTypeSort] = useState<"asc" | "desc" | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHideTest(loadHideTest());
    setTypeFilters(loadTypeFilters());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(HIDE_TEST_KEY, hideTest ? "1" : "0");
  }, [hideTest, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      TYPE_FILTER_KEY,
      JSON.stringify([...typeFilters]),
    );
  }, [typeFilters, hydrated]);

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
    let list = users.filter((item) => {
      const key = displayType(item);
      if (hideTest && key === "test") return false;
      if (!typeFilters.has(key)) return false;
      if (!normalized) return true;
      return (
        item.name.toLowerCase().includes(normalized) ||
        item.email.toLowerCase().includes(normalized) ||
        key.includes(normalized) ||
        typeLabel(key).toLowerCase().includes(normalized)
      );
    });

    if (typeSort) {
      list = [...list].sort((a, b) => {
        const la = typeLabel(displayType(a));
        const lb = typeLabel(displayType(b));
        const cmp = la.localeCompare(lb, "id");
        return typeSort === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [query, users, hideTest, typeFilters, typeSort]);

  function toggleTypeFilter(key: TypeFilterKey) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return next;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleTypeSort() {
    setTypeSort((prev) => {
      if (prev === null) return "asc";
      if (prev === "asc") return "desc";
      return null;
    });
  }

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
          placeholder="Cari nama, email, atau tipe…"
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

      <div className="flex flex-wrap items-center gap-2">
        {ALL_TYPE_FILTERS.map((key) => {
          const active = typeFilters.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? typeBadgeClass(key)
                  : "bg-white/50 text-[var(--muted)] line-through opacity-60"
              }`}
              onClick={() => toggleTypeFilter(key)}
            >
              {typeLabel(key)}
            </button>
          );
        })}
        <label className="ml-2 flex items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={hideTest}
            onChange={(event) => setHideTest(event.target.checked)}
          />
          Sembunyikan akun test
        </label>
      </div>

      {message && (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-sm">{message}</p>
      )}

      <div className="panel overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-white/40">
            <tr>
              <th className="px-4 py-3 font-semibold">Pengguna</th>
              <th className="px-4 py-3 font-semibold">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-[var(--accent)]"
                  onClick={toggleTypeSort}
                  title="Urutkan tipe"
                >
                  Tipe
                  {typeSort === "asc" ? (
                    <ArrowUp size={14} />
                  ) : typeSort === "desc" ? (
                    <ArrowDown size={14} />
                  ) : null}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">Attempt</th>
              <th className="px-4 py-3 font-semibold">Avg skor</th>
              <th className="px-4 py-3 font-semibold">Waktu</th>
              <th className="px-4 py-3 font-semibold">Mock</th>
              <th className="px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const key = displayType(item);
              return (
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
                      className={`rounded-full px-2 py-1 text-xs ${typeBadgeClass(key)}`}
                    >
                      {typeLabel(key)}
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
              );
            })}
          </tbody>
        </table>
        {loading && (
          <p className="p-5 text-sm text-[var(--muted)]">Memuat pengguna…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="p-5 text-sm text-[var(--muted)]">
            Tidak ada pengguna yang cocok dengan filter.
          </p>
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
  const [userType, setUserType] = useState<UserType>(
    parseUserType(user?.userType),
  );
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
        userType: role === "student" ? userType : undefined,
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
        {role === "student" ? (
          <select
            className="select"
            value={userType}
            onChange={(event) =>
              setUserType(parseUserType(event.target.value))
            }
          >
            {USER_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {USER_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        ) : null}
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
