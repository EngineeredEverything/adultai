"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"

export async function deleteVote(imageId: string) {
    try {
        const user = await currentUser()
        if (!user) return { error: "Not authenticated" }

        // Start a transaction
        const result = await db.$transaction(async (tx) => {
            // Get the existing vote to know which type to decrement
            const existingVote = await tx.imageVote.findUnique({
                where: {
                    userId_imageId: {
                        userId: user.id,
                        imageId: imageId,
                    },
                },
            })

            if (!existingVote) {
                throw new Error("Vote not found")
            }

            // Delete vote
            await tx.imageVote.delete({
                where: {
                    userId_imageId: {
                        userId: user.id,
                        imageId: imageId,
                    },
                },
            })

            // Update vote counts based on the deleted vote type
            const updateData =
                existingVote.voteType === "UPVOTE"
                    ? { upvotes: { decrement: 1 }, voteScore: { decrement: 1 } }
                    : { downvotes: { decrement: 1 }, voteScore: { increment: 1 } }

            return await tx.generatedImage.update({
                where: { id: imageId },
                data: updateData,
            })
        })

        return result
    } catch (error: any) {
        return { error: error.message }
    }
}

export async function deleteAllUserVotes(userId: string) {
    try {
        const user = await currentUser()
        if (!user || user.role !== "ADMIN") {
            return { error: "Not authorized" }
        }

        // Get all votes by the user to update image counts
        const userVotes = await db.imageVote.findMany({
            where: { userId },
            include: { image: true },
        })

        // Start a transaction to delete votes and update counts
        const result = await db.$transaction(async (tx) => {
            // Delete all votes by the user
            await tx.imageVote.deleteMany({
                where: { userId },
            })

            // Update vote counts for each affected image
            const imageUpdates = userVotes.reduce(
                (acc, vote) => {
                    if (!acc[vote.imageId]) {
                        acc[vote.imageId] = { upvotes: 0, downvotes: 0 }
                    }

                    if (vote.voteType === "UPVOTE") {
                        acc[vote.imageId].upvotes -= 1
                    } else {
                        acc[vote.imageId].downvotes -= 1
                    }

                    return acc
                },
                {} as Record<string, { upvotes: number; downvotes: number }>,
            )

            // Apply updates to each image
            const updatePromises = Object.entries(imageUpdates).map(([imageId, counts]) =>
                tx.generatedImage.update({
                    where: { id: imageId },
                    data: {
                        upvotes: { increment: counts.upvotes },
                        downvotes: { increment: counts.downvotes },
                        voteScore: { increment: counts.upvotes - counts.downvotes },
                    },
                }),
            )

            await Promise.all(updatePromises)

            return { deletedCount: userVotes.length }
        })

        return result
    } catch (error: any) {
        return { error: error.message }
    }
}
