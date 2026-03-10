"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion } from "framer-motion"
import { Check } from "lucide-react"

// LoRA styles compatible with SDXL Pony models
// IDs must match LORA_REGISTRY keys in /root/urpm/core/model_loader.py
export const LORA_STYLES = [
  { id: "none", name: "Base Model", description: "No style modifier — pure model output" },
  { id: "more_details", name: "Enhanced Detail", description: "Extra fine skin texture and detail" },
  { id: "epi_noiseoffset", name: "Dramatic Lighting", description: "Deep shadows, cinematic contrast" },
  { id: "detail_tweaker", name: "Sharp & Clear", description: "Fine-grained detail control" },
]

interface StyleSelectorProps {
  selectedStyle: string
  onStyleChange: (style: string) => void
  onPremiumRequired: () => void
  hasAccess: boolean
}

export function StyleSelector({ selectedStyle, onStyleChange }: StyleSelectorProps) {
  const selectedName = LORA_STYLES.find((s) => s.id === selectedStyle)?.name || "Base Model"

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
            Style: {selectedName}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2">
          <p className="text-xs text-muted-foreground px-2 pb-2 font-medium uppercase tracking-wide">Style Modifier</p>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {LORA_STYLES.map((style) => (
              <Button
                key={style.id}
                variant={selectedStyle === style.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-between text-left h-auto py-2"
                onClick={() => onStyleChange(style.id)}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-medium">{style.name}</span>
                  <span className="text-xs text-muted-foreground font-normal">{style.description}</span>
                </div>
                {selectedStyle === style.id && <Check className="h-4 w-4 ml-2 flex-shrink-0" />}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </motion.div>
  )
}
