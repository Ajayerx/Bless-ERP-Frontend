"use client"

import { useState, useMemo } from "react"
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  addMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  subDays,
} from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverTrigger, PopoverContent } from "./popover"
import { Button } from "./button"

export interface DateRangeValue {
  from?: string
  to?: string
}

interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  className?: string
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function toIso(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function parseDay(iso?: string): Date | null {
  if (!iso) return null
  const d = parseISO(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatRangeLabel(value: DateRangeValue): string {
  if (!value.from) return "Date range"
  const from = parseDay(value.from)
  if (!from) return "Date range"
  if (!value.to || value.from === value.to) return format(from, "MMM d, yyyy")
  const to = parseDay(value.to)
  if (!to) return format(from, "MMM d, yyyy")
  const sameYear = from.getFullYear() === to.getFullYear()
  return sameYear
    ? `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`
    : `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`
}

export default function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseDay(value.from) ?? new Date()))
  const [draft, setDraft] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const from = parseDay(value.from)
  const to = parseDay(value.to)

  // The currently shown range. A draft selection takes precedence over the
  // committed range while a new pick is in progress, so the stale highlight
  // doesn't linger when the user starts replacing the old range.
  let rangeStartIso: string | null = null
  let rangeEndIso: string | null = null
  let rangeActive = false
  if (draft && hovered) {
    rangeStartIso = draft <= hovered ? draft : hovered
    rangeEndIso = draft <= hovered ? hovered : draft
    rangeActive = true
  } else if (draft) {
    rangeStartIso = draft
    rangeEndIso = draft
    rangeActive = false
  } else if (from && to) {
    rangeStartIso = value.from ?? null
    rangeEndIso = value.to ?? null
    rangeActive = true
  }
  const range = { startIso: rangeStartIso, endIso: rangeEndIso, active: rangeActive }

  const monthGrid = useMemo(() => {
    const start = startOfWeek(viewMonth)
    const end = endOfWeek(endOfMonth(viewMonth))
    return eachDayOfInterval({ start, end })
  }, [viewMonth])

  const handleDayClick = (iso: string) => {
    if (draft) {
      if (iso < draft) {
        setDraft(iso)
        setHovered(null)
        return
      }
      onChange({ from: draft, to: iso })
      setViewMonth(startOfMonth(parseISO(draft)))
      setDraft(null)
      setHovered(null)
      return
    }
    if (value.from && value.to) {
      setDraft(iso)
      setHovered(null)
      return
    }
    setDraft(iso)
    setHovered(null)
  }

  const handlePreset = (range: DateRangeValue) => {
    onChange(range)
    if (range.from) setViewMonth(startOfMonth(parseISO(range.from)))
    setDraft(null)
    setHovered(null)
  }

  const handleClear = () => {
    onChange({})
    setDraft(null)
    setHovered(null)
  }

  const today = new Date()

  const filling = !!draft
  const statusText = (() => {
    if (draft && hovered) {
      const [a, b] = draft <= hovered ? [draft, hovered] : [hovered, draft]
      return `From ${format(parseISO(a), "MMM d")} to ${format(parseISO(b), "MMM d, yyyy")}`
    }
    if (draft) return `Start: ${format(parseISO(draft), "MMM d, yyyy")} — now pick the end date`
    if (value.from) {
      const f = parseISO(value.from)
      const t = value.to ? parseISO(value.to) : null
      return t
        ? `From ${format(f, "MMM d")} to ${format(t, "MMM d, yyyy")}`
        : `From ${format(f, "MMM d, yyyy")}`
    }
    return "Pick the start date"
  })()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400",
            "inline-flex items-center gap-2 whitespace-nowrap",
            value.from ? "text-body" : "text-muted",
            className
          )}
        >
          <CalendarDays size={14} className="text-muted" />
          <span>{formatRangeLabel(value)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto p-0 overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewMonth((m) => addMonths(m, -1))}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm font-semibold text-heading">
              {format(viewMonth, "MMMM yyyy")}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewMonth((m) => addMonths(m, 1))}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        <div className={cn("px-4 pt-3 text-xs font-medium", filling ? "text-primary-600" : "text-muted")}>
          {statusText}
        </div>

        <div className="flex gap-6 justify-center p-4">
          <div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAY_LABELS.map((l) => (
                <div key={l} className="h-7 flex items-center justify-center text-[11px] font-semibold text-muted">
                  {l}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {monthGrid.map((d) => {
                const iso = toIso(d)
                const inRange = range.active && iso >= range.startIso! && iso <= range.endIso!
                const isEndpoint = range.active && (iso === range.startIso || iso === range.endIso)
                const outside = !isSameMonth(d, viewMonth)
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => handleDayClick(iso)}
                    onMouseEnter={() => setHovered(iso)}
                    onMouseLeave={() => setHovered(null)}
                    className={cn(
                      "h-8 w-8 rounded-full text-sm flex items-center justify-center transition-colors",
                      outside && "text-muted/40",
                      inRange && !isEndpoint && "bg-primary-50 text-primary-700",
                      isEndpoint && "bg-primary-600 text-white font-semibold shadow-sm",
                      !isEndpoint && !inRange && "hover:bg-primary-100/70",
                      isToday(d) && !isEndpoint && "ring-1 ring-primary-300",
                      outside && !isEndpoint && "hover:bg-gray-50"
                    )}
                  >
                    {format(d, "d")}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pb-4 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handlePreset(rangeForThisMonth(today))}>
              This month
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handlePreset({ from: toIso(subDays(today, 29)), to: toIso(today) })}>
              Last 30 days
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handlePreset({ from: toIso(today), to: toIso(today) })}>
              Today
            </Button>
          </div>
          {value.from && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-danger-600 hover:text-danger-700" onClick={handleClear}>
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function rangeForThisMonth(today: Date): DateRangeValue {
  const month = startOfMonth(today)
  return { from: toIso(month), to: toIso(endOfMonth(month)) }
}