"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { LoginButton } from "@/components/auth/login-button";
import { deleteImageAction } from "@/actions/images/delete";
import { searchImages } from "@/actions/images/info";
import { getCurrentUserInfo } from "@/actions/user/info";
import { getTopCategories } from "@/actions/category/info";
import { getSubscriptionInfo } from "@/actions/subscriptions/info";
import { isGetCurrentUserInfoSuccess } from "@/types/user";
import { isGetSubscriptionInfoSuccess } from "@/types/subscriptions";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import type { GetCurrentUserInfoSuccessType } from "@/types/user";
import type { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";
import type { Category } from "../types/image";
import { AnimatePresence } from "framer-motion";
import MobileBottomNav from "../mobile-bottom-nav";
import MobileGenerateSheet from "../GenerationForm/mobile";
import { useRouter, useSearchParams } from "next/navigation";
import Categories from "../Categories";
import { useImageGeneration } from "../hooks/use-image-generation";
import { useImageLoading } from "../hooks/use-image-loading";
import { ImageGrid } from "./ImageGrid";
import { ImageDialog } from "./ImageDialog";
import { toast } from "sonner";
import InputSection from "../GenerationForm/destop";
import { GeneratedImagePreview } from "../GeneratedImagePreview";
import { CompanionFeatureBanner } from "../CompanionFeatureBanner";
import { GallerySortMenu, type SortOption } from "../GallerySortMenu";

const ITEMS_PER_PAGE = 20;
const SKELETON_COUNT = 12;

interface GalleryPageProps {
  userId?: string;
  searchQuery: string;
  userMode?: boolean;
  category_id?: string;
}

export default function GalleryPage(props: GalleryPageProps) {
  const { userId, searchQuery, userMode, category_id } = props;

  // Determine the mode
  const isCategoryMode = !!category_id;
  const isUserMode = !!userMode;
  const isNormalMode = !isCategoryMode && !isUserMode;

  // Data states
  const [user, setUser] = useState<GetCurrentUserInfoSuccessType | undefined>();
  const [images, setImages] = useState<
    SearchImagesResponseSuccessType["images"]
  >([]);
  const [generatedImages, setGeneratedImages] = useState<
    SearchImagesResponseSuccessType["images"]
  >([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<GetSubscriptionInfoSuccessType | null>(null);

  // Loading states
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(
    isNormalMode // Only load categories in normal mode
  );
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(
    isNormalMode // Only load subscription in normal mode
  );

  // UI states
  const [selectedImage, setSelectedImage] = useState<
    SearchImagesResponseSuccessType["images"][number] | null
  >(null);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const searchParams = useSearchParams();
  const router = useRouter();
  const isScrolled = false;

  // Sort images based on selected option
  const sortImages = useCallback((images: SearchImagesResponseSuccessType["images"], sortOption: SortOption) => {
    const sorted = [...images]
    
    switch (sortOption) {
      case "newest":
        return sorted.sort((a, b) => 
          new Date(b.image.createdAt).getTime() - new Date(a.image.createdAt).getTime()
        )
      
      case "popular-week":
      case "popular-month":
      case "popular-year":
      case "popular-all":
        // Sort by vote score (upvotes - downvotes)
        return sorted.sort((a, b) => {
          const scoreA = (a.votes?.upvotes || 0) - (a.votes?.downvotes || 0)
          const scoreB = (b.votes?.upvotes || 0) - (b.votes?.downvotes || 0)
          return scoreB - scoreA
        })
      
      default:
        return sorted
    }
  }, [])

  // Refs for tracking fetch state
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch user info
  useEffect(() => {
    isMountedRef.current = true;

    async function fetchUser() {
      if (!userId) {
        setIsLoadingUser(false);
        return;
      }

      try {
        const result = await getCurrentUserInfo({});
        if (isMountedRef.current && isGetCurrentUserInfoSuccess(result)) {
          setUser(result);
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error("[Gallery] Failed to fetch user info:", error);
          toast.error("Failed to load user information");
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingUser(false);
        }
      }
    }

    fetchUser();

    return () => {
      isMountedRef.current = false;
    };
  }, [userId]);

  // Fetch initial images with abort support
  useEffect(() => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    async function fetchImages() {
      setIsLoadingImages(true);

      try {
        const filters: {
          userId?: string;
          private?: boolean;
          category_id?: string;
        } = {};

        if (isUserMode && userId) {
          filters.userId = userId;
          filters.private = true;
        }

        if (isCategoryMode && category_id) {
          filters.category_id = category_id;
        }

        console.log("[Gallery] Fetching images with params:", {
          searchQuery,
          mode: isCategoryMode ? "category" : isUserMode ? "user" : "normal",
          category_id,
          filters,
        });

        const result = await searchImages({
          query: searchQuery,
          data: {
            limit: {
              start: 0,
              end: ITEMS_PER_PAGE,
            },
            images: {
              comments: { count: true },
              categories: true,
              votes: { count: true },
            },
            count: true,
          },
          ...(Object.keys(filters).length > 0 && { filters }),
        });

        // Check if request was aborted
        if (abortController.signal.aborted) {
          console.log("[Gallery] Request aborted");
          return;
        }

        if (!isMountedRef.current) return;

        if (!("error" in result)) {
          console.log("[Gallery] Fetched images:", {
            count: result.images.length,
            total: result.count,
          });

          setImages(result.images);
          setTotalCount(result.count || 0);
        } else {
          console.error("[Gallery] Error fetching images:", result.error);
          toast.error("Failed to load images");
          setImages([]);
          setTotalCount(0);
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        if (!isMountedRef.current) return;

        console.error("[Gallery] Failed to fetch images:", error);
        toast.error("Failed to load images");
        setImages([]);
        setTotalCount(0);
      } finally {
        if (!abortController.signal.aborted && isMountedRef.current) {
          setIsLoadingImages(false);
        }
      }
    }

    fetchImages();

    return () => {
      abortController.abort();
    };
  }, [searchQuery, isUserMode, isCategoryMode, userId, category_id]);

  // Fetch categories (only in normal mode)
  useEffect(() => {
    if (!isNormalMode) {
      setIsLoadingCategories(false);
      return;
    }

    async function fetchCategories() {
      setIsLoadingCategories(true);
      try {
        const result = await getTopCategories();
        if (isMountedRef.current) {
          setCategories(result);
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error("[Gallery] Failed to fetch categories:", error);
          toast.error("Failed to load categories");
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingCategories(false);
        }
      }
    }

    fetchCategories();
  }, [isNormalMode]);

  // Fetch subscription info (only in normal mode)
  useEffect(() => {
    if (!isNormalMode || !userId) {
      setIsLoadingSubscription(false);
      return;
    }

    async function fetchSubscription() {
      setIsLoadingSubscription(true);
      try {
        const result = await getSubscriptionInfo();
        if (isMountedRef.current && isGetSubscriptionInfoSuccess(result)) {
          setSubscriptionStatus(result);
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error("[Gallery] Failed to fetch subscription:", error);
          toast.error("Failed to load subscription status");
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingSubscription(false);
        }
      }
    }

    fetchSubscription();
  }, [isNormalMode, userId]);

  // Memoize loading params - only update when values actually change
  const loadingParams = useMemo(
    () => ({
      initialImages: images,
      totalCount,
      searchQuery,
      userMode: isUserMode,
      user,
      category_id,
    }),
    [images, totalCount, searchQuery, isUserMode, user, category_id]
  );

  // Use image loading hook for infinite scroll
  const {
    images: unsortedPaginatedImages,
    setImages: setPaginatedImages,
    error: paginationError,
    isLoading: isPaginating,
    loadedImages,
    setLoadedImages,
    hasMore,
    ref: infiniteScrollRef,
  } = useImageLoading(loadingParams);

  // Apply sorting to paginated images
  const paginatedImages = useMemo(
    () => sortImages(unsortedPaginatedImages, sortBy),
    [unsortedPaginatedImages, sortBy, sortImages]
  );

  // Memoize generation hook parameters (only in normal mode)
  const generationParams = useMemo(
    () => ({
      initialImages: generatedImages,
      searchQuery,
      userMode: isUserMode,
      category_id,
      user,
      setImages: setGeneratedImages, // Use separate state for generated images
    }),
    [generatedImages, searchQuery, isUserMode, category_id, user, setGeneratedImages]
  );

  // Use image generation hook (only in normal mode)
  const {
    prompt,
    setPrompt,
    isGenerating,
    handleSubmit,
    setRatio,
    ratio,
    isPublic,
    setIsPublic,
    pendingCount,
    showSignInDialog,
    setShowSignInDialog,
    count,
    setCount,
  } = useImageGeneration(generationParams);

  // Handle mobile sheet close
  const handleMobileSheetClose = useCallback(() => {
    setShowMobileSheet(false);
    router.replace("/gallery");
  }, [router]);

  // Handle image deletion with optimistic update
  const handleDelete = useCallback(
    async (imageId: string) => {
      try {
        // Optimistic update
        const previousImages = paginatedImages;
        setPaginatedImages((prev) =>
          prev.filter((img) => img.image.id !== imageId)
        );
        setImages((prev) => prev.filter((img) => img.image.id !== imageId));
        setSelectedImage(null);

        const result = await deleteImageAction(imageId);

        if ("error" in result) {
          // Rollback on error
          setPaginatedImages(previousImages);
          setImages((prev) => [...prev]);
          throw new Error(result.error);
        }

        toast.success("Image deleted successfully!");
      } catch (error) {
        console.error("[Gallery] Failed to delete image:", error);
        toast.error("Failed to delete image");
      }
    },
    [paginatedImages, setPaginatedImages]
  );

  // Handle mobile sheet state from URL params (only in normal mode)
  useEffect(() => {
    if (!isNormalMode || !searchParams) return;
    const isCreateModelOpen = searchParams.get("create") === "true";
    setShowMobileSheet(isCreateModelOpen);
  }, [isNormalMode, searchParams]);

  // Check if everything is still loading
  const isInitialLoading =
    isLoadingUser ||
    isLoadingImages ||
    (isNormalMode && (isLoadingCategories || isLoadingSubscription));

  // Create skeleton array for initial loading
  const skeletonImages = useMemo(
    () =>
      Array.from({ length: SKELETON_COUNT }, (_, i) => ({ isSkeleton: true })),
    []
  );

  // Determine what images to show
  const displayImages = useMemo(() => {
    if (isLoadingImages) {
      return skeletonImages;
    }

    if (isPaginating && !isInitialLoading && paginatedImages.length > 0) {
      // Show existing images + skeleton loaders at the end
      return [...paginatedImages, ...skeletonImages];
    }

    return paginatedImages;
  }, [
    isLoadingImages,
    isPaginating,
    isInitialLoading,
    paginatedImages,
    skeletonImages,
  ]);

  return (
    <div className={`container mx-auto px-4 py-8 transition-all duration-300`}>
      {/* TOP INPUT SECTION - Only in normal mode */}
      {isNormalMode && (
        <>
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center h-full">
            {isLoadingSubscription || isLoadingUser ? (
              <div className="w-full h-[180px] animate-pulse rounded-xl bg-muted" />
            ) : (
              <InputSection
                userNuts={user?.user?.nuts}
                user={user}
                isScrolled={isScrolled}
                prompt={prompt}
                setPrompt={setPrompt}
                isGenerating={isGenerating}
                handleSubmit={handleSubmit}
                setRatio={setRatio}
                ratio={ratio}
                subscriptionStatus={subscriptionStatus}
                isPublic={isPublic}
                setIsPublic={setIsPublic}
                count={count}
                setCount={setCount}
              />
            )}
          </div>

          {/* COMPANION FEATURE BANNER - Only in normal mode */}
          <CompanionFeatureBanner />

          {/* GENERATED IMAGES PREVIEW - Only in normal mode */}
          <GeneratedImagePreview
            images={generatedImages}
            onPublish={(imageId) => {
              // Move image from generated to public gallery
              const publishedImage = generatedImages.find(
                (img) => img.image.id === imageId
              );
              if (publishedImage) {
                setImages((prev) => [publishedImage, ...prev]);
                setPaginatedImages((prev) => [publishedImage, ...prev]);
                setGeneratedImages((prev) =>
                  prev.filter((img) => img.image.id !== imageId)
                );
              }
            }}
            onDelete={async (imageId) => {
              // Remove from generated images
              setGeneratedImages((prev) =>
                prev.filter((img) => img.image.id !== imageId)
              );
              // Also delete from database
              try {
                await deleteImageAction(imageId);
                toast.success("Image deleted");
              } catch (error) {
                console.error("Error deleting image:", error);
                toast.error("Failed to delete image");
              }
            }}
            onClear={() => {
              setGeneratedImages([]);
            }}
          />

          {/* CATEGORIES - Only in normal mode */}
          <Categories
            categories={isLoadingCategories ? [] : categories}
            isLoading={isLoadingCategories}
          />
        </>
      )}

      {/* SORT MENU */}
      {paginatedImages.length > 0 && (
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {isUserMode
              ? "Your Images"
              : isCategoryMode
              ? "Category Images"
              : "Public Gallery"}
          </h2>
          <GallerySortMenu currentSort={sortBy} onSortChange={setSortBy} />
        </div>
      )}

      {/* PAGINATION ERROR */}
      {paginationError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <span>{paginationError}</span>
          <button
            onClick={() => window.location.reload()}
            className="text-sm underline hover:no-underline"
          >
            Reload
          </button>
        </div>
      )}

      {/* IMAGE GRID OR EMPTY */}
      {!isLoadingImages &&
      paginatedImages.length === 0 &&
      (!isNormalMode || !pendingCount) ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <p className="text-muted-foreground text-lg">No images found</p>
          {searchQuery && (
            <p className="text-sm text-muted-foreground">
              Try adjusting your search query
            </p>
          )}
        </div>
      ) : (
        <ImageGrid
          images={displayImages}
          onImageClick={setSelectedImage}
          loadedImages={loadedImages}
          onDelete={handleDelete}
          user={user}
          tempImages={isNormalMode ? pendingCount : 0}
          setLoadedImages={setLoadedImages}
        />
      )}

      {/* NO MORE IMAGES */}
      {!hasMore &&
        paginatedImages.length > 0 &&
        !isPaginating &&
        !isLoadingImages && (
          <div className="flex justify-center py-8">
            <p className="text-sm text-muted-foreground">
              You&apos;ve reached the end
            </p>
          </div>
        )}

      {/* Infinite Scroll Trigger */}
      {hasMore && paginatedImages.length > 0 && !isLoadingImages && (
        <div
          ref={infiniteScrollRef}
          className="h-20 w-full flex items-center justify-center"
        />
      )}

      {/* Image Dialog */}
      {selectedImage && (
        <ImageDialog
          subscriptionStatus={subscriptionStatus}
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          setSelectedImage={setSelectedImage}
          image={selectedImage}
          onDelete={handleDelete}
          user={user}
        />
      )}

      {/* Login Dialog - Only in normal mode */}
      {isNormalMode && (
        <LoginButton
          isOpen={showSignInDialog}
          onClose={() => setShowSignInDialog(false)}
        >
          <></>
        </LoginButton>
      )}

      {/* Mobile Bottom Nav - Only in normal mode */}
      {isNormalMode && (
        <div className="md:hidden">
          <MobileBottomNav
            user={
              user
                ? {
                    name: user?.user.name || "",
                    image:
                      (user?.images?.images[0] &&
                        user?.images?.images[0].cdnLink) ||
                      "",
                    role: user?.user.role || null,
                    email: user?.user.email || "",
                  }
                : null
            }
            onPlusClick={() => setShowMobileSheet(true)}
          />
        </div>
      )}

      {/* Mobile Generate Sheet - Only in normal mode */}
      {isNormalMode && (
        <AnimatePresence>
          {showMobileSheet && (
            <MobileGenerateSheet
              userNuts={user?.user?.nuts}
              user={user}
              isScrolled={isScrolled}
              prompt={prompt}
              setPrompt={setPrompt}
              isGenerating={isGenerating}
              handleSubmit={handleSubmit}
              setRatio={setRatio}
              ratio={ratio}
              onClose={handleMobileSheetClose}
              subscriptionStatus={subscriptionStatus}
              isPublic={isPublic}
              setIsPublic={setIsPublic}
              count={count}
              setCount={setCount}
            />
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
