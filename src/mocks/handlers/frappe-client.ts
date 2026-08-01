import { http, HttpResponse, delay } from "msw"

// ── Frappe client / ERPNext whitelisted method mocks ────────────────
// Mirrors the calls the Payment Entry form fires on open (validate_link,
// get_value, get_dimensions, get_exchange_rate, route_history).

export const frappeClientHandlers = [
  // ── POST /api/method/frappe.client.validate_link ──────────────────
  http.post("/api/method/frappe.client.validate_link", async ({ request }) => {
    await delay(60)
    const body = (await request.json().catch(() => ({}))) as {
      doctype?: string
      docname?: string
      fields?: string[]
    }
    const doctype = body.doctype || ""
    const docname = body.docname || ""

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
      const filters = url.searchParams.get("filters")
      if (filters && /BlessERP/i.test(filters)) {
        if (fieldname === "default_letter_head") {
          message = { default_letter_head: "Standard" }
        }
      }
    }

    return HttpResponse.json({ message })
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
]
