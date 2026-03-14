"use server"

import { db } from "@/lib/db"
import { z } from "zod"
import { createPendingImages, initiateImageGeneration } from "./create"
import { logger } from "@/lib/logger"
import { getImageProvider } from "./provider"
import { getImagesInfoRAW } from "./info"
import { MODEL_CONFIGS } from "@/lib/custom/config"
import { botGenerationSchema } from "@/schemas/bot"
const provider = getImageProvider("CUSTOM")

type ModelConfig = typeof provider.types.ModelConfig

const handleGeneration = async ({
    data,
    user,
}: {
    data: {
        enhanceStyle?: string | undefined;
        loraStrength?: number | undefined;
        loraModel?: string | undefined;
        seed?: string | undefined;
        negativePrompt?: string | undefined;
        prompt: string;
        modelId: string;
        steps: number;
        cfg: number;
        sampler: string;
        width: number;
        height: number;
        count: number;
    }
    user: { id: string; email: string; }
}) => {
    // Generate seeds array based on the count
    const seeds: number[] = []
    if (data.seed) {
        // If seed is provided, use it for the first image and increment for others
        const baseSeed = Number.parseInt(data.seed)
        for (let i = 0; i < data.count; i++) {
            seeds.push(baseSeed + i)
        }
        logger.debug("Using provided seed with increments", { baseSeed, count: data.count })
    } else {
        // Generate random seeds for each image
        for (let i = 0; i < data.count; i++) {
            seeds.push(Math.floor(Math.random() * 1000000))
        }
        logger.debug("Generated random seeds", { count: data.count })
    }

    // Build model config from bot's own params (steps/cfg/sampler/negativePrompt),
    // falling back to static MODEL_CONFIGS only if modelId matches a known config.
    // This prevents bot's cyberrealistic_pony from falling back to the flux lora.
    const staticConfig = MODEL_CONFIGS[data.modelId]
    const modelConfig: ModelConfig = staticConfig
        ? staticConfig
        : {
            model_id: data.modelId,
            num_inference_steps: data.steps,
            guidance_scale: data.cfg,
            sampler: data.sampler,
            negative_prompt: data.negativePrompt || MODEL_CONFIGS['flux'].negative_prompt,
            hires_fix: true,
            hires_scale: 1.5,
            hires_denoise: 0.4,
            hires_steps: Math.floor(data.steps * 0.6),
            face_restore: true,
            face_restore_strength: 0.2,
        }

    logger.info("Bot model config resolved", {
        modelId: data.modelId,
        usedStaticConfig: !!staticConfig,
        steps: modelConfig.num_inference_steps,
        cfg: modelConfig.guidance_scale,
        lora: (modelConfig as any).lora_model,
    })

    // Start image generation process with webhook
    const response = await initiateImageGeneration({
        prompt: data.prompt,
        seeds,
        count: data.count,
        modelConfig,
        width: data.width,
        height: data.height,
        userId: user.id,
    })

    // Create placeholder images in database
    const pendingImages = await createPendingImages(
        user.id,
        data.prompt,
        seeds,
        response.taskId,
        modelConfig,
        0,
        data.width,
        data.height,
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
        totalCost: 0,
    })

    return {
        images: imageInfo,
        status: "processing",
        taskId: response.taskId,
        eta: response.eta,
        cost: 0,
    }
}

export const handleBotImageGeneration = async (props: z.infer<typeof botGenerationSchema>) => {
    logger.info("Bot image generation request", {
        email: props.email,
        prompt: props.prompt.substring(0, 50) + "...",
        count: props.count,
        dimensions: `${props.width}x${props.height}`,
        modelId: props.modelId,
        steps: props.steps,
        cfg: props.cfg,
        sampler: props.sampler,
    })

    const validated = botGenerationSchema.safeParse(props)
    if (!validated.success) {
        logger.warn("Invalid bot generation data", {
            email: props.email,
            errors: validated.error.issues,
        })
        throw new Error(validated.error.issues.map((e) => e.message).join(", "))
    }

    const {
        email,
        password,
        prompt,
        count,
        width,
        height,
        modelId,
        steps,
        cfg,
        sampler,
        seed,
        negativePrompt,
        loraModel,
        loraStrength,
        enhanceStyle
    } = validated.data

    try {
        let user = await db.user.findUnique({
            where: { email },
        })

        if (!user) {
            logger.info("Creating new bot user", { email })
            user = await db.user.create({
                data: {
                    name: "Bot User", // Default name for bot user
                    email,
                    password: password,
                    role: "BOT", // Set role to BOT

                },
            })
            logger.info("Bot user created successfully", { userId: user.id, email })
        }

        if (user.role !== "BOT") {
            logger.error("User is not a bot", { userId: user.id, email, role: user.role })
            throw new Error("User is not a bot")
        }

        if (!user.password) {
            logger.error("Invalid user or password not set", { userId: user.id, email })
            throw new Error("Invalid user or password not set")
        }

        if (password !== user.password) {
            logger.error("Invalid credentials for bot user", { userId: user.id, email })
            throw new Error("Invalid credentials")
        }

        logger.info("Bot user authenticated successfully", { userId: user.id, email })

        // Create the advanced generation data structure
        const advancedGenerationData = {
            options: {
                prompt,
                modelId,
                steps,
                cfg,
                sampler,
                width,
                height,
                count,
                ...(seed && { seed }),
                ...(negativePrompt && { negativePrompt }),
                ...(loraModel && { loraModel }),
                ...(loraStrength !== undefined && { loraStrength }),
                ...(enhanceStyle && { enhanceStyle }),
            }
        }

        const result = await handleGeneration({
            data: advancedGenerationData.options,
            user,
        })
        if (!result || "error" in result) {
            logger.error("Failed to create advanced generated image", {
                email,
                error: result?.error || "Unknown error",
            })
            throw new Error("Failed to create image")
        }
        logger.info("Bot image generation completed", {
            userId: user.id,
            taskId: result.taskId,
            imageCount: result.images.length,
            status: result.status,
        })

        return {
            imageIds: result.images.map((img) => img.image.id),
            taskId: result.taskId,
            eta: result.eta,
            status: result.status,
        }
    } catch (error: any) {
        logger.error("Bot image generation error", {
            email,
            error: error.message,
            stack: error.stack,
        })
        throw error
    }
}
