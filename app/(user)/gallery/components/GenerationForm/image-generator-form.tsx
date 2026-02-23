"use client";

import type React from "react";
import { type Dispatch, type SetStateAction, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, AlertTriangle, Search, Wand2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Navigation } from "./navigation";
import type { User } from "next-auth";
import {
  getWarningMessage,
  FEATURES,
  type SubscriptionStatus,
  type Feature,
} from "./subscription-utils";
import { useFeatureAccess } from "./hooks/use-feature-access";
import { usePremiumModal } from "./hooks/use-premium-modal";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

// Feature Components
import { AspectRatioSelector } from "./features/aspect-ratio-selector";
import { ModelSelector } from "./features/model-selector";
import { MPAutoSelector } from "./features/mp-auto-selector";
import { StyleSelector } from "./features/style-selector";
import { ColorSelector } from "./features/color-selector";
import { UserStatusAlert } from "./features/user-status-alert";
import { UsageDisplay } from "./features/usage-display";
import { ImageCountSelector } from "./features/image-count-selector";
import { PrivacyToggle } from "./features/privacy-toggle";
import { PremiumModal } from "../premium-modal";
import { GetCurrentUserInfoSuccessType } from "@/types/user";
import { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";

interface GenerationFormProps {
  compact?: boolean;
  prompt: string;
  setPrompt: (value: SetStateAction<string>) => void;
  isGenerating: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  user: GetCurrentUserInfoSuccessType | undefined;
  userNuts: number | undefined;
  setRatio: (ratio: { width: number; height: number }) => void;
  ratio: {
    width: number;
    height: number;
  };
  subscriptionStatus?: GetSubscriptionInfoSuccessType | null;
  isPublic: boolean;
  setIsPublic: Dispatch<SetStateAction<boolean>>;
  count: number;
  setCount: Dispatch<SetStateAction<number>>;
}

export default function GenerationForm({
  compact = false,
  prompt,
  setPrompt,
  isGenerating,
  handleSubmit,
  user,
  userNuts,
  setRatio,
  ratio,
  subscriptionStatus,
  isPublic,
  setIsPublic,
  count,
  setCount,
}: GenerationFormProps) {
  // Form state
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [mode, setMode] = useState<"generate" | "search">("generate");
  const [selectedModel, setSelectedModel] = useState("3.0-default");
  const [selectedMP, setSelectedMP] = useState("standard");
  const [selectedStyle, setSelectedStyle] = useState("none");
  const [selectedColor, setSelectedColor] = useState("natural");
  const router = useRouter();
  logger.info({ count });
  // Custom hooks
  const premiumModal = usePremiumModal();
  const featureAccess = useFeatureAccess({
    subscriptionStatus,
    imageCount: count,
  });

  // Get current plan
  const currentPlan = subscriptionStatus?.plan;

  // Set default image count based on plan
  useEffect(() => {
    if (currentPlan) {
      setCount(Math.min(currentPlan.imagesPerGeneration, 2));
    }
  }, [currentPlan]);

  // Utility functions
  const adjustDimensions = (w: number, h: number) => ({
    width: Math.round(w / 8) * 8,
    height: Math.round(h / 8) * 8,
  });

  const handleAspectRatioChange = (ratio: string) => {
    setAspectRatio(ratio);
    const [w, h] = ratio.split(":").map(Number);
    // SD 1.5 optimal: keep short side at 512, long side derived from ratio.
    // Hires-fix handles upscaling; don't exceed 768 on long side natively.
    const BASE = 512;
    let newWidth: number, newHeight: number;

    if (w >= h) {
      // Landscape or square: fix width at 512
      newWidth = BASE;
      newHeight = (h / w) * BASE;
    } else {
      // Portrait: fix width at 512, scale height
      newWidth = BASE;
      newHeight = (h / w) * BASE;
      // Cap portrait height at 768 (SD 1.5 sweet spot)
      if (newHeight > 768) {
        newHeight = 768;
        newWidth = (w / h) * newHeight;
      }
    }

    const adjusted = adjustDimensions(newWidth, newHeight);
    setRatio({ width: adjusted.width, height: adjusted.height });
  };

  const handlePremiumRequired = (feature: Feature) => {
    if (!subscriptionStatus) {
      premiumModal.openModal(feature, "basic");
      return;
    }
    logger.info(feature);
    const access = featureAccess.checkAccess(feature);

    if (!access.hasAccess) {
      premiumModal.openModal(feature, access.requiredPlan || "pro");
      return;
    }

    // Handle successful access
    if (feature === FEATURES.PUBLIC_SHARING) {
      setIsPublic((prev) => !prev);
    }
  };

  const handlePublicToggle = () => {
    handlePremiumRequired(FEATURES.PUBLIC_SHARING);
  };
  const handleMultipleImagesPremium = () => {
    handlePremiumRequired(FEATURES.MULTIPLE_IMAGES);
  };

  // Get warning message
  const warningMessage = getWarningMessage(subscriptionStatus, count);

  // Compact mode for navigation
  if (compact) {
    return (
      <Navigation
        user={user}
        userNuts={userNuts}
        isGenerating={isGenerating}
        handleSubmit={handleSubmit}
      />
    );
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    router.push(`/gallery?search=${encodeURIComponent(prompt.trim())}`);
  };

  return (
    <motion.form
      onSubmit={mode === "search" ? handleSearchSubmit : handleSubmit}
      className="max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* User Status Alert */}
      {subscriptionStatus && (
        <UserStatusAlert subscriptionStatus={subscriptionStatus} />
      )}

      <div className="relative">
        {/* Mode toggle tabs */}
        <div className="flex border border-b-0 border-border rounded-t-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("generate")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === "generate"
                ? "bg-purple-600/20 text-purple-400 border-b-2 border-purple-500"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Generate
          </button>
          <button
            type="button"
            onClick={() => setMode("search")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === "search"
                ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>

        <Textarea
          disabled={mode === "generate" && (isGenerating || !featureAccess.canGenerate)}
          placeholder={
            mode === "search"
              ? "Search images, prompts, or users..."
              : featureAccess.canGenerate
                ? "Describe what you want to see"
                : "Upgrade your plan to start generating images"
          }
          className="min-h-24 bg-primary/10 border border-border border-t-0 text-foreground resize-none"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="p-3 bg-muted border border-t-0 border-border rounded-b-lg">
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between">
            <div className="flex flex-col sm:flex-row w-full items-center justify-between gap-2 pb-2 sm:pb-0 hide-scrollbar">
              {mode === "generate" ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                <PrivacyToggle
                  isPublic={isPublic}
                  onToggle={handlePublicToggle}
                  disabled={!featureAccess.canGenerate}
                />

                <AspectRatioSelector
                  currentRatio={aspectRatio}
                  onSelect={handleAspectRatioChange}
                  width={ratio.width}
                  height={ratio.height}
                  disabled={!featureAccess.canGenerate}
                />

                <ModelSelector
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                  onPremiumRequired={() =>
                    handlePremiumRequired(FEATURES.ADVANCED_MODELS)
                  }
                  hasAccess={
                    featureAccess.advancedAccess.hasAccess &&
                    featureAccess.canGenerate
                  }
                />

                {/* <MPAutoSelector
                selectedMP={selectedMP}
                onMPChange={setSelectedMP}
                onPremiumRequired={() =>
                  handlePremiumRequired(FEATURES.FASTER_PROCESSING)
                }
                hasAccess={
                  featureAccess.advancedAccess.hasAccess &&
                  featureAccess.canGenerate
                }
              /> */}

                <div className="hidden sm:block">
                  <StyleSelector
                    selectedStyle={selectedStyle}
                    onStyleChange={setSelectedStyle}
                    onPremiumRequired={() =>
                      handlePremiumRequired(FEATURES.STYLE_CUSTOMIZATION)
                    }
                    hasAccess={
                      featureAccess.styleAccess.hasAccess &&
                      featureAccess.canGenerate
                    }
                  />
                </div>

                {/* <div className="hidden sm:block">
                <ColorSelector
                  selectedColor={selectedColor}
                  onColorChange={setSelectedColor}
                  onPremiumRequired={() =>
                    handlePremiumRequired(FEATURES.COLOR_SCHEMES)
                  }
                  hasAccess={
                    featureAccess.styleAccess.hasAccess &&
                    featureAccess.canGenerate
                  }
                />
              </div> */}

                {subscriptionStatus && (
                  <ImageCountSelector
                    subscriptionStatus={subscriptionStatus}
                    imageCount={count}
                    onImageCountChange={setCount}
                    multipleImagesAccess={
                      featureAccess.multipleImagesAccess.hasAccess &&
                      featureAccess.canGenerate
                    }
                    onPremiumRequired={handleMultipleImagesPremium}
                    premiumModal={premiumModal}
                  />
                )}

                <motion.div className="show" whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80"
                    disabled={!featureAccess.canGenerate}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
              ) : (
              <div className="flex items-center gap-2 flex-1 text-sm text-muted-foreground">
                <Search className="w-4 h-4" />
                Search images by prompt, style, or keyword
              </div>
              )}

              <motion.div
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto"
              >
                {mode === "generate" ? (
                <Button
                  disabled={
                    isGenerating || !prompt.trim() || !featureAccess.canGenerate
                  }
                  variant="default"
                  type="submit"
                  size="sm"
                  className="bg-white text-black hover:bg-gray-200 w-full sm:w-auto disabled:opacity-50"
                >
                  {isGenerating ? "Generating..." : "Generate"}
                </Button>
                ) : (
                <Button
                  disabled={!prompt.trim()}
                  variant="default"
                  type="submit"
                  size="sm"
                  className="bg-blue-600 text-white hover:bg-blue-700 w-full sm:w-auto disabled:opacity-50"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Message */}
      {warningMessage && (
        <Alert className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{warningMessage}</AlertDescription>
        </Alert>
      )}

      {/* Usage display moved to header user menu */}

      {/* Image Count Selector */}

      {/* Premium Modal */}
      <AnimatePresence>
        {premiumModal.isOpen &&
          premiumModal.feature &&
          premiumModal.requiredPlan && (
            <PremiumModal
              onClose={premiumModal.closeModal}
              feature={premiumModal.feature}
              requiredPlan={premiumModal.requiredPlan}
              isOpen={premiumModal.isOpen}
            />
          )}
      </AnimatePresence>
    </motion.form>
  );
}
