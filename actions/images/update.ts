// actions/images/update.ts
"use server";

import { db } from "@/lib/db";
import { updateImageSchema } from "@/schemas/images";
import { currentUser } from "@/utils/auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

export async function updateImageInfo(
  imageId: string,
  data: z.infer<typeof updateImageSchema> & { categoryIds?: string[] }
) {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };

  // Validate the base schema fields
  const validatedFields = updateImageSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.toString() };
  }

  try {
    // First check if the image belongs to the user
    const existingImage = await db.generatedImage.findFirst({
      where: {
        id: imageId,
        userId: user.id,
      },
    });

    if (!existingImage) {
      return { error: "Image not found or unauthorized" };
    }

    // Validate categories if provided
    let validCategoryIds: string[] = [];
    if (data.categoryIds && data.categoryIds.length > 0) {
      // Check if all provided category IDs exist
      const existingCategories = await db.category.findMany({
        where: {
          id: { in: data.categoryIds }
        },
        select: { id: true }
      });

      validCategoryIds = existingCategories.map(cat => cat.id);

      // Check if any categories were invalid
      const invalidCategories = data.categoryIds.filter(
        id => !validCategoryIds.includes(id)
      );

      if (invalidCategories.length > 0) {
        return {
          error: `Invalid category IDs: ${invalidCategories.join(', ')}`
        };
      }
    }

    const updateData: Prisma.GeneratedImageUpdateInput = {
      ...(data.prompt && { prompt: data.prompt }),
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      ...(data.status && { status: data.status }),
      updatedAt: new Date(),
    };

    // Handle categories update
    if (data.categoryIds !== undefined) {
      // Use the new categoryIds array (can be empty to remove all categories)
      if (validCategoryIds.length > 0) {
        updateData.categories = {
          set: validCategoryIds.map(id => ({ id })),
        };
      } else {
        // Remove all categories if empty array is provided
        updateData.categories = {
          set: [],
        };
      }
    }

    const updatedImage = await db.generatedImage.update({
      where: { id: imageId },
      data: updateData,
      include: {
        categories: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return updatedImage;
  } catch (error: any) {
    logger.error("Error updating image:", error);
    return { error: error.message };
  }
}
export async function approveImage(id: string) {
  return updateImageInfo(id, { status: "completed" })
}

export async function rejectImage(id: string, reason?: string) {
  return updateImageInfo(id, { status: "rejected" })
}

export async function flagImage(id: string, reason?: string) {
  return updateImageInfo(id, { status: "flagged" })
}

export async function unflagImage(id: string) {
  return updateImageInfo(id, { status: "completed" })
}

export async function bulkApproveAction(ids: string[]) {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        success: false,
        error: "Invalid or empty ids array",
      }
    }

    const result = await db.generatedImage.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: "completed",
      },
    })

    revalidatePath("/admin/images")

    return {
      success: true,
      data: {
        updatedCount: result.count,
      },
    }
  } catch (error) {
    console.error("Error bulk approving images:", error)
    return {
      success: false,
      error: "Failed to approve images",
    }
  }
}

export async function bulkRejectAction(ids: string[], reason?: string) {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        success: false,
        error: "Invalid or empty ids array",
      }
    }

    // Log the bulk rejection
    logger.info(`Bulk rejecting ${ids.length} images${reason ? ` with reason: ${reason}` : ""}`)

    const result = await db.generatedImage.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: "rejected",
      },
    })

    revalidatePath("/admin/images")

    return {
      success: true,
      data: {
        updatedCount: result.count,
      },
    }
  } catch (error) {
    console.error("Error bulk rejecting images:", error)
    return {
      success: false,
      error: "Failed to reject images",
    }
  }
}
