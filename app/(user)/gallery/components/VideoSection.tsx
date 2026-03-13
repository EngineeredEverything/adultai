"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getUserLipsyncs, getUserMotionVideos } from "@/actions/videos/getUserVideos"
import { deleteVideo } from "@/actions/videos/delete"
import type { SearchVideosResponseSuccessType } from "@/types/videos"
import { Play, Trash2, Download, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import type { MediaType } from "./MediaTypeFilter"

interface VideoSectionProps {
  mediaType: MediaType
  userId?: string
  userMode?: boolean
  searchQuery?: string
}

type VideoItem = SearchVideosResponseSuccessType["videos"][number]

function VideoCard({ video, onClick }: { video: VideoItem; onClick: () => void }) {
  const [isHovering, setIsHovering] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Use videoUrl if cdnUrl is just the base domain (path was null)
  const videoUrl = video.video.cdnUrl && !video.video.cdnUrl.endsWith("b-cdn.net/")
    ? video.video.cdnUrl
    : video.video.videoUrl || ""

  return (
    <div
      className="cursor-pointer group transition-all duration-200 hover:scale-[1.02] relative aspect-square bg-muted rounded-lg overflow-hidden shadow-md hover:shadow-xl"
      onClick={onClick}
      onMouseEnter={() => {
        setIsHovering(true)
        videoRef.current?.play().catch(() => {})
      }}
      onMouseLeave={() => {
        setIsHovering(false)
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.currentTime = 0
        }
      }}
    >
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          preload="metadata"
          className="w-full h-full object-cover"
          muted
          playsInline
          loop
          onLoadedMetadata={(e) => {
            // Seek to 0.5s to show a real first frame as thumbnail
            const v = e.currentTarget
            v.currentTime = 0.5
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Video unavailable</p>
        </div>
      )}

      {/* Play overlay */}
      <div
        className={`absolute inset-0 transition-colors flex items-center justify-center ${
          isHovering ? "bg-black/10" : "bg-black/30"
        }`}
      >
        {!isHovering && (
          <div className="bg-white/90 rounded-full p-3 group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 text-black" fill="black" />
          </div>
        )}
      </div>

      {/* Prompt overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <p className="text-white text-xs line-clamp-2">{video.video.prompt}</p>
      </div>

      {/* Type badge */}
      <div className="absolute top-2 left-2">
        <span className="bg-purple-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
          {video.video.prompt?.startsWith("Lip sync") ? "🗣️ Lip Sync" : "🎬 Video"}
        </span>
      </div>
    </div>
  )
}

function VideoDetailDialog({
  video,
  isOpen,
  onClose,
  onDelete,
  isOwner,
}: {
  video: VideoItem | null
  isOpen: boolean
  onClose: () => void
  onDelete: (id: string) => void
  isOwner: boolean
}) {
  if (!video) return null
  const url = video.video.cdnUrl || video.video.videoUrl || ""

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 bg-black/95 border-gray-800" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Video Player</DialogTitle>
        <div className="relative">
          <button onClick={onClose} className="absolute top-3 right-3 z-10 bg-black/60 rounded-full p-1.5 hover:bg-black/80">
            <X className="w-5 h-5 text-white" />
          </button>

          <video
            src={url}
            className="w-full max-h-[80vh] object-contain"
            controls
            autoPlay
            loop
          />

          <div className="p-4 space-y-3">
            <p className="text-white text-sm">{video.video.prompt}</p>
            <div className="flex gap-2">
              {url && (
                <a
                  href={url}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm transition-colors"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
              )}
              {isOwner && (
                <button
                  onClick={() => {
                    onDelete(video.video.id)
                    onClose()
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-red-300 text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function VideoSection({ mediaType, userId, userMode, searchQuery = "" }: VideoSectionProps) {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null)

  const fetchVideos = useCallback(async () => {
    setIsLoading(true)
    try {
      if (mediaType === "lipsync") {
        // Pass userId directly so server action doesn't depend on session cookies
        const result = await getUserLipsyncs(userId)
        if ("error" in result) {
          console.error("Failed to fetch lip syncs:", result.error)
          setVideos([])
        } else {
          setVideos(result.videos as VideoItem[])
        }
      } else {
        // Videos tab: reserved for future animated video feature
        const result = await getUserMotionVideos()
        if ("error" in result) {
          console.error("Failed to fetch videos:", result.error)
          setVideos([])
        } else {
          setVideos(result.videos as VideoItem[])
        }
      }
    } catch (err) {
      console.error("Video fetch error:", err)
      setVideos([])
    } finally {
      setIsLoading(false)
    }
  }, [mediaType, userId])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  const handleDelete = async (videoId: string) => {
    try {
      await deleteVideo(videoId)
      setVideos((prev) => prev.filter((v) => v.video.id !== videoId))
      toast.success("Video deleted")
    } catch {
      toast.error("Failed to delete video")
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-muted-foreground text-lg">
          {mediaType === "lipsync" ? "No lip sync videos yet" : "No videos yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {mediaType === "lipsync"
            ? "Use &quot;Make it Talk&quot; on any image to create lip sync videos"
            : "Use &quot;Animate&quot; on any image to create video animations"}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {videos.map((video) => (
          <VideoCard
            key={video.video.id}
            video={video}
            onClick={() => setSelectedVideo(video)}
          />
        ))}
      </div>

      <VideoDetailDialog
        video={selectedVideo}
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onDelete={handleDelete}
        isOwner={!!userId && selectedVideo?.video.userId === userId}
      />
    </>
  )
}
