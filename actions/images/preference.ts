"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { logger } from "@/lib/logger"

/**
 * Record which image the user preferred from a generation batch.
 * Also upvotes the chosen image to boost its ranking.
 */
export async function recordImagePreference({
  chosenImageId,
  rejectedImageIds,
  prompt,
}: {
  chosenImageId: string
  rejectedImageIds: string[]
  prompt: string
}) {
  try {
    const user = await currentUser()
    if (!user?.id) return { error: "Not authenticated" }

    // Save preference record
    await db.imagePreference.create({
      data: {
        userId: user.id,
        chosenImageId,
        rejectedImageIds,
        prompt,
      },
    })

    // Upvote the chosen image (boost its ranking signal)
    const existingVote = await db.imageVote.findUnique({
      where: {
        userId_imageId: {
          userId: user.id,
          imageId: chosenImageId,
        },
      },
    })

    if (!existingVote) {
      await db.$transaction([
        db.imageVote.create({
          data: {
            userId: user.id,
            imageId: chosenImageId,
            voteType: "UPVOTE",
          },
        }),
        db.generatedImage.update({
          where: { id: chosenImageId },
          data: {
            upvotes: { increment: 1 },
            voteScore: { increment: 1 },
          },
        }),
      ])
    }

    logger.info("Image preference recorded", {
      userId: user.id,
      chosenImageId,
      rejectedCount: rejectedImageIds.length,
    })

    return { success: true }
  } catch (error: any) {
    logger.error("Error recording image preference:", error.message)
    return { error: error.message }
  }
}
