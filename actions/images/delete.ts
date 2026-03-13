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

  const isAdmin = (user as any).role === "ADMIN";

  logger.info(`[DELETE] user=${user.id} role=${(user as any).role} isAdmin=${isAdmin} imageId=${imageId}`);

  try {
    // First get the image to check ownership and get the CDN path
    // Admins can delete any image; regular users can only delete their own
    const image = await db.generatedImage.findFirst({
      where: isAdmin
        ? { id: imageId }
        : { id: imageId, userId: user.id },
    });

    logger.info(`[DELETE] found image: ${image ? image.id : "null"}`);

    if (!image) {
      return { error: "Image not found or unauthorized" };
    }

    // Delete from database (no $transaction — requires replica set which single-node MongoDB lacks)
    await db.generatedImage.delete({
      where: { id: imageId },
    });

    logger.info(`[DELETE] DB delete success for ${imageId}`);

    // Delete from BunnyCDN — best-effort, NEVER throw (404 = already gone, that's fine)
    if (image.path) {
      try {
        await deleteFile(image.path);
        logger.info(`[DELETE] CDN delete success for ${image.path}`);
      } catch (cdnErr) {
        logger.warn(`[DELETE] CDN delete failed (non-fatal): ${cdnErr}`);
        // CDN errors are non-fatal — file may already be deleted or path missing
      }
    }

    return { success: true };
  } catch (error: any) {
    logger.error(`[DELETE] FATAL error: ${String(error?.message ?? error)}`);
    return { error: String(error?.message ?? error) };
  }
}

// Optional: Batch delete function
export async function deleteMultipleImages(
  imageIds: string[]
): Promise<{ success: boolean; deletedCount: number } | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };

  const isAdmin = (user as any).role === "ADMIN";

  try {
    const images = await db.generatedImage.findMany({
      where: isAdmin
        ? { id: { in: imageIds } }
        : { id: { in: imageIds }, userId: user.id },
      select: { id: true, path: true },
    });

    if (images.length === 0) {
      return { error: "No valid images found" };
    }

    // Delete from database (no $transaction — requires replica set which single-node MongoDB lacks)
    await db.generatedImage.deleteMany({
      where: isAdmin
        ? { id: { in: imageIds } }
        : { id: { in: imageIds }, userId: user.id },
    });

    // Delete from CDN — best-effort, never throw
    await Promise.all(
      images
        .filter((img) => img.path)
        .map(async (img) => {
          try {
            if (!img.path) return;
            await deleteFile(img.path);
          } catch {
            // CDN errors are non-fatal
          }
        })
    );

    return { success: true, deletedCount: images.length };
  } catch (error: any) {
    logger.error("Error batch deleting images:", error);
    return { error: error.message };
  }
}
