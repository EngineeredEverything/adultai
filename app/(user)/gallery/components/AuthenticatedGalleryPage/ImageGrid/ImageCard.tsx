"use client";

import { Badge } from "@/components/ui/badge";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import type { GetCurrentUserInfoSuccessType } from "@/types/user";
import { Lock, TrendingUp, TrendingDown, Film, Loader2, Play, X, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { createVote } from "@/actions/votes/create";
import { showAuthToast, isAuthError } from "@/lib/auth-toast";

const BUNNY_CDN = "adultai-com.b-cdn.net";

function getBunnyUrl(url: string, width = 600, quality = 80): string {
  if (!url) return "";
  if (!url.includes(BUNNY_CDN)) return url;
  const base = url.split("?")[0];
  return `${base}?width=${width}&format=webp&quality=${quality}`;
}

function getImageSrc(image: SearchImagesResponseSuccessType["images"][number]["image"]): string {
  const url = image.cdnUrl || image.imageUrl || "";
  return getBunnyUrl(url) || url || "/placeholder.png";
}

export function ImageCard({
  image,
  isLoaded,
  onClick,
  onLoad,
  onError,
  onDelete,
  user,
  isAdmin = false,
  index,
}: {
  image: SearchImagesResponseSuccessType["images"][number];
  isLoaded: boolean;
  onClick: () => void;
  onLoad: () => void;
  onError: () => void;
  onDelete?: (imageId: string) => void;
  user?: GetCurrentUserInfoSuccessType;
  isAdmin?: boolean;
  index: number;
}) {
  const [hovering, setHovering] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedVideoUrl, setAnimatedVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [userVote, setUserVote] = useState<"UPVOTE" | "DOWNVOTE" | null>((image.votes as any)?.userVote || null);
  const [voteScore, setVoteScore] = useState(image.votes?.voteScore || 0);
  const [upvotes, setUpvotes] = useState(image.votes?.upvoteCount || 0);
  const [downvotes, setDownvotes] = useState(image.votes?.downvoteCount || 0);
  const [isVoting, setIsVoting] = useState(false);

  const isOwner = !!user && user.user.id === image.image.userId;
  const canDelete = (isOwner || isAdmin) && !!onDelete;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (!window.confirm("Delete this image?")) return;
    onDelete(image.image.id);
  };

  // Compute aspect ratio — default 2:3 portrait if missing/bad
  const w = Number(image.image.width) || 512;
  const h = Number(image.image.height) || 768;
  const paddingTop = `${(h / w) * 100}%`;

  const handleQuickAnimate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnimating || animatedVideoUrl) return;
    const src = image.image.cdnUrl || image.image.imageUrl;
    if (!src) return;
    setIsAnimating(true);
    try {
      const res = await fetch("/api/image-to-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: src, frames: 25, fps: 8, motionStrength: 100 }),
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

  const handleVote = async (e: React.MouseEvent, voteType: "UPVOTE" | "DOWNVOTE") => {
    e.stopPropagation();
    if (isVoting) return;
    setIsVoting(true);
    try {
      const res = await createVote(image.image.id, voteType);
      if ("error" in res) {
        if (isAuthError(res.error)) { showAuthToast("vote"); return; }
        throw new Error(res.error);
      }
      setUserVote(res.userVote);
      setVoteScore(res.voteScore || 0);
      setUpvotes(res.upvotes || 0);
      setDownvotes(res.downvotes || 0);
    } catch {
      toast.error("Failed to vote");
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-shadow"
      style={{ paddingTop }}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Inner absolute fill — image/video sits inside the aspect-ratio box */}
      <div className="absolute inset-0 bg-gray-900">
        {animatedVideoUrl ? (
          <video
            ref={videoRef}
            src={animatedVideoUrl}
            className="w-full h-full object-cover"
            autoPlay loop muted playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageSrc(image.image)}
            alt={image.image.prompt || "Generated image"}
            className="w-full h-full object-cover"
            loading={index < 8 ? "eager" : "lazy"}
            fetchPriority={index < 4 ? "high" : "auto"}
            decoding="async"
            onLoad={onLoad}
            onError={onError}
          />
        )}
      </div>

      {/* Animating overlay */}
      {isAnimating && (
        <div className="absolute inset-0 z-20 bg-black/60 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
          <span className="text-white text-xs font-medium">Animating...</span>
        </div>
      )}

      {/* Clear animation button */}
      {animatedVideoUrl && (
        <button onClick={(e) => { e.stopPropagation(); setAnimatedVideoUrl(null); }}
          className="absolute top-2 left-2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-1">
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Vote score (not hovering) */}
      {Math.abs(voteScore) > 0 && !hovering && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className={`text-xs px-1.5 py-0.5 flex items-center gap-1 ${voteScore > 0 ? "bg-green-500/80" : "bg-red-500/80"} text-white`}>
            {voteScore > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(voteScore)}
          </Badge>
        </div>
      )}

      {/* Hover overlay */}
      {hovering && (
        <div className="absolute inset-0 z-10 flex flex-col justify-between p-2 bg-gradient-to-t from-black/75 via-transparent to-transparent">
          {/* Vote buttons top-right */}
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={(e) => handleVote(e, "UPVOTE")} disabled={isVoting}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold shadow-lg transition-all
                ${userVote === "UPVOTE" ? "bg-green-500 text-white" : "bg-black/60 hover:bg-green-500 text-white"} disabled:opacity-50`}>
              <ThumbsUp className={`w-3.5 h-3.5 transition-all ${userVote === "UPVOTE" ? "fill-white stroke-white" : ""}`} />{upvotes > 0 && <span>{upvotes}</span>}
            </button>
            <button onClick={(e) => handleVote(e, "DOWNVOTE")} disabled={isVoting}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold shadow-lg transition-all
                ${userVote === "DOWNVOTE" ? "bg-red-500 text-white" : "bg-black/60 hover:bg-red-500 text-white"} disabled:opacity-50`}>
              <ThumbsDown className={`w-3.5 h-3.5 transition-all ${userVote === "DOWNVOTE" ? "fill-white stroke-white" : ""}`} />{downvotes > 0 && <span>{downvotes}</span>}
            </button>
          </div>

          {/* Bottom: prompt + actions */}
          <div className="flex flex-col gap-1.5">
            {image.image.prompt && (
              <p className="text-white/90 text-[10px] line-clamp-2 leading-tight">{image.image.prompt}</p>
            )}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {!image.image.isPublic && (
                <Badge variant="outline" className="flex gap-1 items-center text-[10px] bg-black/40 border-white/20 text-white py-0">
                  <Lock className="w-2.5 h-2.5" />Private
                </Badge>
              )}
              <div className="ml-auto flex gap-1">
                {!animatedVideoUrl ? (
                  <button onClick={handleQuickAnimate} disabled={isAnimating}
                    className="p-1.5 bg-pink-600/80 hover:bg-pink-600 text-white rounded-lg transition-colors disabled:opacity-60" title="Animate">
                    {isAnimating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Film className="w-3 h-3" />}
                  </button>
                ) : (
                  <a href={animatedVideoUrl} download="animation.mp4"
                    className="p-1.5 bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition-colors" title="Download">⬇</a>
                )}
                {canDelete && (
                  <button onClick={handleDelete}
                    className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <button onClick={onClick}
                  className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors backdrop-blur-sm" title="Open">
                  <Play className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
