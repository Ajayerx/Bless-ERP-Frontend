import { apiClient, apiFormCall, apiClientWithBody, serverMessagesFromBody, failedNamesFromMessages, serverDownloadTemplate, throwServerMessageError, ApiError, type AppMessage } from "@/services/api-client"
import { postMethod, postMethodRaw } from "@/services/frappe-client"
import { API_CONFIG } from "@/config/api.config"
import { buildTimelineItems, toQuillHtml } from "@/modules/payments/services"
import type { DocInfo, PaymentActivityItem, PaymentComment } from "@/modules/payments/types"
import type { Quotation, QuotationItem, QuotationTax, QuotationFormData, QuotationListResponse } from "../types"

export type {
  Quotation,
  QuotationItem,
  QuotationTax,
  QuotationFormData,
  QuotationListResponse,
  QuotationStatus,
  QuotationDocStatus,
  QuotationTo,
  PaymentScheduleRow,
  PricingRuleRow,
  LostReasonRow,
  CompetitorRow,
} from "../types"

const DOCTYPE = "Quotation"

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
    if (import.meta.env.DEV) console.warn("[quotations] debounced duplicate:", cmd)
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

interface AccountingDimensionsResult {
  dimensionFilters: Array<{ label: string; fieldname: string; document_type: string }>
  defaultDimensionsMap: Record<string, Record<string, string>>
}

// Static per session (desk runs setup_accounting_dimension_triggers once);
// the promise is shared so duplicate/concurrent mounts hit the server once.
// A failed attempt clears the slot so a later call can retry.
let dimensionsPromise: Promise<AccountingDimensionsResult> | null = null

/** Test hook: clears the freshness log and cached static lookups. */
export function __resetQuotationFreshness(): void {
  freshnessLog.clear()
  dimensionsPromise = null
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

/** Fields the quotation list page needs (name/status/party/dates/totals). */
const LIST_FIELDS = [
  "name", "title", "quotation_to", "party_name", "customer_name", "transaction_date",
  "valid_till", "order_type", "company", "currency", "grand_total", "rounded_total",
  "status", "docstatus", "amended_from", "owner", "creation", "modified", "modified_by",
  "_assign", "_user_tags",
]

export const QUOTATION_EXPORT_FIELDS: Record<string, string[]> = {
  "Quotation": [
    "name", "title", "quotation_to", "party_name", "customer_name",
    "transaction_date", "valid_till", "grand_total", "status", "docstatus",
    "company", "currency", "selling_price_list", "territory", "source",
    "campaign",
  ],
  items: [
    "item_code", "item_name", "qty", "uom", "rate", "amount",
    "description", "warehouse",
  ],
  taxes: [
    "charge_type", "account_head", "description", "rate", "tax_amount", "total",
  ],
}

function buildListUrl(params: {
  fields: string[]
  filters?: unknown[]
  orFilters?: unknown[]
  limit_page_length?: number
  limit_start?: number
  order_by?: string
}): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters && params.filters.length > 0) qp.set("filters", JSON.stringify(params.filters))
  if (params.orFilters && params.orFilters.length > 0) qp.set("or_filters", JSON.stringify(params.orFilters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(DOCTYPE)}?${qp.toString()}`
}

async function getCount(filters?: unknown[], orFilters?: unknown[]): Promise<number> {
  const qp = new URLSearchParams()
  qp.set("doctype", DOCTYPE)
  if (filters && filters.length > 0) qp.set("filters", JSON.stringify(filters))
  if (orFilters && orFilters.length > 0) qp.set("or_filters", JSON.stringify(orFilters))
  const result = await apiClient<number>(`/method/frappe.client.get_count?${qp.toString()}`)
  return Number(result)
}

/** ERPNext get_party_details default payload for Quotation. */
export interface QuotationPartyDetails {
  customer?: string
  customer_name?: string
  party_name?: string
  customer_group?: string
  territory?: string
  language?: string
  customer_address?: string
  address_display?: string
  shipping_address_name?: string
  shipping_address?: string
  contact_person?: string
  contact_display?: string
  contact_mobile?: string
  contact_email?: string
  company_address?: string
  company_address_display?: string
  currency?: string
  conversion_rate?: number
  selling_price_list?: string
  price_list_currency?: string
  plc_conversion_rate?: number
  tax_category?: string
  taxes_and_charges?: string
  payment_terms_template?: string
}

/**
 * Mirrors erpnext TransactionController._get_args()/_get_item_list()
 * (public/js/controllers/transaction.js:1825-1889) so apply_price_list
 * receives the exact payload desk sends. Keys whose value is undefined
 * are dropped by JSON.stringify — identical to desk's serialization.
 */
export function buildApplyPriceListArgs(
  doc: Partial<Quotation> & Record<string, unknown>,
  item?: QuotationItem | null,
): Record<string, unknown> {
  const rows = (item ? [item] : (doc.items ?? [])) as unknown as Array<Record<string, unknown>>
  const item_list: Array<Record<string, unknown>> = []
  for (const d of rows) {
    if (!d.item_code) continue
    item_list.push({
      doctype: d.doctype ?? "Quotation Item",
      name: d.name,
      child_docname: d.name,
      item_code: d.item_code,
      item_group: d.item_group,
      brand: d.brand,
      qty: d.qty,
      stock_qty: d.stock_qty,
      uom: d.uom,
      stock_uom: d.stock_uom,
      parenttype: d.parenttype ?? "Quotation",
      parent: d.parent ?? doc.name,
      pricing_rules: d.pricing_rules,
      is_free_item: d.is_free_item,
      warehouse: d.warehouse,
      serial_no: d.serial_no,
      batch_no: d.batch_no,
      price_list_rate: d.price_list_rate,
      conversion_factor: d.conversion_factor || 1.0,
      discount_percentage: d.discount_percentage,
      discount_amount: d.discount_amount,
    })
    // ERPNext quirk kept verbatim: the comma operator in desk's
    // `if (in_list([...]), d.doctype)` makes this run for every row and
    // always write into item_list[0].
    item_list[0]["margin_type"] = d.margin_type
    item_list[0]["margin_rate_or_amount"] = d.margin_rate_or_amount
  }
  return {
    items: item_list,
    customer: doc.customer || doc.party_name,
    quotation_to: doc.quotation_to,
    customer_group: doc.customer_group,
    territory: doc.territory,
    supplier: doc.supplier,
    supplier_group: doc.supplier_group,
    currency: doc.currency,
    conversion_rate: doc.conversion_rate,
    price_list: doc.selling_price_list || doc.buying_price_list,
    price_list_currency: doc.price_list_currency,
    plc_conversion_rate: doc.plc_conversion_rate,
    company: doc.company,
    transaction_date: doc.transaction_date || doc.posting_date,
    campaign: doc.campaign,
    sales_partner: doc.sales_partner,
    ignore_pricing_rule: doc.ignore_pricing_rule,
    doctype: DOCTYPE,
    name: doc.name,
    is_return: cint(doc.is_return),
    update_stock: 0,
    conversion_factor: doc.conversion_factor,
    pos_profile: "",
    coupon_code: doc.coupon_code,
    is_internal_supplier: doc.is_internal_supplier,
    is_internal_customer: doc.is_internal_customer,
  }
}

/**
 * Desk apply_price_list sends doc = the full frappe doc dict, not a subset:
 * meta keys (__islocal/__unsaved/owner/parent…), every defaulted numeric on
 * child rows (actual_qty, valuation_rate, base_* …) and null-typed link
 * slots (company_address, payment_terms_template). This builds that
 * envelope from React form state: a deterministic template in the key order
 * desk's runtime produces, overlaid with whatever values the form carries.
 */
export interface DeskDocEnvelopeOptions {
  /** New unsaved doc → include __islocal/__unsaved like frappe.model.new_doc. */
  isNew?: boolean
  /** Session user id (desk doc.owner). Omitted when unknown. */
  owner?: string
}

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
  if (childDoctype === "Quotation Item") {
    Object.assign(out, {
      stock_uom: row.stock_uom ?? "",
      ordered_qty: 0,
      margin_type: row.margin_type ?? "",
      is_free_item: cint(row.is_free_item),
      is_alternative: 0,
      has_alternative_item: 0,
      against_blanket_order: 0,
      page_break: cint(row.page_break),
      parent: parentName,
      parentfield,
      parenttype: DOCTYPE,
      idx,
      qty: dnum(row.qty),
      conversion_factor: dnum(row.conversion_factor),
      stock_qty: dnum(row.stock_qty),
      actual_qty: 0,
      company_total_stock: 0,
      price_list_rate: dnum(row.price_list_rate),
      base_price_list_rate: 0,
      margin_rate_or_amount: dnum(row.margin_rate_or_amount),
      rate_with_margin: 0,
      discount_amount: dnum(row.discount_amount),
      distributed_discount_amount: 0,
      base_rate_with_margin: 0,
      rate: dnum(row.rate),
      net_rate: 0,
      amount: dnum(row.amount),
      net_amount: 0,
      base_rate: dnum(row.base_rate),
      base_net_rate: 0,
      base_amount: dnum(row.base_amount),
      base_net_amount: 0,
      stock_uom_rate: 0,
      valuation_rate: 0,
      gross_profit: 0,
      weight_per_unit: 0,
      total_weight: 0,
      blanket_order_rate: 0,
      projected_qty: 0,
    })
    // Keys desk materializes via set_value history — only when set.
    const extras: Array<[string, unknown]> = [
      ["item_code", row.item_code],
      ["item_name", row.item_name],
      ["item_group", row.item_group],
      ["brand", row.brand],
      ["uom", row.uom],
      ["description", row.description],
      ["warehouse", row.warehouse],
      ["income_account", row.income_account],
      ["cost_center", row.cost_center],
      ["discount_percentage", row.discount_percentage],
      ["delivery_date", row.delivery_date],
      ["customer_item_code", row.customer_item_code],
    ]
    for (const [k, v] of extras) {
      if (v === undefined || v === null || v === "") continue
      out[k] = v
    }
  } else {
    Object.assign(out, {
      charge_type: row.charge_type || "On Net Total",
      included_in_print_rate: cint(row.included_in_print_rate),
      included_in_paid_amount: 0,
      cost_center: row.cost_center ?? "",
      account_currency: row.account_currency ?? "",
      dont_recompute_tax: 0,
      parent: parentName,
      parentfield,
      parenttype: DOCTYPE,
      idx,
      row_id: row.row_id ?? null,
      account_head: row.account_head ?? "",
      description: row.description ?? "",
      project: null,
      rate: dnum(row.rate),
      tax_amount: dnum(row.tax_amount),
      total: dnum(row.total),
      tax_amount_after_discount_amount: 0,
      base_tax_amount: 0,
      base_total: 0,
      base_tax_amount_after_discount_amount: 0,
      net_amount: 0,
      base_net_amount: 0,
    })
    if (row.item_wise_tax_detail !== undefined) out.item_wise_tax_detail = row.item_wise_tax_detail
  }
  return out
}

export function buildDeskApplyPriceListDoc(
  form: Partial<Quotation> & Record<string, unknown>,
  opts: DeskDocEnvelopeOptions = {},
): Record<string, unknown> {
  const isNew = !!opts.isNew
  const rowsOf = (key: string): Array<Record<string, unknown>> =>
    Array.isArray(form[key]) ? (form[key] as Array<Record<string, unknown>>) : []
  const doc: Record<string, unknown> = {
    docstatus: form.docstatus ?? 0,
    doctype: DOCTYPE,
    name: form.name ?? "",
    ...(isNew ? { __islocal: 1, __unsaved: 1 } : {}),
    ...(opts.owner !== undefined ? { owner: opts.owner } : {}),
    naming_series: form.naming_series ?? "SAL-QTN-.YYYY.-",
    quotation_to: form.quotation_to ?? "Customer",
    transaction_date: form.transaction_date ?? "",
    order_type: form.order_type ?? "Sales",
    has_unit_price_items: 0,
    currency: form.currency ?? "",
    selling_price_list: form.selling_price_list ?? "",
    price_list_currency: form.price_list_currency ?? "",
    ignore_pricing_rule: cint(form.ignore_pricing_rule),
    items: rowsOf("items").map((r, i) => deskChildRow(r, "Quotation Item", "items", i + 1, form.name ?? "", opts)),
    taxes: rowsOf("taxes").map((r, i) => deskChildRow(r, "Sales Taxes and Charges", "taxes", i + 1, form.name ?? "", opts)),
    disable_rounded_total: cint(form.disable_rounded_total),
    apply_discount_on: form.apply_discount_on ?? "Grand Total",
    packed_items: [],
    pricing_rules: form.pricing_rules ?? [],
    payment_schedule: form.payment_schedule ?? [],
    group_same_items: cint(form.group_same_items),
    lost_reasons: form.lost_reasons ?? [],
    competitors: form.competitors ?? [],
    status: form.status ?? "Draft",
    customer_name: form.customer_name ?? "",
    conversion_rate: form.conversion_rate ?? 1,
    plc_conversion_rate: form.plc_conversion_rate ?? "",
    company: form.company ?? "",
    valid_till: form.valid_till ?? "",
    company_address: form.company_address ?? null,
    company_address_display: form.company_address_display ?? null,
    taxes_and_charges: form.taxes_and_charges ?? "",
    base_net_total: dnum(form.base_net_total),
    net_total: dnum(form.net_total),
    base_total: dnum(form.base_total),
    total: dnum(form.total),
    total_qty: dnum(form.total_qty),
    grand_total: dnum(form.grand_total),
    total_taxes_and_charges: dnum(form.total_taxes_and_charges),
    base_grand_total: dnum(form.base_grand_total),
    rounded_total: dnum(form.rounded_total),
    rounding_adjustment: dnum(form.rounding_adjustment),
    base_rounding_adjustment: dnum(form.base_rounding_adjustment),
    base_rounded_total: dnum(form.base_rounded_total),
    in_words: form.in_words ?? "",
    base_in_words: form.base_in_words ?? "",
    base_discount_amount: dnum(form.base_discount_amount),
    party_name: form.party_name ?? "",
    customer_address: form.customer_address ?? "",
    address_display: form.address_display ?? "",
    shipping_address_name: form.shipping_address_name ?? "",
    shipping_address: form.shipping_address ?? "",
    tax_category: form.tax_category ?? "",
    contact_person: form.contact_person ?? "",
    contact_display: form.contact_display ?? "",
    contact_email: form.contact_email ?? "",
    contact_mobile: form.contact_mobile ?? "",
    customer_group: form.customer_group ?? "",
    territory: form.territory ?? "",
    language: form.language ?? "",
    payment_terms_template: form.payment_terms_template ?? null,
  }
  return doc
}

/** ERPNext get_item_details default payload for a Quotation item row. */
export interface QuotationItemDetails {
  item_code?: string
  item_name?: string
  uom?: string
  stock_uom?: string
  conversion_factor?: number
  price_list_rate?: number
  rate?: number
  amount?: number
  warehouse?: string
  income_account?: string
  cost_center?: string
  description?: string
  stock_qty?: number
  delivery_date?: string
  item_tax_template?: string
  is_free_item?: number
  margin_type?: string
  margin_rate_or_amount?: number
}

export interface EmailTemplateResult {
  subject: string
  message: string
}

export interface GetDocResult {
  doc: Quotation
  docinfo: DocInfo
}

export const quotationService = {
  // Lookup option lists (shared across form Comboboxes).
  lookups: {
    currencies: (): Promise<string[]> => fetchOptions("Currency"),
    priceLists: (): Promise<string[]> => fetchOptions("Price List", [["selling", "=", 1]]),
  },

  // ── List / single (used by list page; D4 adds reportview.get + tabs) ──
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
    status?: string
    customerId?: string
    transactionDateFrom?: string
    transactionDateTo?: string
    validTillFrom?: string
    validTillTo?: string
    assignedTo?: string
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }): Promise<QuotationListResponse> {
    const pageSize = params.pageSize ?? 10
    const limit_start = ((params.page ?? 1) - 1) * pageSize
    const filters: unknown[] = []

    if (params.status && params.status !== "all" && params.status !== "All") {
      filters.push(["status", "=", params.status])
    }
    if (params.customerId) filters.push(["party_name", "=", params.customerId])
    if (params.transactionDateFrom) filters.push(["transaction_date", ">=", params.transactionDateFrom])
    if (params.transactionDateTo) filters.push(["transaction_date", "<=", params.transactionDateTo])
    if (params.validTillFrom) filters.push(["valid_till", ">=", params.validTillFrom])
    if (params.validTillTo) filters.push(["valid_till", "<=", params.validTillTo])
    if (params.assignedTo) filters.push(["_assign", "like", `%${params.assignedTo}%`])

    const orFilters: unknown[] = []
    if (params.search) {
      const like = `%${params.search}%`
      orFilters.push(
        ["name", "like", like],
        ["party_name", "like", like],
        ["customer_name", "like", like],
      )
    }

    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "transaction_date desc"

    const [rows, total] = await Promise.all([
      apiClient<Quotation[]>(
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
      items: rows ?? [],
      total,
      page: params.page ?? 1,
      pageSize,
    }
  },

  async getById(name: string): Promise<Quotation> {
    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify([...LIST_FIELDS, "currency", "conversion_rate", "selling_price_list", "price_list_currency", "plc_conversion_rate", "taxes", "items"]))
    return apiClient<Quotation>(`/resource/${DOCTYPE}/${encodeURIComponent(name)}?${qp.toString()}`)
  },

  // ── Form open (lean single-fetch) ─────────────────────────────────
  // Loads the full document (incl. child tables) via a plain resource GET.
  // This replaces the old frappe.desk.form.load.getdoc call, whose response
  // bundled the entire docinfo (comments/versions/user_info/_link_titles) and
  // could keep the initial page skeleton alive while that large body streams.
  // Activity/assignments are fetched separately and only where displayed.
  async getDoc(name: string): Promise<GetDocResult> {
    const doc = await apiClient<Quotation>(
      `/resource/${DOCTYPE}/${encodeURIComponent(name)}`,
    )
    return {
      doc,
      docinfo: { comments: [], versions: [] },
    }
  },

  // frappe.desk.form.save.savedocs ({ doc, action: Save|Update|Submit }).
  async saveDoc(doc: Record<string, unknown>, action: "Save" | "Update" | "Submit"): Promise<Quotation> {
    const body = await postMethodRaw<{ message?: string; docs?: Quotation[] }>(
      "frappe.desk.form.save.savedocs",
      { doc: JSON.stringify(doc), action },
    )
    return body.docs?.[0] as Quotation
  },

  // Convenience wrappers so D3/D4 consumers can keep create/update/delete verbs.
  async create(data: QuotationFormData): Promise<Quotation> {
    return this.saveDoc({ ...data, doctype: DOCTYPE }, "Save")
  },

  async update(name: string, data: QuotationFormData): Promise<Quotation> {
    return this.saveDoc({ ...data, doctype: DOCTYPE, name }, "Save")
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

  async cancel(name: string): Promise<void> {
    await this.cancelDoc(name)
  },

  // Amend = client-side clone (amended_from, docstatus 0) re-saved as new.
  async amend(source: Quotation): Promise<Quotation> {
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

  async getActivity(doc: Quotation, currentUserId?: string): Promise<PaymentActivityItem[]> {
    const docinfo = await this.getDocInfo(doc.name)
    return buildTimelineItems(doc, docinfo, currentUserId)
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
  async addTags(names: string[], tags: string | string[], color = ""): Promise<void> {
    const tagLabels = Array.isArray(tags) ? tags : [tags]
    await postMethod("frappe.desk.doctype.tag.tag.add_tags", {
      tags: JSON.stringify(tagLabels),
      dt: DOCTYPE,
      docs: JSON.stringify(names),
      color,
    })
  },

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

  async searchAssignableUsers(
    query: string,
  ): Promise<{ value: string; label: string; description: string }[]> {
    const results = await apiClient<{ value: string; label?: string; description?: string }[]>(
      `/method/frappe.desk.search.search_link?` +
        new URLSearchParams({
          doctype: "User",
          txt: query,
          page_length: "10",
          filters: JSON.stringify({ user_type: "System User", enabled: 1 }),
        }).toString()
    )
    return (results ?? []).map((u) => ({
      value: u.value,
      label: u.label ?? u.value,
      description: u.description ?? "",
    }))
  },

  // frappe.desk.search.search_link for the quotation_to Link field
  // (Link → DocType, options Customer/Lead/Prospect). Desk's ControlLink
  // fires this on focus/clear with empty txt; field order matches the
  // urlencoded body desk sends (link.js → search_link args).
  async searchQuotationTo(query: string): Promise<Array<{ value: string; description?: string }>> {
    return dedupedFormCall<Array<{ value: string; description?: string }>>(
      "/method/frappe.desk.search.search_link",
      [
        ["txt", query],
        ["doctype", "DocType"],
        ["ignore_user_permissions", "0"],
        ["reference_doctype", DOCTYPE],
        ["page_length", "10"],
        ["filters", JSON.stringify({ name: ["in", ["Customer", "Lead", "Prospect"]] })],
      ],
      { doctype: "DocType" },
    )
  },

  // frappe.desk.search.search_link for the items grid Item column.
  // Desk ControlLink on Quotation Item.item_code → item_query with
  // is_sales_item/has_variants filters (x-frappe-doctype: Item).
  async searchItemsDesk(query: string): Promise<Array<{ value: string; description?: string }>> {
    return apiFormCall<Array<{ value: string; description?: string }>>(
      "/method/frappe.desk.search.search_link",
      [
        ["txt", query],
        ["doctype", "Item"],
        ["ignore_user_permissions", "0"],
        ["reference_doctype", "Quotation Item"],
        ["page_length", "10"],
        ["query", "erpnext.controllers.queries.item_query"],
        ["filters", JSON.stringify({ is_sales_item: 1, has_variants: 0 })],
      ],
      { doctype: "Item" },
    )
  },

  // ── Conversion chain (Create menu) ─────────────────────────────────
  async makeSalesOrder(sourceName: string, selectedItems?: Array<{ name: string; item_code: string; is_alternative: number }>): Promise<{ doctype: string; name: string }> {
    const body: Record<string, unknown> = {
      method: "erpnext.selling.doctype.quotation.quotation.make_sales_order",
      source_name: sourceName,
    }
    if (selectedItems && selectedItems.length > 0) {
      body.args = JSON.stringify({ selected_items: selectedItems })
    }
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify(body) },
    )
  },

  async makeSalesInvoice(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.quotation.quotation.make_sales_invoice", source_name: sourceName }) },
    )
  },

  // ── Get Items From > Opportunity (map_current_doc / make_mapped_doc) ──
  async makeQuotationFromOpportunity(
    sourceName: string,
    assignToMe: boolean = false,
  ): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      {
        method: "POST",
        body: JSON.stringify({
          method: "erpnext.crm.doctype.opportunity.opportunity.make_quotation",
          source_name: sourceName,
          args: JSON.stringify({ _assign: assignToMe }),
        }),
      },
    )
  },

  // ── Update Items on submitted quotation ─────────────────────────────
  async updateChildQtyRate(
    parentDoctypeName: string,
    transItems: Array<{
      docname?: string
      item_code: string
      qty: number
      rate: number
      uom?: string
      conversion_factor?: number
    }>,
    childDocname: string = "items",
  ): Promise<void> {
    await postMethod(
      "erpnext.controllers.accounts_controller.update_child_qty_rate",
      {
        parent_doctype: DOCTYPE,
        trans_items: JSON.stringify(transItems),
        parent_doctype_name: parentDoctypeName,
        child_docname: childDocname,
      },
    )
  },

  // ── Set as Lost ────────────────────────────────────────────────────
  async declareLost(
    sourceName: string,
    opts: { lostReasons: string[]; competitors: string[]; detailedReason?: string },
  ): Promise<void> {
    await postMethod("erpnext.selling.doctype.quotation.quotation.declare_enquiry_lost", {
      source_name: sourceName,
      lost_reasons_list: JSON.stringify(opts.lostReasons),
      competitors: JSON.stringify(opts.competitors),
      detailed_reason: opts.detailedReason ?? "",
    })
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

  // erpnext.accounts.party.get_party_details — desk utils/party.js:9-125
  // builds args in this exact order (party/party_type/price_list first,
  // posting_date NOT transaction_date, fetch_payment_terms_template as cint,
  // optional currency, then company/doctype) and frappe.call attaches the
  // x-frappe-doctype header from opts.doctype.
  async getPartyDetails(
    partyType: string,
    party: string,
    company: string,
    postingDate: string,
    opts?: { priceList?: string; currency?: string; fetchPaymentTermsTemplate?: boolean },
  ): Promise<QuotationPartyDetails> {
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
    return apiFormCall<QuotationPartyDetails>(
      "/method/erpnext.accounts.party.get_party_details",
      fields,
      { doctype: DOCTYPE },
    )
  },

  async getItemDetails(args: Record<string, unknown>, company: string): Promise<QuotationItemDetails> {
    return apiFormCall<QuotationItemDetails>(
      "/method/erpnext.stock.get_item_details.get_item_details",
      [
        ["args", JSON.stringify({ ...args, doctype: DOCTYPE, company })],
        ["doctype", DOCTYPE],
      ],
      { doctype: DOCTYPE },
    )
  },

  // erpnext.stock.get_item_details.get_item_details (desk item_code trigger).
  // transaction.js sends frm.call({child, args: {doc: frm.doc, args: {...}}})
  // → urlencoded doc=<json>&args=<json>; undefined keys drop via JSON.stringify.
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

  // erpnext.stock.get_item_details.get_item_tax_template (desk rate handler;
  // fires when item_code && rate; undefined keys drop via JSON.stringify).
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

  // erpnext.stock.get_item_details.get_conversion_factor (desk uom() trigger)
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

  async getTaxesAndCharges(masterName: string): Promise<{ tax_category?: string; taxes?: QuotationTax[] }> {
    const result = await apiFormCall<{ tax_category?: string; taxes?: QuotationTax[] }>(
      "/method/erpnext.controllers.accounts_controller.get_taxes_and_charges",
      [
        ["master_doctype", "Sales Taxes and Charges Template"],
        ["master_name", masterName],
      ],
    )
    return result ?? {}
  },

  // ── On-launch defaults (new quotation; matches ERPNext quotation.js) ──
  // All four go through dedupedFormCall (is_fresh parity). validate_link
  // rethrows SuppressedDuplicateError (a skipped re-check is not an invalid
  // link) but still swallows real failures into {}.
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

  // erpnext.accounts.doctype.accounting_dimension.accounting_dimension.get_dimensions
  // Desk fires this with NO arguments (transaction.js setup_accounting_dimension_triggers).
  async getAccountingDimensions(): Promise<AccountingDimensionsResult> {
    if (!dimensionsPromise) {
      dimensionsPromise = apiFormCall<
        [
          Array<{ label: string; fieldname: string; document_type: string }>,
          Record<string, Record<string, string>>,
        ]
      >(
        "/method/erpnext.accounts.doctype.accounting_dimension.accounting_dimension.get_dimensions",
        [],
      ).then((result): AccountingDimensionsResult => {
        if (!Array.isArray(result) || result.length < 2) {
          return { dimensionFilters: [], defaultDimensionsMap: {} }
        }
        return {
          dimensionFilters: result[0] || [],
          defaultDimensionsMap: result[1] || {},
        }
      }).catch((err: unknown) => {
        dimensionsPromise = null
        throw err
      })
    }
    try {
      return await dimensionsPromise
    } catch {
      return { dimensionFilters: [], defaultDimensionsMap: {} }
    }
  },

  // erpnext.stock.get_item_details.apply_price_list
  // Desk sends frm.call({args: {args, doc}}) → urlencoded args=<json>&doc=<json>.
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

  // erpnext.setup.doctype.company.company.get_default_company_address
  // Desk sends {name, existing_address} (sort_key left at server default).
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

  // erpnext.controllers.accounts_controller.get_default_taxes_and_charges
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

  async getAddressDisplay(addressName: string): Promise<string> {
    try {
      const qp = new URLSearchParams()
      qp.set("address_dict", addressName)
      const result = await apiClient<string>(
        `/method/frappe.contacts.doctype.address.address.get_address_display?${qp.toString()}`
      )
      return typeof result === "string" ? result : ""
    } catch {
      return ""
    }
  },

  async getContactDetails(contactName: string): Promise<{
    contact_display?: string
    contact_email?: string
    contact_mobile?: string
    contact_phone?: string
    contact_designation?: string
    contact_department?: string
  }> {
    try {
      const qp = new URLSearchParams()
      qp.set("contact", contactName)
      const result = await apiClient<Record<string, unknown>>(
        `/method/frappe.contacts.doctype.contact.contact.get_contact_details?${qp.toString()}`
      )
      const r = (result && typeof result === "object" && !Array.isArray(result)) ? result : {}
      return {
        contact_display: (r.contact_display as string) || (r.contact_person as string) || undefined,
        contact_email: (r.contact_email as string) || undefined,
        contact_mobile: (r.contact_mobile as string) || undefined,
        contact_phone: (r.contact_phone as string) || undefined,
        contact_designation: (r.contact_designation as string) || undefined,
        contact_department: (r.contact_department as string) || undefined,
      }
    } catch {
      return {}
    }
  },

  // Mirrors erpnext.get_payment_terms → { payment_schedule }.
  async getPaymentTerms(
    template: string,
    postingDate: string,
    grandTotal: number,
  ): Promise<{ payment_schedule: Array<Record<string, unknown>> }> {
    const result = await apiFormCall<{ payment_schedule?: Array<Record<string, unknown>> }>(
      "/method/erpnext.controllers.accounts_controller.get_payment_terms",
      [
        ["terms_template", template],
        ["posting_date", postingDate],
        ["grand_total", String(grandTotal)],
      ],
    )
    return { payment_schedule: result?.payment_schedule ?? [] }
  },

  // Mirrors erpnext.utils.get_terms: renders Terms and Conditions template text.
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

  // ── Email / print ──────────────────────────────────────────────────
  async getPrintFormats(): Promise<string[]> {
    try {
      const raw = await apiClient<Array<{ name: string }>>(
        `/resource/Print Format?filters=${JSON.stringify([["doc_type", "=", DOCTYPE], ["disabled", "=", 0]])}&fields=["name"]&limit_page_length=100`
      )
      return raw.map((f) => f.name)
    } catch {
      return ["Standard"]
    }
  },

  async getEmailTemplate(templateName: string, doc: Record<string, unknown>): Promise<EmailTemplateResult | null> {
    try {
      const result = await postMethod<EmailTemplateResult>("frappe.email.doctype.email_template.email_template.get_email_template", {
        template_name: templateName,
        doc: JSON.stringify(doc),
      })
      return result
    } catch {
      return null
    }
  },

  async generatePDF(name: string, options?: {
    printFormat?: string
    letterHead?: string
    noLetterhead?: boolean
    language?: string
  }): Promise<Blob> {
    const params = new URLSearchParams()
    params.set("doctype", DOCTYPE)
    params.set("name", name)
    if (options?.printFormat) params.set("format", options.printFormat)
    if (options?.letterHead) params.set("letterhead", options.letterHead)
    if (options?.noLetterhead) params.set("no_letterhead", "1")
    if (options?.language) params.set("_lang", options.language)

    const res = await fetch(`${API_CONFIG.baseUrl}/method/frappe.utils.print_format.download_pdf?${params.toString()}`, {
      credentials: "include",
      headers: API_CONFIG.headers,
    })
    if (!res.ok) await throwServerMessageError(res, "Failed to generate PDF")
    return res.blob()
  },

  async sendEmail(name: string, data: {
    recipients: string
    cc?: string
    subject: string
    content: string
    printFormat?: string
    attachPdf?: boolean
    sendHtml?: boolean
  }): Promise<{ name: string }> {
    return apiClient<{ name: string }>("/method/frappe.core.doctype.communication.email.make", {
      method: "POST",
      body: JSON.stringify({
        doctype: DOCTYPE,
        name,
        recipients: data.recipients,
        cc: data.cc ?? "",
        subject: data.subject,
        content: data.content,
        communication_medium: "Email",
        send_email: 1,
        send_after_commit: 1,
        print_format: data.printFormat || "Standard",
        ...(data.attachPdf ? { attach_document_print: JSON.stringify({ doctype: DOCTYPE, name }) } : {}),
      }),
    })
  },

  // ── Single submit (PUT docstatus=1) ─────────────────────────────────
  async submitDoc(name: string): Promise<Quotation> {
    return apiClient<Quotation>(
      `/resource/${DOCTYPE}/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ docstatus: 1 }) },
    )
  },

  // ── Bulk submit / cancel / delete ───────────────────────────────────
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

  // ── Export (server-side via data_import.download_template) ──────────
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
        : QUOTATION_EXPORT_FIELDS,
      filters: options?.filters,
    })
  },

  // ── Bulk print (multi-PDF URL) ─────────────────────────────────────
  buildMultiPdfUrl(
    names: string[],
    options: {
      printFormat?: string
      letterhead?: string
      pageSize?: string
      customSize?: { height: number; width: number }
    } = {},
  ): string {
    const pdfOptions: Record<string, string> = {}
    if (options.customSize && options.customSize.height > 0 && options.customSize.width > 0) {
      pdfOptions["page-height"] = String(options.customSize.height)
      pdfOptions["page-width"] = String(options.customSize.width)
    } else {
      pdfOptions["page-size"] = options.pageSize ?? "A4"
    }
    const params = new URLSearchParams()
    params.set("doctype", DOCTYPE)
    params.set("name", JSON.stringify(names))
    params.set("format", options.printFormat ?? "Standard")
    params.set("no_letterhead", options.letterhead ? "0" : "1")
    if (options.letterhead) params.set("letterhead", options.letterhead)
    params.set("options", JSON.stringify(pdfOptions))
    return `${API_CONFIG.baseUrl}/method/frappe.utils.print_format.download_multi_pdf?${params.toString()}`
  },
}