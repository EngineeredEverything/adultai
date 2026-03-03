"use server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { groupBy } from "@/lib/utils"
import type { getImageCommentsDataSchema } from "@/schemas/comments"
import { currentUser } from "@/utils/auth"
import type z from "zod"
import type { PerformanceTracker } from "@/lib/performance"

export async function getAllComments(imageId: string) {
  try {
    const user = await currentUser()
    if (!user) return { error: "Not authenticated" }

    const comments = await db.imageComment.findMany({
      where: {
        imageId: imageId,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return comments
  } catch (error: any) {
    return { error: error.message }
  }
}

export const getImagesCommentsInfoCORE = async (
  imagesData: { imageId: string }[],
  data: z.infer<typeof getImageCommentsDataSchema>,
  tracker?: PerformanceTracker,
) => {
  logger.debug("Getting images comments info (optimized)", {
    imageCount: imagesData.length,
    includeCount: data.count,
    limit: data.limit,
  })

  const imageIds = imagesData.map((i) => i.imageId)

  const queryFn = () =>
    db.imageComment.findMany({
      where: { imageId: { in: imageIds } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    })

  const comments = tracker ? await tracker.trackQuery("findManyComments", queryFn) : await queryFn()

  const groupedComments = groupBy(comments, (c) => c.imageId)
  const limitedComments = Object.fromEntries(
    Object.entries(groupedComments).map(([id, list]) => [
      id,
      data.limit ? list?.slice(data.limit.start, data.limit.end) : list,
    ]),
  )

  const counts: Record<string, number> = {}
  if (data.count) {
    for (const comment of comments) {
      counts[comment.imageId] = (counts[comment.imageId] || 0) + 1
    }
  }

  const results = imageIds.map((id) => ({
    imageId: id,
    comments: limitedComments[id] || [],
    count: data.count ? counts[id] || 0 : undefined,
  }))

  logger.debug("Comments info retrieved (optimized)", {
    imageCount: imageIds.length,
    totalComments: comments.length,
  })

  return results
}
