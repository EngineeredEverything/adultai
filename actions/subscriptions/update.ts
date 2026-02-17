"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { BillingCycle, SubscriptionStatus } from "@prisma/client"
import { logger } from "@/lib/logger"

const updateSubscriptionSchema = z.object({
    subscriptionId: z.string().optional(),
    planId: z.string().optional(),
    billingCycle: z.nativeEnum(BillingCycle).optional(),
    status: z.nativeEnum(SubscriptionStatus).optional(),
    userId: z.string().optional(), // For admin use
})

export const updateSubscription = async (data: z.infer<typeof updateSubscriptionSchema>) => {
    const user = await currentUser()
    if (!user) {
        logger.warn("Update subscription attempted without authentication")
        return { error: "Not authenticated" }
    }

    logger.info("Update subscription request", { userId: user.id, data })

    const validatedFields = updateSubscriptionSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid subscription update data", {
            errors: validatedFields.error.issues,
            userId: user.id,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { subscriptionId, planId, billingCycle, status, userId } = validatedFields.data

    try {
        // Determine target user (admin can update other users' subscriptions)
        const targetUserId = userId && user.role === "ADMIN" ? userId : user.id
        logger.debug("Target user determined", { targetUserId, isAdmin: user.role === "ADMIN" })

        // Check user restrictions
        const userData = await db.user.findUnique({
            where: { id: targetUserId },
            select: {
                isBanned: true,
                isSuspended: true,
                subscription: {
                    select: {
                        id: true,
                        status: true,
                        planId: true,
                        billingCycle: true,
                    },
                },
            },
        })

        if (!userData) {
            logger.error("User not found for subscription update", { targetUserId })
            return { error: "User not found" }
        }

        if (userData.isBanned && user.role !== "ADMIN") {
            logger.warn("Banned user attempted subscription update", { targetUserId })
            return { error: "Cannot update subscription: Account is banned" }
        }

        if (userData.isSuspended && user.role !== "ADMIN") {
            logger.warn("Suspended user attempted subscription update", { targetUserId })
            return { error: "Cannot update subscription: Account is suspended" }
        }

        // Get current subscription
        const currentSubscription = userData.subscription
        if (!currentSubscription) {
            logger.error("No active subscription found for update", { targetUserId })
            return { error: "No active subscription found" }
        }

        const targetSubscriptionId = subscriptionId || currentSubscription.id

        // Validate subscription belongs to user (unless admin)
        if (user.role !== "ADMIN") {
            const subscriptionOwnership = await db.subscription.findFirst({
                where: {
                    id: targetSubscriptionId,
                    userId: user.id,
                },
            })

            if (!subscriptionOwnership) {
                logger.warn("Unauthorized subscription update attempt", {
                    userId: user.id,
                    subscriptionId: targetSubscriptionId,
                })
                return { error: "Subscription not found or access denied" }
            }
        }

        // If updating plan, validate new plan
        let newPlan = null
        if (planId) {
            newPlan = await db.plan.findFirst({
                where: {
                    id: planId,
                    isActive: true,
                },
                include: {
                    planFeatures: {
                        include: {
                            planFeature: true,
                        },
                    },
                },
            })

            if (!newPlan) {
                logger.error("Invalid plan specified for update", { planId, targetUserId })
                return { error: "New plan not found or inactive" }
            }

            logger.info("Plan change requested", {
                oldPlanId: currentSubscription.planId,
                newPlanId: planId,
                targetUserId,
            })
        }

        // Calculate new dates if billing cycle changes
        const updateData: any = {}

        if (planId) updateData.planId = planId
        if (billingCycle) updateData.billingCycle = billingCycle
        if (status) updateData.status = status

        // If changing billing cycle or plan, recalculate dates
        if (billingCycle || planId) {
            const now = new Date()
            const newEndDate = new Date()
            const newNextBillingDate = new Date()
            const cycleToUse = billingCycle || currentSubscription.billingCycle

            if (cycleToUse === BillingCycle.MONTHLY) {
                newEndDate.setMonth(newEndDate.getMonth() + 1)
                newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1)
            } else {
                newEndDate.setFullYear(newEndDate.getFullYear() + 1)
                newNextBillingDate.setFullYear(newNextBillingDate.getFullYear() + 1)
            }

            updateData.endDate = newEndDate
            updateData.nextBillingDate = newNextBillingDate
            updateData.updatedAt = now

            logger.debug("Subscription dates recalculated", {
                cycleToUse,
                newEndDate,
                newNextBillingDate,
            })
        }

        // Start database transaction
        const result = await db.$transaction(async (tx) => {
            logger.debug("Starting subscription update transaction", { targetSubscriptionId })

            // Update subscription
            const updatedSubscription = await tx.subscription.update({
                where: { id: targetSubscriptionId },
                data: updateData,
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
            })

            // If plan changed, update user benefits
            if (newPlan) {
                const nutsToSet = newPlan.nutsPerMonth === -1 ? 999999999 : newPlan.nutsPerMonth
                const features = newPlan.planFeatures.map((pf) => pf.planFeature.name)

                // Get current nuts to avoid reducing if upgrading
                const currentUser = await tx.user.findUnique({
                    where: { id: targetUserId },
                    select: { nuts: true },
                })

                await tx.user.update({
                    where: { id: targetUserId },
                    data: {
                        nuts: Math.max(currentUser?.nuts || 0, nutsToSet),
                        imagesPerGeneration: newPlan.imagesPerGeneration,
                        features,
                    },
                })

                logger.info("User benefits updated for plan change", {
                    targetUserId,
                    newPlanName: newPlan.name,
                    nutsToSet,
                    features,
                })

                // Update subscription history
                await tx.subscriptionHistory.create({
                    data: {
                        userId: targetUserId,
                        tier: newPlan.name,
                        billing: (billingCycle || currentSubscription.billingCycle).toLowerCase() as "monthly" | "yearly",
                        startDate: new Date(),
                        endDate: updateData.endDate || new Date(),
                        status: "active",
                    },
                })
            }

            // If status changed to cancelled or expired, create history record
            if (status && (status === SubscriptionStatus.CANCELLED || status === SubscriptionStatus.EXPIRED)) {
                await tx.subscriptionHistory.updateMany({
                    where: {
                        userId: targetUserId,
                        status: "active",
                    },
                    data: {
                        status: status === SubscriptionStatus.CANCELLED ? "cancelled" : "expired",
                        cancellationReason: status === SubscriptionStatus.CANCELLED ? "user_requested" : "expired",
                    },
                })

                logger.info("Subscription status changed", {
                    targetUserId,
                    newStatus: status,
                })
            }

            return updatedSubscription
        })

        revalidatePath("/")
        revalidatePath("/subscription")
        revalidatePath("/dashboard")
        if (user.role === "ADMIN") {
            revalidatePath("/admin")
        }

        logger.info("Subscription updated successfully", {
            subscriptionId: result.id,
            planName: result.plan.name,
            targetUserId,
        })

        return {
            success: true,
            message: "Subscription updated successfully",
            subscription: {
                id: result.id,
                planName: result.plan.name,
                billingCycle: result.billingCycle,
                status: result.status,
                endDate: result.endDate,
                features: result.plan.planFeatures.map((pf) => pf.planFeature.name),
            },
        }
    } catch (error: any) {
        logger.error("Update subscription error", {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            data,
        })
        return { error: error.message || "Failed to update subscription" }
    }
}

// Separate function for changing plans (upgrade/downgrade)
const changePlanSchema = z.object({
    newPlanId: z.string().min(1, "Plan ID is required"),
    billingCycle: z.nativeEnum(BillingCycle).optional(),
})

export const changePlan = async (data: z.infer<typeof changePlanSchema>) => {
    const user = await currentUser()
    if (!user) {
        logger.warn("Change plan attempted without authentication")
        return { error: "Not authenticated" }
    }

    logger.info("Change plan request", { userId: user.id, data })

    const validatedFields = changePlanSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid change plan data", {
            errors: validatedFields.error.issues,
            userId: user.id,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { newPlanId, billingCycle } = validatedFields.data

    try {
        // Get current subscription
        const currentUserData = await db.user.findUnique({
            where: { id: user.id },
            select: {
                isBanned: true,
                isSuspended: true,
                nuts: true,
                subscription: {
                    include: {
                        plan: true,
                    },
                },
            },
        })

        if (!currentUserData?.subscription) {
            logger.error("No active subscription found for plan change", { userId: user.id })
            return { error: "No active subscription found" }
        }

        if (currentUserData.isBanned) {
            logger.warn("Banned user attempted plan change", { userId: user.id })
            return { error: "Cannot change plan: Account is banned" }
        }

        if (currentUserData.isSuspended) {
            logger.warn("Suspended user attempted plan change", { userId: user.id })
            return { error: "Cannot change plan: Account is suspended" }
        }

        // Get new plan details
        const newPlan = await db.plan.findFirst({
            where: {
                id: newPlanId,
                isActive: true,
            },
            include: {
                planFeatures: {
                    include: {
                        planFeature: true,
                    },
                },
            },
        })

        if (!newPlan) {
            logger.error("Invalid new plan for plan change", { newPlanId, userId: user.id })
            return { error: "New plan not found or inactive" }
        }

        if (newPlan.id === currentUserData.subscription.planId) {
            logger.warn("User attempted to change to same plan", {
                userId: user.id,
                planId: newPlanId,
            })
            return { error: "You are already on this plan" }
        }

        logger.info("Plan change validated", {
            userId: user.id,
            oldPlan: currentUserData.subscription.plan.name,
            newPlan: newPlan.name,
        })

        // Use existing update function with plan change
        return await updateSubscription({
            planId: newPlanId,
            billingCycle: billingCycle || currentUserData.subscription.billingCycle,
        })
    } catch (error: any) {
        logger.error("Change plan error", {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            data,
        })
        return { error: error.message || "Failed to change plan" }
    }
}


const buySubscriptionSchema = z.object({
    planId: z.string().min(1, "Plan ID is required"),
    billingCycle: z.nativeEnum(BillingCycle),
    paymentMethod: z.string().min(1, "Payment method is required"),
    userId: z.string().optional(), // For admin use or webhook calls
})

export const buySubscription = async (data: z.infer<typeof buySubscriptionSchema>) => {
    let user = await currentUser()

    // If userId is provided (e.g., from webhook), use that user
    if (data.userId) {
        const dbUser = await db.user.findUnique({ where: { id: data.userId } })
        if (dbUser) {
            user = dbUser
        }
    }

    if (!user) {
        logger.warn("Buy subscription attempted without valid user")
        return { error: "User not found" }
    }

    logger.info("Buy subscription request", { userId: user.id, data })

    const validatedFields = buySubscriptionSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid buy subscription data", {
            errors: validatedFields.error.issues,
            userId: user.id,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { planId, billingCycle, paymentMethod } = validatedFields.data

    try {
        // Check user restrictions and current subscription
        const userData = await db.user.findUnique({
            where: { id: user.id },
            select: {
                isBanned: true,
                isSuspended: true,
                nuts: true,
                subscription: {
                    include: {
                        plan: true,
                    },
                },
            },
        })

        if (!userData) {
            logger.error("User not found for subscription purchase", { userId: user.id })
            return { error: "User not found" }
        }

        if (userData.isBanned) {
            logger.warn("Banned user attempted subscription purchase", { userId: user.id })
            return { error: "Cannot purchase subscription: Account is banned" }
        }

        if (userData.isSuspended) {
            logger.warn("Suspended user attempted subscription purchase", { userId: user.id })
            return { error: "Cannot purchase subscription: Account is suspended" }
        }

        // Check if user already has an active subscription
        if (userData.subscription && userData.subscription.status === SubscriptionStatus.ACTIVE) {
            const now = new Date()
            if (userData.subscription.endDate && userData.subscription.endDate > now) {
                logger.warn("User attempted to buy subscription while having active subscription", {
                    userId: user.id,
                    currentPlan: userData.subscription.plan.name,
                })
                return { error: "You already have an active subscription" }
            }
        }

        // Validate the selected plan
        const selectedPlan = await db.plan.findFirst({
            where: {
                id: planId,
                isActive: true,
            },
            include: {
                planFeatures: {
                    include: {
                        planFeature: true,
                    },
                },
            },
        })

        if (!selectedPlan) {
            logger.error("Invalid plan selected for purchase", { planId, userId: user.id })
            return { error: "Invalid plan selected" }
        }

        // Calculate subscription dates
        const startDate = new Date()
        const endDate = new Date()
        const nextBillingDate = new Date()

        if (billingCycle === BillingCycle.MONTHLY) {
            endDate.setMonth(endDate.getMonth() + 1)
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
        } else {
            endDate.setFullYear(endDate.getFullYear() + 1)
            nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1)
        }

        logger.info("Creating new subscription", {
            userId: user.id,
            planName: selectedPlan.name,
            billingCycle,
            startDate,
            endDate,
        })

        // Start database transaction
        const result = await db.$transaction(async (tx) => {
            // If user has an existing subscription, update it, otherwise create new one
            let subscription
            if (userData.subscription) {
                subscription = await tx.subscription.update({
                    where: { id: userData.subscription.id },
                    data: {
                        planId,
                        status: SubscriptionStatus.ACTIVE,
                        billingCycle,
                        startDate,
                        endDate,
                        nextBillingDate,
                        updatedAt: new Date(),
                    },
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
                })
            } else {
                subscription = await tx.subscription.create({
                    data: {
                        userId: user.id,
                        planId,
                        status: SubscriptionStatus.ACTIVE,
                        billingCycle,
                        startDate,
                        endDate,
                        nextBillingDate,
                    },
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
                })
            }

            // Update user benefits based on new plan
            const nutsToSet = selectedPlan.nutsPerMonth === -1 ? 999999999 : selectedPlan.nutsPerMonth
            const features = selectedPlan.planFeatures.map((pf) => pf.planFeature.name)

            // Get current nuts to avoid reducing if upgrading
            const currentNuts = userData.nuts || 0

            await tx.user.update({
                where: { id: user.id },
                data: {
                    nuts: Math.max(currentNuts, nutsToSet),
                    imagesPerDay: 0, // Reset daily count
                    imagesPerGeneration: selectedPlan.imagesPerGeneration,
                    features,
                    lastImageReset: new Date(),
                },
            })

            // Create or update usage record for the new period
            await tx.usageRecord.upsert({
                where: { userId: user.id },
                update: {
                    nutsUsed: 0,
                    imagesGenerated: 0,
                    dailyImageCount: 0,
                    lastImageDate: null,
                    periodStart: startDate,
                    periodEnd: endDate,
                    updatedAt: new Date(),
                },
                create: {
                    userId: user.id,
                    nutsUsed: 0,
                    imagesGenerated: 0,
                    dailyImageCount: 0,
                    periodStart: startDate,
                    periodEnd: endDate,
                },
            })

            // Create subscription history entry
            await tx.subscriptionHistory.create({
                data: {
                    userId: user.id,
                    tier: selectedPlan.name,
                    billing: billingCycle.toLowerCase() as "monthly" | "yearly",
                    startDate,
                    endDate,
                    status: "active",
                    paymentId: paymentMethod,
                },
            })

            logger.info("User benefits updated for new subscription", {
                userId: user.id,
                planName: selectedPlan.name,
                nutsToSet,
                features,
            })

            return subscription
        })

        // Revalidate relevant paths
        revalidatePath("/")
        revalidatePath("/subscription")
        revalidatePath("/dashboard")

        logger.info("Subscription purchased successfully", {
            subscriptionId: result.id,
            planName: result.plan.name,
            userId: user.id,
        })

        return {
            success: true,
            message: "Subscription purchased successfully",
            subscription: {
                id: result.id,
                planId,
                planName: result.plan.name,
                billingCycle: result.billingCycle,
                status: result.status,
                startDate: result.startDate,
                endDate: result.endDate,
                features: result.plan.planFeatures.map((pf) => pf.planFeature.name),
            },
        }
    } catch (error: any) {
        logger.error("Buy subscription error", {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            data,
        })
        return { error: error.message || "Failed to purchase subscription" }
    }
}