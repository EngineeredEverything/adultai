"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion } from "framer-motion"
import { Check } from "lucide-react"

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
  onModelChange: (model: string) => void
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
    onModelChange(model.id)
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
