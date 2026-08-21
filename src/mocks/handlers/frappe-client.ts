import { http, HttpResponse, delay } from "msw"

// ── Frappe client / ERPNext whitelisted method mocks ────────────────
// Mirrors the calls the Payment Entry form fires on open (validate_link,
// get_value, get_dimensions, get_exchange_rate, route_history).

export const frappeClientHandlers = [
  // ── POST /api/method/frappe.client.validate_link ──────────────────
  http.post("/api/method/frappe.client.validate_link", async ({ request }) => {
    await delay(60)
    // Desk sends frappe.call-style urlencoded bodies.
    const fd = await request.formData().catch(() => new FormData())
    const doctype = String(fd.get("doctype") ?? "")
    const docname = String(fd.get("docname") ?? "")

    const result: Record<string, unknown> = { name: docname }

    if (doctype === "Company" && docname === "BlessERP Inc.") {
      result.book_advance_payments_in_separate_party_account = 0
      result.reconcile_on_advance_payment_date = 0
      result.default_letter_head = "Standard"
    }

    return HttpResponse.json({ message: result })
  }),

  // ── GET /api/method/frappe.client.get_value ───────────────────────
  http.get("/api/method/frappe.client.get_value", async ({ request }) => {
    await delay(60)
    const url = new URL(request.url, "http://localhost")
    const doctype = url.searchParams.get("doctype")
    const fieldname = url.searchParams.get("fieldname") || ""

    let message: Record<string, unknown> = {}
    if (doctype === "Company") {
      if (fieldname === "default_letter_head") {
        message = { default_letter_head: "Standard" }
      }
      if (fieldname === "default_sales_contact") {
        message = { default_sales_contact: "Sarah Johnson" }
      }
    }

    return HttpResponse.json({ message })
  }),

  // ── GET /api/method/frappe.contacts...get_address_display ─────────
  http.get("/api/method/frappe.contacts.doctype.address.address.get_address_display", async ({ request }) => {
    await delay(40)
    const url = new URL(request.url, "http://localhost")
    const dict = url.searchParams.get("address_dict") || "Address"
    return HttpResponse.json({
      message: `${dict}<br>100 Main Street<br>Toronto, ON M5V 3L9<br>Canada`,
    })
  }),

  // ── GET /api/method/frappe.contacts...get_contact_details ─────────
  http.get("/api/method/frappe.contacts.doctype.contact.contact.get_contact_details", async () => {
    await delay(40)
    return HttpResponse.json({
      message: {
        contact_person: "John Doe",
        contact_display: "John Doe",
        contact_email: "john@example.com",
        contact_mobile: "+1 (555) 0100",
        contact_phone: "",
        contact_designation: "Manager",
        contact_department: "Sales",
      },
    })
  }),

  // ── POST /api/method/erpnext...get_dimensions ─────────────────────
  http.post("/api/method/erpnext.accounts.doctype.accounting_dimension.accounting_dimension.get_dimensions", async () => {
    await delay(60)
    return HttpResponse.json({
      message: [
        [
          { fieldname: "cost_center", document_type: "Cost Center" },
          { fieldname: "project", document_type: "Project" },
        ],
        {},
      ],
    })
  }),

  // ── POST /api/method/erpnext.setup.utils.get_exchange_rate ────────
  http.post("/api/method/erpnext.setup.utils.get_exchange_rate", async () => {
    await delay(40)
    return HttpResponse.json({ message: 1 })
  }),

  // ── GET /api/method/erpnext.setup.utils.get_exchange_rate ─────────
  http.get("/api/method/erpnext.setup.utils.get_exchange_rate", async () => {
    await delay(40)
    return HttpResponse.json({ message: 1 })
  }),

  // ── POST /api/method/frappe.desk...route_history.deferred_insert ──
  http.post("/api/method/frappe.desk.doctype.route_history.route_history.deferred_insert", async () => {
    await delay(30)
    return HttpResponse.json({ message: null })
  }),

  // ── POST /api/method/erpnext...get_default_company_address ───────
  http.post("/api/method/erpnext.setup.doctype.company.company.get_default_company_address", async ({ request }) => {
    await delay(60)
    const fd = await request.formData().catch(() => new FormData())
    const company = String(fd.get("name") ?? "") || "BlessERP Inc."
    return HttpResponse.json({ message: `${company} HQ` })
  }),

  // ── POST /api/method/erpnext...get_default_taxes_and_charges ─────
  http.post("/api/method/erpnext.controllers.accounts_controller.get_default_taxes_and_charges", async ({ request }) => {
    await delay(120)
    const fd = await request.formData().catch(() => new FormData())
    const company = String(fd.get("company") ?? "BlessERP Inc.")
    void company
    return HttpResponse.json({
      message: {
        taxes_and_charges: "Canada GST/QST - BE",
        taxes: [
          {
            charge_type: "On Net Total",
            account_head: "GST 5% on Purchases - BE",
            rate: 5,
            tax_amount: 0,
            total: 0,
            description: "GST 5%",
            included_in_print_rate: 0,
          },
          {
            charge_type: "On Net Total",
            account_head: "QST 9.975% on Purchases - BE",
            rate: 9.975,
            tax_amount: 0,
            total: 0,
            description: "QST 9.975%",
            included_in_print_rate: 0,
          },
        ],
      },
    })
  }),

  // ── POST /api/method/erpnext.stock.get_item_details.apply_price_list ─
  http.post("/api/method/erpnext.stock.get_item_details.apply_price_list", async ({ request }) => {
    await delay(80)
    // Desk sends urlencoded args=<json>&doc=<json>.
    const fd = await request.formData().catch(() => new FormData())
    let doc: { company_currency?: string; currency?: string } = {}
    try {
      doc = JSON.parse(String(fd.get("doc") ?? "{}"))
    } catch {
      doc = {}
    }
    const companyCurrency = doc?.company_currency || "CAD"
    const docCurrency = doc?.currency || "CAD"
    const plc = docCurrency === companyCurrency ? companyCurrency : docCurrency
    return HttpResponse.json({
      message: {
        parent: {
          price_list_currency: plc,
          plc_conversion_rate: plc === companyCurrency ? 1 : 1.35,
        },
        children: [],
      },
    })
  }),
]
