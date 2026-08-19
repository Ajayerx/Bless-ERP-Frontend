import { http, HttpResponse, delay } from "msw"
import { quotations, quotationItems, quotationTaxes, paymentScheduleRows } from "./frappe-lookups"

// ── Quotation mock backend (ERPNext form endpoints) ─────────────────
// Mirrors the exact wire contract of the Quotation workspace:
//   frappe.desk.form.load.getdoc      → { docs: [doc], docinfo }
//   frappe.desk.form.save.savedocs    → { message, docs: [doc] }
//   frappe.desk.form.save.cancel      → { message }
// plus the fetch flows (get_item_details, get_taxes_and_charges,
// get_party_details, get_email_template) and declare_enquiry_lost.

let store: Record<string, unknown>[] = quotations.map((q) => ({ ...q }))

function fullDoc(row: (typeof store)[number]): Record<string, unknown> {
  return {
    doctype: "Quotation",
    name: String(row.name ?? ""),
    title: String(row.customer_name ?? ""),
    quotation_to: String(row.quotation_to ?? "Customer"),
    party_name: String(row.party_name ?? ""),
    customer_name: String(row.customer_name ?? ""),
    transaction_date: String(row.transaction_date ?? ""),
    valid_till: String(row.valid_till ?? ""),
    order_type: String(row.order_type ?? "Sales"),
    company: String(row.company ?? "BlessERP Inc."),
    currency: String(row.currency ?? "CAD"),
    conversion_rate: 1,
    selling_price_list: "Standard Selling",
    price_list_currency: String(row.currency ?? "CAD"),
    plc_conversion_rate: 1,
    total_qty: 98,
    base_total: 2450,
    base_net_total: 2450,
    total: 2450,
    net_total: 2450,
    base_total_taxes_and_charges: 366.89,
    total_taxes_and_charges: 366.89,
    base_grand_total: 2816.89,
    base_rounding_adjustment: 0,
    base_rounded_total: 2816.89,
    base_in_words: "Two Thousand Eight Hundred Sixteen Dollars and Eighty-Nine Cents Only",
    grand_total: 2816.89,
    rounding_adjustment: 0,
    rounded_total: 2816.89,
    disable_rounded_total: 0,
    in_words: "Two Thousand Eight Hundred Sixteen Dollars and Eighty-Nine Cents Only",
    tax_category: "Standard",
    taxes_and_charges: "Canada GST/QST - BE",
    items: quotationItems,
    taxes: quotationTaxes,
    payment_schedule: paymentScheduleRows,
    group_same_items: 0,
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

export const quotationHandlers = [
  // ── Open doc: frappe.desk.form.load.getdoc ─────────────────────────
  http.post("/api/method/frappe.desk.form.load.getdoc", async ({ request }) => {
    await delay(150)
    const fields = await formFields(request)
    const name = fields.name ?? ""
    const row = store.find((q) => q.name === name)
    if (!row) return HttpResponse.json({ message: `Quotation ${name} not found` }, { status: 404 })
    return HttpResponse.json({
      docs: [fullDoc(row)],
      docinfo: {
        doctype: "Quotation",
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
    const action = (fields.action ?? "Save") as "Save" | "Submit" | "Update"
    const incoming = safeJson<Record<string, unknown>>(fields.doc ?? "", {})

    let doc: Record<string, unknown>
    const existingName = String(incoming.name ?? "")
    const idx = store.findIndex((q) => String(q.name) === existingName)

    if (idx === -1) {
      docCounter += 1
      const name = `SAL-QTN-2026-${String(Number(store.length) + 1000 + docCounter)}`
      const newRow: Record<string, unknown> = {
        name,
        title: incoming.customer_name ?? incoming.party_name ?? "",
        quotation_to: incoming.quotation_to ?? "Customer",
        party_name: incoming.party_name ?? "",
        customer_name: incoming.customer_name ?? "",
        transaction_date: incoming.transaction_date ?? new Date().toISOString().slice(0, 10),
        valid_till: incoming.valid_till ?? "",
        order_type: incoming.order_type ?? "Sales",
        company: incoming.company ?? "BlessERP Inc.",
        currency: incoming.currency ?? "CAD",
        grand_total: incoming.grand_total ?? 0,
        rounded_total: incoming.rounded_total ?? incoming.grand_total ?? 0,
        status: action === "Submit" ? "Open" : "Draft",
        docstatus: action === "Submit" ? 1 : 0,
        owner: "admin@blesserp.com",
        creation: nowStamp(),
        modified: nowStamp(),
        modified_by: "admin@blesserp.com",
        ...incoming,
      }
      store = [newRow, ...store]
      doc = fullDoc(newRow)
    } else {
      const row = store[idx]
      const merged = { ...row, ...incoming }
      if (action === "Submit") {
        merged.docstatus = 1
        merged.status = "Open"
      } else if (incoming.docstatus === 2) {
        merged.docstatus = 2
        merged.status = "Cancelled"
      } else {
        // Save/Update on a submitted doc must NOT reset it to Draft.
        merged.docstatus = row.docstatus ?? merged.docstatus
        merged.status = Number(merged.docstatus) === 1 ? (row.status ?? "Open") : merged.status ?? "Draft"
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
    const idx = store.findIndex((q) => String(q.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Quotation ${name} not found` }, { status: 404 })
    store[idx] = { ...store[idx], docstatus: 2, status: "Cancelled", modified: nowStamp(), modified_by: "admin@blesserp.com" }
    return HttpResponse.json({ message: name })
  }),

  // ── Set as Lost: declare_enquiry_lost ─────────────────────────────
  http.post("/api/method/erpnext.selling.doctype.quotation.quotation.declare_enquiry_lost", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const name = fields.source_name ?? ""
    const idx = store.findIndex((q) => String(q.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Quotation ${name} not found` }, { status: 404 })
    const lostReasons = safeJson<string[]>(fields.lost_reasons_list ?? "", [])
    const competitors = safeJson<string[]>(fields.competitors ?? "", [])
    store[idx] = {
      ...store[idx],
      status: "Lost",
      order_lost_reason: fields.detailed_reason ?? lostReasons.join(", "),
      lost_reasons: lostReasons.map((r) => ({ lost_reason: r })),
      competitors: competitors.map((c) => ({ competitor: c })),
      modified: nowStamp(),
      modified_by: "admin@blesserp.com",
    }
    return HttpResponse.json({ message: "Quotation marked as Lost" })
  }),

  // ── Fetch flow: get_item_details ──────────────────────────────────
  http.post("/api/method/erpnext.stock.get_item_details.get_item_details", async ({ request }) => {
    await delay(120)
    const fields = await formFields(request)
    const args = safeJson<Record<string, unknown>>(fields.args ?? "", {})
    const itemCode = String(args.item_code ?? "")
    const items: Record<string, unknown> = {
      "PRD-001": { item_name: "Organic All-Purpose Flour", uom: "Nos", conversion_factor: 1, price_list_rate: 25.0, rate: 25.0, amount: 0, warehouse: "Main Warehouse", income_account: "Income - BE", cost_center: "Main - BE", description: "Organic all-purpose flour, 10kg bag", stock_uom: "Nos", stock_qty: 0, is_free_item: 0 },
      "PRD-002": { item_name: "Cold-Pressed Canola Oil", uom: "Nos", conversion_factor: 1, price_list_rate: 5.5, rate: 5.5, amount: 0, warehouse: "Main Warehouse", income_account: "Income - BE", cost_center: "Main - BE", description: "Cold-pressed canola oil, 1L", stock_uom: "Nos", stock_qty: 0, is_free_item: 0 },
      "PRD-003": { item_name: "Wild Blueberry Jam", uom: "Nos", conversion_factor: 1, price_list_rate: 15.0, rate: 15.0, amount: 0, warehouse: "Main Warehouse", income_account: "Income - BE", cost_center: "Main - BE", description: "Wild blueberry jam, 500g jar", stock_uom: "Nos", stock_qty: 0, is_free_item: 0 },
      "PRD-004": { item_name: "Atlantic Smoked Salmon", uom: "Nos", conversion_factor: 1, price_list_rate: 9.0, rate: 9.0, amount: 0, warehouse: "Cold Storage", income_account: "Income - BE", cost_center: "Main - BE", description: "Smoked salmon fillets, 250g pack", stock_uom: "Nos", stock_qty: 0, is_free_item: 0 },
      "PRD-005": { item_name: "Maple Syrup (Grade A)", uom: "Nos", conversion_factor: 1, price_list_rate: 28.0, rate: 28.0, amount: 0, warehouse: "Main Warehouse", income_account: "Income - BE", cost_center: "Main - BE", description: "Grade A maple syrup, 750ml bottle", stock_uom: "Nos", stock_qty: 0, is_free_item: 0 },
    }
    const qty = Number(args.qty ?? 1)
    const base = items[itemCode] as Record<string, unknown> | undefined
    if (!base) return HttpResponse.json({ message: "Invalid item" })
    const rate = Number(base.price_list_rate)
    return HttpResponse.json({
      message: {
        ...base,
        item_code: itemCode,
        qty,
        amount: Math.round(rate * qty * 100) / 100,
        delivery_date: args.delivery_date ?? "",
      },
    })
  }),

  // ── Fetch flow: get_taxes_and_charges ─────────────────────────────
  http.post("/api/method/erpnext.controllers.accounts_controller.get_taxes_and_charges", async ({ request }) => {
    await delay(120)
    const fields = await formFields(request)
    const masterName = fields.master_name ?? ""
    if (masterName === "Canada GST/QST - BE") {
      return HttpResponse.json({ message: quotationTaxes })
    }
    return HttpResponse.json({ message: [] })
  }),

  // ── Fetch flow: get_party_details ─────────────────────────────────
  http.post("/api/method/erpnext.accounts.party.get_party_details", async ({ request }) => {
    await delay(150)
    const fields = await formFields(request)
    const party = fields.party ?? ""
    const partyType = fields.party_type ?? "Customer"
    const customerNames: Record<string, string> = {
      "CUST-0001": "Maple Leaf Bakery",
      "CUST-0002": "Northern Lights Coffee",
      "CUST-0003": "Blue Mountain Supplies",
      "CUST-0004": "Great Lakes Trading",
      "CUST-0005": "Red Maple Imports",
      "CUST-0006": "Pacific Coast Distributors",
      "CUST-0007": "Prairie Grain Co.",
      "CUST-0008": "Eastern Seafood Co.",
      "CUST-0009": "Golden Harvest Organic",
      "CUST-0010": "Summit Logistics",
    }
    const name = customerNames[party] ?? party
    return HttpResponse.json({
      message: {
        customer: party,
        customer_name: name,
        currency: "CAD",
        conversion_rate: 1,
        selling_price_list: "Standard Selling",
        price_list_currency: "CAD",
        plc_conversion_rate: 1,
        customer_group: "Commercial",
        territory: "Canada",
        language: "en",
        tax_category: "Standard",
        taxes_and_charges: "Canada GST/QST - BE",
        payment_terms_template: "Net 30",
        customer_address: party === "CUST-0001" ? "ADR-CUST-0001" : "",
        address_display: name + "\n123 Main Street\nToronto, ON",
        shipping_address_name: "",
        shipping_address: "",
        contact_person: party === "CUST-0001" ? "CONT-CUST-0001" : "",
        contact_display: "John Baker",
        contact_mobile: "+1 416 555 0100",
        contact_email: "john.baker@example.com",
        company_address: "ADR-COMP-0001",
        company_address_display: "BlessERP Inc.\n500 Commerce Blvd\nOttawa, ON",
        party_type: partyType,
      },
    })
  }),

  // ── Fetch flow: get_email_template ────────────────────────────────
  http.post("/api/method/frappe.email.doctype.email_template.email_template.get_email_template", async ({ request }) => {
    await delay(120)
    const fields = await formFields(request)
    const templateName = fields.template_name ?? ""
    const doc = safeJson<Record<string, unknown>>(fields.doc ?? "", {})
    const templates: Record<string, { subject: string; message: string }> = {
      "Quotation Follow Up": {
        subject: "Quotation {{doc.name}} for {{doc.customer_name}}",
        message: "<p>Dear {{doc.customer_name}},</p><p>Please find our quotation attached.</p>",
      },
      "Quotation Welcome": {
        subject: "Your estimate from BlessERP",
        message: "<p>Hello {{doc.customer_name}},</p><p>Thanks for your interest — here is the quote.</p>",
      },
    }
    const tpl = templates[templateName] ?? {
      subject: `Quotation ${String(doc.name ?? "")}`,
      message: "<p>Please find the quotation attached.</p>",
    }
    return HttpResponse.json({ message: tpl })
  }),
]
