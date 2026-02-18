"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { SubscriptionStatus } from "@prisma/client"
import { logger } from "@/lib/logger"

const cancelSubscriptionSchema = z.object({
    subscriptionId: z.string().optional(),
    immediate: z.boolean().default(false), // Whether to cancel immediately or at period end
    reason: z.string().optional(),
    userId: z.string().optional(), // For admin use
})

export const cancelSubscription = async (data?: z.infer<typeof cancelSubscriptionSchema>) => {
    const user = await currentUser()
    if (!user) {
        logger.warn("Cancel subscription attempted without authentication")
        return { error: "Not authenticated" }
    }

    logger.info("Cancel subscription request", { userId: user.id, data })

    const validatedFields = cancelSubscriptionSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid cancel subscription data", {
            errors: validatedFields.error.issues,
            userId: user.id,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { subscriptionId, immediate, reason, userId } = validatedFields.data

    try {
        // Determine target user (admin can cancel other users' subscriptions)
        const targetUserId = userId && user.role === "ADMIN" ? userId : user.id
        logger.debug("Target user determined for cancellation", {
            targetUserId,
            isAdmin: user.role === "ADMIN",
        })

        // Get current subscription
        const userData = await db.user.findUnique({
            where: { id: targetUserId },
            select: {
                subscription: {
                    include: {
                        plan: true,
                    },
                },
            },
        })

        if (!userData?.subscription) {
            logger.error("No active subscription found for cancellation", { targetUserId })
            return { error: "No active subscription found" }
        }

        const subscription = userData.subscription
        const targetSubscriptionId = subscriptionId || subscription.id

        // Validate subscription belongs to user (unless admin)
        if (user.role !== "ADMIN" && subscription.userId !== user.id) {
            logger.warn("Unauthorized subscription cancellation attempt", {
                userId: user.id,
                subscriptionId: targetSubscriptionId,
            })
            return { error: "Subscription not found or access denied" }
        }

        // Check if already cancelled
        if (subscription.status === SubscriptionStatus.CANCELLED) {
            logger.warn("Attempted to cancel already cancelled subscription", {
                subscriptionId: targetSubscriptionId,
            })
            return { error: "Subscription is already cancelled" }
        }

        logger.info("Processing subscription cancellation", {
            subscriptionId: targetSubscriptionId,
            immediate,
            reason,
        })

        // Start database transaction
        const result = await db.$transaction(async (tx) => {
            const updateData: any = {
                status: SubscriptionStatus.CANCELLED,
                updatedAt: new Date(),
            }

            // If immediate cancellation, set end date to now
            if (immediate) {
                updateData.endDate = new Date()
                updateData.nextBillingDate = null

                logger.debug("Immediate cancellation - resetting user to free plan")

                // Reset user to free plan immediately
                const freePlan = await tx.plan.findFirst({
                    where: { name: "Free" },
                    include: {
                        planFeatures: {
                            include: {
                                planFeature: true,
                            },
                        },
                    },
                })

                if (freePlan) {
                    const freeNuts = freePlan.nutsPerMonth === -1 ? 999999999 : freePlan.nutsPerMonth
                    const freeFeatures = freePlan.planFeatures.map((pf) => pf.planFeature.name)

                    await tx.user.update({
                        where: { id: targetUserId },
                        data: {
                            nuts: Math.min(userData.subscription?.plan.nutsPerMonth || 0, freeNuts),
                            imagesPerDay: 0,
                            imagesPerGeneration: freePlan.imagesPerGeneration,
                            features: freeFeatures,
                            lastImageReset: new Date(),
                        },
                    })

                    logger.info("User reset to free plan", {
                        targetUserId,
                        freeNuts,
                        freeFeatures,
                    })
                }
            }

            // Update subscription
            const cancelledSubscription = await tx.subscription.update({
                where: { id: targetSubscriptionId },
                data: updateData,
                include: {
                    plan: true,
                    user: {
                        select: {
                            name: true,
                            email: true,
                        },
                    },
                },
            })

            // Update subscription history
            await tx.subscriptionHistory.updateMany({
                where: {
                    userId: targetUserId,
                    status: "active",
                },
                data: {
                    status: "cancelled",
                    cancellationReason: reason || (immediate ? "immediate_cancellation" : "user_requested"),
                },
            })

            // Create cancellation record in subscription history
            await tx.subscriptionHistory.create({
                data: {
                    userId: targetUserId,
                    tier: subscription.plan.name,
                    billing: subscription.billingCycle.toLowerCase() as "monthly" | "yearly",
                    startDate: subscription.startDate,
                    endDate: updateData.endDate || subscription.endDate,
                    status: "cancelled",
                    paymentId: null,
                },
            })

            return cancelledSubscription
        })

        revalidatePath("/")
        revalidatePath("/subscription")
        revalidatePath("/dashboard")
        if (user.role === "ADMIN") {
            revalidatePath("/admin")
        }

        const message = immediate
            ? "Subscription cancelled immediately"
            : "Subscription cancelled successfully. You'll retain access until your current billing period ends."

        logger.info("Subscription cancelled successfully", {
            subscriptionId: result.id,
            immediate,
            targetUserId,
        })

        return {
            success: true,
            message,
            subscription: {
                id: result.id,
                planName: result.plan.name,
                status: result.status,
                endDate: result.endDate,
                cancelledAt: result.updatedAt,
            },
        }
    } catch (error: any) {
        logger.error("Cancel subscription error", {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            data,
        })
        return { error: error.message || "Failed to cancel subscription" }
    }
}

// Admin function to permanently delete a subscription
const deleteSubscriptionSchema = z.object({
    subscriptionId: z.string().min(1, "Subscription ID is required"),
    reason: z.string().optional(),
})

export const deleteSubscription = async (data: z.infer<typeof deleteSubscriptionSchema>) => {
    const user = await currentUser()
    if (!user || user.role !== "ADMIN") {
        logger.warn("Unauthorized delete subscription attempt", { userId: user?.id })
        return { error: "Not authorized. Admin access required." }
    }

    logger.info("Delete subscription request", { userId: user.id, data })

    const validatedFields = deleteSubscriptionSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid delete subscription data", {
            errors: validatedFields.error.issues,
            userId: user.id,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { subscriptionId, reason } = validatedFields.data

    try {
        // Get subscription details before deletion
        const subscription = await db.subscription.findUnique({
            where: { id: subscriptionId },
            include: {
                plan: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        })

        if (!subscription) {
            logger.error("Subscription not found for deletion", { subscriptionId })
            return { error: "Subscription not found" }
        }

        logger.info("Processing subscription deletion", {
            subscriptionId,
            userId: subscription.userId,
            planName: subscription.plan.name,
        })

        // Start database transaction
        await db.$transaction(async (tx) => {
            // Reset user to free plan
            const freePlan = await tx.plan.findFirst({
                where: { name: "Free" },
                include: {
                    planFeatures: {
                        include: {
                            planFeature: true,
                        },
                    },
                },
            })

            if (freePlan) {
                const freeNuts = freePlan.nutsPerMonth === -1 ? 999999999 : freePlan.nutsPerMonth
                const freeFeatures = freePlan.planFeatures.map((pf) => pf.planFeature.name)

                await tx.user.update({
                    where: { id: subscription.userId },
                    data: {
                        nuts: freeNuts,
                        imagesPerDay: 0,
                        imagesPerGeneration: freePlan.imagesPerGeneration,
                        features: freeFeatures,
                        lastImageReset: new Date(),
                    },
                })

                logger.info("User reset to free plan for deletion", {
                    userId: subscription.userId,
                    freeNuts,
                    freeFeatures,
                })
            }

            // Create final history record
            await tx.subscriptionHistory.create({
                data: {
                    userId: subscription.userId,
                    tier: subscription.plan.name,
                    billing: subscription.billingCycle.toLowerCase() as "monthly" | "yearly",
                    startDate: subscription.startDate,
                    endDate: new Date(),
                    status: "cancelled",
                    paymentId: null,
                },
            })

            // Delete the subscription
            await tx.subscription.delete({
                where: { id: subscriptionId },
            })

            // Update any existing history records
            await tx.subscriptionHistory.updateMany({
                where: {
                    userId: subscription.userId,
                    status: "active",
                },
                data: {
                    status: "cancelled",
                    cancellationReason: reason || "admin_deletion",
                },
            })
        })

        revalidatePath("/")
        revalidatePath("/subscription")
        revalidatePath("/dashboard")
        revalidatePath("/admin")

        logger.info("Subscription deleted successfully", {
            subscriptionId,
            userId: subscription.userId,
        })

        return {
            success: true,
            message: "Subscription deleted successfully",
            deletedSubscription: {
                id: subscription.id,
                planName: subscription.plan.name,
                userName: subscription.user.name,
                userEmail: subscription.user.email,
            },
        }
    } catch (error: any) {
        logger.error("Delete subscription error", {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            subscriptionId,
        })
        return { error: error.message || "Failed to delete subscription" }
    }
}

// Function to reactivate a cancelled subscription
const reactivateSubscriptionSchema = z.object({
    subscriptionId: z.string().min(1, "Subscription ID is required"),
    extendDays: z.number().min(1).max(365).default(30),
})

export const reactivateSubscription = async (data: z.infer<typeof reactivateSubscriptionSchema>) => {
    const user = await currentUser()
    if (!user) {
        logger.warn("Reactivate subscription attempted without authentication")
        return { error: "Not authenticated" }
    }

    logger.info("Reactivate subscription request", { userId: user.id, data })

    const validatedFields = reactivateSubscriptionSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid reactivate subscription data", {
            errors: validatedFields.error.issues,
            userId: user.id,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { subscriptionId, extendDays } = validatedFields.data

    try {
        // Get subscription
        const subscription = await db.subscription.findUnique({
            where: { id: subscriptionId },
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

        if (!subscription) {
            logger.error("Subscription not found for reactivation", { subscriptionId })
            return { error: "Subscription not found" }
        }

        // Verify ownership (unless admin)
        if (user.role !== "ADMIN" && subscription.userId !== user.id) {
            logger.warn("Unauthorized subscription reactivation attempt", {
                userId: user.id,
                subscriptionId,
            })
            return { error: "Subscription not found or access denied" }
        }

        // Check if can be reactivated
        if (subscription.status === SubscriptionStatus.ACTIVE) {
            logger.warn("Attempted to reactivate active subscription", { subscriptionId })
            return { error: "Subscription is already active" }
        }

        if (subscription.status !== SubscriptionStatus.CANCELLED) {
            logger.warn("Attempted to reactivate non-cancelled subscription", {
                subscriptionId,
                status: subscription.status,
            })
            return { error: "Only cancelled subscriptions can be reactivated" }
        }

        // Calculate new dates
        const now = new Date()
        const newEndDate = new Date()
        newEndDate.setDate(now.getDate() + extendDays)

        const newNextBillingDate = new Date(newEndDate)

        logger.info("Processing subscription reactivation", {
            subscriptionId,
            extendDays,
            newEndDate,
        })

        // Reactivate subscription
        const result = await db.$transaction(async (tx) => {
            const reactivatedSubscription = await tx.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: SubscriptionStatus.ACTIVE,
                    endDate: newEndDate,
                    nextBillingDate: newNextBillingDate,
                    updatedAt: now,
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

            // Restore user benefits
            const plan = reactivatedSubscription.plan
            const nutsToAdd = plan.nutsPerMonth === -1 ? 999999999 : plan.nutsPerMonth
            const features = plan.planFeatures.map((pf) => pf.planFeature.name)

            await tx.user.update({
                where: { id: subscription.userId },
                data: {
                    nuts: nutsToAdd,
                    imagesPerDay: 0,
                    imagesPerGeneration: plan.imagesPerGeneration,
                    features,
                    lastImageReset: now,
                },
            })

            logger.info("User benefits restored for reactivation", {
                userId: subscription.userId,
                nutsToAdd,
                features,
            })

            // Create history record
            await tx.subscriptionHistory.create({
                data: {
                    userId: subscription.userId,
                    tier: plan.name,
                    billing: subscription.billingCycle.toLowerCase() as "monthly" | "yearly",
                    startDate: now,
                    endDate: newEndDate,
                    status: "active",
                },
            })

            return reactivatedSubscription
        })

        revalidatePath("/")

        logger.info("Subscription reactivated successfully", {
            subscriptionId,
            userId: subscription.userId,
        })

        return {
            success: true,
            message: "Subscription reactivated successfully",
            subscription: {
                id: result.id,
                planName: result.plan.name,
                status: result.status,
                endDate: result.endDate,
                nextBillingDate: result.nextBillingDate,
            },
        }
    } catch (error: any) {
        logger.error("Reactivate subscription error", {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            subscriptionId,
        })
        return { error: error.message || "Failed to reactivate subscription" }
    }
}
