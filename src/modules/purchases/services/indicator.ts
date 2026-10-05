/**
 * ERPNext Purchase Order status indicator — a faithful port of the client-side
 * derivation that powers the desk list status column and the form-header badge.
 *
 * ERPNext never stores "To Receive"/"To Bill" on saved drafts; the Purchase Order
 * doctype's `status` field is set when the document is submitted based on
 * `per_received` / `per_billed` progress, and `get_indicator` data-driven colors
 * these statuses. docstatus short-circuits draft/cancelled first.
 */

export type PurchaseOrderIndicatorLabel =
  | "Draft"
  | "Cancelled"
  | "Submitted"
  | "On Hold"
  | "Closed"
  | "Completed"
  | "To Receive"
  | "To Receive and Bill"
  | "To Bill"

export type PurchaseOrderIndicatorVariant = "success" | "warning" | "danger" | "info"

/** ERPNext filter tuple fields (doctype is prepended by the caller). Each
 * array is an AND group, mirroring the `|`-separated `data-filter` strings. */
export type PurchaseOrderFilter = [field: string, operator: string, value: unknown]

export interface PurchaseOrderIndicatorInput {
  docstatus?: number
  status?: string | null
  per_received?: number | null
  per_billed?: number | null
}

export interface PurchaseOrderIndicator {
  label: PurchaseOrderIndicatorLabel
  variant: PurchaseOrderIndicatorVariant
  /** And-group filter the doc's own indicator applies when clicked. */
  filterArgs: PurchaseOrderFilter[]
}

/** Grouped "To Receive" tab — catches both pending-bill and pending-receipt
 * orders (fixtures may carry either literal, depending on billing progress). */
const TO_RECEIVE_GROUP: PurchaseOrderFilter[] = [
  ["status", "in", ["To Receive", "To Receive and Bill"]],
]

/**
 * Canonical per-label filter the quick pills / status tabs apply. The per-doc
 * variant from `getPurchaseOrderIndicator` stays exact when it differs.
 */
export const PURCHASE_ORDER_FILTER_TUPLES: Record<PurchaseOrderIndicatorLabel, PurchaseOrderFilter[]> = {
  Draft: [["docstatus", "=", 0]],
  Cancelled: [["docstatus", "=", 2]],
  Submitted: [["docstatus", "=", 1]],
  "On Hold": [["status", "=", "On Hold"]],
  Closed: [["status", "=", "Closed"]],
  Completed: [["status", "=", "Completed"]],
  "To Receive": TO_RECEIVE_GROUP,
  "To Receive and Bill": [["status", "=", "To Receive and Bill"]],
  "To Bill": [["status", "=", "To Bill"]],
}

/** Tab order surfaced on the list page (status column quick filters). */
export const PURCHASE_ORDER_INDICATOR_LABELS: PurchaseOrderIndicatorLabel[] = [
  "Draft",
  "To Receive",
  "To Bill",
  "Completed",
  "On Hold",
  "Cancelled",
  "Closed",
]

const cap = (
  label: PurchaseOrderIndicatorLabel,
  variant: PurchaseOrderIndicatorVariant,
  filterArgs: PurchaseOrderFilter[],
): PurchaseOrderIndicator => ({ label, variant, filterArgs })

const flt = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0)

/**
 * Derives the ERPNext status indicator for a Purchase Order row/doc.
 *
 * Order of evaluation: docstatus short-circuits first (Draft/Cancelled), then
 * named statuses (On Hold / Closed / Completed), then receive/billing progress.
 */
export function getPurchaseOrderIndicator(input: PurchaseOrderIndicatorInput): PurchaseOrderIndicator {
  const docstatus = Number(input.docstatus) || 0
  const status = String(input.status ?? "")
  const perReceived = flt(input.per_received)
  const perBilled = flt(input.per_billed)

  if (docstatus === 0) return cap("Draft", "danger", PURCHASE_ORDER_FILTER_TUPLES.Draft)
  if (docstatus === 2) return cap("Cancelled", "danger", PURCHASE_ORDER_FILTER_TUPLES.Cancelled)

  if (status === "On Hold") return cap("On Hold", "warning", PURCHASE_ORDER_FILTER_TUPLES["On Hold"])
  if (status === "Closed") return cap("Closed", "success", PURCHASE_ORDER_FILTER_TUPLES.Closed)
  if (status === "Completed" || (perReceived >= 100 && perBilled >= 100)) {
    return cap("Completed", "success", PURCHASE_ORDER_FILTER_TUPLES.Completed)
  }

  if (perReceived >= 100 && perBilled < 100) {
    return cap("To Bill", "warning", PURCHASE_ORDER_FILTER_TUPLES["To Bill"])
  }
  if (perBilled >= 100 && perReceived < 100) {
    return cap("To Receive", "warning", PURCHASE_ORDER_FILTER_TUPLES["To Receive"])
  }

  return cap("To Receive and Bill", "warning", PURCHASE_ORDER_FILTER_TUPLES["To Receive and Bill"])
}