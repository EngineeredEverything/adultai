"use client"

interface LoadingVideoCardProps {
  index: number
  position: { x: number; y: number; height: number }
  width: number
}

export function LoadingVideoCard({ index, position, width }: LoadingVideoCardProps) {
  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${position.height}px`,
      }}
    >
      <div className="relative w-full h-full bg-muted rounded-lg overflow-hidden shadow-md animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    </div>
  )
}
