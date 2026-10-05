import { http, HttpResponse, delay } from "msw"

// ── Suppliers (ERPNext Supplier doctype) ──────────────────────────────
export interface MockSupplier {
  name: string
  naming_series?: string
  supplier_name: string
  supplier_group: string
  supplier_type: "Company" | "Individual"
  territory?: string
  country?: string
  company?: string
  currency?: string
  is_group?: number
  is_internal_supplier?: number
  supplier_primary_address?: string
  supplier_primary_contact?: string
  supplier_details?: string
  website?: string
  language?: string
  email_id?: string
  mobile_no?: string
  first_name?: string
  last_name?: string
  tax_id?: string
  tax_category?: string
  tax_withholding_category?: string
  payment_terms?: string
  advance_account?: string
  on_hold?: number
  on_hold_until?: string
  hold_type?: "All" | "Purchase Orders" | "Purchase Invoices" | "Payments"
  disabled?: number
  default_payable_accounts?: Array<{ company: string; account: string }>
  creation: string
  modified: string
}

let suppliers: MockSupplier[] = [
  {
    name: "SUP-00001", supplier_name: "Northwind Foods", supplier_group: "Distributor", supplier_type: "Company",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    supplier_primary_address: "SUP-ADDR-0001", supplier_primary_contact: "SUP-CON-0001",
    website: "https://northwindfoods.ca", email_id: "sales@northwindfoods.ca", mobile_no: "+1 416-555-2101",
    tax_id: "RT111222333", tax_category: "GST", payment_terms: "Net 30", advance_account: "",
    on_hold: 0, disabled: 0,
    default_payable_accounts: [{ company: "BlessERP Inc.", account: "Creditors - BE" }],
    creation: "2024-01-10 09:00:00", modified: "2026-06-20 11:00:00",
  },
  {
    name: "SUP-00002", supplier_name: "Great Lakes Packaging", supplier_group: "Raw Material", supplier_type: "Company",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    supplier_primary_address: "SUP-ADDR-0002", supplier_primary_contact: "SUP-CON-0002",
    website: "https://greatlakespackaging.ca", email_id: "orders@greatlakespackaging.ca", mobile_no: "+1 519-555-2102",
    tax_id: "RT333444555", tax_category: "GST", payment_terms: "Net 45", advance_account: "",
    on_hold: 1, on_hold_until: "2026-10-01", hold_type: "All", disabled: 0,
    default_payable_accounts: [{ company: "BlessERP Inc.", account: "Creditors - BE" }],
    creation: "2023-11-05 08:30:00", modified: "2026-07-01 14:00:00",
  },
  {
    name: "SUP-00003", supplier_name: "Pacific Coast Seafood", supplier_group: "Raw Material", supplier_type: "Company",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    supplier_primary_address: "SUP-ADDR-0003", supplier_primary_contact: "SUP-CON-0003",
    website: "https://pacificcoastseafood.ca", email_id: "info@pacificcoastseafood.ca", mobile_no: "+1 604-555-2103",
    tax_id: "RT555666777", tax_category: "GST", payment_terms: "Net 30", advance_account: "",
    on_hold: 0, disabled: 1,
    default_payable_accounts: [{ company: "BlessERP Inc.", account: "Creditors - BE" }],
    creation: "2024-03-22 11:15:00", modified: "2026-05-15 09:45:00",
  },
  {
    name: "SUP-00004", supplier_name: "Prairie Grain Co.", supplier_group: "Raw Material", supplier_type: "Company",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    website: "https://prairiegrain.ca", email_id: "contact@prairiegrain.ca", mobile_no: "+1 306-555-2104",
    tax_id: "RT777888999", payment_terms: "Net 15", advance_account: "",
    on_hold: 0, disabled: 0,
    creation: "2024-06-10 13:00:00", modified: "2026-07-04 10:00:00",
  },
  {
    name: "SUP-00005", supplier_name: "Summit Logistics", supplier_group: "Services", supplier_type: "Company",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    website: "https://summitlogistics.ca", email_id: "dispatch@summitlogistics.ca", mobile_no: "+1 403-555-2105",
    payment_terms: "Net 30", advance_account: "",
    on_hold: 1, on_hold_until: "2026-12-31", hold_type: "Payments", disabled: 0,
    creation: "2023-07-01 10:00:00", modified: "2026-07-06 16:20:00",
  },
  {
    name: "SUP-00006", supplier_name: "Maple Interiors", supplier_group: "Services", supplier_type: "Individual",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    email_id: "hello@mapleinteriors.ca", mobile_no: "+1 905-555-2106",
    on_hold: 0, disabled: 0,
    creation: "2025-01-20 11:30:00", modified: "2026-06-28 12:00:00",
  },
  {
    name: "SUP-00007", supplier_name: "Eastern Paper Mills", supplier_group: "Raw Material", supplier_type: "Company",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    website: "https://easternpapermills.ca", email_id: "sales@easternpapermills.ca", mobile_no: "+1 902-555-2107",
    tax_id: "RT999000111", payment_terms: "Net 60", advance_account: "",
    on_hold: 0, disabled: 1,
    creation: "2024-09-01 14:00:00", modified: "2026-04-20 14:00:00",
  },
  {
    name: "SUP-00008", supplier_name: "Baker's Supply Depot", supplier_group: "Distributor", supplier_type: "Company",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    email_id: "orders@bakerssupply.ca", mobile_no: "+1 416-555-2108",
    payment_terms: "Net 15", advance_account: "",
    on_hold: 0, disabled: 0,
    creation: "2024-12-01 11:00:00", modified: "2026-07-02 09:30:00",
  },
  {
    name: "SUP-00009", supplier_name: "Harbor Freight Lines", supplier_group: "Services", supplier_type: "Company",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    website: "https://harborfreightlines.ca", email_id: "ops@harborfreightlines.ca", mobile_no: "+1 250-555-2109",
    payment_terms: "Net 30", advance_account: "",
    on_hold: 0, disabled: 0,
    creation: "2023-03-15 09:00:00", modified: "2026-07-06 08:00:00",
  },
  {
    name: "SUP-00010", supplier_name: "Cedar Valley Timber", supplier_group: "Raw Material", supplier_type: "Company",
    territory: "Canada", country: "Canada", company: "BlessERP Inc.", currency: "CAD",
    email_id: "sales@cedarvalleytimber.ca", mobile_no: "+1 807-555-2110",
    tax_id: "RT222333444", payment_terms: "Net 45", advance_account: "",
    on_hold: 0, disabled: 0,
    creation: "2024-05-15 10:00:00", modified: "2026-06-25 13:45:00",
  },
]

// Supplier-linked contact / address rows so the detail + edit pages resolve
// addresses and contacts through the same /api/resource/Address + Contact
// endpoints the customer module serves.
const supplierContacts: Array<{
  name: string
  first_name: string
  last_name?: string
  email_ids: Array<{ email_id: string; is_primary: 0 | 1 }>
  phone_nos: Array<{ phone: string; is_primary_mobile_no: 0 | 1 }>
  links: Array<{ link_doctype: string; link_name: string }>
}> = [
  {
    name: "SUP-CON-0001", first_name: "Diane", last_name: "Kowalski",
    email_ids: [{ email_id: "d.kowalski@northwindfoods.ca", is_primary: 1 }],
    phone_nos: [{ phone: "+1 416-555-2101", is_primary_mobile_no: 1 }],
    links: [{ link_doctype: "Supplier", link_name: "SUP-00001" }],
  },
  {
    name: "SUP-CON-0002", first_name: "Martin", last_name: "Crane",
    email_ids: [{ email_id: "m.crane@greatlakespackaging.ca", is_primary: 1 }],
    phone_nos: [{ phone: "+1 519-555-2102", is_primary_mobile_no: 1 }],
    links: [{ link_doctype: "Supplier", link_name: "SUP-00002" }],
  },
  {
    name: "SUP-CON-0003", first_name: "Elaine", last_name: "Marks",
    email_ids: [{ email_id: "e.marks@pacificcoastseafood.ca", is_primary: 1 }],
    phone_nos: [{ phone: "+1 604-555-2103", is_primary_mobile_no: 1 }],
    links: [{ link_doctype: "Supplier", link_name: "SUP-00003" }],
  },
]

const supplierAddresses: Array<{
  name: string
  address_type: string
  address_line1: string
  address_line2?: string
  city: string
  state?: string
  country: string
  pincode?: string
  is_primary_address: 0 | 1
  is_shipping_address: 0 | 1
  links: Array<{ link_doctype: string; link_name: string }>
}> = [
  {
    name: "SUP-ADDR-0001", address_type: "Billing", address_line1: "88 Orchard Way", city: "Toronto",
    state: "ON", country: "Canada", pincode: "M6K 1T2", is_primary_address: 1, is_shipping_address: 1,
    links: [{ link_doctype: "Supplier", link_name: "SUP-00001" }],
  },
  {
    name: "SUP-ADDR-0002", address_type: "Billing", address_line1: "12 Dock Street", city: "Kitchener",
    state: "ON", country: "Canada", pincode: "N2G 1B8", is_primary_address: 1, is_shipping_address: 1,
    links: [{ link_doctype: "Supplier", link_name: "SUP-00002" }],
  },
  {
    name: "SUP-ADDR-0003", address_type: "Billing", address_line1: "501 Marine Drive", city: "Vancouver",
    state: "BC", country: "Canada", pincode: "V5L 1K4", is_primary_address: 1, is_shipping_address: 1,
    links: [{ link_doctype: "Supplier", link_name: "SUP-00003" }],
  },
]

// Snapshot used by server.ts (shared test server) on resetFixtures.
export const initialSuppliers = suppliers.map((s) => ({ ...s }))

let nextSupId = 11

function nowStamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19)
}

function safeJsonParse<T>(val: string | null, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

function parseQSParams(url: string) {
  const u = new URL(url, "http://localhost")
  const fields: string[] = safeJsonParse(u.searchParams.get("fields"), [])
  const filters: unknown[] = safeJsonParse(u.searchParams.get("filters"), [])
  const limit_page_length = Number(u.searchParams.get("limit_page_length") ?? "0")
  const limit_start = Number(u.searchParams.get("limit_start") ?? "0")
  const order_by = u.searchParams.get("order_by") ?? ""
  return { fields, filters, limit_page_length, limit_start, order_by }
}

function supplierMatchesFilters(row: MockSupplier, filters: unknown[]): boolean {
  for (const f of filters) {
    if (!Array.isArray(f) || f.length < 3) continue
    const [field, operator, value] = f as [string, string, unknown]
    const rowVal = (row as unknown as Record<string, unknown>)[field]
    if (operator === "like" && typeof value === "string") {
      const pattern = value.replace(/%/g, "").toLowerCase()
      if (!String(rowVal ?? "").toLowerCase().includes(pattern)) return false
    } else if (operator === "=") {
      // eslint-disable-next-line eqeqeq
      if (rowVal != value) return false
    } else if (operator === "in" && Array.isArray(value)) {
      if (!value.includes(rowVal)) return false
    }
  }
  return true
}

export function countSuppliers(filters: unknown[]): number {
  return suppliers.filter((s) => supplierMatchesFilters(s, filters)).length
}

export function listSuppliers(filters: unknown[], orderBy: string, limitStart: number, limitLength: number): MockSupplier[] {
  let rows = suppliers.filter((s) => supplierMatchesFilters(s, filters))
  if (orderBy.trim()) {
    const [field, dir] = orderBy.trim().split(/\s+/)
    const mult = (dir ?? "asc").toLowerCase() === "asc" ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[field] ?? "")
      const bv = String((b as unknown as Record<string, unknown>)[field] ?? "")
      return av.localeCompare(bv) * mult
    })
  }
  if (limitLength === 0) return rows
  return rows.slice(limitStart, limitStart + limitLength)
}

export function findSupplier(name: string): MockSupplier | undefined {
  return suppliers.find((s) => s.name === name)
}

export function upsertSupplier(name: string, patch: Record<string, unknown>): MockSupplier | undefined {
  const idx = suppliers.findIndex((s) => s.name === name)
  if (idx === -1) return undefined
  suppliers[idx] = { ...suppliers[idx], ...patch, modified: nowStamp() } as MockSupplier
  return suppliers[idx]
}

export function addSupplier(body: Record<string, unknown>): MockSupplier {
  const name = `SUP-${String(nextSupId++).padStart(5, "0")}`
  const row: MockSupplier = {
    name,
    supplier_name: String(body.supplier_name ?? ""),
    supplier_group: String(body.supplier_group ?? "Distributor"),
    supplier_type: (body.supplier_type as MockSupplier["supplier_type"]) ?? "Company",
    creation: nowStamp(),
    modified: nowStamp(),
    ...(body as Record<string, unknown>),
  } as MockSupplier
  suppliers.push(row)
  return row
}

export function removeSuppliers(names: string[]): void {
  const set = new Set(names)
  for (let i = suppliers.length - 1; i >= 0; i--) {
    if (set.has(suppliers[i].name)) suppliers.splice(i, 1)
  }
}

// Address + Contact rows are served through the shared /api/resource/Address
// and /api/resource/Contact handlers in frappe-customers.ts, which merge these
// supplier-linked rows into the customer store so both modules share one
// endpoint (MSW first-match-wins: /api/resource/Address must stay unique).
export const supplierAddressStore = supplierAddresses
export const supplierContactStore = supplierContacts

// ── Handlers ─────────────────────────────────────────────────────────
export const frappeSupplierHandlers = [
  // ── GET /api/resource/Supplier?fields=...&filters=...&limit... ────
  http.get("/api/resource/Supplier", async ({ request }) => {
    await delay(200)
    const { filters, limit_page_length, limit_start, order_by } = parseQSParams(request.url)
    return HttpResponse.json({ data: listSuppliers(filters, order_by, limit_start, limit_page_length) })
  }),

  // ── GET /api/resource/Supplier/{name} ────────────────────────────
  http.get("/api/resource/Supplier/:name", async ({ params }) => {
    await delay(150)
    const doc = findSupplier(String(params.name))
    if (!doc) {
      return HttpResponse.json({ message: "Not Found", exc_type: "DoesNotExistError" }, { status: 404 })
    }
    return HttpResponse.json({ data: doc })
  }),

  // ── POST /api/resource/Supplier ──────────────────────────────────
  http.post("/api/resource/Supplier", async ({ request }) => {
    await delay(250)
    const body = (await request.json()) as Record<string, unknown>
    const row = addSupplier(body)
    return HttpResponse.json({ data: row })
  }),

  // ── PUT /api/resource/Supplier/{name} ────────────────────────────
  http.put("/api/resource/Supplier/:name", async ({ params, request }) => {
    await delay(200)
    const body = (await request.json()) as Record<string, unknown>
    const row = upsertSupplier(String(params.name), body)
    if (!row) return HttpResponse.json({ message: "Not Found" }, { status: 404 })
    return HttpResponse.json({ data: row })
  }),

  // ── DELETE /api/resource/Supplier/{name} ─────────────────────────
  http.delete("/api/resource/Supplier/:name", async ({ params }) => {
    await delay(150)
    removeSuppliers([String(params.name)])
    return HttpResponse.json({ data: null })
  }),
]