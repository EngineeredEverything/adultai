"use client"

export type MediaType = "images" | "videos" | "lipsync"

interface MediaTypeFilterProps {
  active: MediaType
  onChange: (type: MediaType) => void
  videoCounts?: { videos: number; lipsync: number }
  /** When true, hide the Videos (coming soon) tab — e.g. public gallery */
  hideVideos?: boolean
}

export function MediaTypeFilter({ active, onChange, videoCounts, hideVideos }: MediaTypeFilterProps) {
  const tabs: { label: string; value: MediaType; icon: string; disabled?: boolean }[] = [
    { label: "Images", value: "images", icon: "🖼️" },
    { label: "Lip Sync", value: "lipsync", icon: "🗣️" },
    ...(!hideVideos ? [{ label: "Videos", value: "videos" as MediaType, icon: "🎬", disabled: true }] : []),
  ]

  return (
    <div className="flex gap-2 mb-4">
      {tabs.map(({ label, value, icon, disabled }) => (
        <button
          key={value}
          onClick={() => !disabled && onChange(value)}
          disabled={disabled}
          title={disabled ? "Coming soon" : undefined}
          className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors flex items-center gap-1.5
            ${active === value
              ? "bg-purple-600 text-white border-purple-600"
              : disabled
                ? "border-gray-800 text-gray-600 cursor-not-allowed opacity-50"
                : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"}`}
        >
          {icon} {label}{disabled ? " 🔜" : ""}
        </button>
      ))}
    </div>
  )
}
