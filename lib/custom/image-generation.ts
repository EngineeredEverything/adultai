import {
  ImageResult,
  GenerateImagesParams,
  ModelConfig,
  ModelslabResponse,
} from "./types";
import { API_URL, MODEL_CONFIGS } from "./config";
import { uploadBase64ToCdn } from "../cdn";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";

const DEBUG = true; // Set to false to disable debugging

const logDebug = (...args: any[]) => {
  if (DEBUG) logger.info("[DEBUG]", ...args);
};

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 2000,
  maxDelay: 10000,
  backoffFactor: 1.5,
} as const;

export class ImageGenerationError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

async function exponentialBackoffDelay(attempt: number): Promise<void> {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt),
    RETRY_CONFIG.maxDelay
  );
  logDebug(`Delaying for ${delay}ms`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      logDebug(`Fetching ${url}, attempt ${i + 1}/${retries}`);
      const response = await fetch(url, options);
      if (response.ok) return response;

      const error = await response.json().catch(() => ({}));
      logDebug(`HTTP error ${response.status}:`, error);

      if (response.status < 500 && response.status !== 429) {
        throw new ImageGenerationError(
          error.message || `HTTP error ${response.status}`,
          response.status,
          false
        );
      }
      lastError = new ImageGenerationError(
        error.message || `HTTP error ${response.status}`,
        response.status,
        true
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logDebug("Fetch error:", lastError);
    }

    if (i < retries - 1) {
      await exponentialBackoffDelay(i);
    }
  }

  throw lastError || new Error("Request failed");
}

/**
 * Generates a random filename with the specified extension
 */
function generateRandomFilename(extension: string = "png"): string {
  const uuid = uuidv4();
  return `${uuid}.${extension.replace(/^\./, '')}`;
}

export async function uploadBase64ImageToCDN(
  base64Image: string,
  retries = 3
): Promise<{ path: string; cdnUrl: string }> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      // Generate a random filename
      const filename = generateRandomFilename();
      const targetPath = `images/${filename}`; // Put files in an 'images' folder

      logDebug(`Uploading base64 image to CDN`);
      const cdnUrl = await uploadBase64ToCdn(base64Image, targetPath);
      return { path: targetPath, cdnUrl };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logDebug("Upload error:", lastError);
      if (i < retries - 1) {
        await exponentialBackoffDelay(i);
      }
    }
  }

  throw new ImageGenerationError(
    lastError?.message || "Failed to upload to CDN after retries",
    500,
    false
  );
}

export async function generateSingleImage(
  prompt: string,
  seed: number,
  modelConfig: ModelConfig,
  width: number,
  height: number
): Promise<ImageResult> {
  logDebug("Generating image with prompt:", prompt, "seed:", seed);

  const requestBody = {
    prompt,
    seed,
    height,
    width,
    ...modelConfig,
  };

  logDebug("Request body:", requestBody);
  
  const response = await fetchWithRetry(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();
  logDebug("Generation response received");

  if (!data.image) {
    throw new ImageGenerationError(
      data.message || "No image data returned",
      response.status,
      false
    );
  }

  const { path, cdnUrl } = await uploadBase64ImageToCDN(data.image);

  return {
    imageBase64: data.image,
    cdnUrl,
    prompt,
    seed,
    modelId: modelConfig.lora_model || "sdxl",
    steps: modelConfig.num_inference_steps,
    cfg: modelConfig.guidance_scale,
    sampler: "DPM++ 2M Karras", // Default sampler
    path,
  };
}

export async function generateImages({
  prompt,
  seeds,
  count = 4,
  modelConfig = MODEL_CONFIGS.sdxl,
  width = 1024,
  height = 1024,
}: GenerateImagesParams): Promise<ImageResult[]> {
  if (!prompt) {
    throw new ImageGenerationError("Prompt is required", 400, false);
  }

  logDebug(`Generating ${count} images with prompt: ${prompt}`);

  // Ensure we have enough seeds
  const effectiveSeeds = seeds.length >= count 
    ? seeds.slice(0, count) 
    : [...seeds, ...Array(count - seeds.length).fill(0).map(() => Math.floor(Math.random() * 2147483647))];

  // Generate images in parallel
  const results: ImageResult[] = [];
  const errors: Error[] = [];
  
  const promises = effectiveSeeds.map((seed, index) => 
    generateSingleImage(prompt, seed, modelConfig, width, height)
      .then(result => {
        results.push(result);
        return result;
      })
      .catch(error => {
        logDebug(`Error generating image ${index + 1}:`, error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
        return null;
      })
  );
  
  await Promise.all(promises);

  if (results.length === 0 && errors.length > 0) {
    throw new ImageGenerationError(
      "All image generation attempts failed",
      500,
      false
    );
  }

  return results;
}
