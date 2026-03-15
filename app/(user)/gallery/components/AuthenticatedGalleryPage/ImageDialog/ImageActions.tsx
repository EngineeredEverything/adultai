"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles, Wand2, Mic, UserPlus, Loader2, Play,
  Volume2, Film, ArrowUpCircle, Sliders, ChevronDown, Download, X, Repeat2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import { showAuthToast } from "@/lib/auth-toast"
import { Globe, Lock, Check, Save } from "lucide-react"
import type { SearchImagesResponseSuccessType } from "@/types/images"

type Panel = "talk" | "img2img" | "video" | "upscale" | "ipAdapter" | null

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
  const [talkVoiceId, setTalkVoiceId] = useState("cgSgspJ2msm6clMCkdW9")
  const [talkIsPublic, setTalkIsPublic] = useState(false)
  const [talkResult, setTalkResult] = useState<{ videoUrl?: string | null; audioUrl?: string | null; audioOnly?: boolean; videoId?: string | null } | null>(null)

  // img2img state
  const [editPrompt, setEditPrompt] = useState(image.image.prompt || "")
  const [editNegative, setEditNegative] = useState("")
  const [strength, setStrength] = useState(0.5)
  const [editSteps, setEditSteps] = useState(30)
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(false)
  const [img2imgLoading, setImg2imgLoading] = useState(false)
  const [img2imgResult, setImg2imgResult] = useState<string | null>(null)
  const [img2imgUpgradeRequired, setImg2imgUpgradeRequired] = useState(false)
  const [moreOfHerMode, setMoreOfHerMode] = useState(false)

  // IP-Adapter state
  const [ipAdapterPrompt, setIpAdapterPrompt] = useState(image.image.prompt || "")
  const [ipAdapterNegative, setIpAdapterNegative] = useState("")
  const [ipAdapterSteps, setIpAdapterSteps] = useState(30)
  const [ipAdapterScale, setIpAdapterScale] = useState(0.6)
  const [showAdvancedIpAdapter, setShowAdvancedIpAdapter] = useState(false)
  const [ipAdapterLoading, setIpAdapterLoading] = useState(false)
  const [ipAdapterResult, setIpAdapterResult] = useState<string | null>(null)
  const [ipAdapterUpgradeRequired, setIpAdapterUpgradeRequired] = useState(false)

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

  // ── Make Me Talk ────────────────────────────────────────────────────────
  const handleTalk = async () => {
    if (!talkText.trim()) { toast.error("Enter something for her to say"); return }
    setTalkLoading(true); setTalkResult(null)
    try {
      const res = await fetch("/api/animate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, text: talkText.trim(), voiceId: talkVoiceId, isPublic: talkIsPublic }),
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
    if (!editPrompt.trim()) { toast.error("Enter a prompt describing the result you want"); return }
    setImg2imgLoading(true); setImg2imgResult(null); setImg2imgUpgradeRequired(false)
    try {
      const res = await fetch("/api/img2img", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          prompt: editPrompt.trim(),
          negativePrompt: editNegative.trim() || undefined,
          strength,
          steps: editSteps,
          modelId: image.image.modelId || "cyberrealistic_pony",
        }),
      })
      const data = await res.json()
      if (data.upgradeRequired) { setImg2imgUpgradeRequired(true); return }
      if (!res.ok) throw new Error(data.error || "Failed")
      setImg2imgResult(data.imageUrl)
      toast.success("Edit complete!")
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

  // ── More of her (low-strength img2img) ──────────────────────────────────
  const handleMoreOfHer = () => {
    setEditPrompt(image.image.prompt || "")
    setEditNegative("")
    setEditSteps(30)
    setStrength(0.35)
    setMoreOfHerMode(true)
    setActivePanel("img2img")
  }

  // ── IP-Adapter (same face generation) ────────────────────────────────────
  const handleIpAdapter = async () => {
    if (!ipAdapterPrompt.trim()) { toast.error("Enter a prompt"); return }
    setIpAdapterLoading(true); setIpAdapterResult(null); setIpAdapterUpgradeRequired(false)
    try {
      const res = await fetch("/api/ip-adapter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          prompt: ipAdapterPrompt.trim(),
          negativePrompt: ipAdapterNegative.trim() || undefined,
          steps: ipAdapterSteps,
          ipAdapterScale: ipAdapterScale,
          modelId: image.image.modelId || "cyberrealistic_pony",
        }),
      })
      const data = await res.json()
      if (data.upgradeRequired) { setIpAdapterUpgradeRequired(true); return }
      if (!res.ok) throw new Error(data.error || "Failed")
      setIpAdapterResult(data.imageUrl)
      toast.success("Face-consistent generation complete!")
    } catch (e: any) {
      toast.error("Generation failed", { description: e.message })
    } finally { setIpAdapterLoading(false) }
  }

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

        <ActionBtn icon={<Repeat2 className="w-3.5 h-3.5" />} label="More of her" color="pink"
          onClick={handleMoreOfHer} disabled={!prompt} />

        <ActionBtn icon={<Sparkles className="w-3.5 h-3.5" />} label="Same Face" color="purple"
          onClick={() => togglePanel("ipAdapter")} active={activePanel === "ipAdapter"}
          loading={ipAdapterLoading} />

        <ActionBtn icon={<ArrowUpCircle className="w-3.5 h-3.5" />} label="Upscale 2×" color="green"
          onClick={() => { togglePanel("upscale"); handleUpscale(2) }} loading={upscaleLoading === 2} />

        <ActionBtn icon={<ArrowUpCircle className="w-3.5 h-3.5" />} label="Upscale 4×" color="green"
          onClick={() => { togglePanel("upscale"); handleUpscale(4) }} loading={upscaleLoading === 4} />

        <ActionBtn icon={<Mic className="w-3.5 h-3.5" />} label="Make Me Talk" color="red"
          onClick={() => togglePanel("talk")} active={activePanel === "talk"} />

        <ActionBtn icon={<UserPlus className="w-3.5 h-3.5" />} label="Create Companion" color="teal"
          onClick={handleCompanion} />

        <ActionBtn icon={<Mic className="w-3.5 h-3.5" />} label="Speak Studio ↗" color="purple"
          onClick={() => {
            if (imageUrl) {
              window.open(`/studio/speak?imageUrl=${encodeURIComponent(imageUrl)}`, "_blank")
            }
          }} />
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
            <div className="mt-3 space-y-2">
              <div className="rounded-lg overflow-hidden bg-black aspect-[9/16] relative">
                <video src={videoResult} controls autoPlay loop playsInline className="w-full h-full object-contain" />
                <a href={videoResult} download className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg hover:bg-black/70 transition">
                  <Download className="w-3.5 h-3.5 text-white" />
                </a>
              </div>
              <SaveToGalleryButtons id={videoResult} type="video" />
            </div>
          )}
        </Panel>
      )}

      {/* ── Edit / Remix (img2img) panel ── */}
      {activePanel === "img2img" && (
        <Panel title={moreOfHerMode ? "More of her" : "Edit Image"} onClose={() => { setActivePanel(null); setMoreOfHerMode(false) }}>
          {img2imgUpgradeRequired ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-amber-400">GPU API update required for this feature.</p>
            </div>
          ) : (
            <>
              {moreOfHerMode && (
                <div className="mb-3 p-2 bg-pink-500/10 border border-pink-500/30 rounded-lg">
                  <p className="text-xs text-pink-300">
                    💡 Strength is set to 0.35 to preserve the face. Change only the scene, outfit, or pose in the prompt.
                  </p>
                </div>
              )}

              {/* Strength presets */}
              <div className="flex gap-1.5 mb-3">
                {([
                  { label: "Touch-up", value: 0.25, desc: "Tiny tweaks only", color: "blue" },
                  { label: "Refine", value: 0.45, desc: "Keep structure, change details", color: "green" },
                  { label: "Restyle", value: 0.65, desc: "New look, same subject", color: "amber" },
                  { label: "Transform", value: 0.85, desc: "Heavy change", color: "red" },
                ] as const).map(({ label, value, color }) => (
                  <button
                    key={label}
                    onClick={() => setStrength(value)}
                    className={`flex-1 py-1 text-[10px] rounded-md border transition ${
                      Math.abs(strength - value) < 0.1
                        ? color === "blue" ? "border-blue-500 bg-blue-500/20 text-blue-300"
                          : color === "green" ? "border-green-500 bg-green-500/20 text-green-300"
                          : color === "amber" ? "border-amber-500 bg-amber-500/20 text-amber-300"
                          : "border-red-500 bg-red-500/20 text-red-300"
                        : "border-gray-700 text-gray-500 hover:border-gray-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Prompt — pre-filled with original */}
              <label className="block text-xs text-gray-400 mb-1">
                Prompt <span className="text-gray-600">(edit or keep as-is)</span>
              </label>
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Describe what you want in the result..."
                rows={3}
                className="bg-gray-800/60 border-gray-700 text-sm resize-none focus:border-amber-500/60 mb-3"
              />

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvancedEdit(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-300 mb-2 flex items-center gap-1 transition"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedEdit ? "rotate-180" : ""}`} />
                Advanced options
              </button>

              {showAdvancedEdit && (
                <div className="space-y-3 mb-3 bg-gray-800/40 rounded-lg p-3">
                  {/* Change strength slider */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Change strength</span>
                      <span className="font-mono">{Math.round(strength * 100)}%</span>
                    </div>
                    <Slider value={[strength]} min={0.1} max={0.95} step={0.05}
                      onValueChange={([v]) => { setStrength(v); setMoreOfHerMode(false) }}
                      className="[&_.slider-track]:bg-gray-700 [&_.slider-range]:bg-amber-500" />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                      <span>Keep original</span><span>Heavily change</span>
                    </div>
                  </div>

                  {/* Steps */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Steps</span>
                      <span className="font-mono">{editSteps}</span>
                    </div>
                    <Slider value={[editSteps]} min={15} max={50} step={1}
                      onValueChange={([v]) => setEditSteps(v)}
                      className="[&_.slider-track]:bg-gray-700 [&_.slider-range]:bg-purple-500" />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                      <span>Fast</span><span>Quality</span>
                    </div>
                  </div>

                  {/* Negative prompt */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Negative prompt <span className="text-gray-600">(optional)</span></label>
                    <Textarea
                      value={editNegative}
                      onChange={(e) => setEditNegative(e.target.value)}
                      placeholder="What to avoid..."
                      rows={2}
                      className="bg-gray-900/60 border-gray-700 text-xs resize-none focus:border-amber-500/60"
                    />
                  </div>
                </div>
              )}

              <Button size="sm" onClick={handleImg2img} disabled={img2imgLoading || !editPrompt.trim()}
                className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500">
                {img2imgLoading
                  ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Editing (~30–45s)</>
                  : <><Wand2 className="w-3.5 h-3.5 mr-2" />Apply Edit</>}
              </Button>

              {img2imgResult && (
                <div className="mt-3 space-y-2">
                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-gray-500 text-center">
                    <span>Original</span><span>Edited</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <img src={imageUrl} alt="Original" className="w-full rounded-lg object-cover aspect-[2/3]" />
                    <img src={img2imgResult} alt="Edited" className="w-full rounded-lg object-cover aspect-[2/3]" />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <a href={img2imgResult} download
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-xs text-gray-300">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                    <button
                      onClick={() => handleImg2img()}
                      disabled={img2imgLoading}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-xs text-gray-300 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Try again
                    </button>
                  </div>

                  <SaveToGalleryButtons id={img2imgResult} type="image" />
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
          <div className="mt-2">
            <SaveToGalleryButtons id={upscaleResult.url} type="image" />
          </div>
        </Panel>
      )}

      {/* ── Make Me Talk panel ── */}
      {activePanel === "talk" && (
        <Panel title="Make Me Talk" onClose={() => setActivePanel(null)}>
          <p className="text-xs text-gray-500 mb-3">Type what she should say — get voice + lip sync.</p>

          {/* Voice selector */}
          <div className="mb-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Voice</p>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", desc: "Playful" },
                { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",   desc: "Mature" },
                { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura",   desc: "Energetic" },
                { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily",    desc: "Velvety" },
                { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella",   desc: "Warm" },
                { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice",   desc: "British" },
                { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", desc: "Confident" },
                { id: "SAz9YHcvj6GT2YYXdXww", name: "River",   desc: "Neutral" },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setTalkVoiceId(v.id)}
                  className={`flex flex-col items-center py-1.5 px-1 rounded-lg border text-[10px] transition-all ${
                    talkVoiceId === v.id
                      ? "border-pink-500 bg-pink-500/10 text-pink-300"
                      : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400"
                  }`}
                >
                  <span className="font-medium">{v.name}</span>
                  <span className="opacity-70">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <Textarea value={talkText} onChange={(e) => setTalkText(e.target.value)}
            placeholder={'"Hey... I was just thinking about you."'}
            rows={2} maxLength={500}
            className="bg-gray-800 border-gray-700 text-sm resize-none focus:border-pink-500/60 mb-3" />

          {/* Public / Private toggle */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTalkIsPublic(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs transition-all ${
                talkIsPublic
                  ? "border-pink-500 bg-pink-500/10 text-pink-300"
                  : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400"
              }`}
            >
              <Globe className="w-3 h-3" /> Public
            </button>
            <button
              onClick={() => setTalkIsPublic(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs transition-all ${
                !talkIsPublic
                  ? "border-purple-500 bg-purple-500/10 text-purple-300"
                  : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400"
              }`}
            >
              <Lock className="w-3 h-3" /> Private
            </button>
          </div>

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
            <div className="mt-3 space-y-2">
              <div className="rounded-lg overflow-hidden bg-black aspect-[3/4] relative">
                <video src={talkResult.videoUrl} controls autoPlay playsInline className="w-full h-full object-contain" />
              </div>
              <a href={talkResult.videoUrl} download="adultai-speak.mp4"
                className="flex items-center justify-center gap-2 w-full py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-xs text-gray-300">
                <Download className="w-3.5 h-3.5" /> Download Video
              </a>
              {/* Visibility confirmation — saved at generation time */}
              <div className="flex items-center gap-2 py-1.5 px-3 bg-green-900/20 border border-green-700/30 rounded-lg text-xs text-green-400">
                <Check className="w-3.5 h-3.5" />
                Saved to {talkIsPublic ? "public" : "private"} lip sync gallery
              </div>
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

      {/* ── Same Face (IP-Adapter) panel ── */}
      {activePanel === "ipAdapter" && (
        <Panel title="Generate with this face" onClose={() => setActivePanel(null)}>
          {ipAdapterUpgradeRequired ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-purple-400">IP-Adapter weights are loading. Try again in a moment.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                AI keeps this person's face and generates a new scene or outfit.
              </p>

              {/* Prompt */}
              <label className="block text-xs text-gray-400 mb-1">Prompt</label>
              <Textarea
                value={ipAdapterPrompt}
                onChange={(e) => setIpAdapterPrompt(e.target.value)}
                placeholder="Describe what you want around this face..."
                rows={3}
                className="bg-gray-800/60 border-gray-700 text-sm resize-none focus:border-purple-500/60 mb-3"
              />

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvancedIpAdapter(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-300 mb-2 flex items-center gap-1 transition"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedIpAdapter ? "rotate-180" : ""}`} />
                Advanced options
              </button>

              {showAdvancedIpAdapter && (
                <div className="space-y-3 mb-3 bg-gray-800/40 rounded-lg p-3">
                  {/* Steps */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Generation steps</span>
                      <span className="font-mono">{ipAdapterSteps}</span>
                    </div>
                    <Slider value={[ipAdapterSteps]} min={20} max={40} step={1}
                      onValueChange={([v]) => setIpAdapterSteps(v)}
                      className="[&_.slider-track]:bg-gray-700 [&_.slider-range]:bg-purple-500" />
                  </div>

                  {/* Negative prompt */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Negative prompt (optional)</label>
                    <Textarea
                      value={ipAdapterNegative}
                      onChange={(e) => setIpAdapterNegative(e.target.value)}
                      placeholder="Things to avoid..."
                      rows={2}
                      className="bg-gray-900 border-gray-700 text-sm resize-none focus:border-purple-500/60"
                    />
                  </div>
                </div>
              )}

              {/* Face Influence slider */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Face influence</span>
                  <span className="font-mono">{Math.round(ipAdapterScale * 100)}%</span>
                </div>
                <Slider value={[ipAdapterScale]} min={0.3} max={1.0} step={0.05}
                  onValueChange={([v]) => setIpAdapterScale(v)}
                  className="[&_.slider-track]:bg-gray-700 [&_.slider-range]:bg-purple-500" />
                <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                  <span>Subtle</span><span>Strong</span>
                </div>
              </div>

              <Button size="sm" onClick={handleIpAdapter} disabled={ipAdapterLoading || !ipAdapterPrompt.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
                {ipAdapterLoading ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating (~30–45s)</> : <>Generate</>}
              </Button>

              {ipAdapterResult && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg overflow-hidden bg-black aspect-[9/16] relative">
                    <img src={ipAdapterResult} alt="Result" className="w-full h-full object-contain" />
                  </div>
                  <SaveToGalleryButtons id={ipAdapterResult} type="image" />
                </div>
              )}
            </>
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

function SaveToGalleryButtons({ id, type }: { id: string; type: "video" | "image" }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<"public" | "private" | null>(null)

  const handleSave = async (isPublic: boolean) => {
    setSaving(true)
    try {
      const endpoint = type === "video" ? "/api/save-to-gallery" : "/api/save-to-gallery"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type, isPublic }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setSaved(isPublic ? "public" : "private")
      toast.success(isPublic ? "Saved to public gallery!" : "Saved to your private gallery!")
    } catch {
      toast.error("Failed to save to gallery")
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-3 bg-green-900/20 border border-green-700/30 rounded-lg text-xs text-green-400">
        <Check className="w-3.5 h-3.5" />
        Saved to {saved === "public" ? "public" : "private"} gallery
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleSave(true)}
        disabled={saving}
        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-600/30 rounded-lg transition text-xs text-pink-300 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
        Save Public
      </button>
      <button
        onClick={() => handleSave(false)}
        disabled={saving}
        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition text-xs text-gray-300 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
        Save Private
      </button>
    </div>
  )
}
