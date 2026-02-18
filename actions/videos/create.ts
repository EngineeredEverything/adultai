"use server"

import { db } from "@/lib/db"
import { currentUser, type User } from "@/utils/auth"
import type { z } from "zod"
import { logger } from "@/lib/logger"
import { getVideoProvider } from "./provider"
import { analyzePromptForCategory } from "@/lib/category-analyzer"
import { createGeneratedVideoSchema, createGeneratedVideosBatchSchema } from "@/schemas/videos"
import { getUserActivePlan } from "@/actions/subscriptions/info"
import { checkAndUpdateUsage } from "../usage/update"

const provider = getVideoProvider("CUSTOM")
type VideoModelConfig = typeof provider.types.VideoModelConfig

const NEXT_PUBLIC_NUTS_PER_VIDEO = Number(process.env.NEXT_PUBLIC_NUTS_PER_VIDEO) || 100
const WEBHOOK_URL = process.env.APP_URL + "/api/webhooks/video-generation"

export const createGeneratedVideosRAW = async (user: User, data: z.infer<typeof createGeneratedVideoSchema>) => {
  logger.info("Creating generated videos", {
    userId: user.id,
    userRole: user.role,
    prompt: data.prompt.substring(0, 100) + "...",
    count: data.count,
  })

  if (user.role === "BOT") {
    logger.info("Bot user detected, skipping limits", { userId: user.id })

    const seeds = Array.from({ length: data.count }, () => Math.floor(Math.random() * 1000000))

    const videoConfig = provider.VIDEO_CONFIGS.default
    const response = await initiateVideoGeneration({
      prompt: data.prompt,
      seeds,
      count: data.count,
      videoConfig,
      width: data.width || 848,
      height: data.height || 480,
      fps: data.fps || 24,
      numFrames: data.numFrames || 81,
      negativePrompt: data.negativePrompt,
      userId: user.id,
    })

    const pendingVideos = await createPendingVideos(
      user.id,
      data.prompt,
      seeds,
      response.taskId,
      videoConfig,
      0,
      data.width || 848,
      data.height || 480,
      data.fps || 24,
      data.numFrames || 81,
      data.negativePrompt,
      response.futureLinks || [],
    )

    logger.info("Bot video generation initiated", {
      userId: user.id,
      taskId: response.taskId,
      videoCount: pendingVideos.length,
    })

    return {
      videos: pendingVideos,
      status: "processing",
      taskId: response.taskId,
      eta: response.eta,
      nutsUsed: 0,
      remainingNuts: "unlimited",
    }
  }

  const { plan } = await getUserActivePlan(user.id)
  if (!plan) {
    logger.error("No plan found for user", { userId: user.id })
    throw new Error("No plan found for user")
  }

  const totalCost = data.count * NEXT_PUBLIC_NUTS_PER_VIDEO
  logger.debug("Calculated generation cost", { userId: user.id, totalCost, nutsPerVideo: NEXT_PUBLIC_NUTS_PER_VIDEO })

  await checkAndUpdateUsage(user.id, data.count, totalCost)

  const seeds = Array.from({ length: data.count }, () => Math.floor(Math.random() * 1000000))

  const videoConfig = provider.VIDEO_CONFIGS.default
  const response = await initiateVideoGeneration({
    prompt: data.prompt,
    seeds,
    count: data.count,
    videoConfig,
    width: data.width || 848,
    height: data.height || 480,
    fps: data.fps || 24,
    numFrames: data.numFrames || 81,
    negativePrompt: data.negativePrompt,
    userId: user.id,
  })

  const pendingVideos = await createPendingVideos(
    user.id,
    data.prompt,
    seeds,
    response.taskId,
    videoConfig,
    totalCost,
    data.width || 848,
    data.height || 480,
    data.fps || 24,
    data.numFrames || 81,
    data.negativePrompt,
    response.futureLinks || [],
  )

  logger.info("Video generation initiated successfully", {
    userId: user.id,
    taskId: response.taskId,
    videoCount: pendingVideos.length,
    totalCost,
  })

  return {
    videos: pendingVideos,
    status: "processing",
    taskId: response.taskId,
    eta: response.eta,
    nutsUsed: totalCost,
  }
}

export async function initiateVideoGeneration({
  prompt,
  seeds,
  count,
  videoConfig,
  width,
  height,
  fps,
  numFrames,
  negativePrompt,
  userId,
}: {
  prompt: string
  seeds: number[]
  count: number
  videoConfig: VideoModelConfig
  width: number
  height: number
  fps: number
  numFrames: number
  negativePrompt?: string
  userId: string
}): Promise<{
  taskId: string
  eta?: number
  futureLinks?: string[]
}> {
  const seed = seeds[0]

  logger.debug("Initiating video generation with provider", {
    userId,
    prompt: prompt.substring(0, 50) + "...",
    seed,
    count,
    dimensions: `${width}x${height}`,
    fps,
    numFrames,
  })

  try {
    const response = await provider.fetchWithRetry(provider.VIDEO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        seed,
        height,
        width,
        fps,
        num_frames: numFrames,
        num_inference_steps: videoConfig.num_inference_steps,
        guidance_scale: videoConfig.guidance_scale,
        negative_prompt: negativePrompt || "blurry, low quality, distorted",
      }),
    })

    const data: any = await response.json()
    logger.debug("Provider response received", {
      userId,
      status: data.status,
      taskId: data.id,
      eta: data.eta,
    })

    if (data.status === "error") {
      logger.error("Provider returned error", {
        userId,
        error: data.message,
        responseStatus: response.status,
      })
      throw new provider.VideoGenerationError(data.message || "Failed to generate video", response.status, false)
    }

    if (!data.id) {
      logger.error("No task ID returned from provider", { userId, responseStatus: response.status })
      throw new provider.VideoGenerationError("No task ID returned from API", response.status, false)
    }

    return {
      taskId: data.id.toString(),
      eta: data.eta,
      futureLinks: data.future_links,
    }
  } catch (error: any) {
    logger.error("Error initiating video generation", {
      userId,
      error: error.message,
      stack: error.stack,
    })
    throw error
  }
}

export async function createPendingVideos(
  userId: string,
  prompt: string,
  seeds: number[],
  taskId: string,
  videoConfig: VideoModelConfig,
  totalCost: number,
  width: number,
  height: number,
  fps: number,
  numFrames: number,
  negativePrompt: string | undefined,
  futureLinks: string[],
) {
  logger.debug("Creating pending video records", {
    userId,
    taskId,
    videoCount: seeds.length,
    totalCost,
  })

  const categories = await db.category.findMany()
  logger.debug("Fetched categories for analysis", { categoryCount: categories.length })

  const categoryName = analyzePromptForCategory(prompt, categories)
  logger.debug("Prompt category analysis result", { categoryName })

  let categoryId: string | null = null
  if (categoryName) {
    const category = categories.find((c) => c.name === categoryName)
    if (category) {
      categoryId = category.id
      logger.debug("Category matched", { categoryId, categoryName })
    }
  }

  try {
    const createOperations = seeds.map((seed, index) =>
      db.generatedVideo.create({
        data: {
          userId,
          prompt,
          negativePrompt,
          seed,
          steps: videoConfig.num_inference_steps,
          cfg: videoConfig.guidance_scale,
          fps,
          numFrames,
          costNuts: NEXT_PUBLIC_NUTS_PER_VIDEO,
          status: "processing",
          taskId,
          eta: null,
          width,
          height,
          futureLinks: futureLinks.length > index ? [futureLinks[index]] : [],
          videoUrl: null,
          path: null,
          ...(categoryId
            ? {
                categories: {
                  connect: {
                    id: categoryId,
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
          prompt: true,
          seed: true,
          status: true,
          taskId: true,
          futureLinks: true,
        },
      }),
    )

    const result = await db.$transaction(createOperations)

    logger.info("Pending videos created successfully", {
      userId,
      taskId,
      videoCount: result.length,
      categoryId,
    })

    return result
  } catch (error: any) {
    logger.error("Error creating pending videos", {
      userId,
      taskId,
      error: error.message,
      stack: error.stack,
    })
    throw error
  }
}

export const createGeneratedVideo = async (data: z.infer<typeof createGeneratedVideoSchema>) => {
  const user = await currentUser()
  if (!user) {
    logger.warn("Video generation attempted without authentication")
    return { error: "Not authenticated" }
  }

  const validatedFields = createGeneratedVideoSchema.safeParse(data)
  if (!validatedFields.success) {
    logger.warn("Invalid video generation data", {
      userId: user.id,
      errors: validatedFields.error.issues,
    })
    return {
      error: validatedFields.error.issues.map((err) => `${err.path.join(".")}:${err.message}`).join(", "),
    }
  }

  try {
    return await createGeneratedVideosRAW(user, validatedFields.data)
  } catch (error: any) {
    logger.error("Error in createGeneratedVideo", {
      userId: user.id,
      error: error.message,
      stack: error.stack,
    })
    return { error: error.message }
  }
}

export const createGeneratedVideosBatch = async (data: z.infer<typeof createGeneratedVideosBatchSchema>) => {
  const user = await currentUser()
  if (!user) {
    logger.warn("Batch video generation attempted without authentication")
    return { error: "Not authenticated" }
  }

  const validatedFields = createGeneratedVideosBatchSchema.safeParse(data)
  if (!validatedFields.success) {
    logger.warn("Invalid batch video generation data", {
      userId: user.id,
      errors: validatedFields.error.issues,
    })
    return {
      error: validatedFields.error.issues.map((err) => `${err.path.join(".")}:${err.message}`).join(", "),
    }
  }

  logger.info("Processing batch video generation", {
    userId: user.id,
    batchSize: validatedFields.data.videos.length,
  })

  try {
    const results = await Promise.all(
      validatedFields.data.videos.map(async (videoData) => {
        return await createGeneratedVideosRAW(user, videoData)
      }),
    )

    logger.info("Batch video generation completed", {
      userId: user.id,
      totalVideos: results.flatMap((r) => r.videos).length,
    })

    return { videos: results.flatMap((r) => r.videos) }
  } catch (error: any) {
    logger.error("Error in createGeneratedVideosBatch", {
      userId: user.id,
      error: error.message,
      stack: error.stack,
    })
    return { error: error.message }
  }
}

export const createSingleGeneratedVideo = async (prompt: string) => {
  logger.info("Creating single generated video", { prompt: prompt.substring(0, 50) + "..." })

  return await createGeneratedVideo({
    prompt,
    count: 1,
    width: 848,
    height: 480,
    fps: 24,
    numFrames: 81,
    isPublic: true,
  })
}
