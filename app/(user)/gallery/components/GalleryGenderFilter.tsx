"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export type GenderOption = "all" | "female" | "male" | "other"

interface GalleryGenderFilterProps {
  currentGender: GenderOption
  onGenderChange: (gender: GenderOption) => void
}

const genderOptions = [
  { value: "all" as const, label: "All" },
  { value: "female" as const, label: "Women" },
  { value: "male" as const, label: "Men" },
  { value: "other" as const, label: "Other" },
]

export function GalleryGenderFilter({ currentGender, onGenderChange }: GalleryGenderFilterProps) {
  return (
    <div className="flex justify-center gap-2 py-4">
      {genderOptions.map((option) => (
        <Button
          key={option.value}
          variant={currentGender === option.value ? "primary" : "outline"}
          onClick={() => onGenderChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}