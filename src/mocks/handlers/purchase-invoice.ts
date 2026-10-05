import { localDateISO } from "@/lib/utils"
import { http, HttpResponse, delay } from "msw"
import { matchesFilterSet } from "./frappe-lookups"

// ── Purchase Invoice mock backend ───────────────────────────────────
// Full ERPNext `Purchase Invoice` REST surface for the Bills module:
//   GET    /api/resource/Purchase Invoice            → list (fields/filters/or_filters/order_by/limit)
//   GET    /api/resource/Purchase Invoice/:name      → single doc (items / taxes / totals / outstanding)
//   POST   /api/resource/Purchase Invoice            → create
//   PUT    /api/resource/Purchase Invoice/:name      → update / submit
//   DELETE /api/resource/Purchase Invoice/:name      → delete
//   POST   frappe.desk.form.save.savedocs            → form create / save / submit
//   POST   frappe.desk.form.save.cancel              → cancel
//   POST   bulk_update.submit_cancel_or_update_docs  → bulk submit / cancel
//   POST   reportview.delete_items                   → bulk delete
//   POST   data_import.download_template             → export
//
// Outstanding / paid mirrors ERPNext: submitted rows carry `outstanding_amount`
// and `paid_amount` set server-side as payments/receipts are reconciled.

interface PInvItemRow {
  name: string
  item_code: string
  item_name: string
  description: string
  item_group: string
  brand: string
  qty: number
  converted_qty: number
  stock_qty: number
  uom: string
  stock_uom: string
  conversion_factor: number
  rate: number
  price_list_rate: number
  amount: number
  base_rate: number
  base_amount: number
  net_rate: number
  net_amount: number
  base_net_rate: number
  base_net_amount: number
  discount_percentage: number
  discount_amount: number
  warehouse: string
  expense_account: string
  cost_center: string
  project: string
  purchase_order: string
  purchase_order_item: string
  is_free_item: number
  doctype: "Purchase Invoice Item"
  parentfield: "items"
  parenttype: "Purchase Invoice"
  parent: string
  idx: number
}

function pinvItem(
  parent: string,
  idx: number,
  item: { item_code: string; item_name: string; qty: number; rate: number },
): PInvItemRow {
  return {
    name: `${parent}-ITEM-${idx}`,
    item_code: item.item_code,
    item_name: item.item_name,
    description: item.item_name,
    item_group: "Raw Material",
    brand: "",
    qty: item.qty,
    converted_qty: item.qty,
    stock_qty: item.qty,
    uom: "Nos",
    stock_uom: "Nos",
    conversion_factor: 1,
    rate: item.rate,
    price_list_rate: item.rate,
    amount: Math.round(item.qty * item.rate * 100) / 100,
    base_rate: item.rate,
    base_amount: Math.round(item.qty * item.rate * 100) / 100,
    net_rate: item.rate,
    net_amount: Math.round(item.qty * item.rate * 100) / 100,
    base_net_rate: item.rate,
    base_net_amount: Math.round(item.qty * item.rate * 100) / 100,
    discount_percentage: 0,
    discount_amount: 0,
    warehouse: "Main Warehouse",
    expense_account: "Purchases - BE",
    cost_center: "Main - BE",
    project: "",
    purchase_order: "",
    purchase_order_item: "",
    is_free_item: 0,
    doctype: "Purchase Invoice Item",
    parentfield: "items",
    parenttype: "Purchase Invoice",
    parent,
    idx,
  }
}

function pinvItems(parent: string, codes: string[]): PInvItemRow[] {
  const catalog: Record<string, { item_name: string; qty: number; rate: number }> = {
    "PRD-001": { item_name: "Organic All-Purpose Flour", qty: 20, rate: 12.5 },
    "PRD-002": { item_name: "Cold-Pressed Canola Oil", qty: 12, rate: 18.75 },
    "PRD-003": { item_name: "Wild Blueberry Jam", qty: 30, rate: 9.4 },
    "PRD-004": { item_name: "Atlantic Smoked Salmon", qty: 8, rate: 27.9 },
    "PRD-005": { item_name: "Maple Syrup (Grade A)", qty: 24, rate: 14.25 },
    "PRD-006": { item_name: "Golden Wheat Flour", qty: 15, rate: 11.2 },
    "PRD-007": { item_name: "Raw Cane Sugar", qty: 40, rate: 7.6 },
    "PRD-008": { item_name: "Packaging Bags (Bio)", qty: 100, rate: 3.85 },
    "PRD-009": { item_name: "Corrugated Cartons", qty: 60, rate: 4.5 },
    "PRD-010": { item_name: "Cheesecloth Rolls", qty: 18, rate: 16.4 },
    "PRD-012": { item_name: "Sea Salt (Fine)", qty: 22, rate: 6.8 },
    "PRD-014": { item_name: "Wooden Pallets", qty: 26, rate: 21.3 },
  }
  return codes.map((code, i) => {
    const seed = catalog[code] ?? { item_name: code, qty: 10, rate: 10 }
    return pinvItem(parent, i + 1, { item_code: code, item_name: seed.item_name, qty: seed.qty, rate: seed.rate })
  })
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

interface PurchaseInvoiceFixture {
  name: string
  supplier: string
  supplier_name: string
  supplier_group: string
  posting_date: string
  due_date: string
  company: string
  currency: string
  status: string
  docstatus: number
  /** 0..1 share of grand_total already paid (submitted rows). */
  paid_fraction: number
  cost_center: string
  set_warehouse: string
  buying_price_list: string
  conversion_rate: number
  price_list_currency: string
  plc_conversion_rate: number
  item_codes: string[]
  owner: string
  creation: string
  modified: string
  modified_by: string
}

const fixtureSeed: PurchaseInvoiceFixture[] = [
  {
    name: "ACC-PINV-2026-0001", supplier: "SUP-00001", supplier_name: "Northwind Foods", supplier_group: "Distributor",
    posting_date: "2026-07-05", due_date: "2026-07-20", company: "BlessERP Inc.", currency: "CAD",
    status: "Draft", docstatus: 0, paid_fraction: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-001", "PRD-003"],
    owner: "admin@blesserp.com", creation: "2026-07-05T09:00:00", modified: "2026-07-05T09:00:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "ACC-PINV-2026-0002", supplier: "SUP-00002", supplier_name: "Great Lakes Packaging", supplier_group: "Raw Material",
    posting_date: "2026-07-08", due_date: "2026-07-23", company: "BlessERP Inc.", currency: "CAD",
    status: "Draft", docstatus: 0, paid_fraction: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-008", "PRD-009"],
    owner: "admin@blesserp.com", creation: "2026-07-08T10:15:00", modified: "2026-07-08T10:15:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "ACC-PINV-2026-0003", supplier: "SUP-00003", supplier_name: "Pacific Coast Seafood", supplier_group: "Raw Material",
    posting_date: "2026-07-10", due_date: "2026-07-25", company: "BlessERP Inc.", currency: "CAD",
    status: "Draft", docstatus: 0, paid_fraction: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-012", "PRD-002"],
    owner: "admin@blesserp.com", creation: "2026-07-10T11:00:00", modified: "2026-07-10T11:00:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "ACC-PINV-2026-0004", supplier: "SUP-00002", supplier_name: "Great Lakes Packaging", supplier_group: "Raw Material",
    posting_date: "2026-06-20", due_date: "2026-07-05", company: "BlessERP Inc.", currency: "CAD",
    status: "Not Paid", docstatus: 1, paid_fraction: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-006", "PRD-007"],
    owner: "admin@blesserp.com", creation: "2026-06-20T14:00:00", modified: "2026-06-20T14:05:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "ACC-PINV-2026-0005", supplier: "SUP-00001", supplier_name: "Northwind Foods", supplier_group: "Distributor",
    posting_date: "2026-06-12", due_date: "2026-06-27", company: "BlessERP Inc.", currency: "CAD",
    status: "Partly Paid", docstatus: 1, paid_fraction: 0.4,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-001", "PRD-002"],
    owner: "admin@blesserp.com", creation: "2026-06-12T09:30:00", modified: "2026-06-22T11:00:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "ACC-PINV-2026-0006", supplier: "SUP-00003", supplier_name: "Pacific Coast Seafood", supplier_group: "Raw Material",
    posting_date: "2026-06-08", due_date: "2026-06-23", company: "BlessERP Inc.", currency: "CAD",
    status: "Paid", docstatus: 1, paid_fraction: 1,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-004", "PRD-005"],
    owner: "admin@blesserp.com", creation: "2026-06-08T08:00:00", modified: "2026-06-15T13:45:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "ACC-PINV-2026-0007", supplier: "SUP-00005", supplier_name: "Summit Logistics", supplier_group: "Services",
    posting_date: "2026-08-01", due_date: "2026-08-20", company: "BlessERP Inc.", currency: "CAD",
    status: "Overdue", docstatus: 1, paid_fraction: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-012"],
    owner: "admin@blesserp.com", creation: "2026-08-01T15:30:00", modified: "2026-08-05T16:00:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "ACC-PINV-2026-0008", supplier: "SUP-00004", supplier_name: "Prairie Grain Co.", supplier_group: "Raw Material",
    posting_date: "2026-05-30", due_date: "2026-06-15", company: "BlessERP Inc.", currency: "CAD",
    status: "Cancelled", docstatus: 2, paid_fraction: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-005", "PRD-010"],
    owner: "admin@blesserp.com", creation: "2026-05-30T10:00:00", modified: "2026-06-01T09:20:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "ACC-PINV-2026-0009", supplier: "SUP-00001", supplier_name: "Northwind Foods", supplier_group: "Distributor",
    posting_date: "2026-06-02", due_date: "2026-06-17", company: "BlessERP Inc.", currency: "CAD",
    status: "Not Paid", docstatus: 1, paid_fraction: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-006"],
    owner: "admin@blesserp.com", creation: "2026-06-02T12:00:00", modified: "2026-06-02T12:10:00", modified_by: "admin@blesserp.com",
  },
]

export interface PurchaseInvoiceStoreRow extends Record<string, unknown> {
  name: string
  supplier: string
  supplier_name: string
  posting_date: string
  due_date: string
  company: string
  currency: string
  status: string
  docstatus: number
  purchase_order: string
  items: PInvItemRow[]
  grand_total: number
  outstanding_amount: number
  paid_amount: number
  total_qty: number
}

function fullDoc(seed: PurchaseInvoiceFixture): Record<string, unknown> {
  const items = pinvItems(seed.name, seed.item_codes)
  const total = round2(items.reduce((sum, it) => sum + it.amount, 0))
  const taxAmount = round2(total * 0.13)
  const grandTotal = round2(total + taxAmount)
  const paidAmount = round2(grandTotal * seed.paid_fraction)
  const doc: Record<string, unknown> = {
    doctype: "Purchase Invoice",
    name: seed.name,
    naming_series: "ACC-PINV-.YYYY.-",
    supplier: seed.supplier,
    supplier_name: seed.supplier_name,
    posting_date: seed.posting_date,
    due_date: seed.due_date,
    company: seed.company,
    currency: seed.currency,
    conversion_rate: seed.conversion_rate,
    price_list_currency: seed.price_list_currency,
    plc_conversion_rate: seed.plc_conversion_rate,
    total_qty: items.reduce((sum, it) => sum + it.qty, 0),
    total,
    net_total: total,
    base_total: total,
    base_net_total: total,
    total_taxes_and_charges: taxAmount,
    base_total_taxes_and_charges: taxAmount,
    grand_total: grandTotal,
    base_grand_total: grandTotal,
    base_rounding_adjustment: 0,
    base_rounded_total: grandTotal,
    rounding_adjustment: 0,
    rounded_total: grandTotal,
    disable_rounded_total: 0,
    outstanding_amount: round2(grandTotal - paidAmount),
    paid_amount: paidAmount,
    apply_discount_on: "Grand Total",
    additional_discount_percentage: 0,
    discount_amount: 0,
    base_discount_amount: 0,
    payment_terms_template: "",
    set_warehouse: seed.set_warehouse,
    cost_center: seed.cost_center,
    buying_price_list: seed.buying_price_list,
    status: seed.status,
    docstatus: seed.docstatus,
    purchase_order: "",
    items: items.map((i) => ({ ...i })),
    taxes: [
      {
        doctype: "Purchase Taxes and Charges",
        name: `${seed.name}-TAX-1`,
        charge_type: "On Net Total",
        account_head: "GST - BE",
        description: "GST 13%",
        rate: 13,
        tax_amount: taxAmount,
        total: grandTotal,
        included_in_print_rate: 0,
        category: "Total",
        parent: seed.name,
        parentfield: "taxes",
        parenttype: "Purchase Invoice",
        idx: 1,
      },
    ],
    payment_schedule: [],
    pricing_rules: [],
    is_internal_supplier: 0,
    owner: seed.owner,
    creation: seed.creation,
    modified: seed.modified,
    modified_by: seed.modified_by,
    idx: 0,
  }
  return doc as PurchaseInvoiceStoreRow
}

function newRow(payload: Record<string, unknown>, action: string): PurchaseInvoiceStoreRow {
  const parent = String(payload.name && payload.name !== "new-purchase-invoice" ? payload.name : "")
  const codes = Array.isArray(payload.item_codes)
    ? (payload.item_codes as string[])
    : Array.isArray(payload.items)
      ? (payload.items as Array<{ item_code?: string }>)
          .map((i) => String(i.item_code ?? ""))
          .filter(Boolean)
      : []
  const supplier = String(payload.supplier ?? "")
  const supplier_name = String(payload.supplier_name ?? payload.supplier ?? "")
  const postingDate = String(payload.posting_date ?? localDateISO(new Date()))
  const dueDate = String(payload.due_date ?? "")
  const base = {
    ...payload,
    name: parent,
    supplier,
    supplier_name,
    posting_date: postingDate,
    due_date: dueDate,
    company: String(payload.company ?? "BlessERP Inc."),
    currency: String(payload.currency ?? "CAD"),
    set_warehouse: String(payload.set_warehouse ?? "Main Warehouse"),
    cost_center: String(payload.cost_center ?? "Main - BE"),
    buying_price_list: String(payload.buying_price_list ?? "Standard Buying"),
    conversion_rate: Number(payload.conversion_rate) || 1,
    price_list_currency: String(payload.currency ?? "CAD"),
    plc_conversion_rate: Number(payload.conversion_rate) || 1,
  }
  const items = "items" in payload && Array.isArray(payload.items) && (payload.items as unknown[]).length > 0 && typeof (payload.items as Array<Record<string, unknown>>)[0]?.item_code === "string"
    ? (payload.items as Array<Record<string, unknown>>).map((i, idx) => pinvItem(parent, idx + 1, {
        item_code: String(i.item_code ?? ""),
        item_name: String(i.item_name ?? i.item_code ?? ""),
        qty: Number(i.qty) || 0,
        rate: Number(i.rate) || 0,
      }))
    : pinvItems(parent, codes)
  const total = round2(items.reduce((sum, it) => sum + it.amount, 0))
  const taxAmount = round2(total * 0.13)
  const grandTotal = round2(total + taxAmount)
  const submitted = action === "Submit"
  return {
    ...base,
    total_qty: items.reduce((sum, it) => sum + it.qty, 0),
    total,
    net_total: total,
    base_total: total,
    base_net_total: total,
    total_taxes_and_charges: taxAmount,
    base_total_taxes_and_charges: taxAmount,
    grand_total: grandTotal,
    base_grand_total: grandTotal,
    rounded_total: grandTotal,
    base_rounded_total: grandTotal,
    outstanding_amount: submitted ? grandTotal : grandTotal,
    paid_amount: 0,
    status: submitted ? "Not Paid" : "Draft",
    docstatus: submitted ? 1 : 0,
    purchase_order: "",
    items,
    taxes: [
      {
        doctype: "Purchase Taxes and Charges",
        name: `${parent}-TAX-1`,
        charge_type: "On Net Total",
        account_head: "GST - BE",
        description: "GST 13%",
        rate: 13,
        tax_amount: taxAmount,
        total: grandTotal,
        included_in_print_rate: 0,
        category: "Total",
        parent,
        parentfield: "taxes",
        parenttype: "Purchase Invoice",
        idx: 1,
      },
    ],
    payment_schedule: [],
    owner: "admin@blesserp.com",
    modified: nowStamp(),
  } as PurchaseInvoiceStoreRow
}

function cloneRow(row: PurchaseInvoiceStoreRow): PurchaseInvoiceStoreRow {
  return {
    ...row,
    items: ((row.items as unknown[]) ?? []).map((i) => ({ ...(i as Record<string, unknown>) })) as unknown as PInvItemRow[],
  }
}

let store: PurchaseInvoiceStoreRow[] = fixtureSeed.map((s) => fullDoc(s) as unknown as PurchaseInvoiceStoreRow)
let pinvCounter = fixtureSeed.length + 1

// Snapshot used by server.ts (shared test server) on resetFixtures.
export const initialPurchaseInvoices = store.map(cloneRow)

export function purchaseInvoiceStore(): PurchaseInvoiceStoreRow[] {
  return store
}

export function resetPurchaseInvoices(): void {
  store = initialPurchaseInvoices.map(cloneRow)
  pinvCounter = fixtureSeed.length + 1
}

export function countPurchaseInvoices(filters: unknown[], orFilters: unknown[] = []): number {
  return store.filter((r) => matchesFilterSet(r, filters, orFilters, "Purchase Invoice")).length
}

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  try { return JSON.parse(value ?? "") as T } catch { return fallback }
}

function nowStamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19)
}

function parseForm(request: Request): Promise<Record<string, unknown>> {
  return request.formData().catch(() => new FormData()).then((fd) => {
    const out: Record<string, unknown> = {}
    fd.forEach((value, key) => { out[key] = value })
    return out
  })
}

function parseQSParams(url: string): {
  filters: unknown[]
  orFilters: unknown[]
  orderBy: string
  limitPageLength: number
  limitStart: number
} {
  const qp = new URL(url).searchParams
  const safe = (raw: string | null): unknown[] => (raw ? safeJson(raw, []) as unknown[] : [])
  return {
    filters: safe(qp.get("filters")),
    orFilters: safe(qp.get("or_filters")),
    orderBy: String(qp.get("order_by") ?? ""),
    limitPageLength: Number(qp.get("limit_page_length")) || 0,
    limitStart: Number(qp.get("limit_start")) || 0,
  }
}

export const purchaseInvoiceHandlers = [
  // ── List: GET /api/resource/Purchase Invoice ──────────────────────
  http.get("/api/resource/Purchase Invoice", async ({ request }) => {
    await delay(200)
    const { filters, orFilters, orderBy, limitPageLength, limitStart } = parseQSParams(request.url)
    let rows = filters.length > 0 || orFilters.length > 0
      ? store.filter((r) => matchesFilterSet(r, filters, orFilters, "Purchase Invoice"))
      : [...store]
    if (orderBy) {
      const [field, dir] = orderBy.trim().split(/\s+/, 2)
      const mult = (dir ?? "desc").toLowerCase() === "asc" ? 1 : -1
      rows = [...rows].sort((a, b) => {
        const av = a[field]
        const bv = b[field]
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult
        return String(av ?? "").localeCompare(String(bv ?? "")) * mult
      })
    }
    if (limitPageLength > 0) rows = rows.slice(limitStart, limitStart + limitPageLength)
    return HttpResponse.json({ data: rows })
  }),

  // ── Single doc: GET /api/resource/Purchase Invoice/:name ──────────
  http.get("/api/resource/Purchase Invoice/:name", async ({ params }) => {
    await delay(150)
    const row = store.find((r) => String(r.name) === params.name)
    if (!row) return HttpResponse.json({ message: `Purchase Invoice ${String(params.name)} not found` }, { status: 404 })
    return HttpResponse.json({ data: row })
  }),

  // ── Create: POST /api/resource/Purchase Invoice ───────────────────
  http.post("/api/resource/Purchase Invoice", async ({ request }) => {
    await delay(250)
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const row = newRow(payload, "Save")
    store = [row, ...store]
    return HttpResponse.json({ data: row }, { status: 201 })
  }),

  // ── Update / submit: PUT /api/resource/Purchase Invoice/:name ─────
  http.put("/api/resource/Purchase Invoice/:name", async ({ params, request }) => {
    await delay(200)
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const idx = store.findIndex((r) => String(r.name) === params.name)
    if (idx === -1) return HttpResponse.json({ message: `Purchase Invoice ${String(params.name)} not found` }, { status: 404 })
    const row = store[idx]
    const next: Record<string, unknown> = { ...row, ...payload }
    if (payload.docstatus === 1) {
      next.docstatus = 1
      next.status = "Not Paid"
      next.outstanding_amount = row.grand_total
      next.paid_amount = 0
    }
    store[idx] = next as PurchaseInvoiceStoreRow
    return HttpResponse.json({ data: store[idx] })
  }),

  // ── Delete: DELETE /api/resource/Purchase Invoice/:name ───────────
  http.delete("/api/resource/Purchase Invoice/:name", async ({ params }) => {
    await delay(200)
    store = store.filter((r) => String(r.name) !== params.name)
    return HttpResponse.json({ message: "ok" })
  }),

  // ── Save / Submit / Update: frappe.desk.form.save.savedocs ────────
  http.post("/api/method/frappe.desk.form.save.savedocs", async ({ request }) => {
    await delay(200)
    const fields = await parseForm(request)
    if (String(fields.doctype) !== "" && String(fields.doctype) !== "Purchase Invoice") {
      return HttpResponse.json({ message: "ok" })
    }
    const payload = safeJson(String(fields.doc ?? ""), {}) as Record<string, unknown>
    const action = String(fields.action ?? "Save")
    const merged = { ...payload }
    if (merged.name === "" || merged.name === "new-purchase-invoice") {
      const nextName = `ACC-PINV-2026-${String(pinvCounter).padStart(4, "0")}`
      pinvCounter += 1
      merged.name = nextName
    }
    const exists = store.some((r) => String(r.name) === String(merged.name))
    const row = newRow({ ...merged, name: merged.name }, action)
    if (exists) {
      const idx = store.findIndex((r) => String(r.name) === row.name)
      store[idx] = { ...store[idx], ...row } as PurchaseInvoiceStoreRow
    } else {
      store = [row, ...store]
    }
    const doc = store.find((r) => String(r.name) === String(merged.name))
    return HttpResponse.json({ message: "Saved", docs: [doc] })
  }),

  // ── Cancel: frappe.desk.form.save.cancel ──────────────────────────
  http.post("/api/method/frappe.desk.form.save.cancel", async ({ request }) => {
    await delay(200)
    const fields = await parseForm(request)
    const name = String(fields.name ?? fields.docname ?? "")
    const idx = store.findIndex((r) => String(r.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Purchase Invoice ${name} not found` }, { status: 404 })
    const row = store[idx]
    if (Number(row.docstatus) !== 1) {
      return HttpResponse.json({
        message: `Purchase Invoice ${name} cannot be cancelled because it is not submitted`,
        _server_messages: JSON.stringify([
          { message: `Purchase Invoice ${name} cannot be cancelled because it is not submitted`, title: "Message", indicator: "red", raise_exception: 1 },
        ]),
      }, { status: 417 })
    }
    const next = { ...row, docstatus: 2, status: "Cancelled", modified: nowStamp() }
    store[idx] = next as PurchaseInvoiceStoreRow
    return HttpResponse.json({ message: "Cancelled" })
  }),

  // ── Bulk submit/cancel via bulk_update ────────────────────────────
  http.post("/api/method/frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", async ({ request }) => {
    await delay(200)
    const body = await parseForm(request)
    if (body.doctype !== "Purchase Invoice") return HttpResponse.json({ message: [] })
    const names = safeJson(String(body.docnames ?? "[]"), []) as string[]
    const action = body.action ?? "submit"
    const failed: string[] = []
    for (const name of names) {
      const idx = store.findIndex((r) => String(r.name) === name)
      if (idx === -1) { failed.push(name); continue }
      const row = store[idx]
      if (action === "submit") {
        if (Number(row.docstatus) === 1) continue
        store[idx] = { ...row, docstatus: 1, status: "Not Paid", outstanding_amount: row.grand_total, paid_amount: 0, modified: nowStamp() } as PurchaseInvoiceStoreRow
      } else if (action === "cancel") {
        if (Number(row.docstatus) === 2) continue
        store[idx] = { ...row, docstatus: 2, status: "Cancelled", modified: nowStamp() } as PurchaseInvoiceStoreRow
      }
    }
    if (failed.length > 0) return HttpResponse.json({ message: failed })
    return HttpResponse.json({ message: null })
  }),

  // ── Bulk delete via reportview.delete_items ───────────────────────
  http.post("/api/method/frappe.desk.reportview.delete_items", async ({ request }) => {
    await delay(200)
    const body = await parseForm(request)
    if (body.doctype !== "Purchase Invoice") return HttpResponse.json({ message: null })
    const items = safeJson(String(body.items ?? "[]"), []) as string[]
    const failed = items.filter((name) => !store.some((r) => String(r.name) === name))
    store = store.filter((r) => !items.includes(String(r.name)))
    if (failed.length > 0) return HttpResponse.json({ message: { undeleted_items: failed } })
    return HttpResponse.json({ message: null })
  }),

  // ── Export via data_import.download_template ─────────────────────
  http.post("/api/method/frappe.core.doctype.data_import.data_import.download_template", async ({ request }) => {
    await delay(300)
    const body = await parseForm(request)
    const doctype = String(body.doctype ?? "Purchase Invoice")
    const fields = safeJson(String(body.export_fields ?? "{}"), {}) as Record<string, string[]>
    const parentFields = (fields[doctype] ?? (fields["Purchase Invoice"] ?? ["name"])) as string[]
    const header = parentFields.join(",")
    const csv = `${header}\r\n${parentFields.map(() => "value").join(",")}\r\n`
    return new HttpResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    })
  }),
]