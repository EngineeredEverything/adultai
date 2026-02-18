/**
 * Rate Limiting & Abuse Prevention for Image Generation
 */

import { db } from "@/lib/db"

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  remainingCredits?: number
  resetIn?: number // seconds
}

export interface GenerationLimits {
  freeGenerationsLimit: number
  rateLimitSeconds: number // Minimum seconds between generations
  maxIPsPerUser: number // Max different IPs a user can generate from
  suspiciousIPThreshold: number // Flag IPs used by X+ different users
}

const DEFAULT_LIMITS: GenerationLimits = {
  freeGenerationsLimit: 10,
  rateLimitSeconds: 30, // 30 seconds between generations
  maxIPsPerUser: 3, // Max 3 different IPs
  suspiciousIPThreshold: 5, // Flag IPs used by 5+ users
}

/**
 * Check if user can generate an image
 */
export async function checkGenerationLimit(
  userId: string,
  clientIP: string,
  limits: GenerationLimits = DEFAULT_LIMITS
): Promise<RateLimitResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      freeGenerationsUsed: true,
      freeGenerationsLimit: true,
      lastGenerationAt: true,
      generationIPs: true,
      emailVerified: true,
      isBanned: true,
      isSuspended: true,
      subscription: {
        select: {
          status: true,
          plan: {
            select: {
              imagesPerDay: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    return { allowed: false, reason: "User not found" }
  }

  // Check if banned or suspended
  if (user.isBanned) {
    return { allowed: false, reason: "Account is banned" }
  }

  if (user.isSuspended) {
    return { allowed: false, reason: "Account is suspended" }
  }

  // Require email verification for free tier
  if (!user.emailVerified && !user.subscription) {
    return {
      allowed: false,
      reason: "Please verify your email before generating images",
    }
  }

  // Check if user has active paid subscription
  const hasActiveSub =
    user.subscription && user.subscription.status === "ACTIVE"

  // Paid users bypass free tier limits
  if (hasActiveSub) {
    // Still apply rate limiting
    if (user.lastGenerationAt) {
      const secondsSinceLastGen = Math.floor(
        (Date.now() - user.lastGenerationAt.getTime()) / 1000
      )
      if (secondsSinceLastGen < limits.rateLimitSeconds) {
        return {
          allowed: false,
          reason: "Please wait before generating another image",
          resetIn: limits.rateLimitSeconds - secondsSinceLastGen,
        }
      }
    }

    return { allowed: true }
  }

  // Free tier checks
  const remaining = user.freeGenerationsLimit - user.freeGenerationsUsed

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: "Free generation limit reached. Please upgrade to continue.",
      remainingCredits: 0,
    }
  }

  // Rate limiting - 30 seconds between generations
  if (user.lastGenerationAt) {
    const secondsSinceLastGen = Math.floor(
      (Date.now() - user.lastGenerationAt.getTime()) / 1000
    )
    if (secondsSinceLastGen < limits.rateLimitSeconds) {
      return {
        allowed: false,
        reason: `Please wait ${limits.rateLimitSeconds - secondsSinceLastGen} seconds before generating another image`,
        resetIn: limits.rateLimitSeconds - secondsSinceLastGen,
        remainingCredits: remaining,
      }
    }
  }

  // IP abuse detection
  const userIPs = user.generationIPs || []
  if (!userIPs.includes(clientIP)) {
    // New IP for this user
    if (userIPs.length >= limits.maxIPsPerUser) {
      // Too many different IPs - suspicious
      return {
        allowed: false,
        reason:
          "Suspicious activity detected. Please contact support if this is an error.",
      }
    }
  }

  // Check if IP is suspicious (used by many different users)
  const ipUserCount = await db.user.count({
    where: {
      generationIPs: {
        has: clientIP,
      },
    },
  })

  if (ipUserCount >= limits.suspiciousIPThreshold) {
    return {
      allowed: false,
      reason:
        "This IP has been flagged for suspicious activity. Please contact support.",
    }
  }

  // All checks passed
  return {
    allowed: true,
    remainingCredits: remaining,
  }
}

/**
 * Record a generation (decrement free credits, update timestamp, track IP)
 */
export async function recordGeneration(
  userId: string,
  clientIP: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      generationIPs: true,
      subscription: {
        select: { status: true },
      },
    },
  })

  if (!user) return

  const hasActiveSub =
    user.subscription && user.subscription.status === "ACTIVE"

  // Update user record
  const updates: any = {
    lastGenerationAt: new Date(),
  }

  // Only decrement free credits for free tier users
  if (!hasActiveSub) {
    updates.freeGenerationsUsed = { increment: 1 }
  }

  // Track IP if not already in list
  const userIPs = user.generationIPs || []
  if (!userIPs.includes(clientIP)) {
    updates.generationIPs = {
      push: clientIP,
    }
  }

  await db.user.update({
    where: { id: userId },
    data: updates,
  })

  // Also update usage record if it exists
  await db.usageRecord.upsert({
    where: { userId },
    create: {
      userId,
      nutsUsed: 0,
      imagesGenerated: 1,
      dailyImageCount: 1,
      lastImageDate: new Date(),
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    update: {
      imagesGenerated: { increment: 1 },
      dailyImageCount: { increment: 1 },
      lastImageDate: new Date(),
    },
  })
}

/**
 * Get user's remaining free credits
 */
export async function getRemainingCredits(
  userId: string
): Promise<number | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      freeGenerationsUsed: true,
      freeGenerationsLimit: true,
      subscription: {
        select: { status: true },
      },
    },
  })

  if (!user) return null

  // Paid users have unlimited
  const hasActiveSub =
    user.subscription && user.subscription.status === "ACTIVE"
  if (hasActiveSub) return -1 // -1 means unlimited

  return Math.max(0, user.freeGenerationsLimit - user.freeGenerationsUsed)
}
