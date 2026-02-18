"use client"

import { logger } from "@/lib/logger"
import { useCallback, useEffect, useRef, useState } from "react"
import { ITEMS_PER_PAGE, LOAD_TIMEOUT } from "../data/constants"
import { searchImages } from "@/actions/images/info"
import type { SearchImagesResponseSuccessType } from "@/types/images"
import { useInView } from "react-intersection-observer"
import type { GetCurrentUserInfoSuccessType } from "@/types/user"

interface UseImageLoadingParams {
    initialImages: SearchImagesResponseSuccessType["images"]
    totalCount: number
    searchQuery: string
    userMode?: boolean
    user: GetCurrentUserInfoSuccessType | undefined
    category_id?: string
}

export function useImageLoading(params: UseImageLoadingParams) {
    const { initialImages, totalCount, searchQuery, userMode, user, category_id } = params

    // Core state
    const [images, setImages] = useState<SearchImagesResponseSuccessType["images"]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({})

    // Critical refs to prevent duplicate requests
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isLoadingRef = useRef(false)
    const isMountedRef = useRef(true)
    const currentRequestRef = useRef<Promise<any> | null>(null)
    const lastSuccessfulPageRef = useRef(0) // Track last successfully loaded page
    const loadedPagesRef = useRef<Set<string>>(new Set()) // Track which page ranges were loaded

    // Track search params to detect changes
    const searchParamsRef = useRef({
        query: searchQuery,
        userMode: userMode || false,
        userId: user?.user.id,
        category_id: category_id,
    })

    // Intersection observer with optimized settings
    const { ref, inView } = useInView({
        threshold: 0,
        rootMargin: '200px',
        triggerOnce: false,
    })

    // Check if search params changed
    const hasSearchParamsChanged = useCallback(() => {
        const prev = searchParamsRef.current
        return (
            prev.query !== searchQuery ||
            prev.userMode !== (userMode || false) ||
            prev.userId !== user?.user.id ||
            prev.category_id !== category_id
        )
    }, [searchQuery, userMode, user?.user.id, category_id])

    // Initialize state with initial images
    useEffect(() => {
        if (!isMountedRef.current) return

        const paramsChanged = hasSearchParamsChanged()

        // Update search params ref
        searchParamsRef.current = {
            query: searchQuery,
            userMode: userMode || false,
            userId: user?.user.id,
            category_id: category_id,
        }

        // Only reset if params changed or initial load
        if (paramsChanged || images.length === 0) {
            logger.info('[useImageLoading] Initializing/Resetting state', {
                paramsChanged,
                initialImagesCount: initialImages.length,
                totalCount,
            })

            // Reset all state and refs
            setImages(initialImages)
            setHasMore(initialImages.length < totalCount && totalCount > 0)
            setError(null)
            setIsLoading(false)
            isLoadingRef.current = false
            currentRequestRef.current = null
            lastSuccessfulPageRef.current = initialImages.length > 0 ? 1 : 0
            loadedPagesRef.current = new Set()

            // Mark initial page as loaded if we have images
            if (initialImages.length > 0) {
                loadedPagesRef.current.add('0-20')
            }

            // Initialize loaded images tracking
            const newLoadedImages: Record<string, boolean> = {}
            initialImages.forEach((img) => {
                newLoadedImages[img.image.id] = false
            })
            setLoadedImages(newLoadedImages)

            // Clear any pending timeouts
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [initialImages, totalCount, searchQuery, userMode, user?.user.id, category_id])

    // Generate page key for tracking
    const getPageKey = (start: number, end: number) => `${start}-${end}`

    // Load more images function with strict duplicate prevention
    const loadMoreImages = useCallback(async () => {
        // CRITICAL GUARDS - Check everything before proceeding
        if (!isMountedRef.current) {
            logger.debug('[useImageLoading] Not mounted, skipping')
            return
        }

        if (isLoadingRef.current) {
            logger.debug('[useImageLoading] Already loading (ref check), skipping')
            return
        }

        if (currentRequestRef.current !== null) {
            logger.debug('[useImageLoading] Request already in progress (promise check), skipping')
            return
        }

        if (!hasMore) {
            logger.debug('[useImageLoading] No more images to load')
            return
        }

        if (images.length === 0) {
            logger.debug('[useImageLoading] No initial images yet')
            return
        }

        const pageStart = images.length
        const pageEnd = pageStart + ITEMS_PER_PAGE
        const pageKey = getPageKey(pageStart, pageEnd)

        // CHECK IF THIS PAGE WAS ALREADY LOADED
        if (loadedPagesRef.current.has(pageKey)) {
            logger.warn('[useImageLoading] Page already loaded, skipping', { pageKey })
            return
        }

        // CHECK IF THIS IS THE SAME AS LAST SUCCESSFUL PAGE
        const expectedPage = lastSuccessfulPageRef.current + 1
        const currentPage = Math.floor(pageStart / ITEMS_PER_PAGE) + 1
        if (currentPage < expectedPage) {
            logger.warn('[useImageLoading] Page already processed, skipping', {
                currentPage,
                expectedPage,
                pageStart,
            })
            return
        }

        // Lock everything
        isLoadingRef.current = true
        setIsLoading(true)
        setError(null)

        logger.info('[useImageLoading] Starting load', {
            pageStart,
            pageEnd,
            pageKey,
            currentPage,
            currentImagesCount: images.length,
            totalCount,
        })

        try {
            // Create the request promise
            const requestPromise = (async () => {
                // Set timeout
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutRef.current = setTimeout(() => {
                        reject(new Error('Request timeout'))
                    }, LOAD_TIMEOUT)
                })

                // Build filters
                const filters: Record<string, any> = {}
                if (userMode && user?.user.id) {
                    filters.userId = user.user.id
                    filters.private = true
                }
                if (category_id) {
                    filters.category_id = category_id
                }

                // Make the fetch request
                const fetchPromise = searchImages({
                    query: searchQuery,
                    data: {
                        limit: {
                            start: pageStart,
                            end: pageEnd,
                        },
                        images: {
                            comments: { count: true },
                            categories: true,
                            votes: { count: true },
                        },
                        count: true,
                    },
                    ...(Object.keys(filters).length > 0 && { filters }),
                })

                // Race between fetch and timeout
                const result = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>

                return result
            })()

            // Store the current request
            currentRequestRef.current = requestPromise

            // Wait for the request to complete
            const result = await requestPromise

            // Clear timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }

            if (!isMountedRef.current) {
                logger.debug('[useImageLoading] Component unmounted during request')
                return
            }

            if ("error" in result) {
                throw new Error(result.error)
            }

            const { images: newImages, count: newCount } = result

            logger.info('[useImageLoading] Request successful', {
                newImagesCount: newImages.length,
                pageKey,
                currentPage,
            })

            if (newImages.length === 0) {
                setHasMore(false)
                logger.info('[useImageLoading] No more images available')
                return
            }

            // Mark this page as loaded BEFORE updating state
            loadedPagesRef.current.add(pageKey)
            lastSuccessfulPageRef.current = currentPage

            // Update state in single batch
            setImages((prev) => {
                const combined = [...prev, ...newImages]
                const shouldHaveMore = combined.length < (newCount || totalCount)

                setHasMore(shouldHaveMore)

                logger.info('[useImageLoading] State updated', {
                    previousCount: prev.length,
                    newCount: combined.length,
                    hasMore: shouldHaveMore,
                    loadedPages: Array.from(loadedPagesRef.current),
                })

                return combined
            })

            // Update loaded images tracking
            setLoadedImages((prev) => {
                const updates: Record<string, boolean> = {}
                newImages.forEach((img) => {
                    updates[img.image.id] = false
                })
                return { ...prev, ...updates }
            })

        } catch (err) {
            if (!isMountedRef.current) return

            const errorMessage = err instanceof Error ? err.message : "Failed to load images"
            logger.error('[useImageLoading] Error loading images', { error: err, pageKey })

            setError(errorMessage)

            // Don't completely disable loading on timeout
            if (errorMessage !== 'Request timeout') {
                setHasMore(false)
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false)
                isLoadingRef.current = false
                currentRequestRef.current = null
            }

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [images.length, hasMore, searchQuery, userMode, user?.user.id, category_id, totalCount])

    // Handle infinite scroll trigger - STRICT CONTROL
    useEffect(() => {
        // Multiple guard checks
        if (!inView) return
        if (!isMountedRef.current) return
        if (isLoadingRef.current) return
        if (currentRequestRef.current !== null) return
        if (!hasMore) return
        if (images.length === 0) return

        logger.debug('[useImageLoading] Scroll trigger activated')

        // Debounce with longer delay to prevent rapid triggers
        const debounceTimer = setTimeout(() => {
            // Re-check all conditions after debounce
            if (
                isMountedRef.current &&
                inView &&
                hasMore &&
                !isLoadingRef.current &&
                currentRequestRef.current === null &&
                images.length > 0
            ) {
                logger.debug('[useImageLoading] Debounce completed, loading more')
                loadMoreImages()
            }
        }, 300) // Increased debounce to 300ms

        return () => clearTimeout(debounceTimer)
    }, [inView, hasMore, images.length]) // Removed loadMoreImages from deps to prevent recreation

    // Manual trigger function (if needed by parent)
    const manualLoadMore = useCallback(() => {
        if (!isLoadingRef.current && currentRequestRef.current === null && hasMore) {
            loadMoreImages()
        }
    }, [hasMore, loadMoreImages])

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true

        return () => {
            isMountedRef.current = false
            isLoadingRef.current = false
            currentRequestRef.current = null

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [])

    return {
        images,
        setImages,
        isLoading,
        error,
        loadedImages,
        setLoadedImages,
        hasMore,
        ref,
        manualLoadMore, // Expose manual trigger if needed
    }
}
