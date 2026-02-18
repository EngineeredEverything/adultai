import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { getOrCreateUsageRecord } from "./info"
import { getUserActivePlan } from "../subscriptions/info"

/**
 * Check and update usage for the user, enforcing plan limits.
 */
export async function checkAndUpdateUsage(userId: string, imagesToGenerate: number, nutsToUse: number) {
  logger.debug("Checking and updating usage", { userId, imagesToGenerate, nutsToUse })

  const { plan } = await getUserActivePlan(userId)
  if (!plan) {
    logger.error("No plan found for user", { userId })
    throw new Error("No plan found for user")
  }

  const usage = await getOrCreateUsageRecord(userId, plan)

  // Check monthly nuts
  if (plan.nutsPerMonth !== -1 && usage.nutsUsed + nutsToUse > plan.nutsPerMonth) {
    logger.warn("Monthly nuts limit exceeded", {
      userId,
      nutsUsed: usage.nutsUsed,
      nutsToUse,
      monthlyLimit: plan.nutsPerMonth,
    })
    throw new Error(`Monthly nuts limit exceeded. Remaining: ${plan.nutsPerMonth - usage.nutsUsed}`)
  }
  // Hided becuase feature is to be removed
  // Check daily image limit
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // if (plan.imagesPerDay !== -1) {
  //   if (usage.lastImageDate && usage.lastImageDate >= today) {
  //     if (usage.dailyImageCount + imagesToGenerate > plan.imagesPerDay) {
  //       logger.warn("Daily image limit exceeded", {
  //         userId,
  //         dailyImageCount: usage.dailyImageCount,
  //         imagesToGenerate,
  //         dailyLimit: plan.imagesPerDay,
  //       })
  //       throw new Error(`Daily image limit exceeded. Remaining: ${plan.imagesPerDay - usage.dailyImageCount}`)
  //     }
  //   } else if (imagesToGenerate > plan.imagesPerDay) {
  //     logger.warn("Daily image limit exceeded for new day", {
  //       userId,
  //       imagesToGenerate,
  //       dailyLimit: plan.imagesPerDay,
  //     })
  //     throw new Error(`Daily image limit exceeded. Remaining: ${plan.imagesPerDay}`)
  //   }
  // }

  // Check per-generation limit
  if (imagesToGenerate > plan.imagesPerGeneration) {
    logger.warn("Per-generation limit exceeded", {
      userId,
      imagesToGenerate,
      generationLimit: plan.imagesPerGeneration,
    })
    throw new Error(`Per-generation limit exceeded. Max: ${plan.imagesPerGeneration}`)
  }

  // Update usage record
  let newDailyImageCount = usage.dailyImageCount
  let newLastImageDate = usage.lastImageDate
  if (usage.lastImageDate && usage.lastImageDate >= today) {
    newDailyImageCount += imagesToGenerate
  } else {
    newDailyImageCount = imagesToGenerate
    newLastImageDate = new Date()
  }

  await db.usageRecord.update({
    where: { userId },
    data: {
      nutsUsed: { increment: nutsToUse },
      imagesGenerated: { increment: imagesToGenerate },
      dailyImageCount: newDailyImageCount,
      lastImageDate: newLastImageDate,
    },
  })

  logger.info("Usage updated successfully", {
    userId,
    newNutsUsed: usage.nutsUsed + nutsToUse,
    newImagesGenerated: usage.imagesGenerated + imagesToGenerate,
    newDailyImageCount,
  })

  return {
    plan,
    usage: {
      nutsUsed: usage.nutsUsed + nutsToUse,
      imagesGenerated: usage.imagesGenerated + imagesToGenerate,
      dailyImageCount: newDailyImageCount,
    },
  }
}