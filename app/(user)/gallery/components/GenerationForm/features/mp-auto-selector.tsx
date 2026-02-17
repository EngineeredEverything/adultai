"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion } from "framer-motion"
import { Lock } from "lucide-react"

interface MPAutoSelectorProps {
  selectedMP: string
  onMPChange: (mp: string) => void
  onPremiumRequired: () => void
  hasAccess: boolean
}

export function MPAutoSelector({ selectedMP, onMPChange, onPremiumRequired, hasAccess }: MPAutoSelectorProps) {
  const mpOptions = [
    { id: "standard", name: "Standard", premium: false },
    { id: "fast", name: "Fast", premium: true },
    { id: "ultra-fast", name: "Ultra Fast", premium: true },
  ]

  const selectedMPName = mpOptions.find((mp) => mp.id === selectedMP)?.name || "Standard"

  const handleMPSelect = (mp: { id: string; premium: boolean }) => {
    if (mp.premium && !hasAccess) {
      onPremiumRequired()
      return
    }
    onMPChange(mp.id)
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
            Speed: {selectedMPName}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="space-y-1">
            {mpOptions.map((mp) => (
              <Button
                key={mp.id}
                variant={selectedMP === mp.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-between"
                onClick={() => handleMPSelect(mp)}
              >
                <span>{mp.name}</span>
                {mp.premium && !hasAccess && <Lock className="h-3 w-3" />}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </motion.div>
  )
}
