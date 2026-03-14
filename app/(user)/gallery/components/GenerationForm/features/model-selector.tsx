"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion } from "framer-motion"
import { Check } from "lucide-react"

// ═══════════════════════════════════════════════════════════════════════════════════
// MODEL OPTIMIZATION STRATEGY
// ═══════════════════════════════════════════════════════════════════════════════════
// Each model has been researched on official Civitai pages + community benchmarks.
// Optimal settings balance: quality, speed, consistency, and NSFW detail adherence.
// Users can override ANY setting—these are just smart defaults that auto-load.
//
// RESEARCH SOURCES:
// • CyberRealistic Pony v16: 30+ steps, CFG 5, DPM++ SDE Karras (Civitai official)
// • Pony Realism v2.2:       20-30 steps, CFG 7, Euler (Hugging Face + Reddit)
// • DAMN! v5 (Illustrious):  30-40 steps, CFG 3-6, DPM++ 2M/3M SDE (Civitai official)
// • Lustify v7 (SDXL NSFW):  30 steps, CFG 4-7, DPM++ 2M/3M SDE (HF + Civitai)
// • Pony Diffusion V6 XL:    25 steps, CFG 7, Euler a (Civitai official)
//
// CLIP_SKIP: Pony models = 2, Illustrious (DAMN!) = varies, SDXL = 1-2
// GPU auto-injects: quality prefixes, negative weights, clip_skip per model.
// ═══════════════════════════════════════════════════════════════════════════════════

export const MODEL_DEFAULTS: Record<string, {
  steps: number
  cfg: number
  sampler: string
  clipSkip?: number
  hiresFix?: boolean
  hiresScale?: number
  hiresDenoise?: number
}> = {
  cyberrealistic_pony: {
    // Cinematic photorealism — best with moderate steps + low CFG
    steps: 35,
    cfg: 5,
    sampler: "dpmpp_sde_karras",
    clipSkip: 2,
    hiresFix: true,
    hiresScale: 1.5,
    hiresDenoise: 0.35,
  },

  pony_realism: {
    // Hyper-detailed skin + anatomy — needs higher CFG to prevent oversaturation
    steps: 35,
    cfg: 6.5,
    sampler: "euler_a",
    clipSkip: 2,
    hiresFix: true,
    hiresScale: 1.5,
    hiresDenoise: 0.35,
  },

  lustify: {
    // NSFW-optimized SDXL — strong prompt adherence, explicit detail
    // Recommended: DPM++ 2M/3M SDE, 30 steps, CFG 4-7 (lower = more realistic)
    steps: 32,
    cfg: 6,
    sampler: "dpmpp_2m_sde",
    clipSkip: 1,
    hiresFix: true,
    hiresScale: 1.4,
    hiresDenoise: 0.35,
  },

  damn_pony: {
    // Illustrious base — diverse styles, strong anatomy
    // Official: Euler a 20-28 steps CFG 5-7; DAMN! 30-40 steps CFG 3-6
    // Using DAMN!'s recommendations (more conservative)
    steps: 36,
    cfg: 5,
    sampler: "dpmpp_2m_sde",
    clipSkip: 1,
    hiresFix: true,
    hiresScale: 1.5,
    hiresDenoise: 0.35,
  },

  pony_diffusion: {
    // Fantasy & Creatures — Pony Diffusion V6 XL specifics
    // Official: Euler a 25 steps, CFG 7-9, clip skip 2
    steps: 28,
    cfg: 7.5,
    sampler: "euler_a",
    clipSkip: 2,
    hiresFix: true,
    hiresScale: 1.5,
    hiresDenoise: 0.3,
  },
}

// Real GPU models — SDXL only (SD 1.5 removed)
export const GPU_MODELS = [
  {
    id: "cyberrealistic_pony",
    name: "Realistic",
    badge: "Default",
    description: "Cinematic photorealism — beautiful faces, detailed skin, expressive scenes",
    premium: false,
  },
  {
    id: "pony_realism",
    name: "Pony Realism",
    badge: "HD",
    description: "Hyper-detailed skin texture, anatomy, and lighting. Best for close-up shots",
    premium: false,
  },
  {
    id: "lustify",
    name: "Lustify",
    badge: "NSFW",
    description: "NSFW-optimized SDXL — strong prompt adherence, explicit anatomy detail",
    premium: false,
  },
  {
    id: "damn_pony",
    name: "DAMN!",
    badge: "Artistic",
    description: "Illustrious/NoobAI base — diverse styles, strong anatomy, semi-realistic art",
    premium: false,
  },
  {
    id: "pony_diffusion",
    name: "Fantasy & Creatures",
    badge: "Fantasy",
    description: "Pony Diffusion V6 XL — anthro, feral, fantasy creatures, all species NSFW",
    premium: false,
  },
]

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (model: string, defaults?: { steps: number; cfg: number; sampler: string }) => void
  onPremiumRequired: () => void
  hasAccess: boolean
}

export function ModelSelector({ selectedModel, onModelChange, onPremiumRequired, hasAccess }: ModelSelectorProps) {
  const selected = GPU_MODELS.find((m) => m.id === selectedModel) ?? GPU_MODELS[0]

  const handleModelSelect = (model: typeof GPU_MODELS[0]) => {
    if (model.premium && !hasAccess) {
      onPremiumRequired()
      return
    }
    onModelChange(model.id, MODEL_DEFAULTS[model.id])
  }

  return (
    <motion.div whileTap={{ scale: 0.95 }}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 whitespace-nowrap"
          >
            {selected.name}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2">
          <p className="text-xs text-muted-foreground px-2 pb-2 font-medium uppercase tracking-wide">AI Model</p>
          <div className="space-y-1">
            {GPU_MODELS.map((model) => (
              <Button
                key={model.id}
                variant={selectedModel === model.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-between text-left h-auto py-2"
                onClick={() => handleModelSelect(model)}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    <span className="text-[10px] bg-muted text-muted-foreground rounded px-1 py-0.5">{model.badge}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-normal leading-tight">{model.description}</span>
                </div>
                {selectedModel === model.id && <Check className="h-4 w-4 ml-2 flex-shrink-0" />}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </motion.div>
  )
}
