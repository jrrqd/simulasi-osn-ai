import { StudyAssistant } from "@/components/study-assistant";

export default function PracticeLayout({
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
