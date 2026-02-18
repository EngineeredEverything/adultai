"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUpDown, Clock, TrendingUp, Check } from "lucide-react"

export type SortOption = 
  | "newest"
  | "popular-week"
  | "popular-month"
  | "popular-year"
  | "popular-all"

interface GallerySortMenuProps {
  currentSort: SortOption
  onSortChange: (sort: SortOption) => void
}

const sortOptions = [
  { value: "newest" as const, label: "Newest First", icon: Clock },
  { value: "popular-week" as const, label: "Popular This Week", icon: TrendingUp },
  { value: "popular-month" as const, label: "Popular This Month", icon: TrendingUp },
  { value: "popular-year" as const, label: "Popular This Year", icon: TrendingUp },
  { value: "popular-all" as const, label: "All Time Popular", icon: TrendingUp },
]

export function GallerySortMenu({ currentSort, onSortChange }: GallerySortMenuProps) {
  const currentOption = sortOptions.find((opt) => opt.value === currentSort)
  const Icon = currentOption?.icon || ArrowUpDown

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 border-gray-700 hover:border-purple-500"
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{currentOption?.label || "Sort"}</span>
          <span className="sm:hidden">Sort</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-800">
        <DropdownMenuLabel className="text-gray-400">Sort Gallery By</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-800" />
        
        {sortOptions.map((option) => {
          const OptionIcon = option.icon
          const isSelected = currentSort === option.value
          
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onSortChange(option.value)}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 focus:bg-gray-800"
            >
              <OptionIcon className="w-4 h-4 text-gray-400" />
              <span className="flex-1">{option.label}</span>
              {isSelected && <Check className="w-4 h-4 text-purple-500" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
