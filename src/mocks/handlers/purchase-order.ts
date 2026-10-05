import { localDateISO } from "@/lib/utils"
import { http, HttpResponse, delay } from "msw"
import { matchesFilterSet } from "./frappe-lookups"

// ── Purchase Order mock backend ─────────────────────────────────────
// Full ERPNext `Purchase Order` REST surface for the Purchases module:
//   GET    /api/resource/Purchase Order            → list (fields/filters/or_filters/order_by/limit)
//   GET    /api/resource/Purchase Order/:name      → single doc (items / taxes / totals)
//   POST   /api/resource/Purchase Order            → create
//   PUT    /api/resource/Purchase Order/:name      → update / submit
//   DELETE /api/resource/Purchase Order/:name      → delete
//   POST   frappe.desk.form.save.savedocs          → form create / save / submit
//   POST   frappe.desk.form.save.cancel            → cancel
//   POST   bulk_update.submit_cancel_or_update_docs→ bulk submit / cancel
//   POST   reportview.delete_items                 → bulk delete
//   POST   data_import.download_template           → export
//
// The three draft rows below are the fixture the dashboard's
// `fetchPendingPurchaseItems` depends on (list by docstatus=0, then the single
// doc's `items[].item_code`), so their names + items must stay exact.

interface PoItemRow {
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
  received_qty: number
  billed_qty: number
  returned_qty: number
  warehouse: string
  schedule_date: string
  is_free_item: number
  dnt_show_in_print: number
  doctype: "Purchase Order Item"
  parentfield: "items"
  parenttype: "Purchase Order"
  parent: string
  idx: number
}

function poItem(
  parent: string,
  idx: number,
  item: { item_code: string; item_name: string; qty: number; rate: number },
): PoItemRow {
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
    received_qty: 0,
    billed_qty: 0,
    returned_qty: 0,
    warehouse: "Main Warehouse",
    schedule_date: "",
    is_free_item: 0,
    dnt_show_in_print: 0,
    doctype: "Purchase Order Item",
    parentfield: "items",
    parenttype: "Purchase Order",
    parent,
    idx,
  }
}

function poItems(parent: string, codes: string[]): PoItemRow[] {
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
    return poItem(parent, i + 1, { item_code: code, item_name: seed.item_name, qty: seed.qty, rate: seed.rate })
  })
}

interface PurchaseOrderFixture {
  name: string
  supplier: string
  supplier_name: string
  supplier_group: string
  transaction_date: string
  schedule_date: string
  company: string
  currency: string
  status: string
  docstatus: number
  per_received: number
  per_billed: number
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

const draftItemCodes: Record<string, string[]> = {
  "PUR-ORD-2026-0001": ["PRD-001", "PRD-003", "PRD-008"],
  "PUR-ORD-2026-0002": ["PRD-005", "PRD-010"],
  "PUR-ORD-2026-0003": ["PRD-012", "PRD-014", "PRD-002"],
}

const fixtureSeed: PurchaseOrderFixture[] = [
  {
    name: "PUR-ORD-2026-0001", supplier: "SUP-00001", supplier_name: "Northwind Foods", supplier_group: "Distributor",
    transaction_date: "2026-07-02", schedule_date: "2026-07-16", company: "BlessERP Inc.", currency: "CAD",
    status: "Draft", docstatus: 0, per_received: 0, per_billed: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: draftItemCodes["PUR-ORD-2026-0001"],
    owner: "admin@blesserp.com", creation: "2026-07-02T10:15:00", modified: "2026-07-02T10:15:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "PUR-ORD-2026-0002", supplier: "SUP-00002", supplier_name: "Great Lakes Packaging", supplier_group: "Raw Material",
    transaction_date: "2026-07-04", schedule_date: "2026-07-18", company: "BlessERP Inc.", currency: "CAD",
    status: "Draft", docstatus: 0, per_received: 0, per_billed: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: draftItemCodes["PUR-ORD-2026-0002"],
    owner: "admin@blesserp.com", creation: "2026-07-04T10:00:00", modified: "2026-07-04T10:00:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "PUR-ORD-2026-0003", supplier: "SUP-00003", supplier_name: "Pacific Coast Seafood", supplier_group: "Raw Material",
    transaction_date: "2026-07-06", schedule_date: "2026-07-20", company: "BlessERP Inc.", currency: "CAD",
    status: "Draft", docstatus: 0, per_received: 0, per_billed: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: draftItemCodes["PUR-ORD-2026-0003"],
    owner: "admin@blesserp.com", creation: "2026-07-06T09:00:00", modified: "2026-07-06T09:00:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "PUR-ORD-2026-0004", supplier: "SUP-00004", supplier_name: "Prairie Grain Co.", supplier_group: "Raw Material",
    transaction_date: "2026-06-20", schedule_date: "2026-07-05", company: "BlessERP Inc.", currency: "CAD",
    status: "To Receive and Bill", docstatus: 1, per_received: 0, per_billed: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-008", "PRD-009"],
    owner: "admin@blesserp.com", creation: "2026-06-20T14:00:00", modified: "2026-06-20T14:05:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "PUR-ORD-2026-0005", supplier: "SUP-00001", supplier_name: "Northwind Foods", supplier_group: "Distributor",
    transaction_date: "2026-06-12", schedule_date: "2026-06-26", company: "BlessERP Inc.", currency: "CAD",
    status: "To Bill", docstatus: 1, per_received: 100, per_billed: 40,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-001", "PRD-002"],
    owner: "admin@blesserp.com", creation: "2026-06-12T09:30:00", modified: "2026-06-20T11:00:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "PUR-ORD-2026-0006", supplier: "SUP-00002", supplier_name: "Great Lakes Packaging", supplier_group: "Raw Material",
    transaction_date: "2026-06-08", schedule_date: "2026-06-22", company: "BlessERP Inc.", currency: "CAD",
    status: "To Receive", docstatus: 1, per_received: 40, per_billed: 100,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-006", "PRD-007"],
    owner: "admin@blesserp.com", creation: "2026-06-08T08:00:00", modified: "2026-06-15T13:45:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "PUR-ORD-2026-0007", supplier: "SUP-00003", supplier_name: "Pacific Coast Seafood", supplier_group: "Raw Material",
    transaction_date: "2026-05-28", schedule_date: "2026-06-12", company: "BlessERP Inc.", currency: "CAD",
    status: "Completed", docstatus: 1, per_received: 100, per_billed: 100,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-004", "PRD-005"],
    owner: "admin@blesserp.com", creation: "2026-05-28T10:00:00", modified: "2026-06-14T09:20:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "PUR-ORD-2026-0008", supplier: "SUP-00005", supplier_name: "Summit Logistics", supplier_group: "Services",
    transaction_date: "2026-06-25", schedule_date: "2026-07-10", company: "BlessERP Inc.", currency: "CAD",
    status: "On Hold", docstatus: 1, per_received: 20, per_billed: 20,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-012"],
    owner: "admin@blesserp.com", creation: "2026-06-25T15:30:00", modified: "2026-06-28T16:00:00", modified_by: "admin@blesserp.com",
  },
  {
    name: "PUR-ORD-2026-0009", supplier: "SUP-00004", supplier_name: "Prairie Grain Co.", supplier_group: "Raw Material",
    transaction_date: "2026-06-01", schedule_date: "2026-06-15", company: "BlessERP Inc.", currency: "CAD",
    status: "Cancelled", docstatus: 2, per_received: 0, per_billed: 0,
    cost_center: "Main - BE", set_warehouse: "Main Warehouse", buying_price_list: "Standard Buying",
    conversion_rate: 1, price_list_currency: "CAD", plc_conversion_rate: 1, item_codes: ["PRD-010", "PRD-014"],
    owner: "admin@blesserp.com", creation: "2026-06-01T11:00:00", modified: "2026-06-03T09:00:00", modified_by: "admin@blesserp.com",
  },
]

export interface PurchaseOrderStoreRow {
  name: string
  [key: string]: unknown
}

function buildDoc(seed: PurchaseOrderFixture): PurchaseOrderStoreRow {
  const items = poItems(seed.name, seed.item_codes)
  const total = items.reduce((sum, it) => sum + it.amount, 0)
  const taxAmount = Math.round(total * 0.13 * 100) / 100
  const row: Record<string, unknown> = {
    doctype: "Purchase Order",
    name: seed.name,
    naming_series: "PUR-ORD-2026-.####",
    supplier: seed.supplier,
    supplier_name: seed.supplier_name,
    supplier_group: seed.supplier_group,
    transaction_date: seed.transaction_date,
    schedule_date: seed.schedule_date,
    company: seed.company,
    currency: seed.currency,
    conversion_rate: seed.conversion_rate,
    price_list_currency: seed.price_list_currency,
    plc_conversion_rate: seed.plc_conversion_rate,
    buying_price_list: seed.buying_price_list,
    set_warehouse: seed.set_warehouse,
    cost_center: seed.cost_center,
    status: seed.status,
    docstatus: seed.docstatus,
    per_received: seed.per_received,
    per_billed: seed.per_billed,
    total_qty: items.reduce((sum, it) => sum + it.qty, 0),
    total,
    net_total: total,
    base_total: total,
    base_net_total: total,
    total_taxes_and_charges: taxAmount,
    base_total_taxes_and_charges: taxAmount,
    base_grand_total: total + taxAmount,
    base_rounding_adjustment: 0,
    base_rounded_total: total + taxAmount,
    basen_in_words: "",
    rounding_adjustment: 0,
    rounded_total: total + taxAmount,
    disable_rounded_total: 0,
    grand_total: total + taxAmount,
    advance_paid: 0,
    apply_discount_on: "Grand Total",
    additional_discount_percentage: 0,
    discount_amount: 0,
    base_discount_amount: 0,
    payment_terms_template: "",
    tc_name: "",
    terms: "",
    items,
    taxes: [
      {
        name: `${seed.name}-TAX-1`,
        charge_type: "On Net Total",
        account_head: "GST - BE",
        description: "GST 13%",
        rate: 13,
        tax_amount: taxAmount,
        total: total + taxAmount,
        included_in_print_rate: 0,
        category: "Total",
        idx: 1,
      },
    ],
    payment_schedule: [],
    pricing_rules: [],
    additional_taxes_and_charges: 0,
    other_charges_calculation: "",
    in_words: "",
    base_in_words: "",
    is_internal_supplier: 0,
    owner: seed.owner,
    creation: seed.creation,
    modified: seed.modified,
    modified_by: seed.modified_by,
    idx: 0,
  }
  return row as PurchaseOrderStoreRow
}

function cloneRow(row: PurchaseOrderStoreRow): PurchaseOrderStoreRow {
  return {
    ...row,
    items: ((row.items as unknown[]) ?? []).map((i) => ({ ...(i as Record<string, unknown>) })),
  }
}

let store: PurchaseOrderStoreRow[] = fixtureSeed.map((s) => buildDoc(s))
let poCounter = fixtureSeed.length + 1

// Snapshot used by server.ts (shared test server) on resetFixtures.
export const initialPurchaseOrders = store.map(cloneRow)

export function purchaseOrderStore(): PurchaseOrderStoreRow[] {
  return store
}

export function resetPurchaseOrders(): void {
  store = initialPurchaseOrders.map(cloneRow)
  poCounter = fixtureSeed.length + 1
}

export function countPurchaseOrders(filters: unknown[], orFilters: unknown[] = []): number {
  return store.filter((r) => matchesFilterSet(r, filters, orFilters, "Purchase Order")).length
}

function nowStamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19)
}

function safeJson<T>(val: string | undefined, fallback: T): T {
  if (val === undefined || val === "") return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

function parseQSParams(url: string) {
  const u = new URL(url, "http://localhost")
  return {
    filters: safeJson<unknown[]>(u.searchParams.get("filters") ?? "", []),
    orFilters: safeJson<unknown[]>(u.searchParams.get("or_filters") ?? "", []),
    orderBy: u.searchParams.get("order_by") ?? "",
    limitPageLength: Number(u.searchParams.get("limit_page_length") ?? "0"),
    limitStart: Number(u.searchParams.get("limit_start") ?? "0"),
  }
}

function fullDoc(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, doctype: "Purchase Order" }
}

function newRow(payload: Record<string, unknown>, action: "Save" | "Submit" | "Update"): PurchaseOrderStoreRow {
  const name = `PUR-ORD-2026-${String(poCounter).padStart(4, "0")}`
  poCounter += 1
  const rows = poItems(name, [] as string[])
  const stamp = nowStamp()
  const row: Record<string, unknown> = {
    doctype: "Purchase Order",
    name,
    naming_series: "PUR-ORD-2026-.####",
    supplier: String(payload.supplier ?? ""),
    supplier_name: String(payload.supplier_name ?? ""),
    transaction_date: String(payload.transaction_date ?? localDateISO(new Date())),
    schedule_date: String(payload.schedule_date ?? ""),
    company: String(payload.company ?? "BlessERP Inc."),
    currency: String(payload.currency ?? "CAD"),
    conversion_rate: 1,
    buying_price_list: String(payload.buying_price_list ?? "Standard Buying"),
    set_warehouse: String(payload.set_warehouse ?? ""),
    cost_center: String(payload.cost_center ?? "Main - BE"),
    status: action === "Submit" ? "To Receive and Bill" : "Draft",
    docstatus: action === "Submit" ? 1 : 0,
    per_received: 0,
    per_billed: 0,
    total_qty: 0,
    total: 0,
    net_total: 0,
    base_total: 0,
    base_net_total: 0,
    total_taxes_and_charges: 0,
    base_total_taxes_and_charges: 0,
    base_grand_total: 0,
    base_rounding_adjustment: 0,
    base_rounded_total: 0,
    rounding_adjustment: 0,
    rounded_total: 0,
    advance_paid: 0,
    items: rows,
    taxes: [],
    payment_schedule: [],
    pricing_rules: [],
    owner: "admin@blesserp.com",
    creation: stamp,
    modified: stamp,
    modified_by: "admin@blesserp.com",
    ...payload,
  }
  return fullDoc(row) as PurchaseOrderStoreRow
}

function parseForm(request: Request): Promise<Record<string, string>> {
  return request.formData().catch(() => new FormData()).then((fd) => {
    const out: Record<string, string> = {}
    fd.forEach((value, key) => { out[key] = String(value) })
    return out
  })
}

const targetDoctype = (method: string): string =>
  method.includes("make_purchase_invoice") ? "Purchase Invoice" : "Purchase Receipt"

export const purchaseOrderHandlers = [
  // ── List: GET /api/resource/Purchase Order ────────────────────────
  http.get("/api/resource/Purchase Order", async ({ request }) => {
    await delay(200)
    const { filters, orFilters, orderBy, limitPageLength, limitStart } = parseQSParams(request.url)
    let rows = filters.length > 0 || orFilters.length > 0
      ? store.filter((r) => matchesFilterSet(r, filters, orFilters, "Purchase Order"))
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

  // ── Single doc: GET /api/resource/Purchase Order/:name ────────────
  http.get("/api/resource/Purchase Order/:name", async ({ params }) => {
    await delay(150)
    const row = store.find((r) => String(r.name) === params.name)
    if (!row) return HttpResponse.json({ message: `Purchase Order ${String(params.name)} not found` }, { status: 404 })
    return HttpResponse.json({ data: fullDoc(row) })
  }),

  // ── Create: POST /api/resource/Purchase Order ─────────────────────
  http.post("/api/resource/Purchase Order", async ({ request }) => {
    await delay(250)
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const row = newRow(payload, "Save")
    store = [row, ...store]
    return HttpResponse.json({ data: row }, { status: 201 })
  }),

  // ── Update / submit: PUT /api/resource/Purchase Order/:name ───────
  http.put("/api/resource/Purchase Order/:name", async ({ params, request }) => {
    await delay(200)
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const idx = store.findIndex((r) => String(r.name) === params.name)
    if (idx === -1) return HttpResponse.json({ message: `Purchase Order ${String(params.name)} not found` }, { status: 404 })
    const prev = store[idx]
    const next: Record<string, unknown> = { ...prev, ...payload, modified: nowStamp() }
    if (Number(payload.docstatus) === 1 && Number(prev.docstatus) === 0) {
      next.docstatus = 1
      next.status = "To Receive and Bill"
    }
    store[idx] = next as PurchaseOrderStoreRow
    return HttpResponse.json({ data: fullDoc(next) })
  }),

  // ── Delete: DELETE /api/resource/Purchase Order/:name ─────────────
  http.delete("/api/resource/Purchase Order/:name", async ({ params }) => {
    await delay(150)
    store = store.filter((r) => String(r.name) !== params.name)
    return HttpResponse.json({ data: null })
  }),

  // ── Save / Submit / Update: frappe.desk.form.save.savedocs ────────
  http.post("/api/method/frappe.desk.form.save.savedocs", async ({ request }) => {
    await delay(250)
    const fields = await parseForm(request)
    const incoming = safeJson<Record<string, unknown>>(fields.doc ?? "", {})
    if (incoming.doctype && String(incoming.doctype) !== "Purchase Order") {
      return HttpResponse.json({ message: `Unhandled ${fields.action ?? "Save"} for ${String(incoming.doctype ?? "")}` }, { status: 404 })
    }
    const action = (fields.action ?? "Save") as "Save" | "Submit" | "Update"
    const existingName = String(incoming.name ?? "")
    const idx = store.findIndex((r) => String(r.name) === existingName)

    let doc: Record<string, unknown>
    if (idx === -1) {
      doc = newRow(incoming, action)
      store = [doc as PurchaseOrderStoreRow, ...store]
    } else {
      const prev = store[idx]
      const merged: Record<string, unknown> = { ...prev, ...incoming, modified: nowStamp() }
      if (action === "Submit") {
        merged.docstatus = 1
        merged.status = "To Receive and Bill"
      } else if (Number(incoming.docstatus) === 2) {
        merged.docstatus = 2
        merged.status = "Cancelled"
      } else {
        merged.docstatus = Number(prev.docstatus) === 1 ? prev.docstatus : merged.docstatus
        merged.status = Number(merged.docstatus) === 1 ? (String(prev.status) || "To Receive and Bill") : merged.status
      }
      store[idx] = merged as PurchaseOrderStoreRow
      doc = fullDoc(merged)
    }

    return HttpResponse.json({ message: "Saved", docs: [doc] })
  }),

  // ── Cancel: frappe.desk.form.save.cancel ──────────────────────────
  http.post("/api/method/frappe.desk.form.save.cancel", async ({ request }) => {
    await delay(200)
    const fields = await parseForm(request)
    const name = String(fields.name ?? fields.docname ?? "")
    const idx = store.findIndex((r) => String(r.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Purchase Order ${name} not found` }, { status: 404 })
    const row = store[idx]
    if (Number(row.docstatus) !== 1) {
      return HttpResponse.json({
        message: `Purchase Order ${name} cannot be cancelled because it is not submitted`,
        _server_messages: JSON.stringify([
          { message: `Purchase Order ${name} cannot be cancelled because it is not submitted`, title: "Message", indicator: "red", raise_exception: 1 },
        ]),
      }, { status: 417 })
    }
    const next = { ...row, docstatus: 2, status: "Cancelled", modified: nowStamp() }
    store[idx] = next
    return HttpResponse.json({ message: "Cancelled" })
  }),

  // ── Bulk submit/cancel via bulk_update ────────────────────────────
  http.post("/api/method/frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", async ({ request }) => {
    await delay(200)
    const body = await parseForm(request)
    if (body.doctype !== "Purchase Order") return HttpResponse.json({ message: [] })
    const names = safeJson(body.docnames ?? "[]", []) as string[]
    const action = body.action ?? "submit"
    const failed: string[] = []
    for (const name of names) {
      const idx = store.findIndex((r) => String(r.name) === name)
      if (idx === -1) { failed.push(name); continue }
      const row = store[idx]
      if (action === "submit") {
        if (Number(row.docstatus) === 1) continue
        store[idx] = { ...row, docstatus: 1, status: "To Receive and Bill", modified: nowStamp() }
      } else if (action === "cancel") {
        if (Number(row.docstatus) === 2) continue
        store[idx] = { ...row, docstatus: 2, status: "Cancelled", modified: nowStamp() }
      }
    }
    if (failed.length > 0) return HttpResponse.json({ message: failed })
    return HttpResponse.json({ message: null })
  }),

  // ── Bulk delete via reportview.delete_items ───────────────────────
  http.post("/api/method/frappe.desk.reportview.delete_items", async ({ request }) => {
    await delay(200)
    const body = await parseForm(request)
    if (body.doctype !== "Purchase Order") return HttpResponse.json({ message: null })
    const items = safeJson(body.items ?? "[]", []) as string[]
    const failed = items.filter((name) => !store.some((r) => String(r.name) === name))
    store = store.filter((r) => !items.includes(String(r.name)))
    if (failed.length > 0) return HttpResponse.json({ message: { undeleted_items: failed } })
    return HttpResponse.json({ message: null })
  }),

  // ── Export via data_import.download_template ─────────────────────
  http.post("/api/method/frappe.core.doctype.data_import.data_import.download_template", async ({ request }) => {
    await delay(300)
    const body = await parseForm(request)
    const doctype = String(body.doctype ?? "Purchase Order")
    const fields = safeJson(body.export_fields ?? "{}", {}) as Record<string, string[]>
    const parentFields = (fields[doctype] ?? (fields["Purchase Order"] ?? ["name"])) as string[]
    const header = parentFields.join(",")
    const csv = `${header}\r\n${parentFields.map(() => "value").join(",")}\r\n`
    return new HttpResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    })
  }),

  // ── Make-doc workflow: frappe.model.mapper.make_mapped_doc ─────────
  // Receipt / Invoice mappers return an UNSAVED prefilled target doc dict (no
  // server name) — exactly like ERPNext's open_mapped_doc contract.
  http.post("/api/method/frappe.model.mapper.make_mapped_doc", async ({ request }) => {
    await delay(200)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const method = String(body.method ?? "")
    const sourceName = String(body.source_name ?? "")
    const row = store.find((r) => String(r.name) === sourceName)
    const isInvoice = targetDoctype(method) === "Purchase Invoice"
    const today = localDateISO(new Date())
    const prefix = isInvoice ? "PUR-INV" : "PUR-REC"
    const target = row
      ? {
          doctype: targetDoctype(method),
          supplier: row.supplier,
          supplier_name: row.supplier_name,
          company: row.company,
          currency: row.currency,
          naming_series: `${prefix}-.YYYY.-`,
          transaction_date: today,
          posting_date: today,
          ...(isInvoice ? { due_date: today } : {}),
          items: Array.isArray(row.items)
            ? (row.items as Array<Record<string, unknown>>).map((it) => ({
                item_code: it.item_code,
                item_name: it.item_name,
                qty: Number(it.qty) || 0,
                rate: Number(it.rate) || 0,
                amount: Number(it.amount) || 0,
                uom: it.uom ?? "Nos",
                stock_uom: it.stock_uom ?? "Nos",
                conversion_factor: Number(it.conversion_factor) || 1,
                warehouse: it.warehouse ?? "",
                doctype: isInvoice ? "Purchase Invoice Item" : "Purchase Receipt Item",
                parentfield: "items",
                parenttype: targetDoctype(method),
                ...(isInvoice
                  ? {
                      purchase_order: sourceName,
                      purchase_order_item: `${sourceName}-ITEM-${(it.idx ?? 1)}`,
                    }
                  : {}),
                granted_qty: Number(it.qty) || 0,
              }))
            : [],
          taxes: [],
          status: "Draft",
          docstatus: 0,
        }
      : {}
    return HttpResponse.json({ message: target })
  }),
]