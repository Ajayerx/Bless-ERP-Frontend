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

export type DatePreset = "today" | "this_week" | "this_month" | "this_quarter" | "this_year"

export function getRange(preset: DatePreset): { start: Date; end: Date } {
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

export function presetRange(preset: DatePreset): { startDate: string; endDate: string } {
  const r = getRange(preset)
  return { startDate: format(r.start, "yyyy-MM-dd"), endDate: format(r.end, "yyyy-MM-dd") }
}
