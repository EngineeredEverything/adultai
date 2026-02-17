"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { logger } from "@/lib/logger"
import { deleteFile } from "@/lib/cdn"

export const deleteVideo = async (videoId: string) => {
  const user = await currentUser()
  if (!user) {
    logger.warn("Delete video attempted without authentication")
    return { error: "Not authenticated" }
  }

  try {
    const video = await db.generatedVideo.findUnique({
      where: { id: videoId },
      select: { userId: true, path: true },
    })

    if (!video) {
      logger.error("Video not found", { videoId, userId: user.id })
      return { error: "Video not found" }
    }

    if (video.userId !== user.id) {
      logger.warn("Unauthorized video deletion attempt", {
        videoId,
        userId: user.id,
        ownerId: video.userId,
      })
      return { error: "Not authorized to delete this video" }
    }

    if (video.path) {
      try {
        await deleteFile(video.path)
        logger.info("Video file deleted from CDN", { videoId, path: video.path })
      } catch (error) {
        logger.error("Error deleting video file from CDN", {
          videoId,
          path: video.path,
          error,
        })
      }
    }

    await db.generatedVideo.delete({
      where: { id: videoId },
    })

    logger.info("Video deleted successfully", {
      videoId,
      userId: user.id,
    })

    return { success: true }
  } catch (error: any) {
    logger.error("Error deleting video", {
      videoId,
      userId: user.id,
      error: error.message,
      stack: error.stack,
    })
    return { error: error.message }
  }
}
