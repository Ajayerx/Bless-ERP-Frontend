"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Check, ChevronDown, Filter, X } from "lucide-react"
import { FilterGroup, LinkSearchField, Popover, PopoverTrigger, PopoverContent } from "@/components/ui"
import { cn } from "@/lib/utils"
import type { RFilter, FilterOperator, FilterFieldDef } from "@/services/filter-types"

const DOCTYPE = "Customer"

/** Re-export rFilterToArgs with the Customer doctype baked in. Customer has no
 * user-visible `disabled`/`is_frozen` fields on the list — the row status pill
 * (Active/Disabled/Frozen) is derived from them — so a `status = <value>` chip
 * maps to the matching flag equality tuple (the wire format ERPNext's list
 * view sends for the status indicator). Non-status chips map to plain
 * equality/like tuples against the Customer doctype. */
export function rFilterToArgs(r: RFilter): unknown[][] {
  const { field, operator, value } = r
  if (field === "status" && operator === "=") {
    if (value === "Active") return [[DOCTYPE, "disabled", "=", 0]]
    if (value === "Disabled") return [[DOCTYPE, "disabled", "=", 1]]
    if (value === "Frozen") return [[DOCTYPE, "is_frozen", "=", 1]]
  }
  switch (operator) {
    case "like":
      return [[DOCTYPE, field, "like", `%${value}%`]]
    case "not like":
      return [[DOCTYPE, field, "not like", `%${value}%`]]
    case "between":
      return [
        ...(value ? [[DOCTYPE, field, ">=", value]] : []),
        ...(r.value2 ? [[DOCTYPE, field, "<=", r.value2]] : []),
      ]
    case "is":
      return [[DOCTYPE, field, "is", "set"]]
    case "not set":
      return [[DOCTYPE, field, "is", "not set"]]
    default:
      return [[DOCTYPE, field, operator, value]]
  }
}

export type { RFilter, FilterOperator, FilterFieldDef }

// ERPNext Customer list filters — always visible on the list page.
const INLINE_FIELDS: FilterFieldDef[] = [
  { field: "name", label: "ID", type: "text" },
  { field: "customer_name", label: "Name", type: "text" },
  {
    field: "customer_type",
    label: "Type",
    type: "select",
    options: ["Company", "Individual"],
  },
  { field: "customer_group", label: "Group", type: "link" },
  { field: "territory", label: "Territory", type: "link" },
  {
    field: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Disabled", "Frozen"],
  },
]

/** Fields available in the advanced filter popover (any filterable field). */
export const CUSTOMER_ADVANCED_FILTER_FIELDS: FilterFieldDef[] = [
  ...INLINE_FIELDS,
  { field: "email_id", label: "Email", type: "text" },
  { field: "mobile_no", label: "Phone", type: "text" },
  { field: "website", label: "Website", type: "text" },
  { field: "industry", label: "Industry", type: "text" },
  { field: "market_segment", label: "Segment", type: "text" },
  { field: "tax_id", label: "Tax ID", type: "text" },
  { field: "payment_terms", label: "Payment Terms", type: "text" },
  { field: "default_currency", label: "Currency", type: "text" },
  { field: "creation", label: "Created On", type: "date" },
  { field: "modified", label: "Last Updated", type: "date" },
]

export const CUSTOMER_SORT_OPTIONS = [
  { value: "customer_name", label: "Name" },
  { value: "name", label: "ID" },
  { value: "customer_type", label: "Type" },
  { value: "customer_group", label: "Group" },
  { value: "territory", label: "Territory" },
  { value: "market_segment", label: "Segment" },
  { value: "creation", label: "Created On" },
  { value: "modified", label: "Last Updated" },
]

// ── Sort control ───────────────────────────────────────────────────────
export interface CustomerSort {
  field: string
  order: "asc" | "desc"
  onChange: (field: string, order: "asc" | "desc") => void
}

type LinkLookup = (query: string) => Promise<{
  items: Array<{ value: string; label: string; description: string }>
}>

interface CustomerFiltersProps {
  filters: RFilter[]
  onFiltersChange: (filters: RFilter[]) => void
  groupSearch?: LinkLookup
  territorySearch?: LinkLookup
  sort?: CustomerSort
  className?: string
}

// ── ERPNext-style select filter (shared pattern) ───────────────────────
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
export default function CustomerFilters({
  filters,
  onFiltersChange,
  groupSearch,
  territorySearch,
  sort,
  className,
}: CustomerFiltersProps) {
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
            availableFields={CUSTOMER_ADVANCED_FILTER_FIELDS}
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
                {CUSTOMER_SORT_OPTIONS.map((o) => (
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                    (def.field === "customer_group" ? groupSearch : territorySearch) ??
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
              <div key={def.field} className="min-w-0" title={def.field}>
                <input
                  type="date"
                  aria-label={def.label}
                  value={current?.value ?? ""}
                  onChange={(e) =>
                    setFieldFilter(def.field, def, e.target.value ? { operator: "=", value: e.target.value } : undefined)
                  }
                  className={inputCls}
                />
              </div>
            )
          }
          return (
            <div key={def.field} className="min-w-0" title={def.field}>
              <input
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