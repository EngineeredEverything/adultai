import { AVAILABLE_LORAS, type LoraConfig } from "@/app/(user)/advanced-generate/advanced-generation-utils";

export const computeLorasFromStyle = (selectedStyle: string): LoraConfig[] => {
  if (selectedStyle === "none") return [];

  const style = AVAILABLE_LORAS.find((l) => l.id === selectedStyle);
  if (!style) return [];

  return [
    { id: style.id, strength: style.defaultStrength || 0.7 },
  ];
}