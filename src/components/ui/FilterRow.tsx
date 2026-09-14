import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { LinkSearchField } from "@/components/ui"
import type {
  RFilter,
  FilterFieldDef,
  FilterOperator,
} from "@/services/filter-types"
import {
  operatorsForType,
  operatorNeedsValue,
  operatorNeedsValue2,
} from "@/services/filter-types"

interface FilterRowProps {
  filter: RFilter
  availableFields: FilterFieldDef[]
  onChange: (updated: RFilter) => void
  onRemove: () => void
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  "=": "=",
  "!=": "!=",
  like: "contains",
  "not like": "not contains",
  ">": ">",
  "<": "<",
  ">=": ">=",
  "<=": "<=",
  between: "between",
  is: "is",
  "not set": "not set",
}

export default function FilterRow({
  filter,
  availableFields,
  onChange,
  onRemove,
}: FilterRowProps) {
  const fieldDef = availableFields.find((f) => f.field === filter.field)
  const fieldType = fieldDef?.type ?? "text"
  const conditions = operatorsForType(fieldType)
  const needsValue = operatorNeedsValue(filter.operator)
  const needsValue2 = operatorNeedsValue2(filter.operator)

  const [localValue, setLocalValue] = useState(filter.value)
  const [localValue2, setLocalValue2] = useState(filter.value2 ?? "")

  useEffect(() => {
    setLocalValue(filter.value)
    setLocalValue2(filter.value2 ?? "")
  }, [filter.value, filter.value2])

  const commitField = (fieldname: string) => {
    const def = availableFields.find((f) => f.field === fieldname)
    if (!def) return
    const ops = operatorsForType(def.type)
    onChange({
      ...filter,
      field: fieldname,
      label: def.label,
      operator: ops[0] ?? "=",
      value: "",
      value2: undefined,
    })
  }

  const commitOperator = (op: FilterOperator) => {
    onChange({
      ...filter,
      operator: op,
      value: op === "is" || op === "not set" ? "set" : filter.value,
      value2: undefined,
    })
  }

  const commitValue = (val: string) => {
    setLocalValue(val)
    onChange({ ...filter, value: val })
  }

  const commitValue2 = (val: string) => {
    setLocalValue2(val)
    onChange({ ...filter, value2: val })
  }

  const selectCls =
    "h-8 rounded-lg border border-border bg-surface px-2 text-xs text-body focus:outline-none focus:ring-1 focus:ring-primary-400"

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Filter field"
        value={filter.field}
        onChange={(e) => commitField(e.target.value)}
        className={cn(selectCls, "min-w-[120px]")}
      >
        {availableFields.map((f) => (
          <option key={f.field} value={f.field}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter condition"
        value={filter.operator}
        onChange={(e) => commitOperator(e.target.value as FilterOperator)}
        className={cn(selectCls, "min-w-[100px]")}
      >
        {conditions.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>

      {needsValue && (
        <>
          {fieldDef?.type === "link" && fieldDef.searchLink ? (
            <div className="flex-1 min-w-0">
              <LinkSearchField
                value={localValue || undefined}
                onChange={(v) => commitValue(v ?? "")}
                searchFn={fieldDef.searchLink}
                placeholder="Value"
                clearIconMode="hover"
                suppressExternalLabelFetch
                inputClassName="h-8 rounded-lg bg-surface text-xs"
              />
            </div>
          ) : fieldDef?.type === "select" && fieldDef.options ? (
            <select
              aria-label="Filter value"
              value={localValue}
              onChange={(e) => commitValue(e.target.value)}
              className={cn(selectCls, "flex-1 min-w-0")}
            >
              <option value="">Any</option>
              {fieldDef.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : fieldDef?.type === "date" ? (
            <input
              type="date"
              aria-label="Filter value"
              value={localValue}
              onChange={(e) => commitValue(e.target.value)}
              className={cn(selectCls, "flex-1 min-w-0")}
            />
          ) : (
            <input
              type="text"
              aria-label="Filter value"
              value={localValue}
              onChange={(e) => commitValue(e.target.value)}
              placeholder="Value"
              className={cn(selectCls, "flex-1 min-w-0")}
            />
          )}
        </>
      )}

      {needsValue2 && (
        <>
          <span className="text-xs text-muted shrink-0">and</span>
          <input
            type={fieldDef?.type === "date" ? "date" : "text"}
            aria-label="Filter value (upper bound)"
            value={localValue2}
            onChange={(e) => commitValue2(e.target.value)}
            placeholder="To"
            className={cn(selectCls, "flex-1 min-w-0")}
          />
        </>
      )}

      <button
        type="button"
        aria-label="Remove filter"
        onClick={onRemove}
        className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-muted hover:text-danger-600 hover:bg-danger-50 transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  )
}
