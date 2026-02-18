"use client"

import { useState } from "react"
import type { SearchVideosResponseSuccessType } from "@/types/videos"
import { Play } from "lucide-react"

interface VideoCardProps {
  video: SearchVideosResponseSuccessType["videos"][number]
  isLoaded: boolean
  onClick: () => void
  onLoad: () => void
  onError: (error: Error) => void
  position: { x: number; y: number; height: number }
  width: number
  index: number
}

export function VideoCard({ video, isLoaded, onClick, onLoad, onError, position, width, index }: VideoCardProps) {
  const [thumbnailError, setThumbnailError] = useState(false)

  return (
    <div
      className="absolute cursor-pointer group transition-all duration-200 hover:scale-[1.02]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${position.height}px`,
      }}
      onClick={onClick}
    >
      <div className="relative w-full h-full bg-muted rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
        {video.video.cdnUrl && !thumbnailError ? (
          <>
            <video
              src={video.video.cdnUrl}
              className="w-full h-full object-cover"
              onLoadedData={onLoad}
              onError={() => {
                setThumbnailError(true)
                onError(new Error("Failed to load video"))
              }}
              muted
              playsInline
            />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="bg-white/90 rounded-full p-4 group-hover:scale-110 transition-transform">
                <Play className="w-8 h-8 text-black" fill="black" />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <p className="text-muted-foreground text-sm">Video unavailable</p>
          </div>
        )}

        {!isLoaded && !thumbnailError && (
          <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-white text-sm line-clamp-2">{video.video.prompt}</p>
          {video.video.duration && <p className="text-white/70 text-xs mt-1">{Math.round(video.video.duration)}s</p>}
        </div>
      </div>
    </div>
  )
}
