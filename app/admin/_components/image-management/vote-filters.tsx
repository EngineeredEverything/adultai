"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronUp, ChevronDown, TrendingUp } from "lucide-react"

interface VoteFiltersProps {
  filters: {
    minUpvotes?: number
    maxUpvotes?: number
    minDownvotes?: number
    maxDownvotes?: number
    minVoteScore?: number
    maxVoteScore?: number
    hasVotes?: boolean
    voteRatio?: "positive" | "negative" | "neutral"
  }
  onFiltersChange: (filters: any) => void
  disabled?: boolean
}

export function VoteFilters({ filters, onFiltersChange, disabled = false }: VoteFiltersProps) {
  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ [key]: value === "" ? undefined : value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Vote Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vote Range Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Upvotes Range */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ChevronUp className="h-4 w-4 text-green-600" />
              Upvotes Range
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                min="0"
                value={filters.minUpvotes ?? ""}
                onChange={(e) => updateFilter("minUpvotes", e.target.value ? Number(e.target.value) : undefined)}
                disabled={disabled}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Max"
                min="0"
                value={filters.maxUpvotes ?? ""}
                onChange={(e) => updateFilter("maxUpvotes", e.target.value ? Number(e.target.value) : undefined)}
                disabled={disabled}
                className="flex-1"
              />
            </div>
          </div>

          {/* Downvotes Range */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ChevronDown className="h-4 w-4 text-red-600" />
              Downvotes Range
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                min="0"
                value={filters.minDownvotes ?? ""}
                onChange={(e) => updateFilter("minDownvotes", e.target.value ? Number(e.target.value) : undefined)}
                disabled={disabled}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Max"
                min="0"
                value={filters.maxDownvotes ?? ""}
                onChange={(e) => updateFilter("maxDownvotes", e.target.value ? Number(e.target.value) : undefined)}
                disabled={disabled}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Vote Score Range */}
        <div className="space-y-2">
          <Label>Vote Score Range</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min Score"
              value={filters.minVoteScore ?? ""}
              onChange={(e) => updateFilter("minVoteScore", e.target.value ? Number(e.target.value) : undefined)}
              disabled={disabled}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Max Score"
              value={filters.maxVoteScore ?? ""}
              onChange={(e) => updateFilter("maxVoteScore", e.target.value ? Number(e.target.value) : undefined)}
              disabled={disabled}
              className="flex-1"
            />
          </div>
        </div>

        {/* Vote Ratio Filter */}
        <div className="space-y-2">
          <Label>Vote Ratio</Label>
          <Select
            value={filters.voteRatio || "all"}
            onValueChange={(value) => updateFilter("voteRatio", value === "all" ? undefined : value)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select vote ratio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratios</SelectItem>
              <SelectItem value="positive">Positive (More Upvotes)</SelectItem>
              <SelectItem value="negative">Negative (More Downvotes)</SelectItem>
              <SelectItem value="neutral">Neutral (Equal Votes)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Has Votes Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="hasVotes"
            checked={filters.hasVotes ?? false}
            onCheckedChange={(checked) => updateFilter("hasVotes", checked ? true : undefined)}
            disabled={disabled}
          />
          <Label
            htmlFor="hasVotes"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Only show images with votes
          </Label>
        </div>
      </CardContent>
    </Card>
  )
}
