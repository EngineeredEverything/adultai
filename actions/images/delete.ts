"use server";

import { deleteFile } from "@/lib/cdn";
import { db } from "@/lib/db";
import { currentUser } from "@/utils/auth";
import { logger } from "@/lib/logger";

export async function deleteImageAction(
  imageId: string
): Promise<{ success: boolean } | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };

  try {
    // First get the image to check ownership and get the CDN path
    const image = await db.generatedImage.findFirst({
      where: {
        id: imageId,
        userId: user.id,
      },
    });

    if (!image) {
      return { error: "Image not found or unauthorized" };
    }

    // Start a transaction to ensure both operations succeed or fail together
    await db.$transaction(async (tx) => {
      // Delete from database
      await tx.generatedImage.delete({
        where: { id: imageId },
      });

      // If there's a CDN URL, delete from BunnyCDN
      if (image.path) {
        try {
          // Extract path from CDN URL and delete from storage
          await deleteFile(image.path);
        } catch (error) {
          logger.error("Error deleting from CDN:", error);
          // Continue with deletion even if CDN deletion fails
        }
      }

      // Optionally refund some nuts to the user
      // await tx.user.update({
      //   where: { id: user.id },
      //   data: { nuts: { increment: image.costNuts } },
      // });
    });

    return { success: true };
  } catch (error: any) {
    logger.error("Error deleting image:", error);
    return { error: error.message };
  }
}

// Optional: Batch delete function
export async function deleteMultipleImages(
  imageIds: string[]
): Promise<{ success: boolean; deletedCount: number } | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const images = await db.generatedImage.findMany({
      where: {
        id: { in: imageIds },
        userId: user.id,
      },
      select: { id: true, path: true },
    });

    if (images.length === 0) {
      return { error: "No valid images found" };
    }

    await db.$transaction(async (tx) => {
      // Delete all images from database
      await tx.generatedImage.deleteMany({
        where: {
          id: { in: imageIds },
          userId: user.id,
        },
      });

      // Delete from CDN
      await Promise.all(
        images
          .filter((img) => img.path)
          .map(async (img) => {
            try {
              if (!img.path) return { success: false };
              await deleteFile(img.path);
            } catch (error) {
              logger.error(`Error deleting from CDN: ${img.path}`, error);
            }
          })
      );
    });

    return { success: true, deletedCount: images.length };
  } catch (error: any) {
    logger.error("Error batch deleting images:", error);
    return { error: error.message };
  }
}
