"use server"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function assignCategoryAction(imageId: string, categoryId: string) {
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

        if (image.categoryIds.includes(categoryId)) {
            return {
                success: false,
                error: "Category already assigned",
            }
        }

        await db.generatedImage.update({
            where: { id: imageId },
            data: {
                categoryIds: {
                    push: categoryId,
                },
            },
        })

        revalidatePath("/admin/images")

        return {
            success: true,
        }
    } catch (error) {
        console.error("Error assigning category:", error)
        return {
            success: false,
            error: "Failed to assign category",
        }
    }
}
