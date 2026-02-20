"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Wand2, Mic, UserPlus, Loader2, Play, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import type { SearchImagesResponseSuccessType } from "@/types/images"

interface ImageActionsProps {
  image: SearchImagesResponseSuccessType["images"][number]
  /** Pre-fill the gallery generation form and trigger generation */
  onGenerateVariations?: (prompt: string) => void
  /** Pre-fill the generation form prompt for editing */
  onSetPrompt?: (prompt: string) => void
}

export function ImageActions({ image, onGenerateVariations, onSetPrompt }: ImageActionsProps) {
  const router = useRouter()
  const [showTalkPanel, setShowTalkPanel] = useState(false)
  const [talkText, setTalkText] = useState("")
  const [isAnimating, setIsAnimating] = useState(false)
  const [result, setResult] = useState<{ videoUrl?: string | null; audioUrl?: string | null; audioOnly?: boolean } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const imageUrl = image.image.cdnUrl || image.image.imageUrl
  const prompt = image.image.prompt || ""

  // ── Variations: same prompt, new generation ──────────────────────────────
  const handleVariations = () => {
    if (!prompt) { toast.error("No prompt to vary"); return }
    if (onGenerateVariations) {
      onGenerateVariations(prompt)
      toast.success("Prompt loaded!", { description: "Hit Generate to create variations." })
    } else {
      // Fallback: navigate to gallery with prompt param
      router.push(`/gallery?prompt=${encodeURIComponent(prompt)}`)
    }
  }

  // ── Refine: put prompt back in the form ──────────────────────────────────
  const handleRefine = () => {
    if (!prompt) { toast.error("No prompt to refine"); return }
    if (onSetPrompt) {
      onSetPrompt(prompt)
      toast.success("Prompt loaded", { description: "Edit and regenerate in the form above." })
    } else {
      router.push(`/gallery?prompt=${encodeURIComponent(prompt)}`)
    }
  }

  // ── Create Companion: use this image as portrait base ────────────────────
  const handleCreateCompanion = () => {
    if (!imageUrl) { toast.error("No image URL"); return }
    router.push(`/companions/customize?imageUrl=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`)
  }

  // ── Make it Talk: TTS + Wav2Lip ──────────────────────────────────────────
  const handleAnimate = async () => {
    if (!talkText.trim()) { toast.error("Enter something for her to say"); return }
    if (!imageUrl) { toast.error("No image available"); return }

    setIsAnimating(true)
    setResult(null)

    try {
      const res = await fetch("/api/animate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, text: talkText.trim() }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to animate")
      }

      setResult(data)

      // Auto-play
      if (data.videoUrl && videoRef.current) {
        videoRef.current.src = data.videoUrl
        videoRef.current.play().catch(() => {})
      } else if (data.audioUrl && !data.videoUrl) {
        if (audioRef.current) { audioRef.current.pause() }
        const audio = new Audio(data.audioUrl)
        audioRef.current = audio
        audio.play().catch(() => {})
      }
    } catch (err: any) {
      toast.error("Animation failed", { description: err.message })
    } finally {
      setIsAnimating(false)
    }
  }

  const playResult = () => {
    if (result?.videoUrl && videoRef.current) {
      videoRef.current.play().catch(() => {})
    } else if (result?.audioUrl) {
      if (audioRef.current) { audioRef.current.pause() }
      const audio = new Audio(result.audioUrl)
      audioRef.current = audio
      audio.play().catch(() => {})
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">What next?</p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleVariations}
          disabled={!prompt}
          className="flex items-center gap-2 border-gray-700 hover:border-purple-500 hover:bg-purple-500/10 hover:text-purple-300 transition-all justify-start"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
          <span className="text-xs">Variations</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefine}
          disabled={!prompt}
          className="flex items-center gap-2 border-gray-700 hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-300 transition-all justify-start"
        >
          <Wand2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-xs">Refine Prompt</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTalkPanel((p) => !p)}
          className={`flex items-center gap-2 border-gray-700 transition-all justify-start ${
            showTalkPanel
              ? "border-pink-500 bg-pink-500/10 text-pink-300"
              : "hover:border-pink-500 hover:bg-pink-500/10 hover:text-pink-300"
          }`}
        >
          <Mic className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
          <span className="text-xs">Make it Talk</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateCompanion}
          className="flex items-center gap-2 border-gray-700 hover:border-green-500 hover:bg-green-500/10 hover:text-green-300 transition-all justify-start"
        >
          <UserPlus className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          <span className="text-xs">Create Companion</span>
        </Button>
      </div>

      {/* Make it Talk panel */}
      {showTalkPanel && (
        <div className="border-t border-gray-800 p-3 space-y-3">
          <p className="text-xs text-gray-500">Type what she should say and hear her voice with moving lips.</p>

          <Textarea
            value={talkText}
            onChange={(e) => setTalkText(e.target.value)}
            placeholder={`"Hey there... I've been thinking about you."`}
            rows={2}
            maxLength={500}
            className="bg-gray-800 border-gray-700 text-sm resize-none focus:border-pink-500/60"
          />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleAnimate}
              disabled={isAnimating || !talkText.trim()}
              className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 flex-1"
            >
              {isAnimating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 mr-2" />
                  Animate
                </>
              )}
            </Button>

            {result && (
              <Button size="sm" variant="outline" onClick={playResult} className="border-gray-700">
                {result.videoUrl ? <Play className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>

          {/* Video / audio-only result */}
          {result?.videoUrl && (
            <div className="rounded-lg overflow-hidden bg-black aspect-[3/4] relative">
              <video
                ref={videoRef}
                src={result.videoUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {result?.audioOnly && result.audioUrl && (
            <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400">
              <Volume2 className="w-4 h-4 text-pink-400" />
              <span>Voice generated — lip sync not available for this image.</span>
              <button
                onClick={() => { const a = new Audio(result.audioUrl!); a.play() }}
                className="ml-auto text-pink-400 hover:text-pink-300 transition"
              >
                Play
              </button>
            </div>
          )}

          {isAnimating && (
            <p className="text-xs text-gray-500 text-center animate-pulse">
              Generating voice and lip sync... ~20 seconds
            </p>
          )}
        </div>
      )}
    </div>
  )
}
