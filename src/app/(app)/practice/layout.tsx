import { PracticeAssistant } from "@/components/practice-assistant";
import { canUseAiAssistant, gateFeature } from "@/components/feature-gate";

export default async function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const denied = await gateFeature("practice");
  if (denied) return denied;

  const showAssistant = await canUseAiAssistant();

  return (
    <>
      {children}
      {showAssistant ? <PracticeAssistant /> : null}
    </>
  );
}
