"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion } from "framer-motion"

interface AspectRatioSelectorProps {
  currentRatio: string
  onSelect: (ratio: string) => void
  width: number
  height: number
  disabled?: boolean
}

export function AspectRatioSelector({
  currentRatio,
  onSelect,
  width,
  height,
  disabled = false,
}: AspectRatioSelectorProps) {
  const ratios = [
    { label: "1:1", value: "1:1" },
    { label: "4:5", value: "4:5" },
    { label: "3:4", value: "3:4" },
    { label: "16:9", value: "16:9" },
    { label: "9:16", value: "9:16" },
  ]

  return (
    <motion.div whileTap={{ scale: 0.95 }}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 whitespace-nowrap"
            disabled={disabled}
          >
            {currentRatio}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[90vw] sm:w-[400px] max-h-[60vh] overflow-y-auto bg-popover text-popover-foreground border border-border rounded-xl"
          align="center"
        >
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2">
              {ratios.map((ratio) => (
                <Button
                  key={ratio.value}
                  variant={currentRatio === ratio.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onSelect(ratio.value)}
                  className="justify-start"
                >
                  {ratio.label}
                </Button>
              ))}
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Current: {width} × {height}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </motion.div>
  )
}
