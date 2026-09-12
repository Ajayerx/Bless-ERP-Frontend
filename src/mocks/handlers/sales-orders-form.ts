import { http, HttpResponse, delay, passthrough } from "msw"
import { salesOrders, quotationItems, quotationTaxes, paymentScheduleRows } from "./frappe-lookups"

// Keeps the shared list pseudo-array in sync so the REST /resource/Sales Order
// handlers (frappe-lookups) resolve doc mutations (status, items, totals) by
// name on the next reload.
function syncListRow(name: string, row: Record<string, unknown>): void {
  const listIdx = salesOrders.findIndex((s) => String(s.name) === String(name))
  if (listIdx === -1) {
    salesOrders.push(row as (typeof salesOrders)[number])
    return
  }
  salesOrders[listIdx] = row as (typeof salesOrders)[number]
}

// ── Sales Order mock backend (ERPNext form endpoints) ───────────────
// Mirrors the exact wire contract of the Sales Order workspace:
//   frappe.desk.form.load.getdoc      → { docs: [doc], docinfo }
//   frappe.desk.form.save.savedocs    → { message, docs: [doc] }
//   frappe.desk.form.save.cancel      → { message }
// plus the status action (update_status) and the Create-menu mapped-doc
// and stock-reservation endpoints.

let store: Record<string, unknown>[] = salesOrders.map((s) => ({ ...s }))

// Seeding hook for mapped-doc flows (e.g. quotation → Sales Order via
// make_mapped_doc) that create brand-new sales orders server-side. Returns
// the seam-ready document row so the caller can resolve its detail route.
export function addSalesOrderRow(row: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    name: String(row.name ?? ""),
    customer: String(row.customer ?? ""),
    customer_name: String(row.customer_name ?? ""),
    transaction_date: String(row.transaction_date ?? ""),
    delivery_date: String(row.delivery_date ?? ""),
    company: String(row.company ?? "BlessERP Inc."),
    currency: String(row.currency ?? "CAD"),
    grand_total: Number(row.grand_total ?? 0),
    status: String(row.status ?? "Draft"),
    docstatus: Number(row.docstatus ?? 0),
    owner: String(row.owner ?? "admin@blesserp.com"),
    creation: String(row.creation ?? ""),
    modified: String(row.modified ?? row.creation ?? ""),
    modified_by: String(row.modified_by ?? row.owner ?? "admin@blesserp.com"),
    ...row,
  }
  store = [merged, ...store.filter((s) => String(s.name) !== String(merged.name))]
  // Keep the shared list pseudo-array in sync so the REST /resource/Sales Order
  // handlers (frappe-lookups) can resolve the freshly created doc by name.
  const existing = salesOrders.findIndex((s) => String(s.name) === String(merged.name))
  if (existing === -1) salesOrders.push(merged as (typeof salesOrders)[number])
  else salesOrders[existing] = merged as (typeof salesOrders)[number]
  return fullDoc(merged)
}

export function fullDoc(row: Record<string, unknown>): Record<string, unknown> {
  return {
    doctype: "Sales Order",
    name: String(row.name ?? ""),
    title: String(row.customer_name ?? ""),
    customer: String(row.customer ?? ""),
    customer_name: String(row.customer_name ?? ""),
    transaction_date: String(row.transaction_date ?? ""),
    delivery_date: String(row.delivery_date ?? ""),
    order_type: String(row.order_type ?? "Sales"),
    company: String(row.company ?? "BlessERP Inc."),
    currency: String(row.currency ?? "CAD"),
    conversion_rate: Number(row.conversion_rate ?? 1),
    selling_price_list: String(row.selling_price_list ?? "Standard Selling"),
    price_list_currency: String(row.price_list_currency ?? row.currency ?? "CAD"),
    plc_conversion_rate: Number(row.plc_conversion_rate ?? 1),
    skip_delivery_note: Number(row.skip_delivery_note ?? 0),
    reserve_stock: Number(row.reserve_stock ?? 0),
    disable_rounded_total: Number(row.disable_rounded_total ?? 0),
    total_qty: Number(row.total_qty ?? 98),
    base_total: Number(row.base_total ?? 2450),
    base_net_total: Number(row.base_net_total ?? 2450),
    total: Number(row.total ?? 2450),
    net_total: Number(row.net_total ?? 2450),
    base_total_taxes_and_charges: Number(row.base_total_taxes_and_charges ?? 366.89),
    total_taxes_and_charges: Number(row.total_taxes_and_charges ?? 366.89),
    base_grand_total: Number(row.base_grand_total ?? 2816.89),
    base_rounding_adjustment: Number(row.base_rounding_adjustment ?? 0),
    base_rounded_total: Number(row.base_rounded_total ?? 2816.89),
    base_in_words: String(row.base_in_words ?? "Two Thousand Eight Hundred Sixteen Dollars and Eighty-Nine Cents Only"),
    grand_total: Number(row.grand_total ?? 2816.89),
    rounding_adjustment: Number(row.rounding_adjustment ?? 0),
    rounded_total: Number(row.rounded_total ?? 2816.89),
    in_words: String(row.in_words ?? "Two Thousand Eight Hundred Sixteen Dollars and Eighty-Nine Cents Only"),
    tax_category: String(row.tax_category ?? "Standard"),
    taxes_and_charges: String(row.taxes_and_charges ?? "Canada GST/QST - BE"),
    apply_discount_on: String(row.apply_discount_on ?? "Grand Total"),
    sales_partner: String(row.sales_partner ?? ""),
    amount_eligible_for_commission: Number(row.amount_eligible_for_commission ?? 0),
    commission_rate: Number(row.commission_rate ?? 0),
    total_commission: Number(row.total_commission ?? 0),
    items: Array.isArray(row.items) ? row.items : quotationItems.map((i) => ({ ...i, doctype: "Sales Order Item", parentfield: "items", parenttype: "Sales Order" })),
    taxes: Array.isArray(row.taxes) ? row.taxes : quotationTaxes.map((t) => ({ ...t, doctype: "Sales Taxes and Charges", parentfield: "taxes", parenttype: "Sales Order" })),
    payment_schedule: Array.isArray(row.payment_schedule) ? row.payment_schedule : paymentScheduleRows.map((p) => ({ ...p, doctype: "Payment Schedule", parentfield: "payment_schedule", parenttype: "Sales Order" })),
    packed_items: Array.isArray(row.packed_items) ? row.packed_items : [],
    sales_team: Array.isArray(row.sales_team) ? row.sales_team : [],
    pricing_rules: Array.isArray(row.pricing_rules) ? row.pricing_rules : [],
    per_delivered: Number(row.per_delivered ?? 0),
    per_billed: Number(row.per_billed ?? 0),
    group_same_items: Number(row.group_same_items ?? 0),
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

// Server-side SellingController.calculate_commission / calculate_contribution
// parity: recompute commission + Sales Team amounts from the item grid on save
// (mirrors sales_common.js calculate_commission + calculate_incentive).
function applyCommission(doc: Record<string, unknown>): Record<string, unknown> {
  const round2 = (n: number): number => Math.round(n * 100) / 100
  const items = Array.isArray(doc.items) ? (doc.items as Record<string, unknown>[]) : []
  const conv = Number(doc.conversion_rate ?? 1) || 1
  const amountEligible = items.reduce(
    (sum, item) =>
      Number(item.grant_commission)
        ? sum + Number(item.base_net_amount ?? item.base_amount ?? round2(Number(item.amount ?? 0) * conv))
        : sum,
    0,
  )
  const rate = Number(doc.commission_rate ?? 0) || 0
  const totalCommission = round2((amountEligible * rate) / 100)
  const salesTeam = Array.isArray(doc.sales_team) ? (doc.sales_team as Record<string, unknown>[]) : []
  // selling_controller.py calculate_contribution parity: allocated_amount is
  // recomputed for every row (flt(eligible * pct / 100)), and incentives only
  // when the row has a commission_rate (flt(allocated_amount * rate / 100)).
  const nextSalesTeam = salesTeam.map((row) => {
    const pct = Number(row.allocated_percentage ?? 0) || 0
    const cr = Number(row.commission_rate ?? 0) || 0
    const allocatedAmount = round2((amountEligible * pct) / 100)
    const incentives = cr ? round2((allocatedAmount * cr) / 100) : (row.incentives ?? 0)
    return { ...row, allocated_amount: allocatedAmount, incentives }
  })
  return {
    ...doc,
    amount_eligible_for_commission: amountEligible,
    total_commission: totalCommission,
    sales_team: nextSalesTeam,
  }
}

// selling_controller.py calculate_contribution parity: when a Sales Team
// exists, the total of all allocated_percentage rows must equal 100.
// Throws (like ERPNext's frappe.throw) otherwise.
function validateSalesTeamAllocation(doc: Record<string, unknown>): void {
  const salesTeam = Array.isArray(doc.sales_team) ? (doc.sales_team as Record<string, unknown>[]) : []
  if (salesTeam.length === 0) return
  const total = salesTeam.reduce((sum, r) => sum + (Number(r.allocated_percentage ?? 0) || 0), 0)
  if (Math.abs(total - 100) > 0.01) {
    const err = new Error("Total allocated percentage for sales team should be 100")
    ;(err as Error & { exc_type?: string }).exc_type = "ValidationError"
    throw err
  }
}

// frappe.model.throw → ValidationError envelope: a 417 with the human reason
// in _server_messages, which the desk savedocs error path surfaces verbatim.
function validationErrorResponse(message: string) {
  return HttpResponse.json(
    {
      message,
      exc_type: "ValidationError",
      exc: `ValidationError\n\tat validate (Sales Order)\n\tMessage: ${message}`,
      _server_messages: JSON.stringify([
        { message, title: "Message", indicator: "red", raise_exception: 1 },
      ]),
    },
    { status: 417 },
  )
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

export const salesOrderFormHandlers = [
  // ── Open doc: frappe.desk.form.load.getdoc ─────────────────────────
  http.post("/api/method/frappe.desk.form.load.getdoc", async ({ request }) => {
    await delay(150)
    const fields = await formFields(request)
    const name = fields.name ?? ""
    const row = store.find((s) => s.name === name)
    // Not a Sales Order we know about — hand off to a later doctype handler
    // (e.g. the quotation mock backend shares this endpoint).
    if (!row) return passthrough()
    return HttpResponse.json({
      docs: [fullDoc(row)],
      docinfo: {
        doctype: "Sales Order",
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
    const incoming = safeJson<Record<string, unknown>>(fields.doc ?? "", {})
    if (incoming.doctype && String(incoming.doctype) !== "Sales Order") return passthrough()

    // selling_controller.py calculate_contribution parity: Sales Team rows
    // must total 100% allocated — otherwise ERPNext blocks the save.
    try {
      validateSalesTeamAllocation(incoming)
    } catch (err) {
      return validationErrorResponse((err as Error).message)
    }

    const payload = applyCommission(incoming)

    const action = (fields.action ?? "Save") as "Save" | "Submit" | "Update"

    let doc: Record<string, unknown>
    const existingName = String(incoming.name ?? "")
    const idx = store.findIndex((s) => String(s.name) === existingName)

    if (idx === -1) {
      docCounter += 1
      const name = `SAL-ORD-2026-${String(Number(store.length) + 1000 + docCounter)}`
      const newRow: Record<string, unknown> = {
        name,
        customer: payload.customer ?? "",
        customer_name: payload.customer_name ?? "",
        transaction_date: payload.transaction_date ?? new Date().toISOString().slice(0, 10),
        delivery_date: payload.delivery_date ?? "",
        company: payload.company ?? "BlessERP Inc.",
        currency: payload.currency ?? "CAD",
        grand_total: payload.grand_total ?? 0,
        status: action === "Submit" ? "To Deliver and Bill" : "Draft",
        docstatus: action === "Submit" ? 1 : 0,
        per_delivered: 0,
        per_billed: 0,
        owner: "admin@blesserp.com",
        creation: nowStamp(),
        modified: nowStamp(),
        modified_by: "admin@blesserp.com",
        ...payload,
      }
      store = [newRow, ...store]
      // Keep the shared list pseudo-array in sync so the REST /resource/Sales Order
      // handlers (frappe-lookups) can resolve the freshly created doc by name.
      if (!salesOrders.some((s) => String(s.name) === name)) {
        salesOrders.push(newRow as (typeof salesOrders)[number])
      }
      doc = fullDoc(newRow)
    } else {
      const row = store[idx]
      const merged = { ...row, ...payload }
      if (action === "Submit") {
        merged.docstatus = 1
        merged.status = "To Deliver and Bill"
      } else if (payload.docstatus === 2) {
        merged.docstatus = 2
        merged.status = "Cancelled"
      } else {
        merged.docstatus = row.docstatus ?? merged.docstatus
        merged.status = Number(merged.docstatus) === 1 ? (row.status ?? "To Deliver and Bill") : merged.status ?? "Draft"
      }
      merged.modified = nowStamp()
      merged.modified_by = "admin@blesserp.com"
      store[idx] = merged
      syncListRow(existingName, merged)
      doc = fullDoc(merged)
    }

    return HttpResponse.json({ message: "Saved", docs: [doc] })
  }),

  // ── Cancel: frappe.desk.form.save.cancel ──────────────────────────
  http.post("/api/method/frappe.desk.form.save.cancel", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const name = fields.name ?? ""
    const dt = fields.doctype ?? ""
    if (dt && String(dt) !== "Sales Order") return passthrough()
    const idx = store.findIndex((s) => String(s.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Sales Order ${name} not found` }, { status: 404 })
    store[idx] = { ...store[idx], docstatus: 2, status: "Cancelled", modified: nowStamp(), modified_by: "admin@blesserp.com" }
    return HttpResponse.json({ message: name })
  }),

  // ── Update status: Hold / Close / Resume / Re-open ────────────────
  http.post("/api/method/erpnext.selling.doctype.sales_order.sales_order.update_status", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const name = fields.name ?? ""
    const status = fields.status ?? ""
    const idx = store.findIndex((s) => String(s.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Sales Order ${name} not found` }, { status: 404 })
    const updated = { ...store[idx], status, modified: nowStamp(), modified_by: "admin@blesserp.com" }
    store[idx] = updated
    // Keep the shared list pseudo-array in sync so the REST /resource/Sales Order
    // reload (loadDoc after a status change) sees the new status.
    syncListRow(name, updated)
    return HttpResponse.json({ message: status })
  }),

  // ── Update Items: erpnext.controllers.accounts_controller.update_child_qty_rate ──
  // Mirrors ERPNext v15 exactly: rows matched by child-row docname are updated;
  // rows without a docname are INSERTED as new child rows; the parent is saved.
  // Persists to both the form `store` and the shared REST list so the workspace
  // reload (loadDoc) reflects the change on the main items grid.
  http.post("/api/method/erpnext.controllers.accounts_controller.update_child_qty_rate", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const name = String(fields.parent_doctype_name ?? "")
    const transItems = safeJson<Array<Record<string, unknown>>>(fields.trans_items ?? "[]", [])
    const idx = store.findIndex((s) => String(s.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Sales Order ${name} not found` }, { status: 404 })

    const doc = store[idx]
    const items: Record<string, unknown>[] = Array.isArray(doc.items)
      ? (doc.items as Record<string, unknown>[]).map((i) => ({ ...i }))
      : quotationItems.map((i) => ({ ...i, doctype: "Sales Order Item", parentfield: "items", parenttype: "Sales Order" }))

    for (const t of transItems) {
      if (!t.item_code) continue
      const docname = String(t.docname ?? "")
      let row =
        docname !== ""
          ? items.find((i) => String(i.name ?? "") === docname)
          : undefined
      // Store rows seeded from the list fixture carry no child-row names, so
      // fall back to item_code identity (unique within an SO) — this is what
      // the served doc's withItemNames also uses.
      if (!row) row = items.find((i) => String(i.item_code) === String(t.item_code))
      if (row) {
        row.qty = Number(t.qty ?? row.qty ?? 0)
        row.rate = Number(t.rate ?? row.rate ?? 0)
        if (t.uom !== undefined && t.uom !== null) row.uom = t.uom
        if (t.conversion_factor !== undefined && t.conversion_factor !== null) {
          row.conversion_factor = Number(t.conversion_factor)
        }
        row.amount = Math.round((Number(row.rate) || 0) * (Number(row.qty) || 0) * 100) / 100
      } else {
        const newRow: Record<string, unknown> = {
          name: `new-sales-order-item-${Math.random().toString(36).slice(2, 10)}`,
          doctype: "Sales Order Item",
          parentfield: "items",
          parenttype: "Sales Order",
          parent: name,
          item_code: t.item_code,
          item_name: String(t.item_name ?? t.item_code),
          qty: Number(t.qty ?? 1),
          rate: Number(t.rate ?? 0),
          uom: t.uom ?? "",
          conversion_factor: Number(t.conversion_factor ?? 1),
          amount: 0,
        }
        newRow.amount = Math.round((Number(newRow.rate) || 0) * (Number(newRow.qty) || 0) * 100) / 100
        items.push(newRow)
      }
    }

    const round2 = (n: number): number => Math.round(n * 100) / 100
    const totalQty = round2(items.reduce((s, i) => s + (Number(i.qty) || 0), 0))
    const netTotal = round2(items.reduce((s, i) => s + (Number(i.amount) || 0), 0))
    const originalBaseTotal = Number(doc.base_total) || 0
    const originalTax = Number(doc.base_total_taxes_and_charges) || 0
    const taxPct = originalBaseTotal > 0 ? originalTax / originalBaseTotal : 0.14975
    const taxAmt = round2(netTotal * taxPct)
    const grandTotal = round2(netTotal + taxAmt)

    const merged: Record<string, unknown> = {
      ...doc,
      items,
      total_qty: totalQty,
      base_total: netTotal,
      base_net_total: netTotal,
      total: netTotal,
      net_total: netTotal,
      base_total_taxes_and_charges: taxAmt,
      total_taxes_and_charges: taxAmt,
      base_grand_total: grandTotal,
      grand_total: grandTotal,
      base_rounded_total: grandTotal,
      rounded_total: grandTotal,
      modified: nowStamp(),
      modified_by: "admin@blesserp.com",
    }
    store[idx] = merged
    syncListRow(name, merged)
    return HttpResponse.json({ message: "Updated" })
  }),

  // ── Fetch flow: get_item_details ──────────────────────────────────
  // Mirrors the quotation mock handler so item codes selected in the Update
  // Items dialog resolve price/rate/warehouse/income-account details exactly
  // like they do for a Quotation (the dialog enriches via the same desk call
  // erpnext.stock.get_item_details.get_item_details).
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

  // ── Fetch flow: get_conversion_factor ─────────────────────────────
  http.post("/api/method/erpnext.stock.get_item_details.get_conversion_factor", async ({ request }) => {
    await delay(100)
    const fields = await formFields(request)
    void fields
    return HttpResponse.json({ message: { conversion_factor: 1 } })
  }),

  // ── Terms tab: payment terms template → payment schedule ───────────
  http.post("/api/method/erpnext.controllers.accounts_controller.get_payment_terms", async () => {
    await delay(150)
    return HttpResponse.json({
      message: paymentScheduleRows.map((p) => ({ ...p })),
    })
  }),

  http.post("/api/method/erpnext.controllers.accounts_controller.get_payment_term_details", async ({ request }) => {
    await delay(150)
    const fields = await formFields(request)
    const term = String(fields.term ?? "")
    return HttpResponse.json({
      message: {
        payment_term: term,
        description: `Payment due ${term}`,
        due_date: new Date().toISOString().slice(0, 10),
        invoice_portion: 50,
        payment_amount: 1000,
        base_payment_amount: 1000,
        due_date_based_on: "Day(s) after invoice date",
        credit_days: 30,
        mode_of_payment: "",
        discount_date_based_on: "",
        discount: 0,
        discount_type: "",
        discount_validity: 0,
        discount_validity_based_on: "",
      },
    })
  }),

  http.post("/api/method/erpnext.setup.doctype.terms_and_conditions.terms_and_conditions.get_terms_and_conditions", async ({ request }) => {
    await delay(150)
    const fields = await formFields(request)
    const templateName = String(fields.template_name ?? "")
    void templateName
    return HttpResponse.json({
      message: "<p>All goods are sold subject to the standard Terms and Conditions.</p>",
    })
  }),

  // ── Auto Repeat: update Auto Repeat reference (Update Auto Repeat Reference button) ──
  http.post("/api/method/frappe.desk.doctype.auto_repeat.auto_repeat.update_reference", async ({ request }) => {
    await delay(150)
    const fields = await formFields(request)
    void fields
    return HttpResponse.json({ message: "success" })
  }),

  // ── Stock reservation: create / cancel ────────────────────────────
  http.post("/api/method/erpnext.selling.doctype.sales_order.sales_order.create_stock_reservation_entries", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const items = safeJson<Array<Record<string, unknown>>>(fields.items ?? "[]", [])
    const idx = store.findIndex((s) => String(s.name) === String(fields.sales_order ?? ""))
    if (idx !== -1) {
      const rows = (fullDoc(store[idx]).items as Record<string, unknown>[]).map((it) => {
        const target = items.find((i) => String(i.sales_order_item) === String(it.name))
        return target ? { ...it, reserve_stock: 1, stock_reserved_qty: Number(target.qty_to_reserve ?? it.qty) } : it
      })
      store[idx] = { ...store[idx], items: rows }
    }
    return HttpResponse.json({ message: "Stock reservations created" })
  }),

  http.post("/api/method/erpnext.selling.doctype.sales_order.sales_order.cancel_stock_reservation_entries", async ({ request }) => {
    await delay(200)
    const fields = await formFields(request)
    const idx = store.findIndex((s) => String(s.name) === String(fields.sales_order ?? ""))
    if (idx !== -1) {
      const rows = (Array.isArray(store[idx].items) ? store[idx].items : []).map((it) => ({
        ...(it as Record<string, unknown>),
        stock_reserved_qty: 0,
      }))
      store[idx] = { ...store[idx], items: rows }
    }
    return HttpResponse.json({ message: "Stock reservations cancelled" })
  }),
]
