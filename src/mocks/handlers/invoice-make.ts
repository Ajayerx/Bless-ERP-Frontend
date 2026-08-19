import { http, HttpResponse, delay } from "msw"
import { salesInvoices, salesOrders } from "./frappe-lookups"

// ERPNext "Create" actions from the Sales Invoice toolbar (sales_invoice.js
// + frappe.model.mapper.make_mapped_doc). Each returns the fresh target doc
// `{ doctype, name }`, which the invoice workspace resolves to a route.

let counter = 0
const nextName = (prefix: string) => `${prefix}-${String(++counter).padStart(4, "0")}`

interface MakeDocResult {
  doctype: string
  name: string
}

// method → { doctype, namePrefix } for make_mapped_doc-style targets.
const MAPPED_TARGETS: Record<string, { doctype: string; prefix: string }> = {
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_sales_return": {
    doctype: "Sales Invoice",
    prefix: "SINV-RET",
  },
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_delivery_note": {
    doctype: "Delivery Note",
    prefix: "DN",
  },
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.create_invoice_discounting": {
    doctype: "Invoice Discounting",
    prefix: "INV-DIS",
  },
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.create_dunning": {
    doctype: "Dunning",
    prefix: "DUN",
  },
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_inter_company_purchase_invoice": {
    doctype: "Purchase Invoice",
    prefix: "PINV-IC",
  },
  "erpnext.selling.doctype.sales_invoice.sales_invoice.make_maintenance_schedule": {
    doctype: "Maintenance Schedule",
    prefix: "MNT-SCH",
  },
  "erpnext.selling.doctype.quotation.quotation.make_sales_order": {
    doctype: "Sales Order",
    prefix: "SAL-ORD",
  },
  "erpnext.selling.doctype.quotation.quotation.make_sales_invoice": {
    doctype: "Sales Invoice",
    prefix: "SINV",
  },
}

function jsonBody(body: string): Record<string, unknown> {
  try {
    return JSON.parse(body) as Record<string, unknown>
  } catch {
    return {}
  }
}

export const invoiceMakeHandlers = [
  // ── Payment Entry (get_payment_entry) ──────────────────────────────
  http.post("/api/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry", async ({ request }) => {
    await delay(150)
    void request
    const result: MakeDocResult = { doctype: "Payment Entry", name: nextName("PAY") }
    return HttpResponse.json({ message: result })
  }),

  // ── Payment Request (make_payment_request) ─────────────────────────
  http.post("/api/method/erpnext.accounts.doctype.payment_request.payment_request.make_payment_request", async ({ request }) => {
    await delay(150)
    void request
    const result: MakeDocResult = { doctype: "Payment Request", name: nextName("PR") }
    return HttpResponse.json({ message: result })
  }),

  // ── Mapped docs: Return / Delivery Note / Discounting / Dunning / ──
  //    Inter-Company PI / Maintenance Schedule (make_mapped_doc) ─────
  http.post("/api/method/frappe.model.mapper.make_mapped_doc", async ({ request }) => {
    await delay(150)
    const body = jsonBody(await request.text())
    const method = String(body.method ?? "")
    const target = MAPPED_TARGETS[method] ?? { doctype: "Sales Invoice", prefix: "SINV-MAP" }
    const result: MakeDocResult = { doctype: target.doctype, name: nextName(target.prefix) }

    // Seed the created doc so its detail route resolves within the session.
    const today = new Date().toISOString().slice(0, 10)
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 19)
    if (target.doctype === "Sales Order" && !salesOrders.some((so) => so.name === result.name)) {
      salesOrders.push({
        name: result.name,
        customer: "CUST-0001",
        customer_name: "Maple Leaf Bakery",
        transaction_date: today,
        delivery_date: today,
        grand_total: 2450.0,
        status: "Draft",
        docstatus: 0,
        per_delivered: 0,
        per_billed: 0,
        owner: "admin@blesserp.com",
        creation: stamp,
        modified: stamp,
        modified_by: "admin@blesserp.com",
      })
    }
    if (target.doctype === "Sales Invoice" && !salesInvoices.some((si) => si.name === result.name)) {
      salesInvoices.push({
        name: result.name,
        customer: "CUST-0001",
        customer_name: "Maple Leaf Bakery",
        grand_total: 2450.0,
        outstanding_amount: 2450.0,
        posting_date: today,
        due_date: today,
        creation: stamp,
        status: "Draft",
        docstatus: 0,
        owner: "admin@blesserp.com",
        modified: stamp,
        modified_by: "admin@blesserp.com",
      })
    }

    return HttpResponse.json({ message: result })
  }),
]
