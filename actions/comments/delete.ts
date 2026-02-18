"use server"

import { db } from "@/lib/db";
import { currentUser } from "@/utils/auth";

export async function deleteCommentAction(commentId: string,) {
    try {
        const user = await currentUser();
        if (!user) return { error: "Not authenticated" };


        const comment = await db.imageComment.delete({
            where: {
                id: commentId
            }
        });

        return comment;
    } catch (error: any) {
        return { error: error.message };
    }
}
