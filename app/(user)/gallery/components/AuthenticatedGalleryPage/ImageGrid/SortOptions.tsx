'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortOption = 'recent' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime';

interface SortOptionsProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortOptions({ value, onChange }: SortOptionsProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Sort by:</span>
      <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Most Recent</SelectItem>
          <SelectItem value="daily">Popular Today</SelectItem>
          <SelectItem value="weekly">Popular This Week</SelectItem>
          <SelectItem value="monthly">Popular This Month</SelectItem>
          <SelectItem value="yearly">Popular This Year</SelectItem>
          <SelectItem value="allTime">Popular All Time</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
