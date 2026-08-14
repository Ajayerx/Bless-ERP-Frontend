"use client"

import * as React from "react"
import { Search, ArrowUp, ArrowDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import DateRangePicker, { type DateRangeValue } from "./DateRangePicker"

export interface SelectOption {
  value: string
  label: string
}

export interface SortControl {
  field: string
  order: "asc" | "desc"
  onSort: (field: string, order: "asc" | "desc") => void
  options: { value: string; label: string }[]
}

export interface ActiveChip {
  key: string
  label: string
  onClear: () => void
  icon?: React.ReactNode
}

export interface FilterBarControls {
  /** General text search (server-side `or_filters`). */
  search?: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    width?: string
  }
  /** Dropdown-style selects. */
  selects?: {
    value: string
    onChange: (v: string) => void
    options: SelectOption[]
    placeholder: string
  }[]
  /** Single date-range picker. */
  dateRange?: {
    from: string
    to: string
    onChange: (from: string, to: string) => void
  }
  /** Single sort control: field dropdown + asc/desc toggle. */
  sort?: SortControl
  /** Arbitrary page-specific controls (status tabs, extra dropdowns...). */
  extra?: React.ReactNode
  /** Active-filter chips shown before the "Clear filters" button. */
  chips?: ActiveChip[]
}

interface ListFilterBarProps {
  controls: FilterBarControls
  hasActiveFilters?: boolean
  onReset?: () => void
  className?: string
}

const inputCls =
  "h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"

export default function ListFilterBar({
  controls,
  hasActiveFilters = false,
  onReset,
  className,
}: ListFilterBarProps) {
  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      {controls.selects?.map((sel, i) => (
        <select
          key={i}
          value={sel.value}
          onChange={(e) => sel.onChange(e.target.value)}
          className={cn(inputCls, "cursor-pointer")}
        >
          <option value="">{sel.placeholder}</option>
          {sel.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}

      {controls.search && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={controls.search.value}
            onChange={(e) => controls.search!.onChange(e.target.value)}
            placeholder={controls.search.placeholder ?? "Search..."}
            className={cn(inputCls, "pl-8", controls.search.width)}
          />
        </div>
      )}

      {controls.dateRange && (
        <DateRangePicker
          value={{
            from: controls.dateRange.from || undefined,
            to: controls.dateRange.to || undefined,
          }}
          onChange={(range: DateRangeValue) =>
            controls.dateRange!.onChange(range.from ?? "", range.to ?? "")
          }
          className="w-52"
        />
      )}

      {controls.sort && (
        <div className="h-9 flex items-center rounded-[10px] border border-border bg-surface text-body focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 transition-colors overflow-hidden">
          <span className="pl-3 pr-1 text-xs font-semibold text-muted uppercase tracking-wider">
            Sort
          </span>
          <select
            value={controls.sort.field}
            onChange={(e) => controls.sort!.onSort(e.target.value, controls.sort!.order)}
            className="h-full bg-transparent text-sm focus:outline-none text-body cursor-pointer"
            title="Sort field"
          >
            {controls.sort.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              controls.sort!.onSort(
                controls.sort!.field,
                controls.sort!.order === "asc" ? "desc" : "asc"
              )
            }
            className="h-full px-2.5 flex items-center justify-center text-muted hover:text-primary-700 hover:bg-gray-100 transition-colors"
            title={(controls.sort.order ?? "desc") === "asc" ? "Sort ascending — click for descending" : "Sort descending — click for ascending"}
            aria-label={`Sort ${controls.sort.field} ${controls.sort.order}`}
          >
            {(controls.sort.order ?? "desc") === "asc" ? (
              <ArrowUp size={14} />
            ) : (
              <ArrowDown size={14} />
            )}
          </button>
        </div>
      )}

      {controls.extra}

      {controls.chips?.map((chip) => (
        <button
          key={chip.key}
          onClick={chip.onClear}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-[8px] hover:bg-primary-100 transition-colors"
        >
          {chip.icon}
          {chip.label}
          <X size={12} />
        </button>
      ))}

      {hasActiveFilters && onReset && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted hover:text-body hover:bg-gray-100 rounded-[8px] transition-colors"
        >
          <X size={12} /> Clear filters
        </button>
      )}
    </div>
  )
}
