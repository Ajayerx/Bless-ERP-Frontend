import {
  ListChecks,
  Truck,
  Wrench,
  Receipt,
  ClipboardList,
  Hammer,
  ShoppingBag,
  FileText,
  CalendarClock,
  FolderKanban,
  Building2,
  CreditCard,
  Landmark,
  type LucideIcon,
} from "lucide-react"
import type { SalesOrderDoc } from "../types"

/**
 * Sales Order "Create" menu — a faithful port of the ERPNext
 * `sales_order.js` `refresh()` button block (lines ~592–794). Every action's
 * `available()` predicate is copied verbatim from the server doctype script so
 * the dropdown only offers actions the backend would actually accept.
 *
 * ERPNext additionally gates each button on `frappe.model.can_create(...)` /
 * `frappe.boot.user.in_create`, which is derived from backend DocPerm and is
 * NOT exposed over REST. We approximate by keeping the menu permissive; the
 * backend still enforces permissions and any rejection surfaces as a toast.
 */

export interface CreateResult {
  doctype: string
  name: string
}

/**
 * Raw mapped doc returned by ERPNext `make_mapped_doc` / `make_*` endpoints.
 * The real server returns an UNSAVED doc dict (empty `name`, `__islocal: 1`)
 * that `open_mapped_doc` opens as a prefilled create form. Saved create
 * endpoints (`make_work_orders`, per-supplier POs, ...) still return names.
 */
export interface MappedDoc {
  doctype?: string
  name?: string
  [key: string]: unknown
}

/**
 * Normalised outcome of a Create action. Simple mapped/services return a single
 * (possibly unsaved, unnamed) doc; Work Orders and per-supplier Purchase Orders
 * create multiple docs and carry `names`.
 */
export interface CreateOutcome {
  doctype: string
  name?: string
  names?: string[]
  /** Raw (usually unsaved) mapped doc returned by the broker endpoint. */
  doc?: MappedDoc
}

export type CreateActionKind =
  | "pick-list"
  | "delivery-note"
  | "work-orders"
  | "sales-invoice"
  | "material-request"
  | "raw-material"
  | "purchase-order"
  | "maintenance-visit"
  | "maintenance-schedule"
  | "project"
  | "internal-purchase-order"
  | "payment-request"
  | "payment"

export interface CreateAction {
  /** Stable, unique dropdown item key. */
  key: string
  kind: CreateActionKind
  label: string | ((doc: SalesOrderDoc) => string)
  icon: LucideIcon
  available: (doc: SalesOrderDoc) => boolean
  /**
   * Frontend route for a **saved** created document — set only when a module
   * exists for its doctype (Sales Invoice → /invoices/:id, Payment Entry →
   * /payments/:id). Actions without a route keep the "create then warn"
   * behaviour: the backend doc is created and a warning notes the module is
   * not available in this app yet.
   */
  route?: (created: CreateResult) => string
  /**
   * Frontend create-form route for an **unsaved** mapped doc (ERPNext
   * `open_mapped_doc` semantics): navigate with `{ state: { mappedDoc } }` so
   * the target module opens a prefilled create form instead of warning.
   */
  createRoute?: (doc: MappedDoc) => string
}

function isSale(orderType: string): boolean {
  return orderType === "Sales" || orderType === "Shopping Cart"
}

function isMaintenance(orderType: string): boolean {
  return orderType === "Maintenance"
}

/**
 * A customised order type (anything outside Sales / Shopping Cart /
 * Maintenance) — ERPNext shows all the action buttons for it.
 */
function isCustomSale(orderType: string): boolean {
  return !isSale(orderType) && !isMaintenance(orderType)
}

/** The Create menu (and its payment block) only renders for submitted, non-Closed orders. */
export function createMenuAvailable(doc: SalesOrderDoc): boolean {
  return doc.docstatus === 1 && doc.status !== "Closed"
}

/** ERPNext `allow_delivery`: unit-price items exist, or a deliverable item remains. */
export function itemsAreDeliverable(doc: SalesOrderDoc): boolean {
  return doc.items.some(
    (item) => item.delivered_by_supplier === 0 && item.qty > (item.delivered_qty ?? 0),
  )
}

export function allowDelivery(doc: SalesOrderDoc): boolean {
  return (
    doc.per_delivered < 100 &&
    (isSale(doc.order_type) || isCustomSale(doc.order_type)) &&
    ((doc.has_unit_price_items ?? 0) ? true : itemsAreDeliverable(doc)) &&
    !doc.skip_delivery_note
  )
}

/** Pick List: hidden once the order is fully picked, delivered, or has reserved stock. */
export function pickListAvailable(doc: SalesOrderDoc): boolean {
  return (doc.per_picked ?? 0) < 100 && doc.per_delivered < 100
}

/**
 * Material Request + Request for Raw Materials: shown when no order type is set
 * (legacy) or for Sales / Shopping Cart (and custom) order types still to deliver.
 */
export function materialRequestsAvailable(doc: SalesOrderDoc): boolean {
  return (
    !doc.order_type ||
    ((isSale(doc.order_type) || isCustomSale(doc.order_type)) && doc.per_delivered < 100)
  )
}

/** Maintenance Visit / Schedule: Maintenance (and custom) order types still to deliver. */
export function maintenanceActionsAvailable(doc: SalesOrderDoc): boolean {
  return doc.per_delivered < 100 && (isMaintenance(doc.order_type) || isCustomSale(doc.order_type))
}

/** Project: any submitted order still to deliver. */
export function projectAvailable(doc: SalesOrderDoc): boolean {
  return doc.per_delivered < 100
}

/** Internal / Inter-Company PO: internal customer, no inter-company order yet. */
export function internalPurchaseOrderAvailable(doc: SalesOrderDoc): boolean {
  return !!doc.is_internal_customer && !doc.inter_company_order_reference
}

/** Payment Request / Payment: under-billed (over_billing_allowance approximated as 0). */
export function paymentAvailable(doc: SalesOrderDoc): boolean {
  return doc.per_billed < 100
}

// Port of `get_pending_qty_criterion` (ERPNext Sales Order): an item still has
// unbilled ordered qty AND (unbilled delivered qty OR an undelivered balance).
const pendingQtyCriterion = (item: SalesOrderDoc["items"][number]): boolean => {
  const round6 = (n: number) => Math.round((n + Number.EPSILON) * 1e6) / 1e6
  const qty = item.qty ?? 0
  const billedQty = item.billed_qty ?? 0
  const returnedQty = item.returned_qty ?? 0
  const deliveredQty = item.delivered_qty ?? 0
  const hasUnbilledOrderedQty = round6(qty - billedQty) > 0
  const hasUnbilledDeliveredQty =
    round6(qty - returnedQty - billedQty) > 0 || round6(deliveredQty - billedQty) > 0
  return hasUnbilledOrderedQty && hasUnbilledDeliveredQty
}

/**
 * Port of `get_potentially_billable_item_criterion` (ERPNext Sales Order, used
 * by `sales_order.js` to gate the "Sales Invoice" Create button). An item is
 * billable when it is not closed and is either a zero-qty unit-price row
 * (rate-adjustment / debit-note path) or has quantity yet to bill with amount
 * headroom. Subcontracting (`doc.is_subcontracted`) is not modelled here, so
 * only the billable-items branch applies.
 */
export function hasPotentiallyBillableItems(doc: SalesOrderDoc): boolean {
  const allowance = 0
  const hasUnitPriceItems = (doc.has_unit_price_items ?? 0) === 1
  return doc.items.some((item) => {
    if ((item.closed ?? 0) === 1) return false
    const amount = item.amount ?? 0
    const baseAmount = item.base_amount ?? 0
    const billedAmt = item.billed_amt ?? 0
    const hasAmountHeadroom = baseAmount === 0 || Math.abs(billedAmt) < Math.abs(amount) * (1 + allowance / 100)
    const isUnitPriceRow = hasUnitPriceItems && (item.qty ?? 0) === 0
    return isUnitPriceRow || ((item.qty ?? 0) !== 0 && hasAmountHeadroom && pendingQtyCriterion(item))
  })
}

/** Distinct item delivery dates — >1 drives the Delivery Note date-selector dialog. */
export function uniqueDeliveryDates(doc: SalesOrderDoc): string[] {
  return Array.from(
    new Set(doc.items.map((item) => item.delivery_date).filter((d): d is string => !!d)),
  )
}

export const CREATE_ACTIONS: CreateAction[] = [
  {
    key: "pick-list",
    kind: "pick-list",
    label: "Pick List",
    icon: ListChecks,
    available: (doc) => doc.status !== "On Hold" && pickListAvailable(doc),
  },
  {
    key: "delivery-note",
    kind: "delivery-note",
    label: "Delivery Note",
    icon: Truck,
    available: (doc) => doc.status !== "On Hold" && allowDelivery(doc),
  },
  {
    key: "work-orders",
    kind: "work-orders",
    label: "Work Order",
    icon: Wrench,
    available: (doc) => doc.status !== "On Hold" && allowDelivery(doc),
  },
  {
    key: "sales-invoice",
    kind: "sales-invoice",
    label: "Sales Invoice",
    icon: Receipt,
    available: (doc) => doc.status !== "On Hold" && hasPotentiallyBillableItems(doc),
    route: (created) => `/invoices/${created.name}`,
    createRoute: () => "/invoices/new",
  },
  {
    key: "material-request",
    kind: "material-request",
    label: "Material Request",
    icon: ClipboardList,
    available: (doc) => doc.status !== "On Hold" && materialRequestsAvailable(doc),
  },
  {
    key: "raw-material",
    kind: "raw-material",
    label: "Request for Raw Materials",
    icon: Hammer,
    available: (doc) => doc.status !== "On Hold" && materialRequestsAvailable(doc),
  },
  {
    key: "purchase-order",
    kind: "purchase-order",
    label: "Purchase Order",
    icon: ShoppingBag,
    available: (doc) => doc.status !== "On Hold" && !doc.is_internal_customer,
  },
  {
    key: "maintenance-visit",
    kind: "maintenance-visit",
    label: "Maintenance Visit",
    icon: FileText,
    available: (doc) => doc.status !== "On Hold" && maintenanceActionsAvailable(doc),
  },
  {
    key: "maintenance-schedule",
    kind: "maintenance-schedule",
    label: "Maintenance Schedule",
    icon: CalendarClock,
    available: (doc) => doc.status !== "On Hold" && maintenanceActionsAvailable(doc),
  },
  {
    key: "project",
    kind: "project",
    label: "Project",
    icon: FolderKanban,
    available: (doc) => doc.status !== "On Hold" && projectAvailable(doc),
  },
  {
    key: "internal-purchase-order",
    kind: "internal-purchase-order",
    label: (doc) =>
      doc.company === doc.represents_company ? "Internal Purchase Order" : "Inter Company Purchase Order",
    icon: Building2,
    available: (doc) => doc.status !== "On Hold" && internalPurchaseOrderAvailable(doc),
  },
  {
    key: "payment-request",
    kind: "payment-request",
    label: "Payment Request",
    icon: CreditCard,
    available: (doc) => createMenuAvailable(doc) && paymentAvailable(doc),
  },
  {
    key: "payment",
    kind: "payment",
    label: "Payment",
    icon: Landmark,
    available: (doc) => createMenuAvailable(doc) && paymentAvailable(doc),
    route: (created) => `/payments/${created.name}`,
    createRoute: () => "/payments/new",
  },
]

/** Resolves an action label (functions are evaluated against the current doc). */
export function createActionLabel(action: CreateAction, doc: SalesOrderDoc): string {
  return typeof action.label === "function" ? action.label(doc) : action.label
}