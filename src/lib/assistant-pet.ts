import { appPath } from "@/lib/app-path";

export type AssistantPet = "none" | "cat" | "dog";

export const ASSISTANT_PETS: {
  value: AssistantPet;
  label: string;
  src?: string;
}[] = [
  { value: "none", label: "Tidak ada (ikon default)" },
  { value: "cat", label: "Jacky", src: "/pets/cat.gif?v=2" },
  { value: "dog", label: "Ichi", src: "/pets/dog.webp?v=2" },
];

export function parseAssistantPet(raw: unknown): AssistantPet {
  if (raw === "cat" || raw === "dog" || raw === "none") return raw;
  return "cat";
}

export function assistantPetSrc(pet: AssistantPet): string | null {
  const raw = ASSISTANT_PETS.find((p) => p.value === pet)?.src;
  return raw ? appPath(raw) : null;
}
