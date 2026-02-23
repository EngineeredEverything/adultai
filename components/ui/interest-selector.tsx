"use client"

import { useState, useEffect } from "react"
import { saveContentInterests } from "@/actions/user/interests"
import { INTEREST_OPTIONS } from "@/lib/interests"
import { X, Sparkles } from "lucide-react"

interface InterestSelectorProps {
  initialInterests?: string[]
  onSave?: (interests: string[]) => void
  onClose?: () => void
  /** If true, show as a full-screen onboarding overlay */
  isOnboarding?: boolean
}

export function InterestSelector({
  initialInterests = [],
  onSave,
  onClose,
  isOnboarding = false,
}: InterestSelectorProps) {
  const [selected, setSelected] = useState<string[]>(initialInterests)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(initialInterests)
  }, [initialInterests])

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setSaving(true)
    await saveContentInterests(selected)
    setSaving(false)
    if (typeof window !== "undefined") {
      localStorage.setItem("adultai_interests_set", "1")
    }
    onSave?.(selected)
  }

  return (
    <div className={`flex flex-col gap-6 ${isOnboarding ? "p-6" : "p-4"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-pink-500" />
            <h2 className="text-xl font-bold">What are you into?</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick your interests and we&apos;ll tailor your gallery experience. You can change this anytime.
          </p>
        </div>
        {onClose && !isOnboarding && (
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted transition-colors shrink-0 mt-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {INTEREST_OPTIONS.map(opt => {
          const isSelected = selected.includes(opt.id)
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 px-2 transition-all duration-200 text-center
                ${isSelected
                  ? "border-pink-500 bg-pink-500/10 text-pink-500"
                  : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                }`}
            >
              <span className="text-2xl leading-none">{opt.emoji}</span>
              <span className="text-xs font-medium leading-tight">{opt.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        {onClose && isOnboarding && (
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`ml-auto rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-semibold px-6 py-2.5 text-sm transition-colors disabled:opacity-60
            ${isOnboarding ? "w-full" : ""}`}
        >
          {saving ? "Saving..." : selected.length === 0 ? "Show everything" : `Save ${selected.length} interest${selected.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  )
}

/** Full-screen onboarding overlay shown on first gallery visit */
export function InterestOnboardingModal({
  initialInterests,
  onDone,
}: {
  initialInterests?: string[]
  onDone: (interests: string[]) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
        <InterestSelector
          initialInterests={initialInterests}
          onSave={onDone}
          onClose={() => onDone(initialInterests ?? [])}
          isOnboarding
        />
      </div>
    </div>
  )
}
