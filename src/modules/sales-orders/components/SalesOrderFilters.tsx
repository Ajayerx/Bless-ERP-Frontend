"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  format,
  parse,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  addMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from "date-fns"
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, X } from "lucide-react"
import { FilterGroup, LinkSearchField, Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "@/components/ui"
import { cn, formatDateDDMMYYYY } from "@/lib/utils"
import type { RFilter, FilterOperator, FilterFieldDef } from "@/services/filter-types"
import { rFilterToArgs as rFilterToArgsBase } from "@/services/filter-types"

const DOCTYPE = "Sales Order"

/** Re-export rFilterToArgs with Sales Order doctype baked in (backward compat). */
export function rFilterToArgs(r: RFilter): unknown[][] {
  return rFilterToArgsBase(r, DOCTYPE)
}

// Re-export shared types for backward compatibility.
export type { RFilter, FilterOperator, FilterFieldDef }

// ERPNext Sales Order list filters — always visible on the list page.
const INLINE_FIELDS: FilterFieldDef[] = [
  { field: "name", label: "ID", type: "text" },
  { field: "customer", label: "Customer", type: "link" },
  { field: "customer_name", label: "Customer Name", type: "text" },
  { field: "transaction_date", label: "Date", type: "date" },
  { field: "delivery_date", label: "Delivery Date", type: "date" },
  { field: "company", label: "Company", type: "link" },
  {
    field: "delivery_status",
    label: "Delivery Status",
    type: "select",
    options: ["Not Delivered", "Fully Delivered", "Partly Delivered", "Closed", "Not Applicable"],
  },
  {
    field: "billing_status",
    label: "Billing Status",
    type: "select",
    options: ["Not Billed", "Fully Billed", "Partly Billed", "Closed"],
  },
]

/** Fields available in the advanced filter popover (any filterable SO field). */
export const SO_ADVANCED_FILTER_FIELDS: FilterFieldDef[] = [
  ...INLINE_FIELDS,
  { field: "status", label: "Status", type: "select", options: ["Draft", "On Hold", "To Deliver and Bill", "To Deliver", "To Bill", "Completed", "Cancelled", "Closed"] },
  { field: "order_type", label: "Order Type", type: "select", options: ["Sales", "Maintenance", "Standard"] },
  { field: "grand_total", label: "Grand Total", type: "number" },
  { field: "per_delivered", label: "% Delivered", type: "number" },
  { field: "per_billed", label: "% Billed", type: "number" },
  { field: "owner", label: "Owner", type: "link" },
  { field: "creation", label: "Created On", type: "date" },
  { field: "modified", label: "Last Updated", type: "date" },
]

// ── Sort control ───────────────────────────────────────────────────────
export interface SalesOrderSort {
  field: string
  order: "asc" | "desc"
  onChange: (field: string, order: "asc" | "desc") => void
}

// ERPNext Sales Order list sort options, exactly as ERPNext v15 builds them
// (sort_selector.js): [modified, title_field, name, creation, idx] plus every
// mandatory/bold/in-list-view/reqd value field, in doctype field order.
export const SO_SORT_OPTIONS = [
  { value: "modified", label: "Last Updated On" },
  { value: "customer_name", label: "Customer Name" },
  { value: "name", label: "ID" },
  { value: "creation", label: "Created On" },
  { value: "idx", label: "Most Used" },
  { value: "naming_series", label: "Series" },
  { value: "customer", label: "Customer" },
  { value: "order_type", label: "Order Type" },
  { value: "company", label: "Company" },
  { value: "transaction_date", label: "Date" },
  { value: "delivery_date", label: "Delivery Date" },
  { value: "currency", label: "Currency" },
  { value: "conversion_rate", label: "Exchange Rate" },
  { value: "selling_price_list", label: "Price List" },
  { value: "price_list_currency", label: "Price List Currency" },
  { value: "plc_conversion_rate", label: "Price List Exchange Rate" },
  { value: "grand_total", label: "Grand Total" },
  { value: "rounded_total", label: "Rounded Total" },
  { value: "status", label: "Status" },
  { value: "per_delivered", label: "% Delivered" },
  { value: "per_billed", label: "% Amount Billed" },
]

type LinkLookup = (query: string) => Promise<{
  items: Array<{ value: string; label: string; description: string }>
}>

interface SalesOrderFiltersProps {
  filters: RFilter[]
  onFiltersChange: (filters: RFilter[]) => void
  customerSearch?: LinkLookup
  companySearch?: LinkLookup
  sort?: SalesOrderSort
  className?: string
}

// ERPNext date-control parity: the filter is a plain text input (no native
// `mm/dd/yyyy` placeholder) that accepts typed dates in ISO `yyyy-mm-dd` or the
// system format `dd-mm-yyyy`, plus an app-native calendar popover for picking.
// The committed wire value is always ISO.
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function parseDateText(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? parseISO(text) : null
  if (iso && isValid(iso)) return format(iso, "yyyy-MM-dd")
  const dmy = /^\d{2}-\d{2}-\d{4}$/.test(text) ? parse(text, "dd-MM-yyyy", new Date()) : null
  if (dmy && isValid(dmy)) return format(dmy, "yyyy-MM-dd")
  return null
}

function DatePill({
  ariaLabel,
  placeholder,
  value,
  onChange,
  title,
}: {
  ariaLabel: string
  placeholder: string
  value: string
  onChange: (iso: string | "") => void
  title: string
}) {
  const [text, setText] = useState(() => (value ? formatDateDDMMYYYY(value) : ""))
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value ? parseISO(value) : new Date()))
  const pillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setText(value ? formatDateDDMMYYYY(value) : "")
  }, [value])

  const monthGrid = useMemo(() => {
    const start = startOfWeek(viewMonth)
    const end = endOfWeek(endOfMonth(viewMonth))
    return eachDayOfInterval({ start, end })
  }, [viewMonth])

  const commit = (iso: string | "") => {
    onChange(iso)
    setText(iso ? formatDateDDMMYYYY(iso) : "")
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setText(raw)
    if (!raw.trim()) {
      commit("")
      return
    }
    const iso = parseDateText(raw)
    if (iso) commit(iso)
  }

  const handleBlur = () => {
    const raw = text.trim()
    if (raw && !parseDateText(raw)) {
      setText(value ? formatDateDDMMYYYY(value) : "")
    }
  }

  const today = new Date()
  const selected = value ? parseISO(value) : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={pillRef}
          title={title}
          className={cn(
            "h-9 flex items-center rounded-[10px] border border-border bg-surface transition-colors",
            "focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-400"
          )}
        >
          <input
            type="text"
            aria-label={ariaLabel}
            placeholder={placeholder}
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={() => setOpen(true)}
            className="min-w-0 flex-1 px-3 h-full bg-transparent text-sm text-body placeholder:text-muted focus:outline-none"
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Open calendar"
              className="h-full px-2 text-muted hover:text-heading flex items-center transition-colors"
            >
              <CalendarDays size={14} />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          const target = e.target
          if (target instanceof Node && pillRef.current?.contains(target)) e.preventDefault()
        }}
        className="w-auto p-0 overflow-hidden"
      >
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              aria-label="Previous month"
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-heading">{format(viewMonth, "MMMM yyyy")}</span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAY_LABELS.map((l) => (
              <div key={l} className="h-7 flex items-center justify-center text-[11px] font-semibold text-muted">
                {l}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthGrid.map((d) => {
              const iso = format(d, "yyyy-MM-dd")
              const outside = !isSameMonth(d, viewMonth)
              const isSelected = !!selected && format(selected, "yyyy-MM-dd") === iso
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    commit(iso)
                    setOpen(false)
                  }}
                  className={cn(
                    "h-8 w-8 rounded-full text-sm flex items-center justify-center transition-colors",
                    outside && "text-muted/40",
                    isSelected && "bg-primary-600 text-primary-50 font-semibold shadow-sm",
                    !isSelected && "hover:bg-primary-100/70",
                    isToday(d) && !isSelected && "ring-1 ring-primary-300",
                    outside && "hover:bg-gray-50"
                  )}
                >
                  {format(d, "d")}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <button
            type="button"
            onClick={() => {
              commit(format(today, "yyyy-MM-dd"))
              setOpen(false)
            }}
            className="h-7 px-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 rounded-md transition-colors"
          >
            Today
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                commit("")
                setOpen(false)
              }}
              className="h-7 px-2 text-xs font-semibold text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ERPNext-style select filter: a trigger button whose text reflects the chosen
// value, with a popover of clickable options (the active one checked).
function FilterDropdown({
  options,
  value,
  placeholder,
  ariaLabel,
  title,
  onChange,
}: {
  options: readonly string[]
  value: string
  placeholder: string
  ariaLabel: string
  title?: string
  onChange: (value: string | "") => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          title={title}
          className={cn(
            "h-9 w-full flex items-center justify-between gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400",
            value ? "text-body font-medium" : "text-muted"
          )}
        >
          <span className="min-w-0 truncate">{value || placeholder}</span>
          <span className="flex items-center gap-1 shrink-0">
            {value && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation()
                    onChange("")
                  }
                }}
                className="text-muted hover:text-heading cursor-pointer"
              >
                <X size={12} />
              </span>
            )}
            <ChevronDown size={14} className="text-muted" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-1 max-h-72 overflow-auto"
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => {
              onChange(o)
              setOpen(false)
            }}
            className={cn(
              "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors",
              o === value ? "bg-primary-50 text-primary-700 font-medium" : "text-body hover:bg-gray-100"
            )}
          >
            {o}
            {o === value && <Check size={14} />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// ── Always-visible inline filter bar (ERPNext list parity) ─────────────
export default function SalesOrderFilters({
  filters,
  onFiltersChange,
  customerSearch,
  companySearch,
  sort,
  className,
}: SalesOrderFiltersProps) {
  const filterFor = (field: string): RFilter | undefined =>
    filters.find((f) => f.field === field)

  const clearField = (field: string) => {
    onFiltersChange(filters.filter((f) => f.field !== field))
  }

  const setFieldFilter = (
    field: string,
    def: FilterFieldDef,
    next?: { operator: FilterOperator; value?: string; value2?: string },
  ) => {
    if (!next?.value && !next?.value2) {
      clearField(field)
      return
    }
    onFiltersChange([
      ...filters.filter((f) => f.field !== field),
      { field, label: def.label, operator: next.operator, value: next.value ?? "", value2: next.value2 },
    ])
  }

  const clearAll = () => onFiltersChange([])
  const activeCount = filters.length

  const inputCls =
    "w-full h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"

  return (
    <div className={cn("rounded-[14px] border border-border bg-surface p-4 space-y-3", className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
          <Filter size={12} /> Filters
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 text-[10px]">
              {activeCount}
            </span>
          )}
        </p>

        <div className="flex items-center gap-3">
          <FilterGroup
            filters={filters}
            onFiltersChange={onFiltersChange}
            availableFields={SO_ADVANCED_FILTER_FIELDS}
          />

          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-body hover:bg-gray-100 rounded-[8px] transition-colors"
            >
              <X size={12} /> Clear all
            </button>
          )}

          {sort && (
            <div className="h-8 flex items-center rounded-[10px] border border-border bg-surface text-body focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 transition-colors overflow-hidden">
              <span className="pl-3 pr-1 text-xs font-semibold text-muted uppercase tracking-wider">
                Sort
              </span>
              <select
                value={sort.field}
                onChange={(e) => sort.onChange(e.target.value, sort.order)}
                aria-label="Sort field"
                className="h-full bg-transparent text-sm focus:outline-none text-body cursor-pointer"
              >
                {SO_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  sort.onChange(sort.field, sort.order === "asc" ? "desc" : "asc")
                }
                aria-label={`Sort ${sort.field} ${sort.order}`}
                title={sort.order === "asc" ? "Sort ascending — click for descending" : "Sort descending — click for ascending"}
                className="h-full px-2.5 flex items-center justify-center text-muted hover:text-primary-700 hover:bg-gray-100 transition-colors"
              >
                {sort.order === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {INLINE_FIELDS.map((def) => {
          const current = filterFor(def.field)
          if (def.type === "link") {
            return (
              <div key={def.field} className="min-w-0" title={def.field}>
                <LinkSearchField
                  value={current?.value || undefined}
                  onChange={(v) =>
                    setFieldFilter(def.field, def, v ? { operator: "=", value: v } : undefined)
                  }
                  searchFn={
                    (def.field === "customer" ? customerSearch : companySearch) ??
                    (() => Promise.resolve({ items: [] }))
                  }
                  placeholder={def.label}
                  clearIconMode="hover"
                  suppressExternalLabelFetch
                  inputClassName="h-9 rounded-[10px] bg-surface"
                />
              </div>
            )
          }
          if (def.type === "select") {
            return (
              <div key={def.field} className="min-w-0">
                <FilterDropdown
                  options={def.options ?? []}
                  value={current?.value ?? ""}
                  placeholder={def.label}
                  ariaLabel={def.label}
                  title={def.field}
                  onChange={(v) =>
                    setFieldFilter(def.field, def, v ? { operator: "=", value: v } : undefined)
                  }
                />
              </div>
            )
          }
          if (def.type === "date") {
            return (
              <div key={def.field} className="min-w-0">
                <DatePill
                  ariaLabel={def.label}
                  placeholder={def.label}
                  title={def.field}
                  value={current?.value ?? ""}
                  onChange={(iso) =>
                    setFieldFilter(def.field, def, iso ? { operator: "=", value: iso } : undefined)
                  }
                />
              </div>
            )
          }
          return (
            <div key={def.field} className="min-w-0" title={def.field}>
              <input
                id={`sof-${def.field}`}
                type="text"
                aria-label={def.label}
                placeholder={def.label}
                value={current?.value ?? ""}
                onChange={(e) =>
                  setFieldFilter(def.field, def, { operator: "like", value: e.target.value })
                }
                className={inputCls}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}