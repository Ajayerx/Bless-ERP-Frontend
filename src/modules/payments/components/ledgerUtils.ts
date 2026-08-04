import type { LedgerPreviewData } from "../types"

export interface NormalizedColumn {
  key: string
  label: string
}

export function normalizeLedger(ledger: LedgerPreviewData | null): { columns: NormalizedColumn[]; rows: unknown[][] } {
  const cols = ledger?.gl_columns ?? []
  const data = ledger?.gl_data ?? []
  if (cols.length > 0 && data.length > 0 && Array.isArray(data[0])) {
    return {
      columns: cols.map((c, i) => ({
        key: c.fieldname ?? String(i),
        label: c.name ?? c.label ?? "",
      })),
      rows: data as unknown[][],
    }
  }
  const dictRows = data as unknown as Array<Record<string, unknown>>
  return {
    columns: cols.map((c, i) => ({
      key: c.fieldname ?? String(i),
      label: c.label ?? c.name ?? "",
    })),
    rows: dictRows.map((row) => cols.map((c) => row[c.fieldname ?? ""])),
  }
}
