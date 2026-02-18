"use server"

import { db } from "@/lib/db"
import { currentUser, type User } from "@/utils/auth"
import { z } from "zod"
import { getImagesInfoRAW } from "./info"
import { logger } from "@/lib/logger"
import { getImageProvider } from "./provider"
import type { ModelslabResponse } from "@/lib/modelsLab/types"
import { analyzePromptForCategory } from "@/lib/category-analyzer"
import { calculateGenerationCost } from "@/app/(user)/advanced-generate/advanced-generation-utils"
import {
  createGeneratedImageSchema,
  createGeneratedImagesBatchSchema,
  advancedGenerationSchema,
} from "@/schemas/images"
import { getUserActivePlan } from "@/actions/subscriptions/info"
import { checkAndUpdateUsage } from "../usage/update"
import { getOrCreateUsageRecord } from "../usage/info"
import { checkGenerationLimit, recordGeneration } from "@/lib/rate-limit"
import { headers } from "next/headers"

const provider = getImageProvider("CUSTOM")
type ModelConfig = typeof provider.types.ModelConfig

// Constants
const NEXT_PUBLIC_NUTS_PER_IMAGE = Number(process.env.NEXT_PUBLIC_NUTS_PER_IMAGE) || 10
const WEBHOOK_URL = process.env.APP_URL + "/api/webhooks/image-generation"


// RAW Functions
export const createGeneratedImagesRAW = async (user: User, data: z.infer<typeof createGeneratedImageSchema>) => {
  logger.info("Creating generated images", {
    userId: user.id,
    userRole: user.role,
    prompt: data.prompt.substring(0, 100) + "...",
    count: data.count,
  })

  // If user is a bot, handle accordingly (skip checks and limits)
  if (user.role === "BOT") {
    logger.info("Bot user detected, skipping limits", { userId: user.id })

    // Generate random seeds
    const seeds = Array.from({ length: data.count }, () => Math.floor(Math.random() * 1000000))

    // Start image generation process with webhook
    const modelConfig = provider.MODEL_CONFIGS.flux
    const response = await initiateImageGeneration({
      prompt: data.prompt,
      seeds,
      count: data.count,
      modelConfig,
      width: data.width || 1024,
      height: data.height || 1024,
      userId: user.id,
    })

    // Create placeholder images in database
    const pendingImages = await createPendingImages(
      user.id,
      data.prompt,
      seeds,
      response.taskId,
      modelConfig,
      0, // No cost for bots
      data.width || 1024,
      data.height || 1024,
      response.futureLinks || [],
    )

    logger.info("Bot image generation initiated", {
      userId: user.id,
      taskId: response.taskId,
      imageCount: pendingImages.length,
    })

    return {
      images: pendingImages,
      status: "processing",
      taskId: response.taskId,
      eta: response.eta,
      nutsUsed: 0,
      remainingNuts: "unlimited",
    }
  }

  // Get client IP for rate limiting and abuse prevention
  const headersList = headers()
  const clientIP =
    headersList.get("x-forwarded-for")?.split(",")[0] ||
    headersList.get("x-real-ip") ||
    "unknown"

  logger.debug("Client IP detected", { userId: user.id, clientIP })

  // Check rate limit and free tier limits
  const rateLimitCheck = await checkGenerationLimit(user.id, clientIP)
  if (!rateLimitCheck.allowed) {
    logger.warn("Generation blocked by rate limit", {
      userId: user.id,
      reason: rateLimitCheck.reason,
      clientIP,
    })
    throw new Error(rateLimitCheck.reason || "Generation limit exceeded")
  }

  logger.debug("Rate limit check passed", {
    userId: user.id,
    remainingCredits: rateLimitCheck.remainingCredits,
  })

  // Get plan and usage
  const { plan } = await getUserActivePlan(user.id)
  if (!plan) {
    logger.error("No plan found for user", { userId: user.id })
    throw new Error("No plan found for user")
  }

  const totalCost = data.count * NEXT_PUBLIC_NUTS_PER_IMAGE
  logger.debug("Calculated generation cost", { userId: user.id, totalCost, nutsPerImage: NEXT_PUBLIC_NUTS_PER_IMAGE })

  // Check and update usage (throws if over limit)
  await checkAndUpdateUsage(user.id, data.count, totalCost)

  // Generate random seeds
  const seeds = Array.from({ length: data.count }, () => Math.floor(Math.random() * 1000000))

  // Start image generation process with webhook
  const modelConfig = provider.MODEL_CONFIGS.flux
  const response = await initiateImageGeneration({
    prompt: data.prompt,
    seeds,
    count: data.count,
    modelConfig,
    width: data.width || 1024,
    height: data.height || 1024,
    userId: user.id,
  })

  // Create placeholder images in database
  const pendingImages = await createPendingImages(
    user.id,
    data.prompt,
    seeds,
    response.taskId,
    modelConfig,
    totalCost,
    data.width || 1024,
    data.height || 1024,
    response.futureLinks || [],
  )

  // Record this generation for rate limiting tracking
  await recordGeneration(user.id, clientIP)

  logger.info("Image generation initiated successfully", {
    userId: user.id,
    taskId: response.taskId,
    imageCount: pendingImages.length,
    totalCost,
    remainingFreeCredits: rateLimitCheck.remainingCredits,
  })

  return {
    images: pendingImages,
    status: "processing",
    taskId: response.taskId,
    eta: response.eta,
    nutsUsed: totalCost,
    remainingFreeCredits: rateLimitCheck.remainingCredits,
  }
}

// Helper function to initiate generation with webhook
export async function initiateImageGeneration({
  prompt,
  seeds,
  count,
  modelConfig,
  width,
  height,
  userId,
}: {
  prompt: string
  seeds: number[]
  count: number
  modelConfig: ModelConfig
  width: number
  height: number
  userId: string
}): Promise<{
  taskId: string
  eta?: number
  futureLinks?: string[]
}> {
  const seed = seeds[0] // Use first seed

  logger.debug("Initiating image generation with provider", {
    userId,
    prompt: prompt.substring(0, 50) + "...",
    seed,
    count,
    modelId: modelConfig.model_id,
    dimensions: `${width}x${height}`,
  })

  try {
    const response = await provider.fetchWithRetry(provider.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        seed,
        height,
        width,
        key: provider.apiKey,
        samples: count,
        webhook: WEBHOOK_URL,
        track_id: userId, // Send user ID as tracking ID for webhook
        ...modelConfig,
      }),
    })

    const data: ModelslabResponse = await response.json()
    logger.debug("Provider response received", {
      userId,
      status: data.status,
      taskId: data.id,
      eta: data.eta,
    })

    if (data.status === "error") {
      logger.error("Provider returned error", {
        userId,
        error: data.messege,
        responseStatus: response.status,
      })
      throw new provider.ImageGenerationError(data.messege || "Failed to generate image", response.status, false)
    }

    if (!data.id) {
      logger.error("No task ID returned from provider", { userId, responseStatus: response.status })
      throw new provider.ImageGenerationError("No task ID returned from API", response.status, false)
    }

    return {
      taskId: data.id.toString(),
      eta: data.eta,
      futureLinks: data.future_links,
    }
  } catch (error: any) {
    logger.error("Error initiating image generation", {
      userId,
      error: error.message,
      stack: error.stack,
    })
    throw error
  }
}

// Create pending image records in database
export async function createPendingImages(
  userId: string,
  prompt: string,
  seeds: number[],
  taskId: string,
  modelConfig: ModelConfig,
  totalCost: number,
  width: number,
  height: number,
  futureLinks: string[],
) {
  logger.debug("Creating pending image records", {
    userId,
    taskId,
    imageCount: seeds.length,
    totalCost,
  })

  // Get all categories for reference
  const categories = await db.category.findMany()
  logger.debug("Fetched categories for analysis", { categoryCount: categories.length })

  // Analyze prompt to find best category
  const categoryName = analyzePromptForCategory(prompt, categories)
  logger.debug("Prompt category analysis result", { categoryName })

  // Find the category ID if a match was found
  let categoryId: string | null = null
  if (categoryName) {
    const category = categories.find((c) => c.name === categoryName)
    if (category) {
      categoryId = category.id
      logger.debug("Category matched", { categoryId, categoryName })
    }
  }

  try {
    // Create an array of create operations
    const createOperations = seeds.map((seed, index) =>
      db.generatedImage.create({
        data: {
          userId,
          prompt,
          seed,
          modelId: modelConfig.model_id,
          steps: modelConfig.num_inference_steps,
          cfg: modelConfig.guidance_scale,
          sampler: "DPM++ 2M Karras",
          costNuts: NEXT_PUBLIC_NUTS_PER_IMAGE,
          status: "processing",
          taskId,
          eta: null,
          width,
          height,
          futureLinks: futureLinks.length > index ? [futureLinks[index]] : [],
          imageUrl: null, // Will be filled when generation completes
          path: null, // Will be filled when generation completes
          // Add category connection if a category was found
          ...(categoryId
            ? {
              categoryIds: [categoryId],
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

    // Execute all create operations in a transaction
    const result = await db.$transaction(createOperations)

    logger.info("Pending images created successfully", {
      userId,
      taskId,
      imageCount: result.length,
      categoryId,
    })

    return result
  } catch (error: any) {
    logger.error("Error creating pending images", {
      userId,
      taskId,
      error: error.message,
      stack: error.stack,
    })
    throw error
  }
}

// Main Functions
export const createGeneratedImage = async (data: z.infer<typeof createGeneratedImageSchema>) => {
  const user = await currentUser()
  if (!user) {
    logger.warn("Image generation attempted without authentication")
    return { error: "Not authenticated" }
  }

  const validatedFields = createGeneratedImageSchema.safeParse(data)
  if (!validatedFields.success) {
    logger.warn("Invalid image generation data", {
      userId: user.id,
      errors: validatedFields.error.issues,
    })
    return {
      error: validatedFields.error.issues.map((err) => `${err.path.join(".")}:${err.message}`).join(", "),
    }
  }

  try {
    return await createGeneratedImagesRAW(user, validatedFields.data)
  } catch (error: any) {
    logger.error("Error in createGeneratedImage", {
      userId: user.id,
      error: error.message,
      stack: error.stack,
    })
    return { error: error.message }
  }
}

export const createGeneratedImagesBatch = async (data: z.infer<typeof createGeneratedImagesBatchSchema>) => {
  const user = await currentUser()
  if (!user) {
    logger.warn("Batch image generation attempted without authentication")
    return { error: "Not authenticated" }
  }

  const validatedFields = createGeneratedImagesBatchSchema.safeParse(data)
  if (!validatedFields.success) {
    logger.warn("Invalid batch image generation data", {
      userId: user.id,
      errors: validatedFields.error.issues,
    })
    return {
      error: validatedFields.error.issues.map((err) => `${err.path.join(".")}:${err.message}`).join(", "),
    }
  }

  logger.info("Processing batch image generation", {
    userId: user.id,
    batchSize: validatedFields.data.images.length,
  })

  try {
    const results = await Promise.all(
      validatedFields.data.images.map(async (imageData) => {
        return await createGeneratedImagesRAW(user, imageData)
      }),
    )

    logger.info("Batch image generation completed", {
      userId: user.id,
      totalImages: results.flatMap((r) => r.images).length,
    })

    return { images: results.flatMap((r) => r.images) }
  } catch (error: any) {
    logger.error("Error in createGeneratedImagesBatch", {
      userId: user.id,
      error: error.message,
      stack: error.stack,
    })
    return { error: error.message }
  }
}

// Convenience function for single image generation
export const createSingleGeneratedImage = async (prompt: string) => {
  logger.info("Creating single generated image", { prompt: prompt.substring(0, 50) + "..." })

  return await createGeneratedImage({
    prompt,
    count: 1,
    width: 1024,
    height: 1024,
    isPublic: true,
  })
}
/**
 * Advanced check and update usage for the user, enforcing plan limits with detailed cost calculation.
 * This version handles complex generation options and calculates costs based on various parameters.
 */
export async function checkAndUpdateAdvancedUsage(
  userId: string,
  generationOptions: {
    count: number;
    width: number;
    height: number;
    steps: number;
    upscale?: boolean;
    modelId: string;
    loraModel?: string;
    loraStrength?: number;
    enhanceStyle?: string;
  }
) {
  logger.debug("Checking and updating advanced usage", {
    userId,
    generationOptions: {
      count: generationOptions.count,
      dimensions: `${generationOptions.width}x${generationOptions.height}`,
      steps: generationOptions.steps,
      modelId: generationOptions.modelId
    }
  })

  const { plan } = await getUserActivePlan(userId)
  if (!plan) {
    logger.error("No plan found for user", { userId })
    throw new Error("No plan found for user")
  }

  const usage = await getOrCreateUsageRecord(userId, plan)

  // Calculate total cost using the existing cost calculation logic
  const totalCost = calculateGenerationCost(generationOptions)
  const imagesToGenerate = generationOptions.count

  logger.debug("Advanced generation cost calculated", {
    userId,
    totalCost,
    imagesToGenerate,
    baseParameters: {
      width: generationOptions.width,
      height: generationOptions.height,
      steps: generationOptions.steps,
      upscale: generationOptions.upscale || false
    }
  })

  // Check monthly nuts limit
  if (plan.nutsPerMonth !== -1 && usage.nutsUsed + totalCost > plan.nutsPerMonth) {
    const remaining = plan.nutsPerMonth - usage.nutsUsed
    logger.warn("Monthly nuts limit exceeded for advanced generation", {
      userId,
      nutsUsed: usage.nutsUsed,
      totalCost,
      monthlyLimit: plan.nutsPerMonth,
      remaining
    })
    throw new Error(`Monthly nuts limit exceeded. Required: ${totalCost}, Remaining: ${remaining}`)
  }
  // Hided because feature is to be removed!
  // Check daily image limit
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // if (plan.imagesPerDay !== -1) {
  //   let dailyRemaining = plan.imagesPerDay

  //   if (usage.lastImageDate && usage.lastImageDate >= today) {
  //     dailyRemaining = plan.imagesPerDay - usage.dailyImageCount
  //     if (dailyRemaining < imagesToGenerate) {
  //       logger.warn("Daily image limit exceeded for advanced generation", {
  //         userId,
  //         dailyImageCount: usage.dailyImageCount,
  //         imagesToGenerate,
  //         dailyLimit: plan.imagesPerDay,
  //         remaining: dailyRemaining
  //       })
  //       throw new Error(`Daily image limit exceeded. Required: ${imagesToGenerate}, Remaining: ${dailyRemaining}`)
  //     }
  //   } else if (imagesToGenerate > plan.imagesPerDay) {
  //     logger.warn("Daily image limit exceeded for advanced generation (new day)", {
  //       userId,
  //       imagesToGenerate,
  //       dailyLimit: plan.imagesPerDay
  //     })
  //     throw new Error(`Daily image limit exceeded. Required: ${imagesToGenerate}, Daily limit: ${plan.imagesPerDay}`)
  //   }
  // }

  // Check per-generation limit
  if (imagesToGenerate > plan.imagesPerGeneration) {
    logger.warn("Per-generation limit exceeded for advanced generation", {
      userId,
      imagesToGenerate,
      generationLimit: plan.imagesPerGeneration
    })
    throw new Error(`Per-generation limit exceeded. Required: ${imagesToGenerate}, Max per generation: ${plan.imagesPerGeneration}`)
  }

  // Additional check for advanced features based on plan tier
  if (plan.name && plan.name.toLowerCase() === 'basic') {
    // Basic plan restrictions for advanced features
    if (generationOptions.width > 1024 || generationOptions.height > 1024) {
      logger.warn("High resolution restricted for basic plan", {
        userId,
        dimensions: `${generationOptions.width}x${generationOptions.height}`,
        planTier: plan.name
      })
      throw new Error("High resolution generation (>1024px) requires a premium plan")
    }

    if (generationOptions.steps > 50) {
      logger.warn("High step count restricted for basic plan", {
        userId,
        steps: generationOptions.steps,
        planTier: plan.name
      })
      throw new Error("High step count (>50) requires a premium plan")
    }

    if (generationOptions.upscale) {
      logger.warn("Upscaling restricted for basic plan", {
        userId,
        planTier: plan.name
      })
      throw new Error("Image upscaling requires a premium plan")
    }
  }

  // Update usage record
  let newDailyImageCount = usage.dailyImageCount
  let newLastImageDate = usage.lastImageDate

  if (usage.lastImageDate && usage.lastImageDate >= today) {
    newDailyImageCount += imagesToGenerate
  } else {
    newDailyImageCount = imagesToGenerate
    newLastImageDate = new Date()
  }

  await db.usageRecord.update({
    where: { userId },
    data: {
      nutsUsed: { increment: totalCost },
      imagesGenerated: { increment: imagesToGenerate },
      dailyImageCount: newDailyImageCount,
      lastImageDate: newLastImageDate,
    },
  })

  logger.info("Advanced usage updated successfully", {
    userId,
    costDeducted: totalCost,
    imagesGenerated: imagesToGenerate,
    newNutsUsed: usage.nutsUsed + totalCost,
    newImagesGenerated: usage.imagesGenerated + imagesToGenerate,
    newDailyImageCount,
  })

  return {
    plan,
    usage: {
      nutsUsed: usage.nutsUsed + totalCost,
      imagesGenerated: usage.imagesGenerated + imagesToGenerate,
      dailyImageCount: newDailyImageCount,
    },
    cost: totalCost
  }
}

/**
 * Updated RAW function that uses the new advanced usage checking
 */
export const createAdvancedGeneratedImageRAW = async (user: User, data: z.infer<typeof advancedGenerationSchema>) => {
  logger.info("Creating advanced generated image", {
    userId: user.id,
    modelId: data.options.modelId,
    count: data.options.count,
    dimensions: `${data.options.width}x${data.options.height}`,
  })

  // Use the new advanced usage checking system
  const usageResult = await checkAndUpdateAdvancedUsage(user.id, {
    count: data.options.count,
    width: data.options.width,
    height: data.options.height,
    steps: data.options.steps,
    // upscale: data.options.upscale || false,
    modelId: data.options.modelId,
    loraModel: data.options.loraModel,
    loraStrength: data.options.loraStrength,
    enhanceStyle: data.options.enhanceStyle,
  })

  const totalCost = usageResult.cost

  logger.info("Advanced usage check passed", {
    userId: user.id,
    totalCost,
    planTier: usageResult.plan.name,
    remainingNuts: usageResult.plan.nutsPerMonth !== -1 ?
      usageResult.plan.nutsPerMonth - usageResult.usage.nutsUsed : -1
  })

  // Generate seeds array based on the count
  const seeds: number[] = []
  if (data.options.seed) {
    // If seed is provided, use it for the first image and increment for others
    const baseSeed = Number.parseInt(data.options.seed)
    for (let i = 0; i < data.options.count; i++) {
      seeds.push(baseSeed + i)
    }
    logger.debug("Using provided seed with increments", { baseSeed, count: data.options.count })
  } else {
    // Generate random seeds for each image
    for (let i = 0; i < data.options.count; i++) {
      seeds.push(Math.floor(Math.random() * 1000000))
    }
    logger.debug("Generated random seeds", { count: data.options.count })
  }

  // Create model config according to the interface
  const modelConfig: ModelConfig = {
    model_id: data.options.modelId,
    num_inference_steps: data.options.steps,
    guidance_scale: data.options.cfg,
    ...(data.options.loraModel && {
      lora_model: data.options.loraModel,
      lora_strength: data.options.loraStrength || 1,
    }),
    ...(data.options.enhanceStyle && {
      enhance_style: data.options.enhanceStyle,
    }),
  }

  // Start image generation process with webhook
  const response = await initiateImageGeneration({
    prompt: data.options.prompt,
    seeds,
    count: data.options.count,
    modelConfig,
    width: data.options.width,
    height: data.options.height,
    userId: user.id,
  })

  // Create placeholder images in database
  const pendingImages = await createPendingImages(
    user.id,
    data.options.prompt,
    seeds,
    response.taskId,
    modelConfig,
    totalCost,
    data.options.width,
    data.options.height,
    response.futureLinks || [],
  )

  const imageInfo = await getImagesInfoRAW(
    pendingImages.map((img) => ({ imageId: img.id })),
    {},
  )

  logger.info("Advanced image generation completed", {
    userId: user.id,
    taskId: response.taskId,
    imageCount: imageInfo.length,
    totalCost,
  })

  return {
    images: imageInfo,
    status: "processing",
    taskId: response.taskId,
    eta: response.eta,
    cost: totalCost,
    usage: usageResult.usage
  }
}

// Main function for advanced image generation
export const createAdvancedGeneratedImage = async (data: z.infer<typeof advancedGenerationSchema>) => {
  const user = await currentUser()
  if (!user) {
    logger.warn("Advanced image generation attempted without authentication")
    return { error: "Not authenticated" }
  }

  const validatedFields = advancedGenerationSchema.safeParse(data)
  if (!validatedFields.success) {
    logger.warn("Invalid advanced image generation data", {
      userId: user.id,
      errors: validatedFields.error.issues,
    })
    return {
      error: validatedFields.error.issues.map((err) => `${err.path.join(".")}:${err.message}`).join(", "),
    }
  }

  try {
    const result = await createAdvancedGeneratedImageRAW(user, validatedFields.data)
    return result
  } catch (error: any) {
    logger.error("Error in createAdvancedGeneratedImage", {
      userId: user.id,
      error: error.message,
      stack: error.stack,
    })
    return { error: error.message }
  }
}
