"use server"

import { currentUser } from "@/utils/auth"
import { getRemainingCredits } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

/**
 * Get current user's remaining free generation credits
 * Returns:
 * - Number: remaining credits for free tier users
 * - -1: unlimited (paid subscribers)
 * - null: error or not authenticated
 */
export async function getUserCredits(): Promise<{
  remainingCredits: number | null
  freeLimit: number
  hasSubscription: boolean
  error?: string
}> {
  try {
    const user = await currentUser()
    if (!user) {
      return {
        remainingCredits: null,
        freeLimit: 10,
        hasSubscription: false,
        error: "Not authenticated",
      }
    }

    const remaining = await getRemainingCredits(user.id)

    logger.debug("User credits fetched", {
      userId: user.id,
      remainingCredits: remaining,
    })

    return {
      remainingCredits: remaining,
      freeLimit: 10, // TODO: Make this configurable
      hasSubscription: remaining === -1,
    }
  } catch (error: any) {
    logger.error("Error fetching user credits", {
      error: error.message,
      stack: error.stack,
    })
    return {
      remainingCredits: null,
      freeLimit: 10,
      hasSubscription: false,
      error: error.message,
    }
  }
}

/**
 * Get rate limit information for current user
 */
export async function getRateLimitInfo(): Promise<{
  canGenerate: boolean
  resetIn?: number // seconds until next generation allowed
  error?: string
}> {
  try {
    const user = await currentUser()
    if (!user) {
      return {
        canGenerate: false,
        error: "Not authenticated",
      }
    }

    // Check if user needs to wait (last generation < 30 seconds ago)
    if (user.lastGenerationAt) {
      const secondsSinceLastGen = Math.floor(
        (Date.now() - user.lastGenerationAt.getTime()) / 1000
      )
      const RATE_LIMIT_SECONDS = 30

      if (secondsSinceLastGen < RATE_LIMIT_SECONDS) {
        return {
          canGenerate: false,
          resetIn: RATE_LIMIT_SECONDS - secondsSinceLastGen,
        }
      }
    }

    return {
      canGenerate: true,
    }
  } catch (error: any) {
    logger.error("Error checking rate limit", {
      error: error.message,
      stack: error.stack,
    })
    return {
      canGenerate: false,
      error: error.message,
    }
  }
}
