"use server"

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { groupBy } from "@/lib/utils"
import type { searchImagesSchema } from "@/schemas/images"
import type { getImageVotesDataSchema } from "@/schemas/votes"
import { currentUser } from "@/utils/auth"
import type { Prisma } from "@prisma/client"
import type z from "zod"
import type { PerformanceTracker } from "@/lib/performance"

export async function getUserVote(imageId: string) {
  try {
    const user = await currentUser()
    if (!user) return { error: "Not authenticated" }

    const vote = await db.imageVote.findUnique({
      where: {
        userId_imageId: {
          userId: user.id,
          imageId: imageId,
        },
      },
    })

    return {
      userVote: vote?.voteType || null,
      hasVoted: !!vote,
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function getImageVoteStats(imageId: string) {
  try {
    const image = await db.generatedImage.findUnique({
      where: { id: imageId },
      select: {
        upvotes: true,
        downvotes: true,
        voteScore: true,
      },
    })

    if (!image) {
      return { error: "Image not found" }
    }

    const totalVotes = image.upvotes + image.downvotes
    const upvotePercentage = totalVotes > 0 ? (image.upvotes / totalVotes) * 100 : 0

    return {
      upvotes: image.upvotes,
      downvotes: image.downvotes,
      voteScore: image.voteScore,
      totalVotes,
      upvotePercentage: Math.round(upvotePercentage),
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

export const getImagesVotesInfoCORE = async (
  imagesData: { imageId: string }[],
  data: z.infer<typeof getImageVotesDataSchema>,
  tracker?: PerformanceTracker,
) => {
  logger.debug("Getting images votes info (optimized)", {
    imageCount: imagesData.length,
    includeCount: data.count,
    includeUserVotes: data.includeUserVotes,
  })

  const imageIds = imagesData.map((i) => i.imageId)

  const queryFn = () =>
    db.imageVote.findMany({
      where: { imageId: { in: imageIds } },
      include: data.includeUserVotes ? { user: { select: { id: true, name: true } } } : undefined,
      orderBy: { createdAt: "desc" },
    })

  const votes = tracker ? await tracker.trackQuery("findManyVotes", queryFn) : await queryFn()

  const groupedVotes = groupBy(votes, (v) => v.imageId)
  const limitedVotes = Object.fromEntries(
    Object.entries(groupedVotes).map(([id, list]) => [
      id,
      data.limit ? list?.slice(data.limit.start, data.limit.end) : list,
    ]),
  )

  const voteCounts: Record<string, { total: number; up: number; down: number }> = {}
  if (data.count) {
    for (const vote of votes) {
      if (!voteCounts[vote.imageId]) {
        voteCounts[vote.imageId] = { total: 0, up: 0, down: 0 }
      }
      voteCounts[vote.imageId].total++
      if (vote.voteType === "UPVOTE") voteCounts[vote.imageId].up++
      if (vote.voteType === "DOWNVOTE") voteCounts[vote.imageId].down++
    }
  }

  const results = imageIds.map((id) => {
    const v = limitedVotes[id] || []
    const up = v.filter((x) => x.voteType === "UPVOTE")
    const down = v.filter((x) => x.voteType === "DOWNVOTE")

    const totals = voteCounts[id]
    return {
      imageId: id,
      votes: v,
      upvotes: up,
      downvotes: down,
      count: data.count ? totals?.total || 0 : undefined,
      upvoteCount: data.count ? totals?.up || 0 : undefined,
      downvoteCount: data.count ? totals?.down || 0 : undefined,
      voteScore: (totals?.up ?? up.length) - (totals?.down ?? down.length),
    }
  })

  logger.debug("Votes info retrieved (optimized)", {
    imageCount: imageIds.length,
    totalVotes: votes.length,
  })

  return results
}

export const getUserVoteForImage = async (imageId: string, userId?: string) => {
  if (!userId) return null

  try {
    const vote = await db.imageVote.findUnique({
      where: {
        userId_imageId: {
          userId,
          imageId,
        },
      },
    })

    return vote?.voteType || null
  } catch (error) {
    logger.error("Error getting user vote", { imageId, userId, error })
    return null
  }
}

export async function buildVoteFilters(filters: z.infer<typeof searchImagesSchema>["filters"]) {
  const voteFilters: Prisma.GeneratedImageWhereInput[] = []

  if (!filters) return voteFilters

  if (filters.minUpvotes !== undefined) {
    voteFilters.push({ upvotes: { gte: filters.minUpvotes } })
  }

  if (filters.maxUpvotes !== undefined) {
    voteFilters.push({ upvotes: { lte: filters.maxUpvotes } })
  }

  if (filters.minDownvotes !== undefined) {
    voteFilters.push({ downvotes: { gte: filters.minDownvotes } })
  }

  if (filters.maxDownvotes !== undefined) {
    voteFilters.push({ downvotes: { lte: filters.maxDownvotes } })
  }

  if (filters.minVoteScore !== undefined) {
    voteFilters.push({ voteScore: { gte: filters.minVoteScore } })
  }

  if (filters.maxVoteScore !== undefined) {
    voteFilters.push({ voteScore: { lte: filters.maxVoteScore } })
  }

  if (filters.hasVotes !== undefined) {
    if (filters.hasVotes) {
      voteFilters.push({
        OR: [{ upvotes: { gt: 0 } }, { downvotes: { gt: 0 } }],
      })
    } else {
      voteFilters.push({
        AND: [{ upvotes: { equals: 0 } }, { downvotes: { equals: 0 } }],
      })
    }
  }

  if (filters.voteRatio) {
    switch (filters.voteRatio) {
      case "positive":
        voteFilters.push({ voteScore: { gt: 0 } })
        break
      case "negative":
        voteFilters.push({ voteScore: { lt: 0 } })
        break
      case "neutral":
        voteFilters.push({ voteScore: { equals: 0 } })
        break
    }
  }

  logger.debug("Vote filters built", {
    filters: {
      minUpvotes: filters.minUpvotes,
      maxUpvotes: filters.maxUpvotes,
      minDownvotes: filters.minDownvotes,
      maxDownvotes: filters.maxDownvotes,
      minVoteScore: filters.minVoteScore,
      maxVoteScore: filters.maxVoteScore,
      hasVotes: filters.hasVotes,
      voteRatio: filters.voteRatio,
    },
    voteFiltersCount: voteFilters.length,
    voteFilters: voteFilters.map((f) => JSON.stringify(f)),
  })

  return voteFilters
}
