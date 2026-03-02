"use client"

import { useEffect, useState } from "react"
import { getRelatedCategories } from "@/actions/category/info"
import { Spinner } from "@/components/ui/spinner"

interface SubcategoryFilterProps {
  categoryId: string
  activeSub: string | null
  onSelect: (id: string | null) => void
}

export function SubcategoryFilter({ categoryId, activeSub, onSelect }: SubcategoryFilterProps) {
  const [related, setRelated] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getRelatedCategories(categoryId, 12).then((res) => {
      if (!cancelled) {
        setRelated(res)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [categoryId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Spinner className="size-3" />
        <span className="text-xs text-muted-foreground">Loading filters…</span>
      </div>
    )
  }

  if (related.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors
          ${!activeSub
            ? "bg-pink-500 text-white border-pink-500"
            : "border-border hover:bg-muted text-muted-foreground"}`}
      >
        All
      </button>
      {related.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(activeSub === cat.id ? null : cat.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors
            ${activeSub === cat.id
              ? "bg-pink-500 text-white border-pink-500"
              : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"}`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  )
}
