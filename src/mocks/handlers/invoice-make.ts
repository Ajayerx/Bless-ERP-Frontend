import { http, HttpResponse, delay } from "msw"

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
    return HttpResponse.json({ message: result })
  }),
]
