"use client"

import type React from "react"

import { checkImageStatus, searchImages } from "@/actions/images/info"
import { logger } from "@/lib/logger"
import type { SearchImagesResponseSuccessType } from "@/types/images"
import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { createGeneratedImage } from "@/actions/images/create"
import { POLL_INTERVAL } from "../data/constants"
import type { GetCurrentUserInfoSuccessType } from "@/types/user"
import { toast } from "sonner"
import { useLoadingState } from "./use-loading-state"

interface UseImageGenerationParams {
  initialImages: SearchImagesResponseSuccessType["images"]
  searchQuery: string
  userMode?: boolean
  category_id?: string
  user: GetCurrentUserInfoSuccessType | undefined
  setImages: (
    updater: (prev: SearchImagesResponseSuccessType["images"]) => SearchImagesResponseSuccessType["images"],
  ) => void
}

interface GenerationState {
  prompt: string
  isGenerating: boolean
  ratio: { width: number; height: number }
  isPublic: boolean
  count: number
  showSignInDialog: boolean
}

export function useImageGeneration(params: UseImageGenerationParams) {
  const { initialImages, searchQuery, userMode, category_id, user, setImages } = params

  // Consolidated state for better management
  const [state, setState] = useState<GenerationState>({
    prompt: "",
    isGenerating: false,
    ratio: { width: 896, height: 1120 },
    isPublic: true,
    count: 1,
    showSignInDialog: false,
  })

  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>(
    () =>
      initialImages
        .filter((image) => image.image.status === "processing")
        .map((image) => image.image.taskId)
        .filter((taskId): taskId is string => taskId !== null) || [],
  )

  const [pendingCount, setPendingCount] = useState(0)
  const { addPending, removePending, resetPending } = useLoadingState()

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef(false)

  // Memoize search parameters
  const searchParams = useMemo(
    () => ({
      query: searchQuery,
      userMode,
      userId: user?.user.id,
      category_id,
    }),
    [searchQuery, userMode, user?.user.id, category_id],
  )

  // State updaters
  const updateState = useCallback((updates: Partial<GenerationState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }, [])

  const setPrompt = useCallback(
    (value: string | ((prev: string) => string)) => {
      const newValue = typeof value === "function" ? value(state.prompt) : value
      updateState({ prompt: newValue })
    },
    [state.prompt, updateState],
  )

  const setRatio = useCallback(
    (ratio: { width: number; height: number }) => {
      updateState({ ratio })
    },
    [updateState],
  )

  const setIsPublic = useCallback(
    (isPublic: boolean | ((prev: boolean) => boolean)) => {
      const newValue = typeof isPublic === "function" ? isPublic(state.isPublic) : isPublic
      updateState({ isPublic: newValue })
    },
    [state.isPublic, updateState],
  )

  const setCount = useCallback(
    (count: number | ((prev: number) => number)) => {
      const newValue = typeof count === "function" ? count(state.count) : count
      updateState({ count: newValue })
    },
    [state.count, updateState],
  )

  const setShowSignInDialog = useCallback(
    (show: boolean) => {
      updateState({ showSignInDialog: show })
    },
    [updateState],
  )

  // Polling function with better error handling
  const pollPendingTasks = useCallback(async () => {
    if (pendingTaskIds.length === 0 || isPollingRef.current) return

    isPollingRef.current = true

    try {
      const completedTasks: string[] = []
      const failedTasks: string[] = []
      const newImages: any[] = []

      // Process all pending tasks in parallel
      const taskResults = await Promise.allSettled(
        pendingTaskIds.map(async (taskId) => {
          const result = await checkImageStatus({ taskId })
          return { taskId, result }
        }),
      )

      for (const taskResult of taskResults) {
        if (taskResult.status === "fulfilled") {
          const { taskId, result } = taskResult.value

          if ("error" in result) {
            logger.warn(`Error checking task ${taskId}:`, result.error)
            continue
          }

          if (result.status === "completed") {
            completedTasks.push(taskId)
            if (result.images) {
              newImages.push(...result.images)
            }
          } else if (result.status === "failed") {
            failedTasks.push(taskId)
          }
        }
      }

      // Batch state updates
      if (completedTasks.length > 0 || failedTasks.length > 0) {
        setPendingTaskIds((prev) => prev.filter((id) => !completedTasks.includes(id) && !failedTasks.includes(id)))

        if (completedTasks.length > 0) {
          setPendingCount(0)
          resetPending({ images: [] })

          // Fetch complete image info
          if (newImages.length > 0) {
            const refreshedImages = await searchImages({
              query: searchParams.query,
              data: {
                ids: newImages.map((d) => d.id),
                limit: { start: 0, end: newImages.length },
                images: {
                  comments: { count: true },
                  categories: true,
                  votes: { count: true },
                },
                ...(searchParams.userMode
                  ? {
                    userId: searchParams.userId,
                    private: true,
                  }
                  : {}),
              },
              filters: {
                ...(searchParams.category_id
                  ? {
                    category_id: searchParams.category_id,
                  }
                  : {}),
              },
            })

            if (!("error" in refreshedImages)) {
              resetPending({
                images: refreshedImages.images.map(d => d.image.cdnUrl)
              })

              setImages((prev) => [...refreshedImages.images, ...prev])
            }
          }

          toast.success("Images Ready", {
            description: "Your generated images are now available",
          })
        }

        if (failedTasks.length > 0) {
          toast.error("Generation Failed", {
            description: "Some images failed to generate. Please try again.",
          })
        }
      }
    } catch (error) {
      logger.error("Error polling for image status:", error)
    } finally {
      isPollingRef.current = false
    }
  }, [pendingTaskIds, searchParams, setImages, resetPending])

  // Submit handler
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!user) {
        updateState({ showSignInDialog: true })
        return
      }

      if (!state.prompt.trim()) {
        toast.error("Error", {
          description: "Please enter a prompt before generating images",
        })
        return
      }

      updateState({ isGenerating: true })

      try {
        const results = await createGeneratedImage({
          count: state.count,
          prompt: state.prompt,
          width: state.ratio.width,
          height: state.ratio.height,
          isPublic: state.isPublic,
        })

        if ("error" in results) {
          throw new Error(results.error)
        }

        if (results.status === "processing" && results.taskId) {
          setPendingTaskIds((prev) => [...prev, results.taskId])
          setPendingCount(state.count)

          // Add pending states
          for (let i = 0; i < state.count; i++) {
            addPending()
          }
        }

        updateState({ prompt: "" })
      } catch (error) {
        logger.error("Error generating images:", error)
        toast.error("Error", {
          description: error instanceof Error ? error.message : "Failed to generate images",
        })
      } finally {
        updateState({ isGenerating: false })
      }
    },
    [user, state, updateState, addPending],
  )

  // Polling effect
  useEffect(() => {
    if (pendingTaskIds.length > 0) {
      if (!pollRef.current) {
        // Initial poll
        pollPendingTasks()
        // Set up interval
        pollRef.current = setInterval(pollPendingTasks, POLL_INTERVAL)
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [pendingTaskIds.length, pollPendingTasks])

  return {
    ...state,
    setPrompt,
    setRatio,
    setIsPublic,
    setCount,
    setShowSignInDialog,
    handleSubmit,
    pendingCount,
    pollPendingTasks,
  }
}
