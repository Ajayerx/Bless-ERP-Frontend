import { INDICATOR_FILTER_TUPLES } from "@/modules/sales-orders/services"

// ── Filter model (ERPNext-style field/operator/value chips) ────────────
export type FilterOperator =
  | "="
  | "!="
  | "like"
  | "not like"
  | ">"
  | "<"
  | ">="
  | "<="
  | "between"
  | "is"
  | "not set"

export interface RFilter {
  field: string
  label: string
  operator: FilterOperator
  value: string
  value2?: string
}

export type FilterFieldType = "text" | "select" | "date" | "link" | "number"

export interface FilterFieldDef {
  field: string
  label: string
  type: FilterFieldType
  options?: readonly string[]
  searchLink?: (query: string) => Promise<{
    items: Array<{ value: string; label: string; description: string }>
  }>
}

/** Map a chip to the raw frappe filter tuples ERPNext would send to the server,
 * in the list-view wire format `[doctype, field, operator, value]`. A
 * `status = <indicator label>` chip expands to the doctype indicator's full
 * AND-tuple (e.g. Overdue → `per_delivered,<,100 | delivery_date,<,Today |
 * status,!=,Closed | docstatus,=,1`), exactly like ERPNext's `data-filter`. */
export function rFilterToArgs(r: RFilter, doctype: string): unknown[][] {
  const { field, operator, value } = r
  if (field === "status" && operator === "=") {
    const tuple = INDICATOR_FILTER_TUPLES[value as keyof typeof INDICATOR_FILTER_TUPLES]
    if (tuple) return tuple.map((t) => [doctype, ...t])
  }
  switch (operator) {
    case "like":
      return [[doctype, field, "like", `%${value}%`]]
    case "not like":
      return [[doctype, field, "not like", `%${value}%`]]
    case "between":
      return [
        ...(value ? [[doctype, field, ">=", value]] : []),
        ...(r.value2 ? [[doctype, field, "<=", r.value2]] : []),
      ]
    case "is":
      return [[doctype, field, "is", "set"]]
    case "not set":
      return [[doctype, field, "is", "not set"]]
    default:
      return [[doctype, field, operator, value]]
  }
}

/** Operators available for a given field type. */
export function operatorsForType(type: FilterFieldType): FilterOperator[] {
  switch (type) {
    case "text":
      return ["=", "!=", "like", "not like", "is", "not set"]
    case "select":
      return ["=", "!="]
    case "date":
      return ["=", "!=", ">", "<", ">=", "<=", "between", "is", "not set"]
    case "link":
      return ["=", "!=", "is", "not set"]
    case "number":
      return ["=", "!=", ">", "<", ">=", "<=", "between", "is", "not set"]
  }
}

/** Check if the operator needs a value input. */
export function operatorNeedsValue(op: FilterOperator): boolean {
  return op !== "is" && op !== "not set"
}

/** Check if the operator needs a second value (for "between"). */
export function operatorNeedsValue2(op: FilterOperator): boolean {
  return op === "between"
}
