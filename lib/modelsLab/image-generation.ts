import {
  ImageResult,
  GenerateImagesParams,
  ModelConfig,
  ModelslabResponse,
  PollResult,
} from "./types";
import { API_URL, MODEL_CONFIGS, apiKey } from "./config";
import { downloadAndUpload } from "../cdn";
// import { cdnFileType } from "clodynix";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";

const DEBUG = true; // Set to false to disable debugging

const logDebug = (...args: any[]) => {
  if (DEBUG) logger.info("[DEBUG]", ...args);
};

const POLL_CONFIG = {
  maxAttempts: 30,
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
    POLL_CONFIG.baseDelay * Math.pow(POLL_CONFIG.backoffFactor, attempt),
    POLL_CONFIG.maxDelay
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

async function pollForCompletion(taskId: number): Promise<ModelslabResponse> {
  let attempts = 0;

  while (attempts < POLL_CONFIG.maxAttempts) {
    try {
      logDebug(`Polling for task ID ${taskId}, attempt ${attempts + 1}`);
      await exponentialBackoffDelay(attempts);

      const pollResponse = await fetchWithRetry(
        `https://modelslab.com/api/v6/realtime/fetch/${taskId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: apiKey }),
        }
      );

      const pollResult: PollResult = await pollResponse.json();
      logDebug("Poll result:", pollResult);

      switch (pollResult.status) {
        case "success":
          if (pollResult.output?.[0]) {
            return pollResult;
          }
          throw new ImageGenerationError(
            "Success status but no output found",
            500,
            true
          );

        case "processing":
          attempts++;
          continue;

        case "failed":
        case "error":
          throw new ImageGenerationError(
            pollResult.messege || "Image generation failed",
            500,
            true
          );

        default:
          throw new ImageGenerationError(
            `Unknown status: ${pollResult.status}`,
            500,
            true
          );
      }
    } catch (error) {
      if (error instanceof ImageGenerationError && !error.isRetryable) {
        throw error;
      }
      attempts++;
      logDebug(`Poll attempt ${attempts} failed:`, error);

      if (attempts === POLL_CONFIG.maxAttempts) {
        throw new ImageGenerationError(
          "Maximum polling attempts exceeded",
          408,
          false
        );
      }
    }
  }

  throw new ImageGenerationError("Polling timeout exceeded", 408, false);
}
/**
 * Generates a random filename with the correct extension from the original URL
 */
function generateRandomFilename(imageUrl: string): string {
  try {
    // Get the file extension from the original URL
    const urlObj = new URL(imageUrl);
    const originalPath = urlObj.pathname;
    const extension = path.extname(originalPath) || ".jpg"; // Default to .jpg if no extension

    // Generate UUID and append extension
    const uuid = uuidv4();
    return `${uuid}${extension}`;
  } catch (error) {
    // If URL parsing fails, use default extension
    const uuid = uuidv4();
    return `${uuid}.jpg`;
  }
}

export async function uploadToCDNWithRetry(
  imageUrl: string,
  retries = 3,
  // id: number | undefined
): Promise<{ path: string; cdnUrl: string }> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      // Generate a random filename with proper extension
      const filename = generateRandomFilename(imageUrl);
      const targetPath = `images/${filename}`; // Put files in an 'images' folder

      logDebug(`Uploading image to CDN: ${imageUrl}`);
      const cdnUrl = await downloadAndUpload(imageUrl, targetPath);
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

  const response = await fetchWithRetry(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      seed,
      height,
      width,
      key: apiKey,
      ...modelConfig,
    }),
  });

  let data: ModelslabResponse = await response.json();
  logDebug("Generation response:", data);

  if (data.status === "error") {
    throw new ImageGenerationError(
      data.messege || "Failed to generate image",
      response.status,
      false
    );
  }

  if (data.status === "processing" && data.id) {
    logDebug(`Processing task ID: ${data.id}`);
    data = await pollForCompletion(data.id);
  }

  const { path, cdnUrl } = await uploadToCDNWithRetry(
    data.output[0],
    3,
    // data.id
  );

  return {
    imageUrl: data.output[0],
    cdnUrl,
    prompt,
    seed,
    modelId: modelConfig.model_id,
    steps: modelConfig.num_inference_steps,
    cfg: modelConfig.guidance_scale,
    sampler: "DPM++ 2M Karras",
    path,
  };
}

export async function generateBatchImage(
  prompt: string,
  seed: number,
  count: number,
  modelConfig: ModelConfig,
  width: number,
  height: number
): Promise<ImageResult[]> {
  logDebug("Generating image with prompt:", prompt, "seed:", seed);

  const response = await fetchWithRetry(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      seed,
      height,
      width,
      key: apiKey,
      samples: count,
      ...modelConfig,
    }),
  });

  let data: ModelslabResponse = await response.json();
  logDebug("Generation response:", data.output.length);

  if (data.status === "error") {
    throw new ImageGenerationError(
      data.messege || "Failed to generate image",
      response.status,
      false
    );
  }

  if (data.status === "processing" && data.id) {
    logDebug(`Processing task ID: ${data.id}`);
    data = await pollForCompletion(data.id);
  }
  const results = await Promise.all(
    data.output.map(async (imageOutput, index) => {
      const { path, cdnUrl } = await uploadToCDNWithRetry(
        imageOutput,
        3,
        // data.id
      );

      return {
        imageUrl: imageOutput,
        cdnUrl,
        prompt,
        seed,
        modelId: modelConfig.model_id,
        steps: modelConfig.num_inference_steps,
        cfg: modelConfig.guidance_scale,
        sampler: "DPM++ 2M Karras",
        path,
      };
    })
  );
  return results;
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

  const MAX_BATCH_SIZE = 4; // Maximum samples allowed by the API
  logDebug(`Generating ${count} images with prompt: ${prompt}`);

  const results: ImageResult[] = [];
  const errors: Error[] = [];

  // Calculate how many full batches we can run
  const fullBatchCount = Math.floor(count / MAX_BATCH_SIZE);
  const remainingImages = count % MAX_BATCH_SIZE;
  
  // Process full batches first (4 images at a time)
  for (let i = 0; i < fullBatchCount; i++) {
    const batchSeeds = seeds.slice(i * MAX_BATCH_SIZE, (i + 1) * MAX_BATCH_SIZE);
    const batchSeed = batchSeeds[0]; // Use the first seed for the batch
    
    try {
      logDebug(`Processing batch ${i + 1}/${fullBatchCount} with seed ${batchSeed}`);
      const batchResults = await generateBatchImage(
        prompt, 
        batchSeed, 
        MAX_BATCH_SIZE, 
        modelConfig, 
        width, 
        height
      );
      
      results.push(...batchResults);
    } catch (error) {
      logDebug(`Error generating batch ${i + 1}:`, error);
      errors.push(error as Error);
      
      // If batch fails, fall back to individual generation for this batch
      const fallbackPromises = batchSeeds.map((seed, index) => 
        generateSingleImage(prompt, seed, modelConfig, width, height)
          .then(result => {
            results.push(result);
            return result;
          })
          .catch(fallbackError => {
            logDebug(`Fallback error for image ${i * MAX_BATCH_SIZE + index + 1}:`, fallbackError);
            errors.push(fallbackError as Error);
            return null;
          })
      );
      
      await Promise.all(fallbackPromises);
    }
  }

  // Process remaining images (less than MAX_BATCH_SIZE)
  if (remainingImages > 0) {
    const remainingSeeds = seeds.slice(fullBatchCount * MAX_BATCH_SIZE);
    
    if (remainingImages > 1) {
      // Use batch processing for remaining images if more than 1
      try {
        logDebug(`Processing final batch with ${remainingImages} images`);
        const batchResults = await generateBatchImage(
          prompt, 
          remainingSeeds[0], 
          remainingImages, 
          modelConfig, 
          width, 
          height
        );
        
        results.push(...batchResults);
      } catch (error) {
        logDebug(`Error generating final batch:`, error);
        errors.push(error as Error);
        
        // Fall back to individual generation
        const fallbackPromises = remainingSeeds.map((seed, index) => 
          generateSingleImage(prompt, seed, modelConfig, width, height)
            .then(result => {
              results.push(result);
              return result;
            })
            .catch(fallbackError => {
              logDebug(`Fallback error for image ${fullBatchCount * MAX_BATCH_SIZE + index + 1}:`, fallbackError);
              errors.push(fallbackError as Error);
              return null;
            })
        );
        
        await Promise.all(fallbackPromises);
      }
    } else {
      // Just use single image generation for one remaining image
      try {
        const result = await generateSingleImage(
          prompt, 
          remainingSeeds[0], 
          modelConfig, 
          width, 
          height
        );
        
        results.push(result);
      } catch (error) {
        logDebug(`Error generating final image:`, error);
        errors.push(error as Error);
      }
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new ImageGenerationError(
      "All image generation attempts failed",
      500,
      false
    );
  }

  return results;
}