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
 * Normalised outcome of a Create action. Simple mapped/services return a single
 * (possibly unsaved, unnamed) doc; Work Orders and per-supplier Purchase Orders
 * create multiple docs and carry `names`.
 */
export interface CreateOutcome {
  doctype: string
  name?: string
  names?: string[]
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
   * Frontend route for a created document — set only when a module exists for
   * its doctype (Sales Invoice → /invoices/:id, Payment Request & Payment
   * Entry → /payments/:id). Actions without a route keep the "create then warn"
   * behaviour: the backend doc is created and a warning notes the module is
   * not available in this app yet.
   */
  route?: (created: CreateResult) => string
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
    available: (doc) => doc.status !== "On Hold" && doc.per_billed < 100,
    route: (created) => `/invoices/${created.name}`,
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
    route: (created) => `/payments/${created.name}`,
  },
  {
    key: "payment",
    kind: "payment",
    label: "Payment",
    icon: Landmark,
    available: (doc) => createMenuAvailable(doc) && paymentAvailable(doc),
    route: (created) => `/payments/${created.name}`,
  },
]

/** Resolves an action label (functions are evaluated against the current doc). */
export function createActionLabel(action: CreateAction, doc: SalesOrderDoc): string {
  return typeof action.label === "function" ? action.label(doc) : action.label
}