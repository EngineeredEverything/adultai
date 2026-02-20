// app\(user) \gallery\components\GenerationForm\subscription - utils.ts
import { logger } from "@/lib/logger"
import { GetSubscriptionInfoSuccessType } from "@/types/subscriptions"
import { getNutsString } from "@/utils/number"

// Core Types
export type SubscriptionStatus = GetSubscriptionInfoSuccessType | null

// Feature Types
export const FEATURES = {
  NEGATIVE_PROMPTS: "negative_prompts",
  STYLE_CUSTOMIZATION: "style_customization",
  ADVANCED_SETTINGS: "advanced_settings",
  MULTIPLE_IMAGES: "multiple_images",
  HD_RESOLUTION: "hd_resolution",
  FOUR_K_RESOLUTION: "4k_resolution",
  PUBLIC_SHARING: "private_sharing",
  ADVANCED_MODELS: "advanced_models",
  FASTER_PROCESSING: "faster_processing",
  COLOR_SCHEMES: "color_schemes",
} as const

export type Feature = typeof FEATURES[keyof typeof FEATURES]

// Plan Types
export const PLAN_TIERS = {
  FREE: "free",
  BASIC: "basic",
  PRO: "pro",
  UNLIMITED: "unlimited",
} as const

export type PlanTier = typeof PLAN_TIERS[keyof typeof PLAN_TIERS]

// Access Control Types
export interface FeatureAccess {
  hasAccess: boolean
  requiredPlan?: PlanTier
  reason?: string
}

export interface UserStatus {
  canGenerate: boolean
  isBanned: boolean
  isSuspended: boolean
  suspensionExpiresAt: Date | null
}

// Feature Configuration
interface FeatureConfig {
  requiredPlans: PlanTier[]
  requiredPlan: PlanTier
}

const FEATURE_CONFIG: Record<Feature, FeatureConfig> = {
  [FEATURES.NEGATIVE_PROMPTS]: {
    requiredPlans: [PLAN_TIERS.BASIC, PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.BASIC,
  },
  [FEATURES.STYLE_CUSTOMIZATION]: {
    requiredPlans: [PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.PRO,
  },
  [FEATURES.ADVANCED_SETTINGS]: {
    requiredPlans: [PLAN_TIERS.FREE, PLAN_TIERS.BASIC, PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.FREE,
  },
  [FEATURES.MULTIPLE_IMAGES]: {
    requiredPlans: [PLAN_TIERS.FREE, PLAN_TIERS.BASIC, PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.FREE,
  },
  [FEATURES.HD_RESOLUTION]: {
    requiredPlans: [PLAN_TIERS.BASIC, PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.BASIC,
  },
  [FEATURES.FOUR_K_RESOLUTION]: {
    requiredPlans: [PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.PRO,
  },
  [FEATURES.PUBLIC_SHARING]: {
    requiredPlans: [PLAN_TIERS.BASIC, PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.BASIC,
  },
  [FEATURES.ADVANCED_MODELS]: {
    requiredPlans: [PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.PRO,
  },
  [FEATURES.FASTER_PROCESSING]: {
    requiredPlans: [PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.PRO,
  },
  [FEATURES.COLOR_SCHEMES]: {
    requiredPlans: [PLAN_TIERS.PRO, PLAN_TIERS.UNLIMITED],
    requiredPlan: PLAN_TIERS.PRO,
  },
}

// Utility Functions
export const getUserStatus = (subscriptionStatus: SubscriptionStatus): UserStatus => {
  const status = subscriptionStatus?.status

  if (status?.isBanned) {
    return {
      canGenerate: false,
      isBanned: true,
      isSuspended: false,
      suspensionExpiresAt: null,
    }
  }

  if (status?.isSuspended) {
    const now = new Date()
    const expiresAt = status.suspensionExpiresAt
    const isStillSuspended = !expiresAt || expiresAt > now

    return {
      canGenerate: !isStillSuspended,
      isBanned: false,
      isSuspended: isStillSuspended,
      suspensionExpiresAt: expiresAt,
    }
  }

  return {
    canGenerate: true,
    isBanned: false,
    isSuspended: false,
    suspensionExpiresAt: null,
  }
}

export const checkFeatureAccess = (
  subscriptionStatus: SubscriptionStatus,
  feature: Feature
): FeatureAccess => {
  logger.debug("checkFeatureAccess called", {
    subscriptionStatus,
    feature,
  });

  const userStatus = getUserStatus(subscriptionStatus);
  logger.debug("User status", userStatus);

  // Check user status first
  if (userStatus.isBanned) {
    logger.debug("Access denied: User is banned");
    return { hasAccess: false, reason: "User is banned" };
  }

  if (userStatus.isSuspended) {
    logger.debug("Access denied: User is suspended");
    return { hasAccess: false, reason: "User is suspended" };
  }

  const currentPlan = subscriptionStatus?.plan;
  if (!currentPlan) {
    logger.debug("Access denied: No active plan");
    return {
      hasAccess: false,
      requiredPlan: PLAN_TIERS.BASIC,
      reason: "No active plan found",
    };
  }

  logger.debug("Current plan", currentPlan);

  const featureConfig = FEATURE_CONFIG[feature];
  if (!featureConfig) {
    logger.debug(`No config found for feature "${feature}". Granting access by default.`);
    return { hasAccess: true };
  }

  const hasAccess = featureConfig.requiredPlans.includes(currentPlan.name.toLocaleLowerCase() as PlanTier);
  logger.debug(`Feature "${feature}" access check`, {
    requiredPlans: featureConfig.requiredPlans,
    currentPlanId: currentPlan.name.toLocaleLowerCase(),
    hasAccess,
  });

  return {
    hasAccess,
    requiredPlan: featureConfig.requiredPlan,
    reason: hasAccess
      ? undefined
      : `Requires ${featureConfig.requiredPlan} plan or higher`,
  };
};

export const canGenerateImages = (
  subscriptionStatus: SubscriptionStatus,
  count: number
): boolean => {
  const userStatus = getUserStatus(subscriptionStatus)
  if (!userStatus.canGenerate) return false

  const currentPlan = subscriptionStatus?.plan
  if (!currentPlan) return false

  // Check daily limit
  // if (currentPlan.imagesPerDay !== -1 && currentPlan.imagesPerDay !== Number.POSITIVE_INFINITY) {
  //   const currentImagesUsed = subscriptionStatus?.usage?.dailyImageCount ?? 0
  //   if (currentImagesUsed + count > currentPlan.imagesPerDay) {
  //     return false
  //   }
  // }

  // Check nuts availability
  if (currentPlan.nutsPerMonth !== -1 && currentPlan.nutsPerMonth !== Number.POSITIVE_INFINITY) {
    const nutsRequired = count * 10 // Assuming 10 nuts per image
    const remainingNuts = getRemainingNuts(subscriptionStatus)
    if (remainingNuts < nutsRequired) {
      return false
    }
  }

  return true
}

// FIXED: getRemainingNuts now calculates from nutsUsed
export const getRemainingNuts = (subscriptionStatus: SubscriptionStatus): number => {
  const currentPlan = subscriptionStatus?.plan
  if (!currentPlan || currentPlan.nutsPerMonth === -1 || currentPlan.nutsPerMonth === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY
  }

  const nutsLimit = currentPlan.nutsPerMonth
  const nutsUsed = subscriptionStatus?.usage?.nutsUsed ?? 0
  return Math.max(0, nutsLimit - nutsUsed)
}

// FIXED: getRemainingDailyImages now uses dailyImageCount
// export const getRemainingDailyImages = (subscriptionStatus: SubscriptionStatus): number => {
//   const currentPlan = subscriptionStatus?.plan
//   if (!currentPlan || currentPlan.imagesPerDay === -1 || currentPlan.imagesPerDay === Number.POSITIVE_INFINITY) {
//     return Number.POSITIVE_INFINITY
//   }

//   const dailyImagesUsed = subscriptionStatus?.usage?.dailyImageCount ?? 0
//   return Math.max(0, currentPlan.imagesPerDay - dailyImagesUsed)
// }

export const getMaxImagesPerGeneration = (subscriptionStatus: SubscriptionStatus): number => {
  const currentPlan = subscriptionStatus?.plan
  return currentPlan?.imagesPerGeneration || 1
}

// FIXED: getWarningMessage with correct logic
export const getWarningMessage = (
  subscriptionStatus: SubscriptionStatus | undefined,
  imageCount: number,
): string | null => {
  if (!subscriptionStatus) {
    return "Please login to generate images"
  }

  const userStatus = getUserStatus(subscriptionStatus)
  if (userStatus.isBanned) return "Account is banned"
  if (userStatus.isSuspended) return "Account is suspended"

  const remainingNuts = getRemainingNuts(subscriptionStatus)
  // const remainingImages = getRemainingDailyImages(subscriptionStatus)
  const nutsRequired = imageCount * 10 // Assuming 10 nuts per image

  // Handle unlimited nuts case
  if (remainingNuts !== Number.POSITIVE_INFINITY && remainingNuts < nutsRequired) {
    return `Not enough TEMPT remaining. Need ${nutsRequired}, have ${remainingNuts}`
  }

  // Handle unlimited images case
  // if (remainingImages !== Number.POSITIVE_INFINITY && remainingImages < imageCount) {
  //   return `Daily image limit reached. Can generate ${remainingImages} more images today`
  // }

  return null
}

// FIXED: Helper function to check if it's a new day (more robust)
export const isNewDay = (lastDate: Date | null | undefined): boolean => {
  if (!lastDate) return true

  const now = new Date()
  const last = new Date(lastDate)
  return now.toDateString() !== last.toDateString()
}

// FIXED: getNutsUsagePercentage now uses nutsUsed directly
export const getNutsUsagePercentage = (subscriptionStatus: SubscriptionStatus): number => {
  const currentPlan = subscriptionStatus?.plan
  if (!currentPlan || currentPlan.nutsPerMonth === -1 || currentPlan.nutsPerMonth === Number.POSITIVE_INFINITY) {
    return 0
  }

  const nutsLimit = currentPlan.nutsPerMonth
  const nutsUsed = subscriptionStatus?.usage?.nutsUsed ?? 0

  return Math.min(100, Math.max(0, (nutsUsed / nutsLimit) * 100))
}

// FIXED: getDailyImagesUsagePercentage now uses dailyImageCount
export const getDailyImagesUsagePercentage = (subscriptionStatus: SubscriptionStatus): number => {
  const currentPlan = subscriptionStatus?.plan
  if (!currentPlan || currentPlan.imagesPerDay === -1 || currentPlan.imagesPerDay === Number.POSITIVE_INFINITY) {
    return 0
  }

  const dailyLimit = currentPlan.imagesPerDay
  const imagesUsed = subscriptionStatus?.usage?.dailyImageCount ?? 0

  return Math.min(100, Math.max(0, (imagesUsed / dailyLimit) * 100))
}

// Additional helper functions for better usage tracking

// Get total nuts consumed in current period
export const getTotalNutsUsed = (subscriptionStatus: SubscriptionStatus): number => {
  return subscriptionStatus?.usage?.nutsUsed ?? 0
}

// Get total images generated in current period
export const getTotalImagesGenerated = (subscriptionStatus: SubscriptionStatus): number => {
  return subscriptionStatus?.usage?.imagesGenerated ?? 0
}

// Get current daily image count
export const getDailyImageCount = (subscriptionStatus: SubscriptionStatus): number => {
  return subscriptionStatus?.usage?.dailyImageCount ?? 0
}

// Check if user has unlimited nuts
export const hasUnlimitedNuts = (subscriptionStatus: SubscriptionStatus): boolean => {
  const currentPlan = subscriptionStatus?.plan
  return !currentPlan || currentPlan.nutsPerMonth === -1 || currentPlan.nutsPerMonth === Number.POSITIVE_INFINITY
}

// Check if user has unlimited daily images
export const hasUnlimitedDailyImages = (subscriptionStatus: SubscriptionStatus): boolean => {
  const currentPlan = subscriptionStatus?.plan
  return !currentPlan || currentPlan.imagesPerDay === -1 || currentPlan.imagesPerDay === Number.POSITIVE_INFINITY
}

// Get usage summary for display
export const getUsageSummary = (subscriptionStatus: SubscriptionStatus) => {
  const remainingNuts = getRemainingNuts(subscriptionStatus)
  // const remainingDailyImages = getRemainingDailyImages(subscriptionStatus)
  const nutsUsagePercentage = getNutsUsagePercentage(subscriptionStatus)
  const dailyUsagePercentage = getDailyImagesUsagePercentage(subscriptionStatus)

  return {
    nuts: {
      used: getTotalNutsUsed(subscriptionStatus),
      remaining: remainingNuts === Number.POSITIVE_INFINITY ? "unlimited" : remainingNuts,
      limit: subscriptionStatus?.plan?.nutsPerMonth === -1 ? "unlimited" : subscriptionStatus?.plan?.nutsPerMonth,
      usagePercentage: nutsUsagePercentage,
      isUnlimited: hasUnlimitedNuts(subscriptionStatus)
    },
    dailyImages: {
      used: getDailyImageCount(subscriptionStatus),
      // remaining: remainingDailyImages === Number.POSITIVE_INFINITY ? "unlimited" : remainingDailyImages,
      limit: subscriptionStatus?.plan?.imagesPerDay === -1 ? "unlimited" : subscriptionStatus?.plan?.imagesPerDay,
      usagePercentage: dailyUsagePercentage,
      isUnlimited: hasUnlimitedDailyImages(subscriptionStatus)
    },
    totalImages: getTotalImagesGenerated(subscriptionStatus),
    period: subscriptionStatus?.usage?.usageRecordPeriod || null
  }
}