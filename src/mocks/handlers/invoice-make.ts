import { localDateISO } from "@/lib/utils"
import { http, HttpResponse, delay } from "msw"
import { salesInvoices, quotations, quotationItems, quotationTaxes, salesOrders } from "./frappe-lookups"
import { addQuotationRow } from "./quotations"
import { fullDoc } from "./sales-orders-form"

// ERPNext "Create" actions from the Sales Invoice toolbar (sales_invoice.js
// + frappe.model.mapper.make_mapped_doc). Each returns the fresh target doc
// `{ doctype, name }`, which the invoice workspace resolves to a route.

let counter = 0
const nextName = (prefix: string) => `${prefix}-${String(++counter).padStart(4, "0")}`

interface MakeDocResult {
  doctype: string
  name: string
}

// method → { doctype, namePrefix } for make_mapped_doc-style targets.
const MAPPED_TARGETS: Record<string, { doctype: string; prefix: string }> = {
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_sales_return": {
    doctype: "Sales Invoice",
    prefix: "SINV-RET",
  },
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_delivery_note": {
    doctype: "Delivery Note",
    prefix: "DN",
  },
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.create_invoice_discounting": {
    doctype: "Invoice Discounting",
    prefix: "INV-DIS",
  },
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.create_dunning": {
    doctype: "Dunning",
    prefix: "DUN",
  },
  "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_inter_company_purchase_invoice": {
    doctype: "Purchase Invoice",
    prefix: "PINV-IC",
  },
  "erpnext.selling.doctype.sales_invoice.sales_invoice.make_maintenance_schedule": {
    doctype: "Maintenance Schedule",
    prefix: "MNT-SCH",
  },
  "erpnext.selling.doctype.quotation.quotation.make_sales_order": {
    doctype: "Sales Order",
    prefix: "SAL-ORD",
  },
  "erpnext.selling.doctype.quotation.quotation.make_sales_invoice": {
    doctype: "Sales Invoice",
    prefix: "SINV",
  },
  "erpnext.crm.doctype.opportunity.opportunity.make_quotation": {
    doctype: "Quotation",
    prefix: "SAL-QTN",
  },
}

function jsonBody(body: string): Record<string, unknown> {
  try {
    return JSON.parse(body) as Record<string, unknown>
  } catch {
    return {}
  }
}

// Sales Order → Sales Invoice / Payment Entry brokers return an UNSAVED mapped
// doc (no server name), mirroring ERPNext's open_mapped_doc contract.
function mappedSalesInvoiceFromSo(sourceName: string) {
  const so = salesOrders.find((row) => String(row.name) === String(sourceName))
  if (!so) return { doctype: "Sales Invoice", items: [], taxes: [], payment_schedule: [], sales_team: [] }

  // ERPNext's get_mapped_doc copies all same-name fields from SO → SI
  // generically; only a few are overridden via field_map. We mirror this by
  // spreading the full SO doc and then applying SI-specific overrides.
  const soDoc = fullDoc(so as Record<string, unknown>)
  const soName = String(soDoc.name)
  const convRate = Number(soDoc.conversion_rate ?? 1) || 1
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  const round6 = (n: number) => Math.round((n + Number.EPSILON) * 1e6) / 1e6

  // ── Item condition (make_sales_invoice mapper) ────────────────────
  // Keep zero-qty unit-price rows (rate-adjustment / debit-note) and rows
  // with quantity still to bill that have amount headroom; map qty = pending,
  // amount = order amount − billed.
  const hasUnitPriceItems = Number(soDoc.has_unit_price_items ?? 0) === 1
  const soItems: Record<string, unknown>[] = Array.isArray(soDoc.items) ? soDoc.items : []
  const items = soItems
    .map((i, idx) => {
      const qty = Number(i.qty ?? 0)
      const amount = Number(i.amount ?? 0)
      const baseAmount = Number(i.base_amount ?? 0)
      const billedAmt = Number(i.billed_amt ?? 0)
      const billedQty = Number(i.billed_qty ?? 0)
      const returnedQty = Number(i.returned_qty ?? 0)
      const deliveredQty = Number(i.delivered_qty ?? 0)
      const isUnitPriceRow = hasUnitPriceItems && qty === 0
      const isAmountBillable = baseAmount === 0 || Math.abs(billedAmt) < Math.abs(amount)
      const pendingQty = Math.min(qty, Math.max(qty - returnedQty, deliveredQty)) - billedQty
      const keep = isUnitPriceRow || (qty !== 0 && isAmountBillable && round6(pendingQty) > 0)
      if (!keep) return null
      const mappedQty = isUnitPriceRow ? qty : Math.max(round6(pendingQty), 0)
      const mappedAmount = round2(amount - billedAmt)
      const rate = Number(i.rate ?? 0)
      const netAmount = round2(mappedQty * rate)
      return {
        ...i,
        name: String(i.name ?? i.item_code ?? `sinv-item-${idx + 1}`),
        doctype: "Sales Invoice Item",
        parentfield: "items",
        parenttype: "Sales Invoice",
        parent: undefined,
        so_detail: String(i.name ?? i.item_code ?? `sinv-item-${idx + 1}`),
        sales_order: soName,
        qty: mappedQty,
        amount: mappedAmount,
        base_amount: round2(mappedAmount * convRate),
        net_amount: netAmount,
        net_rate: rate,
        base_rate: round2(rate * convRate),
        base_net_amount: round2(netAmount * convRate),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  // ── Taxes from SO (get_mapped_doc generic copy) ──────────────────
  const soTaxes: Record<string, unknown>[] = Array.isArray(soDoc.taxes) ? soDoc.taxes : []
  const taxes: Record<string, unknown>[] = soTaxes.map((t, idx) => ({
    ...t,
    doctype: "Sales Taxes and Charges",
    parentfield: "taxes",
    parenttype: "Sales Invoice",
    name: String(idx + 1),
  }))

  // ── Recalculate header totals from mapped items/taxes ────────────
  const netTotal = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const totalTaxes = taxes.reduce((sum, t) => {
    const chargeType = String(t.charge_type ?? "On Net Total")
    const rate = Number(t.rate ?? 0)
    if (chargeType === "On Net Total") return sum + round2(netTotal * (rate / 100))
    return sum + Number(t.tax_amount ?? 0)
  }, 0)
  const grandTotal = round2(netTotal + totalTaxes)
  const roundedTotal = soDoc.disable_rounded_total ? 0 : grandTotal

  // ── Build mapped SI: spread SO header, apply SI overrides ────────
  // ERPNext field_map for SO → SI: posting_date ← transaction_date,
  // due_date ← delivery_date; set_missing_values populates naming_series,
  // update_stock, status, etc. Everything else is a generic same-name copy.
  const { items: _soItems, doctype: _soDoctype, name: _soName, taxes: _soTaxes, ...soHeader } = soDoc as Record<string, unknown>
  void _soItems; void _soDoctype; void _soName; void _soTaxes

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19)

  return {
    ...soHeader,
    doctype: "Sales Invoice",
    naming_series: "INV-",
    posting_date: soDoc.transaction_date as string || localDateISO(new Date()),
    due_date: soDoc.delivery_date as string || localDateISO(new Date()),
    update_stock: 0,
    status: "Draft",
    docstatus: 0,
    per_billed: 0,
    per_delivered: 0,
    outstanding_amount: grandTotal,
    net_total: netTotal,
    base_net_total: round2(netTotal * convRate),
    total_taxes_and_charges: totalTaxes,
    base_total_taxes_and_charges: round2(totalTaxes * convRate),
    grand_total: grandTotal,
    base_grand_total: round2(grandTotal * convRate),
    rounded_total: roundedTotal,
    base_rounded_total: round2(roundedTotal * convRate),
    items,
    taxes,
    payment_schedule: Array.isArray(soDoc.payment_schedule) ? soDoc.payment_schedule : [],
    sales_team: Array.isArray(soDoc.sales_team) ? soDoc.sales_team : [],
    owner: "admin@blesserp.com",
    creation: stamp,
    modified: stamp,
    modified_by: "admin@blesserp.com",
  }
}

// Sales Order → Payment Entry (get_payment_entry): an unsaved Payment Entry
// mapped from the order's outstanding, as ERPNext returns it.
function mappedPaymentEntryFromSo(sourceName: string) {
  const so = salesOrders.find((row) => String(row.name) === String(sourceName))
  const raw = so as Record<string, unknown> | undefined
  const outstanding = Number(so?.grand_total ?? 2450.0)
  return {
    doctype: "Payment Entry",
    naming_series: "ACC-PAY-.YYYY.-",
    payment_type: "Receive",
    posting_date: localDateISO(new Date()),
    party_type: "Customer",
    party: String(so?.customer ?? "CUST-0001"),
    party_name: String(so?.customer_name ?? "Maple Leaf Bakery"),
    party_balance: outstanding,
    company: String(so?.company ?? "BlessERP Inc."),
    paid_from: "Accounts Receivable - BE",
    paid_from_account_currency: String(raw?.["currency"] ?? "CAD"),
    paid_to: "Cash - BE",
    paid_to_account_currency: String(raw?.["currency"] ?? "CAD"),
    paid_amount: outstanding,
    received_amount: outstanding,
    total_allocated_amount: outstanding,
    status: "Draft",
    docstatus: 0,
    references: [
      {
        reference_doctype: "Sales Order",
        reference_name: String(sourceName),
        total_amount: outstanding,
        outstanding_amount: outstanding,
        allocated_amount: outstanding,
        exchange_rate: 1,
      },
    ],
    owner: "admin@blesserp.com",
    creation: new Date().toISOString().replace("T", " ").slice(0, 19),
    modified: new Date().toISOString().replace("T", " ").slice(0, 19),
    modified_by: "admin@blesserp.com",
  }
}

export const invoiceMakeHandlers = [
  // ── Payment Entry (get_payment_entry) ──────────────────────────────
  http.post("/api/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry", async ({ request }) => {
    await delay(150)
    const body = jsonBody(await request.text())
    const result = mappedPaymentEntryFromSo(String(body.source_name ?? body.dn ?? ""))
    return HttpResponse.json({ message: result })
  }),

  // ── Payment Request (make_payment_request) ─────────────────────────
  http.post("/api/method/erpnext.accounts.doctype.payment_request.payment_request.make_payment_request", async ({ request }) => {
    await delay(150)
    void request
    const result: MakeDocResult = { doctype: "Payment Request", name: nextName("PR") }
    return HttpResponse.json({ message: result })
  }),

  // ── Mapped docs: Return / Delivery Note / Discounting / Dunning / ──
  //    Inter-Company PI / Maintenance Schedule (make_mapped_doc) ─────
  http.post("/api/method/frappe.model.mapper.make_mapped_doc", async ({ request }) => {
    await delay(150)
    const body = jsonBody(await request.text())
    const method = String(body.method ?? "")
    const sourceName = String(body.source_name ?? "")

    // Sales Order → Sales Invoice mirrors the real ERPNext response: an
    // UNSAVED prefilled mapped doc (no server name) that the SPA opens as a
    // new editable Sales Invoice form — exactly like open_mapped_doc.
    if (method === "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice") {
      return HttpResponse.json({ message: mappedSalesInvoiceFromSo(sourceName) })
    }

    const target = MAPPED_TARGETS[method] ?? { doctype: "Sales Invoice", prefix: "SINV-MAP" }
    const result: MakeDocResult = { doctype: target.doctype, name: nextName(target.prefix) }
    let message: unknown = result

    // make_sales_order (quotation → SO) mirrors the real ERPNext response:
    // an UNSAVED prefilled mapped doc (no server name) that the SPA opens as
    // a new editable Sales Order form — exactly like open_mapped_doc.
    const today = localDateISO(new Date())
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 19)
    if (target.doctype === "Sales Order") {
      const sourceQuotation = quotations.find((q) => q.name === body.source_name)
      const fromQuotation = method === "erpnext.selling.doctype.quotation.quotation.make_sales_order" && sourceQuotation
      message = {
        doctype: "Sales Order",
        naming_series: "SO-",
        customer: fromQuotation ? String(sourceQuotation.party_name ?? "CUST-0001") : "CUST-0001",
        customer_name: fromQuotation ? String(sourceQuotation.customer_name ?? "Maple Leaf Bakery") : "Maple Leaf Bakery",
        transaction_date: fromQuotation ? String(sourceQuotation.transaction_date ?? today) : today,
        delivery_date: today,
        company: "BlessERP Inc.",
        currency: fromQuotation ? String(sourceQuotation.currency ?? "CAD") : "CAD",
        grand_total: fromQuotation ? Number(sourceQuotation.grand_total ?? 0) : 2450.0,
        rounded_total: fromQuotation ? Number(sourceQuotation.rounded_total ?? sourceQuotation.grand_total ?? 0) : 2450.0,
        status: "Draft",
        docstatus: 0,
        per_delivered: 0,
        per_billed: 0,
        items: quotationItems.map((i) => ({ ...i, doctype: "Sales Order Item" })),
        taxes: quotationTaxes.map((t) => ({ ...t, doctype: "Sales Taxes and Charges" })),
        payment_schedule: [],
        owner: "admin@blesserp.com",
        creation: stamp,
        modified: stamp,
        modified_by: "admin@blesserp.com",
      }
    }
    if (target.doctype === "Sales Invoice" && !salesInvoices.some((si) => si.name === result.name)) {
      salesInvoices.push({
        name: result.name,
        customer: "CUST-0001",
        customer_name: "Maple Leaf Bakery",
        grand_total: 2450.0,
        outstanding_amount: 2450.0,
        posting_date: today,
        due_date: today,
        creation: stamp,
        status: "Draft",
        docstatus: 0,
        owner: "admin@blesserp.com",
        modified: stamp,
        modified_by: "admin@blesserp.com",
      })
    }
    if (target.doctype === "Quotation") {
      addQuotationRow({
        name: result.name,
        customer_name: "Maple Leaf Bakery",
        party_name: "CUST-0001",
        transaction_date: today,
        valid_till: "",
        currency: "CAD",
        grand_total: 0,
        rounded_total: 0,
        status: "Draft",
        docstatus: 0,
        owner: "admin@blesserp.com",
        creation: stamp,
        modified: stamp,
        modified_by: "admin@blesserp.com",
      })
    }

    return HttpResponse.json({ message })
  }),
]
