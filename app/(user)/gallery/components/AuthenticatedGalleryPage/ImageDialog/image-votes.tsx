"use client";

import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { UseImageVotesReturn } from "./use-image-votes";

interface ImageVotesProps {
  votes: UseImageVotesReturn;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "compact" | "detailed";
  className?: string;
}

export function ImageVotes({
  votes,
  disabled = false,
  size = "md",
  variant = "default",
  className,
}: ImageVotesProps) {
  const { userVote, voteStats, isLoading, handleUpvote, handleDownvote } =
    votes;

  const sizeClasses = {
    sm: "h-8 px-2",
    md: "h-9 px-3",
    lg: "h-10 px-4",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2 text-gray-400 hover:text-green-400 hover:bg-gray-800",
            userVote === "UPVOTE" &&
              "text-green-400 bg-green-900/30 hover:bg-green-900/50"
          )}
          onClick={handleUpvote}
          disabled={disabled || isLoading}
        >
          <ChevronUp className="w-3 h-3" />
          <span className="text-xs ml-1">{voteStats.upvotes}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2 text-gray-400 hover:text-red-400 hover:bg-gray-800",
            userVote === "DOWNVOTE" && "text-red-400 bg-red-900/30 hover:bg-red-900/50"
          )}
          onClick={handleDownvote}
          disabled={disabled || isLoading}
        >
          <ChevronDown className="w-3 h-3" />
          <span className="text-xs ml-1">{voteStats.downvotes}</span>
        </Button>

        {Math.abs(voteStats.voteScore) > 0 && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              voteStats.voteScore > 0
                ? "text-green-400 bg-green-900/30"
                : "text-red-400 bg-red-900/30"
            )}
          >
            {voteStats.voteScore > 0 ? "+" : ""}
            {voteStats.voteScore}
          </span>
        )}
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            className={cn(
              sizeClasses[size],
              "flex items-center gap-2 text-gray-400 hover:text-green-400 hover:bg-gray-800",
              userVote === "UPVOTE" &&
                "text-green-400 bg-green-900/30 hover:bg-green-900/50"
            )}
            onClick={handleUpvote}
            disabled={disabled || isLoading}
          >
            <ChevronUp className={iconSizes[size]} />
            <span className="font-medium">{voteStats.upvotes}</span>
            <span className="text-sm">Upvotes</span>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              sizeClasses[size],
              "flex items-center gap-2 text-gray-400 hover:text-red-400 hover:bg-gray-800",
              userVote === "DOWNVOTE" &&
                "text-red-400 bg-red-900/30 hover:bg-red-900/50"
            )}
            onClick={handleDownvote}
            disabled={disabled || isLoading}
          >
            <ChevronDown className={iconSizes[size]} />
            <span className="font-medium">{voteStats.downvotes}</span>
            <span className="text-sm">Downvotes</span>
          </Button>
        </div>

        {voteStats.totalVotes > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Vote Score</span>
              <span
                className={cn(
                  "font-medium",
                  voteStats.voteScore > 0
                    ? "text-green-400"
                    : voteStats.voteScore < 0
                    ? "text-red-400"
                    : "text-gray-400"
                )}
              >
                {voteStats.voteScore > 0 ? "+" : ""}
                {voteStats.voteScore}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{voteStats.upvotePercentage}% upvoted</span>
                <span>{voteStats.totalVotes} total votes</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${voteStats.upvotePercentage}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="ghost"
        className={cn(
          sizeClasses[size],
          "flex items-center gap-2 text-gray-400 hover:text-green-400 hover:bg-gray-800",
          userVote === "UPVOTE" &&
            "text-green-400 bg-green-900/30 hover:bg-green-900/50"
        )}
        onClick={handleUpvote}
        disabled={disabled || isLoading}
      >
        <ChevronUp className={iconSizes[size]} />
        <span className="font-medium">{voteStats.upvotes}</span>
      </Button>

      <Button
        variant="ghost"
        className={cn(
          sizeClasses[size],
          "flex items-center gap-2 text-gray-400 hover:text-red-400 hover:bg-gray-800",
          userVote === "DOWNVOTE" && "text-red-400 bg-red-900/30 hover:bg-red-900/50"
        )}
        onClick={handleDownvote}
        disabled={disabled || isLoading}
      >
        <ChevronDown className={iconSizes[size]} />
        <span className="font-medium">{voteStats.downvotes}</span>
      </Button>

      {Math.abs(voteStats.voteScore) > 0 && (
        <div className="flex items-center gap-1 text-sm">
          {voteStats.voteScore > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
          <span
            className={cn(
              "font-medium",
              voteStats.voteScore > 0 ? "text-green-400" : "text-red-400"
            )}
          >
            {Math.abs(voteStats.voteScore)}
          </span>
        </div>
      )}
    </div>
  );
}
