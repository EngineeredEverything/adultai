"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import type { z } from "zod"
import { logger } from "@/lib/logger"
import { updateVideoSchema } from "@/schemas/videos"

export const updateVideoInfo = async (videoId: string, data: z.infer<typeof updateVideoSchema>) => {
  const user = await currentUser()
  if (!user) {
    logger.warn("Update video attempted without authentication")
    return { error: "Not authenticated" }
  }

  const validatedFields = updateVideoSchema.safeParse(data)
  if (!validatedFields.success) {
    logger.warn("Invalid update video data", {
      userId: user.id,
      videoId,
      errors: validatedFields.error.issues,
    })
    return {
      error: validatedFields.error.issues.map((err) => `${err.path.join(".")}:${err.message}`).join(", "),
    }
  }

  try {
    const video = await db.generatedVideo.findUnique({
      where: { id: videoId },
      select: { userId: true },
    })

    if (!video) {
      logger.error("Video not found", { videoId, userId: user.id })
      return { error: "Video not found" }
    }

    if (video.userId !== user.id) {
      logger.warn("Unauthorized video update attempt", {
        videoId,
        userId: user.id,
        ownerId: video.userId,
      })
      return { error: "Not authorized to update this video" }
    }

    const updateData: any = {}

    if (validatedFields.data.prompt !== undefined) {
      updateData.prompt = validatedFields.data.prompt
    }

    if (validatedFields.data.isPublic !== undefined) {
      updateData.isPublic = validatedFields.data.isPublic
    }

    if (validatedFields.data.categoryIds !== undefined) {
      updateData.categories = {
        set: validatedFields.data.categoryIds.map((id) => ({ id })),
      }
    }

    const updatedVideo = await db.generatedVideo.update({
      where: { id: videoId },
      data: updateData,
    })

    logger.info("Video updated successfully", {
      videoId,
      userId: user.id,
      updatedFields: Object.keys(updateData),
    })

    return { video: updatedVideo }
  } catch (error: any) {
    logger.error("Error updating video", {
      videoId,
      userId: user.id,
      error: error.message,
      stack: error.stack,
    })
    return { error: error.message }
  }
}
