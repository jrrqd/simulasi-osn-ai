export type AssistantPet = "none" | "cat" | "dog";

export const ASSISTANT_PETS: {
  value: AssistantPet;
  label: string;
  src?: string;
}[] = [
  { value: "none", label: "Tidak ada (ikon default)" },
  { value: "cat", label: "Jacky", src: "/pets/cat.gif" },
  { value: "dog", label: "Ichi", src: "/pets/dog.webp" },
];

export function parseAssistantPet(raw: unknown): AssistantPet {
  if (raw === "cat" || raw === "dog" || raw === "none") return raw;
  return "cat";
}

export function assistantPetSrc(pet: AssistantPet): string | null {
  return ASSISTANT_PETS.find((p) => p.value === pet)?.src ?? null;
}
