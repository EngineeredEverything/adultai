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

    // Create model config according to the interface
    const modelConfig: ModelConfig = MODEL_CONFIGS[data.modelId] || MODEL_CONFIGS['flux']

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
