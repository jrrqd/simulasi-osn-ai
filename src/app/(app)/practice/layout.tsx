"use client";

import { SectionSubnav } from "@/components/section-subnav";
import { PracticeAssistant } from "@/components/practice-assistant";

const PRACTICE_LINKS = [
  { href: "/practice", label: "Bank soal" },
  { href: "/practice/generate", label: "Generate" },
  { href: "/practice/ioai", label: "Arsip IOAI" },
];

export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SectionSubnav title="Latihan" links={PRACTICE_LINKS} />
      {children}
      <PracticeAssistant />
    </>
  );
}
