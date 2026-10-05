/**
 * ERPNext Purchase Invoice status indicator — mirrors how the ERPNext desk
 * drives the list status column for Purchase Invoices.
 *
 * docstatus short-circuits first (Draft / Cancelled). Submitted rows derive a
 * payment indicator from `outstanding_amount`, `paid_amount` and `due_date`:
 * fully paid → Paid, part-way → Partly Paid, nothing paid → Unpaid (Not Paid),
 * and unpaid-but-past due → Overdue.
 */

export type PurchaseInvoiceIndicatorLabel =
  | "Draft"
  | "Submitted"
  | "Cancelled"
  | "Paid"
  | "Partly Paid"
  | "Unpaid"
  | "Overdue"

export type PurchaseInvoiceIndicatorVariant = "success" | "warning" | "danger" | "info"

/** ERPNext filter tuple fields (doctype is prepended by the caller). */
export type PurchaseInvoiceFilter = [field: string, operator: string, value: unknown]

export interface PurchaseInvoiceIndicatorInput {
  docstatus?: number
  outstanding_amount?: number
  paid_amount?: number
  due_date?: string
}

export interface PurchaseInvoiceIndicator {
  label: PurchaseInvoiceIndicatorLabel
  variant: PurchaseInvoiceIndicatorVariant
  /** And-group filter the doc's own indicator applies when clicked. */
  filterArgs: PurchaseInvoiceFilter[]
}

const localTodayIso = (): string => {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

const UNPAID: PurchaseInvoiceFilter[] = [
  ["docstatus", "=", 1],
  ["outstanding_amount", ">", 0],
  ["paid_amount", "=", 0],
]

/**
 * Canonical per-label filter the quick pills / status tabs apply.
 */
export const PURCHASE_INVOICE_FILTER_TUPLES: Record<PurchaseInvoiceIndicatorLabel, PurchaseInvoiceFilter[]> = {
  Draft: [["docstatus", "=", 0]],
  Submitted: [["docstatus", "=", 1]],
  Cancelled: [["docstatus", "=", 2]],
  Paid: [
    ["docstatus", "=", 1],
    ["outstanding_amount", "=", 0],
  ],
  "Partly Paid": [
    ["docstatus", "=", 1],
    ["outstanding_amount", ">", 0],
    ["paid_amount", ">", 0],
  ],
  Unpaid: UNPAID,
  Overdue: [
    ["docstatus", "=", 1],
    ["outstanding_amount", ">", 0],
    ["due_date", "<", localTodayIso()],
  ],
}

/** Tab order surfaced on the list page (status quick filters). */
export const PURCHASE_INVOICE_INDICATOR_LABELS: PurchaseInvoiceIndicatorLabel[] = [
  "Draft",
  "Unpaid",
  "Partly Paid",
  "Paid",
  "Overdue",
  "Submitted",
  "Cancelled",
]

const cap = (
  label: PurchaseInvoiceIndicatorLabel,
  variant: PurchaseInvoiceIndicatorVariant,
  filterArgs: PurchaseInvoiceFilter[],
): PurchaseInvoiceIndicator => ({ label, variant, filterArgs })

const money = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0)

/**
 * Derives the ERPNext status indicator for a Purchase Invoice row/doc.
 *
 * Order of evaluation: docstatus short-circuits first (Draft/Cancelled), then
 * payment progress (Paid / Partly Paid / Unpaid / Overdue).
 */
export function getPurchaseInvoiceIndicator(input: PurchaseInvoiceIndicatorInput): PurchaseInvoiceIndicator {
  const docstatus = Number(input.docstatus) || 0
  const outstanding = money(input.outstanding_amount)
  const paid = money(input.paid_amount)
  const dueDate = String(input.due_date ?? "")

  if (docstatus === 0) return cap("Draft", "danger", PURCHASE_INVOICE_FILTER_TUPLES.Draft)
  if (docstatus === 2) return cap("Cancelled", "danger", PURCHASE_INVOICE_FILTER_TUPLES.Cancelled)

  if (outstanding <= 0) return cap("Paid", "success", PURCHASE_INVOICE_FILTER_TUPLES.Paid)
  if (outstanding > 0 && dueDate && dueDate < localTodayIso()) {
    return cap("Overdue", "danger", PURCHASE_INVOICE_FILTER_TUPLES.Overdue)
  }
  if (paid > 0) return cap("Partly Paid", "warning", PURCHASE_INVOICE_FILTER_TUPLES["Partly Paid"])
  return cap("Unpaid", "info", PURCHASE_INVOICE_FILTER_TUPLES.Unpaid)
}