import { AdminLessonManager } from "@/components/admin-lesson-manager";
import { PageHeader } from "@/components/page-header";

export default function AdminLessonsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Modul belajar"
        description="Kelola cek konsep per lesson — generate AI, edit meta, soft-delete extras."
      />
      <AdminLessonManager />
    </div>
  );
}
