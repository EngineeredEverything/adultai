"use client";

import type React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";

export function ViewDetailsModal({
  image,
  comments,
  votes,
  categories,
  children,
}: {
  image: {
    cdnUrl: string | undefined;
    user: {
      name: string | null;
      id: string;
    };
    isPublic: boolean;
    userId: string;
    status: string;
    path: string | null;
    id: string;
    createdAt: Date;
    categoryIds: string[];
  };
  comments?: {
    comments: ({
      user: {
        name: string | null;
      };
    } & {
      userId: string;
      imageId: string;
      id: string;
      createdAt: Date;
      comment: string;
    })[];
    count: number | undefined;
  };
  votes?: {
    votes: ({
      user?: {
        name: string | null;
        id: string;
      };
    } & {
      userId: string;
      imageId: string;
      id: string;
      createdAt: Date;
      voteType: "UPVOTE" | "DOWNVOTE";
    })[];
    upvotes: ({
      user?: {
        name: string | null;
        id: string;
      };
    } & {
      userId: string;
      imageId: string;
      id: string;
      createdAt: Date;
      voteType: "UPVOTE" | "DOWNVOTE";
    })[];
    downvotes: ({
      user?: {
        name: string | null;
        id: string;
      };
    } & {
      userId: string;
      imageId: string;
      id: string;
      createdAt: Date;
      voteType: "UPVOTE" | "DOWNVOTE";
    })[];
    count?: number;
    upvoteCount?: number;
    downvoteCount?: number;
    voteScore?: number;
  };
  categories?:
    | {
        id: string;
        name: string;
        keywords: string[];
      }[]
    | undefined;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "processing":
        return "secondary";
      case "failed":
        return "destructive";
      case "flagged":
        return "destructive";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Calculate vote statistics
  const upvoteCount = votes?.upvoteCount || votes?.upvotes?.length || 0;
  const downvoteCount = votes?.downvoteCount || votes?.downvotes?.length || 0;
  const voteScore = votes?.voteScore || upvoteCount - downvoteCount;
  const totalVotes = upvoteCount + downvoteCount;
  const upvotePercentage =
    totalVotes > 0 ? Math.round((upvoteCount / totalVotes) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Image Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Image Preview */}
          {image.cdnUrl && (
            <div className="flex justify-center">
              <img
                src={image.cdnUrl || "/placeholder.svg"}
                alt="Image preview"
                className="max-w-full max-h-64 object-contain rounded-lg border"
              />
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">ID</p>
              <p className="text-sm font-mono">{image.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <Badge variant={getStatusColor(image.status)}>
                {image.status}
              </Badge>
            </div>
          </div>

          {/* User Info */}
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">
              Uploaded by
            </p>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {image.user.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">
                  {image.user.name || "Unknown User"}
                </p>
                <p className="text-xs text-gray-500">{image.user.id}</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Visibility</p>
              <Badge variant={image.isPublic ? "default" : "secondary"}>
                {image.isPublic ? "Public" : "Private"}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Created</p>
              <p className="text-sm">{image.createdAt.toLocaleDateString()}</p>
            </div>
          </div>

          {/* Engagement Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Comments</p>
              <p className="text-sm">{comments?.count || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Votes</p>
              <p className="text-sm">{totalVotes}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Vote Score</p>
              <p
                className={`text-sm font-medium ${
                  voteScore > 0
                    ? "text-green-600"
                    : voteScore < 0
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {voteScore > 0 ? "+" : ""}
                {voteScore}
              </p>
            </div>
          </div>

          {/* Vote Details */}
          {votes && totalVotes > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-3">
                Vote Breakdown
              </p>
              <div className="space-y-3">
                {/* Vote Counts */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Upvotes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{upvoteCount}</span>
                    <span className="text-xs text-gray-500">
                      ({upvotePercentage}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronDown className="h-4 w-4 text-red-600" />
                    <span className="text-sm">Downvotes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{downvoteCount}</span>
                    <span className="text-xs text-gray-500">
                      ({100 - upvotePercentage}%)
                    </span>
                  </div>
                </div>

                {/* Vote Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Vote Distribution</span>
                    <span>{totalVotes} total votes</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${upvotePercentage}%` }}
                    />
                  </div>
                </div>

                {/* Vote Sentiment */}
                <div className="flex items-center gap-2">
                  {voteScore > 0 ? (
                    <>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">
                        Positive Reception
                      </span>
                    </>
                  ) : voteScore < 0 ? (
                    <>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-600 font-medium">
                        Negative Reception
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-600 font-medium">
                      Neutral Reception
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Categories */}
          {categories && categories.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">
                Categories
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge key={category.id} variant="outline">
                    {category.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recent Comments */}
          {comments && comments.comments.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">
                Recent Comments
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {comments.comments.slice(0, 3).map((comment) => (
                  <div
                    key={comment.id}
                    className="p-2 bg-gray-50 rounded text-sm"
                  >
                    <p className="font-medium">
                      {comment.user.name || "Anonymous"}
                    </p>
                    <p className="text-gray-600">{comment.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Votes (if available with user info) */}
          {votes &&
            votes.votes &&
            votes.votes.length > 0 &&
            votes.votes.some((vote) => vote.user) && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">
                  Recent Votes
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {votes.votes
                    .filter((vote) => vote.user)
                    .slice(0, 5)
                    .map((vote) => (
                      <div
                        key={vote.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {vote.user?.name?.charAt(0)?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {vote.user?.name || "Anonymous"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {vote.voteType === "UPVOTE" ? (
                            <ChevronUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-red-600" />
                          )}
                          <span
                            className={`text-xs ${
                              vote.voteType === "UPVOTE"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {vote.voteType.toLowerCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
