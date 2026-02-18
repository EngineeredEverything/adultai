"use client"

import { useState, useEffect, useCallback } from "react"
import { createVote } from "@/actions/votes/create"
import { getUserVote, getImageVoteStats } from "@/actions/votes/info"
import { logger } from "@/lib/logger"
import { toast } from "sonner"
import type { GetCurrentUserInfoSuccessType } from "@/types/user"

export interface VoteStats {
    upvotes: number
    downvotes: number
    voteScore: number
    totalVotes: number
    upvotePercentage: number
}

export interface UseImageVotesReturn {
    userVote: "UPVOTE" | "DOWNVOTE" | null
    voteStats: VoteStats
    isLoading: boolean
    handleUpvote: () => Promise<void>
    handleDownvote: () => Promise<void>
    refreshVotes: () => Promise<void>
}

export function useImageVotes(
    imageId: string | null,
    user: GetCurrentUserInfoSuccessType | undefined,
    initialVotes?: {
        upvotes?: number
        downvotes?: number
        voteScore?: number
        userVote?: "UPVOTE" | "DOWNVOTE" | null
    },
): UseImageVotesReturn {
    const [userVote, setUserVote] = useState<"UPVOTE" | "DOWNVOTE" | null>(initialVotes?.userVote || null)
    const [voteStats, setVoteStats] = useState<VoteStats>({
        upvotes: initialVotes?.upvotes || 0,
        downvotes: initialVotes?.downvotes || 0,
        voteScore: initialVotes?.voteScore || 0,
        totalVotes: (initialVotes?.upvotes || 0) + (initialVotes?.downvotes || 0),
        upvotePercentage: 0,
    })
    const [isLoading, setIsLoading] = useState(false)

    // Calculate upvote percentage
    useEffect(() => {
        const total = voteStats.upvotes + voteStats.downvotes
        const percentage = total > 0 ? (voteStats.upvotes / total) * 100 : 0
        setVoteStats((prev) => ({
            ...prev,
            totalVotes: total,
            upvotePercentage: Math.round(percentage),
        }))
    }, [voteStats.upvotes, voteStats.downvotes])

    // Fetch initial vote data
    const refreshVotes = useCallback(async () => {
        if (!imageId || !user) return

        try {
            setIsLoading(true)

            // Get user's vote status
            const userVoteResponse = await getUserVote(imageId)
            if (!("error" in userVoteResponse)) {
                setUserVote(userVoteResponse.userVote)
            }

            // Get vote statistics
            const statsResponse = await getImageVoteStats(imageId)
            if (!("error" in statsResponse)) {
                setVoteStats({
                    upvotes: statsResponse.upvotes,
                    downvotes: statsResponse.downvotes,
                    voteScore: statsResponse.voteScore,
                    totalVotes: statsResponse.totalVotes,
                    upvotePercentage: statsResponse.upvotePercentage,
                })
            }
        } catch (error) {
            logger.error("Error fetching vote data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [imageId, user])

    // Initialize vote data when component mounts or imageId changes
    useEffect(() => {
        if (imageId && user) {
            refreshVotes()
        } else {
            // Reset state when no image or user
            setUserVote(null)
            setVoteStats({
                upvotes: 0,
                downvotes: 0,
                voteScore: 0,
                totalVotes: 0,
                upvotePercentage: 0,
            })
        }
    }, [imageId, user, refreshVotes])

    const handleVote = async (voteType: "UPVOTE" | "DOWNVOTE") => {
        if (!user || !imageId || isLoading) return

        const previousUserVote = userVote
        const previousStats = { ...voteStats }

        try {
            // Optimistic update
            if (userVote === voteType) {
                // Remove vote
                setUserVote(null)
                if (voteType === "UPVOTE") {
                    setVoteStats((prev) => ({
                        ...prev,
                        upvotes: Math.max(0, prev.upvotes - 1),
                        voteScore: prev.voteScore - 1,
                    }))
                } else {
                    setVoteStats((prev) => ({
                        ...prev,
                        downvotes: Math.max(0, prev.downvotes - 1),
                        voteScore: prev.voteScore + 1,
                    }))
                }
            } else if (userVote && userVote !== voteType) {
                // Switch vote
                setUserVote(voteType)
                if (voteType === "UPVOTE") {
                    setVoteStats((prev) => ({
                        ...prev,
                        upvotes: prev.upvotes + 1,
                        downvotes: Math.max(0, prev.downvotes - 1),
                        voteScore: prev.voteScore + 2,
                    }))
                } else {
                    setVoteStats((prev) => ({
                        ...prev,
                        upvotes: Math.max(0, prev.upvotes - 1),
                        downvotes: prev.downvotes + 1,
                        voteScore: prev.voteScore - 2,
                    }))
                }
            } else {
                // Add new vote
                setUserVote(voteType)
                if (voteType === "UPVOTE") {
                    setVoteStats((prev) => ({
                        ...prev,
                        upvotes: prev.upvotes + 1,
                        voteScore: prev.voteScore + 1,
                    }))
                } else {
                    setVoteStats((prev) => ({
                        ...prev,
                        downvotes: prev.downvotes + 1,
                        voteScore: prev.voteScore - 1,
                    }))
                }
            }

            // Make API call
            const response = await createVote(imageId, voteType)
            if ("error" in response) {
                throw new Error(response.error)
            }

            // Update with actual response data
            setUserVote(response.userVote)
            setVoteStats({
                upvotes: response.upvotes || 0,
                downvotes: response.downvotes || 0,
                voteScore: response.voteScore || 0,
                totalVotes: (response.upvotes || 0) + (response.downvotes || 0),
                upvotePercentage: 0, // Will be calculated in useEffect
            })
        } catch (error) {
            // Revert optimistic update on error
            setUserVote(previousUserVote)
            setVoteStats(previousStats)

            logger.error("Error updating vote:", error)
            toast.error("Error", {
                description: "Failed to update vote",
            })
        }
    }

    const handleUpvote = useCallback(() => handleVote("UPVOTE"), [imageId, user])
    const handleDownvote = useCallback(() => handleVote("DOWNVOTE"), [imageId, user])

    return {
        userVote,
        voteStats,
        isLoading,
        handleUpvote,
        handleDownvote,
        refreshVotes,
    }
}
