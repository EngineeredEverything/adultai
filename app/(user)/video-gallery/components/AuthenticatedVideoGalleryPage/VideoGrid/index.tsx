"use client"

import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from "react"
import type { SearchVideosResponseSuccessType } from "@/types/videos"
import { HardDrive } from "lucide-react"
import { logger } from "@/lib/logger"
import { VideoCard } from "./VideoCard"
import { LoadingVideoCard } from "./LoadingVideoCard"

interface VideoGridProps {
  videos: SearchVideosResponseSuccessType["videos"]
  onVideoClick: (video: SearchVideosResponseSuccessType["videos"][number]) => void
  loadedVideos: Record<string, boolean>
  onDelete: (videoId: string) => void
  user: any
  tempVideos?: number
  setLoadedVideos: Dispatch<SetStateAction<Record<string, boolean>>>
}

export function VideoGrid({
  videos,
  onVideoClick,
  loadedVideos,
  onDelete,
  user,
  tempVideos = 0,
  setLoadedVideos,
}: VideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [itemWidth, setItemWidth] = useState(285.5)
  const [positions, setPositions] = useState<{ x: number; y: number; height: number }[]>([])

  const GAP = 16
  const MIN_COLUMNS = 1
  const MAX_COLUMNS = 6
  const MIN_ITEM_WIDTH = 240

  const calculateLayout = (width: number) => {
    const effectiveWidth = width - GAP * 2
    const maxPossibleColumns = Math.floor((effectiveWidth + GAP) / (MIN_ITEM_WIDTH + GAP))
    const columns = Math.max(MIN_COLUMNS, Math.min(maxPossibleColumns, MAX_COLUMNS))
    const calculatedItemWidth = (effectiveWidth - (columns - 1) * GAP) / columns

    return { columns, itemWidth: calculatedItemWidth }
  }

  const handleVideoLoad = useCallback(
    (videoId: string) => {
      setLoadedVideos((prev) => ({
        ...prev,
        [videoId]: true,
      }))
    },
    [setLoadedVideos],
  )

  const handleVideoError = useCallback(
    (videoId: string, error: Error) => {
      logger.error("Failed to load video:", videoId, error)
      setLoadedVideos((prev) => ({
        ...prev,
        [videoId]: false,
      }))
    },
    [setLoadedVideos],
  )

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth
        setContainerWidth(width)

        const { columns, itemWidth } = calculateLayout(width)
        setItemWidth(itemWidth)
      }
    }

    updateDimensions()

    let resizeTimer: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(updateDimensions, 100)
    }

    window.addEventListener("resize", handleResize)
    return () => {
      clearTimeout(resizeTimer)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  useEffect(() => {
    const { columns } = calculateLayout(containerWidth)

    const columnHeights = Array(columns).fill(0)
    const newPositions: { x: number; y: number; height: number }[] = []

    const placeholders = Array(tempVideos).fill(null)
    placeholders.forEach(() => {
      const minHeightColumn = columnHeights.indexOf(Math.min(...columnHeights))
      const x = minHeightColumn * (itemWidth + GAP)
      const y = columnHeights[minHeightColumn]
      const height = (itemWidth * 9) / 16

      columnHeights[minHeightColumn] += height + GAP
      newPositions.push({ x, y, height })
    })

    videos.forEach((videoItem) => {
      const minHeightColumn = columnHeights.indexOf(Math.min(...columnHeights))
      const x = minHeightColumn * (itemWidth + GAP)
      const y = columnHeights[minHeightColumn]

      let height = (itemWidth * 9) / 16

      if (videoItem.video.status === "completed" && videoItem.video.width && videoItem.video.height) {
        const aspectRatio = videoItem.video.width / videoItem.video.height
        height = itemWidth / aspectRatio
      }

      columnHeights[minHeightColumn] += height + GAP
      newPositions.push({ x, y, height })
    })

    setPositions(newPositions)
  }, [containerWidth, itemWidth, videos, tempVideos])

  if (!videos.length && !tempVideos) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <HardDrive className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">No videos found</p>
        <p className="text-gray-400 text-sm mt-2">Try generating some videos or changing your filters</p>
      </div>
    )
  }

  const containerHeight = positions.length > 0 ? Math.max(...positions.map((p, i) => p.y + p.height)) + GAP : 0

  return (
    <div
      ref={containerRef}
      className="mx-2 w-full max-w-[1793px] relative flex flex-row items-start justify-center"
      style={{
        height: `${containerHeight}px`,
        minHeight: "100dvh",
        paddingBottom: "48px",
      }}
    >
      {Array(tempVideos)
        .fill(null)
        .map((_, index) => {
          const position = positions[index] || {
            x: 0,
            y: 0,
            height: itemWidth,
          }

          return (
            <LoadingVideoCard
              key={`loading-placeholder-${index}`}
              index={index}
              position={position}
              width={itemWidth}
            />
          )
        })}

      {videos.map((videoItem, index) => {
        const positionIndex = tempVideos + index
        const position = positions[positionIndex] || {
          x: 0,
          y: 0,
          height: itemWidth,
        }

        if (videoItem.video.status === "processing") {
          return (
            <LoadingVideoCard
              key={`processing-${videoItem.video.id}-${index}`}
              index={index}
              position={position}
              width={itemWidth}
            />
          )
        } else if (videoItem.video.status === "completed") {
          return (
            <VideoCard
              key={`completed-${videoItem.video.id}-${index}`}
              video={videoItem}
              isLoaded={loadedVideos[videoItem.video.id] !== false}
              onClick={() => onVideoClick(videoItem)}
              onLoad={() => handleVideoLoad(videoItem.video.id)}
              onError={(e: Error) => handleVideoError(videoItem.video.id, e)}
              position={position}
              width={itemWidth}
              index={positionIndex}
            />
          )
        }
        return null
      })}
    </div>
  )
}
