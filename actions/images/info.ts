"use server"

import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import type { z } from "zod"
import { currentUser, type User } from "@/utils/auth"
import { generateLinksBatch } from "@/lib/cdn"
import { logger } from "@/lib/logger"
import { getImageProvider } from "./provider"
import type { ImageFilters } from "@/app/admin/_components/image-management/hooks/use-image-management"
import { type getImageInfoSchema, type getRelatedImagesSchema, searchImagesSchema } from "@/schemas/images"
import { checkImageStatusSchema } from "@/schemas/images"
import { buildVoteFilters, getImagesVotesInfoCORE } from "../votes/info"
import { getImagesCommentsInfoCORE } from "../comments/info"
import { findMatchingCategories } from "../category/info"
import { type PerformanceTracker, trackPerformance } from "@/lib/performance"

const provider = getImageProvider("CUSTOM")

export const getImagesInfoRAW = async (
  query: { imageId: string }[],
  data: z.infer<typeof getImageInfoSchema>["data"],
) => {
  return trackPerformance(
    "getImagesInfoRAW",
    async (tracker) => {
      logger.debug("Getting images info (optimized)", {
        imageCount: query.length,
        includeComments: !!data.comments,
        includeVotes: !!data.votes,
        includeCategories: !!data.categories,
      })

      const imageIds = query.map((q) => q.imageId)

      const images = await tracker.trackQuery("findManyImages", () =>
        db.generatedImage.findMany({
          where: { id: { in: imageIds } },
          include: { user: { select: { name: true, id: true } } },
        }),
      )

      if (!images.length) throw new Error("No images found")

      const [commentsInfo, votesInfo, categoriesMap] = await Promise.all([
        data.comments ? getImagesCommentsInfoCORE(query, data.comments, tracker) : Promise.resolve([]),
        data.votes ? getImagesVotesInfoCORE(query, data.votes, tracker) : Promise.resolve([]),
        data.categories
          ? tracker.trackQuery("findManyCategories", async () => {
            // MongoDB uses array fields, not junction tables
            // Find all unique category IDs from the images
            const categoryIdsSet = new Set<string>()
            for (const image of images) {
              if (image.categoryIds && Array.isArray(image.categoryIds)) {
                image.categoryIds.forEach((id) => categoryIdsSet.add(id))
              }
            }

            const categoryIds = Array.from(categoryIdsSet)

            if (categoryIds.length === 0) {
              return {}
            }

            // Fetch all categories in one query
            const categories = await db.category.findMany({
              where: { id: { in: categoryIds } },
              select: {
                id: true,
                name: true,
                keywords: true,
              },
            })

            // Build category map for quick lookup
            const categoryMap = new Map(categories.map((c) => [c.id, c]))

            // Group categories by image ID
            const map: { [key: string]: { id: string; name: string; keywords: string[] }[] } = {}
            for (const image of images) {
              if (image.categoryIds && Array.isArray(image.categoryIds)) {
                map[image.id] = image.categoryIds
                  .map((catId) => categoryMap.get(catId))
                  .filter((cat): cat is { id: string; name: string; keywords: string[] } => cat !== undefined)
              }
            }

            return map
          })
          : Promise.resolve({} as { [key: string]: { id: string; name: string; keywords: string[] }[] }),
      ])

      const cdnLinks = generateLinksBatch(images.map((img) => ({ id: img.id, path: img.path || "" })))

      const cdnMap = new Map(cdnLinks.map((l) => [l.id, l.link]))
      const commentMap = new Map(commentsInfo.map((c) => [c.imageId, c]))
      const voteMap = new Map(votesInfo.map((v) => [v.imageId, v]))

      const imagesInfo = images.map((image) => ({
        image: {
          ...image,
          cdnUrl: cdnMap.get(image.id),
        },
        comments: commentMap.get(image.id),
        votes: voteMap.get(image.id),
        categories: data.categories ? categoriesMap[image.id] || [] : undefined,
      }))

      return imagesInfo
    },
    { imageCount: query.length },
  )
}

export const searchImagesInfoRAW = async (
  query: z.infer<typeof searchImagesSchema>["query"],
  filters: z.infer<typeof searchImagesSchema>["filters"],
  data: z.infer<typeof searchImagesSchema>["data"],
) => {
  return trackPerformance(
    "searchImagesInfoRAW",
    async (tracker) => {
      const searchTerm = query?.trim() || ""

      logger.info("Searching images", {
        searchTerm: searchTerm.substring(0, 50),
        filters,
        hasIds: !!data.ids?.length,
        limit: data.limit,
      })

      if (!searchTerm) {
        logger.debug("No search term provided, using filtered results")
        return await getFilteredImages(filters, data, tracker)
      }

      const matchingCategories = await tracker.trackQuery("findMatchingCategories", () =>
        findMatchingCategories(searchTerm),
      )
      const categoryIds = matchingCategories.map((cat) => cat.id)

      logger.debug("Found matching categories", {
        categoryCount: matchingCategories.length,
        categoryIds,
      })

      const searchQuery = await buildWeightedSearchQuery(searchTerm, categoryIds, filters, data, tracker)

      const [images, count] = await Promise.all([
        tracker.trackQuery("executeRankedSearch", () => executeRankedSearch(searchQuery, data)),
        data.count
          ? tracker.trackQuery("countImages", () => db.generatedImage.count({ where: searchQuery.where }))
          : Promise.resolve(undefined),
      ])

      if (!images || images.length === 0) {
        logger.warn("No images found for search", { searchTerm, filters })
        throw new Error("No images found")
      }

      const imagesInfo = await getImagesInfoRAW(
        images.map((image) => ({ imageId: image.id })),
        data.images,
      )

      return { images: imagesInfo, count }
    },
    { searchTerm: query?.substring(0, 50) },
  )
}

async function buildWeightedSearchQuery(
  searchTerm: string,
  categoryIds: string[],
  filters: z.infer<typeof searchImagesSchema>["filters"],
  data: z.infer<typeof searchImagesSchema>["data"],
  tracker?: PerformanceTracker,
) {
  logger.debug("Building weighted search query with vote filters", {
    searchTerm: searchTerm.substring(0, 50),
    categoryCount: categoryIds.length,
    filters,
  })

  const baseFilter = filters?.private
    ? {
      userId: filters.userId,
      status: { in: ["completed", "processing"] },
    }
    : {
      AND: [
        ...(filters?.isPublic !== undefined ? [{ isPublic: filters.isPublic }] : []),
        filters?.userId
          ? {
            OR: [{ status: "completed" }, { AND: [{ status: "processing" }, { userId: filters.userId }] }],
          }
          : { status: "completed" },
      ],
    }

  const additionalFilters = {
    ...(filters?.category_id && {
      categories: {
        some: { id: filters.category_id },
      },
    }),
    ...(data.ids?.length && {
      id: { in: data.ids },
    }),
  }

  const voteFilters = await buildVoteFilters(filters)

  const searchConditions = {
    OR: [
      {
        prompt: {
          contains: searchTerm,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      ...(categoryIds.length > 0
        ? [
          {
            categories: {
              some: {
                id: { in: categoryIds },
              },
            },
          },
        ]
        : []),
    ],
  }

  return {
    where: {
      ...baseFilter,
      ...additionalFilters,
      ...searchConditions,
      ...(voteFilters.length > 0 && { AND: voteFilters }),
    },
  }
}

async function executeRankedSearch(
  searchQuery: Awaited<ReturnType<typeof buildWeightedSearchQuery>>,
  data: z.infer<typeof searchImagesSchema>["data"],
) {
  logger.debug("Executing ranked search", {
    limit: data.limit,
    skip: data.limit?.start,
  })

  const images = await db.generatedImage.findMany({
    where: searchQuery.where,
    skip: data.limit?.start,
    take: data.limit ? data.limit.end - data.limit.start : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  })

  return images
}

async function getFilteredImages(
  filters: z.infer<typeof searchImagesSchema>["filters"],
  data: z.infer<typeof searchImagesSchema>["data"],
  tracker?: PerformanceTracker,
) {
  logger.debug("Getting filtered images with vote filters", { filters, limit: data.limit })

  // Use categoryIds array field for filtering instead of categories relation
  const categoryFilter: Prisma.GeneratedImageWhereInput = filters?.category_id
    ? {
        categoryIds: {
          has: filters.category_id,
        },
      }
    : {}

  const voteFilters = await buildVoteFilters(filters)

  const searchQuery: Prisma.GeneratedImageWhereInput = filters?.private
    ? {
      userId: filters.userId,
      status: filters.status ? { in: [filters.status] } : { in: ["completed", "processing"] },
      ...(data.ids?.length
        ? {
          id: { in: data.ids },
        }
        : {}),
      ...categoryFilter,
      ...(voteFilters.length > 0 && { AND: voteFilters }),
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
        ...voteFilters,
      ],
      ...(data.ids?.length
        ? {
          id: { in: data.ids },
        }
        : {}),
      ...categoryFilter,
    }
  logger.debug("searchQuery", searchQuery)

  const [count, images] = await Promise.all([
    data.count
      ? tracker
        ? tracker.trackQuery("countFilteredImages", () => db.generatedImage.count({ where: searchQuery }))
        : db.generatedImage.count({ where: searchQuery })
      : Promise.resolve(undefined),
    tracker
      ? tracker.trackQuery("findFilteredImages", () =>
        db.generatedImage.findMany({
          where: searchQuery,
          skip: data.limit?.start,
          take: data.limit ? data.limit.end - data.limit.start : undefined,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      )
      : db.generatedImage.findMany({
        where: searchQuery,
        skip: data.limit?.start,
        take: data.limit ? data.limit.end - data.limit.start : undefined,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
  ])

  if (!images || images.length === 0) {
    logger.warn("No images found with filters", { filters })
    throw new Error("No images found")
  }

  const imagesInfo = await getImagesInfoRAW(
    images.map((image) => ({ imageId: image.id })),
    data.images,
  )

  logger.info("Filtered images retrieved with vote filters", {
    resultCount: imagesInfo.length,
    totalCount: count,
  })

  return { images: imagesInfo, count }
}

export const getImageInfo = async (imageId: string, data: z.infer<typeof getImageInfoSchema>["data"]) => {
  logger.debug("Getting single image info", { imageId })

  try {
    const imageInfo = await getImagesInfoRAW([{ imageId }], data)
    return imageInfo[0]
  } catch (error: any) {
    logger.error("Error getting image info", {
      imageId,
      error: error.message,
      stack: error.stack,
    })
    return { error: error.message }
  }
}

export const searchImages = async (data: z.infer<typeof searchImagesSchema>) => {
  const validatedFields = searchImagesSchema.safeParse(data)
  if (!validatedFields.success) {
    logger.warn("Invalid search images data", { errors: validatedFields.error.issues })
    return { error: validatedFields.error.toString() }
  }

  try {
    return await searchImagesInfoRAW(
      validatedFields.data.query,
      validatedFields.data.filters,
      validatedFields.data.data,
    )
  } catch (error: any) {
    logger.error("Error searching images", {
      error: error.message,
      stack: error.stack,
      query: validatedFields.data.query,
      filters: validatedFields.data.filters,
    })
    return { error: error.message }
  }
}

export const checkImageStatus = async (data: z.infer<typeof checkImageStatusSchema>) => {
  const user = await currentUser()
  if (!user) {
    logger.warn("Check image status attempted without authentication")
    return { error: "Not authenticated" }
  }

  try {
    const result = await checkImageStatusRaw({
      user,
      data,
    })

    return result
  } catch (error: any) {
    logger.error("Unexpected error checking image status", {
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

export const checkImageStatusRaw = async ({
  user,
  data,
}: {
  user: User
  data: z.infer<typeof checkImageStatusSchema>
}) => {
  return trackPerformance(
    "checkImageStatusRaw",
    async (tracker) => {
      const validatedFields = checkImageStatusSchema.safeParse(data)
      if (!validatedFields.success) {
        logger.warn("Invalid check image status data", {
          userId: user.id,
          errors: validatedFields.error.issues,
        })
        return {
          error: validatedFields.error.issues.map((err) => `${err.path.join(".")}:${err.message}`).join(", "),
        }
      }

      logger.info("Checking image status", {
        userId: user.id,
        taskId: validatedFields.data.taskId,
      })

      try {
        const pendingImages = await tracker.trackQuery("findPendingImages", () =>
          db.generatedImage.findMany({
            where: {
              taskId: validatedFields.data.taskId,
              userId: user.id,
              status: { in: ["processing", "queued"] },
            },
            select: {
              id: true,
            },
          }),
        )

        if (pendingImages.length === 0) {
          const completedImages = await tracker.trackQuery("findCompletedImages", () =>
            db.generatedImage.findMany({
              where: {
                taskId: validatedFields.data.taskId,
                userId: user.id,
                status: "completed",
              },
            }),
          )

          if (completedImages.length > 0) {
            logger.info("Found completed images for task", {
              userId: user.id,
              taskId: validatedFields.data.taskId,
              imageCount: completedImages.length,
            })
            return {
              status: "completed",
              progress: 100,
              images: completedImages,
            }
          }

          logger.warn("No images found for task", {
            userId: user.id,
            taskId: validatedFields.data.taskId,
          })
          return { error: "No images found with this task ID" }
        }

        logger.debug("Found pending images", {
          userId: user.id,
          taskId: validatedFields.data.taskId,
          imageCount: pendingImages.length,
        })

        const response = await provider.fetchWithRetry(provider.fetchUrl + validatedFields.data.taskId, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })

        const apiData = await response.json()

        logger.debug("Provider status response", {
          taskId: validatedFields.data.taskId,
          status: apiData.status,
          progress: apiData.progress,
          outputCount: apiData.output?.length || 0,
          eta: apiData.eta,
        })

        let progress = 0
        if (apiData.progress !== undefined) {
          progress = Math.min(Math.max(apiData.progress, 0), 100)
        } else {
          switch (apiData.status) {
            case "queued":
              progress = 5
              break
            case "processing":
              progress = 50
              break
            case "success":
              progress = 100
              break
            case "failed":
              progress = 0
              break
            default:
              progress = 10
          }
        }

        if (apiData.status === "success" && apiData.output && apiData.output.length > 0) {
          logger.info("Images ready, updating database", {
            taskId: validatedFields.data.taskId,
            outputCount: apiData.output.length,
            progress: 100,
          })

          const updatePromises = pendingImages.map(async (pendingImage, index) => {
            const imageUrl = index < apiData.output.length ? apiData.output[index] : null

            if (!imageUrl) {
              logger.warn("No image URL for pending image", {
                imageId: pendingImage.id,
                index,
              })
              return tracker.trackQuery(`updateFailedImage-${index}`, () =>
                db.generatedImage.update({
                  where: { id: pendingImage.id },
                  data: {
                    status: "failed",
                    progress: 0,
                    updatedAt: new Date(),
                  },
                }),
              )
            }

            logger.debug("Uploading image to CDN", {
              imageId: pendingImage.id,
              imageUrl: imageUrl.substring(0, 50) + "...",
            })

            try {
              const { path, cdnUrl } = await provider.uploadToCDNWithRetry(imageUrl, 3)

              return tracker.trackQuery(`updateCompletedImage-${index}`, () =>
                db.generatedImage.update({
                  where: { id: pendingImage.id },
                  data: {
                    status: "completed",
                    imageUrl: cdnUrl,
                    path: path,
                    progress: 100,
                    verified: new Date(),
                    updatedAt: new Date(),
                  },
                }),
              )
            } catch (uploadError) {
              logger.error("Failed to upload image to CDN", {
                imageId: pendingImage.id,
                error: uploadError,
              })

              return tracker.trackQuery(`updateFailedUploadImage-${index}`, () =>
                db.generatedImage.update({
                  where: { id: pendingImage.id },
                  data: {
                    status: "failed",
                    progress: 0,
                    updatedAt: new Date(),
                  },
                }),
              )
            }
          })

          const updatedImages = await Promise.allSettled(updatePromises)

          const finalImages = await tracker.trackQuery("findFinalImages", () =>
            db.generatedImage.findMany({
              where: {
                taskId: validatedFields.data.taskId,
                userId: user.id,
              },
            }),
          )

          const successfulUpdates = updatedImages.filter((result) => result.status === "fulfilled").length

          logger.info("Images updated successfully", {
            taskId: validatedFields.data.taskId,
            totalImages: updatedImages.length,
            successfulUpdates,
            finalImageCount: finalImages.length,
          })

          return {
            status: "completed",
            progress: 100,
            images: finalImages,
            eta: null,
          }
        } else if (apiData.status === "processing" || apiData.status === "queued") {
          logger.debug("Images still processing", {
            taskId: validatedFields.data.taskId,
            progress,
            eta: apiData.eta,
            status: apiData.status,
          })

          const updateData: any = {
            status: apiData.status === "queued" ? "queued" : "processing",
            progress,
            updatedAt: new Date(),
          }

          if (apiData.eta) {
            updateData.eta = apiData.eta
          }

          await tracker.trackQuery("updateProcessingImages", () =>
            db.generatedImage.updateMany({
              where: {
                taskId: validatedFields.data.taskId,
                userId: user.id,
              },
              data: updateData,
            }),
          )

          const updatedImages = await tracker.trackQuery("findUpdatedImages", () =>
            db.generatedImage.findMany({
              where: {
                taskId: validatedFields.data.taskId,
                userId: user.id,
              },
            }),
          )

          return {
            status: apiData.status === "queued" ? "queued" : "processing",
            progress,
            eta: apiData.eta,
            images: updatedImages,
            message: apiData.status === "queued" ? "Your request is in queue" : "Generating images...",
          }
        } else {
          logger.error("Image generation failed", {
            taskId: validatedFields.data.taskId,
            status: apiData.status,
            message: apiData.message || apiData.messege,
            progress: 0,
          })

          await tracker.trackQuery("updateFailedImages", () =>
            db.generatedImage.updateMany({
              where: {
                taskId: validatedFields.data.taskId,
                userId: user.id,
              },
              data: {
                status: "failed",
                progress: 0,
                updatedAt: new Date(),
              },
            }),
          )

          return {
            status: "failed",
            progress: 0,
            error: apiData.message || apiData.messege || "Failed to generate images",
            images: pendingImages,
          }
        }
      } catch (error: any) {
        logger.error("Error checking image status", {
          userId: user.id,
          taskId: validatedFields.data.taskId,
          error: error.message,
          stack: error.stack,
        })

        try {
          await tracker.trackQuery("updateErrorImages", () =>
            db.generatedImage.updateMany({
              where: {
                taskId: validatedFields.data.taskId,
                userId: user.id,
              },
              data: {
                status: "failed",
                progress: 0,
                updatedAt: new Date(),
              },
            }),
          )
        } catch (dbError: any) {
          logger.error("Failed to update database after error", {
            taskId: validatedFields.data.taskId,
            dbError: dbError.message,
          })
        }

        return {
          error: error.message,
          status: "failed",
          progress: 0,
        }
      }
    },
    { userId: user.id, taskId: data.taskId },
  )
}

export const getRelatedImages = async (props: z.infer<typeof getRelatedImagesSchema>) => {
  return trackPerformance(
    "getRelatedImages",
    async (tracker) => {
      const { imageId, limit = 10, data } = props

      logger.debug("Getting related images", { imageId, limit })

      const currentImage = await tracker.trackQuery("findCurrentImage", () =>
        db.generatedImage.findUnique({
          where: { id: imageId },
        }),
      )

      if (!currentImage) {
        logger.error("Current image not found", { imageId })
        throw new Error("Image not found")
      }

      logger.debug("Found current image", {
        imageId,
        prompt: currentImage.prompt?.substring(0, 50),
        categoryCount: currentImage.categoryIds.length,
      })

      const relatedImageIds: string[] = []

      const categoryIds = currentImage.categoryIds

      const [samePromptImages, sameCategoryImages, fallbackImages] = await Promise.all([
        currentImage.prompt
          ? tracker.trackQuery("findSamePromptImages", () =>
            db.generatedImage.findMany({
              where: {
                prompt: currentImage.prompt,
                id: { not: imageId },
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
          ? tracker.trackQuery("findSameCategoryImages", () =>
            db.generatedImage.findMany({
              where: {
                categoryIds: {
                  hasSome: categoryIds,
                },
                id: { not: imageId },
                status: "completed",
                isPublic: true,
              },
              select: { id: true },
              take: limit,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            }),
          )
          : Promise.resolve([]),
        tracker.trackQuery("findFallbackImages", () =>
          db.generatedImage.findMany({
            where: {
              id: { not: imageId },
              status: "completed",
              isPublic: true,
            },
            select: { id: true },
            take: limit,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          }),
        ),
      ])

      const seenIds = new Set<string>()

      for (const img of samePromptImages) {
        if (relatedImageIds.length >= limit) break
        if (!seenIds.has(img.id)) {
          relatedImageIds.push(img.id)
          seenIds.add(img.id)
        }
      }

      for (const img of sameCategoryImages) {
        if (relatedImageIds.length >= limit) break
        if (!seenIds.has(img.id)) {
          relatedImageIds.push(img.id)
          seenIds.add(img.id)
        }
      }

      for (const img of fallbackImages) {
        if (relatedImageIds.length >= limit) break
        if (!seenIds.has(img.id)) {
          relatedImageIds.push(img.id)
          seenIds.add(img.id)
        }
      }

      if (relatedImageIds.length === 0) {
        logger.warn("No related images found", { imageId })
        return { images: [], count: 0 }
      }

      const relatedImagesInfo = await getImagesInfoRAW(
        relatedImageIds.map((id) => ({ imageId: id })),
        data || {},
      )

      logger.info("Related images retrieved successfully", {
        imageId,
        totalFound: relatedImagesInfo.length,
        limit,
      })

      return {
        images: relatedImagesInfo,
        count: relatedImagesInfo.length,
        currentImage: {
          id: currentImage.id,
          prompt: currentImage.prompt,
          categoryIds: currentImage.categoryIds,
        },
      }
    },
    { imageId: props.imageId, limit: props.limit },
  )
}

export async function exportImagesAction(filters: ImageFilters, format: "csv" | "json") {
  try {
    const { search = "", status, categoryId, isPublic, userId } = filters

    const where: any = {}

    if (search) {
      where.OR = [
        { prompt: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { id: { contains: search } },
      ]
    }

    if (status) where.status = status
    if (categoryId) where.categoryIds = { has: categoryId }
    if (isPublic !== undefined) where.isPublic = isPublic
    if (userId) where.userId = userId

    const images = await db.generatedImage.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    if (format === "csv") {
      const csvHeaders = [
        "ID",
        "User Name",
        "User Email",
        "Prompt",
        "Status",
        "Is Public",
        "Created At",
        "Categories",
      ].join(",")

      const csvRows = images.map((image) =>
        [
          image.id,
          `"${image.user.name || ""}"`,
          `"${image.user.email || ""}"`,
          `"${image.prompt.replace(/"/g, '""')}"`,
          image.status,
          image.isPublic,
          image.createdAt.toISOString(),
          `"${(image.categoryIds || []).join(", ")}"`,
        ].join(","),
      )

      const csvContent = [csvHeaders, ...csvRows].join("\n")

      return {
        success: true,
        data: {
          content: csvContent,
          filename: `images-export-${new Date().toISOString().split("T")[0]}.csv`,
          contentType: "text/csv",
        },
      }
    } else {
      return {
        success: true,
        data: {
          content: JSON.stringify(images, null, 2),
          filename: `images-export-${new Date().toISOString().split("T")[0]}.json`,
          contentType: "application/json",
        },
      }
    }
  } catch (error) {
    console.error("Error exporting images:", error)
    return {
      success: false,
      error: "Failed to export images",
    }
  }
}

export async function getImageStatsAction() {
  try {
    const [
      totalImages,
      completedImages,
      processingImages,
      failedImages,
      flaggedImages,
      rejectedImages,
      publicImages,
      privateImages,
      totalComments,
    ] = await Promise.all([
      db.generatedImage.count(),
      db.generatedImage.count({ where: { status: "completed" } }),
      db.generatedImage.count({ where: { status: "processing" } }),
      db.generatedImage.count({ where: { status: "failed" } }),
      db.generatedImage.count({ where: { status: "flagged" } }),
      db.generatedImage.count({ where: { status: "rejected" } }),
      db.generatedImage.count({ where: { isPublic: true } }),
      db.generatedImage.count({ where: { isPublic: false } }),
      db.imageComment.count(),
    ])

    const stats = {
      totalImages,
      statusBreakdown: {
        completed: completedImages,
        processing: processingImages,
        failed: failedImages,
        flagged: flaggedImages,
        rejected: rejectedImages,
      },
      visibilityBreakdown: {
        public: publicImages,
        private: privateImages,
      },
      engagement: {
        totalComments,
        averageCommentsPerImage: totalImages > 0 ? (totalComments / totalImages).toFixed(2) : 0,
      },
    }

    return {
      success: true,
      data: stats,
    }
  } catch (error) {
    console.error("Error fetching image stats:", error)
    return {
      success: false,
      error: "Failed to fetch stats",
    }
  }
}
