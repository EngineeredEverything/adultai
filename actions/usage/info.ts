import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * Get or create a usage record for the current period.
 */
export async function getOrCreateUsageRecord(userId: string, plan: any) {
  logger.debug("Getting or creating usage record", { userId, planName: plan?.name })

  const now = new Date()
  // Assume monthly period, can be adjusted for other billing cycles
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  let usage = await db.usageRecord.findUnique({ where: { userId } })

  if (!usage || usage.periodStart.getTime() !== periodStart.getTime()) {
    logger.info("Creating or resetting usage record for new period", {
      userId,
      periodStart,
      periodEnd,
    })

    // Create or reset usage record for new period
    usage = await db.usageRecord.upsert({
      where: { userId },
      update: {
        nutsUsed: 0,
        imagesGenerated: 0,
        dailyImageCount: 0,
        lastImageDate: null,
        periodStart,
        periodEnd,
      },
      create: {
        userId,
        nutsUsed: 0,
        imagesGenerated: 0,
        dailyImageCount: 0,
        lastImageDate: null,
        periodStart,
        periodEnd,
      },
    })
  }

  return usage
}