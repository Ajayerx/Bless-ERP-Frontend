import { apiClient, apiFormCall, serverDownloadTemplate, serverMessagesFromBody, failedNamesFromMessages, type AppMessage } from "@/services/api-client"
import { postMethodRaw, getDocCount, validateLink } from "@/services/frappe-client"
import type {
  PurchaseInvoice, PurchaseInvoiceListResponse, PurchaseInvoiceListFilters,
  PurchaseInvoiceDoc, PurchaseInvoiceItem, PurchaseInvoiceItemDoc,
  PurchaseInvoiceItemForm, PurchaseInvoiceTaxFormRow,
  PurchaseInvoiceFormData, MappedPurchaseInvoice,
} from "../types"
import {
  getPurchaseInvoiceIndicator,
  PURCHASE_INVOICE_FILTER_TUPLES,
  PURCHASE_INVOICE_INDICATOR_LABELS,
  type PurchaseInvoiceIndicator,
  type PurchaseInvoiceIndicatorInput,
  type PurchaseInvoiceIndicatorLabel,
  type PurchaseInvoiceIndicatorVariant,
} from "./indicator"
export type {
  PurchaseInvoice, PurchaseInvoiceListResponse, PurchaseInvoiceListFilters,
  PurchaseInvoiceDoc, PurchaseInvoiceItem, PurchaseInvoiceItemDoc,
  PurchaseInvoiceItemForm, PurchaseInvoiceTaxFormRow,
  PurchaseInvoiceFormData, MappedPurchaseInvoice,
}
export {
  getPurchaseInvoiceIndicator,
  PURCHASE_INVOICE_FILTER_TUPLES,
  PURCHASE_INVOICE_INDICATOR_LABELS,
  type PurchaseInvoiceIndicator,
  type PurchaseInvoiceIndicatorInput,
  type PurchaseInvoiceIndicatorLabel,
  type PurchaseInvoiceIndicatorVariant,
}

const DOCTYPE = "Purchase Invoice"

/** Fields the bills list page needs. */
const LIST_FIELDS = [
  "name", "supplier", "supplier_name", "posting_date", "due_date",
  "company", "currency", "grand_total", "rounded_total", "total_taxes_and_charges",
  "outstanding_amount", "paid_amount", "status", "docstatus", "total_qty",
  "amended_from", "owner", "creation", "modified",
]

const dnum = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : 0)

function buildListUrl(
  params: {
    fields: string[]
    filters?: unknown[]
    limit_page_length?: number
    limit_start?: number
    order_by?: string
  }
): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(DOCTYPE)}?${qp.toString()}`
}

async function getCount(filters?: unknown[]): Promise<number> {
  return getDocCount(DOCTYPE, filters)
}

function mapStatus(doc: Record<string, unknown>): PurchaseInvoice["status"] {
  if (Number(doc.docstatus) === 2) return "cancelled"
  const s = String(doc.status ?? "").toLowerCase()
  if (s === "draft") return "draft"
  if (s === "return" || s === "credit note issued") return "return"
  const outstanding = dnum(doc.outstanding_amount)
  const paid = dnum(doc.paid_amount)
  if (outstanding <= 0) return "paid"
  if (paid > 0) return "partly_paid"
  return "not_paid"
}

function indicatorFrom(doc: Record<string, unknown>): PurchaseInvoiceIndicator {
  return getPurchaseInvoiceIndicator({
    docstatus: dnum(doc.docstatus),
    outstanding_amount: dnum(doc.outstanding_amount),
    paid_amount: dnum(doc.paid_amount),
    due_date: String(doc.due_date ?? ""),
  })
}

function mapItem(row: Record<string, unknown>): PurchaseInvoiceItem {
  return {
    name: String(row.name ?? ""),
    itemCode: String(row.item_code ?? ""),
    itemName: String(row.item_name ?? ""),
    description: String(row.description ?? ""),
    qty: dnum(row.qty),
    rate: dnum(row.rate),
    amount: dnum(row.amount),
    uom: String(row.uom ?? ""),
    conversionFactor: dnum(row.conversion_factor) || 1,
    warehouse: String(row.warehouse ?? ""),
    costCenter: String(row.cost_center ?? ""),
    project: String(row.project ?? ""),
    expenseAccount: String(row.expense_account ?? ""),
    purchaseOrder: String(row.purchase_order ?? ""),
    purchaseOrderItem: String(row.purchase_order_item ?? ""),
  }
}

function mapDoc(doc: Record<string, unknown>): PurchaseInvoice {
  const indicator = indicatorFrom(doc)
  const grandTotal = dnum(doc.grand_total)
  const outstanding = typeof doc.outstanding_amount === "number" ? doc.outstanding_amount : dnum(doc.outstanding_amount)
  return {
    id: String(doc.name),
    name: String(doc.name),
    number: String(doc.name),
    supplierId: String(doc.supplier ?? ""),
    supplierName: String(doc.supplier_name ?? doc.supplier ?? ""),
    postingDate: String(doc.posting_date ?? ""),
    dueDate: String(doc.due_date ?? ""),
    company: String(doc.company ?? ""),
    currency: String(doc.currency ?? ""),
    status: mapStatus(doc),
    indicator: indicator.label,
    docstatus: (Number(doc.docstatus) ? Math.min(Number(doc.docstatus), 2) : 0) as PurchaseInvoice["docstatus"],
    items: (Array.isArray(doc.items) ? doc.items : []).map(mapItem),
    totalNet: dnum(doc.net_total ?? doc.total_net),
    totalTaxes: dnum(doc.total_taxes_and_charges),
    grandTotal,
    roundedTotal: dnum(doc.rounded_total) || grandTotal,
    outstandingAmount: outstanding,
    paidAmount: dnum(doc.paid_amount) || Math.max(grandTotal - outstanding, 0),
    totalQty: dnum(doc.total_qty),
    createdAt: String(doc.creation ?? doc.posting_date ?? ""),
    modified: String(doc.modified ?? ""),
  }
}

async function fetchLinkOptions(doctype: string, orderByField = "name", filters?: unknown[]): Promise<string[]> {
  try {
    const rows = await apiClient<Array<{ name: string }>>(
      buildListUrl({
        fields: ["name"],
        order_by: `${orderByField} asc`,
        limit_page_length: 0,
        filters,
      }).replace(`/resource/${encodeURIComponent(DOCTYPE)}`, `/resource/${encodeURIComponent(doctype)}`)
    )
    return rows.map((r) => r.name)
  } catch {
    return []
  }
}

export const billLookups = {
  companies: () => fetchLinkOptions("Company"),
  currencies: () => fetchLinkOptions("Currency"),
  buyingPriceLists: () => fetchLinkOptions("Price List", "name", [["buying", "=", 1]]),
  warehouses: () => fetchLinkOptions("Warehouse", "name", [["is_group", "=", 0]]),
  suppliers: () => fetchLinkOptions("Supplier"),
  paymentTermsTemplates: () => fetchLinkOptions("Payment Terms Template"),
  costCenters: () => fetchLinkOptions("Cost Center", "name", [["is_group", "=", 0]]),
  expenseAccounts: () => fetchLinkOptions("Account", "name", [
    ["account_type", "=", "Expense Account"],
    ["is_group", "=", 0],
  ]),
  taxTemplates: () => fetchLinkOptions("Purchase Taxes and Charges Template"),
  projects: () => fetchLinkOptions("Project"),
}

// ── Link search / validation (search_link wire format) ────────────────
const searchLinkInFlight = new Map<string, Promise<{ value: string; label: string; description: string }[]>>()

export async function searchLink(
  doctype: string,
  query: string,
  referenceDoctype?: string,
  filters?: unknown[][] | Record<string, string | number | boolean | unknown[]>,
  customQuery?: string,
  ignoreUserPermissions?: boolean,
): Promise<{ value: string; label: string; description: string }[]> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  qp.set("txt", query)
  if (referenceDoctype) qp.set("reference_doctype", referenceDoctype)
  qp.set("ignore_user_permissions", ignoreUserPermissions ? "1" : "0")
  if (filters) qp.set("filters", JSON.stringify(filters))
  if (customQuery) qp.set("query", customQuery)
  qp.set("page_length", "10")
  const url = `/method/frappe.desk.search.search_link?${qp.toString()}`
  const inflight = searchLinkInFlight.get(url)
  if (inflight) return inflight
  const promise = apiClient<{ value: string; label: string; description: string }[]>(url).catch(() => [])
  searchLinkInFlight.set(url, promise)
  promise.finally(() => {
    searchLinkInFlight.delete(url)
  })
  return promise
}

export async function validateBillLink(doctype: string, docname: string): Promise<void> {
  await validateLink(doctype, docname, [])
}

/** frappe.client.get_value — read one field (or object of fields) of a doc. */
export async function getValue(
  doctype: string,
  fieldname: string | string[],
  filters: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiClient<Record<string, unknown>>(`/method/frappe.client.get_value`, {
    method: "POST",
    body: JSON.stringify({ doctype, fieldname, filters }),
  })
}

interface DeleteEligibilityRow {
  name: string
  docstatus: number
  amended_from?: string | null
}

function planBulkDelete(
  requested: string[],
  selected: DeleteEligibilityRow[],
  amendments: Array<{ name: string; amended_from?: string | null }>,
): { deletable: string[]; failed: string[]; messages: AppMessage[] } {
  const statusBy = new Map(selected.map((row) => [row.name, row.docstatus]))
  const childByParent = new Map<string, string>()
  for (const row of amendments) {
    if (row.amended_from) childByParent.set(row.amended_from, row.name)
  }

  const deletable: string[] = []
  const failed: string[] = []
  const messages: AppMessage[] = []
  for (const name of requested) {
    const linkedAmendment = childByParent.get(name)
    if (linkedAmendment) {
      failed.push(name)
      messages.push({
        message: `${name} is linked with Purchase Invoice ${linkedAmendment}. Delete that amendment first, then try again.`,
      })
    } else if (statusBy.get(name) === 1) {
      failed.push(name)
      messages.push({ message: `${name} is already submitted. Cancel it first, then try again.` })
    } else if (statusBy.has(name)) {
      deletable.push(name)
    } else {
      failed.push(name)
      messages.push({ message: `${name} was not found.` })
    }
  }
  return { deletable, failed, messages }
}

export const PURCHASE_INVOICE_EXPORT_FIELDS: Record<string, string[]> = {
  "Purchase Invoice": [
    "name", "supplier", "supplier_name", "posting_date", "due_date",
    "company", "currency", "grand_total", "rounded_total", "total_taxes_and_charges",
    "outstanding_amount", "paid_amount", "status", "docstatus",
  ],
  items: [
    "item_code", "item_name", "description", "qty", "rate", "amount",
    "uom", "expense_account", "warehouse", "cost_center", "project",
  ],
  taxes: [
    "charge_type", "account_head", "description", "rate", "tax_amount", "total",
  ],
}

export const billService = {
  lookups: billLookups,
  searchLink,
  validateLink: validateBillLink,
  getValue,

  // ── Fetch flows (form field fills) ────────────────────────────────
  async getExchangeRate(fromCurrency: string, toCurrency: string, transactionDate: string): Promise<number> {
    const rate = await apiFormCall<number | string>(
      "/method/erpnext.setup.utils.get_exchange_rate",
      [
        ["from_currency", fromCurrency],
        ["to_currency", toCurrency],
        ["transaction_date", transactionDate],
        ["args", '"for_buying"'],
      ],
    )
    return Number(rate) || 0
  },

  async getItemDetailsDesk(
    doc: Record<string, unknown>,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    try {
      return await apiFormCall<Record<string, unknown>>(
        "/method/erpnext.stock.get_item_details.get_item_details",
        [
          ["doc", JSON.stringify(doc)],
          ["args", JSON.stringify(args)],
        ],
      )
    } catch {
      return null
    }
  },

  async getPaymentTerms(
    template: string,
    postingDate: string,
    grandTotal: number,
  ): Promise<{ payment_schedule: Array<Record<string, unknown>> }> {
    let result: unknown
    try {
      result = await apiFormCall<{ payment_schedule?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
        "/method/erpnext.controllers.accounts_controller.get_payment_terms",
        [
          ["terms_template", template],
          ["posting_date", postingDate],
          ["grand_total", String(grandTotal)],
        ],
      )
    } catch {
      return { payment_schedule: [] }
    }
    if (Array.isArray(result)) return { payment_schedule: result }
    return { payment_schedule: (result as { payment_schedule?: Array<Record<string, unknown>> } | null)?.payment_schedule ?? [] }
  },

  async getTerms(templateName: string, doc: Record<string, unknown>): Promise<string | null> {
    try {
      const result = await apiFormCall<string | Record<string, unknown>>(
        "/method/erpnext.setup.doctype.terms_and_conditions.terms_and_conditions.get_terms_and_conditions",
        [
          ["template_name", templateName],
          ["doc", JSON.stringify(doc)],
        ],
      )
      return typeof result === "string" ? result : null
    } catch {
      return null
    }
  },

  async list(params: PurchaseInvoiceListFilters = {}): Promise<PurchaseInvoiceListResponse> {
    const pageSize = params.pageLength ?? params.pageSize ?? 10
    const limit_start = params.start != null ? params.start : ((params.page ?? 1) - 1) * pageSize
    const filters: unknown[] = []

    if (params.search) {
      filters.push([
        "OR",
        [[DOCTYPE, "name", "like", `%${params.search}%`]],
        [[DOCTYPE, "supplier_name", "like", `%${params.search}%`]],
      ])
    }
    if (params.status && params.status !== "all" && params.status !== "All") {
      const tuples = PURCHASE_INVOICE_FILTER_TUPLES[params.status as PurchaseInvoiceIndicatorLabel]
      if (tuples) filters.push(...tuples.map(([field, op, val]) => [DOCTYPE, field, op, val]))
    }
    if (params.supplier) filters.push([DOCTYPE, "supplier", "=", params.supplier])
    if (params.company) filters.push([DOCTYPE, "company", "=", params.company])
    if (params.postingDateFrom) filters.push([DOCTYPE, "posting_date", ">=", params.postingDateFrom])
    if (params.postingDateTo) filters.push([DOCTYPE, "posting_date", "<=", params.postingDateTo])
    if (params.dueDateFrom) filters.push([DOCTYPE, "due_date", ">=", params.dueDateFrom])
    if (params.dueDateTo) filters.push([DOCTYPE, "due_date", "<=", params.dueDateTo])
    if (params.filters && params.filters.length > 0) filters.push(...params.filters)

    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "posting_date desc"

    const [rows, total] = await Promise.all([
      apiClient<Record<string, unknown>[]>(
        buildListUrl({
          fields: LIST_FIELDS,
          filters: filters.length > 0 ? filters : undefined,
          limit_start,
          limit_page_length: pageSize,
          order_by,
        })
      ),
      getCount(filters.length > 0 ? filters : undefined),
    ])

    return {
      items: (rows ?? []).map(mapDoc),
      total,
      page: params.page ?? 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getById(name: string): Promise<PurchaseInvoice> {
    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify([...LIST_FIELDS, "items", "taxes", "base_grand_total", "net_total"]))
    const doc = await apiClient<Record<string, unknown>>(
      `/resource/${DOCTYPE}/${encodeURIComponent(name)}?${qp.toString()}`
    )
    return mapDoc(doc)
  },

  async getDoc(name: string): Promise<PurchaseInvoiceDoc> {
    return apiClient<PurchaseInvoiceDoc>(`/resource/${DOCTYPE}/${encodeURIComponent(name)}`)
  },

  // frappe.desk.form.save.savedocs ({ doc, action: Save|Update|Submit }).
  async saveDoc(doc: Record<string, unknown>, action: "Save" | "Update" | "Submit"): Promise<PurchaseInvoiceDoc> {
    const body = await postMethodRaw<{ message?: string; docs?: PurchaseInvoiceDoc[] }>(
      "frappe.desk.form.save.savedocs",
      { doc: JSON.stringify(doc), action },
    )
    return body.docs?.[0] as PurchaseInvoiceDoc
  },

  async create(data: PurchaseInvoiceFormData): Promise<PurchaseInvoiceDoc> {
    return this.saveDoc({ ...data, doctype: DOCTYPE }, "Save")
  },

  async update(doc: Record<string, unknown>): Promise<PurchaseInvoiceDoc> {
    return this.saveDoc(doc, "Save")
  },

  async submit(doc: Record<string, unknown>): Promise<PurchaseInvoiceDoc> {
    return this.saveDoc(doc, "Submit")
  },

  async submitDoc(name: string): Promise<PurchaseInvoiceDoc> {
    return apiClient<PurchaseInvoiceDoc>(
      `/resource/${DOCTYPE}/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ docstatus: 1 }) },
    )
  },

  async cancelDoc(name: string): Promise<void> {
    const body = await postMethodRaw<{ message?: unknown }>("frappe.desk.form.save.cancel", {
      doctype: DOCTYPE,
      name,
    })
    const messages = serverMessagesFromBody(body)
    if (messages.length > 0) {
      const first = messages[0]
      throw new Error(first.message)
    }
  },

  async delete(name: string): Promise<void> {
    return apiClient<void>(`/resource/${DOCTYPE}/${encodeURIComponent(name)}`, { method: "DELETE" })
  },

  // Amend = client-side clone (amended_from, docstatus 0) re-saved as new.
  async amend(source: PurchaseInvoiceDoc): Promise<PurchaseInvoiceDoc> {
    const managedFields = new Set([
      "name", "creation", "modified", "modified_by", "owner",
      "docstatus", "_comments", "_assign", "_liked_by", "_user_tags",
    ])
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(source)) {
      if (managedFields.has(k)) continue
      if (Array.isArray(v)) {
        cleaned[k] = v.map((row: Record<string, unknown>) => {
          if (row && typeof row === "object") {
            const { name: _n, parent: _p, parentfield: _pf, parenttype: _pt, creation: _c, modified: _m, owner: _o, idx: _i, ...rest } = row as Record<string, unknown>
            return rest
          }
          return row
        })
      } else {
        cleaned[k] = v
      }
    }
    cleaned.doctype = DOCTYPE
    cleaned.amended_from = source.name
    cleaned.docstatus = 0
    cleaned.outstanding_amount = cleaned.grand_total ?? 0
    cleaned.paid_amount = 0
    return this.saveDoc(cleaned, "Save")
  },

  // ── Get Items From Purchase Order (open_mapped_doc → pre-filled PI) ──
  async getItemsFromPurchaseOrder(sourceName: string): Promise<MappedPurchaseInvoice> {
    return apiClient<MappedPurchaseInvoice>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_invoice", source_name: sourceName }) },
    )
  },

  // ── Bulk list actions ──────────────────────────────────────────────
  async bulkSubmit(names: string[]): Promise<{ failed: string[]; enqueued: boolean; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: string[] | null; failed?: string[] } & Record<string, unknown>>(
      "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
      { doctype: DOCTYPE, action: "submit", docnames: JSON.stringify(names) },
    )
    const msg = Array.isArray(result.message) ? result.message : []
    const messages = serverMessagesFromBody(result)
    const explicit = Array.isArray(result.failed) ? result.failed : msg
    return {
      failed: explicit.length > 0 ? explicit : failedNamesFromMessages(names, messages),
      enqueued: result.message == null,
      messages,
    }
  },

  async bulkCancel(names: string[]): Promise<{ failed: string[]; enqueued: boolean; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: string[] | null; failed?: string[] } & Record<string, unknown>>(
      "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
      { doctype: DOCTYPE, action: "cancel", docnames: JSON.stringify(names) },
    )
    const msg = Array.isArray(result.message) ? result.message : []
    const messages = serverMessagesFromBody(result)
    const explicit = Array.isArray(result.failed) ? result.failed : msg
    return {
      failed: explicit.length > 0 ? explicit : failedNamesFromMessages(names, messages),
      enqueued: result.message == null,
      messages,
    }
  },

  async bulkDelete(names: string[]): Promise<{ failed: string[]; deleted: string[]; messages: AppMessage[] }> {
    const requested = Array.from(new Set((names ?? []).filter(Boolean)))
    if (requested.length === 0) return { failed: [], deleted: [], messages: [] }

    let plan: { deletable: string[]; failed: string[]; messages: AppMessage[] } | null = null
    try {
      const fieldsQp = new URLSearchParams()
      fieldsQp.set("fields", JSON.stringify(["name", "docstatus", "amended_from"]))
      fieldsQp.set("limit_page_length", "0")
      const baseUrl = `/resource/${encodeURIComponent(DOCTYPE)}?${fieldsQp.toString()}`
      const [selected, amendments] = await Promise.all([
        apiClient<DeleteEligibilityRow[]>(
          `${baseUrl}&filters=${encodeURIComponent(JSON.stringify([["name", "in", requested]]))}`,
        ),
        apiClient<Array<{ name: string; amended_from?: string | null }>>(
          `${baseUrl}&filters=${encodeURIComponent(JSON.stringify([["amended_from", "in", requested]]))}`,
        ),
      ])
      plan = planBulkDelete(requested, selected ?? [], amendments ?? [])
    } catch {
      // Pre-flight unavailable — fall through to server-side reporting below.
    }

    if (plan) {
      if (plan.deletable.length === 0) {
        return { failed: plan.failed, deleted: [], messages: plan.messages }
      }
      const result = await postMethodRaw<{ message?: { undeleted_items?: string[] } | string[] } & Record<string, unknown>>(
        "frappe.desk.reportview.delete_items",
        { doctype: DOCTYPE, items: JSON.stringify(plan.deletable) },
      )
      const msg = result.message
      const serverMessages = serverMessagesFromBody(result)
      const undeleted = Array.isArray(msg) ? msg : Array.isArray(msg?.undeleted_items) ? msg.undeleted_items : []
      const deleted = plan.deletable.filter((name) => !undeleted.includes(name))
      const serverBlocked = plan.deletable.filter((name) => undeleted.includes(name))
      return {
        failed: [...plan.failed, ...serverBlocked],
        deleted,
        messages: [...plan.messages, ...serverMessages],
      }
    }

    const result = await postMethodRaw<{ message?: { undeleted_items?: string[] } | string[] } & Record<string, unknown>>(
      "frappe.desk.reportview.delete_items",
      { doctype: DOCTYPE, items: JSON.stringify(requested) },
    )
    const msg = result.message
    const serverMessages = serverMessagesFromBody(result)
    const undeleted = Array.isArray(msg) ? msg : Array.isArray(msg?.undeleted_items) ? msg.undeleted_items : []
    return {
      failed: undeleted,
      deleted: requested.filter((name) => !undeleted.includes(name)),
      messages: serverMessages,
    }
  },

  async exportRecords(options?: {
    fileType?: "CSV" | "Excel"
    recordMode?: "all" | "by_filter" | "5_records" | "blank_template"
    fields?: Record<string, string[]>
    filters?: unknown[]
  }): Promise<Blob> {
    return serverDownloadTemplate({
      doctype: DOCTYPE,
      fileType: options?.fileType ?? "CSV",
      recordMode: options?.recordMode ?? "by_filter",
      fields: options?.fields && Object.keys(options.fields).length > 0
        ? options.fields
        : PURCHASE_INVOICE_EXPORT_FIELDS,
      filters: options?.filters,
    })
  },
}