"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"


export async function removeCategoryAction(imageId: string, categoryId: string) {
    try {
        const image = await db.generatedImage.findUnique({
            where: { id: imageId },
            select: { categoryIds: true },
        })

        if (!image) {
            return {
                success: false,
                error: "Image not found",
            }
        }

        const updatedCategoryIds = image.categoryIds.filter((id) => id !== categoryId)

        await db.generatedImage.update({
            where: { id: imageId },
            data: {
                categoryIds: updatedCategoryIds,
            },
        })

        revalidatePath("/admin/images")

        return {
            success: true,
        }
    } catch (error) {
        console.error("Error removing category:", error)
        return {
            success: false,
            error: "Failed to remove category",
        }
    }
}