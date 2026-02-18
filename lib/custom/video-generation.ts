import type { VideoResult, GenerateVideosParams, VideoModelConfig, VideoGenerationResponse } from "./types"
import { VIDEO_API_URL } from "./config"
import { uploadBase64ToCdn } from "../cdn"
import { v4 as uuidv4 } from "uuid"
import { logger } from "@/lib/logger"

const DEBUG = true

const logDebug = (...args: any[]) => {
  if (DEBUG) logger.info("[VIDEO DEBUG]", ...args)
}

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 2000,
  maxDelay: 10000,
  backoffFactor: 1.5,
} as const

export class VideoGenerationError extends Error {
  constructor(
    message: string,
    public status = 500,
    public isRetryable = false,
  ) {
    super(message)
    this.name = "VideoGenerationError"
  }
}

async function exponentialBackoffDelay(attempt: number): Promise<void> {
  const delay = Math.min(RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt), RETRY_CONFIG.maxDelay)
  logDebug(`Delaying for ${delay}ms`)
  await new Promise((resolve) => setTimeout(resolve, delay))
}

export async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      logDebug(`Fetching ${url}, attempt ${i + 1}/${retries}`)
      const response = await fetch(url, options)
      if (response.ok) return response

      const error = await response.json().catch(() => ({}))
      logDebug(`HTTP error ${response.status}:`, error)

      if (response.status < 500 && response.status !== 429) {
        throw new VideoGenerationError(error.message || `HTTP error ${response.status}`, response.status, false)
      }
      lastError = new VideoGenerationError(error.message || `HTTP error ${response.status}`, response.status, true)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      logDebug("Fetch error:", lastError)
    }

    if (i < retries - 1) {
      await exponentialBackoffDelay(i)
    }
  }

  throw lastError || new Error("Request failed")
}

function generateRandomFilename(extension = "mp4"): string {
  const uuid = uuidv4()
  return `${uuid}.${extension.replace(/^\./, "")}`
}

export async function uploadBase64VideoToCDN(
  base64Video: string,
  retries = 3,
): Promise<{ path: string; cdnUrl: string }> {
  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      const filename = generateRandomFilename("mp4")
      const targetPath = `videos/${filename}`

      logDebug(`Uploading base64 video to CDN`)
      const cdnUrl = await uploadBase64ToCdn(base64Video, targetPath)
      return { path: targetPath, cdnUrl }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      logDebug("Upload error:", lastError)
      if (i < retries - 1) {
        await exponentialBackoffDelay(i)
      }
    }
  }

  throw new VideoGenerationError(lastError?.message || "Failed to upload to CDN after retries", 500, false)
}

export async function uploadVideoUrlToCDN(videoUrl: string, retries = 3): Promise<{ path: string; cdnUrl: string }> {
  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      logDebug(`Downloading video from URL: ${videoUrl}`)

      const response = await fetch(videoUrl)
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const base64Video = Buffer.from(arrayBuffer).toString("base64")

      const filename = generateRandomFilename("mp4")
      const targetPath = `videos/${filename}`

      logDebug(`Uploading video to CDN`)
      const cdnUrl = await uploadBase64ToCdn(base64Video, targetPath)
      return { path: targetPath, cdnUrl }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      logDebug("Upload error:", lastError)
      if (i < retries - 1) {
        await exponentialBackoffDelay(i)
      }
    }
  }

  throw new VideoGenerationError(lastError?.message || "Failed to upload video to CDN after retries", 500, false)
}

export async function generateSingleVideo(
  prompt: string,
  seed: number,
  videoConfig: VideoModelConfig,
  width: number,
  height: number,
  fps: number,
  numFrames: number,
  negativePrompt?: string,
): Promise<VideoResult> {
  logDebug("Generating video with prompt:", prompt, "seed:", seed)

  const requestBody = {
    prompt,
    seed,
    height,
    width,
    fps,
    num_frames: numFrames,
    num_inference_steps: videoConfig.num_inference_steps,
    guidance_scale: videoConfig.guidance_scale,
    negative_prompt: negativePrompt || "blurry, low quality, distorted",
  }

  logDebug("Request body:", requestBody)

  const response = await fetchWithRetry(VIDEO_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  })

  const data: VideoGenerationResponse = await response.json()
  logDebug("Generation response received", data)

  if (!data.video && !data.id) {
    throw new VideoGenerationError(data.message || "No video data or task ID returned", response.status, false)
  }

  // If video is immediately available (base64)
  if (data.video) {
    const { path, cdnUrl } = await uploadBase64VideoToCDN(data.video)

    return {
      videoBase64: data.video,
      cdnUrl,
      prompt,
      seed,
      steps: videoConfig.num_inference_steps,
      cfg: videoConfig.guidance_scale,
      path,
      fps,
      numFrames,
      width,
      height,
    }
  }

  // If task-based generation, return task info
  throw new VideoGenerationError("Task-based video generation not yet implemented in this function", 500, false)
}

export async function generateVideos({
  prompt,
  seeds,
  count = 1,
  videoConfig,
  width = 848,
  height = 480,
  fps = 24,
  numFrames = 81,
  negativePrompt,
}: GenerateVideosParams): Promise<VideoResult[]> {
  if (!prompt) {
    throw new VideoGenerationError("Prompt is required", 400, false)
  }

  logDebug(`Generating ${count} videos with prompt: ${prompt}`)

  const effectiveSeeds =
    seeds.length >= count
      ? seeds.slice(0, count)
      : [
          ...seeds,
          ...Array(count - seeds.length)
            .fill(0)
            .map(() => Math.floor(Math.random() * 2147483647)),
        ]

  const results: VideoResult[] = []
  const errors: Error[] = []

  const promises = effectiveSeeds.map((seed, index) =>
    generateSingleVideo(
      prompt,
      seed,
      videoConfig || {
        num_inference_steps: 50,
        guidance_scale: 7.5,
        fps,
        height,
        num_frames: numFrames,
        prompt,
        seed,
        width,
        negative_prompt: negativePrompt,
      },
      width,
      height,
      fps,
      numFrames,
      negativePrompt,
    )
      .then((result) => {
        results.push(result)
        return result
      })
      .catch((error) => {
        logDebug(`Error generating video ${index + 1}:`, error)
        errors.push(error instanceof Error ? error : new Error(String(error)))
        return null
      }),
  )

  await Promise.all(promises)

  if (results.length === 0 && errors.length > 0) {
    throw new VideoGenerationError("All video generation attempts failed", 500, false)
  }

  return results
}
