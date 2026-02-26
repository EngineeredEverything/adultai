import type { SubscriptionStatus } from "../gallery/components/GenerationForm/subscription-utils";

// LoRA configuration
export interface LoraConfig {
  id: string;
  strength: number;
}

export const AVAILABLE_LORAS = [
  { id: "more_details", name: "Add More Detail", category: "quality", description: "Enhances fine details and textures", defaultStrength: 0.7 },
  { id: "detail_tweaker", name: "Detail Tweaker", category: "quality", description: "Fine detail control (+add / -smooth)", defaultStrength: 0.8 },
  { id: "epi_noiseoffset", name: "Dramatic Lighting", category: "lighting", description: "Deeper shadows and dramatic contrast", defaultStrength: 0.5 },
  { id: "clothing_adjuster", name: "Clothing Adjuster", category: "style", description: "Control clothing amount (+more / -less)", defaultStrength: 0.8 },
  { id: "polaroid_style", name: "Polaroid / Vintage", category: "style", description: "Vintage instant camera aesthetic", defaultStrength: 0.7 },
  { id: "ghibli_style", name: "Ghibli / Anime Art", category: "style", description: "Studio Ghibli-inspired art", defaultStrength: 0.7 },
  { id: "cute_girl_mix4", name: "Soft / Cute", category: "style", description: "Soft, cute aesthetic", defaultStrength: 0.7 },
  { id: "anime_lineart", name: "Anime Lineart", category: "style", description: "Manga / anime line-art style", defaultStrength: 0.8 },
  { id: "hipoly_3d", name: "3D Rendered / CGI", category: "style", description: "High-poly 3D rendered look", defaultStrength: 0.7 },
];

// Advanced Generation Types
export interface GenerationOptions {
  prompt: string;
  negativePrompt: string;
  seed: string;
  modelId: string;
  steps: number;
  cfg: number;
  sampler: string;
  width: number;
  height: number;
  count: number;
  hiresFix: boolean;
  hiresScale: number;
  hiresDenoise: number;
  hiresSteps: number;
  faceRestore: boolean;
  faceRestoreStrength: number;
  loras: LoraConfig[];
}

export const DEFAULT_OPTIONS: GenerationOptions = {
  prompt: "",
  negativePrompt: "",
  seed: "",
  modelId: "urpm-sd15",
  steps: 42,
  cfg: 6.8,
  sampler: "dpmpp_2m_karras",
  width: 512,
  height: 768,
  count: 1,
  hiresFix: true,
  hiresScale: 1.75,
  hiresDenoise: 0.4,
  hiresSteps: 28,
  faceRestore: true,
  faceRestoreStrength: 0.2,
  loras: [],
};

// Model Configuration — single SD 1.5 model on our GPU
export const AVAILABLE_MODELS = [
  {
    id: "urpm-sd15",
    name: "Realistic (SD 1.5)",
    premium: false,
    description: "uberRealisticPornMerge — photorealistic, optimized for portraits",
  },
];

export const AVAILABLE_SAMPLERS = [
  { id: "dpmpp_2m_karras", name: "DPM++ 2M Karras (recommended)", premium: false },
  { id: "dpmpp_sde_karras", name: "DPM++ SDE Karras", premium: false },
  { id: "euler_a", name: "Euler Ancestral", premium: false },
];

export const AVAILABLE_DIMENSIONS = [
  { width: 512, height: 768, label: "512x768 (Portrait)", premium: false },
  { width: 512, height: 512, label: "512x512 (Square)", premium: false },
  { width: 768, height: 512, label: "768x512 (Landscape)", premium: false },
  { width: 768, height: 768, label: "768x768 (Large Square)", premium: false },
];

// Feature Access Helpers — all features unlocked (no premium gating yet)
export const getAdvancedFeatureAccess = (
  _subscriptionStatus: SubscriptionStatus | undefined
) => {
  return {
    negativePrompts: { hasAccess: true, requiredPlan: "free" as const },
    advancedSettings: { hasAccess: true, requiredPlan: "free" as const },
    multipleImages: { hasAccess: true, requiredPlan: "free" as const },
    premiumModels: { hasAccess: true, requiredPlan: "free" as const },
    highResolution: { hasAccess: true, requiredPlan: "free" as const },
    upscaling: { hasAccess: true, requiredPlan: "free" as const },
    canGenerate: true,
  };
};

export const getMaxImageCount = (
  _subscriptionStatus: SubscriptionStatus | undefined
): number => {
  return 4; // GPU can handle up to 4 concurrent images
};

export const validateGenerationOptions = (
  options: GenerationOptions,
  _subscriptionStatus: SubscriptionStatus | undefined
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!options.prompt.trim()) {
    errors.push("Prompt is required");
  }

  if (options.steps < 10 || options.steps > 100) {
    errors.push("Steps must be between 10 and 100");
  }

  if (options.cfg < 1 || options.cfg > 20) {
    errors.push("CFG scale must be between 1 and 20");
  }

  if (options.count < 1 || options.count > 4) {
    errors.push("Image count must be between 1 and 4");
  }

  if (options.width > 1024 || options.height > 1024) {
    errors.push("Maximum dimension is 1024px");
  }

  return { isValid: errors.length === 0, errors };
};

export const calculateGenerationCost = (options: {
  count: number;
  steps: number;
}): number => {
  const baseCost = Number(process.env.NEXT_PUBLIC_NUTS_PER_IMAGE) || 10;
  // More steps cost slightly more
  const stepMultiplier = options.steps > 50 ? 1.5 : 1;
  return Math.ceil(baseCost * options.count * stepMultiplier);
};
