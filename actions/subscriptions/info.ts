"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { z } from "zod"
import { SubscriptionStatus } from "@prisma/client"
import { getSubscriptionInfoSchema } from "@/schemas/shared-schemas"
import { logger } from "@/lib/logger"

export const getSubscriptionInfo = async (data: Partial<z.infer<typeof getSubscriptionInfoSchema>> = {}) => {
    const user = await currentUser()
    if (!user) {
        logger.warn("Get subscription info attempted without authentication")
        return { error: "Not authenticated" }
    }

    logger.info("Get subscription info request", { userId: user.id, data })

    const validatedFields = getSubscriptionInfoSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid subscription info data", {
            userId: user.id,
            errors: validatedFields.error.issues,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { userId, includeHistory, includeUsage } = validatedFields.data

    try {
        // Determine target user (admin can view other users' subscriptions)
        const targetUserId = userId && user.role === "ADMIN" ? userId : user.id
        logger.debug("Target user determined", { targetUserId, isAdmin: user.role === "ADMIN" })

        // Get user with subscription details
        const userData = await db.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                name: true,
                email: true,
                nuts: true,
                imagesPerDay: true,
                imagesPerGeneration: true,
                features: true,
                lastImageReset: true,
                isSuspended: true,
                isBanned: true,
                suspensionExpiresAt: true,
                suspensionReason: true,
                banReason: true,
                subscription: {
                    include: {
                        plan: {
                            include: {
                                planFeatures: {
                                    include: {
                                        planFeature: true,
                                    },
                                },
                            },
                        },
                    },
                },
                usageRecord: includeUsage,
                subscriptionHistory: includeHistory
                    ? {
                        orderBy: { createdAt: "desc" },
                        take: 10,
                    }
                    : false,
            },
        })

        if (!userData) {
            logger.error("User not found for subscription info", { targetUserId })
            return { error: "User not found" }
        }

        const now = new Date()
        let needsUserUpdate = false
        const userUpdates: any = {}

        // Check if suspension has expired and auto-clear it
        if (userData.isSuspended && userData.suspensionExpiresAt && userData.suspensionExpiresAt <= now) {
            logger.info("Auto-clearing expired suspension", {
                targetUserId,
                suspensionExpiresAt: userData.suspensionExpiresAt,
            })

            userUpdates.isSuspended = false
            userUpdates.suspensionExpiresAt = null
            userUpdates.suspensionReason = null

            // Update local object for immediate use
            userData.isSuspended = false
            userData.suspensionExpiresAt = null
            userData.suspensionReason = null
            needsUserUpdate = true
        }

        // Improved daily image reset logic - handles timezone issues better
        const isNewDay = !userData.lastImageReset ||
            userData.lastImageReset.toDateString() !== now.toDateString()

        if (isNewDay) {
            logger.debug("Resetting daily image count for new day", {
                targetUserId,
                lastReset: userData.lastImageReset,
                currentDate: now.toDateString()
            })

            userUpdates.imagesPerDay = 0
            userUpdates.lastImageReset = now

            // Update local object for immediate use
            userData.imagesPerDay = 0
            userData.lastImageReset = now
            needsUserUpdate = true
        }

        // Perform user updates if needed
        if (needsUserUpdate) {
            await db.user.update({
                where: { id: targetUserId },
                data: userUpdates,
            })
        }

        // Process subscription info
        let subscriptionInfo = null
        let planInfo = null
        let subscriptionNeedsUpdate = false

        if (userData.subscription) {
            const subscription = userData.subscription
            const plan = subscription.plan

            // Check if subscription is still active
            const isActive =
                subscription.status === SubscriptionStatus.ACTIVE &&
                (!subscription.endDate || subscription.endDate > now)

            // If subscription expired, update status
            if (!isActive && subscription.status === SubscriptionStatus.ACTIVE) {
                logger.info("Updating expired subscription status", {
                    subscriptionId: subscription.id,
                    targetUserId,
                    endDate: subscription.endDate,
                })

                // Update in database
                await db.subscription.update({
                    where: { id: subscription.id },
                    data: { status: SubscriptionStatus.EXPIRED },
                })

                // Update local object
                subscription.status = SubscriptionStatus.EXPIRED
            }

            // Calculate days until renewal/expiration with better precision
            const daysUntilRenewal = subscription.endDate
                ? Math.ceil((subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : null

            subscriptionInfo = {
                id: subscription.id,
                status: subscription.status,
                billingCycle: subscription.billingCycle,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
                nextBillingDate: subscription.nextBillingDate,
                isActive,
                daysUntilRenewal,
                createdAt: subscription.createdAt,
                updatedAt: subscription.updatedAt,
            }

            planInfo = {
                id: plan.id,
                name: plan.name,
                description: plan.description,
                nutsPerMonth: plan.nutsPerMonth,
                imagesPerDay: plan.imagesPerDay,
                imagesPerGeneration: plan.imagesPerGeneration,
                monthlyPrice: plan.monthlyPrice / 100,
                yearlyPrice: (plan?.yearlyPrice || 0) / 100,
                features: plan.planFeatures.map((pf) => ({
                    id: pf.planFeature.id,
                    name: pf.planFeature.name,
                    description: pf.planFeature.description,
                    isEnabled: pf.planFeature.isEnabled,
                })),
            }

            logger.debug("Subscription info processed", {
                subscriptionId: subscription.id,
                planName: plan.name,
                isActive,
                daysUntilRenewal,
            })
        }

        // Get current plan info (fallback to free plan if no subscription)
        if (!planInfo) {
            logger.debug("No active subscription found, getting free plan info")
            const freePlan = await db.plan.findFirst({
                where: { name: "Free" },
                include: {
                    planFeatures: {
                        include: {
                            planFeature: true,
                        },
                    },
                },
            })

            if (!freePlan) {
                logger.error("Free plan not found in database")
                return { error: "Free plan configuration missing" }
            }

            planInfo = {
                id: freePlan.id,
                name: freePlan.name,
                description: freePlan.description,
                nutsPerMonth: freePlan.nutsPerMonth,
                imagesPerDay: freePlan.imagesPerDay,
                imagesPerGeneration: freePlan.imagesPerGeneration,
                monthlyPrice: freePlan.monthlyPrice / 100,
                yearlyPrice: (freePlan.yearlyPrice || 0) / 100,
                features: freePlan.planFeatures.map((pf) => ({
                    id: pf.planFeature.id,
                    name: pf.planFeature.name,
                    description: pf.planFeature.description,
                    isEnabled: pf.planFeature.isEnabled,
                })),
            }
            logger.debug("Free plan info retrieved", { planId: freePlan.id })
        }

        // Replace the usage info calculation section with this corrected logic

        // Process usage info with better error handling and correct data source
        if (!planInfo) {
            logger.error("No plan info available")
            return { error: "Plan configuration error" }
        }

        logger.debug("Plan limits debug", {
            targetUserId,
            planName: planInfo.name,
            planNutsPerMonth: planInfo.nutsPerMonth,
            planImagesPerDay: planInfo.imagesPerDay,
        })

        const dailyLimit = planInfo.imagesPerDay === -1 ? Number.POSITIVE_INFINITY : planInfo.imagesPerDay
        const nutsLimit = planInfo.nutsPerMonth === -1 ? Number.POSITIVE_INFINITY : planInfo.nutsPerMonth

        // Calculate usage from usageRecord if available, otherwise use user table fallback
        let currentNutsUsed = 0
        let currentImagesGenerated = 0
        let currentDailyImageCount = userData.imagesPerDay || 0 // Keep daily count from user table for daily reset logic

        if (userData.usageRecord) {
            currentNutsUsed = userData.usageRecord.nutsUsed
            currentImagesGenerated = userData.usageRecord.imagesGenerated

            // For daily images, we need to check if the lastImageDate is from today
            const today = new Date()
            const lastImageDate = userData.usageRecord.lastImageDate

            if (lastImageDate && lastImageDate.toDateString() === today.toDateString()) {
                // Use the daily count from usage record if last image was today
                currentDailyImageCount = userData.usageRecord.dailyImageCount
            } else {
                // Reset daily count if no images today or no last image date
                currentDailyImageCount = 0
            }

            logger.debug("Usage from usageRecord", {
                targetUserId,
                nutsUsed: currentNutsUsed,
                imagesGenerated: currentImagesGenerated,
                dailyImageCount: currentDailyImageCount,
                lastImageDate: lastImageDate?.toISOString(),
                periodStart: userData.usageRecord.periodStart.toISOString(),
                periodEnd: userData.usageRecord.periodEnd.toISOString()
            })
        } else {
            logger.debug("No usageRecord found, using user table data as fallback", {
                targetUserId,
                userNuts: userData.nuts,
                userImagesPerDay: userData.imagesPerDay
            })

            // Fallback to user table data if no usage record
            // Note: userData.nuts represents remaining nuts, not used nuts
            // So we calculate used nuts as: limit - remaining
            if (nutsLimit !== Number.POSITIVE_INFINITY) {
                currentNutsUsed = Math.max(0, nutsLimit - userData.nuts)
            }
        }

        // Calculate remaining amounts
        const remainingNuts = nutsLimit === Number.POSITIVE_INFINITY ?
            Number.POSITIVE_INFINITY :
            Math.max(0, nutsLimit - currentNutsUsed)

        const remainingDailyImages = dailyLimit === Number.POSITIVE_INFINITY ?
            Number.POSITIVE_INFINITY :
            Math.max(0, dailyLimit - currentDailyImageCount)

        // Calculate percentages (what percentage of the limit has been used)
        const nutsPercentage = nutsLimit === Number.POSITIVE_INFINITY ? 0 :
            Math.min(100, Math.max(0, (currentNutsUsed / nutsLimit) * 100))

        const dailyPercentage = dailyLimit === Number.POSITIVE_INFINITY ? 0 :
            Math.min(100, Math.max(0, (currentDailyImageCount / dailyLimit) * 100))

        logger.debug("Limits calculated", {
            targetUserId,
            dailyLimit,
            nutsLimit,
            currentNutsUsed,
            currentDailyImageCount,
            remainingNuts,
            remainingDailyImages
        })

        const usageInfo = {
            // Current usage amounts
            nutsUsed: currentNutsUsed,
            imagesGenerated: currentImagesGenerated,
            dailyImageCount: currentDailyImageCount,

            // Limits
            nutsLimit,
            dailyLimit,
            imagesPerGeneration: userData.imagesPerGeneration,

            // Remaining amounts
            remainingNuts,
            remainingDailyImages,

            // Percentages (how much of limit has been used)
            nutsPercentage,
            dailyPercentage,

            // Additional info
            lastImageReset: userData.lastImageReset,
            usageRecordPeriod: userData.usageRecord ? {
                start: userData.usageRecord.periodStart,
                end: userData.usageRecord.periodEnd,
                lastImageDate: userData.usageRecord.lastImageDate
            } : null
        }

        logger.debug("Usage info calculated", {
            targetUserId,
            nutsUsed: usageInfo.nutsUsed,
            remainingNuts: usageInfo.remainingNuts === Number.POSITIVE_INFINITY ? "unlimited" : usageInfo.remainingNuts,
            dailyImageCount: usageInfo.dailyImageCount,
            remainingDailyImages: usageInfo.remainingDailyImages === Number.POSITIVE_INFINITY ? "unlimited" : usageInfo.remainingDailyImages,
            nutsPercentage: usageInfo.nutsPercentage,
            dailyPercentage: usageInfo.dailyPercentage
        })
        // User status info with clearer logic
        const userStatus = {
            isSuspended: userData.isSuspended,
            isBanned: userData.isBanned,
            suspensionExpiresAt: userData.suspensionExpiresAt,
            suspensionReason: userData.suspensionReason,
            banReason: userData.banReason,
            canGenerateImages:
                !userData.isBanned &&
                !userData.isSuspended &&
                (usageInfo.remainingNuts > 0 || usageInfo.remainingNuts === Number.POSITIVE_INFINITY) &&
                (usageInfo.remainingDailyImages > 0 || usageInfo.remainingDailyImages === Number.POSITIVE_INFINITY),
        }

        logger.info("Subscription info retrieved successfully", {
            targetUserId,
            planName: planInfo.name,
            canGenerateImages: userStatus.canGenerateImages,
            remainingNuts: usageInfo.remainingNuts === Number.POSITIVE_INFINITY ? "unlimited" : usageInfo.remainingNuts,
            remainingDailyImages: usageInfo.remainingDailyImages === Number.POSITIVE_INFINITY ? "unlimited" : usageInfo.remainingDailyImages,
        })

        return {
            user: {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                role: user.role,
                features: userData.features,
            },
            subscription: subscriptionInfo,
            plan: planInfo,
            usage: usageInfo,
            status: userStatus,
            history: userData.subscriptionHistory || [],
            usageRecord: userData.usageRecord || null,
        }
    } catch (error: any) {
        logger.error("Get subscription info error", {
            userId: user.id,
            targetUserId: data.userId,
            error: error.message,
            stack: error.stack,
        })
        return { error: error.message || "Failed to get subscription info" }
    }
}

// Get available plans for subscription
export const getAvailablePlans = async () => {
    const user = await currentUser()
    if (!user) {
        logger.warn("Get available plans attempted without authentication")
        return { error: "Not authenticated" }
    }

    logger.info("Get available plans request", { userId: user.id })

    try {
        const plans = await db.plan.findMany({
            where: { isActive: true },
            include: {
                planFeatures: {
                    include: {
                        planFeature: true,
                    },
                },
            },
            orderBy: { monthlyPrice: "asc" },
        })

        // Get current user subscription to mark current plan
        const currentUserData = await db.user.findUnique({
            where: { id: user.id },
            select: {
                subscription: {
                    select: {
                        planId: true,
                        status: true,
                    },
                },
            },
        })

        const processedPlans = plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            nutsPerMonth: plan.nutsPerMonth,
            imagesPerDay: plan.imagesPerDay,
            imagesPerGeneration: plan.imagesPerGeneration,
            monthlyPrice: plan.monthlyPrice / 100,
            yearlyPrice: plan.yearlyPrice / 100,
            features: plan.planFeatures
                .filter((pf) => pf.planFeature.isEnabled)
                .map((pf) => ({
                    id: pf.planFeature.id,
                    name: pf.planFeature.name,
                    description: pf.planFeature.description,
                })),
            isRecommended: plan.name.toLowerCase().includes("pro"), // Example logic
        }))

        logger.info("Available plans retrieved", {
            userId: user.id,
            planCount: processedPlans.length,
            currentPlanId: currentUserData?.subscription?.planId,
        })

        return {
            plans: processedPlans,
            currentPlanId: currentUserData?.subscription?.planId || null,
        }
    } catch (error: any) {
        logger.error("Get available plans error", {
            userId: user.id,
            error: error.message,
            stack: error.stack,
        })
        return { error: error.message || "Failed to get available plans" }
    }
}

// Get plan info by planId (with zod validation)
const getPlanInfoSchema = z.object({
    planId: z.string().min(1, "Plan ID is required"),
})

export const getPlanInfo = async (data: z.infer<typeof getPlanInfoSchema>) => {
    const user = await currentUser()
    if (!user) {
        logger.warn("Get plan info attempted without authentication")
        return { error: "Not authenticated" }
    }

    logger.info("Get plan info request", { userId: user.id, data })

    const validatedFields = getPlanInfoSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid get plan info data", {
            userId: user.id,
            errors: validatedFields.error.issues,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { planId } = validatedFields.data

    try {
        const plan = await db.plan.findUnique({
            where: { id: planId },
            include: {
                planFeatures: {
                    include: {
                        planFeature: true,
                    },
                },
            },
        })

        if (!plan) {
            logger.error("Plan not found", { planId })
            return { error: "Plan not found" }
        }

        const planInfo = {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            nutsPerMonth: plan.nutsPerMonth,
            imagesPerDay: plan.imagesPerDay,
            imagesPerGeneration: plan.imagesPerGeneration,
            monthlyPrice: plan.monthlyPrice / 100,
            yearlyPrice: plan.yearlyPrice / 100,
            features: plan.planFeatures.map((pf) => ({
                id: pf.planFeature.id,
                name: pf.planFeature.name,
                description: pf.planFeature.description,
                isEnabled: pf.planFeature.isEnabled,
            })),
        }

        logger.info("Plan info retrieved", { planId: plan.id, planName: plan.name })

        return { plan: planInfo }
    } catch (error: any) {
        logger.error("Get plan info error", {
            userId: user.id,
            planId,
            error: error.message,
            stack: error.stack,
        })
        return { error: error.message || "Failed to get plan info" }
    }
}


// Get subscription analytics (admin only)
const getSubscriptionAnalyticsSchema = z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    planId: z.string().optional(),
})

export const getSubscriptionAnalytics = async (data: z.infer<typeof getSubscriptionAnalyticsSchema> = {}) => {
    const user = await currentUser()
    if (!user || user.role !== "ADMIN") {
        logger.warn("Unauthorized subscription analytics attempt", { userId: user?.id })
        return { error: "Not authorized. Admin access required." }
    }

    logger.info("Get subscription analytics request", { userId: user.id, data })

    const validatedFields = getSubscriptionAnalyticsSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid subscription analytics data", {
            userId: user.id,
            errors: validatedFields.error.issues,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { startDate, endDate, planId } = validatedFields.data

    try {
        // Build where clause
        const where: any = {}
        if (startDate) where.createdAt = { gte: startDate }
        if (endDate) where.createdAt = { ...where.createdAt, lte: endDate }
        if (planId) where.planId = planId

        logger.debug("Analytics query parameters", { where })

        // Get subscription counts by status
        const statusCounts = await db.subscription.groupBy({
            by: ["status"],
            where,
            _count: { status: true },
        })

        // Get subscription counts by plan
        const planCounts = await db.subscription.groupBy({
            by: ["planId"],
            where,
            _count: { planId: true },
        })

        // Get subscription counts by billing cycle
        const billingCycleCounts = await db.subscription.groupBy({
            by: ["billingCycle"],
            where,
            _count: { billingCycle: true },
        })

        // Get monthly subscription trends
        const monthlyTrends = await db.subscription.findMany({
            where,
            select: {
                createdAt: true,
                status: true,
                billingCycle: true,
            },
            orderBy: { createdAt: "asc" },
        })

        // Process monthly trends
        const trendsByMonth: Record<string, any> = {}
        monthlyTrends.forEach((sub) => {
            const monthKey = `${sub.createdAt.getFullYear()}-${(sub.createdAt.getMonth() + 1).toString().padStart(2, "0")}`
            if (!trendsByMonth[monthKey]) {
                trendsByMonth[monthKey] = {
                    month: monthKey,
                    total: 0,
                    active: 0,
                    cancelled: 0,
                    expired: 0,
                    monthly: 0,
                    yearly: 0,
                }
            }
            trendsByMonth[monthKey].total++
            trendsByMonth[monthKey][sub.status.toLowerCase()]++
            trendsByMonth[monthKey][sub.billingCycle.toLowerCase()]++
        })

        // Get total revenue (this would need payment integration)
        const totalSubscriptions = await db.subscription.count({ where })
        const activeSubscriptions = await db.subscription.count({
            where: { ...where, status: SubscriptionStatus.ACTIVE },
        })

        // Get churn rate (cancelled in last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const recentCancellations = await db.subscription.count({
            where: {
                status: SubscriptionStatus.CANCELLED,
                updatedAt: { gte: thirtyDaysAgo },
            },
        })

        const churnRate = activeSubscriptions > 0 ? (recentCancellations / activeSubscriptions) * 100 : 0

        logger.info("Subscription analytics retrieved", {
            userId: user.id,
            totalSubscriptions,
            activeSubscriptions,
            churnRate: Math.round(churnRate * 100) / 100,
        })

        return {
            summary: {
                totalSubscriptions,
                activeSubscriptions,
                churnRate: Math.round(churnRate * 100) / 100,
            },
            statusBreakdown: statusCounts.map((item) => ({
                status: item.status,
                count: item._count.status,
            })),
            planBreakdown: planCounts.map((item) => ({
                planId: item.planId,
                count: item._count.planId,
            })),
            billingCycleBreakdown: billingCycleCounts.map((item) => ({
                cycle: item.billingCycle,
                count: item._count.billingCycle,
            })),
            monthlyTrends: Object.values(trendsByMonth).sort((a: any, b: any) => a.month.localeCompare(b.month)),
        }
    } catch (error: any) {
        logger.error("Get subscription analytics error", {
            userId: user.id,
            error: error.message,
            stack: error.stack,
        })
        return { error: error.message || "Failed to get subscription analytics" }
    }
}

// Check if user has specific feature access
const checkFeatureAccessSchema = z.object({
    feature: z.string().min(1, "Feature name is required"),
    userId: z.string().optional(),
})

export const checkFeatureAccess = async (data: z.infer<typeof checkFeatureAccessSchema>) => {
    const user = await currentUser()
    if (!user) {
        logger.warn("Check feature access attempted without authentication")
        return { error: "Not authenticated" }
    }

    logger.info("Check feature access request", { userId: user.id, data })

    const validatedFields = checkFeatureAccessSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid check feature access data", {
            userId: user.id,
            errors: validatedFields.error.issues,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { feature, userId } = validatedFields.data

    try {
        // Determine target user (admin can check other users' features)
        const targetUserId = userId && user.role === "ADMIN" ? userId : user.id
        logger.debug("Checking feature access", { targetUserId, feature, isAdmin: user.role === "ADMIN" })

        const userData = await db.user.findUnique({
            where: { id: targetUserId },
            select: {
                features: true,
                isBanned: true,
                isSuspended: true,
                subscription: {
                    select: {
                        status: true,
                        endDate: true,
                        plan: {
                            include: {
                                planFeatures: {
                                    include: {
                                        planFeature: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!userData) {
            logger.error("User not found for feature access check", { targetUserId })
            return { error: "User not found" }
        }

        // Check if user is banned or suspended
        if (userData.isBanned || userData.isSuspended) {
            const reason = userData.isBanned ? "User is banned" : "User is suspended"
            logger.warn("Feature access denied due to user status", {
                targetUserId,
                feature,
                reason,
            })
            return {
                hasAccess: false,
                reason,
            }
        }

        // Check if subscription is active
        const now = new Date()
        const hasActiveSubscription =
            userData.subscription &&
            userData.subscription.status === SubscriptionStatus.ACTIVE &&
            (!userData.subscription.endDate || userData.subscription.endDate > now)

        // Check if user has feature in their features array
        const hasFeatureInArray = userData.features.includes(feature)

        // Check if user's plan includes the feature
        const hasFeatureInPlan =
            userData.subscription?.plan.planFeatures.some(
                (pf) => pf.planFeature.name === feature && pf.planFeature.isEnabled,
            ) || false

        const hasAccess = hasFeatureInArray || (hasActiveSubscription && hasFeatureInPlan)

        logger.info("Feature access check completed", {
            targetUserId,
            feature,
            hasAccess,
            hasActiveSubscription,
            hasFeatureInArray,
            hasFeatureInPlan,
        })

        return {
            hasAccess,
            reason: hasAccess ? null : "Feature not available in current plan",
            subscription: {
                isActive: hasActiveSubscription,
                planName: userData.subscription?.plan.name || "Free",
            },
        }
    } catch (error: any) {
        logger.error("Check feature access error", {
            userId: user.id,
            targetUserId: data.userId,
            feature: data.feature,
            error: error.message,
            stack: error.stack,
        })
        return { error: error.message || "Failed to check feature access" }
    }
}

/**
 * Get the user's active subscription and plan.
 */
export async function getUserActivePlan(userId: string) {
    logger.debug("Getting user active plan", { userId })

    const subscription = await db.subscription.findFirst({
        where: {
            userId,
            status: "ACTIVE",
            endDate: { gte: new Date() },
        },
        include: {
            plan: {
                include: {
                    planFeatures: {
                        include: { planFeature: true },
                    },
                },
            },
        },
    })

    if (!subscription) {
        logger.info("No active subscription found, falling back to free plan", { userId })

        // fallback to free plan
        const freePlan = await db.plan.findFirst({
            where: { name: "Free" },
            include: {
                planFeatures: {
                    include: { planFeature: true },
                },
            },
        })

        return {
            plan: freePlan,
            subscription: null,
            features: freePlan?.planFeatures.map((f) => f.planFeature.name) || [],
        }
    }

    logger.debug("Active subscription found", {
        userId,
        planName: subscription.plan.name,
        subscriptionId: subscription.id,
    })

    return {
        plan: subscription.plan,
        subscription,
        features: subscription.plan.planFeatures.map((f) => f.planFeature.name),
    }
}