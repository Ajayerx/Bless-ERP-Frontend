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

export const frappeSettingsHandlers = [
  http.get("/api/resource/Company/:name", async () => {
    await delay(200)
    return HttpResponse.json({ data: companyDoc })
  }),

  http.get("/api/resource/User/:userId", async () => {
    await delay(200)
    return HttpResponse.json({ data: userDoc })
  }),

  // ── Link options for assignments (frappe.desk.search.search_link) ──
  http.get("/api/method/frappe.desk.search.search_link", async ({ request }) => {
    await delay(150)
    const url = new URL(request.url)
    if (url.searchParams.get("doctype") !== "User") return HttpResponse.json({ message: [] })
    const txt = (url.searchParams.get("txt") ?? "").toLowerCase()
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
  }),
]
