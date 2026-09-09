import { http, HttpResponse, delay } from "msw"

const userDoc = {
  name: "admin@blesserp.com",
  full_name: "BlessERP Admin",
  first_name: "BlessERP",
  last_name: "Admin",
  email: "admin@blesserp.com",
  user_image: null,
  gender: "Male",
  phone: "+1 (416) 555-0100",
  mobile_no: "+1 (416) 555-0100",
  birth_date: "1990-06-15",
  location: "Toronto, ON",
  interest: "ERP systems, business automation, process optimization",
  bio: "System administrator and business process enthusiast.",
  email_signature: "--\nBlessERP Admin\nBlessERP Inc.",
  time_zone: "America/Toronto",
  language: "en",
  desk_theme: "Light",
  simultaneous_sessions: 3,
  login_after: 6,
  login_before: 22,
  restrict_ip: "",
  last_login: "2026-07-06 08:30:00",
  last_ip: "192.168.1.100",
  last_active: "2026-07-06 12:00:00",
  user_type: "System User",
  send_me_a_copy: 1,
  thread_notify: 1,
  allowed_in_mentions: 1,
}

const companyDoc = {
  company_name: "BlessERP Inc.",
  company_logo: null,
  country: "Canada",
  default_currency: "CAD",
  tax_id: "R123456789",
  phone_no: "+1 (416) 555-0200",
  email: "info@blesserp.com",
  website: "https://blesserp.com",
  fax: "+1 (416) 555-0201",
  date_of_incorporation: "2020-01-15",
  date_of_establishment: "2020-01-15",
  registration_details: "Federal Corporation #1234567-8",
  default_bank_account: "Business Chequing - TD Bank",
  default_cash_account: "Cash on Hand",
  default_receivable_account: "Accounts Receivable",
  default_payable_account: "Accounts Payable",
  default_income_account: "Sales Revenue",
  default_expense_account: "Cost of Goods Sold",
  default_cost_center: "Main Cost Center",
  default_inventory_account: "Inventory in Transit",
  credit_limit: 50000,
  address_html: "123 King Street West\nSuite 400\nToronto, ON M5V 1K3\nCanada",
}

// Mirrors the v15 Incoterm doctype: name = code (autoname field:code),
// title_field = title, show_title_field_in_link = 1. Label is the title
// ("Cost and Freight"), value/description are the code ("CFR").
const incotermOptions = [
  { value: "CFR", label: "Cost and Freight", description: "CFR" },
  { value: "CIF", label: "Cost, Insurance and Freight", description: "CIF" },
  { value: "CIP", label: "Carriage and Insurance Paid to", description: "CIP" },
  { value: "CPT", label: "Carriage Paid To", description: "CPT" },
  { value: "DAP", label: "Delivered At Place", description: "DAP" },
  { value: "DDP", label: "Delivered Duty Paid", description: "DDP" },
  { value: "DPU", label: "Delivered At Place Unloaded", description: "DPU" },
  { value: "EXW", label: "Ex Works", description: "EXW" },
  { value: "FAS", label: "Free Alongside Ship", description: "FAS" },
  { value: "FCA", label: "Free Carrier", description: "FCA" },
  { value: "FOB", label: "Free On Board", description: "FOB" },
]

const matchIncoterm = (txt: string) =>
  incotermOptions.filter(
    (i) => !txt || i.value.toLowerCase().includes(txt) || i.label.toLowerCase().includes(txt)
  )

export const frappeSettingsHandlers = [
  http.get("/api/resource/Company/:name", async () => {
    await delay(200)
    return HttpResponse.json({ data: companyDoc })
  }),

  http.get("/api/resource/User/:userId", async () => {
    await delay(200)
    return HttpResponse.json({ data: userDoc })
  }),

  // ── Link options (frappe.desk.search.search_link) ─────────────────
  // GET form is used by the desktop "Get Items From > Opportunity" picker
  // (searchLink with filters) and assignment User lookups.
  http.get("/api/method/frappe.desk.search.search_link", async ({ request }) => {
    await delay(150)
    const url = new URL(request.url)
    const doctype = url.searchParams.get("doctype") ?? ""
    const txt = (url.searchParams.get("txt") ?? "").toLowerCase()

    if (doctype === "User") {
      const users = [
        { name: "admin@blesserp.com", full_name: "BlessERP Admin" },
        { name: "aarav@blesserp.com", full_name: "Aarav Mehta" },
        { name: "priya@blesserp.com", full_name: "Priya Sharma" },
        { name: "neha@blesserp.com", full_name: "Neha Gupta" },
        { name: "vivek@blesserp.com", full_name: "Vivek Nair" },
      ]
      const filtered = users.filter(
        (u) =>
          !txt ||
          u.name.toLowerCase().includes(txt) ||
          u.full_name.toLowerCase().includes(txt)
      )
      return HttpResponse.json({
        message: filtered.slice(0, 10).map((u) => ({
          value: u.name,
          label: u.full_name,
          description: u.name,
        })),
      })
    }

    if (doctype === "Sales Person") {
      const salesPeople = [
        { name: "John Smith", employee_name: "John Smith", commission_rate: "4", designation: "Sales Executive", enabled: 1, is_group: 0 },
        { name: "Jane Doe", employee_name: "Jane Doe", commission_rate: "5.5", designation: "Sales Manager", enabled: 1, is_group: 0 },
        { name: "Bob Johnson", employee_name: "Bob Johnson", commission_rate: "3", designation: "Sales Executive", enabled: 1, is_group: 0 },
        { name: "Alice Brown", employee_name: "Alice Brown", commission_rate: "6", designation: "Sales Lead", enabled: 1, is_group: 0 },
      ]
      // Honor ERPNext link_filters (e.g. Customize Form → Link Filters for the
      // Sales Team.sales_person field): {"is_group":0,"enabled":1}.
      let filterEnabled: number | null = null
      let filterIsGroup: number | null = null
      try {
        const raw = url.searchParams.get("filters")
        if (raw) {
          const filters = JSON.parse(raw) as Record<string, unknown>
          if (typeof filters.enabled === "boolean") filterEnabled = filters.enabled ? 1 : 0
          else if (typeof filters.enabled === "number") filterEnabled = filters.enabled
          if (typeof filters.is_group === "boolean") filterIsGroup = filters.is_group ? 1 : 0
          else if (typeof filters.is_group === "number") filterIsGroup = filters.is_group
        }
      } catch {
        // ignore malformed filters — fall through to unfiltered list
      }
      const filtered = salesPeople.filter((s) => {
        if (filterEnabled !== null && s.enabled !== filterEnabled) return false
        if (filterIsGroup !== null && s.is_group !== filterIsGroup) return false
        if (!txt) return true
        return (
          s.name.toLowerCase().includes(txt) ||
          s.employee_name.toLowerCase().includes(txt)
        )
      })
      return HttpResponse.json({
        message: filtered.slice(0, 10).map((s) => ({
          value: s.name,
          label: s.employee_name,
          description: s.designation,
        })),
      })
    }

    if (doctype === "Opportunity") {
      const opportunities = [
        { name: "OPP-0001", title: "Annual Supply Contract", status: "Open", customer_name: "Acme Corporation" },
        { name: "OPP-0002", title: "Software License Renewal", status: "Replied", customer_name: "Globex Inc." },
        { name: "OPP-0003", title: "Maintenance Service Agreement", status: "Open", customer_name: "Umbrella Corp" },
        { name: "OPP-0004", title: "Consulting Services Package", status: "Quotation", customer_name: "Initech Solutions" },
      ]
      // Honor ERPNext opportunity_query filter:
      // filters → status not in (Lost, Closed, Converted).
      let filterStatus: string[] | null = null
      try {
        const filters = JSON.parse(url.searchParams.get("filters") ?? "[]") as unknown[]
        for (const f of filters) {
          if (Array.isArray(f) && f.length >= 3 && f[0] === "status" && String(f[1]) === "in") {
            filterStatus = (f[2] as string[]).map((s) => s.toLowerCase())
          }
        }
      } catch {
        // ignore malformed filters — fall through to unfiltered list
      }
      const filtered = opportunities.filter((o) => {
        if (filterStatus && filterStatus.includes(o.status.toLowerCase())) return false
        if (!txt) return true
        return (
          o.name.toLowerCase().includes(txt) ||
          o.title.toLowerCase().includes(txt) ||
          o.customer_name.toLowerCase().includes(txt)
        )
      })
      return HttpResponse.json({
        message: filtered.slice(0, 10).map((o) => ({
          value: o.name,
          label: o.title,
          description: o.customer_name,
        })),
      })
    }

    if (doctype === "Incoterm") {
      return HttpResponse.json({ message: matchIncoterm(txt) })
    }

    return HttpResponse.json({ message: [] })
  }),

  // ── quotation_to / Address / Contact Link options (desk ControlLink) ─
  http.post("/api/method/frappe.desk.search.search_link", async ({ request }) => {
    await delay(150)
    const body = new URLSearchParams(await request.text())
    const doctype = body.get("doctype") ?? ""
    const txt = (body.get("txt") ?? "").toLowerCase()
    const query = body.get("query") ?? ""

    if (doctype === "DocType") {
      const options = [
        { value: "Customer", description: "Selling" },
        { value: "Lead", description: "CRM" },
        { value: "Prospect", description: "CRM" },
      ]
      const filtered = options.filter(
        (o) => !txt || o.value.toLowerCase().includes(txt)
      )
      return HttpResponse.json({ message: filtered })
    }

    if (doctype === "Address" && query.includes("address_query")) {
      const addresses = [
        { value: "MAIN-001", label: "Main Office", description: "100 Main Street\nToronto, ON M5V 3L9\nCanada" },
        { value: "BRANCH-002", label: "Downtown Branch", description: "45 King Street West\nToronto, ON M5H 1J8\nCanada" },
        { value: "HQ-003", label: "Head Office", description: "500 Commerce Blvd\nOttawa, ON K1A 0B1\nCanada" },
        { value: "WAREHOUSE-004", label: "Distribution Center", description: "88 Industrial Park Drive\nMississauga, ON L5T 1M5\nCanada" },
      ]
      const filtered = addresses.filter(
        (a) =>
          !txt ||
          a.value.toLowerCase().includes(txt) ||
          a.label.toLowerCase().includes(txt) ||
          a.description.toLowerCase().includes(txt)
      )
      return HttpResponse.json({ message: filtered })
    }

    if (doctype === "Contact" && query.includes("contact_query")) {
      const contacts = [
        { value: "Sarah Johnson", label: "Sarah Johnson", description: "sarah@example.com" },
        { value: "John Doe", label: "John Doe", description: "john@example.com" },
        { value: "Maria Garcia", label: "Maria Garcia", description: "maria@example.com" },
      ]
      const filtered = contacts.filter(
        (c) =>
          !txt ||
          c.value.toLowerCase().includes(txt) ||
          (c.description ?? "").toLowerCase().includes(txt)
      )
      return HttpResponse.json({ message: filtered })
    }

    if (doctype === "Incoterm") {
      return HttpResponse.json({ message: matchIncoterm(txt) })
    }

    return HttpResponse.json({ message: [] })
  }),
]
