"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles, Wand2, Mic, UserPlus, Loader2, Play,
  Volume2, Film, ArrowUpCircle, Sliders, ChevronDown, Download, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import type { SearchImagesResponseSuccessType } from "@/types/images"

type Panel = "talk" | "img2img" | "video" | "upscale" | null

interface ImageActionsProps {
  image: SearchImagesResponseSuccessType["images"][number]
  onGenerateVariations?: (prompt: string) => void
  onSetPrompt?: (prompt: string) => void
}

export function ImageActions({ image, onGenerateVariations, onSetPrompt }: ImageActionsProps) {
  const router = useRouter()
  const [activePanel, setActivePanel] = useState<Panel>(null)

  // Talk state
  const [talkText, setTalkText] = useState("")
  const [talkLoading, setTalkLoading] = useState(false)
  const [talkResult, setTalkResult] = useState<{ videoUrl?: string | null; audioUrl?: string | null; audioOnly?: boolean } | null>(null)

  // img2img state
  const [editPrompt, setEditPrompt] = useState("")
  const [strength, setStrength] = useState(0.65)
  const [img2imgLoading, setImg2imgLoading] = useState(false)
  const [img2imgResult, setImg2imgResult] = useState<string | null>(null)
  const [img2imgUpgradeRequired, setImg2imgUpgradeRequired] = useState(false)

  // Video state
  const [motionStrength, setMotionStrength] = useState(100)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoResult, setVideoResult] = useState<string | null>(null)

  // Upscale state
  const [upscaleLoading, setUpscaleLoading] = useState<2 | 4 | null>(null)
  const [upscaleResult, setUpscaleResult] = useState<{ url: string; scale: number } | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const imageUrl = image.image.cdnUrl || image.image.imageUrl
  const prompt = image.image.prompt || ""

  const togglePanel = (p: Panel) => setActivePanel((prev) => (prev === p ? null : p))

  // ── Variations ──────────────────────────────────────────────────────────
  const handleVariations = () => {
    if (!prompt) { toast.error("No prompt to vary"); return }
    if (onGenerateVariations) { onGenerateVariations(prompt); toast.success("Prompt loaded — hit Generate for variations") }
    else router.push(`/gallery?prompt=${encodeURIComponent(prompt)}`)
  }

  // ── Refine ─────────────────────────────────────────────────────────────
  const handleRefine = () => {
    if (!prompt) { toast.error("No prompt"); return }
    if (onSetPrompt) { onSetPrompt(prompt); toast.success("Prompt loaded for editing") }
    else router.push(`/gallery?prompt=${encodeURIComponent(prompt)}`)
  }

  // ── Create Companion ────────────────────────────────────────────────────
  const handleCompanion = () => {
    if (!imageUrl) return
    router.push(`/companions/customize?imageUrl=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`)
  }

  // ── Make it Talk ────────────────────────────────────────────────────────
  const handleTalk = async () => {
    if (!talkText.trim()) { toast.error("Enter something for her to say"); return }
    setTalkLoading(true); setTalkResult(null)
    try {
      const res = await fetch("/api/animate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, text: talkText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setTalkResult(data)
      if (data.audioUrl && !data.videoUrl) {
        const a = new Audio(data.audioUrl); audioRef.current = a; a.play().catch(() => {})
      }
    } catch (e: any) {
      toast.error("Animation failed", { description: e.message })
    } finally { setTalkLoading(false) }
  }

  // ── img2img ─────────────────────────────────────────────────────────────
  const handleImg2img = async () => {
    if (!editPrompt.trim()) { toast.error("Describe what to change"); return }
    setImg2imgLoading(true); setImg2imgResult(null); setImg2imgUpgradeRequired(false)
    try {
      const res = await fetch("/api/img2img", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, prompt: editPrompt.trim(), strength }),
      })
      const data = await res.json()
      if (data.upgradeRequired) { setImg2imgUpgradeRequired(true); return }
      if (!res.ok) throw new Error(data.error || "Failed")
      setImg2imgResult(data.imageUrl)
    } catch (e: any) {
      toast.error("Edit failed", { description: e.message })
    } finally { setImg2imgLoading(false) }
  }

  // ── Image to Video ──────────────────────────────────────────────────────
  const handleVideo = async () => {
    setVideoLoading(true); setVideoResult(null)
    toast.info("Generating video...", { description: "This takes 30-90 seconds" })
    try {
      const res = await fetch("/api/image-to-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, frames: 25, fps: 8, motionStrength }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setVideoResult(data.videoUrl)
    } catch (e: any) {
      toast.error("Video failed", { description: e.message })
    } finally { setVideoLoading(false) }
  }

  // ── Upscale ─────────────────────────────────────────────────────────────
  const handleUpscale = async (scale: 2 | 4) => {
    setUpscaleLoading(scale); setUpscaleResult(null)
    try {
      const res = await fetch("/api/upscale", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, scale }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setUpscaleResult({ url: data.imageUrl, scale })
      toast.success(`${scale}x upscale ready!`)
    } catch (e: any) {
      toast.error("Upscale failed", { description: e.message })
    } finally { setUpscaleLoading(null) }
  }

  const strengthLabel = strength <= 0.3 ? "Subtle" : strength <= 0.55 ? "Moderate" : strength <= 0.75 ? "Strong" : "Heavy"

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden text-sm">

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-800">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">What next?</p>
      </div>

      {/* ── Row 1: Quick actions ── */}
      <div className="p-3 grid grid-cols-2 gap-2">

        <ActionBtn icon={<Sparkles className="w-3.5 h-3.5" />} label="Variations" color="purple"
          onClick={handleVariations} disabled={!prompt} />

        <ActionBtn icon={<Wand2 className="w-3.5 h-3.5" />} label="Refine Prompt" color="blue"
          onClick={handleRefine} disabled={!prompt} />

        <ActionBtn icon={<Film className="w-3.5 h-3.5" />} label="Animate" color="pink"
          onClick={() => togglePanel("video")} active={activePanel === "video"}
          loading={videoLoading} />

        <ActionBtn icon={<Sliders className="w-3.5 h-3.5" />} label="Edit / Remix" color="amber"
          onClick={() => togglePanel("img2img")} active={activePanel === "img2img"}
          loading={img2imgLoading} />

        <ActionBtn icon={<ArrowUpCircle className="w-3.5 h-3.5" />} label="Upscale 2×" color="green"
          onClick={() => { togglePanel("upscale"); handleUpscale(2) }} loading={upscaleLoading === 2} />

        <ActionBtn icon={<ArrowUpCircle className="w-3.5 h-3.5" />} label="Upscale 4×" color="green"
          onClick={() => { togglePanel("upscale"); handleUpscale(4) }} loading={upscaleLoading === 4} />

        <ActionBtn icon={<Mic className="w-3.5 h-3.5" />} label="Make it Talk" color="red"
          onClick={() => togglePanel("talk")} active={activePanel === "talk"} />

        <ActionBtn icon={<UserPlus className="w-3.5 h-3.5" />} label="Create Companion" color="teal"
          onClick={handleCompanion} />
      </div>

      {/* ── Animate (image-to-video) panel ── */}
      {activePanel === "video" && (
        <Panel title="Animate Image" onClose={() => setActivePanel(null)}>
          <p className="text-xs text-gray-500 mb-3">
            Turn this image into a 3-second animated video clip.
          </p>
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Motion intensity</span>
              <span>{motionStrength < 80 ? "Gentle" : motionStrength < 150 ? "Medium" : "Energetic"}</span>
            </div>
            <Slider value={[motionStrength]} min={30} max={220} step={10}
              onValueChange={([v]) => setMotionStrength(v)}
              className="[&_.slider-track]:bg-gray-700 [&_.slider-range]:bg-pink-500" />
          </div>
          <Button size="sm" onClick={handleVideo} disabled={videoLoading}
            className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500">
            {videoLoading ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating (~60s)</> : <><Film className="w-3.5 h-3.5 mr-2" />Generate Video</>}
          </Button>
          {videoResult && (
            <div className="mt-3 rounded-lg overflow-hidden bg-black aspect-[9/16] relative">
              <video src={videoResult} controls autoPlay loop playsInline className="w-full h-full object-contain" />
              <a href={videoResult} download className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg hover:bg-black/70 transition">
                <Download className="w-3.5 h-3.5 text-white" />
              </a>
            </div>
          )}
        </Panel>
      )}

      {/* ── Edit / Remix (img2img) panel ── */}
      {activePanel === "img2img" && (
        <Panel title="Edit / Remix" onClose={() => setActivePanel(null)}>
          {img2imgUpgradeRequired ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-amber-400">GPU API update required for this feature.</p>
              <p className="text-xs text-gray-500">Deploy the GPU API patch from the workspace to enable img2img.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Describe what to change — new outfit, background, expression, or style. The character stays, the details change.
              </p>

              <Textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                placeholder={'e.g. "wearing a red silk dress" or "in a forest at night" or "smiling seductively"'}
                rows={2} className="bg-gray-800 border-gray-700 text-sm resize-none focus:border-amber-500/60 mb-3" />

              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Change intensity</span>
                  <span className={
                    strength <= 0.3 ? "text-blue-400" :
                    strength <= 0.55 ? "text-green-400" :
                    strength <= 0.75 ? "text-amber-400" : "text-red-400"
                  }>{strengthLabel}</span>
                </div>
                <Slider value={[strength]} min={0.1} max={0.95} step={0.05}
                  onValueChange={([v]) => setStrength(v)}
                  className="[&_.slider-track]:bg-gray-700 [&_.slider-range]:bg-amber-500" />
                <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                  <span>Subtle</span><span>Moderate</span><span>Heavy</span>
                </div>
              </div>

              <Button size="sm" onClick={handleImg2img} disabled={img2imgLoading || !editPrompt.trim()}
                className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500">
                {img2imgLoading ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Editing (~30s)</> : <><Wand2 className="w-3.5 h-3.5 mr-2" />Apply Edit</>}
              </Button>

              {img2imgResult && (
                <div className="mt-3 space-y-2">
                  <img src={img2imgResult} alt="Edited" className="w-full rounded-lg" />
                  <div className="flex gap-2">
                    <a href={img2imgResult} download
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-xs text-gray-300">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                    <button onClick={() => {
                      if (onSetPrompt && editPrompt) onSetPrompt(editPrompt)
                      toast.success("Loaded into form for further editing")
                    }} className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-xs text-gray-300">
                      Refine further
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>
      )}

      {/* ── Upscale result ── */}
      {activePanel === "upscale" && upscaleResult && (
        <Panel title={`${upscaleResult.scale}× Upscaled`} onClose={() => setActivePanel(null)}>
          <img src={upscaleResult.url} alt="Upscaled" className="w-full rounded-lg" />
          <a href={upscaleResult.url} download
            className="mt-2 flex items-center justify-center gap-1.5 py-2 bg-green-700/30 hover:bg-green-700/50 border border-green-700/40 rounded-lg transition text-xs text-green-300">
            <Download className="w-3.5 h-3.5" /> Download {upscaleResult.scale}× Image
          </a>
        </Panel>
      )}

      {/* ── Make it Talk panel ── */}
      {activePanel === "talk" && (
        <Panel title="Make it Talk" onClose={() => setActivePanel(null)}>
          <p className="text-xs text-gray-500 mb-3">Type what she should say — get voice + lip sync.</p>
          <Textarea value={talkText} onChange={(e) => setTalkText(e.target.value)}
            placeholder={'"Hey... I was just thinking about you."'}
            rows={2} maxLength={500}
            className="bg-gray-800 border-gray-700 text-sm resize-none focus:border-pink-500/60 mb-3" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleTalk} disabled={talkLoading || !talkText.trim()}
              className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500">
              {talkLoading ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating (~20s)</> : <><Mic className="w-3.5 h-3.5 mr-2" />Animate</>}
            </Button>
            {talkResult && (
              <Button size="sm" variant="outline" className="border-gray-700"
                onClick={() => {
                  if (talkResult.audioUrl) { const a = new Audio(talkResult.audioUrl); a.play().catch(() => {}) }
                }}>
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          {talkResult?.videoUrl && (
            <div className="mt-3 rounded-lg overflow-hidden bg-black aspect-[3/4]">
              <video src={talkResult.videoUrl} controls autoPlay playsInline className="w-full h-full object-contain" />
            </div>
          )}
          {talkResult?.audioOnly && (
            <div className="mt-3 flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400">
              <Volume2 className="w-4 h-4 text-pink-400" />
              <span>Voice ready — lip sync not available for this image.</span>
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}

// ── Reusable sub-components ────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  purple: "hover:border-purple-500 hover:bg-purple-500/10 hover:text-purple-300 data-[active=true]:border-purple-500 data-[active=true]:bg-purple-500/10 data-[active=true]:text-purple-300",
  blue:   "hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-300",
  pink:   "hover:border-pink-500 hover:bg-pink-500/10 hover:text-pink-300 data-[active=true]:border-pink-500 data-[active=true]:bg-pink-500/10 data-[active=true]:text-pink-300",
  amber:  "hover:border-amber-500 hover:bg-amber-500/10 hover:text-amber-300 data-[active=true]:border-amber-500 data-[active=true]:bg-amber-500/10 data-[active=true]:text-amber-300",
  green:  "hover:border-green-500 hover:bg-green-500/10 hover:text-green-300",
  red:    "hover:border-red-400 hover:bg-red-500/10 hover:text-red-300 data-[active=true]:border-red-400 data-[active=true]:bg-red-500/10 data-[active=true]:text-red-300",
  teal:   "hover:border-teal-500 hover:bg-teal-500/10 hover:text-teal-300",
}

function ActionBtn({ icon, label, color, onClick, disabled, active, loading }: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void
  disabled?: boolean; active?: boolean; loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-active={active ? "true" : undefined}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 text-gray-400 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${COLOR_MAP[color] ?? ""}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> : <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  )
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-800 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">{title}</span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {children}
    </div>
  )
}
