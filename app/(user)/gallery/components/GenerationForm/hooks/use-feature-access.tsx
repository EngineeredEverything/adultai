"use client";

import { useMemo } from "react";
import {
  checkFeatureAccess,
  canGenerateImages,
  FEATURES,
  type SubscriptionStatus,
  type Feature,
  PLAN_TIERS,
} from "../subscription-utils";
import { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";
import { logger } from "@/lib/logger";

interface UseFeatureAccessProps {
  subscriptionStatus?: GetSubscriptionInfoSuccessType | null;
  imageCount: number;
}

export function useFeatureAccess({
  subscriptionStatus,
  imageCount,
}: UseFeatureAccessProps) {
  return useMemo(() => {
    logger.debug("useFeatureAccess triggered", {
      subscriptionStatus,
      imageCount,
    });

    if (!subscriptionStatus) {
      logger.debug("No subscriptionStatus provided. Access denied.");
      return {
        styleAccess: { hasAccess: false },
        advancedAccess: { hasAccess: false },
        multipleImagesAccess: { hasAccess: false },
        publicSharingAccess: { hasAccess: false },
        canGenerate: false,
        checkAccess: () => ({
          hasAccess: false,
          requiredPlan: PLAN_TIERS["PRO"],
          reason: null,
        }),
      };
    }

    const styleAccess = checkFeatureAccess(
      subscriptionStatus,
      FEATURES.STYLE_CUSTOMIZATION
    );
    logger.debug("Style Access", styleAccess);

    const advancedAccess = checkFeatureAccess(
      subscriptionStatus,
      FEATURES.ADVANCED_SETTINGS
    );
    logger.debug("Advanced Access", advancedAccess);

    const multipleImagesAccess = checkFeatureAccess(
      subscriptionStatus,
      FEATURES.MULTIPLE_IMAGES
    );
    logger.debug("Multiple Images Access", multipleImagesAccess);

    const publicSharingAccess = checkFeatureAccess(
      subscriptionStatus,
      FEATURES.PUBLIC_SHARING
    );
    logger.debug("Public Sharing Access", publicSharingAccess);

    const canGenerate = canGenerateImages(subscriptionStatus, imageCount);
    logger.debug("Can Generate Images", canGenerate);

    const checkAccess = (feature: Feature) => {
      const result = checkFeatureAccess(subscriptionStatus, feature);
      logger.debug(`Checking access for feature: ${feature}`, result);
      return result;
    };

    return {
      styleAccess,
      advancedAccess,
      multipleImagesAccess,
      publicSharingAccess,
      canGenerate,
      checkAccess,
    };
  }, [subscriptionStatus, imageCount]);
}
