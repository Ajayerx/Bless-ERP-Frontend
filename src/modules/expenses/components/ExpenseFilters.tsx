"use client"

import { ArrowDown, ArrowUp, Filter, X } from "lucide-react"
import { FilterGroup, LinkSearchField } from "@/components/ui"
import { cn } from "@/lib/utils"
import type { RFilter, FilterOperator, FilterFieldDef } from "@/services/filter-types"

const DOCTYPE = "Journal Entry"

/** Re-export rFilterToArgs with the Journal Entry doctype baked in.
 * `status = <label>` chips are not expanded here — the status pills map through
 * the service's `status` param onto the JE docstatus tuple, so the pill is
 * reflected in the shared filter chips only for the URL/FilterGroup. Range
 * chips (posting_date_from/to) expand to `>=` / `<=` on the parent field, and
 * child-table fields (account/party) keep the field name so the service can
 * translate them to the `accounts.xxx` form. */
export function rFilterToArgs(r: RFilter): unknown[][] {
  const { field, operator, value } = r
  if (field === "posting_date_from") return value ? [[DOCTYPE, "posting_date", ">=", value]] : []
  if (field === "posting_date_to") return value ? [[DOCTYPE, "posting_date", "<=", value]] : []
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

// ERPNext Journal Entry list standard filters, plus the range date fields.
const INLINE_FIELDS: FilterFieldDef[] = [
  { field: "name", label: "ID", type: "text" },
  { field: "title", label: "Title", type: "text" },
  { field: "company", label: "Company", type: "link" },
  { field: "posting_date_from", label: "Posting Date From", type: "date" },
  { field: "posting_date_to", label: "Posting Date To", type: "date" },
]

/** Fields available in the advanced filter popover (any filterable field). */
export const EXPENSE_ADVANCED_FILTER_FIELDS: FilterFieldDef[] = [
  ...INLINE_FIELDS,
  { field: "account", label: "Expense Account", type: "link" },
  { field: "party", label: "Party", type: "text" },
  {
    field: "party_type",
    label: "Party Type",
    type: "select",
    options: ["Supplier", "Customer", "Employee"],
  },
  { field: "voucher_type", label: "Voucher Type", type: "text" },
  { field: "bill_no", label: "Bill No", type: "text" },
  {
    field: "status",
    label: "Status",
    type: "select",
    options: ["Draft", "Submitted", "Cancelled"],
  },
  {
    field: "docstatus",
    label: "Docstatus",
    type: "select",
    options: ["0", "1", "2"],
  },
  { field: "total_debit", label: "Total Debit", type: "number" },
  { field: "total_credit", label: "Total Credit", type: "number" },
  { field: "owner", label: "Owner", type: "link" },
  { field: "creation", label: "Created On", type: "date" },
  { field: "modified", label: "Last Updated", type: "date" },
]

export const EXPENSE_SORT_OPTIONS = [
  { value: "posting_date", label: "Posting Date" },
  { value: "title", label: "Title" },
  { value: "company", label: "Company" },
  { value: "voucher_type", label: "Voucher Type" },
  { value: "total_debit", label: "Total Debit" },
  { value: "total_credit", label: "Total Credit" },
  { value: "name", label: "ID" },
  { value: "owner", label: "Owner" },
  { value: "creation", label: "Created On" },
  { value: "modified", label: "Last Updated" },
]

// ── Sort control ───────────────────────────────────────────────────────
export interface ExpenseSort {
  field: string
  order: "asc" | "desc"
  onChange: (field: string, order: "asc" | "desc") => void
}

type LinkLookup = (query: string) => Promise<{
  items: Array<{ value: string; label: string; description: string }>
}>

interface ExpenseFiltersProps {
  filters: RFilter[]
  onFiltersChange: (filters: RFilter[]) => void
  companySearch?: LinkLookup
  accountSearch?: LinkLookup
  sort?: ExpenseSort
  className?: string
}

// ── Always-visible inline filter bar (ERPNext list parity) ─────────────
export default function ExpenseFilters({
  filters,
  onFiltersChange,
  companySearch,
  accountSearch,
  sort,
  className,
}: ExpenseFiltersProps) {
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

  const linkSearchFor = (field: string): LinkLookup | undefined => {
    if (field === "company") return companySearch
    if (field === "account") return accountSearch
    return undefined
  }

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
            availableFields={EXPENSE_ADVANCED_FILTER_FIELDS}
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
                {EXPENSE_SORT_OPTIONS.map((o) => (
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
                  searchFn={linkSearchFor(def.field) ?? (() => Promise.resolve({ items: [] }))}
                  placeholder={def.label}
                  clearIconMode="hover"
                  suppressExternalLabelFetch
                  inputClassName="h-9 rounded-[10px] bg-surface"
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