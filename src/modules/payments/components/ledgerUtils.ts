import type { LedgerPreviewData } from "../types"

export interface NormalizedColumn {
  key: string
  label: string
  fieldtype?: string
  width?: number
}

export interface SortState {
  colIndex: number
  sortOrder: "none" | "asc" | "desc"
}

export function normalizeLedger(ledger: LedgerPreviewData | null): { columns: NormalizedColumn[]; rows: unknown[][] } {
  const cols = ledger?.gl_columns ?? []
  const data = ledger?.gl_data ?? []
  const columns = cols.map((c, i) => ({
    key: c.fieldname ?? String(i),
    label: c.name ?? c.label ?? "",
    fieldtype: c.fieldtype,
    width: c.width,
  }))
  if (cols.length > 0 && data.length > 0 && Array.isArray(data[0])) {
    return { columns, rows: (data as unknown[][]).map((row) => row.map((v) => v || "")) }
  }
  const dictRows = data as unknown as Array<Record<string, unknown>>
  return {
    columns,
    rows: dictRows.map((row) => cols.map((c) => row[c.fieldname ?? ""] || "")),
  }
}

function currencyFromLabel(label: string): string | null {
  const match = label.match(/\(([^()]+)\)\s*$/)
  return match ? match[1].trim() : null
}

export function getCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0)
    const symbol = parts.find((p) => p.type === "currency")?.value
    return symbol || currency
  } catch {
    return currency
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export interface FormatOptions {
  currency?: string
}

export function formatLedgerCell(col: NormalizedColumn, value: unknown, options?: FormatOptions): string {
  const isEmpty = value === "" || value === null || value === undefined || value === 0
  if (col.fieldtype === "Currency") {
    // ERPNext's datatable formats currency cells with format_currency, so an
    // empty debit/credit entry renders as "0.00" instead of a blank cell.
    const currency = currencyFromLabel(col.label) ?? options?.currency ?? "CAD"
    const symbol = getCurrencySymbol(currency)
    return `${symbol} ${formatNumber(isEmpty ? 0 : Number(value))}`
  }
  if (isEmpty) return ""
  return String(value)
}

type RowCell = { value: unknown; formatted: string }

function toRowCells(columns: NormalizedColumn[], row: unknown[], options?: FormatOptions): RowCell[] {
  return columns.map((col, i) => ({ value: row[i], formatted: formatLedgerCell(col, row[i], options) }))
}

const isNumeric = (val: unknown): boolean => !Number.isNaN(Number(val))

function guessFilter(keyword: string): { type: string; text: string | number | string[] } {
  if (keyword.length === 0) return { type: "", text: "" }

  let compareString = keyword
  if ([">", "<", "="].includes(compareString[0])) {
    compareString = keyword.slice(1)
  } else if (compareString.startsWith("!=")) {
    compareString = keyword.slice(2)
  }

  if (keyword.startsWith(">") && compareString) {
    return { type: "greaterThan", text: compareString.trim() }
  }
  if (keyword.startsWith("<") && compareString) {
    return { type: "lessThan", text: compareString.trim() }
  }
  if (keyword.startsWith("=") && isNumeric(compareString)) {
    return { type: "equals", text: Number(keyword.slice(1).trim()) }
  }
  if (isNumeric(compareString)) {
    return { type: "containsNumber", text: compareString }
  }
  if (keyword.startsWith("!=") && isNumeric(compareString)) {
    return { type: "notEquals", text: Number(keyword.slice(2).trim()) }
  }
  if (keyword.split(":").length === 2 && keyword.split(":").every((v) => isNumeric(v.trim()))) {
    return { type: "range", text: keyword.split(":").map((v) => v.trim()) }
  }
  return { type: "contains", text: compareString.toLowerCase() }
}

type LedgerFilter = { type: string; text: string | number | string[] }

function applyFilter(cell: RowCell, filter: LedgerFilter): boolean {
  const keyword = String(filter.text)
  const rawText = String(cell.value ?? "").toLowerCase()
  const formattedText = String(cell.formatted).toLowerCase()
  const numberValue = parseFloat(String(cell.value ?? ""))

  switch (filter.type) {
    case "contains": {
      const needle = keyword.toLowerCase()
      if (!needle) return true
      return rawText.includes(needle) || formattedText.includes(needle)
    }
    case "greaterThan": {
      const k = parseFloat(keyword)
      return !Number.isNaN(numberValue) && numberValue > k
    }
    case "lessThan": {
      const k = parseFloat(keyword)
      return !Number.isNaN(numberValue) && numberValue < k
    }
    case "equals": {
      return numberValue === Number(keyword)
    }
    case "notEquals": {
      return numberValue !== Number(keyword)
    }
    case "range": {
      const [min, max] = (filter.text as string[]).map(Number)
      return !Number.isNaN(numberValue) && numberValue >= min && numberValue <= max
    }
    case "containsNumber": {
      const number = parseFloat(keyword)
      const hayString = formattedText
      return number === numberValue || hayString.includes(keyword)
    }
    default:
      return true
  }
}

export function filterLedgerRows(
  columns: NormalizedColumn[],
  rows: unknown[][],
  filters: Record<string, string>,
  options?: FormatOptions
): unknown[][] {
  const active = Object.entries(filters).filter(([, q]) => (q ?? "").trim() !== "")
  if (active.length === 0) return rows
  const cellRows = rows.map((row) => toRowCells(columns, row, options))
  let kept = cellRows.map((_, i) => i)

  for (const [key, query] of active) {
    const idx = columns.findIndex((c) => c.key === key)
    if (idx === -1) continue
    const filter = guessFilter(query)
    kept = kept.filter((i) => applyFilter(cellRows[i][idx], filter))
  }

  return kept.map((i) => rows[i])
}

export function computeColumnAlign(columns: NormalizedColumn[], rows: unknown[][]): ("left" | "center" | "right")[] {
  const row0 = rows[0]
  return columns.map((_, i) => {
    const value = row0 ? row0[i] : undefined
    return value !== undefined && isNumeric(value) ? "right" : "left"
  })
}

export function sortLedgerRows(
  columns: NormalizedColumn[],
  rows: unknown[][],
  sort: SortState
): { rows: unknown[][]; viewOrder: number[] } {
  const colIndex = sort.colIndex
  const viewOrder = rows.map((_, i) => i)

  if (sort.sortOrder === "none") {
    return { rows, viewOrder }
  }

  viewOrder.sort((a, b) => {
    const aContent = columns[colIndex] ? rows[a][colIndex] : undefined
    const bContent = columns[colIndex] ? rows[b][colIndex] : undefined
    const ac = aContent == null ? "" : String(aContent)
    const bc = bContent == null ? "" : String(bContent)

    if (ac < bc) return sort.sortOrder === "asc" ? -1 : 1
    if (ac > bc) return sort.sortOrder === "asc" ? 1 : -1
    return 0
  })

  const sortedRows = viewOrder.map((i) => rows[i])
  return { rows: sortedRows, viewOrder }
}
