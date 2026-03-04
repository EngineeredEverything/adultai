"use client"

export type MediaType = "images" | "videos" | "lipsync"

interface MediaTypeFilterProps {
  active: MediaType
  onChange: (type: MediaType) => void
  videoCounts?: { videos: number; lipsync: number }
}

export function MediaTypeFilter({ active, onChange, videoCounts }: MediaTypeFilterProps) {
  const tabs: { label: string; value: MediaType; icon: string }[] = [
    { label: "Images", value: "images", icon: "🖼️" },
    { label: "Videos", value: "videos", icon: "🎬" },
    { label: "Lip Sync", value: "lipsync", icon: "🗣️" },
  ]

  return (
    <div className="flex gap-2 mb-4">
      {tabs.map(({ label, value, icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors flex items-center gap-1.5
            ${active === value
              ? "bg-purple-600 text-white border-purple-600"
              : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"}`}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  )
}
