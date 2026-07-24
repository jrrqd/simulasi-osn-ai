import { OnboardingClient } from "@/components/onboarding";
import { requireUser } from "@/lib/session";

export default async function OnboardingPage() {
  await requireUser();
  return <OnboardingClient />;
}
