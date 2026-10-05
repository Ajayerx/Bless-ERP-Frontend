import { http, HttpResponse, delay } from "msw"

// ── Frappe client / ERPNext whitelisted method mocks ────────────────
// Mirrors the calls the Payment Entry form fires on open (validate_link,
// get_value, get_dimensions, get_exchange_rate, route_history).

// Stored commission_rate per Sales Partner (the value fetch_from copies into
// the Sales Order's Commission Rate field verbatim).
const salesPartnerCommissionRate: Record<string, number> = {
  "ABC Sales Agency": 5,
  "Northern Distributors": 3.5,
  "Pacific Sales Group": 7,
}

// Stored commission_rate per Sales Person (the value the Sales Team child
// table's commission_rate field fetch_from "sales_person.commission_rate"
// copies into the row verbatim).
const salesPersonCommissionRate: Record<string, number> = {
  "John Smith": 4,
  "Jane Doe": 5.5,
  "Bob Johnson": 3,
  "Alice Brown": 6,
}

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

    if (doctype === "Supplier") {
      const suppliers: Record<string, string> = {
        "SUP-00001": "Northwind Foods",
        "SUP-00002": "Great Lakes Packaging",
        "SUP-00003": "Pacific Coast Seafood",
        "SUP-00004": "Prairie Grain Co.",
        "SUP-00005": "Summit Logistics",
        "SUP-00007": "Eastern Paper Mills",
        "SUP-00008": "Baker's Supply Depot",
        "SUP-00009": "Harbor Freight Lines",
        "SUP-00010": "Cedar Valley Timber",
      }
      const supplier_name = suppliers[docname]
      if (!supplier_name) return HttpResponse.json({ message: `Supplier ${docname} not found` }, { status: 404 })
      result.supplier_name = supplier_name
    }

    if (doctype === "Item") {
      const items: Array<{ item_code: string; item_name: string }> = [
        { item_code: "PRD-001", item_name: "Organic All-Purpose Flour" },
        { item_code: "PRD-002", item_name: "Cold-Pressed Canola Oil" },
        { item_code: "PRD-003", item_name: "Wild Blueberry Jam" },
        { item_code: "PRD-004", item_name: "Atlantic Smoked Salmon" },
        { item_code: "PRD-005", item_name: "Maple Syrup (Grade A)" },
        { item_code: "PRD-006", item_name: "Canadian Hard Red Wheat" },
        { item_code: "PRD-007", item_name: "Fresh Atlantic Cod Fillets" },
        { item_code: "PRD-008", item_name: "Quebec Aged Cheddar" },
        { item_code: "PRD-009", item_name: "Natural Canadian Honey" },
        { item_code: "PRD-010", item_name: "Organic Mixed Greens" },
        { item_code: "PRD-011", item_name: "Artisan Sourdough Bread" },
        { item_code: "PRD-012", item_name: "Alberta Beef Jerky" },
        { item_code: "PRD-013", item_name: "Frozen Wild Blueberries" },
        { item_code: "PRD-014", item_name: "Craft Soda Sampler Pack" },
      ]
      const item = items.find((i) => i.item_code === docname)
      if (!item) return HttpResponse.json({ message: `Item ${docname} not found` }, { status: 404 })
      result.item_name = item.item_name
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

  // ── POST /api/method/frappe.model.utils.get_fetch_values ──────────
  // Mirrors fetch_from: sales_partner.commission_rate (sales_order.json) and
  // the Sales Team child table's fetch_from: sales_person.commission_rate
  // (sales_team.json). Selecting a Sales Partner / Sales Person returns the
  // stored commission_rate verbatim (same unit ERPNext stores/copies), exactly
  // like the link control's fetch_from handling.
  http.post("/api/method/frappe.model.utils.get_fetch_values", async ({ request }) => {
    await delay(60)
    const fd = await request.formData().catch(() => new FormData())
    const doctype = String(fd.get("doctype") ?? "")
    const fieldname = String(fd.get("fieldname") ?? "")
    const value = String(fd.get("value") ?? "")

    const fetch_values: Record<string, unknown> = {}
    if (doctype === "Sales Order" && fieldname === "sales_partner") {
      const rate = salesPartnerCommissionRate[value]
      if (rate !== undefined) {
        fetch_values.commission_rate = rate
      }
    }
    if (doctype === "Sales Team" && fieldname === "sales_person") {
      const rate = salesPersonCommissionRate[value]
      if (rate !== undefined) {
        fetch_values.commission_rate = rate
      }
    }

    return HttpResponse.json({ message: { fetch_values } })
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
