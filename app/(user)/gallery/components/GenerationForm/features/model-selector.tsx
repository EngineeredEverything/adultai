"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion } from "framer-motion"
import { Lock } from "lucide-react"

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (model: string) => void
  onPremiumRequired: () => void
  hasAccess: boolean
}

export function ModelSelector({ selectedModel, onModelChange, onPremiumRequired, hasAccess }: ModelSelectorProps) {
  const models = [
    { id: "3.0-default", name: "Default 3.0", premium: false },
    { id: "3.0-turbo", name: "Turbo 3.0", premium: true },
    { id: "3.1-pro", name: "Pro 3.1", premium: true },
  ]

  const selectedModelName = models.find((m) => m.id === selectedModel)?.name || "Default 3.0"

  const handleModelSelect = (model: { id: string; premium: boolean }) => {
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
            // disabled={!hasAccess}
          >
            {selectedModelName}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="space-y-1">
            {models.map((model) => (
              <Button
                key={model.id}
                variant={selectedModel === model.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-between"
                onClick={() => handleModelSelect(model)}
              >
                <span>{model.name}</span>
                {model.premium && !hasAccess && <Lock className="h-3 w-3" />}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </motion.div>
  )
}
