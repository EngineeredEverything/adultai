"use server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { Prisma } from "@prisma/client"
import { searchImages } from "../images/info"
import { trackPerformance } from "@/lib/performance"

export async function getAllCategories() {
  return trackPerformance("getAllCategories", async (tracker) => {
    const allCategories = await tracker.trackQuery("findAllCategories", () =>
      db.category.findMany({
        select: {
          id: true,
          name: true,
          keywords: true,
          imageIds: true, // Get the array directly instead of using _count
        },
      }),
    )

    console.log("[v0] Found categories:", allCategories.length)

    // Filter categories that have images
    const filteredCategories = allCategories.filter((category) => category.imageIds.length > 0)

    console.log("[v0] Categories with images:", filteredCategories.length)

    const categoryIds = filteredCategories.map((c) => c.id)
    const sampleImages = await tracker.trackQuery("findManySampleImages", () =>
      db.generatedImage.findMany({
        where: {
          categoryIds: {
            hasSome: categoryIds,
          },
          status: "completed",
          imageUrl: {
            not: null,
          },
        },
        select: {
          id: true,
          imageUrl: true,
          categoryIds: true,
        },
        orderBy: {
          upvotes: "desc",
        },
      }),
    )

    const categoryImageMap = new Map<string, { id: string; imageUrl: string | null }>()
    for (const image of sampleImages) {
      for (const catId of image.categoryIds) {
        if (!categoryImageMap.has(catId)) {
          categoryImageMap.set(catId, {
            id: image.id,
            imageUrl: image.imageUrl,
          })
        }
      }
    }

    const categoriesWithSampleImages = filteredCategories.map((category) => ({
      id: category.id,
      name: category.name,
      keywords: category.keywords,
      imageCount: category.imageIds.length, // Use array length instead of _count
      sampleImage: categoryImageMap.get(category.id) || null,
    }))

    categoriesWithSampleImages.sort((a, b) => b.imageCount - a.imageCount)

    return categoriesWithSampleImages
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
          },
        }),
      )

      // Sort by imageIds length and take top N
      const topCategories = allCategories
        .filter((cat) => cat.imageIds.length > 0)
        .sort((a, b) => b.imageIds.length - a.imageIds.length)
        .slice(0, limit)

      const categoryIds = topCategories.map((c) => c.id)
      const sampleImages = await tracker.trackQuery("findTopSampleImages", () =>
        db.generatedImage.findMany({
          where: {
            categoryIds: {
              hasSome: categoryIds,
            },
            status: "completed",
            imageUrl: {
              not: null,
            },
          },
          select: {
            id: true,
            imageUrl: true,
            categoryIds: true,
          },
        }),
      )

      const categoryImageMap = new Map<string, { id: string; imageUrl: string | null }>()
      for (const image of sampleImages) {
        for (const catId of image.categoryIds) {
          if (!categoryImageMap.has(catId)) {
            categoryImageMap.set(catId, {
              id: image.id,
              imageUrl: image.imageUrl,
            })
          }
        }
      }

      const categoriesWithSampleImages = topCategories.map((category) => ({
        id: category.id,
        name: category.name,
        keywords: category.keywords,
        imageCount: category.imageIds.length,
        sampleImage: categoryImageMap.get(category.id) || null,
      }))

      return categoriesWithSampleImages
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
          voteRatio: "positive",
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
