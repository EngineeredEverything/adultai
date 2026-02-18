"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

interface PrivacyToggleProps {
  isPublic: boolean
  onToggle: () => void
  disabled?: boolean
}

export function PrivacyToggle({ isPublic, onToggle, disabled = false }: PrivacyToggleProps) {
  return (
    <motion.div whileTap={{ scale: 0.95 }}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 whitespace-nowrap"
        onClick={onToggle}
        disabled={disabled}
      >
        {isPublic ? "Public" : "Private"}
      </Button>
    </motion.div>
  )
}
