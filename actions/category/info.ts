"use server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { Prisma } from "@prisma/client"
import { searchImages } from "../images/info"
import { trackPerformance } from "@/lib/performance"

/**
 * Recompute and store the best thumbnail for a category.
 * Called after any vote so thumbnails stay current.
 */
export async function refreshCategoryThumbnail(categoryId: string) {
  try {
    const best = await db.generatedImage.findFirst({
      where: {
        categoryIds: { has: categoryId },
        status: "completed",
        imageUrl: { not: null },
        isPublic: true,
      },
      select: { imageUrl: true },
      orderBy: [{ voteScore: "desc" }, { upvotes: "desc" }, { createdAt: "desc" }],
    })
    if (best?.imageUrl) {
      await db.category.update({
        where: { id: categoryId },
        data: { thumbnailUrl: best.imageUrl },
      })
    }
  } catch (e) {
    // Non-critical — don't let thumbnail refresh break vote flow
    logger.warn("refreshCategoryThumbnail failed", { categoryId, error: e })
  }
}

export async function getAllCategories() {
  return trackPerformance("getAllCategories", async (tracker) => {
    const allCategories = await tracker.trackQuery("findAllCategories", () =>
      db.category.findMany({
        select: {
          id: true,
          name: true,
          keywords: true,
          imageIds: true,
          thumbnailUrl: true,
        },
      }),
    )

    const filteredCategories = allCategories
      .filter((category) => category.imageIds.length > 0)
      .sort((a, b) => b.imageIds.length - a.imageIds.length)

    return filteredCategories.map((category) => ({
      id: category.id,
      name: category.name,
      keywords: category.keywords,
      imageCount: category.imageIds.length,
      sampleImage: category.thumbnailUrl
        ? { id: category.id, imageUrl: category.thumbnailUrl }
        : null,
    }))
  })
}

export async function getTopCategories(limit = 6) {
  return trackPerformance(
    "getTopCategories",
    async (tracker) => {
      const allCategories = await tracker.trackQuery("findAllCategoriesForTop", () =>
        db.category.findMany({
          select: {
            id: true,
            name: true,
            keywords: true,
            imageIds: true,
            thumbnailUrl: true,
          },
        }),
      )

      const topCategories = allCategories
        .filter((cat) => cat.imageIds.length > 0)
        .sort((a, b) => b.imageIds.length - a.imageIds.length)
        .slice(0, limit)

      return topCategories.map((category) => ({
        id: category.id,
        name: category.name,
        keywords: category.keywords,
        imageCount: category.imageIds.length,
        sampleImage: category.thumbnailUrl
          ? { id: category.id, imageUrl: category.thumbnailUrl }
          : null,
      }))
    },
    { limit },
  )
}

export async function getCategoryWithImages(categoryId: string, page = 1, limit = 20) {
  return trackPerformance(
    "getCategoryWithImages",
    async (tracker) => {
      const skip = (page - 1) * limit

      const category = await tracker.trackQuery("findCategory", () =>
        db.category.findUnique({
          where: {
            id: categoryId,
          },
          select: {
            id: true,
            name: true,
            keywords: true,
            imageIds: true, // Get imageIds array instead of _count
          },
        }),
      )

      if (!category) {
        return null
      }

      const images = await searchImages({
        filters: {
          category_id: categoryId,
          status: "completed",
          sort: "votes_desc",
        },
        data: {
          limit: { start: skip, end: skip + limit },
          images: {
            comments: { count: true },
            votes: { count: true },
            categories: true,
          },
        },
      })

      const totalImages = category.imageIds.length // Use array length

      return {
        id: category.id,
        name: category.name,
        keywords: category.keywords,
        images,
        totalImages,
        totalPages: Math.ceil(totalImages / limit),
        currentPage: page,
      }
    },
    { categoryId, page, limit },
  )
}

export async function findMatchingCategories(searchTerm: string) {
  const searchWords = searchTerm.toLowerCase().split(/\s+/)

  logger.debug("Finding matching categories", { searchTerm, searchWords })

  return await db.category.findMany({
    where: {
      OR: [
        {
          name: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          keywords: {
            hasSome: searchWords,
          },
        },
        ...searchWords.map((word) => ({
          keywords: {
            has: word,
          },
        })),
      ],
    },
    select: {
      id: true,
      name: true,
      keywords: true,
    },
  })
}
