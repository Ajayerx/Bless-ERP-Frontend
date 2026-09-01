import { http, HttpResponse, delay, passthrough } from "msw"
import { salesOrders, quotationItems, quotationTaxes, paymentScheduleRows } from "./frappe-lookups"

// ── Sales Order mock backend (ERPNext form endpoints) ───────────────
// Mirrors the exact wire contract of the Sales Order workspace:
//   frappe.desk.form.load.getdoc      → { docs: [doc], docinfo }
//   frappe.desk.form.save.savedocs    → { message, docs: [doc] }
//   frappe.desk.form.save.cancel      → { message }
// plus the status action (update_status) and the Create-menu mapped-doc
// and stock-reservation endpoints.

let store: Record<string, unknown>[] = salesOrders.map((s) => ({ ...s }))

// Seeding hook for mapped-doc flows (e.g. quotation → Sales Order via
// make_mapped_doc) that create brand-new sales orders server-side. Returns
// the seam-ready document row so the caller can resolve its detail route.
export function addSalesOrderRow(row: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    name: String(row.name ?? ""),
    customer: String(row.customer ?? ""),
    customer_name: String(row.customer_name ?? ""),
    transaction_date: String(row.transaction_date ?? ""),
    delivery_date: String(row.delivery_date ?? ""),
    company: String(row.company ?? "BlessERP Inc."),
    currency: String(row.currency ?? "CAD"),
    grand_total: Number(row.grand_total ?? 0),
    status: String(row.status ?? "Draft"),
    docstatus: Number(row.docstatus ?? 0),
    owner: String(row.owner ?? "admin@blesserp.com"),
    creation: String(row.creation ?? ""),
    modified: String(row.modified ?? row.creation ?? ""),
    modified_by: String(row.modified_by ?? row.owner ?? "admin@blesserp.com"),
    ...row,
  }
  store = [merged, ...store.filter((s) => String(s.name) !== String(merged.name))]
  // Keep the shared list pseudo-array in sync so the REST /resource/Sales Order
  // handlers (frappe-lookups) can resolve the freshly created doc by name.
  const existing = salesOrders.findIndex((s) => String(s.name) === String(merged.name))
  if (existing === -1) salesOrders.push(merged as (typeof salesOrders)[number])
  else salesOrders[existing] = merged as (typeof salesOrders)[number]
  return fullDoc(merged)
}

export function fullDoc(row: Record<string, unknown>): Record<string, unknown> {
  return {
    doctype: "Sales Order",
    name: String(row.name ?? ""),
    title: String(row.customer_name ?? ""),
    customer: String(row.customer ?? ""),
    customer_name: String(row.customer_name ?? ""),
    transaction_date: String(row.transaction_date ?? ""),
    delivery_date: String(row.delivery_date ?? ""),
    order_type: String(row.order_type ?? "Sales"),
    company: String(row.company ?? "BlessERP Inc."),
    currency: String(row.currency ?? "CAD"),
    conversion_rate: Number(row.conversion_rate ?? 1),
    selling_price_list: String(row.selling_price_list ?? "Standard Selling"),
    price_list_currency: String(row.price_list_currency ?? row.currency ?? "CAD"),
    plc_conversion_rate: Number(row.plc_conversion_rate ?? 1),
    skip_delivery_note: Number(row.skip_delivery_note ?? 0),
    reserve_stock: Number(row.reserve_stock ?? 0),
    disable_rounded_total: Number(row.disable_rounded_total ?? 0),
    total_qty: Number(row.total_qty ?? 98),
    base_total: Number(row.base_total ?? 2450),
    base_net_total: Number(row.base_net_total ?? 2450),
    total: Number(row.total ?? 2450),
    net_total: Number(row.net_total ?? 2450),
    base_total_taxes_and_charges: Number(row.base_total_taxes_and_charges ?? 366.89),
    total_taxes_and_charges: Number(row.total_taxes_and_charges ?? 366.89),
    base_grand_total: Number(row.base_grand_total ?? 2816.89),
    base_rounding_adjustment: Number(row.base_rounding_adjustment ?? 0),
    base_rounded_total: Number(row.base_rounded_total ?? 2816.89),
    base_in_words: String(row.base_in_words ?? "Two Thousand Eight Hundred Sixteen Dollars and Eighty-Nine Cents Only"),
    grand_total: Number(row.grand_total ?? 2816.89),
    rounding_adjustment: Number(row.rounding_adjustment ?? 0),
    rounded_total: Number(row.rounded_total ?? 2816.89),
    in_words: String(row.in_words ?? "Two Thousand Eight Hundred Sixteen Dollars and Eighty-Nine Cents Only"),
    tax_category: String(row.tax_category ?? "Standard"),
    taxes_and_charges: String(row.taxes_and_charges ?? "Canada GST/QST - BE"),
    apply_discount_on: String(row.apply_discount_on ?? "Grand Total"),
    items: Array.isArray(row.items) ? row.items : quotationItems.map((i) => ({ ...i, doctype: "Sales Order Item", parentfield: "items", parenttype: "Sales Order" })),
    taxes: Array.isArray(row.taxes) ? row.taxes : quotationTaxes.map((t) => ({ ...t, doctype: "Sales Taxes and Charges", parentfield: "taxes", parenttype: "Sales Order" })),
    payment_schedule: Array.isArray(row.payment_schedule) ? row.payment_schedule : paymentScheduleRows.map((p) => ({ ...p, doctype: "Payment Schedule", parentfield: "payment_schedule", parenttype: "Sales Order" })),
    packed_items: Array.isArray(row.packed_items) ? row.packed_items : [],
    sales_team: Array.isArray(row.sales_team) ? row.sales_team : [],
    pricing_rules: Array.isArray(row.pricing_rules) ? row.pricing_rules : [],
    per_delivered: Number(row.per_delivered ?? 0),
    per_billed: Number(row.per_billed ?? 0),
    group_same_items: Number(row.group_same_items ?? 0),
    status: String(row.status ?? "Draft"),
    docstatus: Number(row.docstatus ?? 0),
    owner: String(row.owner ?? "admin@blesserp.com"),
    creation: String(row.creation ?? ""),
    modified: String(row.modified ?? row.creation ?? ""),
    modified_by: String(row.modified_by ?? row.owner ?? "admin@blesserp.com"),
    _assign: row._assign,
    _user_tags: row._user_tags,
  }
}

function safeJson<T>(val: string | null, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

function formFields(request: Request): Promise<Record<string, string>> {
  return request.formData().catch(() => new FormData()).then((fd) => {
    const out: Record<string, string> = {}
    fd.forEach((value, key) => { out[key] = String(value) })
    return out
  })
}

let docCounter = 0
const nowStamp = () => new Date().toISOString().replace("T", " ").slice(0, 19)

export const salesOrderFormHandlers = [
  // ── Open doc: frappe.desk.form.load.getdoc ─────────────────────────
  http.post("/api/method/frappe.desk.form.load.getdoc", async ({ request }) => {
    await delay(150)
    const fields = await formFields(request)
    const name = fields.name ?? ""
    const row = store.find((s) => s.name === name)
    // Not a Sales Order we know about — hand off to a later doctype handler
    // (e.g. the quotation mock backend shares this endpoint).
    if (!row) return passthrough()
    return HttpResponse.json({
      docs: [fullDoc(row)],
      docinfo: {
        doctype: "Sales Order",
        name,
        comments: [],
        versions: [],
        user_info: { "admin@blesserp.com": { fullname: "Administrator" } },
        assignments: [],
        tags: row._user_tags ?? "",
        permissions: { read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true },
      },
    })
  }),

  // ── Save / Submit / Update: frappe.desk.form.save.savedocs ────────
  http.post("/api/method/frappe.desk.form.save.savedocs", async ({ request }) => {
    await delay(250)
    const fields = await formFields(request)
    const incoming = safeJson<Record<string, unknown>>(fields.doc ?? "", {})
    if (incoming.doctype && String(incoming.doctype) !== "Sales Order") return passthrough()

    const action = (fields.action ?? "Save") as "Save" | "Submit" | "Update"

    let doc: Record<string, unknown>
    const existingName = String(incoming.name ?? "")
    const idx = store.findIndex((s) => String(s.name) === existingName)

    if (idx === -1) {
      docCounter += 1
      const name = `SAL-ORD-2026-${String(Number(store.length) + 1000 + docCounter)}`
      const newRow: Record<string, unknown> = {
        name,
        customer: incoming.customer ?? "",
        customer_name: incoming.customer_name ?? "",
        transaction_date: incoming.transaction_date ?? new Date().toISOString().slice(0, 10),
        delivery_date: incoming.delivery_date ?? "",
        company: incoming.company ?? "BlessERP Inc.",
        currency: incoming.currency ?? "CAD",
        grand_total: incoming.grand_total ?? 0,
        status: action === "Submit" ? "To Deliver and Bill" : "Draft",
        docstatus: action === "Submit" ? 1 : 0,
        per_delivered: 0,
        per_billed: 0,
        owner: "admin@blesserp.com",
        creation: nowStamp(),
        modified: nowStamp(),
        modified_by: "admin@blesserp.com",
        ...incoming,
      }
      store = [newRow, ...store]
      // Keep the shared list pseudo-array in sync so the REST /resource/Sales Order
      // handlers (frappe-lookups) can resolve the freshly created doc by name.
      if (!salesOrders.some((s) => String(s.name) === name)) {
        salesOrders.push(newRow as (typeof salesOrders)[number])
      }
      doc = fullDoc(newRow)
    } else {
      const row = store[idx]
      const merged = { ...row, ...incoming }
      if (action === "Submit") {
        merged.docstatus = 1
        merged.status = "To Deliver and Bill"
      } else if (incoming.docstatus === 2) {
        merged.docstatus = 2
        merged.status = "Cancelled"
      } else {
        merged.docstatus = row.docstatus ?? merged.docstatus
        merged.status = Number(merged.docstatus) === 1 ? (row.status ?? "To Deliver and Bill") : merged.status ?? "Draft"
      }
      merged.modified = nowStamp()
      merged.modified_by = "admin@blesserp.com"
      store[idx] = merged
      doc = fullDoc(merged)
    }

    return HttpResponse.json({ message: "Saved", docs: [doc] })
  }),

  // ── Cancel: frappe.desk.form.save.cancel ──────────────────────────
  http.post("/api/method/frappe.desk.form.save.cancel", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const name = fields.name ?? ""
    const dt = fields.doctype ?? ""
    if (dt && String(dt) !== "Sales Order") return passthrough()
    const idx = store.findIndex((s) => String(s.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Sales Order ${name} not found` }, { status: 404 })
    store[idx] = { ...store[idx], docstatus: 2, status: "Cancelled", modified: nowStamp(), modified_by: "admin@blesserp.com" }
    return HttpResponse.json({ message: name })
  }),

  // ── Update status: Hold / Close / Resume / Re-open ────────────────
  http.post("/api/method/erpnext.selling.doctype.sales_order.sales_order.update_status", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const name = fields.name ?? ""
    const status = fields.status ?? ""
    const idx = store.findIndex((s) => String(s.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Sales Order ${name} not found` }, { status: 404 })
    store[idx] = { ...store[idx], status, modified: nowStamp(), modified_by: "admin@blesserp.com" }
    return HttpResponse.json({ message: status })
  }),

  // ── Fetch flow: get_conversion_factor ─────────────────────────────
  http.post("/api/method/erpnext.stock.get_item_details.get_conversion_factor", async ({ request }) => {
    await delay(100)
    const fields = await formFields(request)
    void fields
    return HttpResponse.json({ message: { conversion_factor: 1 } })
  }),

  // ── Stock reservation: create / cancel ────────────────────────────
  http.post("/api/method/erpnext.selling.doctype.sales_order.sales_order.create_stock_reservation_entries", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const items = safeJson<Array<Record<string, unknown>>>(fields.items ?? "[]", [])
    const idx = store.findIndex((s) => String(s.name) === String(fields.sales_order ?? ""))
    if (idx !== -1) {
      const rows = (fullDoc(store[idx]).items as Record<string, unknown>[]).map((it) => {
        const target = items.find((i) => String(i.sales_order_item) === String(it.name))
        return target ? { ...it, reserve_stock: 1, stock_reserved_qty: Number(target.qty_to_reserve ?? it.qty) } : it
      })
      store[idx] = { ...store[idx], items: rows }
    }
    return HttpResponse.json({ message: "Stock reservations created" })
  }),

  http.post("/api/method/erpnext.selling.doctype.sales_order.sales_order.cancel_stock_reservation_entries", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const idx = store.findIndex((s) => String(s.name) === String(fields.sales_order ?? ""))
    if (idx !== -1) {
      const rows = (Array.isArray(store[idx].items) ? store[idx].items : []).map((it) => ({
        ...(it as Record<string, unknown>),
        stock_reserved_qty: 0,
      }))
      store[idx] = { ...store[idx], items: rows }
    }
    return HttpResponse.json({ message: "Stock reservations cancelled" })
  }),
]
