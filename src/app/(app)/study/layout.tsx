import { StudyAssistant } from "@/components/study-assistant";
import { canUseAiAssistant, gateFeature } from "@/components/feature-gate";

export default async function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const denied = await gateFeature("study");
  if (denied) return denied;

  const showAssistant = await canUseAiAssistant();

  return (
    <>
      {children}
      {showAssistant ? <StudyAssistant /> : null}
    </>
  );
}
