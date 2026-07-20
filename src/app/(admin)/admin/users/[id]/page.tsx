import Link from "next/link";
import { AdminUserReport } from "@/components/admin-user-report";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-5">
      <Link
        href="/admin/users"
        className="text-sm text-[var(--accent)] hover:underline"
      >
        ← Kembali ke pengguna
      </Link>
      <AdminUserReport userId={id} />
    </div>
  );
}
