"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion } from "framer-motion"
import { Lock } from "lucide-react"

interface ColorSelectorProps {
  selectedColor: string
  onColorChange: (color: string) => void
  onPremiumRequired: () => void
  hasAccess: boolean
}

export function ColorSelector({ selectedColor, onColorChange, onPremiumRequired, hasAccess }: ColorSelectorProps) {
  const colors = [
    { id: "natural", name: "Natural", premium: false },
    { id: "vibrant", name: "Vibrant", premium: true },
    { id: "muted", name: "Muted", premium: true },
    { id: "warm", name: "Warm", premium: true },
    { id: "cool", name: "Cool", premium: true },
  ]

  const selectedColorName = colors.find((c) => c.id === selectedColor)?.name || "Natural"

  const handleColorSelect = (color: { id: string; premium: boolean }) => {
    if (color.premium && !hasAccess) {
      onPremiumRequired()
      return
    }
    onColorChange(color.id)
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
            disabled={!hasAccess}
          >
            Color: {selectedColorName}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="space-y-1">
            {colors.map((color) => (
              <Button
                key={color.id}
                variant={selectedColor === color.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-between"
                onClick={() => handleColorSelect(color)}
              >
                <span>{color.name}</span>
                {color.premium && !hasAccess && <Lock className="h-3 w-3" />}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </motion.div>
  )
}
