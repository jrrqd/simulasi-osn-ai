import { PracticeAssistant } from "@/components/practice-assistant";

export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <PracticeAssistant />
    </>
  );
}
