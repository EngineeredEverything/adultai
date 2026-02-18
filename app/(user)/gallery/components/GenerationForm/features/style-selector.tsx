"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion } from "framer-motion"
import { Lock } from "lucide-react"

interface StyleSelectorProps {
  selectedStyle: string
  onStyleChange: (style: string) => void
  onPremiumRequired: () => void
  hasAccess: boolean
}

export function StyleSelector({ selectedStyle, onStyleChange, onPremiumRequired, hasAccess }: StyleSelectorProps) {
  const styles = [
    { id: "none", name: "None", premium: false },
    { id: "photographic", name: "Photographic", premium: true },
    { id: "digital-art", name: "Digital Art", premium: true },
    { id: "cinematic", name: "Cinematic", premium: true },
    { id: "anime", name: "Anime", premium: true },
  ]

  const selectedStyleName = styles.find((s) => s.id === selectedStyle)?.name || "None"

  const handleStyleSelect = (style: { id: string; premium: boolean }) => {
    if (style.premium && !hasAccess) {
      onPremiumRequired()
      return
    }
    onStyleChange(style.id)
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
            // disabled={!hasAccess}
          >
            Style: {selectedStyleName}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="space-y-1">
            {styles.map((style) => (
              <Button
                key={style.id}
                variant={selectedStyle === style.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-between"
                onClick={() => handleStyleSelect(style)}
              >
                <span>{style.name}</span>
                {style.premium && !hasAccess && <Lock className="h-3 w-3" />}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </motion.div>
  )
}
