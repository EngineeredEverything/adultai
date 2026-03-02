"use client"

import { useState, useRef } from "react"
import { Mic, Loader2, Download, Share2, RotateCcw, Upload, Image as ImageIcon, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import Link from "next/link"
import { UploadImageModal } from "@/components/ui/upload-image-modal"

// ElevenLabs voice options
const VOICES = [
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", desc: "Playful & Bright",    emoji: "✨" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",   desc: "Mature & Confident",  emoji: "👑" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura",   desc: "Energetic & Fun",     emoji: "🔥" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily",    desc: "Velvety & British",   emoji: "🌹" },
  { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella",   desc: "Warm & Professional", emoji: "💋" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice",   desc: "Clear & Engaging",    emoji: "🎀" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", desc: "Confident & Poised",  emoji: "💎" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River",   desc: "Relaxed & Neutral",   emoji: "🌊" },
]

const PHRASE_SUGGESTIONS = [
  "Hey... I was just thinking about you.",
  "I missed you. Where have you been?",
  "Come closer. I have something to tell you.",
  "You make me feel things no one else does.",
  "I need you right now. Don't keep me waiting.",
  "Tell me what you want. I&apos;m all yours.",
  "I&apos;ve been dreaming about you all night.",
  "Nobody else makes me feel like this.",
]

type Step = "setup" | "generating" | "result"

export function SpeakStudio({ user, initialImageUrl }: { user: any; initialImageUrl?: string }) {
  const [step, setStep] = useState<Step>("setup")
  const [imageUrl, setImageUrl] = useState(initialImageUrl || "")
  const [imagePreview, setImagePreview] = useState("")
  const [voiceId, setVoiceId] = useState(VOICES[0].id)
  const [text, setText] = useState("")
  const [result, setResult] = useState<{ videoUrl?: string | null; audioUrl?: string | null; audioOnly?: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const selectedVoice = VOICES.find((v) => v.id === voiceId) || VOICES[0]

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setImagePreview(dataUrl)
      // For actual upload, we use the CDN URL — but for preview, show the local file
      // The animate-image API needs a URL, so we use the current gallery image URL
      // Users should paste a URL or use a gallery image
    }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    const url = imageUrl.trim()
    if (!url) { toast.error("Enter an image URL or select from your gallery"); return }
    if (!text.trim()) { toast.error("Type something for her to say"); return }
    if (text.length > 500) { toast.error("Text too long (max 500 chars)"); return }

    setStep("generating")
    setResult(null)

    try {
      const res = await fetch("/api/animate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url, text: text.trim(), voiceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")
      setResult(data)
      setStep("result")
    } catch (e: any) {
      toast.error("Generation failed", { description: e.message })
      setStep("setup")
    }
  }

  const handleShare = async () => {
    if (!result?.videoUrl) return
    try {
      await navigator.clipboard.writeText(result.videoUrl)
      toast.success("Video URL copied to clipboard!")
    } catch {
      toast.error("Could not copy URL")
    }
  }

  const handleReset = () => {
    setStep("setup")
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/gallery" className="text-gray-500 hover:text-gray-300 transition text-sm">
            ← Gallery
          </Link>
          <span className="text-gray-700">|</span>
          <h1 className="font-semibold text-sm">🎙️ Speak Studio</h1>
        </div>
        <Link href="/companions" className="text-xs text-pink-400 hover:text-pink-300 transition">
          Try Companions →
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {step === "setup" && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Image picker */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">1. Choose an Image</h2>
                <p className="text-xs text-gray-500">Paste a URL from your gallery or the web</p>
              </div>

              {/* Preview box */}
              <div
                className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-gray-900 border border-gray-800 flex items-center justify-center cursor-pointer group"
                onClick={() => !imagePreview && setShowUploadModal(true)}
              >
                {imagePreview || imageUrl ? (
                  <img
                    src={imagePreview || imageUrl}
                    alt="Selected"
                    className="w-full h-full object-cover"
                    onError={() => toast.error("Image failed to load")}
                  />
                ) : (
                  <div className="text-center text-gray-600 group-hover:text-gray-500 transition">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">Click to upload an image</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://adultai-com.b-cdn.net/..."
                  value={imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setImagePreview("") }}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500/60 focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-700 text-gray-400 hover:text-white text-xs"
                  onClick={() => setShowUploadModal(true)}
                >
                  <Upload className="w-3.5 h-3.5 mr-1" /> Upload
                </Button>
              </div>

              {/* Upload modal with consent gates */}
              <UploadImageModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUploadComplete={(url) => {
                  setImageUrl(url)
                  setImagePreview(url)
                  setShowUploadModal(false)
                }}
                title="Upload Image"
                description="Upload an image to create a talking avatar. You must confirm consent before proceeding."
              />

              <Link href="/gallery">
                <Button variant="outline" size="sm" className="w-full border-gray-700 text-gray-400 hover:text-white text-xs">
                  <ImageIcon className="w-3.5 h-3.5 mr-1" /> Choose from My Gallery
                </Button>
              </Link>
            </div>

            {/* Right: Voice + Text */}
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">2. Choose a Voice</h2>
                <p className="text-xs text-gray-500">Each voice has a different character</p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVoiceId(v.id)}
                    className={`flex flex-col items-center p-3 rounded-xl border text-xs transition-all ${
                      voiceId === v.id
                        ? "border-pink-500 bg-pink-500/10 text-pink-200"
                        : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                    }`}
                  >
                    <span className="text-xl mb-1">{v.emoji}</span>
                    <span className="font-semibold">{v.name}</span>
                    <span className="opacity-70 text-[10px] text-center leading-tight mt-0.5">{v.desc}</span>
                  </button>
                ))}
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-1">3. What should she say?</h2>
                <p className="text-xs text-gray-500 mb-3">Up to 500 characters · {text.length}/500</p>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={PHRASE_SUGGESTIONS[0]}
                  rows={4}
                  maxLength={500}
                  className="bg-gray-900 border-gray-700 text-sm resize-none focus:border-pink-500/60"
                />

                {/* Phrase suggestions */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PHRASE_SUGGESTIONS.slice(0, 4).map((p) => (
                    <button
                      key={p}
                      onClick={() => setText(p.replace(/&apos;/g, "'"))}
                      className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded-full transition"
                    >
                      {p.replace(/&apos;/g, "'").slice(0, 30)}...
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!imageUrl.trim() || !text.trim()}
                className="w-full h-12 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold text-sm"
                size="lg"
              >
                <Mic className="w-4 h-4 mr-2" />
                Generate Speaking Video
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-pink-600/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-pink-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full bg-pink-500/10 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-white">Generating voice + lip sync...</p>
              <p className="text-sm text-gray-500 mt-1">This takes about 20–40 seconds</p>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-gray-600 text-center">
              <p>🎙️ Synthesizing {selectedVoice.name}&apos;s voice</p>
              <p>🤖 Applying lip sync with Wav2Lip</p>
              <p>✨ Rendering final video</p>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Video */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Your Video</h2>
              {result.videoUrl ? (
                <div className="rounded-xl overflow-hidden bg-black aspect-[3/4]">
                  <video
                    src={result.videoUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : result.audioOnly && result.audioUrl ? (
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center space-y-3">
                  <Mic className="w-12 h-12 mx-auto text-pink-400" />
                  <p className="text-sm text-gray-400">Voice generated — lip sync not available for this image.</p>
                  <audio src={result.audioUrl} controls className="w-full" />
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-300">Voice: {selectedVoice.emoji} {selectedVoice.name}</p>
                <p className="text-sm text-gray-400 italic">&quot;{text}&quot;</p>
              </div>

              <div className="space-y-2">
                {result.videoUrl && (
                  <>
                    <a
                      href={result.videoUrl}
                      download="speaking-companion.mp4"
                      className="flex items-center justify-center gap-2 w-full py-3 bg-green-700/30 hover:bg-green-700/50 border border-green-700/40 rounded-xl text-green-300 text-sm font-medium transition"
                    >
                      <Download className="w-4 h-4" /> Download Video
                    </a>
                    <button
                      onClick={handleShare}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-blue-700/20 hover:bg-blue-700/40 border border-blue-700/40 rounded-xl text-blue-300 text-sm font-medium transition"
                    >
                      <Share2 className="w-4 h-4" /> Copy Share Link
                    </button>
                  </>
                )}
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 text-sm transition"
                >
                  <RotateCcw className="w-4 h-4" /> Make Another
                </button>
              </div>

              <div className="bg-gradient-to-br from-pink-950/50 to-purple-950/50 border border-pink-900/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-pink-300 mb-1">Want a companion who always speaks?</p>
                <p className="text-xs text-gray-500 mb-3">
                  Create a custom AI companion with your own voice, personality, and appearance.
                </p>
                <Link href="/companions">
                  <Button size="sm" className="w-full bg-pink-600 hover:bg-pink-500 text-white text-xs">
                    Create Your Companion →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
