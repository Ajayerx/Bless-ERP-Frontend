/**
 * ERPNext Sales Order status indicator — a faithful port of the client-side
 * derivation that powers the desk list status column and the form-header badge.
 *
 * ERPNext never stores "Overdue": frappe/model/indicator.js short-circuits
 * draft (docstatus 0) and cancelled (docstatus 2) docs, then runs the doctype's
 * listview get_indicator (selling/doctype/sales_order/sales_order_list.js) for
 * submitted docs, falling back to "Submitted" (blue) when nothing matches and
 * to "Draft" / "Cancelled" (red) for the docstatus short-circuits.
 */

export type SalesOrderIndicatorLabel =
  | "Draft"
  | "Cancelled"
  | "Submitted"
  | "On Hold"
  | "Closed"
  | "Completed"
  | "Overdue"
  | "To Deliver"
  | "To Deliver and Bill"
  | "To Bill"

export type SalesOrderIndicatorVariant = "success" | "warning" | "danger" | "info"

/** ERPNext filter tuple fields (doctype is prepended by the caller). Each
 * array is an AND group, mirroring the `|`-separated `data-filter` strings. */
export type IndicatorFilter = [field: string, operator: string, value: unknown]

export interface SalesOrderIndicatorInput {
  docstatus?: number
  status?: string | null
  skip_delivery_note?: boolean | number | null
  per_delivered?: number | null
  per_billed?: number | null
  grand_total?: number | null
  delivery_date?: string | null
}

export interface SalesOrderIndicator {
  label: SalesOrderIndicatorLabel
  variant: SalesOrderIndicatorVariant
  /** And-group filter the doc's own indicator applies when clicked. */
  filterArgs: IndicatorFilter[]
}

/** Local-date "YYYY-MM-DD" (frappe `today()`), matching ERPNext's server date. */
function localTodayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Day-precision string for a date value; null when it cannot be parsed.
 * ISO day strings are used verbatim so day-diff comparisons stay timezone-free
 * (frappe `get_diff` compares calendar days, never clock time). */
function toIsoDay(value: string | null | undefined): string | null {
  if (!value) return null
  const text = String(value).trim()
  if (ISO_DAY.test(text)) return text
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, "0")
  const d = String(parsed.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const flt = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0)

/** Canonical per-label filter the quick pills / status chips apply (the
 * per-doc variant from `getSalesOrderIndicator` stays exact when it differs,
 * e.g. the zero-grand_total "To Deliver" tuple). */
export const INDICATOR_FILTER_TUPLES: Record<SalesOrderIndicatorLabel, IndicatorFilter[]> = {
  Draft: [["docstatus", "=", 0]],
  Cancelled: [["docstatus", "=", 2]],
  Submitted: [["docstatus", "=", 1]],
  "On Hold": [["status", "=", "On Hold"]],
  Closed: [["status", "=", "Closed"]],
  Completed: [["status", "=", "Completed"]],
  Overdue: [
    ["per_delivered", "<", 100],
    ["delivery_date", "<", "Today"],
    ["status", "!=", "Closed"],
    ["docstatus", "=", 1],
  ],
  "To Deliver": [
    ["per_delivered", "<", 100],
    ["per_billed", "=", 100],
    ["status", "!=", "Closed"],
  ],
  "To Deliver and Bill": [
    ["per_delivered", "<", 100],
    ["per_billed", "<", 100],
    ["status", "!=", "Closed"],
  ],
  "To Bill": [
    ["per_delivered", "=", 100],
    ["per_billed", "<", 100],
    ["status", "!=", "Closed"],
  ],
}

/** Pill order surfaced on the list page (status column quick filters). */
export const SALES_ORDER_INDICATOR_LABELS: SalesOrderIndicatorLabel[] = [
  "Draft",
  "Overdue",
  "On Hold",
  "To Deliver and Bill",
  "To Deliver",
  "To Bill",
  "Completed",
  "Cancelled",
  "Closed",
]

const cap = (
  label: SalesOrderIndicatorLabel,
  variant: SalesOrderIndicatorVariant,
  filterArgs: IndicatorFilter[],
): SalesOrderIndicator => ({ label, variant, filterArgs })

/**
 * Derives the ERPNext status indicator for a Sales Order row/doc.
 *
 * Order of evaluation (identical to frappe `get_indicator` + the Sales Order
 * doctype `get_indicator`): docstatus short-circuits first (Draft/Cancelled),
 * then named statuses, then fulfillment/billing progress. Returns the "Submitted"
 * fallback for submitted docs nothing else matches.
 */
export function getSalesOrderIndicator(input: SalesOrderIndicatorInput): SalesOrderIndicator {
  const docstatus = Number(input.docstatus) || 0
  const status = String(input.status ?? "")
  const skipDeliveryNote = !!Number(input.skip_delivery_note)
  const perDelivered = flt(input.per_delivered)
  const perBilled = flt(input.per_billed)
  const grandTotal = flt(input.grand_total)

  if (docstatus === 0) return cap("Draft", "danger", INDICATOR_FILTER_TUPLES.Draft)
  if (docstatus === 2) return cap("Cancelled", "danger", INDICATOR_FILTER_TUPLES.Cancelled)

  if (status === "Closed") return cap("Closed", "success", INDICATOR_FILTER_TUPLES.Closed)
  if (status === "On Hold") return cap("On Hold", "warning", INDICATOR_FILTER_TUPLES["On Hold"])
  if (status === "Completed") return cap("Completed", "success", INDICATOR_FILTER_TUPLES.Completed)

  if (!skipDeliveryNote && perDelivered < 100) {
    const deliveryDay = toIsoDay(input.delivery_date)
    if (deliveryDay !== null && deliveryDay < localTodayIso()) {
      return cap("Overdue", "danger", INDICATOR_FILTER_TUPLES.Overdue)
    }
    if (grandTotal === 0) {
      return cap("To Deliver", "warning", [
        ["per_delivered", "<", 100],
        ["grand_total", "=", 0],
        ["status", "!=", "Closed"],
        ["docstatus", "=", 1],
      ])
    }
    if (perBilled < 100) return cap("To Deliver and Bill", "warning", INDICATOR_FILTER_TUPLES["To Deliver and Bill"])
    return cap("To Deliver", "warning", INDICATOR_FILTER_TUPLES["To Deliver"])
  }

  if (perDelivered === 100 && grandTotal !== 0 && perBilled < 100) {
    return cap("To Bill", "warning", INDICATOR_FILTER_TUPLES["To Bill"])
  }

  if (skipDeliveryNote && perBilled < 100) {
    return cap("To Bill", "warning", [
      ["per_billed", "<", 100],
      ["status", "!=", "Closed"],
    ])
  }

  return cap("Submitted", "info", INDICATOR_FILTER_TUPLES.Submitted)
}