"use client"

import { useState, useEffect, useCallback } from "react"
import { deleteVideo } from "@/actions/videos/delete"
import { logger } from "@/lib/logger"
import { VideoGrid } from "./VideoGrid"
import { VideoDialog } from "./VideoDialog"
import { useVideoGeneration } from "../hooks/use-video-generation"
import { VideoGenerationForm } from "../GenerationForm/desktop"
import type { SearchVideosResponseSuccessType } from "@/types/videos"
import { toast } from "sonner"
import { searchVideos } from "@/actions/videos/info"

interface AuthenticatedVideoGalleryPageProps {
  userId?: string
  searchQuery?: string
}

export default function AuthenticatedVideoGalleryPage({
  userId,
  searchQuery = "",
}: AuthenticatedVideoGalleryPageProps) {
  const [videos, setVideos] = useState<SearchVideosResponseSuccessType["videos"]>([])
  const [selectedVideo, setSelectedVideo] = useState<SearchVideosResponseSuccessType["videos"][number] | null>(null)
  const [loadedVideos, setLoadedVideos] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(undefined)

  const videoGeneration = useVideoGeneration({
    initialVideos: videos,
    searchQuery,
    userMode: false,
    user,
    setVideos,
  })

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true)

        const videosResult = await searchVideos({
          query: searchQuery,
          filters: {},
          data: {
            limit: { start: 0, end: 50 },
            videos: {
              comments: { count: true },
              votes: { count: true },
              categories: true,
            },
          },
        })

        if ("error" in videosResult) {
          throw new Error(videosResult.error)
        }

        setVideos(videosResult.videos)
      } catch (error) {
        logger.error("Error fetching initial data:", error)
        toast.error("Error", {
          description: "Failed to load videos",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchInitialData()
  }, [searchQuery])

  const handleVideoClick = useCallback((video: SearchVideosResponseSuccessType["videos"][number]) => {
    setSelectedVideo(video)
  }, [])

  const handleDelete = useCallback(async (videoId: string) => {
    try {
      const result = await deleteVideo(videoId)
      if ("error" in result) {
        throw new Error(result.error)
      }

      setVideos((prev) => prev.filter((v) => v.video.id !== videoId))
      toast.success("Success", {
        description: "Video deleted successfully",
      })
    } catch (error) {
      logger.error("Error deleting video:", error)
      toast.error("Error", {
        description: "Failed to delete video",
      })
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">AI Video Gallery</h1>
          <p className="text-muted-foreground">Explore and generate AI-powered videos</p>
        </div>

        <div className="mb-8">
          <VideoGenerationForm
            prompt={videoGeneration.prompt}
            setPrompt={videoGeneration.setPrompt}
            isGenerating={videoGeneration.isGenerating}
            handleSubmit={videoGeneration.handleSubmit}
            count={videoGeneration.count}
            setCount={videoGeneration.setCount}
            fps={videoGeneration.fps}
            setFps={videoGeneration.setFps}
            numFrames={videoGeneration.numFrames}
            setNumFrames={videoGeneration.setNumFrames}
            width={videoGeneration.width}
            setWidth={videoGeneration.setWidth}
            height={videoGeneration.height}
            setHeight={videoGeneration.setHeight}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <VideoGrid
            videos={videos}
            onVideoClick={handleVideoClick}
            loadedVideos={loadedVideos}
            onDelete={handleDelete}
            user={user}
            tempVideos={videoGeneration.pendingCount}
            setLoadedVideos={setLoadedVideos}
          />
        )}

        <VideoDialog
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          video={selectedVideo}
          user={user}
          onDelete={handleDelete}
          subscriptionStatus={null}
          setSelectedVideo={setSelectedVideo}
        />
      </div>
    </div>
  )
}
