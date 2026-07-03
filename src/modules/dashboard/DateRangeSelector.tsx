"use client"

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
} from "date-fns"
import { CalendarDays, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui"

export type DatePreset = "today" | "this_week" | "this_month" | "this_quarter" | "this_year"

interface Props {
  value: DatePreset
  onChange: (preset: DatePreset, startDate: string, endDate: string) => void
}

export const presetLabels: Record<DatePreset, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  this_quarter: "This Quarter",
  this_year: "This Year",
}

const presetOptions: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
]

function getRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date()
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) }
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) }
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case "this_quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) }
    case "this_year":
      return { start: startOfYear(now), end: endOfYear(now) }
  }
}

function formatRange(start: Date, end: Date): string {
  const fmt = "MMM d, yyyy"
  if (start.toDateString() === end.toDateString()) {
    return format(start, fmt)
  }
  return `${format(start, "MMM d")} – ${format(end, fmt)}`
}

export default function DateRangeSelector({ value, onChange }: Props) {
  const range = getRange(value)
  const display = formatRange(range.start, range.end)

  const handleSelect = (preset: DatePreset) => {
    const r = getRange(preset)
    onChange(preset, format(r.start, "yyyy-MM-dd"), format(r.end, "yyyy-MM-dd"))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-border rounded-[12px] text-sm font-semibold text-body hover:bg-gray-50 transition-colors shadow-sm">
          <CalendarDays size={16} className="text-muted" />
          {display}
          <ChevronDown size={14} className="text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {presetOptions.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => handleSelect(opt.value)}
            className={value === opt.value ? "bg-gray-100 font-semibold" : ""}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
