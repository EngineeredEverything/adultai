"use server"

import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import type { z } from "zod"
import { currentUser, type User } from "@/utils/auth"
import { generateLinksBatch } from "@/lib/cdn"
import { logger } from "@/lib/logger"
import { getVideoProvider } from "./provider"
import {
  searchVideosSchema,
  type getVideoInfoSchema,
  checkVideoStatusSchema,
  type getRelatedVideosSchema,
} from "@/schemas/videos"
import { findMatchingCategories } from "../category/info"
import { trackPerformance, type PerformanceTracker } from "@/lib/performance"

const provider = getVideoProvider("CUSTOM")

export const getVideosInfoRAW = async (
  query: { videoId: string }[],
  data: z.infer<typeof getVideoInfoSchema>["data"],
) => {
  return trackPerformance(
    "getVideosInfoRAW",
    async (tracker) => {
      logger.debug("Getting videos info (optimized)", {
        videoCount: query.length,
        includeComments: !!data.comments,
        includeVotes: !!data.votes,
        includeCategories: !!data.categories,
      })

      const videoIds = query.map((q) => q.videoId)

      const videos = await tracker.trackQuery("findManyVideos", () =>
        db.generatedVideo.findMany({
          where: { id: { in: videoIds } },
          include: { user: { select: { name: true, id: true } } },
        }),
      )

      if (!videos.length) throw new Error("No videos found")

      const categoriesMap = data.categories
        ? await tracker.trackQuery("findManyCategories", async () => {
            const categoryIdsSet = new Set<string>()
            for (const video of videos) {
              if (video.categoryIds && Array.isArray(video.categoryIds)) {
                video.categoryIds.forEach((id) => categoryIdsSet.add(id))
              }
            }

            const categoryIds = Array.from(categoryIdsSet)
            if (categoryIds.length === 0) return {}

            const categories = await db.category.findMany({
              where: { id: { in: categoryIds } },
              select: { id: true, name: true, keywords: true },
            })

            const categoryMap = new Map(categories.map((c) => [c.id, c]))
            const map: { [key: string]: { id: string; name: string; keywords: string[] }[] } = {}

            for (const video of videos) {
              if (video.categoryIds && Array.isArray(video.categoryIds)) {
                map[video.id] = video.categoryIds
                  .map((catId) => categoryMap.get(catId))
                  .filter((cat): cat is { id: string; name: string; keywords: string[] } => cat !== undefined)
              }
            }

            return map
          })
        : {}

      const cdnLinks = generateLinksBatch(videos.map((video) => ({ id: video.id, path: video.path || "" })))
      const cdnMap = new Map(cdnLinks.map((l) => [l.id, l.link]))

      const videosInfo = videos.map((video) => ({
        video: {
          ...video,
          cdnUrl: cdnMap.get(video.id),
        },
        categories: data.categories ? categoriesMap[video.id] || [] : undefined,
      }))

      return videosInfo
    },
    { videoCount: query.length },
  )
}
export const searchVideos = async (data: z.infer<typeof searchVideosSchema>) => {
  const validatedFields = searchVideosSchema.safeParse(data)
  if (!validatedFields.success) {
    logger.warn("Invalid search videos data", { errors: validatedFields.error.issues })
    return { error: validatedFields.error.toString() }
  }

  try {
    return await searchVideosInfoRAW(
      validatedFields.data.query,
      validatedFields.data.filters,
      validatedFields.data.data,
    )
  } catch (error: any) {
    logger.error("Error searching videos", {
      error: error.message,
      stack: error.stack,
      query: validatedFields.data.query,
      filters: validatedFields.data.filters,
    })
    return { error: error.message }
  }
}

// helpers
async function buildWeightedSearchQuery(
  searchTerm: string,
  categoryIds: string[],
  filters: z.infer<typeof searchVideosSchema>["filters"],
  data: z.infer<typeof searchVideosSchema>["data"],
) {
  const baseQuery: Prisma.GeneratedVideoWhereInput = {
    AND: [
      {
        OR: [
          // { title: { contains: searchTerm, mode: "insensitive" } },
          // { description: { contains: searchTerm, mode: "insensitive" } },
          { prompt: { contains: searchTerm, mode: "insensitive" } },
          {
            OR: [
              { categoryIds: { hasSome: categoryIds } },
              { prompt: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        ],
      },
      filters?.private
        ? { userId: filters.userId, status: { in: ["completed", "processing"] } }
        : { isPublic: true, status: "completed" },
      data.ids?.length ? { id: { in: data.ids } } : {},
    ],
  }

  return baseQuery
}

async function executeRankedSearch(
  searchQuery: Prisma.GeneratedVideoWhereInput,
  data: z.infer<typeof searchVideosSchema>["data"],
) {
  const videos = await db.generatedVideo.findMany({
    where: searchQuery,
    skip: data.limit?.start,
    take: data.limit ? data.limit.end - data.limit.start : undefined,
    orderBy: [
      {
        // _relevance: {
        //   fields: ["prompt"],
        //   search: "art",
        //   sort: "desc",
        // },
      },
      { createdAt: "desc" },
      { id: "desc" },
    ],
  })

  return videos
}

export const searchVideosInfoRAW = async (
  query: z.infer<typeof searchVideosSchema>["query"],
  filters: z.infer<typeof searchVideosSchema>["filters"],
  data: z.infer<typeof searchVideosSchema>["data"],
) => {
  return trackPerformance(
    "searchVideosInfoRAW",
    async (tracker) => {
      const searchTerm = query?.trim() || ""

      logger.info("Searching videos", {
        searchTerm: searchTerm.substring(0, 50),
        filters,
        hasIds: !!data.ids?.length,
        limit: data.limit,
      })

      if (!searchTerm) {
        return await getFilteredVideos(filters, data, tracker)
      }

      const matchingCategories = await tracker.trackQuery("findMatchingCategories", () =>
        findMatchingCategories(searchTerm),
      )
      const categoryIds = matchingCategories.map((cat) => cat.id)

      const searchQuery = await buildWeightedSearchQuery(searchTerm, categoryIds, filters, data)

      const [videos, count] = await Promise.all([
        tracker.trackQuery("executeRankedSearch", () => executeRankedSearch(searchQuery, data)),
        data.count
          ? tracker.trackQuery("countVideos", () => db.generatedVideo.count({ where: searchQuery }))
          : Promise.resolve(undefined),
      ])

      if (!videos || videos.length === 0) {
        throw new Error("No videos found")
      }

      const videosInfo = await getVideosInfoRAW(
        videos.map((video) => ({ videoId: video.id })),
        data.videos,
      )

      return { videos: videosInfo, count }
    },
    { searchTerm: query?.substring(0, 50) },
  )
}

async function getFilteredVideos(
  filters: z.infer<typeof searchVideosSchema>["filters"],
  data: z.infer<typeof searchVideosSchema>["data"],
  tracker?: PerformanceTracker,
) {
  logger.debug("Getting filtered videos", { filters, limit: data.limit })

  const categoryFilter = filters?.category_id ? { categories: { some: { id: filters?.category_id } } } : {}

  const searchQuery: Prisma.GeneratedVideoWhereInput = filters?.private
    ? {
        userId: filters.userId,
        status: filters.status ? { in: [filters.status] } : { in: ["completed", "processing"] },
        ...(data.ids?.length ? { id: { in: data.ids } } : {}),
        ...categoryFilter,
      }
    : {
        AND: [
          ...(filters?.isPublic !== undefined ? [{ isPublic: filters.isPublic }] : []),
          filters?.userId
            ? {
                OR: [
                  filters.status ? { status: filters.status } : { status: "completed" },
                  {
                    AND: [
                      filters.status ? { status: filters.status } : { status: "processing" },
                      { userId: filters.userId },
                    ],
                  },
                ],
              }
            : filters?.status
              ? { status: filters.status }
              : { status: "completed" },
        ],
        ...(data.ids?.length ? { id: { in: data.ids } } : {}),
        ...categoryFilter,
      }

  const [count, videos] = await Promise.all([
    data.count
      ? tracker
        ? tracker.trackQuery("countFilteredVideos", () => db.generatedVideo.count({ where: searchQuery }))
        : db.generatedVideo.count({ where: searchQuery })
      : Promise.resolve(undefined),
    tracker
      ? tracker.trackQuery("findFilteredVideos", () =>
          db.generatedVideo.findMany({
            where: searchQuery,
            skip: data.limit?.start,
            take: data.limit ? data.limit.end - data.limit.start : undefined,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          }),
        )
      : db.generatedVideo.findMany({
          where: searchQuery,
          skip: data.limit?.start,
          take: data.limit ? data.limit.end - data.limit.start : undefined,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
  ])

  if (!videos || videos.length === 0) {
    throw new Error("No videos found")
  }

  const videosInfo = await getVideosInfoRAW(
    videos.map((video) => ({ videoId: video.id })),
    data.videos,
  )

  return { videos: videosInfo, count }
}

export const checkVideoStatusRaw = async ({
  user,
  data,
}: {
  user: User
  data: z.infer<typeof checkVideoStatusSchema>
}) => {
  return trackPerformance(
    "checkVideoStatusRaw",
    async (tracker) => {
      const validatedFields = checkVideoStatusSchema.safeParse(data)
      if (!validatedFields.success) {
        return {
          error: validatedFields.error.issues.map((err) => `${err.path.join(".")}:${err.message}`).join(", "),
        }
      }

      const pendingVideos = await tracker.trackQuery("findPendingVideos", () =>
        db.generatedVideo.findMany({
          where: {
            taskId: validatedFields.data.taskId,
            userId: user.id,
            status: { in: ["processing", "queued"] },
          },
          select: { id: true },
        }),
      )

      if (pendingVideos.length === 0) {
        const completedVideos = await tracker.trackQuery("findCompletedVideos", () =>
          db.generatedVideo.findMany({
            where: {
              taskId: validatedFields.data.taskId,
              userId: user.id,
              status: "completed",
            },
          }),
        )

        if (completedVideos.length > 0) {
          return { status: "completed", progress: 100, videos: completedVideos }
        }

        return { error: "No videos found with this task ID" }
      }

      // ... existing status checking logic ...
      // (Keep the rest of the implementation as is)
    },
    { userId: user.id, taskId: data.taskId },
  )
}

export const getRelatedVideos = async (props: z.infer<typeof getRelatedVideosSchema>) => {
  return trackPerformance(
    "getRelatedVideos",
    async (tracker) => {
      const { videoId, limit = 10, data } = props

      const currentVideo = await tracker.trackQuery("findCurrentVideo", () =>
        db.generatedVideo.findUnique({
          where: { id: videoId },
          select: { id: true, prompt: true, categoryIds: true },
        }),
      )

      if (!currentVideo) throw new Error("Video not found")

      const relatedVideoIds: string[] = []
      const categoryIds = currentVideo.categoryIds.map((cat) => cat)

      const [samePromptVideos, sameCategoryVideos, fallbackVideos] = await Promise.all([
        currentVideo.prompt
          ? tracker.trackQuery("findSamePromptVideos", () =>
              db.generatedVideo.findMany({
                where: {
                  prompt: currentVideo.prompt,
                  id: { not: videoId },
                  status: "completed",
                  isPublic: true,
                },
                select: { id: true },
                take: limit,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              }),
            )
          : Promise.resolve([]),
        categoryIds.length > 0
          ? tracker.trackQuery("findSameCategoryVideos", () =>
              db.generatedVideo.findMany({
                where: {
                  categoryIds: { hasSome: categoryIds },
                  id: { not: videoId },
                  status: "completed",
                  isPublic: true,
                },
                select: { id: true },
                take: limit,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              }),
            )
          : Promise.resolve([]),
        tracker.trackQuery("findFallbackVideos", () =>
          db.generatedVideo.findMany({
            where: { id: { not: videoId }, status: "completed", isPublic: true },
            select: { id: true },
            take: limit,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          }),
        ),
      ])

      const seenIds = new Set<string>()
      for (const vid of [...samePromptVideos, ...sameCategoryVideos, ...fallbackVideos]) {
        if (relatedVideoIds.length >= limit) break
        if (!seenIds.has(vid.id)) {
          relatedVideoIds.push(vid.id)
          seenIds.add(vid.id)
        }
      }

      if (relatedVideoIds.length === 0) {
        return { videos: [], count: 0 }
      }

      const relatedVideosInfo = await getVideosInfoRAW(
        relatedVideoIds.map((id) => ({ videoId: id })),
        data || {},
      )

      return {
        videos: relatedVideosInfo,
        count: relatedVideosInfo.length,
        currentVideo: {
          id: currentVideo.id,
          prompt: currentVideo.prompt,
          categoryIds: currentVideo.categoryIds,
        },
      }
    },
    { videoId: props.videoId, limit: props.limit },
  )
}
export const checkVideoStatus = async (data: z.infer<typeof checkVideoStatusSchema>) => {
  const user = await currentUser()
  if (!user) {
    logger.warn("Check video status attempted without authentication")
    return { error: "Not authenticated" }
  }

  try {
    const result = await checkVideoStatusRaw({
      user,
      data,
    })

    return result
  } catch (error: any) {
    logger.error("Unexpected error checking video status", {
      userId: user.id,
      taskId: data.taskId,
      error: error.message,
      stack: error.stack,
    })

    return {
      error: error.message,
      status: "failed",
      progress: 0,
    }
  }
}

