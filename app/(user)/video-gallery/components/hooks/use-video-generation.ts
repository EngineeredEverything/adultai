"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import type { SearchVideosResponseSuccessType } from "@/types/videos"
import { checkVideoStatus, searchVideos } from "@/actions/videos/info"
import { createGeneratedVideo } from "@/actions/videos/create"
import { logger } from "@/lib/logger"
import { toast } from "sonner"
import { useLoadingState } from "../../../gallery/components/hooks/use-loading-state"

const POLL_INTERVAL = 5000

interface UseVideoGenerationParams {
  initialVideos: SearchVideosResponseSuccessType["videos"]
  searchQuery: string
  userMode?: boolean
  category_id?: string
  user: any
  setVideos: (
    updater: (prev: SearchVideosResponseSuccessType["videos"]) => SearchVideosResponseSuccessType["videos"],
  ) => void
}

interface GenerationState {
  prompt: string
  isGenerating: boolean
  width: number
  height: number
  fps: number
  numFrames: number
  isPublic: boolean
  count: number
  showSignInDialog: boolean
}

export function useVideoGeneration(params: UseVideoGenerationParams) {
  const { initialVideos, searchQuery, userMode, category_id, user, setVideos } = params

  const [state, setState] = useState<GenerationState>({
    prompt: "",
    isGenerating: false,
    width: 848,
    height: 480,
    fps: 24,
    numFrames: 81,
    isPublic: true,
    count: 1,
    showSignInDialog: false,
  })

  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>(
    () =>
      initialVideos
        .filter((video) => video.video.status === "processing")
        .map((video) => video.video.taskId)
        .filter((taskId): taskId is string => taskId !== null) || [],
  )

  const [pendingCount, setPendingCount] = useState(0)
  const { addPending, removePending, resetPending } = useLoadingState()

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef(false)

  const searchParams = useMemo(
    () => ({
      query: searchQuery,
      userMode,
      userId: user?.user.id,
      category_id,
    }),
    [searchQuery, userMode, user?.user.id, category_id],
  )

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

  const setWidth = useCallback(
    (width: number) => {
      updateState({ width })
    },
    [updateState],
  )

  const setHeight = useCallback(
    (height: number) => {
      updateState({ height })
    },
    [updateState],
  )

  const setFps = useCallback(
    (fps: number) => {
      updateState({ fps })
    },
    [updateState],
  )

  const setNumFrames = useCallback(
    (numFrames: number) => {
      updateState({ numFrames })
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

  const pollPendingTasks = useCallback(async () => {
    if (pendingTaskIds.length === 0 || isPollingRef.current) return

    isPollingRef.current = true

    try {
      const completedTasks: string[] = []
      const failedTasks: string[] = []
      const newVideos: any[] = []

      const taskResults = await Promise.allSettled(
        pendingTaskIds.map(async (taskId) => {
          const result = await checkVideoStatus({ taskId })
          return { taskId, result }
        }),
      )

      for (const taskResult of taskResults) {
        if (taskResult.status === "fulfilled") {
          const { taskId, result } = taskResult.value

          if (!result || "error" in result) {
            logger.warn(`Error checking task ${taskId}:`, result?.error)
            continue
          }

          if (result.status === "completed") {
            completedTasks.push(taskId)
            if (result.videos) {
              newVideos.push(...result.videos)
            }
          } else if (result.status === "failed") {
            failedTasks.push(taskId)
          }
        }
      }

      if (completedTasks.length > 0 || failedTasks.length > 0) {
        setPendingTaskIds((prev) => prev.filter((id) => !completedTasks.includes(id) && !failedTasks.includes(id)))

        if (completedTasks.length > 0) {
          setPendingCount(0)
          resetPending({ images: [] })

          if (newVideos.length > 0) {
            const refreshedVideos = await searchVideos({
              query: searchParams.query,
              data: {
                ids: newVideos.map((d) => d.id),
                limit: { start: 0, end: newVideos.length },
                videos: {
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

            if (!("error" in refreshedVideos)) {
              resetPending({
                images: refreshedVideos.videos.map((d) => d.video.cdnUrl),
              })

              setVideos((prev) => [...refreshedVideos.videos, ...prev])
            }
          }

          toast.success("Videos Ready", {
            description: "Your generated videos are now available",
          })
        }

        if (failedTasks.length > 0) {
          toast.error("Generation Failed", {
            description: "Some videos failed to generate. Please try again.",
          })
        }
      }
    } catch (error) {
      logger.error("Error polling for video status:", error)
    } finally {
      isPollingRef.current = false
    }
  }, [pendingTaskIds, searchParams, setVideos, resetPending])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!user) {
        updateState({ showSignInDialog: true })
        return
      }

      if (!state.prompt.trim()) {
        toast.error("Error", {
          description: "Please enter a prompt before generating videos",
        })
        return
      }

      updateState({ isGenerating: true })

      try {
        const results = await createGeneratedVideo({
          count: state.count,
          prompt: state.prompt,
          width: state.width,
          height: state.height,
          fps: state.fps,
          numFrames: state.numFrames,
          isPublic: state.isPublic,
        })

        if ("error" in results) {
          throw new Error(results.error)
        }

        if (results.status === "processing" && results.taskId) {
          setPendingTaskIds((prev) => [...prev, results.taskId])
          setPendingCount(state.count)

          for (let i = 0; i < state.count; i++) {
            addPending()
          }
        }

        updateState({ prompt: "" })
      } catch (error) {
        logger.error("Error generating videos:", error)
        toast.error("Error", {
          description: error instanceof Error ? error.message : "Failed to generate videos",
        })
      } finally {
        updateState({ isGenerating: false })
      }
    },
    [user, state, updateState, addPending],
  )

  useEffect(() => {
    if (pendingTaskIds.length > 0) {
      if (!pollRef.current) {
        pollPendingTasks()
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
    setWidth,
    setHeight,
    setFps,
    setNumFrames,
    setIsPublic,
    setCount,
    setShowSignInDialog,
    handleSubmit,
    pendingCount,
    pollPendingTasks,
  }
}
