import { StudyAssistant } from "@/components/study-assistant";

export default function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <StudyAssistant />
    </>
  );
}
