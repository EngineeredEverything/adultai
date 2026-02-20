"use client";

import type React from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Heart,
  MessageCircle,
  Edit,
  Trash2,
  Tag,
  X,
  Send,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import { createComment } from "@/actions/comments/create";
import { updateImageSchema } from "@/schemas/images";
import type { z } from "zod";
import { updateImageInfo } from "@/actions/images/update";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { logger } from "@/lib/logger";
import type { GetCurrentUserInfoSuccessType } from "@/types/user";
import { toast } from "sonner";
import type { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";
import { checkFeatureAccess } from "../../GenerationForm/subscription-utils";
import { getRelatedImages } from "@/actions/images/info";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useImageVotes } from "./use-image-votes";
import { ImageVotes } from "./image-votes";
import { cn } from "@/lib/utils";
import { getAllCategoriesResponseSuccessType } from "@/types/categories";
import { getAllCategories } from "@/actions/category/info";
import { ImageActions } from "./ImageActions";

interface ImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  image: SearchImagesResponseSuccessType["images"][number] | null;
  user: GetCurrentUserInfoSuccessType | undefined;
  onDelete: (imageId: string) => void;
  subscriptionStatus: GetSubscriptionInfoSuccessType | null;
  setSelectedImage: (
    image: SearchImagesResponseSuccessType["images"][number] | null
  ) => void;
  onGenerateVariations?: (prompt: string) => void;
  onSetPrompt?: (prompt: string) => void;
}

export function ImageDialog({
  isOpen,
  onClose,
  image,
  user,
  onDelete,
  subscriptionStatus,
  setSelectedImage,
  onGenerateVariations,
  onSetPrompt,
}: ImageDialogProps) {
  const [comments, setComments] = useState<
    {
      id: string;
      comment: string;
      user: { name: string | null };
      userId: string;
      imageId: string;
      createdAt: Date;
    }[]
  >([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [hasPublicSharingAccess, setHasPublicSharingAccess] = useState(false);

  // Categories state
  const [availableCategories, setAvailableCategories] = useState<
    getAllCategoriesResponseSuccessType
  >([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);

  // Related images state
  const [relatedImages, setRelatedImages] = useState<
    SearchImagesResponseSuccessType["images"]
  >([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);

  // Initialize votes hook
  const votes = useImageVotes(image?.image.id || null, user, {
    upvotes: image?.votes?.upvoteCount,
    downvotes: image?.votes?.downvoteCount,
    voteScore: image?.votes?.voteScore,
  });

  // Initialize form with default values
  const form = useForm<z.infer<typeof updateImageSchema>>({
    resolver: zodResolver(updateImageSchema),
    defaultValues: {
      prompt: "",
      isPublic: false,
      categoryIds: [],
    },
  });

  // Fetch available categories
  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const categories = await getAllCategories();
      setAvailableCategories(categories);
    } catch (error) {
      logger.error("Error fetching categories:", error);
      toast.error("Error", {
        description: "Failed to load categories",
      });
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  // Check feature access for public sharing
  useEffect(() => {
    const checkAccess = () => {
      if (subscriptionStatus) {
        try {
          const result = checkFeatureAccess(
            subscriptionStatus,
            "private_sharing"
          );
          setHasPublicSharingAccess(result.hasAccess === true);
        } catch (error) {
          setHasPublicSharingAccess(false);
        }
      } else {
        setHasPublicSharingAccess(false);
      }
    };

    checkAccess();
  }, [subscriptionStatus]);

  // Reset form when image changes
  useEffect(() => {
    if (image) {
      const currentCategoryIds = image.categories?.map((cat) => cat.id) || [];
      form.reset({
        prompt: image.image.prompt || "",
        isPublic: image.image.isPublic || false,
        categoryIds: currentCategoryIds,
      });
    }
  }, [image, form]);

  // Fetch related images
  const fetchRelatedImages = useCallback(async () => {
    if (!image) return;
    setIsLoadingRelated(true);
    setRelatedError(null);
    try {
      const result = await getRelatedImages({
        imageId: image.image.id,
        limit: 12,
      });
      if ("error" in result) {
        setRelatedError("getRelatedImages error!");
        setRelatedImages([]);
      } else {
        setRelatedImages(result.images);
      }
    } catch (error) {
      logger.error("Error fetching related images:", error);
      setRelatedError("Failed to load related images");
      setRelatedImages([]);
    } finally {
      setIsLoadingRelated(false);
    }
  }, [image]);

  // Initialize data when dialog opens
  useEffect(() => {
    if (isOpen && image) {
      setIsLoadingInitial(true);
      if (image.comments) {
        setComments(image.comments.comments || []);
      } else {
        setComments([]);
      }

      fetchRelatedImages();
      fetchCategories();
    }
  }, [isOpen, image, user, fetchRelatedImages, fetchCategories]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setNewComment("");
      setComments([]);
      setIsEditing(false);
      setRelatedImages([]);
      setRelatedError(null);
      setCategoryComboboxOpen(false);
    }
  }, [isOpen]);


  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !image || !newComment.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await createComment(image.image.id, newComment.trim());
      if ("error" in response) {
        throw new Error(response.error);
      }

      const newCommentObj = {
        id: response.id,
        comment: newComment.trim(),
        user: {
          name: user.user.name || "Unknown",
        },
        userId: user.user.id,
        imageId: image.image.id,
        createdAt: new Date(),
      };

      setComments((prev) => [newCommentObj, ...prev]);
      setNewComment("");
    } catch (error) {
      logger.error("Error adding comment:", error);
      toast.error("Error", {
        description: "Failed to add comment",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateImage = async (values: z.infer<typeof updateImageSchema>) => {
    if (!image || !user) return;
    if (image.image.userId !== user.user.id) {
      toast.error("Error", {
        description: "You are not the owner of this image",
      });
      return;
    }

    try {
      // You'll need to update your updateImageInfo function to handle categoryIds
      const response = await updateImageInfo(image.image.id, values);
      if ("error" in response) {
        toast.error("Error", {
          description: response.error,
        });
        return;
      }

      toast.success("Success", {
        description: "Image updated successfully",
      });
      setIsEditing(false);
    } catch (error) {
      logger.error("Error updating image:", error);
      toast.error("Error", {
        description: "Failed to update image",
      });
    }
  };

  const handleDelete = () => {
    if (!image) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this image?"
    );
    if (confirmed) {
      onDelete(image.image.id);
      onClose();
    }
  };

  const handleRelatedImageClick = (
    relatedImage: SearchImagesResponseSuccessType["images"][number]
  ) => {
    setSelectedImage(relatedImage);
  };

  const handleCategoryToggle = (
    categoryId: string,
    currentValues: string[]
  ) => {
    const isSelected = currentValues.includes(categoryId);
    if (isSelected) {
      return currentValues.filter((id) => id !== categoryId);
    } else {
      return [...currentValues, categoryId];
    }
  };

  if (!image) return null;

  const isOwner = user?.user.id === image.image.userId;
  const categories = image.categories || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl max-h-[95vh] p-0 overflow-hidden">
        <div className="flex flex-col max-h-[95vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`/placeholder.svg?height=32&width=32`} />
                <AvatarFallback>
                  {image.image.user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">
                  {image.image.user?.name || "Unknown User"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(image.image.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-8 px-2"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="h-8 px-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 px-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 max-h-[calc(95vh-69px)]">
            <div className="p-4 space-y-6">
              {/* Main Image */}
              <div className="relative w-full max-w-2xl mx-auto bg-muted rounded-lg overflow-hidden">
                {image.image.cdnUrl ? (
                  <div
                    className="relative w-full"
                    style={{
                      aspectRatio: `${image.image.width || 1} / ${
                        image.image.height || 1
                      }`,
                    }}
                  >
                    <Image
                      src={image.image.cdnUrl || "/placeholder.svg"}
                      alt={image.image.prompt || "Generated image"}
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-8">
                    <p className="text-muted-foreground">Image not available</p>
                  </div>
                )}
              </div>

              {/* Image Details */}
              <div className="space-y-4">
                {isEditing ? (
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(updateImage)}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="prompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prompt</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Categories Selection */}
                      <FormField
                        control={form.control}
                        name="categoryIds"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Categories</FormLabel>
                            <Popover
                              open={categoryComboboxOpen}
                              onOpenChange={setCategoryComboboxOpen}
                            >
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-full justify-between",
                                      !field.value?.length &&
                                        "text-muted-foreground"
                                    )}
                                    disabled={isLoadingCategories}
                                  >
                                    {field.value?.length
                                      ? `${field.value.length} categories selected`
                                      : "Select categories"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput placeholder="Search categories..." />
                                  <CommandEmpty>
                                    No categories found.
                                  </CommandEmpty>
                                  <CommandGroup className="max-h-64 overflow-auto">
                                    {availableCategories.map((category) => (
                                      <CommandItem
                                        key={category.id}
                                        onSelect={() => {
                                          const newValue = handleCategoryToggle(
                                            category.id,
                                            field.value || []
                                          );
                                          field.onChange(newValue);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value?.includes(category.id)
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium">
                                            {category.name}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {category.imageCount} images
                                          </div>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              Select categories that best describe this image
                            </FormDescription>
                            <FormMessage />

                            {/* Selected Categories Preview */}
                            {field.value && field.value.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {field.value.map((categoryId) => {
                                  const category = availableCategories.find(
                                    (c) => c.id === categoryId
                                  );
                                  return category ? (
                                    <Badge
                                      key={categoryId}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      <Tag className="w-3 h-3 mr-1" />
                                      {category.name}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 ml-1 hover:bg-transparent"
                                        onClick={() => {
                                          const newValue =
                                            field.value?.filter(
                                              (id) => id !== categoryId
                                            ) || [];
                                          field.onChange(newValue);
                                        }}
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </FormItem>
                        )}
                      />

                      {hasPublicSharingAccess && (
                        <FormField
                          control={form.control}
                          name="isPublic"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Public</FormLabel>
                                <FormDescription>
                                  Make this image visible to others
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      )}
                      <div className="flex gap-2">
                        <Button type="submit" disabled={isLoading}>
                          Save Changes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-3">
                    {image.image.prompt && (
                      <p className="text-sm leading-relaxed">
                        {image.image.prompt}
                      </p>
                    )}

                    {/* Categories */}
                    {categories.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                          <Badge
                            key={category.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            <Tag className="w-3 h-3 mr-1" />
                            {category.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Quick Actions ── */}
                {image && (
                  <ImageActions
                    image={image}
                    onGenerateVariations={onGenerateVariations}
                    onSetPrompt={onSetPrompt}
                  />
                )}

                {/* Interaction Controls */}
                <div className="flex items-center gap-6 py-2">
                  {/* Votes */}
                  <ImageVotes votes={votes} disabled={!user} size="md" />


                  {/* Comments */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageCircle className="w-5 h-5" />
                    <span className="font-medium">{comments.length}</span>
                  </div>
                </div>

                <Separator />

                {/* Comments Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Comments</h4>

                  {/* Comment Form */}
                  {user && (
                    <form onSubmit={handleComment} className="flex gap-2">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage
                          src={`/placeholder.svg?height=32&width=32`}
                        />
                        <AvatarFallback>
                          {user.user.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex gap-2">
                        <Input
                          type="text"
                          ref={commentInputRef}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          disabled={isLoading}
                          className="flex-1"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!newComment.trim() || isLoading}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Comments List */}
                  <div className="space-y-3">
                    {comments.length > 0 ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage
                              src={`/placeholder.svg?height=32&width=32`}
                            />
                            <AvatarFallback>
                              {comment.user.name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">
                                {comment.user.name || "Unknown User"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  comment.createdAt
                                ).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {comment.comment}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No comments yet</p>
                        <p className="text-xs">
                          Be the first to share your thoughts!
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Related Images */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Related Images</h4>

                  {isLoadingRelated ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={index}
                          className="aspect-square bg-muted rounded-lg animate-pulse"
                        />
                      ))}
                    </div>
                  ) : relatedError ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm mb-2">{relatedError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchRelatedImages}
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : relatedImages.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-2">
                        {relatedImages.map((relatedImage) => (
                          <div
                            key={relatedImage.image.id}
                            className="relative aspect-square bg-muted rounded-lg cursor-pointer hover:opacity-80 transition-opacity group overflow-hidden"
                            onClick={() =>
                              handleRelatedImageClick(relatedImage)
                            }
                          >
                            {relatedImage.image.cdnUrl ? (
                              <>
                                <Image
                                  src={
                                    relatedImage.image.cdnUrl ||
                                    "/placeholder.svg"
                                  }
                                  alt={
                                    relatedImage.image.prompt || "Related image"
                                  }
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <p className="text-xs text-muted-foreground">
                                  No image
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="w-16 h-16 mx-auto mb-2 bg-muted rounded-lg flex items-center justify-center">
                        <Tag className="w-8 h-8 opacity-50" />
                      </div>
                      <p className="text-sm">No related images found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
