"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { logger } from "@/lib/logger"
import type { VoteType } from "@prisma/client"

export async function createVote(imageId: string, voteType: "UPVOTE" | "DOWNVOTE") {
    try {
        const user = await currentUser()
        if (!user) {
            logger.debug("Vote attempt failed: User not authenticated")
            return { error: "Not authenticated" }
        }

        logger.debug("Starting vote operation", {
            userId: user.id,
            imageId,
            voteType
        })

        // Start a transaction
        const result = await db.$transaction(async (tx) => {
            // First, get the current image state to check for null values
            const currentImage = await tx.generatedImage.findUnique({
                where: { id: imageId },
                select: { upvotes: true, downvotes: true, voteScore: true }
            })

            if (!currentImage) {
                logger.debug("Image not found", { imageId })
                throw new Error("Image not found")
            }

            // Ensure vote counts are not null (set to 0 if they are)
            const safeUpvotes = currentImage.upvotes ?? 0
            const safeDownvotes = currentImage.downvotes ?? 0
            const safeVoteScore = currentImage.voteScore ?? 0

            logger.debug("Current image vote state", {
                imageId,
                upvotes: safeUpvotes,
                downvotes: safeDownvotes,
                voteScore: safeVoteScore,
                originalUpvotes: currentImage.upvotes,
                originalDownvotes: currentImage.downvotes,
                originalVoteScore: currentImage.voteScore
            })

            // Update null values to 0 if needed
            if (currentImage.upvotes === null || currentImage.downvotes === null || currentImage.voteScore === null) {
                logger.debug("Fixing null vote values", { imageId })
                await tx.generatedImage.update({
                    where: { id: imageId },
                    data: {
                        upvotes: safeUpvotes,
                        downvotes: safeDownvotes,
                        voteScore: safeVoteScore
                    }
                })
            }

            // Check if the user has already voted on this image
            const existingVote = await tx.imageVote.findUnique({
                where: {
                    userId_imageId: {
                        userId: user.id,
                        imageId: imageId,
                    },
                },
            })

            logger.debug("Existing vote check", {
                imageId,
                userId: user.id,
                existingVote: existingVote ? {
                    voteType: existingVote.voteType,
                    createdAt: existingVote.createdAt
                } : null
            })

            if (existingVote) {
                if (existingVote.voteType === voteType) {
                    // User clicked the same vote type, so remove the vote
                    logger.debug("Removing existing vote (same type clicked)", {
                        imageId,
                        userId: user.id,
                        voteType
                    })

                    await tx.imageVote.delete({
                        where: {
                            userId_imageId: {
                                userId: user.id,
                                imageId: imageId,
                            },
                        },
                    })

                    // Update vote counts
                    const updateData =
                        voteType === "UPVOTE"
                            ? {
                                upvotes: Math.max(0, safeUpvotes - 1),
                                voteScore: safeVoteScore - 1
                            }
                            : {
                                downvotes: Math.max(0, safeDownvotes - 1),
                                voteScore: safeVoteScore + 1
                            }

                    logger.debug("Vote removal update data", {
                        imageId,
                        updateData,
                        beforeUpdate: { upvotes: safeUpvotes, downvotes: safeDownvotes, voteScore: safeVoteScore }
                    })

                    const updatedImage = await tx.generatedImage.update({
                        where: { id: imageId },
                        data: updateData,
                    })

                    logger.debug("Vote removed successfully", {
                        imageId,
                        newUpvotes: updatedImage.upvotes,
                        newDownvotes: updatedImage.downvotes,
                        newVoteScore: updatedImage.voteScore
                    })

                    return {
                        ...updatedImage,
                        userVote: null,
                    }
                } else {
                    // User clicked opposite vote type, so update the vote
                    logger.debug("Updating vote to opposite type", {
                        imageId,
                        userId: user.id,
                        oldVoteType: existingVote.voteType,
                        newVoteType: voteType
                    })

                    await tx.imageVote.update({
                        where: {
                            userId_imageId: {
                                userId: user.id,
                                imageId: imageId,
                            },
                        },
                        data: {
                            voteType: voteType as VoteType,
                            updatedAt: new Date(),
                        },
                    })

                    // Update vote counts (remove old vote and add new vote)
                    const updateData =
                        voteType === "UPVOTE"
                            ? {
                                upvotes: safeUpvotes + 1,
                                downvotes: Math.max(0, safeDownvotes - 1),
                                voteScore: safeVoteScore + 2, // +1 for upvote, +1 for removing downvote
                            }
                            : {
                                upvotes: Math.max(0, safeUpvotes - 1),
                                downvotes: safeDownvotes + 1,
                                voteScore: safeVoteScore - 2, // -1 for downvote, -1 for removing upvote
                            }

                    logger.debug("Vote switch update data", {
                        imageId,
                        updateData,
                        beforeUpdate: { upvotes: safeUpvotes, downvotes: safeDownvotes, voteScore: safeVoteScore }
                    })

                    const updatedImage = await tx.generatedImage.update({
                        where: { id: imageId },
                        data: updateData,
                    })

                    logger.debug("Vote switched successfully", {
                        imageId,
                        newUpvotes: updatedImage.upvotes,
                        newDownvotes: updatedImage.downvotes,
                        newVoteScore: updatedImage.voteScore
                    })

                    return {
                        ...updatedImage,
                        userVote: voteType,
                    }
                }
            } else {
                // User hasn't voted, so add a new vote
                logger.debug("Creating new vote", {
                    imageId,
                    userId: user.id,
                    voteType
                })

                await tx.imageVote.create({
                    data: {
                        userId: user.id,
                        imageId: imageId,
                        voteType: voteType as VoteType,
                    },
                })

                // Update vote counts
                const updateData =
                    voteType === "UPVOTE"
                        ? {
                            upvotes: safeUpvotes + 1,
                            voteScore: safeVoteScore + 1
                        }
                        : {
                            downvotes: safeDownvotes + 1,
                            voteScore: safeVoteScore - 1
                        }

                logger.debug("New vote update data", {
                    imageId,
                    updateData,
                    beforeUpdate: { upvotes: safeUpvotes, downvotes: safeDownvotes, voteScore: safeVoteScore }
                })

                const updatedImage = await tx.generatedImage.update({
                    where: { id: imageId },
                    data: updateData,
                })

                logger.debug("New vote created successfully", {
                    imageId,
                    newUpvotes: updatedImage.upvotes,
                    newDownvotes: updatedImage.downvotes,
                    newVoteScore: updatedImage.voteScore
                })

                return {
                    ...updatedImage,
                    userVote: voteType,
                }
            }
        })

        logger.debug("Vote operation completed successfully", {
            imageId,
            userId: user.id,
            finalResult: {
                upvotes: result.upvotes,
                downvotes: result.downvotes,
                voteScore: result.voteScore,
                userVote: result.userVote
            }
        })

        return result
    } catch (error: any) {
        logger.error("Error creating/updating vote:", {
            error: error.message,
            stack: error.stack,
            imageId,
            voteType,
            userId: await currentUser().then(u => u?.id).catch(() => 'unknown')
        })
        return { error: error.message }
    }
}
