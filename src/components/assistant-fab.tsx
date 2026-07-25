"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import {
  assistantPetSrc,
  parseAssistantPet,
  type AssistantPet,
} from "@/lib/assistant-pet";

export function useAssistantPet() {
  const [pet, setPet] = useState<AssistantPet>("cat");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || cancelled) return;
        setPet(parseAssistantPet(data.assistantPet));
      })
      .catch(() => {
        /* keep default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return pet;
}

export function AssistantFabIcon({
  open,
  pet,
  fallback = "chat",
}: {
  open: boolean;
  pet: AssistantPet;
  fallback?: "chat" | "none";
}) {
  if (open) return <X size={22} />;
  const src = assistantPetSrc(pet);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 object-contain"
        style={{ imageRendering: "pixelated" }}
        draggable={false}
      />
    );
  }
  if (fallback === "chat") return <MessageCircle size={22} />;
  return <span className="text-sm font-bold">AI</span>;
}

export function assistantFabButtonClass(pet: AssistantPet) {
  if (pet === "none") {
    return "flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_8px_24px_rgba(15,110,86,0.35)] transition hover:scale-105";
  }
  // Light plate so black/white pixel pets stay visible
  return "flex h-16 w-16 items-center justify-center rounded-full border border-[var(--line)] bg-[#fff8ef] shadow-[0_8px_24px_rgba(28,36,48,0.18)] transition hover:scale-105";
}
