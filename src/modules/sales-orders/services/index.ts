import { apiClient, apiFormCall, apiClientWithBody, serverMessagesFromBody, failedNamesFromMessages, ApiError, type AppMessage } from "@/services/api-client"
import { postMethod, postMethodRaw } from "@/services/frappe-client"
import { buildTimelineItems, toQuillHtml } from "@/modules/payments/services"
import type { DocInfo, PaymentActivityItem, PaymentComment } from "@/modules/payments/types"
import {
  type SalesOrder,
  type SalesOrderListResponse,
  type SalesOrderDoc,
  type SalesOrderFormData,
  type SalesOrderTax,
} from "../types"

export type {
  SalesOrder,
  SalesOrderItem,
  SalesOrderListResponse,
  SalesOrderDoc,
  SalesOrderFormData,
  SalesOrderItemForm,
  SalesOrderTax,
  SalesOrderStatus,
  SalesOrderDocStatus,
} from "../types"

const DOCTYPE = "Sales Order"

// ── frappe.request.is_fresh equivalent (request.js:96-110) ──────────────
// Desk keeps url_history keyed on the serialized args and silently skips an
// identical request inside its debounce window. We mirror that so transient
// remounts (AnimatePresence page transitions) cannot fire the launch
// endpoints twice; suppressed calls resolve through each method's existing
// catch path, exactly like desk resolving early without sending.
const freshnessLog = new Map<string, number>()
const FRESH_WINDOW_MS = 500

function isFresh(key: string): boolean {
  const last = freshnessLog.get(key)
  const fresh = last === undefined || Date.now() - last >= FRESH_WINDOW_MS
  freshnessLog.set(key, Date.now())
  return fresh
}

async function dedupedFormCall<T>(
  cmd: string,
  fields: Array<[string, string]>,
  opts?: { doctype?: string },
): Promise<T> {
  if (!isFresh(`${cmd}|${JSON.stringify(fields)}`)) {
    if (import.meta.env.DEV) console.warn("[sales-orders] debounced duplicate:", cmd)
    throw new SuppressedDuplicateError()
  }
  return apiFormCall<T>(cmd, fields, opts)
}

/**
 * Thrown by dedupedFormCall when an identical request inside the freshness
 * window is skipped (desk is_fresh resolves early without sending). Callers
 * that must tell "skipped" apart from "failed" catch this class explicitly;
 * everyone else keeps treating it as their usual best-effort failure path.
 */
export class SuppressedDuplicateError extends Error {
  constructor() {
    super("suppressed-duplicate")
    this.name = "SuppressedDuplicateError"
  }
}

/** Test hook: clears the freshness log and cached static lookups. */
export function __resetSalesOrderFreshness(): void {
  freshnessLog.clear()
}

interface DocTypeOption {
  name: string
}

async function fetchOptions(doctype: string, filters?: unknown[]): Promise<string[]> {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(["name"]))
  qp.set("limit_page_length", "500")
  if (filters) qp.set("filters", JSON.stringify(filters))
  try {
    const items = await apiClient<DocTypeOption[]>(`/resource/${encodeURIComponent(doctype)}?${qp.toString()}`)
    return items.map((i) => i.name)
  } catch {
    return []
  }
}

/** Fields the sales order list page needs (name/status/party/dates/totals). */
const LIST_FIELDS = [
  "name", "title", "customer", "customer_name", "transaction_date",
  "delivery_date", "order_type", "company", "currency", "grand_total", "rounded_total",
  "status", "docstatus", "amended_from", "per_delivered", "per_billed",
  "owner", "creation", "modified", "modified_by", "_assign", "_user_tags",
]

const cint = (v: unknown): number => (Number(v) ? 1 : 0)
const dnum = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : 0)

const DESK_RANDOM_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"
export function deskRandomString(length = 10): string {
  let out = ""
  for (let i = 0; i < length; i++) {
    out += DESK_RANDOM_CHARS[Math.floor(Math.random() * DESK_RANDOM_CHARS.length)]
  }
  return out
}

// ── Light list mapping (ERPNext row → list page shape) ────────────────
function mapStatus(doc: Record<string, unknown>): SalesOrder["status"] {
  if (cint(doc.docstatus) === 2) return "cancelled"
  const s = String(doc.status ?? "").toLowerCase()
  if (s === "draft" || s === "on hold") return "draft"
  if (s === "completed" || s === "closed") return "completed"
  if (s === "cancelled") return "cancelled"
  return "confirmed"
}

function mapFulfillment(doc: Record<string, unknown>): SalesOrder["fulfillmentStatus"] {
  if (cint(doc.docstatus) === 2) return "cancelled"
  const perDelivered = dnum(doc.per_delivered)
  if (perDelivered >= 100) return "fulfilled"
  if (perDelivered > 0) return "partial"
  return "pending"
}

function mapDoc(doc: Record<string, unknown>): SalesOrder {
  return {
    id: String(doc.name),
    number: String(doc.name),
    customerId: String(doc.customer ?? ""),
    customerName: String(doc.customer_name ?? doc.customer ?? ""),
    issueDate: String(doc.transaction_date ?? ""),
    deliveryDate: String(doc.delivery_date ?? ""),
    status: mapStatus(doc),
    items: (Array.isArray(doc.items) ? doc.items : []).map((i) => {
      const row = i as Record<string, unknown>
      return {
        productId: String(row.item_code ?? ""),
        productName: String(row.item_name ?? ""),
        qty: dnum(row.qty),
        rate: dnum(row.rate),
        amount: dnum(row.amount),
      }
    }),
    total: dnum(doc.grand_total),
    perDelivered: dnum(doc.per_delivered),
    perBilled: dnum(doc.per_billed),
    fulfillmentStatus: mapFulfillment(doc),
    createdAt: String(doc.creation ?? doc.transaction_date ?? ""),
  }
}

interface BuildListUrlInput {
  fields: string[]
  filters?: unknown[]
  orFilters?: unknown[]
  limit_page_length: number
  limit_start: number
  order_by?: string
}

function buildListUrl(input: BuildListUrlInput): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(input.fields))
  if (input.filters && input.filters.length > 0) qp.set("filters", JSON.stringify(input.filters))
  if (input.orFilters && input.orFilters.length > 0) qp.set("or_filters", JSON.stringify(input.orFilters))
  qp.set("limit_page_length", String(input.limit_page_length))
  qp.set("limit_start", String(input.limit_start))
  if (input.order_by) qp.set("order_by", input.order_by)
  return `/resource/${encodeURIComponent(DOCTYPE)}?${qp.toString()}`
}

async function getCount(filters?: unknown[], orFilters?: unknown[]): Promise<number> {
  const qp = new URLSearchParams()
  if (filters && filters.length > 0) qp.set("filters", JSON.stringify(filters))
  if (orFilters && orFilters.length > 0) qp.set("or_filters", JSON.stringify(orFilters))
  qp.set("limit_page_length", "0")
  const res = await apiClient<unknown[] | { data?: unknown[] }>(`/resource/${encodeURIComponent(DOCTYPE)}?${qp.toString()}`)
  return Array.isArray(res) ? res.length : 0
}

// ── Desk child row envelope (for new-doc POST / amend clone) ──────────
interface DeskDocEnvelopeOptions {
  isNew: boolean
  owner?: string
}

function deskChildRow(
  row: Record<string, unknown>,
  childDoctype: string,
  parentfield: string,
  idx: number,
  parentName: string,
  opts: DeskDocEnvelopeOptions,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    docstatus: 0,
    doctype: childDoctype,
    name: row.name ?? "",
    ...(opts.isNew ? { __islocal: 1, __unsaved: 1 } : {}),
    ...(opts.owner !== undefined ? { owner: opts.owner } : {}),
  }
  if (childDoctype === "Sales Order Item") {
    Object.assign(out, {
      stock_uom: row.stock_uom ?? "",
      stock_uom_rate: dnum(row.stock_uom_rate),
      actual_qty: dnum(row.actual_qty),
      company_total_stock: 0,
      uom: row.uom ?? "",
      item_tax_template: row.item_tax_template ?? "",
      page_break: cint(row.page_break),
      parent: parentName,
      parentfield,
      parenttype: DOCTYPE,
      idx,
      qty: dnum(row.qty),
      conversion_factor: dnum(row.conversion_factor),
      stock_qty: dnum(row.stock_qty),
      price_list_rate: dnum(row.price_list_rate),
      base_price_list_rate: dnum(row.base_price_list_rate),
      margin_type: row.margin_type ?? "",
      margin_rate_or_amount: dnum(row.margin_rate_or_amount),
      rate_with_margin: dnum(row.rate_with_margin),
      rate: dnum(row.rate),
      net_rate: dnum(row.net_rate),
      amount: dnum(row.amount),
      net_amount: dnum(row.net_amount),
      base_rate: dnum(row.base_rate),
      base_net_rate: dnum(row.base_net_rate),
      base_amount: dnum(row.base_amount),
      base_net_amount: dnum(row.base_net_amount),
      discount_percentage: dnum(row.discount_percentage),
      discount_amount: dnum(row.discount_amount),
      distributed_discount_amount: dnum(row.distributed_discount_amount),
      is_free_item: cint(row.is_free_item),
      is_alternative: 0,
      has_alternative_item: 0,
      against_blanket_order: cint(row.against_blanket_order),
      grant_commission: cint(row.grant_commission),
      delivered_by_supplier: cint(row.delivered_by_supplier),
      reserve_stock: cint(row.reserve_stock),
      stock_reserved_qty: dnum(row.stock_reserved_qty),
      weight_per_unit: dnum(row.weight_per_unit),
      total_weight: dnum(row.total_weight),
      valuation_rate: 0,
      projected_qty: dnum(row.projected_qty),
      delivered_qty: dnum(row.delivered_qty),
      ordered_qty: dnum(row.ordered_qty),
      returned_qty: dnum(row.returned_qty),
      work_order_qty: dnum(row.work_order_qty),
      billed_amt: dnum(row.billed_amt),
      gross_profit: 0,
    })
    const extras: Array<[string, unknown]> = [
      ["item_code", row.item_code],
      ["item_name", row.item_name],
      ["item_group", row.item_group],
      ["brand", row.brand],
      ["description", row.description],
      ["warehouse", row.warehouse],
      ["income_account", row.income_account],
      ["cost_center", row.cost_center],
      ["delivery_date", row.delivery_date],
      ["supplier", row.supplier],
      ["blanket_order", row.blanket_order],
      ["blanket_order_rate", row.blanket_order_rate],
      ["project", row.project],
      ["prevdoc_docname", row.prevdoc_docname],
      ["customer_item_code", row.customer_item_code],
      ["batch_no", row.batch_no],
      ["serial_no", row.serial_no],
    ]
    for (const [k, v] of extras) {
      if (v === undefined || v === null || v === "") continue
      out[k] = v
    }
  } else if (childDoctype === "Sales Taxes and Charges") {
    Object.assign(out, {
      charge_type: row.charge_type || "On Net Total",
      included_in_print_rate: cint(row.included_in_print_rate),
      cost_center: row.cost_center ?? "",
      account_currency: row.account_currency ?? "",
      tax_amount: dnum(row.tax_amount),
      total: dnum(row.total),
      parent,
      parentfield,
      parenttype: DOCTYPE,
      idx,
    })
    const extras: Array<[string, unknown]> = [
      ["account_head", row.account_head],
      ["description", row.description],
      ["rate", row.rate],
      ["eligible_for_commission", row.eligible_for_commission],
      ["category", row.category],
      ["tax_account", row.tax_account],
      ["item_wise_tax_detail", row.item_wise_tax_detail],
    ]
    for (const [k, v] of extras) {
      if (v === undefined || v === null || v === "") continue
      out[k] = v
    }
  } else {
    Object.assign(out, {
      parent,
      parentfield,
      parenttype: DOCTYPE,
      idx,
    })
    for (const [k, v] of Object.entries(row)) {
      if (v === undefined || k === "name" || k === "parent" || k === "parentfield" || k === "parenttype" || k === "idx") continue
      out[k] = v
    }
  }
  return out
}

export interface SalesOrderPartyDetails {
  customer?: string
  customer_name?: string
  customer_group?: string
  territory?: string
  language?: string
  customer_address?: string
  address_display?: string
  shipping_address_name?: string
  shipping_address?: string
  dispatch_address_name?: string
  dispatch_address?: string
  contact_person?: string
  contact_display?: string
  contact_mobile?: string
  contact_email?: string
  company_address?: string
  company_address_display?: string
  company_contact_person?: string
  currency?: string
  conversion_rate?: number
  selling_price_list?: string
  price_list_currency?: string
  plc_conversion_rate?: number
  tax_category?: string
  taxes_and_charges?: string
  payment_terms_template?: string
}

export interface SalesOrderItemDetails {
  item_code?: string
  item_name?: string
  uom?: string
  stock_uom?: string
  conversion_factor?: number
  price_list_rate?: number
  rate?: number
  amount?: number
  warehouse?: string
  sales_warehouse?: string
  income_account?: string
  cost_center?: string
  description?: string
  stock_qty?: number
  delivery_date?: string
  item_tax_template?: string
  is_free_item?: number
  margin_type?: string
  margin_rate_or_amount?: number
  weight_per_unit?: number
  weight_uom?: string
  is_stock_item?: number
  brand?: string
  item_group?: string
}

export interface EmailTemplateResult {
  subject: string
  message: string
}

export interface GetSalesOrderDocResult {
  doc: SalesOrderDoc
  docinfo: DocInfo
}

export const salesOrderService = {
  lookups: {
    currencies: (): Promise<string[]> => fetchOptions("Currency"),
    priceLists: (): Promise<string[]> => fetchOptions("Price List", [["selling", "=", 1]]),
  },

  // ── List / single ─────────────────────────────────────────────────
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
    status?: string
    customerId?: string
    transactionDateFrom?: string
    transactionDateTo?: string
    deliveryDateFrom?: string
    deliveryDateTo?: string
    assignedTo?: string
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }): Promise<SalesOrderListResponse> {
    const pageSize = params.pageSize ?? 10
    const limit_start = ((params.page ?? 1) - 1) * pageSize
    const filters: unknown[] = []

    if (params.status && params.status !== "all" && params.status !== "All") {
      filters.push(["status", "=", params.status])
    }
    if (params.customerId) filters.push(["customer", "=", params.customerId])
    if (params.transactionDateFrom) filters.push(["transaction_date", ">=", params.transactionDateFrom])
    if (params.transactionDateTo) filters.push(["transaction_date", "<=", params.transactionDateTo])
    if (params.deliveryDateFrom) filters.push(["delivery_date", ">=", params.deliveryDateFrom])
    if (params.deliveryDateTo) filters.push(["delivery_date", "<=", params.deliveryDateTo])
    if (params.assignedTo) filters.push(["_assign", "like", `%${params.assignedTo}%`])

    const orFilters: unknown[] = []
    if (params.search) {
      const like = `%${params.search}%`
      orFilters.push(
        ["name", "like", like],
        ["customer_name", "like", like],
        ["customer", "like", like],
      )
    }

    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "transaction_date desc"

    const [rows, total] = await Promise.all([
      apiClient<Record<string, unknown>[]>(
        buildListUrl({
          fields: LIST_FIELDS,
          filters: filters.length > 0 ? filters : undefined,
          orFilters: orFilters.length > 0 ? orFilters : undefined,
          limit_page_length: pageSize,
          limit_start,
          order_by,
        })
      ),
      getCount(filters.length > 0 ? filters : undefined, orFilters.length > 0 ? orFilters : undefined),
    ])

    return {
      items: (rows ?? []).map(mapDoc),
      total,
      page: params.page ?? 1,
      pageSize,
    }
  },

  async getById(name: string): Promise<SalesOrder> {
    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify([...LIST_FIELDS, "conversion_rate", "selling_price_list", "price_list_currency", "plc_conversion_rate", "taxes", "items"]))
    const doc = await apiClient<Record<string, unknown>>(`/resource/${DOCTYPE}/${encodeURIComponent(name)}?${qp.toString()}`)
    return mapDoc(doc)
  },

  // ── Form open (lean single-fetch) ─────────────────────────────────
  async getDoc(name: string): Promise<GetSalesOrderDocResult> {
    const doc = await apiClient<SalesOrderDoc>(
      `/resource/${DOCTYPE}/${encodeURIComponent(name)}`,
    )
    return {
      doc,
      docinfo: { comments: [], versions: [] },
    }
  },

  // frappe.desk.form.save.savedocs ({ doc, action: Save|Update|Submit }).
  async saveDoc(doc: Record<string, unknown>, action: "Save" | "Update" | "Submit"): Promise<SalesOrderDoc> {
    const body = await postMethodRaw<{ message?: string; docs?: SalesOrderDoc[] }>(
      "frappe.desk.form.save.savedocs",
      { doc: JSON.stringify(doc), action },
    )
    return body.docs?.[0] as SalesOrderDoc
  },

  async save(doc: Record<string, unknown>): Promise<SalesOrderDoc> {
    return this.saveDoc(doc, "Save")
  },

  async update(doc: Record<string, unknown>): Promise<SalesOrderDoc> {
    return this.saveDoc(doc, "Save")
  },

  async submit(doc: Record<string, unknown>): Promise<SalesOrderDoc> {
    return this.saveDoc(doc, "Submit")
  },

  async submitDoc(name: string): Promise<SalesOrderDoc> {
    return apiClient<SalesOrderDoc>(
      `/resource/${DOCTYPE}/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ docstatus: 1 }) },
    )
  },

  async create(data: SalesOrderFormData): Promise<SalesOrderDoc> {
    return this.saveDoc({ ...data, doctype: DOCTYPE }, "Save")
  },

  // frappe.desk.form.save.cancel
  async cancelDoc(name: string): Promise<void> {
    const body = await postMethodRaw<{ message?: unknown }>("frappe.desk.form.save.cancel", {
      doctype: DOCTYPE,
      name,
    })
    const messages = serverMessagesFromBody(body)
    if (messages.length > 0) {
      throw new ApiError(0, messages.map((m) => m.message).join(" "), undefined, messages[0])
    }
  },

  // Amend = client-side clone (amended_from, docstatus 0) re-saved as new.
  async amend(source: SalesOrderDoc): Promise<SalesOrderDoc> {
    const managedFields = new Set([
      "name", "creation", "modified", "modified_by", "owner",
      "docstatus", "_comments", "_assign", "_liked_by",
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
    return this.saveDoc(cleaned, "Save")
  },

  async delete(name: string): Promise<void> {
    return apiClient<void>(`/resource/${DOCTYPE}/${encodeURIComponent(name)}`, { method: "DELETE" })
  },

  // ── Docinfo / activity timeline ────────────────────────────────────
  async getDocInfo(name: string): Promise<DocInfo> {
    const body = await apiClientWithBody<{ docinfo?: DocInfo }>(
      `/method/frappe.desk.form.load.get_docinfo?doctype=${encodeURIComponent(DOCTYPE)}&name=${encodeURIComponent(name)}`,
    )
    return body.docinfo ?? { comments: [], versions: [] }
  },

  async getActivity(doc: SalesOrderDoc, currentUserId?: string): Promise<PaymentActivityItem[]> {
    const docinfo = await this.getDocInfo(doc.name)
    return buildTimelineItems(doc as unknown as Parameters<typeof buildTimelineItems>[0], docinfo, currentUserId)
  },

  // ── Comments ───────────────────────────────────────────────────────
  async addComment(name: string, content: string, commentEmail: string, commentBy: string): Promise<PaymentComment> {
    const row = await postMethod<{ name: string; content: string; owner: string; creation: string }>(
      "frappe.desk.form.utils.add_comment",
      {
        reference_doctype: DOCTYPE,
        reference_name: name,
        content: toQuillHtml(content),
        comment_email: commentEmail,
        comment_by: commentBy,
      },
    )
    return { id: row.name, content: row.content, author: row.owner, createdAt: row.creation }
  },

  async updateComment(name: string, content: string): Promise<{ name: string }> {
    return postMethod<{ name: string }>("frappe.desk.form.utils.update_comment", {
      name,
      content: toQuillHtml(content),
    })
  },

  async deleteComment(name: string): Promise<{ message: string }> {
    return postMethod<{ message: string }>("frappe.client.delete", { doctype: "Comment", name })
  },

  // ── Assignment ─────────────────────────────────────────────────────
  async assignTo(names: string[], user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.add_multiple", {
      assign_to: JSON.stringify([user]),
      doctype: DOCTYPE,
      name: JSON.stringify(names),
    })
  },

  async removeAssignment(names: string[]): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.remove_multiple", {
      doctype: DOCTYPE,
      names: JSON.stringify(names),
    })
  },

  async assignUserToDoc(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.add", {
      assign_to: JSON.stringify([user]),
      doctype: DOCTYPE,
      name,
    })
  },

  async unassignUserFromDoc(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.remove", {
      doctype: DOCTYPE,
      name,
      assign_to: user,
    })
  },

  async completeOwnAssignment(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.close", {
      doctype: DOCTYPE,
      name,
      assign_to: user,
    })
  },

  // ── Tags ───────────────────────────────────────────────────────────
  async addTagToDoc(name: string, tag: string): Promise<void> {
    await postMethod("frappe.desk.doctype.tag.tag.add_tag", {
      tag,
      dt: DOCTYPE,
      dn: name,
    })
  },

  async removeTagFromDoc(name: string, tag: string): Promise<void> {
    await postMethod("frappe.desk.doctype.tag.tag.remove_tag", {
      tag,
      dt: DOCTYPE,
      dn: name,
    })
  },

  async searchTags(query: string): Promise<string[]> {
    try {
      return (await postMethod<string[] | null>("frappe.desk.doctype.tag.tag.get_tags", {
        doctype: DOCTYPE,
        txt: query,
      })) ?? []
    } catch {
      return []
    }
  },

  // frappe.desk.search.search_link for the items grid Item column.
  async searchItemsDesk(query: string): Promise<Array<{ value: string; description?: string }>> {
    return apiFormCall<Array<{ value: string; description?: string }>>(
      "/method/frappe.desk.search.search_link",
      [
        ["txt", query],
        ["doctype", "Item"],
        ["ignore_user_permissions", "0"],
        ["reference_doctype", "Sales Order Item"],
        ["page_length", "10"],
        ["query", "erpnext.controllers.queries.item_query"],
        ["filters", JSON.stringify({ is_sales_item: 1, has_variants: 0 })],
      ],
      { doctype: "Item" },
    )
  },

  // ── Fetch flows (form field fills) ─────────────────────────────────
  async getExchangeRate(fromCurrency: string, toCurrency: string, transactionDate: string): Promise<number> {
    const rate = await apiFormCall<number | string>(
      "/method/erpnext.setup.utils.get_exchange_rate",
      [
        ["from_currency", fromCurrency],
        ["to_currency", toCurrency],
        ["transaction_date", transactionDate],
        ["args", '"for_selling"'],
      ],
    )
    return Number(rate) || 0
  },

  async getPartyDetails(
    partyType: string,
    party: string,
    company: string,
    postingDate: string,
    opts?: { priceList?: string; currency?: string; fetchPaymentTermsTemplate?: boolean },
  ): Promise<SalesOrderPartyDetails> {
    const fields: Array<[string, string]> = [
      ["party", party],
      ["party_type", partyType],
    ]
    if (opts?.priceList) fields.push(["price_list", opts.priceList])
    fields.push(["posting_date", postingDate])
    fields.push(["fetch_payment_terms_template", opts?.fetchPaymentTermsTemplate === false ? "0" : "1"])
    if (opts?.currency) fields.push(["currency", opts.currency])
    fields.push(["company", company])
    fields.push(["doctype", DOCTYPE])
    return apiFormCall<SalesOrderPartyDetails>(
      "/method/erpnext.accounts.party.get_party_details",
      fields,
      { doctype: DOCTYPE },
    )
  },

  async getItemDetails(args: Record<string, unknown>, company: string): Promise<SalesOrderItemDetails> {
    return apiFormCall<SalesOrderItemDetails>(
      "/method/erpnext.stock.get_item_details.get_item_details",
      [
        ["args", JSON.stringify({ ...args, doctype: DOCTYPE, company })],
        ["doctype", DOCTYPE],
      ],
      { doctype: DOCTYPE },
    )
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

  async getItemTaxTemplate(args: {
    item_code: string
    company: string
    base_net_rate: number
    tax_category: string
    transaction_date: string
  }): Promise<string | null> {
    try {
      const result = await apiFormCall<string | Record<string, unknown>>(
        "/method/erpnext.stock.get_item_details.get_item_tax_template",
        [["args", JSON.stringify(args)]],
      )
      return typeof result === "string" && result ? result : null
    } catch {
      return null
    }
  },

  async getConversionFactor(itemCode: string, uom: string): Promise<number> {
    try {
      const result = await apiFormCall<{ conversion_factor?: number }>(
        "/method/erpnext.stock.get_item_details.get_conversion_factor",
        [
          ["item_code", itemCode],
          ["uom", uom],
        ],
      )
      return Number(result?.conversion_factor) || 1
    } catch {
      return 1
    }
  },

  async getTaxesAndCharges(masterName: string): Promise<{ tax_category?: string; taxes?: SalesOrderTax[] }> {
    const result = await apiFormCall<{ tax_category?: string; taxes?: SalesOrderTax[] }>(
      "/method/erpnext.controllers.accounts_controller.get_taxes_and_charges",
      [
        ["master_doctype", "Sales Taxes and Charges Template"],
        ["master_name", masterName],
      ],
    )
    return result ?? {}
  },

  async validateLink(doctype: string, name: string, fields: string[]): Promise<Record<string, unknown>> {
    try {
      return await dedupedFormCall<Record<string, unknown>>(
        "/method/frappe.client.validate_link",
        [
          ["doctype", doctype],
          ["docname", name],
          ["fields", JSON.stringify(fields)],
        ],
        { doctype },
      )
    } catch (err) {
      if (err instanceof SuppressedDuplicateError) throw err
      return {}
    }
  },

  async getValue(doctype: string, fieldname: string, filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      return await apiFormCall<Record<string, unknown>>(
        "/method/frappe.client.get_value",
        [
          ["doctype", doctype],
          ["fieldname", fieldname],
          ["filters", JSON.stringify(filters)],
        ],
        { doctype },
      )
    } catch {
      return {}
    }
  },

  async applyPriceList(
    args: Record<string, unknown>,
    doc?: Record<string, unknown>,
  ): Promise<{
    parent: Record<string, unknown>
    children: Array<Record<string, unknown>>
  } | null> {
    try {
      return await dedupedFormCall<{
        parent: Record<string, unknown>
        children: Array<Record<string, unknown>>
      }>(
        "/method/erpnext.stock.get_item_details.apply_price_list",
        [
          ["args", JSON.stringify(args)],
          ["doc", JSON.stringify(doc ?? {})],
        ],
      )
    } catch {
      return null
    }
  },

  async getDefaultTaxesAndCharges(
    company: string,
    taxTemplate?: string,
  ): Promise<{
    taxes_and_charges: string
    taxes: Array<Record<string, unknown>>
  } | null> {
    try {
      const result = await dedupedFormCall<{
        taxes_and_charges: string
        taxes: Array<Record<string, unknown>>
      }>("/method/erpnext.controllers.accounts_controller.get_default_taxes_and_charges", [
        ["master_doctype", "Sales Taxes and Charges Template"],
        ["tax_template", taxTemplate || ""],
        ["company", company],
      ])
      if (!result || typeof result !== "object") return null
      return {
        taxes_and_charges: result.taxes_and_charges || "",
        taxes: Array.isArray(result.taxes) ? result.taxes : [],
      }
    } catch {
      return null
    }
  },

  async getDefaultCompanyAddress(company: string, existingAddress?: string): Promise<string | null> {
    try {
      const result = await dedupedFormCall<string>(
        "/method/erpnext.setup.doctype.company.company.get_default_company_address",
        [
          ["name", company],
          ["existing_address", existingAddress || ""],
        ],
      )
      return typeof result === "string" && result ? result : null
    } catch {
      return null
    }
  },

  async getPaymentTerms(
    templateName: string,
    doc: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await apiFormCall<Array<Record<string, unknown>>>(
        "/method/erpnext.accounts.party.get_payment_terms",
        [
          ["terms", templateName],
          ["posting_date", String(doc.posting_date ?? doc.transaction_date ?? "")],
          ["grand_total", String(doc.grand_total ?? 0)],
          ["base_grand_total", String(doc.base_grand_total ?? 0)],
          ["bill_date", String(doc.bill_date ?? "")],
        ],
      )
      return Array.isArray(result) ? result : []
    } catch {
      return []
    }
  },

  // ── Create menu (make_mapped_doc + status / reservation) ───────────
  async makeDeliveryNote(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_delivery_note", source_name: sourceName }) },
    )
  },

  async makeSalesInvoice(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice", source_name: sourceName }) },
    )
  },

  async createPickList(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.create_pick_list", source_name: sourceName }) },
    )
  },

  async makeMaterialRequest(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_material_request", source_name: sourceName }) },
    )
  },

  async makeRawMaterialRequest(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_raw_material_request", source_name: sourceName }) },
    )
  },

  async makeWorkOrders(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_work_orders", source_name: sourceName }) },
    )
  },

  async makeProject(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_project", source_name: sourceName }) },
    )
  },

  async makePurchaseOrder(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_purchase_order", source_name: sourceName }) },
    )
  },

  async makeInterCompanyPurchaseOrder(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_inter_company_purchase_order", source_name: sourceName }) },
    )
  },

  async makeMaintenanceSchedule(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_maintenance_schedule", source_name: sourceName }) },
    )
  },

  async makeMaintenanceVisit(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_maintenance_visit", source_name: sourceName }) },
    )
  },

  async makePaymentRequest(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.accounts.doctype.payment_request.payment_request.make_payment_request", source_name: sourceName, args: JSON.stringify({ dt: DOCTYPE, dn: sourceName }) }) },
    )
  },

  async makePaymentEntry(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry", source_name: sourceName, args: JSON.stringify({ dt: DOCTYPE, dn: sourceName }) }) },
    )
  },

  // erpnext.stock.doctype.stock_reservation_entry (desk
  // create_stock_reservation_entries / cancel_stock_reservation_entries).
  async createReservedStock(
    name: string,
    items: Array<{ sales_order_item: string; item_code?: string; warehouse?: string; qty?: number }>,
    setWarehouse?: string,
  ): Promise<{ message?: string }> {
    return postMethod<{ message?: string }>(
      "erpnext.selling.doctype.sales_order.sales_order.create_stock_reservation_entries",
      {
        sales_order: name,
        items: JSON.stringify(items),
        set_warehouse: setWarehouse ?? "",
      },
    )
  },

  async cancelReservedStock(name: string): Promise<{ message?: string }> {
    return postMethod<{ message?: string }>(
      "erpnext.selling.doctype.sales_order.sales_order.cancel_stock_reservation_entries",
      {
        sales_order: name,
      },
    )
  },

  // erpnext.selling.doctype.sales_order.sales_order.update_status —
  // Hold / Close / Resume / Re-open map to status "On Hold" / "Closed" /
  // prior status / draft.
  async updateStatus(name: string, status: string): Promise<{ message?: string }> {
    return postMethod<{ message?: string }>(
      "erpnext.selling.doctype.sales_order.sales_order.update_status",
      {
        name,
        status,
      },
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

  async bulkDelete(names: string[]): Promise<{ failed: string[]; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: { undeleted_items?: string[] } | string[] } & Record<string, unknown>>(
      "frappe.desk.reportview.delete_items",
      { doctype: DOCTYPE, items: JSON.stringify(names) },
    )
    const msg = result.message
    const messages = serverMessagesFromBody(result)
    if (Array.isArray(msg)) return { failed: msg.length > 0 ? msg : failedNamesFromMessages(names, messages), messages }
    const undeleted = Array.isArray(msg?.undeleted_items) ? msg.undeleted_items : []
    return {
      failed: undeleted.length > 0 ? undeleted : failedNamesFromMessages(names, messages),
      messages,
    }
  },
}

export { deskChildRow }
export type { DeskDocEnvelopeOptions }
