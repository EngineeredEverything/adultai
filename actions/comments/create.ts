"use server";
import { db } from "@/lib/db";
import { currentUser } from "@/utils/auth";

export async function createComment(imageId: string, text: string) {
  try {
    const user = await currentUser();
    if (!user) return { error: "Not authenticated" };
    if (!text?.trim()) {
      return { error: "Comment cannot be empty" };
    }

    const comment = await db.imageComment.create({
      data: {
        userId: user.id,
        imageId: imageId,
        comment: text.trim(),
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    return comment;
  } catch (error: any) {
    return { error: error.message };
  }
}
