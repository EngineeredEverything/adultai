"use client"

import { useState, useCallback, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { exportImagesAction, getImageStatsAction, searchImages } from "@/actions/images/info"
import { buildFilters } from "../utils/params"
import { SearchImagesResponseSuccessType } from "@/types/images"
import { bulkApproveAction, bulkRejectAction, updateImageInfo } from "@/actions/images/update"
import { deleteImageAction, deleteMultipleImages } from "@/actions/images/delete"
import { createComment } from "@/actions/comments/create"
import { deleteCommentAction } from "@/actions/comments/delete"
import { getAllCategories } from "@/actions/category/info"
import { getAllCategoriesResponseSuccessType } from "@/types/categories"
import { assignCategoryAction } from "@/actions/category/update"
import { removeCategoryAction } from "@/actions/category/delete"

// Types based on your Prisma schema
export interface GeneratedImage {
    id: string
    userId: string
    user: {
        id: string
        name: string | null
        email?: string
    }
    prompt: string
    negativePrompt: string | null
    imageUrl: string | null
    cdnUrl?: string
    seed: number | null
    modelId: string | null
    steps: number | null
    cfg: number | null
    sampler: string | null
    costNuts: number
    createdAt: Date
    updatedAt: Date
    isPublic: boolean
    verified: Date | null
    width: number | null
    height: number | null
    path: string | null
    status: string
    taskId: string | null
    eta: number | null
    progress: number | null
    futureLinks: string[]
    categoryIds: string[]
    categories?: getAllCategoriesResponseSuccessType
    comments?: ImageComment[]
}

export interface ImageComment {
    id: string
    userId: string
    user: {
        id: string
        name: string | null
    }
    imageId: string
    comment: string
    createdAt: Date
}


// Updated interface with vote filters
export interface ImageFilters {
    search?: string
    status?: string
    categoryId?: string
    isPublic?: boolean
    userId?: string
    page?: number
    limit?: number
    sortBy?: "createdAt" | "comments" | "status" | "upvotes" | "downvotes" | "voteScore"
    sortOrder?: "asc" | "desc"
    private?: boolean
    // Vote filters
    minUpvotes?: number
    maxUpvotes?: number
    minDownvotes?: number
    maxDownvotes?: number
    minVoteScore?: number
    maxVoteScore?: number
    hasVotes?: boolean
    voteRatio?: "positive" | "negative" | "neutral"
}

export interface ImageManagementState {
    images: SearchImagesResponseSuccessType["images"]
    totalCount: number
    currentPage: number
    totalPages: number
    filters: ImageFilters
    loading: boolean
    error: string | null
    selectedImages: string[]
    categories: getAllCategoriesResponseSuccessType
}

const initialState: ImageManagementState = {
    images: [],
    totalCount: 0,
    currentPage: 1,
    totalPages: 0,
    filters: {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
    },
    loading: false,
    error: null,
    selectedImages: [],
    categories: [],
}

export function useImageManagement(currentUserId?: string, initialData?: {
    images: SearchImagesResponseSuccessType["images"];
    totalCount: number;
    currentPage: number;
    totalPages: number;
}) {
    const [state, setState] = useState<ImageManagementState>({
        ...initialState,
        // Initialize with server data if provided
        ...(initialData && {
            images: initialData.images || [],
            totalCount: initialData.totalCount || 0,
            currentPage: initialData.currentPage || 1,
            totalPages: initialData.totalPages || 0,
        }),
    })
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    // Helper function to update state
    const updateState = useCallback((updates: Partial<ImageManagementState>) => {
        setState((prev) => ({ ...prev, ...updates }))
    }, [])

    // Server action wrapper with error handling
    const executeAction = useCallback(
        async (
            action: () => Promise<{ success: boolean; data?: any; error?: string }>,
            onSuccess?: (data: any) => void,
            onError?: (error: string) => void,
        ): Promise<any | null> => {
            try {
                updateState({ error: null })
                const result = await action()

                if (result.success && result.data) {
                    onSuccess?.(result.data)
                    return result.data
                } else {
                    const errorMessage = result.error || "An error occurred"
                    updateState({ error: errorMessage })
                    onError?.(errorMessage)
                    return null
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
                updateState({ error: errorMessage })
                onError?.(errorMessage)
                console.error("Action Error:", error)
                return null
            }
        },
        [updateState],
    )

    // Updated fetchImages with vote filters support
    const fetchImages = useCallback(
        async (filters?: ImageFilters) => {
            const mergedFilters = { ...state.filters, ...filters }

            startTransition(async () => {
                updateState({ loading: true })

                try {
                    // Parse filters to match your searchImages format
                    const pageStart = ((mergedFilters.page || 1) - 1) * (mergedFilters.limit || 20)
                    const pageEnd = pageStart + (mergedFilters.limit || 20)

                    // Build filters object for searchImages including vote filters
                    const searchFilters = buildFilters({
                        search: mergedFilters.search || "",
                        status: mergedFilters.status || "all",
                        category_id: mergedFilters.categoryId || "all",
                        isPublic: mergedFilters.isPublic?.toString() || "all",
                        userId: mergedFilters.userId || "",
                        page: mergedFilters.page || 1,
                        limit: mergedFilters.limit || 20,
                        private: mergedFilters.private?.toString() || "all",
                        // Vote filters
                        minUpvotes: mergedFilters.minUpvotes,
                        maxUpvotes: mergedFilters.maxUpvotes,
                        minDownvotes: mergedFilters.minDownvotes,
                        maxDownvotes: mergedFilters.maxDownvotes,
                        minVoteScore: mergedFilters.minVoteScore,
                        maxVoteScore: mergedFilters.maxVoteScore,
                        hasVotes: mergedFilters.hasVotes,
                        voteRatio: mergedFilters.voteRatio || "",
                    })

                    const result = await searchImages({
                        query: mergedFilters.search || "",
                        data: {
                            limit: {
                                start: pageStart,
                                end: pageEnd,
                            },
                            images: {
                                comments: { count: true },
                                categories: true,
                                votes: { count: true, includeUserVotes: false },
                            },
                            count: true,
                        },
                        filters: searchFilters,
                    })

                    if ("error" in result) {
                        updateState({
                            error: result.error,
                            images: [],
                            totalCount: 0,
                            currentPage: 1,
                            totalPages: 0,
                        })
                    } else {
                        updateState({
                            images: result.images || [],
                            totalCount: result.count || 0,
                            currentPage: mergedFilters.page || 1,
                            totalPages: Math.ceil((result.count || 0) / (mergedFilters.limit || 20)),
                            filters: mergedFilters,
                            error: null,
                        })
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Failed to fetch images"
                    updateState({
                        error: errorMessage,
                        images: [],
                        totalCount: 0,
                    })
                } finally {
                    updateState({ loading: false })
                }
            })
        },
        [state.filters, updateState],
    )
    // Refresh current images
    const refreshImages = useCallback(() => {
        return fetchImages(state.filters)
    }, [fetchImages, state.filters])


    // Update image
    const updateImage = useCallback(
        async (
            id: string,
            data: {
                prompt?: string
                isPublic?: boolean
                status?: "completed" | "flagged" | "rejected"
                category?: string
            }
        ) => {
            return executeAction(
                async () => {
                    const result = await updateImageInfo(id, data)
                    if ('error' in result) {
                        return { success: false, error: result.error }
                    }
                    return { success: true, data: result }
                },
                (updatedImage) => {
                    // Optimistically update state
                    updateState({
                        images: state.images.map((img) => (img.image.id === id ? { ...img, ...updatedImage } : img)),
                    })
                },
            )
        },
        [executeAction, state.images, updateState],
    )

    // Delete single image
    const deleteImage = useCallback(
        async (id: string, reason?: string) => {
            const result = await executeAction(
                async () => {
                    const res = await deleteImageAction(id);
                    if ("success" in res && res.success) {
                        return { success: true, data: null };
                    } else if ("error" in res) {
                        return { success: false, error: res.error };
                    }
                    return { success: false, error: "Unknown error" };
                },
                () => {
                    // Optimistically remove from state
                    updateState({
                        images: state.images.filter((img) => img.image.id !== id),
                        totalCount: state.totalCount - 1,
                        selectedImages: state.selectedImages.filter((selectedId) => selectedId !== id),
                    })
                },
            )

            return !!result
        },
        [executeAction, state.images, state.totalCount, state.selectedImages, updateState],
    )

    // Bulk delete images
    const bulkDeleteImages = useCallback(
        async (ids: string[], reason?: string) => {
            const result = await executeAction(
                async () => {
                    const res = await deleteMultipleImages(ids);
                    if ("success" in res && res.success) {
                        return { success: true, data: res };
                    } else if ("error" in res) {
                        return { success: false, error: res.error };
                    }
                    return { success: false, error: "Unknown error" };
                },
                () => {
                    // Optimistically remove from state
                    updateState({
                        images: state.images.filter((img) => !ids.includes(img.image.id)),
                        totalCount: state.totalCount - ids.length,
                        selectedImages: state.selectedImages.filter((selectedId) => !ids.includes(selectedId)),
                    })
                },
            )

            return !!result
        },
        [executeAction, state.images, state.totalCount, state.selectedImages, updateState],
    )

    const approveImage = useCallback(
        async (id: string) => {
            // "approved" is not a valid status for updateImageInfo, so you may need to handle this elsewhere if needed
            // For now, skip or adjust as needed
            return false
        },
        [updateImage],
    )

    const rejectImage = useCallback(
        async (id: string, reason?: string) => {
            const result = await updateImage(id, { status: "rejected" })
            return !!result
        },
        [updateImage],
    )

    const flagImage = useCallback(
        async (id: string, reason?: string) => {
            const result = await updateImage(id, { status: "flagged" })
            return !!result
        },
        [updateImage],
    )

    const unflagImage = useCallback(
        async (id: string) => {
            const result = await updateImage(id, { status: "completed" })
            return !!result
        },
        [updateImage],
    )

    const bulkApprove = useCallback(
        async (ids: string[]) => {
            const result = await executeAction(
                () => bulkApproveAction(ids),
                () => {
                    // Optimistically update state
                    updateState({
                        images: state.images.map((img) => (ids.includes(img.image.id) ? { ...img, status: "approved" } : img)),
                        selectedImages: [],
                    })
                },
            )

            return !!result
        },
        [executeAction, state.images, updateState],
    )

    const bulkReject = useCallback(
        async (ids: string[], reason?: string) => {
            const result = await executeAction(
                () => bulkRejectAction(ids, reason),
                () => {
                    // Optimistically update state
                    updateState({
                        images: state.images.map((img) => (ids.includes(img.image.id) ? { ...img, status: "rejected" } : img)),
                        selectedImages: [],
                    })
                },
            )

            return !!result
        },
        [executeAction, state.images, updateState],
    )

    const addComment = useCallback(
        async (id: string, comment: string) => {
            if (!currentUserId) return null

            return executeAction(
                async () => {
                    const result = await createComment(id, comment);
                    if ('error' in result) {
                        return { success: false, error: result.error };
                    }
                    return { success: true, data: result };
                },
                (newComment) => {
                    // Optimistically update state
                    updateState({
                        images: state.images.map((img) =>
                            img.image.id === id
                                ? {
                                    ...img,
                                    comments: {
                                        imageId: id,
                                        comments: [...(img.comments?.comments || []), newComment],
                                        count: (img.comments?.count ?? 0) + 1,
                                    },
                                }
                                : img,
                        ),
                    })
                },
            )
        },
        [executeAction, state.images, updateState, currentUserId],
    )

    const deleteComment = useCallback(
        async (commentId: string) => {
            const result = await executeAction(
                async () => {
                    const result = await deleteCommentAction(commentId);
                    if ('error' in result) {
                        return { success: false, error: result.error };
                    }
                    return { success: true, data: result };
                },
                () => {
                    // Optimistically update state
                    updateState({
                        images: state.images.map((img) =>
                            img.comments?.comments?.some((c) => c.id === commentId)
                                ? {
                                    ...img,
                                    comments: {
                                        imageId: img.image.id,
                                        comments: img.comments?.comments?.filter((c) => c.id !== commentId) || [],
                                        count: Math.max((img.comments?.count ?? 1) - 1, 0),
                                    },
                                }
                                : img
                        ),
                    })
                },
            )

            return !!result
        },
        [executeAction, state.images, updateState],
    )

    // Filter & Selection
    // Updated updateFilters to handle vote filters
    const updateFilters = useCallback(
        (filters: Partial<ImageFilters>) => {
            const newFilters = { ...state.filters, ...filters }
            updateState({ filters: newFilters })

            // Update URL params including vote filters
            const params = new URLSearchParams()
            Object.entries(newFilters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    params.append(key, value.toString())
                }
            })

            router.replace(`?${params.toString()}`, { scroll: false })

            // Fetch with new filters
            fetchImages(newFilters)
        },
        [state.filters, updateState, router, fetchImages],
    )

    // Updated clearFilters to reset vote filters
    const clearFilters = useCallback(() => {
        const defaultFilters = {
            page: 1,
            limit: 20,
            sortBy: "createdAt" as const,
            sortOrder: "desc" as const,
        }
        updateState({ filters: defaultFilters })
        router.replace("?", { scroll: false })
        fetchImages(defaultFilters)
    }, [updateState, router, fetchImages])

    const selectImage = useCallback(
        (id: string) => {
            updateState({
                selectedImages: [...state.selectedImages, id],
            })
        },
        [state.selectedImages, updateState],
    )

    const deselectImage = useCallback(
        (id: string) => {
            updateState({
                selectedImages: state.selectedImages.filter((selectedId) => selectedId !== id),
            })
        },
        [state.selectedImages, updateState],
    )

    const selectAllImages = useCallback(() => {
        updateState({
            selectedImages: state.images.map((img) => img.image.id),
        })
    }, [state.images, updateState])

    const clearSelection = useCallback(() => {
        updateState({ selectedImages: [] })
    }, [updateState])

    // Categories
    const fetchCategories = useCallback(async () => {
        await executeAction(
            async () => {
                try {
                    const categories = await getAllCategories();
                    return { success: true, data: categories };
                } catch (error) {
                    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch categories" };
                }
            },
            (categories) => {
                updateState({ categories })
            },
        )
    }, [executeAction, updateState])

    const assignCategory = useCallback(
        async (imageId: string, categoryId: string) => {
            const result = await executeAction(
                () => assignCategoryAction(imageId, categoryId),
                () => {
                    // Optimistically update state
                    updateState({
                        images: state.images.map((img) =>
                            img.image.id === imageId
                                ? {
                                    ...img,
                                    categoryIds: [...(img.image.categoryIds || []), categoryId],
                                }
                                : img,
                        ),
                    })
                },
            )

            return !!result
        },
        [executeAction, state.images, updateState],
    )

    const removeCategory = useCallback(
        async (imageId: string, categoryId: string) => {
            const result = await executeAction(
                () => removeCategoryAction(imageId, categoryId),
                () => {
                    // Optimistically update state
                    updateState({
                        images: state.images.map((img) =>
                            img.image.id === imageId
                                ? {
                                    ...img,
                                    categoryIds: (img.image.categoryIds || []).filter((id) => id !== categoryId),
                                }
                                : img,
                        ),
                    })
                },
            )

            return !!result
        },
        [executeAction, state.images, updateState],
    )

    // Export & Analytics
    const exportImages = useCallback(
        async (format: "csv" | "json") => {
            await executeAction(
                () => exportImagesAction(state.filters, format),
                (data) => {
                    // Create and download file
                    const blob = new Blob([data.content], { type: data.contentType })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = data.filename
                    document.body.appendChild(a)
                    a.click()
                    window.URL.revokeObjectURL(url)
                    document.body.removeChild(a)
                },
            )
        },
        [executeAction, state.filters],
    )

    const getImageStats = useCallback(async () => {
        return executeAction(() => getImageStatsAction())
    }, [executeAction])

    // Computed values
    const hasSelectedImages = useMemo(() => state.selectedImages.length > 0, [state.selectedImages])
    const isAllSelected = useMemo(
        () => state.images.length > 0 && state.selectedImages.length === state.images.length,
        [state.images, state.selectedImages],
    )

    return {
        // State
        ...state,
        loading: state.loading || isPending,

        // Computed
        hasSelectedImages,
        isAllSelected,

        // Actions
        fetchImages,
        refreshImages,
        updateImage,
        deleteImage,
        bulkDeleteImages,
        approveImage,
        rejectImage,
        flagImage,
        unflagImage,
        bulkApprove,
        bulkReject,
        addComment,
        deleteComment,
        updateFilters,
        clearFilters,
        selectImage,
        deselectImage,
        selectAllImages,
        clearSelection,
        fetchCategories,
        assignCategory,
        removeCategory,
        exportImages,
        getImageStats,
    }
}
