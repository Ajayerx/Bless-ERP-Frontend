import { apiClient, apiFormCall, serverDownloadTemplate, serverMessagesFromBody, failedNamesFromMessages, type AppMessage } from "@/services/api-client"
import { postMethodRaw, getDocCount, validateLink } from "@/services/frappe-client"
import type {
  PurchaseOrder, PurchaseOrderListResponse, PurchaseOrderFormData,
  PurchaseOrderDoc, PurchaseOrderItem, PurchaseOrderItemForm, PurchaseOrderTax,
  PurchaseOrderPaymentScheduleRow,
} from "../types"
import {
  getPurchaseOrderIndicator,
  PURCHASE_ORDER_FILTER_TUPLES,
  PURCHASE_ORDER_INDICATOR_LABELS,
  type PurchaseOrderIndicator,
  type PurchaseOrderIndicatorInput,
  type PurchaseOrderIndicatorLabel,
  type PurchaseOrderIndicatorVariant,
} from "./indicator"
export type {
  PurchaseOrder, PurchaseOrderListResponse, PurchaseOrderFormData,
  PurchaseOrderDoc, PurchaseOrderItem, PurchaseOrderItemForm, PurchaseOrderTax,
  PurchaseOrderPaymentScheduleRow,
}
export {
  getPurchaseOrderIndicator,
  PURCHASE_ORDER_FILTER_TUPLES,
  PURCHASE_ORDER_INDICATOR_LABELS,
  type PurchaseOrderIndicator,
  type PurchaseOrderIndicatorInput,
  type PurchaseOrderIndicatorLabel,
  type PurchaseOrderIndicatorVariant,
}

const DOCTYPE = "Purchase Order"

/** Fields the purchase order list page needs. */
const LIST_FIELDS = [
  "name", "supplier", "supplier_name", "transaction_date", "schedule_date",
  "company", "currency", "grand_total", "rounded_total", "status", "docstatus",
  "amended_from", "per_received", "per_billed", "set_warehouse",
  "owner", "creation", "modified", "modified_by", "_assign", "_user_tags",
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

function mapStatus(doc: Record<string, unknown>): PurchaseOrder["status"] {
  if (Number(doc.docstatus) === 2) return "cancelled"
  const s = String(doc.status ?? "").toLowerCase()
  if (s === "draft" || s === "on hold") return "draft"
  if (s === "completed" || s === "closed") return "received"
  if (s === "cancelled") return "cancelled"
  const perReceived = dnum(doc.per_received)
  if (perReceived >= 100) return "received"
  if (perReceived > 0) return "partially_received"
  return "ordered"
}

function mapAccumulation(doc: Record<string, unknown>): PurchaseOrder["accumulationStatus"] {
  if (Number(doc.docstatus) === 2) return "cancelled"
  const perReceived = dnum(doc.per_received)
  if (perReceived >= 100) return "received"
  if (perReceived > 0) return "partial"
  return "pending"
}

function indicatorFrom(doc: Record<string, unknown>): PurchaseOrderIndicator {
  return getPurchaseOrderIndicator({
    docstatus: dnum(doc.docstatus),
    status: String(doc.status ?? ""),
    per_received: dnum(doc.per_received),
    per_billed: dnum(doc.per_billed),
  })
}

function mapItem(row: Record<string, unknown>): PurchaseOrderItem {
  return {
    productId: String(row.item_code ?? ""),
    productName: String(row.item_name ?? ""),
    qty: dnum(row.qty),
    rate: dnum(row.rate),
    amount: dnum(row.amount),
  }
}

function mapDoc(doc: Record<string, unknown>): PurchaseOrder {
  const indicator = indicatorFrom(doc)
  return {
    id: String(doc.name),
    name: String(doc.name),
    number: String(doc.name),
    supplierId: String(doc.supplier ?? ""),
    supplierName: String(doc.supplier_name ?? doc.supplier ?? ""),
    issueDate: String(doc.transaction_date ?? ""),
    scheduleDate: String(doc.schedule_date ?? ""),
    status: mapStatus(doc),
    rawStatus: (String(doc.status ?? "") || "Draft") as PurchaseOrder["rawStatus"],
    indicator: indicator.label,
    docstatus: (Number(doc.docstatus) ? Math.min(Number(doc.docstatus), 2) : 0) as PurchaseOrder["docstatus"],
    items: (Array.isArray(doc.items) ? doc.items : []).map(mapItem),
    total: dnum(doc.grand_total),
    company: String(doc.company ?? ""),
    currency: String(doc.currency ?? ""),
    perReceived: dnum(doc.per_received),
    perBilled: dnum(doc.per_billed),
    accumulationStatus: mapAccumulation(doc),
    createdAt: String(doc.creation ?? doc.transaction_date ?? ""),
    modified: String(doc.modified ?? ""),
  }
}

export interface PurchaseOrderListFilters {
  search?: string
  page?: number
  pageLength?: number
  pageSize?: number
  start?: number
  status?: PurchaseOrderIndicatorLabel | "all" | "All" | string
  supplier?: string
  company?: string
  scheduleDateFrom?: string
  scheduleDateTo?: string
  transactionDateFrom?: string
  transactionDateTo?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
  /** Raw frappe filter tuples AND'd with the typed params. */
  filters?: unknown[][]
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

export const purchaseOrderLookups = {
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
  incomeAccounts: () => fetchLinkOptions("Account", "name", [
    ["account_type", "=", "Income Account"],
    ["is_group", "=", 0],
  ]),
  taxTemplates: () => fetchLinkOptions("Purchase Taxes and Charges Template"),
  items: () => fetchLinkOptions("Item"),
  project: () => fetchLinkOptions("Project"),
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

export async function validatePurchaseOrderLink(doctype: string, docname: string): Promise<void> {
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
        message: `${name} is linked with Purchase Order ${linkedAmendment}. Delete that amendment first, then try again.`,
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

export const PURCHASE_ORDER_EXPORT_FIELDS: Record<string, string[]> = {
  "Purchase Order": [
    "name", "supplier", "supplier_name", "transaction_date", "schedule_date",
    "company", "currency", "grand_total", "rounded_total", "total_taxes_and_charges",
    "per_received", "per_billed", "status", "docstatus",
  ],
  items: [
    "item_code", "item_name", "item_group", "brand", "qty", "rate", "amount",
    "uom", "warehouse", "schedule_date", "received_qty", "billed_qty",
  ],
  taxes: [
    "charge_type", "account_head", "description", "rate", "tax_amount", "total",
  ],
}

export const purchaseOrderService = {
  lookups: purchaseOrderLookups,
  searchLink,
  validateLink: validatePurchaseOrderLink,
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
  ): Promise<{ payment_schedule: PurchaseOrderPaymentScheduleRow[] }> {
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
    const rows = Array.isArray(result) ? result : ((result as { payment_schedule?: Array<Record<string, unknown>> } | null)?.payment_schedule ?? [])
    return { payment_schedule: rows.map((r) => ({ ...r })) as PurchaseOrderPaymentScheduleRow[] }
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

  async list(params: PurchaseOrderListFilters = {}): Promise<PurchaseOrderListResponse> {
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
      const tuples = PURCHASE_ORDER_FILTER_TUPLES[params.status as PurchaseOrderIndicatorLabel]
      if (tuples) filters.push(...tuples.map(([field, op, val]) => [DOCTYPE, field, op, val]))
    }
    if (params.supplier) filters.push([DOCTYPE, "supplier", "=", params.supplier])
    if (params.company) filters.push([DOCTYPE, "company", "=", params.company])
    if (params.transactionDateFrom) filters.push([DOCTYPE, "transaction_date", ">=", params.transactionDateFrom])
    if (params.transactionDateTo) filters.push([DOCTYPE, "transaction_date", "<=", params.transactionDateTo])
    if (params.scheduleDateFrom) filters.push([DOCTYPE, "schedule_date", ">=", params.scheduleDateFrom])
    if (params.scheduleDateTo) filters.push([DOCTYPE, "schedule_date", "<=", params.scheduleDateTo])
    if (params.filters && params.filters.length > 0) filters.push(...params.filters)

    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "transaction_date desc"

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

  async getById(name: string): Promise<PurchaseOrder> {
    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify([...LIST_FIELDS, "items", "base_grand_total"]))
    const doc = await apiClient<Record<string, unknown>>(
      `/resource/${DOCTYPE}/${encodeURIComponent(name)}?${qp.toString()}`
    )
    return mapDoc(doc)
  },

  async getDoc(name: string): Promise<PurchaseOrderDoc> {
    return apiClient<PurchaseOrderDoc>(`/resource/${DOCTYPE}/${encodeURIComponent(name)}`)
  },

  // frappe.desk.form.save.savedocs ({ doc, action: Save|Update|Submit }).
  async saveDoc(doc: Record<string, unknown>, action: "Save" | "Update" | "Submit"): Promise<PurchaseOrderDoc> {
    const body = await postMethodRaw<{ message?: string; docs?: PurchaseOrderDoc[] }>(
      "frappe.desk.form.save.savedocs",
      { doc: JSON.stringify(doc), action },
    )
    return body.docs?.[0] as PurchaseOrderDoc
  },

  async create(data: PurchaseOrderFormData): Promise<PurchaseOrderDoc> {
    return this.saveDoc({ ...data, doctype: DOCTYPE }, "Save")
  },

  async update(doc: Record<string, unknown>): Promise<PurchaseOrderDoc> {
    return this.saveDoc(doc, "Save")
  },

  async submit(doc: Record<string, unknown>): Promise<PurchaseOrderDoc> {
    return this.saveDoc(doc, "Submit")
  },

  async submitDoc(name: string): Promise<PurchaseOrderDoc> {
    return apiClient<PurchaseOrderDoc>(
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
  async amend(source: PurchaseOrderDoc): Promise<PurchaseOrderDoc> {
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
    cleaned.advance_paid = 0
    return this.saveDoc(cleaned, "Save")
  },

  // ── Make-doc workflow (whitelisted ERPNext mappers) ────────────────
  async makePurchaseReceipt(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_receipt", source_name: sourceName }) },
    )
  },

  async makePurchaseInvoice(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
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
        : PURCHASE_ORDER_EXPORT_FIELDS,
      filters: options?.filters,
    })
  },
}