"use client";

import { Badge } from "@/components/ui/badge";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import {
  Lock,
  TrendingUp,
  TrendingDown,
  Film,
  Loader2,
  Play,
  X,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

const BUNNY_CDN = "adultai-com.b-cdn.net";

function optimizeBunnyUrl(url: string, width: number, quality = 80): string {
  if (!url || !url.includes(BUNNY_CDN)) return url;
  const base = url.split("?")[0];
  return `${base}?width=${width}&format=webp&quality=${quality}`;
}

import { useState, useRef } from "react";
import { toast } from "sonner";
import { createVote } from "@/actions/votes/create";
import { showAuthToast, isAuthError } from "@/lib/auth-toast";

export function ImageCard({
  image,
  isLoaded,
  onClick,
  onLoad,
  onError,
  index,
}: {
  image: SearchImagesResponseSuccessType["images"][number];
  isLoaded: boolean;
  onClick: () => void;
  onLoad: () => void;
  onError: () => void;
  index: number;
}) {
  const [hovering, setHovering] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedVideoUrl, setAnimatedVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [userVote, setUserVote] = useState<"UPVOTE" | "DOWNVOTE" | null>(
    (image.votes as any)?.userVote || null
  );
  const [voteScore, setVoteScore] = useState(image.votes?.voteScore || 0);
  const [upvotes, setUpvotes] = useState(image.votes?.upvoteCount || 0);
  const [downvotes, setDownvotes] = useState(image.votes?.downvoteCount || 0);
  const [isVoting, setIsVoting] = useState(false);

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

    const prev = { userVote, voteScore, upvotes, downvotes };
    if (userVote === voteType) {
      setUserVote(null);
      if (voteType === "UPVOTE") { setUpvotes(u => Math.max(0, u - 1)); setVoteScore(s => s - 1); }
      else { setDownvotes(d => Math.max(0, d - 1)); setVoteScore(s => s + 1); }
    } else if (userVote && userVote !== voteType) {
      setUserVote(voteType);
      if (voteType === "UPVOTE") { setUpvotes(u => u + 1); setDownvotes(d => Math.max(0, d - 1)); setVoteScore(s => s + 2); }
      else { setDownvotes(d => d + 1); setUpvotes(u => Math.max(0, u - 1)); setVoteScore(s => s - 2); }
    } else {
      setUserVote(voteType);
      if (voteType === "UPVOTE") { setUpvotes(u => u + 1); setVoteScore(s => s + 1); }
      else { setDownvotes(d => d + 1); setVoteScore(s => s - 1); }
    }

    try {
      const res = await createVote(image.image.id, voteType);
      if ("error" in res) {
        if (isAuthError(res.error)) {
          // Revert optimistic update before showing auth prompt
          setUserVote(prev.userVote);
          setVoteScore(prev.voteScore);
          setUpvotes(prev.upvotes);
          setDownvotes(prev.downvotes);
          showAuthToast("vote");
          return;
        }
        throw new Error(res.error);
      }
      setUserVote(res.userVote);
      setVoteScore(res.voteScore || 0);
      setUpvotes(res.upvotes || 0);
      setDownvotes(res.downvotes || 0);
    } catch {
      setUserVote(prev.userVote);
      setVoteScore(prev.voteScore);
      setUpvotes(prev.upvotes);
      setDownvotes(prev.downvotes);
      toast.error("Failed to vote");
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div
      className="relative group cursor-pointer rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 w-full"
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Image / Video — drives container height naturally */}
      {animatedVideoUrl ? (
        <video
          ref={videoRef}
          src={animatedVideoUrl}
          className="w-full h-auto block"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={optimizeBunnyUrl(image.image.cdnUrl || "", 600, 80) || "/placeholder.png"}
          alt={image.image.prompt || "Generated image"}
          width={image.image.width || 512}
          height={image.image.height || 768}
          className="w-full h-auto block"
          style={{ display: "block" }}
          loading={index < 6 ? "eager" : "lazy"}
          fetchPriority={index < 2 ? "high" : "auto"}
          decoding="async"
          onLoad={handleLoad}
          onError={onError}
        />
      )}

      {/* Animating spinner overlay */}
      {isAnimating && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-20 min-h-[120px]">
          <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
          <span className="text-white text-xs font-medium">Animating...</span>
        </div>
      )}

      {/* Clear animation */}
      {animatedVideoUrl && (
        <button
          onClick={handleClearAnimation}
          className="absolute top-2 left-2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
          title="Back to image"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Vote score badge (not hovering) */}
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

      {/* Vote buttons (hovering) */}
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

      {/* Hover overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-between p-2 bg-gradient-to-t from-black/75 via-transparent to-transparent
                   transition-all duration-200 pointer-events-none ${hovering ? "opacity-100" : "opacity-0"}`}
      >
        <div />
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
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${hovering ? "opacity-10" : "opacity-0"}`}
      />
    </div>
  );
}
