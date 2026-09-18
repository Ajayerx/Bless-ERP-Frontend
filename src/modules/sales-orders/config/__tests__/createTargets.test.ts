import { describe, it, expect } from "vitest"
import {
  createMenuAvailable,
  itemsAreDeliverable,
  allowDelivery,
  pickListAvailable,
  materialRequestsAvailable,
  maintenanceActionsAvailable,
  projectAvailable,
  internalPurchaseOrderAvailable,
  paymentAvailable,
  hasPotentiallyBillableItems,
  uniqueDeliveryDates,
  createActionLabel,
  CREATE_ACTIONS,
} from "../createTargets"
import type { SalesOrderDoc, SalesOrderItemForm } from "../../types"

/**
 * Pure-predicate parity tests for the Create menu (createTargets.ts). Every
 * predicate is a verbatim port of the ERPNext `sales_order.js` refresh()
 * button gate; these tests pin the client-side decisions so the dropdown
 * stays faithful to the backend.
 */

const baseItem = (over: Partial<SalesOrderItemForm> = {}): SalesOrderItemForm => ({
  item_name: "PRD-001",
  uom: "Nos",
  conversion_factor: 1,
  qty: 10,
  price_list_rate: 10,
  rate: 10,
  amount: 100,
  discount_percentage: 0,
  delivered_by_supplier: 0,
  ...over,
})

const baseDoc = (over: Partial<SalesOrderDoc> = {}): SalesOrderDoc => ({
  doctype: "Sales Order",
  name: "SAL-ORD-2026-0001",
  docstatus: 1,
  customer: "CUST-0009",
  order_type: "Sales",
  transaction_date: "2026-07-10",
  delivery_date: "2026-07-24",
  company: "Bless & Co.",
  skip_delivery_note: 0,
  currency: "CAD",
  conversion_rate: 1,
  selling_price_list: "Standard Selling",
  price_list_currency: "CAD",
  plc_conversion_rate: 1,
  reserve_stock: 1,
  items: [baseItem()],
  total_qty: 10,
  base_total: 100,
  base_net_total: 100,
  total: 100,
  net_total: 100,
  taxes: [],
  base_total_taxes_and_charges: 0,
  total_taxes_and_charges: 0,
  base_grand_total: 100,
  base_rounding_adjustment: 0,
  base_rounded_total: 100,
  base_in_words: "One Hundred",
  grand_total: 100,
  rounding_adjustment: 0,
  rounded_total: 100,
  in_words: "One Hundred",
  packed_items: [],
  pricing_rules: [],
  payment_schedule: [],
  status: "To Deliver and Bill",
  per_delivered: 0,
  per_billed: 0,
  sales_team: [],
  ...over,
})

describe("createMenuAvailable", () => {
  it("only exposes the Create menu for submitted, non-Closed orders", () => {
    expect(createMenuAvailable(baseDoc({ docstatus: 1 }))).toBe(true)
    expect(createMenuAvailable(baseDoc({ docstatus: 1, status: "Completed" }))).toBe(true)
    expect(createMenuAvailable(baseDoc({ docstatus: 1, status: "Closed" }))).toBe(false)
    expect(createMenuAvailable(baseDoc({ docstatus: 0 }))).toBe(false)
    expect(createMenuAvailable(baseDoc({ docstatus: 2 }))).toBe(false)
  })
})

describe("itemsAreDeliverable", () => {
  it("is true while a non-drop-ship item has undelivered qty", () => {
    expect(itemsAreDeliverable(baseDoc())).toBe(true)
  })

  it("ignores drop-ship items (delivered_by_supplier) and fully delivered rows", () => {
    expect(
      itemsAreDeliverable(
        baseDoc({ items: [baseItem({ delivered_by_supplier: 1 }), baseItem({ qty: 5, delivered_qty: 5 })] }),
      ),
    ).toBe(false)
  })
})

describe("allowDelivery", () => {
  it("allows Delivery Note / Work Order for a Sales order with a unit-price item", () => {
    expect(allowDelivery(baseDoc({ has_unit_price_items: 1 }))).toBe(true)
  })

  it("falls back to physically deliverable items when no unit-price items exist", () => {
    expect(allowDelivery(baseDoc({ has_unit_price_items: 0 }))).toBe(true)
    expect(
      allowDelivery(
        baseDoc({
          has_unit_price_items: 0,
          items: [baseItem({ qty: 4, delivered_qty: 4 })],
        }),
      ),
    ).toBe(false)
  })

  it("blocks fully delivered, Maintenance and skip-delivery-note orders", () => {
    expect(allowDelivery(baseDoc({ per_delivered: 100 }))).toBe(false)
    expect(allowDelivery(baseDoc({ order_type: "Maintenance" }))).toBe(false)
    expect(allowDelivery(baseDoc({ skip_delivery_note: 1 }))).toBe(false)
  })
})

describe("pickListAvailable", () => {
  it("hides once fully picked or delivered", () => {
    expect(pickListAvailable(baseDoc())).toBe(true)
    expect(pickListAvailable(baseDoc({ per_picked: 100 }))).toBe(false)
    expect(pickListAvailable(baseDoc({ per_delivered: 100 }))).toBe(false)
  })
})

describe("materialRequestsAvailable", () => {
  it("covers legacy blank order types and Sales/Shopping Cart still to deliver", () => {
    expect(materialRequestsAvailable(baseDoc({ order_type: "" as SalesOrderDoc["order_type"] }))).toBe(true)
    expect(materialRequestsAvailable(baseDoc({ order_type: "Shopping Cart" }))).toBe(true)
    expect(materialRequestsAvailable(baseDoc({ order_type: "Sales", per_delivered: 40 }))).toBe(true)
  })

  it("hides for Maintenance and completed deliveries", () => {
    expect(materialRequestsAvailable(baseDoc({ order_type: "Maintenance" }))).toBe(false)
    expect(materialRequestsAvailable(baseDoc({ per_delivered: 100 }))).toBe(false)
  })
})

describe("maintenanceActionsAvailable", () => {
  it("shows Maintenance Visit / Schedule only for Maintenance (or custom) work in progress", () => {
    expect(maintenanceActionsAvailable(baseDoc({ order_type: "Maintenance" }))).toBe(true)
    expect(maintenanceActionsAvailable(baseDoc({ order_type: "Sales" }))).toBe(false)
    expect(maintenanceActionsAvailable(baseDoc({ order_type: "Maintenance", per_delivered: 100 }))).toBe(false)
  })
})

describe("projectAvailable", () => {
  it("is true while anything remains to deliver", () => {
    expect(projectAvailable(baseDoc())).toBe(true)
    expect(projectAvailable(baseDoc({ per_delivered: 100 }))).toBe(false)
  })
})

describe("internalPurchaseOrderAvailable", () => {
  it("shows only for internal customers without a prior inter-company order", () => {
    expect(internalPurchaseOrderAvailable(baseDoc({ is_internal_customer: 1 }))).toBe(true)
    expect(
      internalPurchaseOrderAvailable(
        baseDoc({ is_internal_customer: 1, inter_company_order_reference: "SAL-ORD-2026-0002" }),
      ),
    ).toBe(false)
    expect(internalPurchaseOrderAvailable(baseDoc())).toBe(false)
  })
})

describe("paymentAvailable", () => {
  it("is true until the order is fully billed", () => {
    expect(paymentAvailable(baseDoc({ per_billed: 50 }))).toBe(true)
    expect(paymentAvailable(baseDoc({ per_billed: 100 }))).toBe(false)
  })
})

describe("hasPotentiallyBillableItems", () => {
  it("is true for an open row with quantity yet to bill and amount headroom", () => {
    expect(hasPotentiallyBillableItems(baseDoc())).toBe(true)
    expect(
      hasPotentiallyBillableItems(
        baseDoc({
          items: [baseItem({ qty: 10, base_amount: 100, billed_qty: 4, billed_amt: 40 })],
        }),
      ),
    ).toBe(true)
  })

  it("hides when the item is closed", () => {
    expect(hasPotentiallyBillableItems(baseDoc({ items: [baseItem({ closed: 1 })] }))).toBe(false)
  })

  it("hides when the full quantity has already been invoiced", () => {
    expect(
      hasPotentiallyBillableItems(baseDoc({ items: [baseItem({ qty: 10, billed_qty: 10, billed_amt: 100 })] })),
    ).toBe(false)
  })

  it("hides when the amount has been fully billed", () => {
    expect(
      hasPotentiallyBillableItems(
        baseDoc({
          items: [baseItem({ qty: 10, base_amount: 100, amount: 1000, billed_qty: 1, billed_amt: 1000 })],
        }),
      ),
    ).toBe(false)
  })

  it("keeps zero-qty unit-price rows (rate-adjustment / debit-note path)", () => {
    expect(
      hasPotentiallyBillableItems(
        baseDoc({
          has_unit_price_items: 1,
          items: [baseItem({ qty: 0, amount: 1000, base_amount: 1000 })],
        }),
      ),
    ).toBe(true)
  })

  it("treats a 0-qty row as non-billable when no unit-price items exist", () => {
    expect(
      hasPotentiallyBillableItems(baseDoc({ has_unit_price_items: 0, items: [baseItem({ qty: 0 })] })),
    ).toBe(false)
  })
})

describe("uniqueDeliveryDates", () => {
  it("returns distinct, non-empty item delivery dates preserving order", () => {
    expect(
      uniqueDeliveryDates(
        baseDoc({
          items: [
            baseItem({ delivery_date: "2026-07-20" }),
            baseItem({ item_name: "PRD-002", delivery_date: "2026-07-20" }),
            baseItem({ item_name: "PRD-003", delivery_date: "2026-07-25" }),
            baseItem({ item_name: "PRD-004" }),
          ],
        }),
      ),
    ).toEqual(["2026-07-20", "2026-07-25"])
  })

  it("is empty when no item carries a delivery date", () => {
    expect(uniqueDeliveryDates(baseDoc())).toEqual([])
  })
})

describe("CREATE_ACTIONS", () => {
  it("hides non-payment actions while the order is On Hold", () => {
    const onHold = baseDoc({ status: "On Hold" })
    for (const action of CREATE_ACTIONS) {
      if (action.kind === "payment-request" || action.kind === "payment") continue
      expect(action.available(onHold)).toBe(false)
    }
  })

  it("requires a submitted, non-Closed doc for Payment Request / Payment", () => {
    const payment = CREATE_ACTIONS.find((a) => a.kind === "payment")
    expect(payment?.available(baseDoc({ docstatus: 0 }))).toBe(false)
    expect(payment?.available(baseDoc({ status: "Closed" }))).toBe(false)
    expect(payment?.available(baseDoc())).toBe(true)
  })

  it("routes saved Sales Invoice / Payment into the modules; warns for Payment Request", () => {
    const invoice = CREATE_ACTIONS.find((a) => a.kind === "sales-invoice")
    const payment = CREATE_ACTIONS.find((a) => a.kind === "payment")
    const paymentRequest = CREATE_ACTIONS.find((a) => a.kind === "payment-request")
    expect(invoice?.route?.({ doctype: "Sales Invoice", name: "SINV-2026-0001" })).toBe(
      "/invoices/SINV-2026-0001",
    )
    expect(invoice?.createRoute?.({ doctype: "Sales Invoice", customer_name: "A", items: [] })).toBe(
      "/invoices/new",
    )
    expect(payment?.route?.({ doctype: "Payment Entry", name: "ACC-PAY-2026-0001" })).toBe(
      "/payments/ACC-PAY-2026-0001",
    )
    expect(payment?.createRoute?.({ doctype: "Payment Entry", party: "CUST-0001" })).toBe(
      "/payments/new",
    )
    // Payment Request is not surfaced in this SPA, so it must never route.
    expect(paymentRequest?.route).toBeUndefined()
    expect(paymentRequest?.createRoute).toBeUndefined()
  })

  it("gates Purchase Order on non-internal customers", () => {
    const purchaseOrder = CREATE_ACTIONS.find((a) => a.kind === "purchase-order")
    expect(purchaseOrder?.available(baseDoc())).toBe(true)
    expect(purchaseOrder?.available(baseDoc({ is_internal_customer: 1 }))).toBe(false)
  })

  it("gates Sales Invoice on the item-level billability criterion", () => {
    const invoice = CREATE_ACTIONS.find((a) => a.kind === "sales-invoice")
    expect(invoice?.available(baseDoc())).toBe(true)
    expect(invoice?.available(baseDoc({ items: [baseItem({ qty: 0, billed_qty: 0 })] }))).toBe(false)
  })

  it("resolves dynamic labels for the internal / inter-company PO", () => {
    const internal = CREATE_ACTIONS.find((a) => a.kind === "internal-purchase-order")
    expect(createActionLabel(internal!, baseDoc({ represents_company: "Bless & Co." }))).toBe(
      "Internal Purchase Order",
    )
    expect(createActionLabel(internal!, baseDoc({ represents_company: "Sister Ltd." }))).toBe(
      "Inter Company Purchase Order",
    )
  })
})