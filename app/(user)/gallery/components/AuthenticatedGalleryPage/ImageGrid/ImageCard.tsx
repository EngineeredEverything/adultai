"use client";

import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import {
  Heart,
  Lock,
  MessageCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { logger } from "@/lib/logger";

// Alternative compact version for smaller cards
export function ImageCard({
  image,
  isLoaded,
  onClick,
  onLoad,
  onError,
  position,
  width,
  debug = false,
  index,
}: {
  image: SearchImagesResponseSuccessType["images"][number];
  isLoaded: boolean;
  onClick: () => void;
  onLoad: () => void;
  onError: (error: Error) => void;
  position: { x: number; y: number; height: number };
  width: number;
  debug?: boolean;
  index: number;
}) {
  const [hovering, setHovering] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(isLoaded);

  useEffect(() => {
    logger.debug(`ImageCard mounted for image ID: ${image.image.id}`);
    logger.debug(`Initial isLoaded: ${isLoaded}`);
  }, [image.image.id, isLoaded]);

  const handleLoad = () => {
    logger.debug(`handleLoad triggered for image ID: ${image.image.id}`);
    setImageLoaded(true);
    onLoad();
  };

  const handleError = (e: any) => {
    logger.error(`handleError triggered for image ID: ${image.image.id}`, e);
    onError(new Error("Failed to load image"));
  };

  // Get vote statistics
  const voteScore = image.votes?.voteScore || 0;
  const hasVotes =
    (image.votes?.upvoteCount || 0) > 0 ||
    (image.votes?.downvoteCount || 0) > 0;

  return (
    <motion.div
      className="absolute group cursor-pointer rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        top: position.y,
        left: position.x,
      }}
      transition={{
        duration: 0.3,
        top: { duration: 0 },
        left: { duration: 0 },
      }}
      style={{
        width: `${width}px`,
        height: `${position.height}px`,
      }}
    >
      {debug && (
        <div
          className="absolute text-xs text-white bg-black/70 px-1 rounded z-50"
          style={{ top: 0, left: 0 }}
        >
          I{index}: y={Math.round(position.y)} h={Math.round(position.height)}
        </div>
      )}

      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <LoadingSpinner size="lg" className="text-gray-400" />
        </div>
      )}

      <div className="relative w-full h-full">
        <Image
          src={image.image.cdnUrl || "/placeholder.png"}
          alt={image.image.prompt || "Generated image"}
          fill
          className={`object-cover transition-all duration-300 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => {
            logger.debug(
              `Image element onLoad triggered for ${image.image.cdnUrl}`
            );
            handleLoad();
          }}
          onError={(e) => {
            logger.error(
              `Image element onError triggered for ${image.image.cdnUrl}`,
              e
            );
            handleError(e);
          }}
          sizes={`${width}px`}
          priority={false}
        />
      </div>

      {/* Vote Score Badge - Top Right */}
      {hasVotes && Math.abs(voteScore) > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <Badge
            variant="secondary"
            className={`text-xs px-1.5 py-0.5 flex items-center gap-1 ${
              voteScore > 0
                ? "bg-green-500/80 text-white"
                : voteScore < 0
                ? "bg-red-500/80 text-white"
                : "bg-gray-500/80 text-white"
            }`}
          >
            {voteScore > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(voteScore)}
          </Badge>
        </div>
      )}

      {/* Hover overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/50 via-black/70 to-transparent
                   transition-all duration-300 ${
                     hovering ? "opacity-100" : "opacity-0"
                   }`}
      >
        <div className="flex justify-between items-center mb-2">
          <Badge
            variant={image.image.isPublic ? "secondary" : "outline"}
            className="flex gap-1 items-center"
          >
            {image.image.isPublic ? (
              "Public"
            ) : (
              <>
                <Lock className="w-3 h-3" />
                Private
              </>
            )}
          </Badge>

          <div className="flex gap-2 items-center">
            {/* Detailed vote info on hover */}
            {hasVotes && (
              <span className="text-white text-xs">
                {image.votes?.upvoteCount || 0}↑{" "}
                {image.votes?.downvoteCount || 0}↓
              </span>
            )}

            {/* Comments */}
            {image.comments && (
              <span className="text-white flex items-center gap-1 text-xs">
                <MessageCircle className="w-3 h-3" />
                {image.comments.count || 0}
              </span>
            )}
          </div>
        </div>

        {image.image.prompt && (
          <p className="text-white text-sm line-clamp-2">
            {image.image.prompt}
          </p>
        )}
      </div>

      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          hovering ? "opacity-10" : "opacity-0"
        }`}
      />
    </motion.div>
  );
}
