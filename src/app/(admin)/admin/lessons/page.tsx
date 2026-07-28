import { AdminLessonManager } from "@/components/admin-lesson-manager";

export default function AdminLessonsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-4xl">Modul belajar</h1>
        <p className="text-[var(--muted)]">
          Kelola cek konsep per lesson — generate AI, edit meta, soft-delete
          extras.
        </p>
      </div>
      <AdminLessonManager />
    </div>
  );
}
