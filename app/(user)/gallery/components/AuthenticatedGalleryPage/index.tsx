"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { LoginButton } from "@/components/auth/login-button";
import { deleteImageAction } from "@/actions/images/delete";
import { searchImages } from "@/actions/images/info";
import { getCurrentUserInfo } from "@/actions/user/info";
import { getTopCategories } from "@/actions/category/info";
import { getContentInterests } from "@/actions/user/interests";
import { getKeywordsForInterests } from "@/lib/interests";
import { getSubscriptionInfo } from "@/actions/subscriptions/info";
import { isGetCurrentUserInfoSuccess } from "@/types/user";
import { isGetSubscriptionInfoSuccess } from "@/types/subscriptions";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import type { GetCurrentUserInfoSuccessType } from "@/types/user";
import type { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";
import type { Category } from "../types/image";
import { AnimatePresence } from "framer-motion";
import MobileBottomNav from "../mobile-bottom-nav";
import { useRouter, useSearchParams } from "next/navigation";
import Categories from "../Categories";
import { useImageGeneration } from "../hooks/use-image-generation";
import { useImageLoading } from "../hooks/use-image-loading";
import { ImageGrid } from "./ImageGrid";
import { toast } from "sonner";
import InputSection from "../GenerationForm/destop";
import { GeneratedImagePreview } from "../GeneratedImagePreview";
import { CompanionFeatureBanner } from "../CompanionFeatureBanner";
import { GallerySortMenu, type SortOption } from "../GallerySortMenu";
import { SubcategoryFilter } from "../SubcategoryFilter";
import { PremiumModal } from "../premium-modal";
import dynamic from "next/dynamic";

// Heavy components — lazy loaded to keep initial bundle small
const ImageDialog = dynamic(() => import("./ImageDialog").then((m) => ({ default: m.ImageDialog })), { ssr: false });
const MobileGenerateSheet = dynamic(() => import("../GenerationForm/mobile"), { ssr: false });
const InterestOnboardingModal = dynamic(
  () => import("@/components/ui/interest-selector").then((m) => ({ default: m.InterestOnboardingModal })),
  { ssr: false }
);

const ITEMS_PER_PAGE = 20;
const SKELETON_COUNT = 12;

interface GalleryPageProps {
  userId?: string;
  searchQuery: string;
  userMode?: boolean;
  category_id?: string;
  prefetchedImages?: SearchImagesResponseSuccessType["images"];
  prefetchedCount?: number;
}

export default function GalleryPage(props: GalleryPageProps) {
  const { userId: userIdProp, searchQuery, userMode, category_id, prefetchedImages, prefetchedCount } = props;
  // userId may start undefined (SSR no longer reads session) and gets set after client user fetch
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(userIdProp);
  const userId = resolvedUserId;

  // Determine the mode
  const isCategoryMode = !!category_id;
  const isUserMode = !!userMode;
  const isNormalMode = !isCategoryMode && !isUserMode;

  // Data states — seed with server-prefetched data if available
  const [user, setUser] = useState<GetCurrentUserInfoSuccessType | undefined>();
  const [images, setImages] = useState<SearchImagesResponseSuccessType["images"]>(
    prefetchedImages ?? []
  );
  const [generatedImages, setGeneratedImages] = useState<
    SearchImagesResponseSuccessType["images"]
  >([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<GetSubscriptionInfoSuccessType | null>(null);

  // Loading states
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  // Start in non-loading state if SSR already prefetched images — avoids skeleton flash
  const [isLoadingImages, setIsLoadingImages] = useState(
    !(prefetchedImages && prefetchedImages.length > 0)
  );
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
  // Category-mode specific state
  const [categorySortBy, setCategorySortBy] = useState<"votes_desc" | "newest">("votes_desc");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  // Gender/type filter — applies in normal gallery mode
  const [genderFilter, setGenderFilter] = useState<"female" | "male" | null>(null);
  // Upgrade modal — shown when user hits generation limit
  const [limitModalOpen, setLimitModalOpen] = useState(false);

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

  // Fetch user info — deferred 80ms so images paint first
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
          setResolvedUserId(result.user.id);
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error("[Gallery] Failed to fetch user info:", error);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingUser(false);
        }
      }
    }

    const t = setTimeout(fetchUser, 80);

    return () => {
      clearTimeout(t);
      isMountedRef.current = false;
    };
  }, [userId]);

  // Track total count (seed from prefetch)
  const [prefetchedTotalCount] = useState(prefetchedCount ?? 0);

  // Track whether the category-mode filters have changed from the server-prefetched state
  // (sort changed from default votes_desc, or subcategory selected)
  const categoryFiltersChanged = isCategoryMode && (categorySortBy !== "votes_desc" || activeSubcategory !== null);

  // Fetch initial images with abort support
  // In category mode: skipped on first load if server prefetched (default sort, no sub).
  // Re-runs whenever category sort or subcategory changes.
  useEffect(() => {
    // Skip client fetch only on first load with default settings (SSR already handled it)
    if (prefetchedImages && prefetchedImages.length > 0 && !categoryFiltersChanged) {
      setTotalCount(prefetchedTotalCount);
      setIsLoadingImages(false);
      return;
    }

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
          isPublic?: boolean;
          sort?: "newest" | "votes_desc" | "votes_asc";
        } = {};

        if (isUserMode && userId) {
          filters.userId = userId;
          filters.private = true;
        } else {
          // Public gallery should only show public images
          filters.isPublic = true;
        }

        if (isCategoryMode && category_id) {
          // If subcategory selected, filter by that (it's a co-occurring category)
          filters.category_id = activeSubcategory ?? category_id;
          filters.sort = categorySortBy;
        } else if (!isUserMode) {
          // Map UI sort option → DB sort param
          filters.sort = sortBy === "newest" ? "newest" : "votes_desc";
        }

        if (genderFilter) {
          (filters as any).gender = genderFilter;
        }

        if (process.env.NODE_ENV !== "production") console.log("[Gallery] Fetching images with params:", {
          searchQuery,
          mode: isCategoryMode ? "category" : isUserMode ? "user" : "normal",
          category_id,
          activeSubcategory,
          categorySortBy,
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
              votes: { count: true },
            },
            count: true,
          },
          ...(Object.keys(filters).length > 0 && { filters }),
        });

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        if (!isMountedRef.current) return;

        if (!("error" in result)) {
          setImages(result.images);
          setTotalCount(result.count || 0);
        } else {
          toast.error("Failed to load images");
          setImages([]);
          setTotalCount(0);
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        if (!isMountedRef.current) return;

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
  }, [searchQuery, isUserMode, isCategoryMode, userId, category_id, prefetchedImages, prefetchedTotalCount, categorySortBy, activeSubcategory, categoryFiltersChanged, genderFilter, sortBy]);

  // Fetch categories (only in normal mode) — deferred 200ms so image grid renders first
  useEffect(() => {
    if (!isNormalMode) {
      setIsLoadingCategories(false);
      return;
    }

    async function fetchCategories() {
      setIsLoadingCategories(true);
      try {
        const [result, userInterests] = await Promise.all([
          getTopCategories(),
          userId ? getContentInterests() : Promise.resolve([]),
        ]);
        if (isMountedRef.current) {
          setCategories(result);
          setInterests(userInterests);
          // Show onboarding if user is logged in and has never set interests
          if (userId) {
            const alreadySet = typeof window !== "undefined"
              ? localStorage.getItem("adultai_interests_set")
              : "1";
            if (!alreadySet && userInterests.length === 0) {
              setShowOnboarding(true);
            }
          }
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error("[Gallery] Failed to fetch categories:", error);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingCategories(false);
        }
      }
    }

    const t = setTimeout(fetchCategories, 200);
    return () => clearTimeout(t);
  }, [isNormalMode]);

  // Fetch subscription info (only in normal mode) — deferred 300ms, not blocking render
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
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingSubscription(false);
        }
      }
    }

    const t = setTimeout(fetchSubscription, 300);
    return () => clearTimeout(t);
  }, [isNormalMode, userId]);

  // Memoize loading params - only update when values actually change.
  // `user` is intentionally excluded from deps: user loads 80ms after hydration and
  // including it caused a spurious gallery re-fetch on every page load.
  // useImageLoading reads user via ref internally for userMode filtering.
  const loadingParams = useMemo(
    () => ({
      initialImages: images,
      totalCount,
      searchQuery,
      userMode: isUserMode,
      user,
      category_id,
      subcategory_id: activeSubcategory ?? undefined,
      sort: isCategoryMode ? categorySortBy : (sortBy === "newest" ? "newest" : "votes_desc"),
      gender: (genderFilter as any) ?? undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images, totalCount, searchQuery, isUserMode, category_id, activeSubcategory, categorySortBy, isCategoryMode, genderFilter, sortBy]
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
  // In category mode the server already returns votes_desc — skip client re-sort
  const paginatedImages = useMemo(
    () => isCategoryMode ? unsortedPaginatedImages : sortImages(unsortedPaginatedImages, sortBy),
    [unsortedPaginatedImages, sortBy, sortImages, isCategoryMode]
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
      onLimitReached: () => setLimitModalOpen(true),
    }),
    [generatedImages, searchQuery, isUserMode, category_id, user, setGeneratedImages]
  );

  // Use image generation hook (only in normal mode)
  const {
    prompt,
    setPrompt,
    isGenerating,
    handleSubmit,
    retryPrompt,
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

  // Check if images are still loading — user/subscription/categories are deferred and non-blocking
  const isInitialLoading = isLoadingImages;

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

  // Sort top categories by user interests (matching ones rise to top)
  const sortedCategories = useMemo(() => {
    if (!interests.length) return categories;
    const interestKws = new Set(getKeywordsForInterests(interests));
    return [...categories].sort((a, b) => {
      const scoreA = (a as any).keywords?.filter((k: string) => interestKws.has(k.toLowerCase())).length ?? 0;
      const scoreB = (b as any).keywords?.filter((k: string) => interestKws.has(k.toLowerCase())).length ?? 0;
      return scoreB - scoreA;
    });
  }, [categories, interests]);

  return (
    <div className={`container mx-auto px-4 py-8 transition-all duration-300`}>
      {/* Interest onboarding modal */}
      {showOnboarding && (
        <InterestOnboardingModal
          initialInterests={interests}
          onDone={(newInterests) => {
            setInterests(newInterests);
            setShowOnboarding(false);
          }}
        />
      )}

      {/* MOBILE GENERATE BAR - only on mobile, only in normal mode */}
      {isNormalMode && (
        <div className="md:hidden mb-4">
          <button
            onClick={() => setShowMobileSheet(true)}
            className="w-full flex items-center gap-3 bg-gray-800/60 border border-gray-700/80 rounded-2xl px-4 py-3.5 text-left hover:border-purple-500/50 hover:bg-gray-800 transition-all"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-gray-400 flex-1 text-sm">What will you create today?</span>
            <span className="text-purple-400 text-xs font-semibold">Generate ✨</span>
          </button>
        </div>
      )}

      {/* TOP INPUT SECTION - Only in normal mode */}
      {isNormalMode && (
        <>
          {/* COMPANION FEATURE BANNER - Above the prompt bar */}
          <CompanionFeatureBanner />

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center h-full">
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
          </div>

          {/* GENERATED IMAGES PREVIEW - Only in normal mode, limited to last 8 */}
          <GeneratedImagePreview
            images={generatedImages.slice(0, 8)}
            pendingCount={pendingCount}
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
            onSavePrivate={(imageId) => {
              // Image is already private in DB — just remove from preview
              setGeneratedImages((prev) =>
                prev.filter((img) => img.image.id !== imageId)
              );
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
            onRetry={(promptText) => {
              // Auto-retry with same prompt, new seed
              retryPrompt(promptText);
            }}
            onEdit={(promptText) => {
              // Fill prompt for editing
              setPrompt(promptText);
              toast.info("Edit your prompt and generate again");
            }}
          />

          {/* CATEGORIES - Only in normal mode */}
          <Categories
            categories={isLoadingCategories ? [] : sortedCategories}
            isLoading={isLoadingCategories}
            hasInterests={interests.length > 0}
          />
        </>
      )}

      {/* CATEGORY CONTROLS: subcategory filter chips + sort */}
      {isCategoryMode && category_id && (
        <div className="mb-5 space-y-3">
          {/* Subcategory filter pills */}
          <SubcategoryFilter
            categoryId={category_id}
            activeSub={activeSubcategory}
            onSelect={(id) => {
              setActiveSubcategory(id);
            }}
          />
          {/* Sort pills for category mode */}
          <div className="flex gap-2">
            <button
              onClick={() => setCategorySortBy("votes_desc")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors flex items-center gap-1.5
                ${categorySortBy === "votes_desc"
                  ? "bg-pink-500 text-white border-pink-500"
                  : "border-border hover:bg-muted text-muted-foreground"}`}
            >
              🔥 Most Popular
            </button>
            <button
              onClick={() => setCategorySortBy("newest")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors flex items-center gap-1.5
                ${categorySortBy === "newest"
                  ? "bg-pink-500 text-white border-pink-500"
                  : "border-border hover:bg-muted text-muted-foreground"}`}
            >
              ✨ Newest
            </button>
          </div>
        </div>
      )}

      {/* GENDER FILTER — normal gallery mode */}
      {isNormalMode && (
        <div className="flex gap-2 mb-4">
          {(
            [
              { label: "All",   value: null     },
              { label: "Women", value: "female" },
              { label: "Men",   value: "male"   },
            ] as { label: string; value: "female" | "male" | null }[]
          ).map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setGenderFilter(value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors
                ${genderFilter === value
                  ? "bg-pink-500 text-white border-pink-500"
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* SORT MENU — normal / user mode */}
      {!isCategoryMode && paginatedImages.length > 0 && (
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {isUserMode ? "Your Images" : "Public Gallery"}
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
          tempImages={0}
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
          onSetPrompt={(p) => { setPrompt(p); setSelectedImage(null) }}
          onGenerateVariations={(p) => { setPrompt(p); setSelectedImage(null) }}
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

      {/* Upgrade modal — triggered when generation limit is hit */}
      <PremiumModal
        isOpen={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        feature="unlimited image generation"
        requiredPlan="basic"
      />

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
