"use client"

import { useState, useEffect } from "react"
import { getTopCategories } from "@/actions/category/info"
import { Tag, Check, X } from "lucide-react"

interface CategoryPickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  compact?: boolean
}

interface CategoryItem {
  id: string
  name: string
}

let cachedCategories: CategoryItem[] | null = null

export function CategoryPicker({ selectedIds, onChange, compact }: CategoryPickerProps) {
  const [categories, setCategories] = useState<CategoryItem[]>(cachedCategories || [])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (cachedCategories) return
    getTopCategories(50).then((cats) => {
      const items = cats.map((c: any) => ({ id: c.id, name: c.name }))
      cachedCategories = items
      setCategories(items)
    }).catch(() => {})
  }, [])

  const toggleCategory = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    )
  }

  if (categories.length === 0) return null

  // Compact: inline pills
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {categories.slice(0, 12).map((cat) => {
          const selected = selectedIds.includes(cat.id)
          return (
            <button
              key={cat.id}
              onClick={(e) => { e.stopPropagation(); toggleCategory(cat.id) }}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                selected
                  ? "bg-purple-600 text-white border-purple-600"
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
              }`}
            >
              {selected && <Check className="w-3 h-3 inline mr-0.5" />}
              {cat.name}
            </button>
          )
        })}
      </div>
    )
  }

  // Default: dropdown
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded border border-gray-700 hover:border-gray-500"
      >
        <Tag className="w-3.5 h-3.5" />
        {selectedIds.length > 0 ? `${selectedIds.length} categories` : "Add category"}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 min-w-[200px] max-h-[250px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs text-gray-400 font-medium">Categories</span>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const selected = selectedIds.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      selected
                        ? "bg-purple-600 text-white border-purple-600"
                        : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {selected && <Check className="w-3 h-3 inline mr-0.5" />}
                    {cat.name}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
