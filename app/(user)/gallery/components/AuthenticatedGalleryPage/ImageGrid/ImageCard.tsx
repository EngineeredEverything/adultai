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
import Image from "next/image";
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
              voteScore > 0
                ? "bg-green-500/80 text-white"
                : "bg-red-500/80 text-white"
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
        className={`absolute inset-0 flex flex-col justify-between p-2 bg-gradient-to-t from-black/80 via-black/20 to-transparent
                   transition-all duration-200 ${hovering ? "opacity-100" : "opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top row: lock badge + comments */}
        <div className="flex justify-between items-start">
          {!image.image.isPublic && (
            <Badge variant="outline" className="flex gap-1 items-center text-[10px] bg-black/40 border-white/20 text-white">
              <Lock className="w-2.5 h-2.5" />
              Private
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {image.comments && (image.comments.count || 0) > 0 && (
              <span className="text-white/80 flex items-center gap-0.5 text-[10px]">
                <MessageCircle className="w-3 h-3" />
                {image.comments.count}
              </span>
            )}
          </div>
        </div>

        {/* Bottom: vote buttons + prompt + actions */}
        <div className="flex flex-col gap-1.5">
          {/* Prompt */}
          {image.image.prompt && (
            <p className="text-white/90 text-[10px] line-clamp-2 leading-tight" onClick={onClick}>
              {image.image.prompt}
            </p>
          )}

          {/* Vote buttons — prominent, always visible on hover */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => handleVote(e, "UPVOTE")}
              disabled={isVoting}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${userVote === "UPVOTE"
                  ? "bg-green-500 text-white shadow-lg shadow-green-500/30 scale-105"
                  : "bg-white/15 hover:bg-green-500/80 text-white backdrop-blur-sm"
                } disabled:opacity-50`}
              title="Upvote"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              {upvotes > 0 && <span>{upvotes}</span>}
            </button>

            <button
              onClick={(e) => handleVote(e, "DOWNVOTE")}
              disabled={isVoting}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${userVote === "DOWNVOTE"
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105"
                  : "bg-white/15 hover:bg-red-500/80 text-white backdrop-blur-sm"
                } disabled:opacity-50`}
              title="Downvote"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              {downvotes > 0 && <span>{downvotes}</span>}
            </button>

            {/* Net score */}
            {Math.abs(voteScore) > 0 && (
              <span className={`text-xs font-bold ml-0.5 ${voteScore > 0 ? "text-green-400" : "text-red-400"}`}>
                {voteScore > 0 ? "+" : ""}{voteScore}
              </span>
            )}

            {/* Spacer + More button */}
            <div className="ml-auto flex gap-1">
              {!animatedVideoUrl && (
                <button
                  onClick={handleQuickAnimate}
                  disabled={isAnimating}
                  className="flex items-center gap-1 px-2 py-1.5 bg-pink-600/80 hover:bg-pink-600 text-white rounded-lg text-[10px] font-medium transition-colors disabled:opacity-60"
                  title="Animate"
                >
                  {isAnimating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Film className="w-3 h-3" />}
                </button>
              )}
              <button
                onClick={onClick}
                className="flex items-center gap-1 px-2 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[10px] font-medium transition-colors backdrop-blur-sm"
                title="Open"
              >
                <Play className="w-3 h-3" />
              </button>
            </div>
          </div>

          {animatedVideoUrl && (
            <a
              href={animatedVideoUrl}
              download="animation.mp4"
              className="flex items-center gap-1 px-2 py-1 bg-green-600/80 hover:bg-green-600 text-white rounded text-[10px] font-medium transition-colors w-fit"
            >
              ⬇ Download
            </a>
          )}
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
