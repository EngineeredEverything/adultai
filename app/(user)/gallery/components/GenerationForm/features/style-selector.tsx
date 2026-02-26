"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion } from "framer-motion"
import { Check } from "lucide-react"

const LORA_STYLES = [
  { id: "none", name: "None (Base Model)", description: "Default realistic style" },
  { id: "more_details", name: "Enhanced Detail", description: "Extra fine detail and texture" },
  { id: "epi_noiseoffset", name: "Dramatic Lighting", description: "Deep shadows, cinematic contrast" },
  { id: "polaroid_style", name: "Vintage / Polaroid", description: "Retro instant camera look" },
  { id: "ghibli_style", name: "Ghibli / Anime Art", description: "Studio Ghibli-inspired" },
  { id: "anime_lineart", name: "Anime Lineart", description: "Manga line-art style" },
  { id: "hipoly_3d", name: "3D Rendered", description: "CGI / 3D model look" },
  { id: "cute_girl_mix4", name: "Soft / Cute", description: "Soft, gentle aesthetic" },
  { id: "clothing_adjuster", name: "Clothing Control", description: "Adjust clothing presence" },
]

interface StyleSelectorProps {
  selectedStyle: string
  onStyleChange: (style: string) => void
  onPremiumRequired: () => void
  hasAccess: boolean
}

export function StyleSelector({ selectedStyle, onStyleChange }: StyleSelectorProps) {
  const selectedName = LORA_STYLES.find((s) => s.id === selectedStyle)?.name || "None"

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
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {LORA_STYLES.map((style) => (
              <Button
                key={style.id}
                variant={selectedStyle === style.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-between text-left"
                onClick={() => onStyleChange(style.id)}
              >
                <div className="flex flex-col items-start">
                  <span className="text-sm">{style.name}</span>
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
