"use client"

import { ArrowDown, ArrowUp } from "lucide-react"
import { FilterGroup, LinkSearchField } from "@/components/ui"
import { cn } from "@/lib/utils"
import type { RFilter, FilterOperator, FilterFieldDef } from "@/services/filter-types"

const DOCTYPE = "Bank Account"

export function rFilterToArgs(r: RFilter): unknown[][] {
  const { field, operator, value } = r
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

const INLINE_FIELDS: FilterFieldDef[] = [
  { field: "account_name", label: "Account Name", type: "text" },
  { field: "bank", label: "Bank", type: "link" },
  { field: "company", label: "Company", type: "link" },
  {
    field: "account_type",
    label: "Type",
    type: "select",
    options: ["Chequing", "Savings", "Credit Card", "Loan", "Investment"],
  },
  { field: "party_type", label: "Party Type", type: "text" },
]

export const BANK_ACCOUNT_ADVANCED_FILTER_FIELDS: FilterFieldDef[] = [
  ...INLINE_FIELDS,
  { field: "party", label: "Party", type: "link" },
  { field: "account", label: "Company Account", type: "link" },
  { field: "account_subtype", label: "Subtype", type: "text" },
  { field: "iban", label: "IBAN", type: "text" },
  { field: "bank_account_no", label: "Bank Account No.", type: "text" },
  { field: "branch_code", label: "Branch Code", type: "text" },
  { field: "is_company_account", label: "Company Account", type: "select", options: ["1", "0"] },
  { field: "is_default", label: "Default", type: "select", options: ["1", "0"] },
  { field: "disabled", label: "Disabled", type: "select", options: ["1", "0"] },
]

export const BANK_ACCOUNT_SORT_OPTIONS = [
  { value: "account_name", label: "Account Name" },
  { value: "name", label: "ID" },
  { value: "bank", label: "Bank" },
  { value: "company", label: "Company" },
  { value: "account_type", label: "Type" },
  { value: "party", label: "Party" },
  { value: "creation", label: "Created On" },
  { value: "modified", label: "Last Updated" },
]

export interface BankAccountSort {
  field: string
  order: "asc" | "desc"
  onChange: (field: string, order: "asc" | "desc") => void
}

type LinkLookup = (query: string) => Promise<{
  items: Array<{ value: string; label: string; description: string }>
}>

interface BankAccountFiltersProps {
  filters: RFilter[]
  onFiltersChange: (filters: RFilter[]) => void
  bankSearch?: LinkLookup
  companySearch?: LinkLookup
  partySearch?: LinkLookup
  sort?: BankAccountSort
  className?: string
}

export default function BankAccountFilters({
  filters,
  onFiltersChange,
  bankSearch,
  companySearch,
  partySearch,
  sort,
  className,
}: BankAccountFiltersProps) {
  const filterFor = (field: string): RFilter | undefined =>
    filters.find((f) => f.field === field)

  const setFieldFilter = (
    field: string,
    def: FilterFieldDef,
    next?: { operator: FilterOperator; value?: string; value2?: string },
  ) => {
    if (!next?.value && !next?.value2) {
      onFiltersChange(filters.filter((f) => f.field !== field))
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
    if (field === "bank") return bankSearch
    if (field === "company") return companySearch
    if (field === "party") return partySearch
    return undefined
  }

  return (
    <div className={cn("rounded-[14px] border border-border bg-surface p-4 space-y-3", className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          Filters
          {activeCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 text-[10px]">
              {activeCount}
            </span>
          )}
        </p>

        <div className="flex items-center gap-3">
          <FilterGroup
            filters={filters}
            onFiltersChange={onFiltersChange}
            availableFields={BANK_ACCOUNT_ADVANCED_FILTER_FIELDS}
          />

          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-body hover:bg-gray-100 rounded-[8px] transition-colors"
            >
              Clear all
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
                {BANK_ACCOUNT_SORT_OPTIONS.map((o) => (
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
          if (def.type === "select") {
            return (
              <div key={def.field} className="min-w-0" title={def.field}>
                <select
                  aria-label={def.label}
                  value={current?.value ?? ""}
                  onChange={(e) =>
                    setFieldFilter(def.field, def, e.target.value ? { operator: "=", value: e.target.value } : undefined)
                  }
                  className={cn(inputCls, current?.value ? "text-body" : "text-muted")}
                >
                  <option value="">{def.label}</option>
                  {(def.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
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