"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Download, Share, X } from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { useState } from "react";

interface ImageModalProps {
  src: string;
  onClose: () => void;
}

export function ImageModal({ src, onClose }: ImageModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  logger.debug("ImageModal opened", { src });

  const handleDownload = async () => {
    try {
      logger.info("Download requested", { src });

      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      toast.success("Download Started", {
        description: "Your image is being downloaded",
      });

      logger.info("Download completed successfully");
    } catch (error) {
      logger.error("Download failed", error);
      toast.error("Download Failed", {
        description: "Failed to download the image. Please try again.",
      });
    }
  };

  const handleShare = async () => {
    try {
      logger.info("Share requested", { src });

      if (navigator.share) {
        await navigator.share({
          title: "Generated Image",
          text: "Check out this AI-generated image!",
          url: src,
        });

        logger.info("Native share completed");
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(src);
        toast.success("Link Copied", {
          description: "Image link copied to clipboard",
        });

        logger.info("Link copied to clipboard");
      }
    } catch (error) {
      logger.error("Share failed", error);
      toast.error("Share Failed", {
        description: "Failed to share the image. Please try again.",
      });
    }
  };

  const handleImageLoad = () => {
    logger.debug("Image loaded successfully");
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    logger.error("Failed to load image in modal", { src });
    setIsLoading(false);
    setHasError(true);
    toast.error("Image Load Error", {
      description: "Failed to load the image. Please try again.",
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <div className="relative">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                disabled={hasError}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShare}
                disabled={hasError}
              >
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Image Container */}
          <div className="relative aspect-square max-h-[80vh]">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {hasError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">Failed to load image</p>
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            ) : (
              <Image
                src={src || "/placeholder.svg"}
                alt="Generated Image"
                fill
                className="object-contain"
                unoptimized
                onLoad={handleImageLoad}
                onError={handleImageError}
                priority
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
