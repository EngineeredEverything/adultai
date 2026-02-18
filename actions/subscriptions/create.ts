"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { BillingCycle, SubscriptionStatus } from "@prisma/client"
import { logger } from "@/lib/logger"

const createSubscriptionSchema = z.object({
    planId: z.string().min(1, "Plan ID is required"),
    billingCycle: z.nativeEnum(BillingCycle),
    paymentMethodId: z.string().optional(),
    userId: z.string().optional(), // For admin use
})

export const createSubscription = async (data: z.infer<typeof createSubscriptionSchema>) => {
    let user = await currentUser()

    // Allow admin to create subscription for other users
    if (data.userId && user?.role === "ADMIN") {
        logger.info("Admin creating subscription for another user", {
            adminId: user.id,
            targetUserId: data.userId,
        })

        const targetUser = await db.user.findUnique({ where: { id: data.userId } })
        if (targetUser) {
            user = targetUser
        }
    }

    if (!user) {
        logger.warn("Create subscription attempted without valid user")
        return { error: "User not found or not authenticated" }
    }

    logger.info("Create subscription request", { userId: user.id, data })

    const validatedFields = createSubscriptionSchema.safeParse(data)
    if (!validatedFields.success) {
        logger.warn("Invalid create subscription data", {
            userId: user.id,
            errors: validatedFields.error.issues,
        })
        return {
            error: validatedFields.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", "),
        }
    }

    const { planId, billingCycle, paymentMethodId } = validatedFields.data

    try {
        // Check user restrictions
        const userData = await db.user.findUnique({
            where: { id: user.id },
            select: {
                isBanned: true,
                isSuspended: true,
                subscription: {
                    select: {
                        id: true,
                        status: true,
                        endDate: true,
                    },
                },
            },
        })

        if (userData?.isBanned) {
            logger.warn("Banned user attempted to create subscription", { userId: user.id })
            return { error: "Cannot create subscription: Account is banned" }
        }

        if (userData?.isSuspended) {
            logger.warn("Suspended user attempted to create subscription", { userId: user.id })
            return { error: "Cannot create subscription: Account is suspended" }
        }

        // Check if user already has an active subscription
        if (userData?.subscription?.status === SubscriptionStatus.ACTIVE) {
            const now = new Date()
            if (!userData.subscription.endDate || userData.subscription.endDate > now) {
                logger.warn("User already has active subscription", {
                    userId: user.id,
                    existingSubscriptionId: userData.subscription.id,
                })
                return { error: "User already has an active subscription" }
            }
        }

        // Validate plan exists and is active
        const plan = await db.plan.findFirst({
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

        if (!plan) {
            logger.error("Plan not found or inactive", { planId, userId: user.id })
            return { error: "Plan not found or inactive" }
        }

        logger.info("Plan validated for subscription", {
            planId,
            planName: plan.name,
            userId: user.id,
        })

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

        logger.debug("Subscription dates calculated", {
            startDate,
            endDate,
            nextBillingDate,
            billingCycle,
        })

        // Start database transaction
        const result = await db.$transaction(async (tx) => {
            logger.debug("Starting subscription creation transaction", { userId: user.id })

            // Cancel any existing active subscription
            if (userData?.subscription?.id) {
                logger.info("Cancelling existing subscription", {
                    existingSubscriptionId: userData.subscription.id,
                })

                await tx.subscription.update({
                    where: { id: userData.subscription.id },
                    data: { status: SubscriptionStatus.CANCELLED },
                })
            }

            // Create new subscription
            const subscription = await tx.subscription.create({
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

            logger.info("New subscription created", {
                subscriptionId: subscription.id,
                userId: user.id,
            })

            // Update user with plan benefits
            const nutsToAdd = plan.nutsPerMonth === -1 ? 999999999 : plan.nutsPerMonth
            const features = plan.planFeatures.map((pf) => pf.planFeature.name)

            await tx.user.update({
                where: { id: user.id },
                data: {
                    nuts: nutsToAdd,
                    imagesPerDay: 0, // Reset daily count
                    imagesPerGeneration: plan.imagesPerGeneration,
                    features,
                    lastImageReset: new Date(),
                },
            })

            logger.info("User benefits updated", {
                userId: user.id,
                nutsToAdd,
                features,
                imagesPerGeneration: plan.imagesPerGeneration,
            })

            // Create or update usage record
            await tx.usageRecord.upsert({
                where: { userId: user.id },
                create: {
                    userId: user.id,
                    nutsUsed: 0,
                    imagesGenerated: 0,
                    dailyImageCount: 0,
                    periodStart: startDate,
                    periodEnd: endDate,
                },
                update: {
                    periodStart: startDate,
                    periodEnd: endDate,
                    dailyImageCount: 0, // Reset for new period
                },
            })

            // Create subscription history record
            await tx.subscriptionHistory.create({
                data: {
                    userId: user.id,
                    tier: plan.name,
                    billing: billingCycle.toLowerCase() as "monthly" | "yearly",
                    startDate,
                    endDate,
                    status: "active",
                    paymentId: paymentMethodId,
                },
            })

            logger.debug("Subscription history record created", { userId: user.id })

            return subscription
        })

        revalidatePath("/")
        revalidatePath("/subscription")
        revalidatePath("/dashboard")

        logger.info("Subscription created successfully", {
            subscriptionId: result.id,
            userId: user.id,
            planName: result.plan.name,
            billingCycle: result.billingCycle,
        })

        return {
            success: true,
            message: "Subscription created successfully",
            subscription: {
                id: result.id,
                planName: result.plan.name,
                billingCycle: result.billingCycle,
                startDate: result.startDate,
                endDate: result.endDate,
                status: result.status,
                features: result.plan.planFeatures.map((pf) => pf.planFeature.name),
            },
        }
    } catch (error: any) {
        logger.error("Create subscription error", {
            userId: user.id,
            planId,
            error: error.message,
            stack: error.stack,
        })
        return { error: error.message || "Failed to create subscription" }
    }
}
