import { http, HttpResponse, delay } from "msw"

// ── Customers ────────────────────────────────────────────────────────
interface CustomerRow {
  name: string
  naming_series?: string
  salutation?: string
  customer_name: string
  customer_type: "Company" | "Individual"
  customer_group: string
  territory: string
  gender?: string
  lead_name?: string
  opportunity_name?: string
  prospect_name?: string
  crm_deal?: string
  account_manager?: string
  image?: string
  default_currency?: string
  default_bank_account?: string
  default_price_list?: string
  is_internal_customer?: number
  represents_company?: string
  market_segment?: string
  industry?: string
  customer_pos_id?: string
  website?: string
  language?: string
  customer_details?: string
  customer_primary_address?: string
  primary_address?: string
  customer_primary_contact?: string
  mobile_no?: string
  email_id?: string
  first_name?: string
  last_name?: string
  tax_id?: string
  tax_category?: string
  tax_withholding_category?: string
  payment_terms?: string
  loyalty_program?: string
  loyalty_program_tier?: string
  default_sales_partner?: string
  default_commission_rate?: number
  so_required?: number
  dn_required?: number
  is_frozen?: number
  disabled?: number
  creation: string
  modified: string
}

let customers: CustomerRow[] = [
  { name: "CUST-00001", customer_name: "Maple Leaf Bakery", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://mapleleafbakery.ca", email_id: "orders@mapleleafbakery.ca", mobile_no: "+1 416-555-0101", tax_id: "RT123456789", industry: "Food & Beverage", market_segment: "Mid-Market", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 30", so_required: 1, dn_required: 1, disabled: 0, creation: "2024-01-15 09:00:00", modified: "2026-06-28 14:30:00" },
  { name: "CUST-00002", customer_name: "Northern Lights Coffee", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://northernlightscoffee.ca", email_id: "info@northernlightscoffee.ca", mobile_no: "+1 604-555-0202", tax_id: "RT987654321", industry: "Food & Beverage", market_segment: "SMB", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 15", so_required: 0, dn_required: 0, disabled: 0, creation: "2024-03-22 11:15:00", modified: "2026-07-01 10:00:00" },
  { name: "CUST-00003", customer_name: "Blue Mountain Supplies", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://bluemountainsupplies.ca", email_id: "purchasing@bluemountainsupplies.ca", mobile_no: "+1 416-555-0303", tax_id: "RT456789123", industry: "Wholesale", market_segment: "Enterprise", language: "en", default_currency: "CAD", default_price_list: "Wholesale", payment_terms: "Net 45", so_required: 1, dn_required: 1, disabled: 0, creation: "2023-11-05 08:30:00", modified: "2026-06-15 16:45:00" },
  { name: "CUST-00004", customer_name: "Great Lakes Trading", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://greatlakestrading.ca", email_id: "sales@greatlakestrading.ca", mobile_no: "+1 519-555-0404", tax_id: "RT321654987", industry: "Wholesale", market_segment: "Mid-Market", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 30", so_required: 0, dn_required: 0, disabled: 0, creation: "2024-06-10 13:00:00", modified: "2026-05-20 09:15:00" },
  { name: "CUST-00005", customer_name: "Red Maple Imports", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://redmapleimports.ca", email_id: "info@redmapleimports.ca", mobile_no: "+1 778-555-0505", tax_id: "RT159357852", industry: "Distribution", market_segment: "Enterprise", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 60", so_required: 1, dn_required: 1, disabled: 0, creation: "2023-07-01 10:00:00", modified: "2026-06-30 11:30:00" },
  { name: "CUST-00006", customer_name: "Pacific Coast Distributors", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://pacificcoastdist.ca", email_id: "orders@pacificcoastdist.ca", mobile_no: "+1 250-555-0606", tax_id: "RT753951852", industry: "Distribution", market_segment: "Enterprise", language: "en", default_currency: "CAD", default_price_list: "Wholesale", payment_terms: "Net 30", so_required: 0, dn_required: 0, disabled: 0, creation: "2024-02-18 09:45:00", modified: "2026-07-03 08:00:00" },
  { name: "CUST-00007", customer_name: "Prairie Grain Co.", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://prairiegrain.ca", email_id: "contact@prairiegrain.ca", mobile_no: "+1 306-555-0707", tax_id: "RT456852123", industry: "Agriculture", market_segment: "Mid-Market", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 30", so_required: 1, dn_required: 0, disabled: 0, creation: "2024-09-01 14:00:00", modified: "2026-06-10 15:30:00" },
  { name: "CUST-00008", customer_name: "Eastern Seafood Co.", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://eastseafood.ca", email_id: "sales@eastseafood.ca", mobile_no: "+1 902-555-0808", tax_id: "RT741852963", industry: "Food & Beverage", market_segment: "SMB", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 15", so_required: 0, dn_required: 1, disabled: 0, creation: "2025-01-20 11:30:00", modified: "2026-05-15 10:00:00" },
  { name: "CUST-00009", customer_name: "Golden Harvest Organic", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://goldenharvestorganic.ca", email_id: "info@goldenharvestorganic.ca", mobile_no: "+1 403-555-0909", tax_id: "RT159753486", industry: "Agriculture", market_segment: "SMB", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 30", so_required: 0, dn_required: 0, disabled: 0, creation: "2024-04-10 08:00:00", modified: "2026-07-05 12:00:00" },
  { name: "CUST-00010", customer_name: "Summit Logistics", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://summitlogistics.ca", email_id: "dispatch@summitlogistics.ca", mobile_no: "+1 403-555-1010", tax_id: "RT357159654", industry: "Logistics", market_segment: "Enterprise", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 45", so_required: 1, dn_required: 1, disabled: 0, creation: "2023-03-15 09:00:00", modified: "2026-07-06 09:30:00" },
  { name: "CUST-00011", customer_name: "John Doe Construction", customer_type: "Individual", customer_group: "Individual", territory: "Canada", email_id: "john@doeconstruction.ca", mobile_no: "+1 905-555-1111", industry: "Construction", market_segment: "SMB", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 30", so_required: 0, dn_required: 0, disabled: 0, creation: "2025-06-01 10:00:00", modified: "2026-04-20 14:00:00" },
  { name: "CUST-00012", customer_name: "Victoria's Green Grocers", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://victoriasgreengrocers.ca", email_id: "manager@victoriasgreengrocers.ca", mobile_no: "+1 250-555-1212", industry: "Retail", market_segment: "SMB", language: "en", default_currency: "CAD", default_price_list: "Retail", payment_terms: "Net 15", so_required: 0, dn_required: 0, disabled: 0, creation: "2024-08-12 13:00:00", modified: "2026-06-20 11:00:00" },
  { name: "CUST-00013", customer_name: "Yukon Wilderness Supplies", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://yukonwilderness.ca", email_id: "orders@yukonwilderness.ca", mobile_no: "+1 867-555-1313", industry: "Retail", market_segment: "SMB", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 30", so_required: 0, dn_required: 1, disabled: 0, creation: "2025-02-28 09:30:00", modified: "2026-05-30 16:00:00" },
  { name: "CUST-00014", customer_name: "Quebec Artisan Cheese", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://quebecartisancheese.ca", email_id: "info@quebecartisancheese.ca", mobile_no: "+1 418-555-1414", tax_id: "RT654852321", industry: "Food & Beverage", market_segment: "SMB", language: "fr", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 30", so_required: 0, dn_required: 0, disabled: 0, creation: "2024-12-01 11:00:00", modified: "2026-07-02 10:30:00" },
  { name: "CUST-00015", customer_name: "Vancouver Island Brewery", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://vancouverislandbrewery.ca", email_id: "sales@vancouverislandbrewery.ca", mobile_no: "+1 250-555-1515", tax_id: "RT852741963", industry: "Food & Beverage", market_segment: "Mid-Market", language: "en", default_currency: "CAD", default_price_list: "Wholesale", payment_terms: "Net 30", so_required: 1, dn_required: 0, disabled: 0, creation: "2023-09-20 08:15:00", modified: "2026-06-25 13:45:00" },
  { name: "CUST-00016", customer_name: "Manitoba Harvest Co-op", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://manitobaharvest.ca", email_id: "info@manitobaharvest.ca", mobile_no: "+1 204-555-1616", industry: "Agriculture", market_segment: "Mid-Market", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 30", so_required: 0, dn_required: 0, disabled: 1, creation: "2024-05-15 10:00:00", modified: "2026-03-10 09:00:00" },
  { name: "CUST-00017", customer_name: "Nova Scotia Fisheries Ltd.", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://novascotiafisheries.ca", email_id: "export@novascotiafisheries.ca", mobile_no: "+1 902-555-1717", tax_id: "RT753159852", industry: "Food & Beverage", market_segment: "Enterprise", language: "en", default_currency: "CAD", default_price_list: "Export", payment_terms: "Net 60", so_required: 1, dn_required: 1, disabled: 0, creation: "2023-04-01 09:00:00", modified: "2026-07-06 08:00:00" },
  { name: "CUST-00018", customer_name: "Sarah Williams", customer_type: "Individual", customer_group: "Individual", territory: "Canada", email_id: "sarah.williams@email.ca", mobile_no: "+1 416-555-1818", industry: "Retail", market_segment: "SMB", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Due on Receipt", so_required: 0, dn_required: 0, disabled: 0, creation: "2026-01-10 15:00:00", modified: "2026-06-01 12:00:00" },
  { name: "CUST-00019", customer_name: "Canadian Prairie Flour Mills", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://prairieflourmills.ca", email_id: "orders@prairieflourmills.ca", mobile_no: "+1 204-555-1919", tax_id: "RT951753852", industry: "Food & Beverage", market_segment: "Enterprise", language: "en", default_currency: "CAD", default_price_list: "Wholesale", payment_terms: "Net 45", so_required: 1, dn_required: 0, disabled: 0, creation: "2024-07-22 08:30:00", modified: "2026-06-18 10:00:00" },
  { name: "CUST-00020", customer_name: "Boreal Forest Products", customer_type: "Company", customer_group: "Commercial", territory: "Canada", website: "https://borealforestproducts.ca", email_id: "sales@borealforestproducts.ca", mobile_no: "+1 807-555-2020", tax_id: "RT852159753", industry: "Manufacturing", market_segment: "Enterprise", language: "en", default_currency: "CAD", default_price_list: "Standard Selling", payment_terms: "Net 30", so_required: 1, dn_required: 1, disabled: 0, creation: "2023-12-05 11:00:00", modified: "2026-07-04 14:00:00" },
]

// ── Contact store ────────────────────────────────────────────────────
interface MockContact {
  name: string
  first_name: string
  email_ids: Array<{ email_id: string; is_primary: 0 | 1 }>
  phone_nos: Array<{ phone: string; is_primary_mobile_no: 0 | 1 }>
  links: Array<{ link_doctype: string; link_name: string }>
}

let contacts: MockContact[] = [
  {
    name: "CON-00001",
    first_name: "Marie",
    email_ids: [{ email_id: "marie@mapleleafbakery.ca", is_primary: 1 }],
    phone_nos: [{ phone: "+1 416-555-0101", is_primary_mobile_no: 1 }],
    links: [{ link_doctype: "Customer", link_name: "CUST-00001" }],
  },
  {
    name: "CON-00002",
    first_name: "James",
    email_ids: [{ email_id: "james@northernlightscoffee.ca", is_primary: 1 }],
    phone_nos: [{ phone: "+1 604-555-0202", is_primary_mobile_no: 1 }],
    links: [{ link_doctype: "Customer", link_name: "CUST-00002" }],
  },
]

// ── Address store ────────────────────────────────────────────────────
interface MockAddress {
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
}

let addresses: MockAddress[] = [
  {
    name: "ADDR-00001",
    address_type: "Billing",
    address_line1: "100 King Street West",
    address_line2: "Suite 200",
    city: "Toronto",
    state: "ON",
    country: "Canada",
    pincode: "M5X 1A1",
    is_primary_address: 1,
    is_shipping_address: 0,
    links: [{ link_doctype: "Customer", link_name: "CUST-00001" }],
  },
  {
    name: "ADDR-00002",
    address_type: "Shipping",
    address_line1: "50 Industrial Blvd",
    city: "Mississauga",
    state: "ON",
    country: "Canada",
    pincode: "L5R 3K7",
    is_primary_address: 0,
    is_shipping_address: 1,
    links: [{ link_doctype: "Customer", link_name: "CUST-00001" }],
  },
  {
    name: "ADDR-00003",
    address_type: "Billing",
    address_line1: "2020 Granville Street",
    city: "Vancouver",
    state: "BC",
    country: "Canada",
    pincode: "V6H 3G9",
    is_primary_address: 1,
    is_shipping_address: 0,
    links: [{ link_doctype: "Customer", link_name: "CUST-00002" }],
  },
]

// ── Helper: next ID ──────────────────────────────────────────────────
let nextCustId = 21
let nextConId = 3
let nextAddrId = 4

// ── Helper: parse URL querystring ────────────────────────────────────
function parseQSParams(url: string) {
  const u = new URL(url, "http://localhost")
  const fields: string[] = safeJsonParse(u.searchParams.get("fields"), [])
  const filters: unknown[] = safeJsonParse(u.searchParams.get("filters"), [])
  const limit_page_length = Number(u.searchParams.get("limit_page_length") ?? "0")
  const limit_start = Number(u.searchParams.get("limit_start") ?? "0")
  const order_by = u.searchParams.get("order_by") ?? ""
  return { fields, filters, limit_page_length, limit_start, order_by }
}

function safeJsonParse<T>(val: string | null, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

// ── Helpers: filter customers ────────────────────────────────────────
function customerMatchesFilters(row: CustomerRow, filters: unknown[]): boolean {
  for (const f of filters) {
    if (!Array.isArray(f) || f.length < 3) continue
    const [field, operator, value] = f as [string, string, unknown]
    const rowVal = (row as any)[field]
    if (operator === "like" && typeof value === "string") {
      const pattern = value.replace(/%/g, "").toLowerCase()
      if (!String(rowVal).toLowerCase().includes(pattern)) return false
    } else if (operator === "=") {
      // eslint-disable-next-line eqeqeq
      if (rowVal != value) return false
    } else if (operator === "in" && Array.isArray(value)) {
      if (!value.includes(rowVal)) return false
    }
  }
  return true
}

function addressMatchesFilters(addr: MockAddress, filters: unknown[]): boolean {
  for (const f of filters) {
    if (!Array.isArray(f) || f.length < 3) continue
    const [field, operator, value] = f as [string, string, unknown]
    if (field === "Dynamic Link") continue
    const rowVal = (addr as any)[field] ?? (addr as any)[field]
    if (operator === "=") {
      // eslint-disable-next-line eqeqeq
      if (rowVal != value) return false
    } else if (operator === "like" && typeof value === "string") {
      const pattern = value.replace(/%/g, "").toLowerCase()
      if (!String(rowVal).toLowerCase().includes(pattern)) return false
    }
  }
  return true
}

function filterDynamicLinks(addr: MockAddress, filters: unknown[]): boolean {
  for (const f of filters) {
    if (!Array.isArray(f) || f.length < 4) continue
    const [table, field, operator, value] = f as [string, string, string, unknown]
    if (table !== "Dynamic Link") continue
    if (field === "link_doctype" && operator === "=") {
      // ignore doctype check for simplicity
    }
    if (field === "link_name" && operator === "=") {
      return addr.links.some((l) => l.link_name === value)
    }
  }
  return true
}

// ── Handlers ─────────────────────────────────────────────────────────
export const frappeCustomerHandlers = [
  // ── GET /api/resource/Customer?fields=...&filters=...&limit... ────
  http.get("/api/resource/Customer", async ({ request }) => {
    await delay(250)
    const { filters, limit_page_length, limit_start } = parseQSParams(request.url)

    let filtered = customers.filter((c) => customerMatchesFilters(c, filters))

    if (limit_page_length > 0) {
      filtered = filtered.slice(limit_start, limit_start + limit_page_length)
    }

    return HttpResponse.json({ data: filtered })
  }),

  // ── GET /api/method/frappe.client.get_count?doctype=... ──────────
  http.get("/api/method/frappe.client.get_count", async ({ request }) => {
    await delay(100)
    const url = new URL(request.url, "http://localhost")
    const doctype = url.searchParams.get("doctype")
    const filtersJson = url.searchParams.get("filters")
    const filters: unknown[] = filtersJson ? safeJsonParse(filtersJson, []) : []

    let count = 0
    if (doctype === "Customer") {
      count = customers.filter((c) => customerMatchesFilters(c, filters)).length
    }
    return HttpResponse.json({ message: count })
  }),

  // ── GET /api/resource/Customer/{name} ────────────────────────────
  http.get("/api/resource/Customer/:name", async ({ params }) => {
    await delay(200)
    const doc = customers.find((c) => c.name === params.name)
    if (!doc) {
      return HttpResponse.json({ message: "Not Found", exc_type: "DoesNotExistError" }, { status: 404 })
    }
    return HttpResponse.json({ data: doc })
  }),

  // ── GET /api/resource/Address?fields=...&filters=... ─────────────
  http.get("/api/resource/Address", async ({ request }) => {
    await delay(150)
    const { filters, limit_page_length, limit_start } = parseQSParams(request.url)

    let filtered = addresses.filter(
      (a) => addressMatchesFilters(a, filters) && filterDynamicLinks(a, filters),
    )

    if (limit_page_length > 0) {
      filtered = filtered.slice(limit_start, limit_start + limit_page_length)
    }

    return HttpResponse.json({ data: filtered })
  }),

  // ── POST /api/resource/Customer ──────────────────────────────────
  http.post("/api/resource/Customer", async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const now = new Date().toISOString().replace("T", " ").slice(0, 19)
    const name = `CUST-${String(nextCustId++).padStart(5, "0")}`
    const newCustomer: CustomerRow = {
      name,
      customer_name: String(body.customer_name ?? ""),
      customer_type: (body.customer_type as any) ?? "Company",
      customer_group: String(body.customer_group ?? "Commercial"),
      territory: String(body.territory ?? "Canada"),
      creation: now,
      modified: now,
      ...body,
    }
    customers.push(newCustomer)
    return HttpResponse.json({ data: newCustomer })
  }),

  // ── POST /api/resource/Contact ───────────────────────────────────
  http.post("/api/resource/Contact", async ({ request }) => {
    await delay(200)
    const body = (await request.json()) as Record<string, unknown>
    const name = `CON-${String(nextConId++).padStart(5, "0")}`
    const newContact: MockContact = {
      name,
      first_name: String(body.first_name ?? "Contact"),
      email_ids: (body.email_ids as any) ?? [],
      phone_nos: (body.phone_nos as any) ?? [],
      links: (body.links as any) ?? [],
    }
    contacts.push(newContact)
    return HttpResponse.json({ data: newContact })
  }),

  // ── POST /api/resource/Address ───────────────────────────────────
  http.post("/api/resource/Address", async ({ request }) => {
    await delay(200)
    const body = (await request.json()) as Record<string, unknown>
    const name = `ADDR-${String(nextAddrId++).padStart(5, "0")}`
    const newAddress: MockAddress = {
      name,
      address_type: String(body.address_type ?? "Billing"),
      address_line1: String(body.address_line1 ?? ""),
      address_line2: body.address_line2 ? String(body.address_line2) : undefined,
      city: String(body.city ?? ""),
      state: body.state ? String(body.state) : undefined,
      country: String(body.country ?? "Canada"),
      pincode: body.pincode ? String(body.pincode) : undefined,
      is_primary_address: (body.is_primary_address as any) ?? 0,
      is_shipping_address: (body.is_shipping_address as any) ?? 0,
      links: (body.links as any) ?? [],
    }
    addresses.push(newAddress)
    return HttpResponse.json({ data: newAddress })
  }),

  // ── PUT /api/resource/Customer/{name} ────────────────────────────
  http.put("/api/resource/Customer/:name", async ({ params, request }) => {
    await delay(250)
    const idx = customers.findIndex((c) => c.name === params.name)
    if (idx === -1) {
      return HttpResponse.json({ message: "Not Found" }, { status: 404 })
    }
    const body = (await request.json()) as Record<string, unknown>
    customers[idx] = { ...customers[idx], ...body, modified: new Date().toISOString().replace("T", " ").slice(0, 19) }
    return HttpResponse.json({ data: customers[idx] })
  }),

  // ── PUT /api/resource/Contact/{name} ─────────────────────────────
  http.put("/api/resource/Contact/:name", async ({ params, request }) => {
    await delay(200)
    const idx = contacts.findIndex((c) => c.name === params.name)
    if (idx === -1) {
      return HttpResponse.json({ message: "Not Found" }, { status: 404 })
    }
    const body = (await request.json()) as Record<string, unknown>
    contacts[idx] = { ...contacts[idx], ...body }
    return HttpResponse.json({ data: contacts[idx] })
  }),

  // ── PUT /api/resource/Address/{name} ─────────────────────────────
  http.put("/api/resource/Address/:name", async ({ params, request }) => {
    await delay(200)
    const idx = addresses.findIndex((a) => a.name === params.name)
    if (idx === -1) {
      return HttpResponse.json({ message: "Not Found" }, { status: 404 })
    }
    const body = (await request.json()) as Record<string, unknown>
    addresses[idx] = { ...addresses[idx], ...body }
    return HttpResponse.json({ data: addresses[idx] })
  }),

  // ── DELETE /api/resource/Customer/{name} ─────────────────────────
  http.delete("/api/resource/Customer/:name", async ({ params }) => {
    await delay(200)
    const idx = customers.findIndex((c) => c.name === params.name)
    if (idx === -1) {
      return HttpResponse.json({ message: "Not Found" }, { status: 404 })
    }
    customers.splice(idx, 1)
    return HttpResponse.json({ data: null })
  }),

]
