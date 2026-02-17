"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import type { VoteType } from "@prisma/client"

export async function toggleVoteAction(imageId: string, userId: string, voteType: "UPVOTE" | "DOWNVOTE") {
    try {
        // Check if user already voted on the image
        const existingVote = await db.imageVote.findUnique({
            where: {
                userId_imageId: {
                    userId,
                    imageId,
                },
            },
        })

        let userVote: string | null = null
        const upvotes = 0
        const downvotes = 0
        const voteScore = 0

        if (existingVote) {
            if (existingVote.voteType === voteType) {
                // Remove vote (user clicked same vote type)
                await db.imageVote.delete({
                    where: {
                        id: existingVote.id,
                    },
                })

                // Update vote counts
                const updateData =
                    voteType === "UPVOTE"
                        ? { upvotes: { decrement: 1 }, voteScore: { decrement: 1 } }
                        : { downvotes: { decrement: 1 }, voteScore: { increment: 1 } }

                await db.generatedImage.update({
                    where: { id: imageId },
                    data: updateData,
                })

                userVote = null
            } else {
                // Update vote (user clicked opposite vote type)
                await db.imageVote.update({
                    where: {
                        id: existingVote.id,
                    },
                    data: {
                        voteType: voteType as VoteType,
                        updatedAt: new Date(),
                    },
                })

                // Update vote counts
                const updateData =
                    voteType === "UPVOTE"
                        ? {
                            upvotes: { increment: 1 },
                            downvotes: { decrement: 1 },
                            voteScore: { increment: 2 },
                        }
                        : {
                            upvotes: { decrement: 1 },
                            downvotes: { increment: 1 },
                            voteScore: { decrement: 2 },
                        }

                await db.generatedImage.update({
                    where: { id: imageId },
                    data: updateData,
                })

                userVote = voteType
            }
        } else {
            // Add new vote
            await db.imageVote.create({
                data: {
                    userId,
                    imageId,
                    voteType: voteType as VoteType,
                },
            })

            // Update vote counts
            const updateData =
                voteType === "UPVOTE"
                    ? { upvotes: { increment: 1 }, voteScore: { increment: 1 } }
                    : { downvotes: { increment: 1 }, voteScore: { decrement: 1 } }

            await db.generatedImage.update({
                where: { id: imageId },
                data: updateData,
            })

            userVote = voteType
        }

        // Get updated vote counts
        const updatedImage = await db.generatedImage.findUnique({
            where: { id: imageId },
            select: {
                upvotes: true,
                downvotes: true,
                voteScore: true,
            },
        })

        revalidatePath("/admin/images")

        return {
            success: true,
            data: {
                userVote,
                upvotes: updatedImage?.upvotes || 0,
                downvotes: updatedImage?.downvotes || 0,
                voteScore: updatedImage?.voteScore || 0,
            },
        }
    } catch (error) {
        console.error("Error toggling vote:", error)
        return {
            success: false,
            error: "Failed to toggle vote",
        }
    }
}
