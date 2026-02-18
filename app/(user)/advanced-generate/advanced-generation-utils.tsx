import {
  canGenerateImages,
  checkFeatureAccess,
} from "../gallery/components/GenerationForm/subscription-utils";
import type { SubscriptionStatus } from "../gallery/components/GenerationForm/subscription-utils";
import { logger } from "@/lib/logger";

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
  loraModel: string;
  loraStrength: number;
  enhanceStyle: string;
  count: number;
  scheduler: string;
  clipSkip: number;
  upscale: boolean;
  upscaleStrength: number;
}

export const DEFAULT_OPTIONS: GenerationOptions = {
  prompt: "",
  negativePrompt: "",
  seed: "",
  modelId: "flux",
  steps: 30,
  cfg: 7.5,
  sampler: "DPM++ 2M Karras",
  width: 512,
  height: 512,
  loraModel: "none",
  loraStrength: 0.8,
  enhanceStyle: "none",
  count: 1,
  scheduler: "normal",
  clipSkip: 1,
  upscale: false,
  upscaleStrength: 1.5,
};

// Model Configuration
export const AVAILABLE_MODELS = [
  {
    id: "flux",
    name: "Flux",
    premium: false,
    description: "Fast and versatile model",
  },
  {
    id: "flux-pro",
    name: "Flux Pro",
    premium: true,
    description: "Enhanced quality and detail",
  },
  {
    id: "sdxl",
    name: "SDXL",
    premium: false,
    description: "Stable Diffusion XL",
  },
  {
    id: "nsfw-sdxl",
    name: "NSFW SDXL",
    premium: true,
    description: "Adult content model",
  },
  {
    id: "anime-xl",
    name: "Anime XL",
    premium: true,
    description: "Anime and manga style",
  },
];

export const AVAILABLE_SAMPLERS = [
  { id: "euler_a", name: "Euler a", premium: false },
  { id: "euler", name: "Euler", premium: false },
  { id: "dpm_2m_karras", name: "DPM++ 2M Karras", premium: false },
  { id: "dpm_sde_karras", name: "DPM++ SDE Karras", premium: true },
  { id: "unipc", name: "UniPC", premium: true },
  { id: "ddim", name: "DDIM", premium: true },
];

export const AVAILABLE_SCHEDULERS = [
  { id: "normal", name: "Normal", premium: false },
  { id: "karras", name: "Karras", premium: true },
  { id: "exponential", name: "Exponential", premium: true },
  { id: "sgm_uniform", name: "SGM Uniform", premium: true },
];

export const AVAILABLE_LORAS = [
  { id: "none", name: "None", premium: false },
  { id: "uncensored-flux", name: "Uncensored Flux", premium: true },
  { id: "nsfw-flux", name: "NSFW Flux", premium: true },
  { id: "realistic-vision", name: "Realistic Vision", premium: true },
  { id: "anime-style", name: "Anime Style", premium: true },
];

export const AVAILABLE_DIMENSIONS = [
  { width: 512, height: 512, label: "512×512 (1:1)", premium: false },
  { width: 768, height: 512, label: "768×512 (3:2)", premium: false },
  { width: 512, height: 768, label: "512×768 (2:3)", premium: false },
  { width: 1024, height: 1024, label: "1024×1024 (1:1)", premium: true },
  { width: 1536, height: 1024, label: "1536×1024 (3:2)", premium: true },
  { width: 1024, height: 1536, label: "1024×1536 (2:3)", premium: true },
  { width: 2048, height: 2048, label: "2048×2048 (4K)", premium: true },
];

// Feature Access Helpers
export const getAdvancedFeatureAccess = (
  subscriptionStatus: SubscriptionStatus | undefined
) => {
  logger.debug("Checking advanced feature access", { subscriptionStatus });

  if (!subscriptionStatus) {
    logger.warn("No subscription status provided");
    return {
      negativePrompts: { hasAccess: false, requiredPlan: "basic" as const },
      advancedSettings: { hasAccess: false, requiredPlan: "pro" as const },
      multipleImages: { hasAccess: false, requiredPlan: "basic" as const },
      premiumModels: { hasAccess: false, requiredPlan: "pro" as const },
      highResolution: { hasAccess: false, requiredPlan: "pro" as const },
      upscaling: { hasAccess: false, requiredPlan: "pro" as const },
      canGenerate: false,
    };
  }

  const access = {
    negativePrompts: checkFeatureAccess(subscriptionStatus, "negative_prompts"),
    advancedSettings: checkFeatureAccess(
      subscriptionStatus,
      "advanced_settings"
    ),
    multipleImages: checkFeatureAccess(subscriptionStatus, "multiple_images"),
    premiumModels: checkFeatureAccess(subscriptionStatus, "advanced_models"),
    highResolution: checkFeatureAccess(subscriptionStatus, "4k_resolution"),
    upscaling: checkFeatureAccess(subscriptionStatus, "4k_resolution"),
    canGenerate: canGenerateImages(subscriptionStatus, 1),
  };

  logger.debug("Feature access calculated", access);
  return access;
};

export const getMaxImageCount = (
  subscriptionStatus: SubscriptionStatus | undefined
): number => {
  if (!subscriptionStatus) {
    logger.debug("No subscription status, defaulting to 1 image");
    return 1;
  }

  const currentPlan = subscriptionStatus.plan;
  if (!currentPlan) {
    logger.debug("No current plan, defaulting to 1 image");
    return 1;
  }

  const maxCount = currentPlan.imagesPerGeneration || 1;
  logger.debug("Max image count determined", { maxCount, plan: currentPlan });
  return maxCount;
};

export const validateGenerationOptions = (
  options: GenerationOptions,
  subscriptionStatus: SubscriptionStatus | undefined
): { isValid: boolean; errors: string[] } => {
  logger.debug("Validating generation options", { options });

  const errors: string[] = [];
  const access = getAdvancedFeatureAccess(subscriptionStatus);

  // Check basic access
  if (!access.canGenerate) {
    errors.push("You don't have access to image generation");
    logger.warn("User lacks basic generation access");
  }

  // Check negative prompts
  if (options.negativePrompt && !access.negativePrompts.hasAccess) {
    errors.push("Negative prompts require a premium plan");
    logger.warn("Negative prompt access denied");
  }

  // Check advanced settings
  if (!access.advancedSettings.hasAccess) {
    if (options.steps !== DEFAULT_OPTIONS.steps) {
      errors.push("Custom steps require a premium plan");
    }
    if (options.cfg !== DEFAULT_OPTIONS.cfg) {
      errors.push("Custom CFG scale requires a premium plan");
    }
    if (options.sampler !== DEFAULT_OPTIONS.sampler) {
      errors.push("Advanced samplers require a premium plan");
    }
    if (options.scheduler !== DEFAULT_OPTIONS.scheduler) {
      errors.push("Advanced schedulers require a premium plan");
    }
    if (options.clipSkip !== DEFAULT_OPTIONS.clipSkip) {
      errors.push("Custom CLIP skip requires a premium plan");
    }
    if (options.loraModel !== DEFAULT_OPTIONS.loraModel) {
      errors.push("LoRA models require a premium plan");
    }
    if (options.enhanceStyle !== DEFAULT_OPTIONS.enhanceStyle) {
      errors.push("Style enhancement requires a premium plan");
    }
  }

  // Check image count
  const maxCount = getMaxImageCount(subscriptionStatus);
  if (options.count > maxCount) {
    errors.push(`Your plan allows up to ${maxCount} images per generation`);
    logger.warn("Image count exceeds limit", {
      requested: options.count,
      max: maxCount,
    });
  }

  // Check resolution
  const selectedDimension = AVAILABLE_DIMENSIONS.find(
    (d) => d.width === options.width && d.height === options.height
  );
  if (selectedDimension?.premium && !access.highResolution.hasAccess) {
    errors.push("High resolution requires a premium plan");
    logger.warn("High resolution access denied", {
      dimensions: selectedDimension,
    });
  }

  // Check premium models
  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === options.modelId);
  if (selectedModel?.premium && !access.premiumModels.hasAccess) {
    errors.push("Premium models require a premium plan");
    logger.warn("Premium model access denied", { model: selectedModel });
  }

  // Check upscaling
  if (options.upscale && !access.upscaling.hasAccess) {
    errors.push("Upscaling requires a premium plan");
    logger.warn("Upscaling access denied");
  }

  const result = {
    isValid: errors.length === 0,
    errors,
  };

  logger.debug("Validation completed", result);
  return result;
};

export const calculateGenerationCost = (options: {
  count: number;
  width: number;
  height: number;
  steps: number;
  upscale?: boolean;
  modelId?: string;
  loraModel?: string;
  loraStrength?: number;
  enhanceStyle?: string;
}): number => {
  logger.debug("Calculating generation cost", options);

  let baseCost = Number(process.env.NEXT_PUBLIC_NUTS_PER_IMAGE) || 10; // Base cost per image

  // Higher resolution costs more
  const pixelCount = options.width * options.height;
  if (pixelCount > 1024 * 1024) {
    baseCost *= 2;
    logger.debug("High resolution multiplier applied", { multiplier: 2 });
  } else if (pixelCount > 512 * 512) {
    baseCost *= 1.5;
    logger.debug("Medium resolution multiplier applied", { multiplier: 1.5 });
  }

  // More steps cost more
  if (options.steps > 50) {
    baseCost *= 1.5;
    logger.debug("High steps multiplier applied", {
      steps: options.steps,
      multiplier: 1.5,
    });
  }

  // Upscaling costs more
  if (options.upscale) {
    baseCost *= 2;
    logger.debug("Upscaling multiplier applied", { multiplier: 2 });
  }

  // LoRA models add cost
  if (options.loraModel && options.loraModel !== "none") {
    baseCost *= 1.2; // 20% increase for LoRA
    logger.debug("LoRA multiplier applied", {
      model: options.loraModel,
      multiplier: 1.2,
    });

    // Higher LoRA strength costs more
    if (options.loraStrength && options.loraStrength > 0.7) {
      baseCost *= 1.1;
      logger.debug("High LoRA strength multiplier applied", {
        strength: options.loraStrength,
        multiplier: 1.1,
      });
    }
  }

  // Style enhancement adds cost
  if (options.enhanceStyle && options.enhanceStyle !== "none") {
    baseCost *= 1.1; // 10% increase for style enhancement
    logger.debug("Style enhancement multiplier applied", {
      style: options.enhanceStyle,
      multiplier: 1.1,
    });
  }

  // Premium models cost more
  const model = AVAILABLE_MODELS.find((m) => m.id === options.modelId);
  if (model?.premium) {
    baseCost *= 1.5;
    logger.debug("Premium model multiplier applied", {
      model: model.name,
      multiplier: 1.5,
    });
  }

  const totalCost = Math.ceil(baseCost * options.count);
  logger.debug("Cost calculation completed", {
    baseCost,
    totalCost,
    count: options.count,
  });

  return totalCost;
};
