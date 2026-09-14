import { useState } from "react"
import { Filter, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, Popover, PopoverTrigger, PopoverContent } from "@/components/ui"
import FilterRow from "./FilterRow"
import type { RFilter, FilterFieldDef } from "@/services/filter-types"

interface FilterGroupProps {
  filters: RFilter[]
  onFiltersChange: (filters: RFilter[]) => void
  availableFields: FilterFieldDef[]
  className?: string
}

export default function FilterGroup({
  filters,
  onFiltersChange,
  availableFields,
  className,
}: FilterGroupProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<RFilter[]>([])

  const activeCount = filters.length

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(filters.map((f) => ({ ...f })))
    }
    setOpen(next)
  }

  const updateDraft = (index: number, updated: RFilter) => {
    setDraft((prev) => prev.map((f, i) => (i === index ? updated : f)))
  }

  const removeDraft = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index))
  }

  const addFilter = () => {
    const firstField = availableFields[0]
    if (!firstField) return
    setDraft((prev) => [
      ...prev,
      {
        field: firstField.field,
        label: firstField.label,
        operator: "=",
        value: "",
      },
    ])
  }

  const applyFilters = () => {
    const cleaned = draft.filter((f) => f.value || f.operator === "is" || f.operator === "not set")
    onFiltersChange(cleaned)
    setOpen(false)
  }

  const clearAll = () => {
    setDraft([])
    onFiltersChange([])
    setOpen(false)
  }

  const activeDraftCount = draft.filter(
    (f) => f.value || f.operator === "is" || f.operator === "not set"
  ).length

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div className={cn("flex items-center gap-1", className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Advanced Filter"
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors",
              activeCount > 0
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-muted hover:bg-gray-100 hover:text-body"
            )}
            title={activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? "s" : ""} applied` : "Advanced filters"}
          >
            <Filter size={14} />
            <span className="hidden sm:inline">Filter</span>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary-600 text-primary-50 text-[10px] leading-none">
                {activeCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        {activeCount > 0 && (
          <button
            type="button"
            aria-label="Clear all filters"
            onClick={clearAll}
            className="inline-flex items-center h-8 w-8 justify-center rounded-lg text-muted hover:text-danger-600 hover:bg-danger-50 transition-colors"
            title="Clear all filters"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[420px] max-h-[480px] overflow-auto p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-3 space-y-3">
          {draft.length === 0 ? (
            <p className="text-xs text-muted text-center py-2">
              No filters selected
            </p>
          ) : (
            <div className="space-y-2">
              {draft.map((f, i) => (
                <FilterRow
                  key={`${f.field}-${i}`}
                  filter={f}
                  availableFields={availableFields}
                  onChange={(updated) => updateDraft(i, updated)}
                  onRemove={() => removeDraft(i)}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addFilter}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 transition-colors"
          >
            <Plus size={12} />
            Add a Filter
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-border bg-gray-50/50">
          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear Filters
          </Button>
          <Button size="sm" onClick={applyFilters} disabled={activeDraftCount === 0 && draft.length === 0}>
            Apply{activeDraftCount > 0 ? ` (${activeDraftCount})` : ""}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
