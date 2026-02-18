"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Images, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import type {
  Feature,
  PlanTier,
  SubscriptionStatus,
} from "../subscription-utils";
import { FEATURES, PLAN_TIERS } from "../subscription-utils";
import { logger } from "@/lib/logger";
import { useEffect } from "react";

interface ImageCountSelectorProps {
  subscriptionStatus: SubscriptionStatus;
  imageCount: number;
  onImageCountChange: (count: number) => void;
  multipleImagesAccess: boolean;
  onPremiumRequired: () => void;
  premiumModal: {
    openModal: (feature: Feature, requiredPlan: PlanTier) => void;
    closeModal: () => void;
    isOpen: boolean;
    feature: Feature | null;
    requiredPlan: PlanTier | null;
  };
}

export function ImageCountSelector({
  subscriptionStatus,
  imageCount,
  onImageCountChange,
  multipleImagesAccess,
  onPremiumRequired,
  premiumModal,
}: ImageCountSelectorProps) {
  const currentPlan = subscriptionStatus?.plan;

  // Don't render if no access or plan doesn't support multiple images
  useEffect(() => {
    if (
      !multipleImagesAccess ||
      !currentPlan ||
      currentPlan.imagesPerGeneration <= 1
    ) {
      if (imageCount !== 1) {
        onImageCountChange(1);
      }
      logger.debug(
        "ImageCountSelector: No access to multiple images or plan does not support it"
      );
    }
  }, [multipleImagesAccess, currentPlan, imageCount, onImageCountChange]);
  if (
    !multipleImagesAccess ||
    !currentPlan ||
    currentPlan.imagesPerGeneration <= 1
  ) {
    return null;
  }

  const handleCountChange = (newCount: number) => {
    logger.info("handleCountChange", newCount);

    logger.info("currentPlan", currentPlan.imagesPerGeneration);
    // Check if the new count exceeds the user's plan limit
    if (newCount > currentPlan.imagesPerGeneration) {
      switch (newCount) {
        case 2:
          premiumModal.openModal(FEATURES.MULTIPLE_IMAGES, PLAN_TIERS.BASIC);
          return;
        case 4:
          premiumModal.openModal(FEATURES.MULTIPLE_IMAGES, PLAN_TIERS.PRO);
          return;
        case 8:
          premiumModal.openModal(
            FEATURES.MULTIPLE_IMAGES,
            PLAN_TIERS.UNLIMITED
          );
          return;
        // Allow these counts to trigger premium modal
        default:
          // For any other count, show premium modal
          onPremiumRequired();
          return;
      }
      return;
    }
    onImageCountChange(newCount);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCount = Number(e.target.value);
    handleCountChange(newCount);
  };

  const incrementCount = () => {
    const newCount = Math.min(
      imageCount + 1,
      currentPlan.imagesPerGeneration + 1
    ); // Allow +1 to trigger premium
    handleCountChange(newCount);
  };

  const decrementCount = () => {
    const newCount = Math.max(imageCount - 1, 1);
    handleCountChange(newCount);
  };

  return (
    <div className="">
      <motion.div whileTap={{ scale: 0.95 }}>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80"
            >
              <div className="flex items-center gap-2">
                <Images className="h-4 w-4" />
                <span>Images: {imageCount}</span>
              </div>
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-80 p-0" align="center" side="top">
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Images per generation</h4>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={decrementCount}
                    disabled={imageCount <= 1}
                    className="h-8 w-8 p-0 bg-transparent"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-medium min-w-[2rem] text-center">
                    {imageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={incrementCount}
                    className="h-8 w-8 p-0 bg-transparent"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max={currentPlan.imagesPerGeneration + 1} // Allow +1 to trigger premium
                    value={imageCount}
                    onChange={handleSliderChange}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {/* Range Labels */}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span className="text-center">
                    Your limit: {currentPlan.imagesPerGeneration}
                  </span>
                  <span>{currentPlan.imagesPerGeneration + 1}</span>
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Quick select:</p>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 4, 8].map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant={imageCount === count ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleCountChange(count)}
                      // disabled={count > currentPlan.imagesPerGeneration + 1}
                      className="h-8 px-3 text-xs"
                    >
                      {count}
                      {count > currentPlan.imagesPerGeneration && (
                        <span className="ml-1 text-amber-500">⚡</span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Plan Info */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Current plan:</span>
                  <span className="font-medium">{currentPlan.name}</span>
                </div>

                {imageCount > currentPlan.imagesPerGeneration && (
                  <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-1">
                      <span>⚡</span>
                      <span>
                        Upgrade to generate {imageCount} images at once
                      </span>
                    </div>
                  </div>
                )}

                {/* Cost Estimation */}
                <div className="text-xs text-muted-foreground">
                  Estimated cost: {imageCount * 10} nuts
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      {/* Custom Slider Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }

        .slider::-moz-range-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider::-webkit-slider-track {
          height: 6px;
          border-radius: 3px;
          background: hsl(var(--muted));
          transition: background 0.2s ease;
        }

        .slider::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          background: hsl(var(--muted));
          transition: background 0.2s ease;
        }

        .slider:focus {
          outline: none;
        }

        .slider:focus::-webkit-slider-track {
          background: hsl(var(--muted-foreground) / 0.2);
        }

        .slider:focus::-moz-range-track {
          background: hsl(var(--muted-foreground) / 0.2);
        }
      `}</style>
    </div>
  );
}
