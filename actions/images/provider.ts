// src/lib/imageProvider.ts

import * as MODELSLAB_CONFIG from "@/lib/modelsLab/config";
import * as MODELSLAB_GENERATION from "@/lib/modelsLab/image-generation";

import * as CUSTOM_CONFIG from "@/lib/custom/config";
import * as CUSTOM_GENERATION from "@/lib/custom/image-generation";

// Define each provider’s shape
interface ModelsLabProvider {
  apiKey: typeof MODELSLAB_CONFIG.apiKey;
  MODEL_CONFIGS: typeof MODELSLAB_CONFIG.MODEL_CONFIGS;
  API_URL: typeof MODELSLAB_CONFIG.API_URL;
  fetchWithRetry: typeof MODELSLAB_GENERATION.fetchWithRetry;
  generateImages: typeof MODELSLAB_GENERATION.generateImages;
  ImageGenerationError: typeof MODELSLAB_GENERATION.ImageGenerationError;
  types: typeof modelsLabTypes;
  fetchUrl: string;
  uploadToCDNWithRetry: typeof MODELSLAB_GENERATION.uploadToCDNWithRetry
}

interface CustomProvider {
  apiKey: typeof CUSTOM_CONFIG.apiKey;
  MODEL_CONFIGS: typeof CUSTOM_CONFIG.MODEL_CONFIGS;
  API_URL: typeof CUSTOM_CONFIG.API_URL;
  fetchWithRetry: typeof CUSTOM_GENERATION.fetchWithRetry;
  generateImages: typeof CUSTOM_GENERATION.generateImages;
  ImageGenerationError: typeof CUSTOM_GENERATION.ImageGenerationError;
  types: typeof customTypes;
  fetchUrl: string;
  uploadToCDNWithRetry: typeof CUSTOM_GENERATION.uploadBase64ImageToCDN
}

// Union of providers
type ImageProvider = ModelsLabProvider | CustomProvider;

// Factory
export function getImageProvider(provider: "MODELSLAB"): ModelsLabProvider;
export function getImageProvider(provider: "CUSTOM"): CustomProvider;
export function getImageProvider(
  provider: "MODELSLAB" | "CUSTOM"
): ImageProvider {
  switch (provider) {
    case "MODELSLAB":
      return {
        apiKey: MODELSLAB_CONFIG.apiKey,
        MODEL_CONFIGS: MODELSLAB_CONFIG.MODEL_CONFIGS,
        API_URL: MODELSLAB_CONFIG.API_URL,
        fetchWithRetry: MODELSLAB_GENERATION.fetchWithRetry,
        generateImages: MODELSLAB_GENERATION.generateImages,
        ImageGenerationError: MODELSLAB_GENERATION.ImageGenerationError,
        types: modelsLabTypes,
        fetchUrl: `https://modelslab.com/api/v6/images/fetch/`,
        uploadToCDNWithRetry: MODELSLAB_GENERATION.uploadToCDNWithRetry
      };
    case "CUSTOM":
      return {
        apiKey: CUSTOM_CONFIG.apiKey,
        MODEL_CONFIGS: CUSTOM_CONFIG.MODEL_CONFIGS,
        API_URL: CUSTOM_CONFIG.API_URL,
        fetchWithRetry: CUSTOM_GENERATION.fetchWithRetry,
        generateImages: CUSTOM_GENERATION.generateImages,
        ImageGenerationError: CUSTOM_GENERATION.ImageGenerationError,
        types: customTypes,
        fetchUrl: `${CUSTOM_CONFIG.BASE_URL}/fetch/`,
        uploadToCDNWithRetry: CUSTOM_GENERATION.uploadBase64ImageToCDN
      };
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export const modelsLabTypes = {
  ImageResult: null as unknown as import("@/lib/modelsLab/types").ImageResult,
  ModelConfig: null as unknown as import("@/lib/modelsLab/types").ModelConfig,
  ModelslabResponse:
    null as unknown as import("@/lib/modelsLab/types").ModelslabResponse,
};

export const customTypes = {
  ImageResult: null as unknown as import("@/lib/custom/types").ImageResult,
  ModelConfig: null as unknown as import("@/lib/custom/types").ModelConfig,
};
