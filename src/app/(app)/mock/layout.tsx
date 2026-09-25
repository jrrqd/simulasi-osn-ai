import { gateAnyFeature } from "@/components/feature-gate";

export default async function MockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const denied = await gateAnyFeature(
    ["mock_curated", "generate_simulasi"],
    "mock_curated",
  );
  if (denied) return denied;
  return children;
}
