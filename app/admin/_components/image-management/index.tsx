"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  Download,
  Trash2,
  Check,
  X,
  Flag,
  Eye,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { DeleteModal } from "./DeleteModal";
import { FlagContentModal } from "./FlagContentModal";
import { ViewDetailsModal } from "./ViewDetailsModal";
import { VoteFilters } from "./vote-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useImageManagement } from "./hooks/use-image-management";
import type { getAllCategoriesResponseSuccessType } from "@/types/categories";
import type { SearchImagesResponseSuccessType } from "@/types/images";

interface ImageManagementEnhancedProps {
  categories?: getAllCategoriesResponseSuccessType;
  currentUserId?: string;
  initialData?: {
    images: SearchImagesResponseSuccessType["images"];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  };
  searchParams?: {
    [key: string]: string | string[] | undefined;
  };
  error?: string;
}

export default function ImageManagementEnhanced({
  categories = [],
  currentUserId,
  initialData,
  searchParams,
  error: serverError,
}: ImageManagementEnhancedProps) {
  const {
    // State
    images,
    totalCount,
    currentPage,
    totalPages,
    filters,
    loading,
    error,
    selectedImages,
    hasSelectedImages,
    isAllSelected,

    // Actions
    fetchImages,
    refreshImages,
    deleteImage,
    bulkDeleteImages,
    approveImage,
    rejectImage,
    flagImage,
    unflagImage,
    bulkApprove,
    bulkReject,
    updateFilters,
    clearFilters,
    selectImage,
    deselectImage,
    selectAllImages,
    clearSelection,
    exportImages,
    getImageStats,
  } = useImageManagement(currentUserId, initialData);

  // Initialize filters from search params
  useEffect(() => {
    if (searchParams && !initialData) {
      const getString = (value: string | string[] | undefined) =>
        Array.isArray(value) ? value[0] : value;

      const parseNumber = (value: string | undefined) => {
        const num = value !== undefined ? Number(value) : undefined;
        return isNaN(num as number) ? undefined : num;
      };

      const parseBoolean = (value: string | undefined) => {
        if (value === "true") return true;
        if (value === "false") return false;
        return undefined;
      };

      const initialFilters = {
        search: getString(searchParams.search),
        status:
          getString(searchParams.status) !== "all"
            ? getString(searchParams.status)
            : undefined,
        categoryId:
          getString(searchParams.category_id) !== "all"
            ? getString(searchParams.category_id)
            : undefined,
        isPublic:
          getString(searchParams.isPublic) !== "all"
            ? getString(searchParams.isPublic) === "true"
            : undefined,
        userId: getString(searchParams.userId),
        page: parseNumber(getString(searchParams.page)),
        limit: parseNumber(getString(searchParams.limit)),
        // Vote filters
        minUpvotes: parseNumber(getString(searchParams.minUpvotes)),
        maxUpvotes: parseNumber(getString(searchParams.maxUpvotes)),
        minDownvotes: parseNumber(getString(searchParams.minDownvotes)),
        maxDownvotes: parseNumber(getString(searchParams.maxDownvotes)),
        minVoteScore: parseNumber(getString(searchParams.minVoteScore)),
        maxVoteScore: parseNumber(getString(searchParams.maxVoteScore)),
        hasVotes: parseBoolean(getString(searchParams.hasVotes)),
        voteRatio: getString(searchParams.voteRatio) as
          | "positive"
          | "negative"
          | "neutral"
          | undefined,
      };
      fetchImages(initialFilters);
    }
  }, [searchParams, initialData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "flagged":
        return <Flag className="h-4 w-4 text-orange-500" />;
      case "rejected":
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

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
        return "outline";
      default:
        return "secondary";
    }
  };

  // Show server error if present
  const displayError = serverError || error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Image Management</h1>
          <p className="text-muted-foreground">
            Manage and moderate generated images ({totalCount} total)
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            disabled={loading}
          >
            Clear Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportImages("csv")}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportImages("json")}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {displayError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by prompt, user, or image ID..."
              value={filters.search || ""}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="pl-10"
              disabled={loading}
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                updateFilters({ status: value === "all" ? undefined : value })
              }
            >
              <SelectTrigger disabled={loading}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.categoryId || "all"}
              onValueChange={(value) =>
                updateFilters({
                  categoryId: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger disabled={loading}>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name} ({category.imageCount || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.isPublic?.toString() || "all"}
              onValueChange={(value) =>
                updateFilters({
                  isPublic: value === "all" ? undefined : value === "true",
                })
              }
            >
              <SelectTrigger disabled={loading}>
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Images</SelectItem>
                <SelectItem value="true">Public Only</SelectItem>
                <SelectItem value="false">Private Only</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.sortBy || "createdAt"}
              onValueChange={(value) => updateFilters({ sortBy: value as any })}
            >
              <SelectTrigger disabled={loading}>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Created Date</SelectItem>
                <SelectItem value="comments">Comments</SelectItem>
                <SelectItem value="upvotes">Upvotes</SelectItem>
                <SelectItem value="downvotes">Downvotes</SelectItem>
                <SelectItem value="voteScore">Vote Score</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.voteRatio || "all"}
              onValueChange={(value) =>
                updateFilters({
                  voteRatio: value === "all" ? undefined : (value as any),
                })
              }
            >
              <SelectTrigger disabled={loading}>
                <SelectValue placeholder="Vote Ratio(Upvote & Downvote)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratios</SelectItem>
                <SelectItem value="positive">Most Upvoted</SelectItem>
                <SelectItem value="negative">Most Downvotes</SelectItem>
                <SelectItem value="neutral">Equal Upvotes & Downvotes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vote Filters */}
      <VoteFilters
        filters={{
          minUpvotes: filters.minUpvotes,
          maxUpvotes: filters.maxUpvotes,
          minDownvotes: filters.minDownvotes,
          maxDownvotes: filters.maxDownvotes,
          minVoteScore: filters.minVoteScore,
          maxVoteScore: filters.maxVoteScore,
          hasVotes: filters.hasVotes,
          voteRatio: filters.voteRatio,
        }}
        onFiltersChange={updateFilters}
        disabled={loading}
      />

      {/* Bulk Actions */}
      {hasSelectedImages && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedImages.length} image
                  {selectedImages.length !== 1 ? "s" : ""} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={loading}
                >
                  Clear Selection
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkApprove(selectedImages)}
                  disabled={loading}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkReject(selectedImages)}
                  disabled={loading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject All
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => bulkDeleteImages(selectedImages)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Images Grid */}
      <div className="space-y-4">
        {/* Select All */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={(checked) => {
              if (checked) {
                selectAllImages();
              } else {
                clearSelection();
              }
            }}
            disabled={loading || images.length === 0}
          />
          <span className="text-sm text-muted-foreground">
            Select all images on this page
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading images...</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map(({ image, comments, votes, categories }) => (
            <Card key={image.id} className="overflow-hidden">
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative">
                <img
                  src={image.imageUrl || image.cdnUrl || "/placeholder.svg"}
                  alt={image.prompt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                {/* Selection Checkbox */}
                <div className="absolute top-2 left-2">
                  <Checkbox
                    checked={selectedImages.includes(image.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectImage(image.id);
                      } else {
                        deselectImage(image.id);
                      }
                    }}
                    className="bg-white/80 border-white"
                  />
                </div>

                {/* Actions Menu */}
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ViewDetailsModal
                        image={image}
                        comments={{
                          comments: comments?.comments || [],
                          count: comments?.count,
                        }}
                        votes={{
                          votes: votes?.votes || [],
                          upvotes: votes?.upvotes || [],
                          downvotes: votes?.downvotes || [],
                          count: votes?.count,
                          upvoteCount: votes?.upvoteCount,
                          downvoteCount: votes?.downvoteCount,
                          voteScore: votes?.voteScore,
                        }}
                        categories={categories}
                      >
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                      </ViewDetailsModal>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={() => approveImage(image.id)}>
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </DropdownMenuItem>

                      <FlagContentModal
                        image={image}
                        onConfirm={(imageId, status, reason) => {
                          if (status === "flagged") {
                            flagImage(imageId, reason);
                          } else {
                            rejectImage(imageId, reason);
                          }
                        }}
                      >
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Flag className="h-4 w-4 mr-2" />
                          Flag Content
                        </DropdownMenuItem>
                      </FlagContentModal>

                      <DropdownMenuSeparator />

                      <DeleteModal
                        image={image}
                        onConfirm={(imageId, reason) =>
                          deleteImage(imageId, reason)
                        }
                      >
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DeleteModal>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Status Badge */}
                <div className="absolute bottom-2 left-2">
                  <Badge
                    variant={getStatusColor(image.status)}
                    className="text-xs"
                  >
                    {getStatusIcon(image.status)}
                    <span className="ml-1">{image.status}</span>
                  </Badge>
                </div>

                {/* Privacy Badge */}
                {!image.isPublic && (
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="outline" className="text-xs">
                      Private
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-sm line-clamp-2">
                    {image.prompt}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>by {image.user?.name || "Unknown"}</span>
                    <span>
                      {new Date(image.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span>💬 {comments?.count || 0}</span>
                      {/* Vote display */}
                      {votes && (votes.upvoteCount || 0) > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <ChevronUp className="h-3 w-3" />
                          {votes.upvoteCount}
                        </span>
                      )}
                      {votes && (votes.downvoteCount || 0) > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <ChevronDown className="h-3 w-3" />
                          {votes.downvoteCount}
                        </span>
                      )}
                      {votes &&
                        votes.voteScore !== undefined &&
                        votes.voteScore !== 0 && (
                          <span
                            className={`font-medium ${
                              votes.voteScore > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {votes.voteScore > 0 ? "+" : ""}
                            {votes.voteScore}
                          </span>
                        )}
                    </div>
                    <span className="text-muted-foreground">
                      ID: {image.id.slice(-8)}
                    </span>
                  </div>

                  {categories && categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {categories.slice(0, 2).map((category) => (
                        <Badge
                          key={category.id}
                          variant="outline"
                          className="text-xs"
                        >
                          {category.name}
                        </Badge>
                      ))}
                      {categories.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{categories.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilters({ page: currentPage - 1 })}
              disabled={currentPage <= 1 || loading}
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateFilters({ page })}
                    disabled={loading}
                    className="w-8 h-8 p-0"
                  >
                    {page}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilters({ page: currentPage + 1 })}
              disabled={currentPage >= totalPages || loading}
            >
              Next
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && images.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">No images found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your filters or search terms
                  </p>
                </div>
                <Button variant="outline" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
