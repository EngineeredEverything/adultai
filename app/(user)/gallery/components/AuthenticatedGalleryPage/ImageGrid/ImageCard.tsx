"use client";

import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import {
  Lock,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Film,
  Loader2,
  Play,
  X,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
// next/image removed — using Bunny CDN optimizer directly for edge caching

const BUNNY_CDN = "adultai-com.b-cdn.net"

/**
 * Build a Bunny CDN optimized image URL.
 * Bunny serves WebP from edge cache — much faster than routing through /_next/image.
 * Falls back to original URL if it's not a Bunny CDN URL.
 */
function optimizeBunnyUrl(url: string, width: number, quality = 80): string {
  if (!url || !url.includes(BUNNY_CDN)) return url
  // Strip existing query params then add optimizer params
  const base = url.split("?")[0]
  return `${base}?width=${width}&format=webp&quality=${quality}`
}
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { createVote } from "@/actions/votes/create";

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedVideoUrl, setAnimatedVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Inline vote state — seeded from props, updated optimistically
  const [userVote, setUserVote] = useState<"UPVOTE" | "DOWNVOTE" | null>(
    (image.votes as any)?.userVote || null
  );
  const [voteScore, setVoteScore] = useState(image.votes?.voteScore || 0);
  const [upvotes, setUpvotes] = useState(image.votes?.upvoteCount || 0);
  const [downvotes, setDownvotes] = useState(image.votes?.downvoteCount || 0);
  const [isVoting, setIsVoting] = useState(false);

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

  const handleQuickAnimate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnimating || animatedVideoUrl) return;
    const imageUrl = image.image.cdnUrl || image.image.imageUrl;
    if (!imageUrl) return;
    setIsAnimating(true);
    try {
      const res = await fetch("/api/image-to-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, frames: 25, fps: 8, motionStrength: 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAnimatedVideoUrl(data.videoUrl);
    } catch (e: any) {
      toast.error("Animation failed", { description: e.message });
    } finally {
      setIsAnimating(false);
    }
  };

  const handleClearAnimation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnimatedVideoUrl(null);
  };

  const handleVote = async (e: React.MouseEvent, voteType: "UPVOTE" | "DOWNVOTE") => {
    e.stopPropagation();
    if (isVoting) return;
    setIsVoting(true);

    // Optimistic update
    const prev = { userVote, voteScore, upvotes, downvotes };
    if (userVote === voteType) {
      // Toggle off
      setUserVote(null);
      if (voteType === "UPVOTE") { setUpvotes(u => Math.max(0, u - 1)); setVoteScore(s => s - 1); }
      else { setDownvotes(d => Math.max(0, d - 1)); setVoteScore(s => s + 1); }
    } else if (userVote && userVote !== voteType) {
      // Switch
      setUserVote(voteType);
      if (voteType === "UPVOTE") { setUpvotes(u => u + 1); setDownvotes(d => Math.max(0, d - 1)); setVoteScore(s => s + 2); }
      else { setDownvotes(d => d + 1); setUpvotes(u => Math.max(0, u - 1)); setVoteScore(s => s - 2); }
    } else {
      // New vote
      setUserVote(voteType);
      if (voteType === "UPVOTE") { setUpvotes(u => u + 1); setVoteScore(s => s + 1); }
      else { setDownvotes(d => d + 1); setVoteScore(s => s - 1); }
    }

    try {
      const res = await createVote(image.image.id, voteType);
      if ("error" in res) throw new Error(res.error);
      setUserVote(res.userVote);
      setVoteScore(res.voteScore || 0);
      setUpvotes(res.upvotes || 0);
      setDownvotes(res.downvotes || 0);
    } catch {
      // Revert
      setUserVote(prev.userVote);
      setVoteScore(prev.voteScore);
      setUpvotes(prev.upvotes);
      setDownvotes(prev.downvotes);
      toast.error("Failed to vote");
    } finally {
      setIsVoting(false);
    }
  };

  const hasVotes = upvotes > 0 || downvotes > 0;

  return (
    <motion.div
      className="absolute group cursor-pointer rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        width: `${width}px`,
        height: `${position.height}px`,
        top: position.y,
        left: position.x,
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
        {animatedVideoUrl ? (
          <video
            ref={videoRef}
            src={animatedVideoUrl}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizeBunnyUrl(image.image.cdnUrl || "", width, 80) || "/placeholder.png"}
            alt={image.image.prompt || "Generated image"}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading={index < 4 ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => {
              handleLoad()
            }}
            onError={(e) => {
              handleError(e as any)
            }}
          />
        )}
      </div>

      {/* Animating spinner */}
      {isAnimating && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-20">
          <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
          <span className="text-white text-xs font-medium">Animating...</span>
        </div>
      )}

      {/* Clear animation button */}
      {animatedVideoUrl && (
        <button
          onClick={handleClearAnimation}
          className="absolute top-2 left-2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
          title="Back to image"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Vote Score Badge - Top Right (shown when not hovering) */}
      {Math.abs(voteScore) > 0 && !hovering && (
        <div className="absolute top-2 right-2 z-10">
          <Badge
            variant="secondary"
            className={`text-xs px-1.5 py-0.5 flex items-center gap-1 ${
              voteScore > 0 ? "bg-green-500/80 text-white" : "bg-red-500/80 text-white"
            }`}
          >
            {voteScore > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(voteScore)}
          </Badge>
        </div>
      )}

      {/* Vote buttons — top right on hover */}
      {hovering && (
        <div
          className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => handleVote(e, "UPVOTE")}
            disabled={isVoting}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all shadow-lg
              ${userVote === "UPVOTE"
                ? "bg-green-500 text-white scale-105"
                : "bg-black/60 hover:bg-green-500 text-white backdrop-blur-sm"
              } disabled:opacity-50`}
            title="Upvote"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            {upvotes > 0 && <span>{upvotes}</span>}
          </button>

          <button
            onClick={(e) => handleVote(e, "DOWNVOTE")}
            disabled={isVoting}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all shadow-lg
              ${userVote === "DOWNVOTE"
                ? "bg-red-500 text-white scale-105"
                : "bg-black/60 hover:bg-red-500 text-white backdrop-blur-sm"
              } disabled:opacity-50`}
            title="Downvote"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            {downvotes > 0 && <span>{downvotes}</span>}
          </button>

          {Math.abs(voteScore) > 0 && (
            <span className={`text-[10px] font-bold px-1 ${voteScore > 0 ? "text-green-400" : "text-red-400"}`}>
              {voteScore > 0 ? "+" : ""}{voteScore}
            </span>
          )}
        </div>
      )}

      {/* Hover overlay — bottom gradient with prompt + actions */}
      <div
        className={`absolute inset-0 flex flex-col justify-between p-2 bg-gradient-to-t from-black/75 via-transparent to-transparent
                   transition-all duration-200 pointer-events-none ${hovering ? "opacity-100" : "opacity-0"}`}
      >
        <div /> {/* spacer */}

        {/* Bottom: prompt + action buttons */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          {image.image.prompt && (
            <p className="text-white/90 text-[10px] line-clamp-2 leading-tight cursor-pointer" onClick={onClick}>
              {image.image.prompt}
            </p>
          )}

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {!image.image.isPublic && (
              <Badge variant="outline" className="flex gap-1 items-center text-[10px] bg-black/40 border-white/20 text-white py-0">
                <Lock className="w-2.5 h-2.5" />
                Private
              </Badge>
            )}
            <div className="ml-auto flex gap-1">
              {!animatedVideoUrl && (
                <button
                  onClick={handleQuickAnimate}
                  disabled={isAnimating}
                  className="p-1.5 bg-pink-600/80 hover:bg-pink-600 text-white rounded-lg transition-colors disabled:opacity-60"
                  title="Animate"
                >
                  {isAnimating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Film className="w-3 h-3" />}
                </button>
              )}
              {animatedVideoUrl && (
                <a
                  href={animatedVideoUrl}
                  download="animation.mp4"
                  className="p-1.5 bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition-colors"
                  title="Download"
                >
                  ⬇
                </a>
              )}
              <button
                onClick={onClick}
                className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors backdrop-blur-sm"
                title="Open"
              >
                <Play className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          hovering ? "opacity-10" : "opacity-0"
        }`}
      />
    </motion.div>
  );
}
