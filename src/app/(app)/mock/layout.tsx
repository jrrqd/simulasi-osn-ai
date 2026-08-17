"use client";

import { usePathname } from "next/navigation";
import { SectionSubnav } from "@/components/section-subnav";

const MOCK_LINKS = [
  { href: "/mock", label: "Bank paket" },
  { href: "/mock/generate", label: "Generate" },
];

export default function MockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Timed exam / kaggle workspace: hide section bar.
  const onExam =
    pathname.startsWith("/mock/") && !pathname.startsWith("/mock/generate");

  return (
    <>
      <SectionSubnav title="Simulasi" links={MOCK_LINKS} hidden={onExam} />
      {children}
    </>
  );
}
