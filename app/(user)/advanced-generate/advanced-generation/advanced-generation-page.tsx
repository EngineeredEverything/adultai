"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageModal } from "./image-modal";
import { usePremiumModal } from "../../gallery/components/GenerationForm/hooks/use-premium-modal";
import { useAdvancedGeneration } from "../hooks/use-advanced-generation";
import { AdvancedGenerationForm } from "./advanced-generation-form";
import MobileBottomNav from "../../gallery/components/mobile-bottom-nav";
import type { SubscriptionStatus } from "../../gallery/components/GenerationForm/subscription-utils";
import { getAdvancedFeatureAccess } from "../advanced-generation-utils";
import { PremiumModal } from "../../gallery/components/premium-modal";
import { logger } from "@/lib/logger";
import { RefreshCw, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AdvancedGenerationPageProps {
  subscriptionStatus?: SubscriptionStatus;
}

export default function AdvancedGenerationPage({
  subscriptionStatus,
}: AdvancedGenerationPageProps) {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const premiumModal = usePremiumModal();
  const featureAccess = getAdvancedFeatureAccess(subscriptionStatus);

  const {
    isGenerating,
    generatedImages,
    pendingCount,
    progress,
    error,
    generateImages,
    clearImages,
    retryGeneration,
    resetState,
  } = useAdvancedGeneration({
    subscriptionStatus,
    onPremiumRequired: (feature, requiredPlan) => {
      logger.info("Premium required", { feature, requiredPlan });
      premiumModal.openModal(feature as any, requiredPlan as any);
    },
  });

  // Initialize page
  useEffect(() => {
    logger.info("AdvancedGenerationPage mounted", {
      hasSubscription: !!subscriptionStatus,
      hasAccess: featureAccess.advancedSettings.hasAccess,
    });

    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 500);

    return () => {
      clearTimeout(timer);
      logger.debug("AdvancedGenerationPage unmounted");
    };
  }, [subscriptionStatus, featureAccess.advancedSettings.hasAccess]);

  const handleImageClick = (image: string) => {
    logger.debug("Image clicked", { image });
    setSelectedImage(image);
  };

  const handleClearImages = () => {
    logger.info("Clear images requested");
    clearImages();
  };

  const handleRetry = () => {
    logger.info("Retry requested");
    retryGeneration();
  };

  const handleReset = () => {
    logger.info("Reset requested");
    resetState();
    toast.success("Reset Complete", {
      description: "Generation state has been reset",
    });
  };

  // Show loading state
  if (isPageLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingAnimation size="lg" />
        </div>
      </div>
    );
  }

  // Check if user has basic access to advanced generation
  if (!subscriptionStatus || !featureAccess.advancedSettings.hasAccess) {
    logger.warn("User lacks access to advanced generation", {
      hasSubscription: !!subscriptionStatus,
      hasAccess: featureAccess.advancedSettings.hasAccess,
    });

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h1 className="text-3xl font-bold">Advanced Image Generation</h1>
          <p className="text-muted-foreground">
            Unlock powerful advanced controls for professional image generation
          </p>
          <PremiumModal
            isOpen={true}
            onClose={() => {
              logger.info("Premium modal closed, redirecting to gallery");
              router.push("/gallery");
            }}
            feature="advanced generation settings"
            requiredPlan="pro"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="space-y-6">
          <AdvancedGenerationForm
            subscriptionStatus={subscriptionStatus}
            onGenerate={generateImages}
            onPremiumRequired={(feature, requiredPlan) => {
              logger.info("Premium required from form", {
                feature,
                requiredPlan,
              });
              premiumModal.openModal(feature as any, requiredPlan as any);
            }}
            isGenerating={isGenerating}
          />
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Generated Images</h2>
            {generatedImages.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearImages}
                  disabled={isGenerating}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={isGenerating}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-2 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Bar */}
          {isGenerating && progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generation Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Generation Status */}
          <div className="space-y-4">
            {isGenerating || pendingCount > 0 ? (
              <div className="aspect-square flex flex-col items-center justify-center bg-muted rounded-lg border-2 border-dashed">
                <LoadingAnimation size="lg" />
                <div className="mt-4 text-center space-y-2">
                  <p className="text-sm font-medium">
                    {pendingCount > 0
                      ? `Generating ${pendingCount} image${
                          pendingCount > 1 ? "s" : ""
                        }...`
                      : "Processing your request..."}
                  </p>
                  {progress > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round(progress)}% complete
                    </p>
                  )}
                </div>
              </div>
            ) : generatedImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {generatedImages.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="relative aspect-square cursor-pointer group overflow-hidden rounded-lg border"
                    onClick={() => handleImageClick(image)}
                  >
                    <Image
                      src={image || "/placeholder.svg"}
                      alt={`Generated image ${index + 1}`}
                      fill
                      className="object-cover transition-transform duration-200 group-hover:scale-105"
                      unoptimized
                      onLoad={() =>
                        logger.debug(`Image ${index + 1} loaded successfully`)
                      }
                      onError={() =>
                        logger.error(`Failed to load image ${index + 1}`, {
                          src: image,
                        })
                      }
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Click to view
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspect-square flex items-center justify-center bg-muted rounded-lg border-2 border-dashed">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground font-medium">
                    Generated images will appear here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Configure your settings and click generate to start
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          src={selectedImage || "/placeholder.svg"}
          onClose={() => {
            logger.debug("Image modal closed");
            setSelectedImage(null);
          }}
        />
      )}

      {/* Premium Modal */}
      {premiumModal.isOpen && (
        <PremiumModal
          isOpen={premiumModal.isOpen}
          onClose={() => {
            logger.debug("Premium modal closed");
            premiumModal.closeModal();
          }}
          feature={premiumModal.feature || "advanced features"}
          requiredPlan={premiumModal.requiredPlan || "pro"}
        />
      )}

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <MobileBottomNav
          onPlusClick={() => {
            logger.info("Mobile plus button clicked, navigating to gallery");
            router.push("/gallery?create=true");
          }}
          user={subscriptionStatus.user}
        />
      </div>
    </div>
  );
}
