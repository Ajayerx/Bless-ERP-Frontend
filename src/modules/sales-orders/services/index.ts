import { apiClient, apiFormCall, apiClientWithBody, serverMessagesFromBody, failedNamesFromMessages, serverDownloadTemplate, ApiError, type AppMessage } from "@/services/api-client"
import { todayISO as todayIsoDate } from "@/lib/utils"
import { postMethod, postMethodRaw } from "@/services/frappe-client"
import { API_CONFIG } from "@/config/api.config"
import { buildTimelineItems, toQuillHtml } from "@/modules/payments/services"
import type { DocInfo, PaymentActivityItem, PaymentComment } from "@/modules/payments/types"
import type { MappedDoc } from "../config/createTargets"
import {
  type SalesOrder,
  type SalesOrderListResponse,
  type SalesOrderDoc,
  type SalesOrderFormData,
  type SalesOrderItemForm,
  type SalesOrderTax,
  type SalesOrderStatus,
  type SalesOrderDocStatus,
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

export {
  getSalesOrderIndicator,
  SALES_ORDER_INDICATOR_LABELS,
  INDICATOR_FILTER_TUPLES,
  type SalesOrderIndicator,
  type SalesOrderIndicatorInput,
  type SalesOrderIndicatorLabel,
  type SalesOrderIndicatorVariant,
} from "./indicator"

const DOCTYPE = "Sales Order"

/** Columns offered by the list export dialog (server-side data_import template). */
export const SALES_ORDER_EXPORT_FIELDS: Record<string, string[]> = {
  "Sales Order": [
    "name", "title", "customer", "customer_name", "transaction_date", "delivery_date",
    "company", "currency", "grand_total", "total_taxes_and_charges",
    "per_delivered", "per_billed", "status", "docstatus",
  ],
  items: [
    "item_code", "item_name", "item_group", "brand", "qty", "rate", "amount",
    "uom", "warehouse", "delivery_date", "delivered_qty", "billed_amt",
  ],
  taxes: [
    "charge_type", "account_head", "description", "rate", "tax_amount", "total",
  ],
}

function toSalesOrderTargetDoc(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    doctype: "Sales Order",
  }
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue
    const mapped =
      key === "transactionDate" ? "transaction_date"
      : key === "deliveryDate" ? "delivery_date"
      : key === "sellingPriceList" ? "selling_price_list"
      : key === "conversionRate" ? "conversion_rate"
      : key === "customerName" ? "customer_name"
      : key === "skipDeliveryNote" ? "skip_delivery_note"
      : key === "orderType" ? "order_type"
      : key
    out[mapped] = value
  }
  return out
}

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
  "skip_delivery_note", "owner", "creation", "modified", "modified_by", "_assign", "_user_tags",
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
  if (Number(doc.docstatus) === 2) return "cancelled"
  const s = String(doc.status ?? "").toLowerCase()
  if (s === "draft" || s === "on hold") return "draft"
  if (s === "completed" || s === "closed") return "completed"
  if (s === "cancelled") return "cancelled"
  return "confirmed"
}

function mapFulfillment(doc: Record<string, unknown>): SalesOrder["fulfillmentStatus"] {
  if (Number(doc.docstatus) === 2) return "cancelled"
  const perDelivered = dnum(doc.per_delivered)
  if (perDelivered >= 100) return "fulfilled"
  if (perDelivered > 0) return "partial"
  return "pending"
}

function mapDoc(doc: Record<string, unknown>): SalesOrder {
  return {
    id: String(doc.name),
    name: String(doc.name),
    number: String(doc.name),
    customerId: String(doc.customer ?? ""),
    customerName: String(doc.customer_name ?? doc.customer ?? ""),
    issueDate: String(doc.transaction_date ?? ""),
    deliveryDate: String(doc.delivery_date ?? ""),
    status: mapStatus(doc),
    rawStatus: (String(doc.status ?? "") || "Draft") as SalesOrderStatus,
    docstatus: (Number(doc.docstatus) ? Math.min(Number(doc.docstatus), 2) : 0) as SalesOrderDocStatus,
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
    skipDeliveryNote: dnum(doc.skip_delivery_note),
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
  isNew?: boolean
  owner?: string
}

function deskChildRow(
  row: Record<string, unknown>,
  childDoctype: string,
  parentfield: string,
  idx: number,
  parentName: string,
  opts: DeskDocEnvelopeOptions = { isNew: false },
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
      parent: parentName,
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
      parent: parentName,
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

// ── apply_price_list helpers (TransactionController parity) ───────────

export function buildApplyPriceListArgs(
  doc: Partial<SalesOrderDoc> & Record<string, unknown>,
): Record<string, unknown> {
  const rows = (doc.items ?? []) as unknown as Array<Record<string, unknown>>
  const item_list: Array<Record<string, unknown>> = []
  for (const d of rows) {
    if (!d.item_code) continue
    item_list.push({
      doctype: d.doctype ?? "Sales Order Item",
      name: d.name,
      child_docname: d.name,
      item_code: d.item_code,
      item_group: d.item_group,
      brand: d.brand,
      qty: d.qty,
      stock_qty: d.stock_qty,
      uom: d.uom,
      stock_uom: d.stock_uom,
      parenttype: d.parenttype ?? DOCTYPE,
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
    customer: doc.customer,
    order_type: doc.order_type,
    customer_group: doc.customer_group,
    territory: doc.territory,
    currency: doc.currency,
    conversion_rate: doc.conversion_rate,
    price_list: doc.selling_price_list,
    price_list_currency: doc.price_list_currency,
    plc_conversion_rate: doc.plc_conversion_rate,
    company: doc.company,
    transaction_date: doc.transaction_date,
    delivery_date: doc.delivery_date,
    campaign: doc.campaign,
    sales_partner: doc.sales_partner,
    ignore_pricing_rule: doc.ignore_pricing_rule,
    doctype: DOCTYPE,
    name: doc.name,
    update_stock: 0,
    pos_profile: "",
    coupon_code: doc.coupon_code,
    is_internal_customer: doc.is_internal_customer,
  }
}

export function buildDeskApplyPriceListDoc(
  form: Partial<SalesOrderDoc> & Record<string, unknown>,
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
    naming_series: form.naming_series ?? "SAL-ORD-.YYYY.-",
    transaction_date: form.transaction_date ?? "",
    order_type: form.order_type ?? "Sales",
    has_unit_price_items: cint(form.has_unit_price_items),
    currency: form.currency ?? "",
    selling_price_list: form.selling_price_list ?? "",
    price_list_currency: form.price_list_currency ?? "",
    ignore_pricing_rule: cint(form.ignore_pricing_rule),
    items: rowsOf("items").map((r, i) => deskChildRow(r, "Sales Order Item", "items", i + 1, form.name ?? "", opts)),
    taxes: rowsOf("taxes").map((r, i) => deskChildRow(r, "Sales Taxes and Charges", "taxes", i + 1, form.name ?? "", opts)),
    disable_rounded_total: cint(form.disable_rounded_total),
    apply_discount_on: form.apply_discount_on ?? "Grand Total",
    packed_items: rowsOf("packed_items"),
    pricing_rules: rowsOf("pricing_rules"),
    payment_schedule: rowsOf("payment_schedule"),
    group_same_items: cint(form.group_same_items),
    status: form.status ?? "Draft",
    customer: form.customer ?? "",
    customer_name: form.customer_name ?? "",
    conversion_rate: form.conversion_rate ?? 1,
    plc_conversion_rate: form.plc_conversion_rate ?? "",
    company: form.company ?? "",
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
    customer_address: form.customer_address ?? "",
    address_display: form.address_display ?? "",
    shipping_address_name: form.shipping_address_name ?? "",
    shipping_address: form.shipping_address ?? "",
    shipping_contact_person: form.shipping_contact_person ?? "",
    shipping_contact_display: form.shipping_contact_display ?? "",
    shipping_contact_mobile: form.shipping_contact_mobile ?? "",
    dispatch_address_name: form.dispatch_address_name ?? "",
    dispatch_address: form.dispatch_address ?? "",
    tax_category: form.tax_category ?? "",
    contact_person: form.contact_person ?? "",
    contact_display: form.contact_display ?? "",
    contact_phone: form.contact_phone ?? "",
    contact_email: form.contact_email ?? "",
    contact_mobile: form.contact_mobile ?? "",
    customer_group: form.customer_group ?? "",
    territory: form.territory ?? "",
    language: form.language ?? "",
    company_contact_person: form.company_contact_person ?? "",
    payment_terms_template: form.payment_terms_template ?? null,
    delivery_date: form.delivery_date ?? "",
    po_no: form.po_no ?? "",
    set_warehouse: form.set_warehouse ?? "",
    reserve_stock: cint(form.reserve_stock),
    cost_center: form.cost_center ?? "",
    project: form.project ?? "",
  }
  return doc
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
  shipping_contact_person?: string
  shipping_contact_display?: string
  shipping_contact_mobile?: string
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
        message: `${name} is linked with Sales Order ${linkedAmendment}. Delete that amendment first, then try again.`,
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

export const salesOrderService = {
  lookups: {
    currencies: (): Promise<string[]> => fetchOptions("Currency"),
    priceLists: (): Promise<string[]> => fetchOptions("Price List", [["selling", "=", 1]]),
    letterHeads: (): Promise<string[]> => fetchOptions("Letter Head", [["disabled", "=", 0]]),
  },

  // ── List / single ─────────────────────────────────────────────────
  async list(params: {
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
    /** Raw frappe filter tuples in ERPNext's list-view wire format
     * `[doctype, field, operator, value]` (AND'd with the typed params). */
    filters?: unknown[][]
  }): Promise<SalesOrderListResponse> {
    const pageSize = params.pageSize ?? 10
    const limit_start = ((params.page ?? 1) - 1) * pageSize
    const filters: unknown[] = []

    if (params.status && params.status !== "all" && params.status !== "All") {
      filters.push([DOCTYPE, "status", "=", params.status])
    }
    if (params.customerId) filters.push([DOCTYPE, "customer", "=", params.customerId])
    if (params.transactionDateFrom) filters.push([DOCTYPE, "transaction_date", ">=", params.transactionDateFrom])
    if (params.transactionDateTo) filters.push([DOCTYPE, "transaction_date", "<=", params.transactionDateTo])
    if (params.deliveryDateFrom) filters.push([DOCTYPE, "delivery_date", ">=", params.deliveryDateFrom])
    if (params.deliveryDateTo) filters.push([DOCTYPE, "delivery_date", "<=", params.deliveryDateTo])
    if (params.assignedTo) filters.push([DOCTYPE, "_assign", "like", `%${params.assignedTo}%`])
    if (params.filters && params.filters.length > 0) filters.push(...params.filters)

    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "transaction_date desc"

    const [rows, total] = await Promise.all([
      apiClient<Record<string, unknown>[]>(
        buildListUrl({
          fields: LIST_FIELDS,
          filters: filters.length > 0 ? filters : undefined,
          limit_page_length: pageSize,
          limit_start,
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
    cleaned.advance_paid = 0
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

  // frappe.desk.search.search_link for the list "Customer" filter chip.
  async searchCustomers(
    query: string,
  ): Promise<Array<{ value: string; label: string; description: string }>> {
    const results = await apiClient<{ value: string; label?: string; description?: string }[]>(
      `/method/frappe.desk.search.search_link?` +
        new URLSearchParams({
          doctype: "Customer",
          txt: query,
          page_length: "10",
          ignore_user_permissions: "0",
          filters: JSON.stringify({ disabled: 0 }),
        }).toString()
    )
    return (results ?? []).map((u) => ({
      value: u.value,
      label: u.label ?? u.value,
      description: u.description ?? "",
    }))
  },

  // frappe.desk.search.search_link for the list "Company" filter chip.
  async searchCompanies(
    query: string,
  ): Promise<Array<{ value: string; label: string; description: string }>> {
    const results = await apiClient<{ value: string; label?: string; description?: string }[]>(
      `/method/frappe.desk.search.search_link?` +
        new URLSearchParams({
          doctype: "Company",
          txt: query,
          page_length: "10",
          ignore_user_permissions: "0",
        }).toString()
    )
    return (results ?? []).map((u) => ({
      value: u.value,
      label: u.label ?? u.value,
      description: u.description ?? "",
    }))
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

  // Warehouse search scoped to the Sales Order's company (mirrors ERPNext's
  // warehouse_query link).
  async searchWarehouses(
    query: string,
    company?: string,
  ): Promise<Array<{ value: string; label: string; description: string }>> {
    try {
      const filters: Record<string, unknown> = { is_group: 0 }
      if (company) filters.company = ["in", ["", company]]
      const results = await apiFormCall<Array<{ value: string; label?: string; description?: string }>>(
        "/method/frappe.desk.search.search_link",
        [
          ["txt", query],
          ["doctype", "Warehouse"],
          ["ignore_user_permissions", "0"],
          ["reference_doctype", "Sales Order Item"],
          ["page_length", "10"],
          ["filters", JSON.stringify(filters)],
        ],
        { doctype: "Warehouse" },
      )
      return (results ?? []).map((u) => ({
        value: u.value,
        label: u.label ?? u.value,
        description: u.description ?? "",
      }))
    } catch {
      return []
    }
  },

  // frappe.desk.search.search_link for the address fields (Address tab).
  // Byte-parity with ERPNext (sales_common.js setup_queries → queries.js
  // address_query/company_address_query/dispatch_address_query): the custom
  // address_query is passed and results are filtered to the linked party.
  async searchAddressesDesk(
    query: string,
    linkDoctype?: string,
    linkName?: string,
  ): Promise<Array<{ value: string; label: string; description: string }>> {
    try {
      const filters: Record<string, unknown> = {}
      if (linkDoctype) filters.link_doctype = linkDoctype
      if (linkName) filters.link_name = linkName
      const results = await apiFormCall<Array<{ value: string; label?: string; description?: string }>>(
        "/method/frappe.desk.search.search_link",
        [
          ["txt", query],
          ["doctype", "Address"],
          ["ignore_user_permissions", "0"],
          ["reference_doctype", "Sales Order"],
          ["page_length", "10"],
          ["query", "frappe.contacts.doctype.address.address.address_query"],
          ["filters", JSON.stringify(filters)],
        ],
        { doctype: "Address" },
      )
      return (results ?? []).map((u) => ({
        value: u.value,
        label: u.label ?? u.value,
        description: u.description ?? "",
      }))
    } catch {
      return []
    }
  },

  // frappe.desk.search.search_link for the contact fields (Address tab).
  // Byte-parity with ERPNext contact_query/company_contact_query.
  async searchContactsDesk(
    query: string,
    linkDoctype?: string,
    linkName?: string,
  ): Promise<Array<{ value: string; label: string; description: string }>> {
    try {
      const filters: Record<string, unknown> = {}
      if (linkDoctype) filters.link_doctype = linkDoctype
      if (linkName) filters.link_name = linkName
      const results = await apiFormCall<Array<{ value: string; label?: string; description?: string }>>(
        "/method/frappe.desk.search.search_link",
        [
          ["txt", query],
          ["doctype", "Contact"],
          ["ignore_user_permissions", "0"],
          ["reference_doctype", "Sales Order"],
          ["page_length", "10"],
          ["query", "frappe.contacts.doctype.contact.contact.contact_query"],
          ["filters", JSON.stringify(filters)],
        ],
        { doctype: "Contact" },
      )
      return (results ?? []).map((u) => ({
        value: u.value,
        label: u.label ?? u.value,
        description: u.description ?? "",
      }))
    } catch {
      return []
    }
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

  /**
   * Mirror of ERPNext fetch_from: when a Link field with `fetch_from` (e.g.
   * commission_rate -> sales_partner.commission_rate) gets a value, the link
   * control fires frappe.model.utils.get_fetch_values and applies the returned
   * field values (obeying fetch_if_empty). Returns the raw `fetch_values` map.
   */
  async getFetchValues(doctype: string, fieldname: string, value: string): Promise<Record<string, unknown>> {
    try {
      const res = await apiFormCall<{ fetch_values?: Record<string, unknown> }>(
        "/method/frappe.model.utils.get_fetch_values",
        [
          ["doctype", doctype],
          ["fieldname", fieldname],
          ["value", value],
        ],
        { doctype },
      )
      return res?.fetch_values ?? {}
    } catch {
      return {}
    }
  },

  /**
   * Mirror of the ERPNext "Update Auto Repeat Reference" button handler
   * (sales_common.js update_auto_repeat_reference → frappe.desk.doctype.
   * auto_repeat.auto_repeat.update_reference). Returns the wire message
   * ("success" on success).
   */
  async updateAutoRepeatReference(docname: string, reference: string): Promise<string> {
    try {
      const res = await apiFormCall<unknown>(
        "/method/frappe.desk.doctype.auto_repeat.auto_repeat.update_reference",
        [
          ["doctype", "Auto Repeat"],
          ["docname", docname],
          ["reference", reference],
        ],
        { doctype: "Auto Repeat" },
      )
      return typeof res === "string" ? res : String(res ?? "")
    } catch {
      return ""
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

  // Byte-parity with transaction.js payment_terms_template(): POSTs
  // erpnext.controllers.accounts_controller.get_payment_terms with
  // terms_template/posting_date/grand_total/base_grand_total (grand_total
  // falls back to rounded_total like ERPNext) and returns the bare schedule
  // array to replace payment_schedule with.
  async getPaymentTerms(
    termsTemplate: string,
    postingDate: string,
    grandTotal: number,
    baseGrandTotal: number,
  ): Promise<Array<Record<string, unknown>> | null> {
    try {
      const result = await apiFormCall<Array<Record<string, unknown>>>(
        "/method/erpnext.controllers.accounts_controller.get_payment_terms",
        [
          ["terms_template", termsTemplate],
          ["posting_date", postingDate],
          ["grand_total", String(grandTotal)],
          ["base_grand_total", String(baseGrandTotal)],
        ],
      )
      return Array.isArray(result) ? result : null
    } catch {
      return null
    }
  },

  // Byte-parity with transaction.js payment_term(): POSTs
  // get_payment_term_details for a single row when the Payment Term is
  // picked, auto-filling description/invoice_portion/payment_amount/due_date.
  async getPaymentTermDetails(
    term: string,
    postingDate: string,
    grandTotal: number,
    baseGrandTotal: number,
  ): Promise<Record<string, unknown> | null> {
    try {
      return await apiFormCall<Record<string, unknown>>(
        "/method/erpnext.controllers.accounts_controller.get_payment_term_details",
        [
          ["term", term],
          ["posting_date", postingDate],
          ["grand_total", String(grandTotal)],
          ["base_grand_total", String(baseGrandTotal)],
        ],
      )
    } catch {
      return null
    }
  },

  // Byte-parity with erpnext.utils.get_terms(): renders the Terms and
  // Conditions template server-side and returns the text for the terms field.
  async getTermsAndConditions(
    templateName: string,
    doc: Record<string, unknown>,
  ): Promise<string | null> {
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

  // ── Create menu (make_mapped_doc + status / reservation) ───────────
  // ERPNext `make_mapped_doc` returns an UNSAVED prefilled doc dict (no name),
  // which the frontend opens as a create form (open_mapped_doc semantics).
  // Saved endpoints (work orders / raw material request / per-supplier POs)
  // still return inserted names.
  async makeDeliveryNote(
    sourceName: string,
    args?: { delivery_dates?: string[]; for_reserved_stock?: boolean; skip_item_mapping?: boolean },
  ): Promise<MappedDoc> {
    return apiClient<MappedDoc>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_delivery_note", source_name: sourceName, ...(args ? { args: JSON.stringify(args) } : {}) }) },
    )
  },

  async makeSalesInvoice(sourceName: string): Promise<MappedDoc> {
    return apiClient<MappedDoc>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice", source_name: sourceName }) },
    )
  },

  async makeMaterialRequest(sourceName: string): Promise<MappedDoc> {
    return apiClient<MappedDoc>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_material_request", source_name: sourceName }) },
    )
  },

  async makeRawMaterialRequest(
    items: Array<{ item_code: string; warehouse?: string; bom?: string; required_qty?: number }>,
    company: string,
    salesOrder: string,
    project?: string,
    opts?: { includeExplodedItems?: boolean; ignoreExistingOrderedQty?: boolean },
  ): Promise<{ doctype: string; name: string } | null> {
    return postMethod<{ doctype: string; name: string } | null>(
      "erpnext.selling.doctype.sales_order.sales_order.make_raw_material_request",
      {
        items: JSON.stringify({
          include_exploded_items: opts?.includeExplodedItems ? 1 : 0,
          ignore_existing_ordered_qty: opts?.ignoreExistingOrderedQty ? 1 : 0,
          items,
        }),
        company,
        sales_order: salesOrder,
        project: project ?? "",
      },
    )
  },

  async makeWorkOrders(
    items: Array<{
      bom: string
      item_code: string
      pending_qty: number
      sales_order_item?: string
      warehouse?: string
      description?: string
    }>,
    salesOrder: string,
    company: string,
    project?: string,
  ): Promise<string[]> {
    return postMethod<string[]>(
      "erpnext.selling.doctype.sales_order.sales_order.make_work_orders",
      { items: JSON.stringify({ items }), sales_order: salesOrder, company, project: project ?? "" },
    )
  },

  async makeProject(sourceName: string): Promise<MappedDoc> {
    return apiClient<MappedDoc>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_project", source_name: sourceName }) },
    )
  },

  async makePurchaseOrder(
    sourceName: string,
    selectedItems: Array<{
      name?: string
      item_code?: string
      item_name?: string
      pending_qty?: number
      uom?: string
      supplier?: string
    }>,
  ): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/erpnext.selling.doctype.sales_order.sales_order.make_purchase_order",
      { method: "POST", body: JSON.stringify({ source_name: sourceName, selected_items: JSON.stringify(selectedItems) }) },
    )
  },

  async makeInterCompanyPurchaseOrder(sourceName: string): Promise<MappedDoc> {
    return apiClient<MappedDoc>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_inter_company_purchase_order", source_name: sourceName }) },
    )
  },

  async makeMaintenanceSchedule(sourceName: string): Promise<MappedDoc> {
    return apiClient<MappedDoc>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_maintenance_schedule", source_name: sourceName }) },
    )
  },

  async makeMaintenanceVisit(sourceName: string): Promise<MappedDoc> {
    return apiClient<MappedDoc>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.sales_order.sales_order.make_maintenance_visit", source_name: sourceName }) },
    )
  },

  async makePaymentRequest(sourceName: string): Promise<MappedDoc> {
    return apiClient<MappedDoc>(
      "/method/erpnext.accounts.doctype.payment_request.payment_request.make_payment_request",
      { method: "POST", body: JSON.stringify({ dt: DOCTYPE, dn: sourceName }) },
    )
  },

  async makePaymentEntry(sourceName: string): Promise<MappedDoc> {
    return apiClient<MappedDoc>(
      "/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry",
      { method: "POST", body: JSON.stringify({ dt: DOCTYPE, dn: sourceName }) },
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
    const messages = serverMessagesFromBody(result)
    const undeleted = Array.isArray(msg) ? msg : Array.isArray(msg?.undeleted_items) ? msg.undeleted_items : []
    const failed = undeleted.length > 0 ? undeleted : failedNamesFromMessages(requested, messages)
    return { failed, deleted: requested.filter((name) => !failed.includes(name)), messages }
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
        : SALES_ORDER_EXPORT_FIELDS,
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
    background = false,
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
    const method = background
      ? "frappe.utils.print_format.download_multi_pdf_async"
      : "frappe.utils.print_format.download_multi_pdf"
    return `${API_CONFIG.baseUrl}/method/${method}?${params.toString()}`
  },

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

  // ── Status / bulk close ─────────────────────────────────────────────
  // erpnext.selling.doctype.sales_order.sales_order.close_or_unclose_sales_orders.
  async closeOrUncloseSalesOrders(names: string[], status: "Closed" | "Open"): Promise<{ message?: string }> {
    return postMethod<{ message?: string }>(
      "erpnext.selling.doctype.sales_order.sales_order.close_or_unclose_sales_orders",
      {
        names: JSON.stringify(names),
        status: status === "Closed" ? "Closed" : "Draft",
      },
    )
  },

  // ── Calendar / events ───────────────────────────────────────────────
  // erpnext.selling.doctype.sales_order.sales_order.get_events.
  async getEvents(start: string, end: string, filters?: string): Promise<
    Array<{
      name: string
      customer_name?: string
      status?: string
      delivery_status?: string
      billing_status?: string
      delivery_date?: string
    }>
  > {
    return postMethod<
      Array<{
        name: string
        customer_name?: string
        status?: string
        delivery_status?: string
        billing_status?: string
        delivery_date?: string
      }>
    >("erpnext.selling.doctype.sales_order.sales_order.get_events", {
      start,
      end,
      filters: filters ?? "[]",
    })
  },

  // erpnext.selling.doctype.sales_order.sales_order.make_purchase_order_for_default_supplier.
  // Returns a single Purchase Order (target_doc) object.
  async makePurchaseOrderForDefaultSupplier(
    sourceName: string,
    selectedItems: Array<{ name: string; item_code?: string; item_name?: string; pending_qty?: number; uom?: string; supplier?: string }>,
  ): Promise<unknown> {
    return postMethodRaw<unknown>(
      "erpnext.selling.doctype.sales_order.sales_order.make_purchase_order_for_default_supplier",
      {
        source_name: sourceName,
        selected_items: JSON.stringify(selectedItems),
        target_doc: undefined,
      },
    )
  },

  // erpnext.selling.doctype.sales_order.sales_order.get_work_order_items —
  // pre-fetch of BOM items before the Work Order dialog.
  async getWorkOrderItems(
    salesOrder: string,
    forRawMaterialRequest = 0,
  ): Promise<
    Array<{
      name: string
      item_code: string
      description?: string
      bom?: string
      warehouse?: string
      pending_qty?: number
      required_qty?: number
      sales_order_item?: string
    }>
  > {
    return postMethod<
      Array<{
        name: string
        item_code: string
        description?: string
        bom?: string
        warehouse?: string
        pending_qty?: number
        required_qty?: number
        sales_order_item?: string
      }>
    >("erpnext.selling.doctype.sales_order.sales_order.get_work_order_items", {
      sales_order: salesOrder,
      for_raw_material_request: forRawMaterialRequest,
    })
  },

  // erpnext.selling.doctype.sales_order.sales_order.get_stock_reservation_status —
  // gates the `reserve_stock` checkbox visibility/read-only.
  async getStockReservationStatus(): Promise<boolean> {
    try {
      return !!(
        await postMethodRaw<{ message?: number | boolean }>(
          "erpnext.selling.doctype.sales_order.sales_order.get_stock_reservation_status",
          {},
        )
      ).message
    } catch {
      return true
    }
  },

  // ── Update Items on submitted Sales Order ───────────────────────────
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
    const body = await postMethodRaw<{ exc_type?: string }>(
      "erpnext.controllers.accounts_controller.update_child_qty_rate",
      {
        parent_doctype: DOCTYPE,
        trans_items: JSON.stringify(transItems),
        parent_doctype_name: parentDoctypeName,
        child_docname: childDocname,
      },
    )
    const messages = serverMessagesFromBody(body)
    if (messages.length > 0) {
      throw new ApiError(0, messages.map((m) => m.message).join(" "), undefined, messages[0])
    }
  },

  // ── Get Items From (map source docs to current SO inline) ──────────
  async mapSourceDocuments(
    method: string,
    sourceNames: string[],
    targetDoc: Record<string, unknown>,
    args?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // ERPNext map_docs merges source docs INTO the provided target_doc. Like
    // erpnext.utils.map_current_doc we forward only a minimal header target:
    // dumping the whole SO doc (items/taxes/name/docstatus) makes the backend
    // return the mapped doc with an empty item table.
    const headerTarget: Record<string, unknown> = { doctype: "Sales Order" }
    for (const key of [
      "customer",
      "company",
      "transaction_date",
      "delivery_date",
      "currency",
      "order_type",
      "selling_price_list",
      "price_list_currency",
      "conversion_rate",
      "plc_conversion_rate",
      "project",
      "set_warehouse",
      "skip_delivery_note",
    ] as const) {
      const value = targetDoc[key]
      if (value !== undefined && value !== null) headerTarget[key] = value
    }
    const mappedTarget = toSalesOrderTargetDoc(headerTarget)
    return apiFormCall<Record<string, unknown>>("/method/frappe.model.mapper.map_docs", [
      ["method", method],
      ["source_names", JSON.stringify(sourceNames)],
      ["target_doc", JSON.stringify(mappedTarget)],
      ["args", JSON.stringify(args ?? {})],
    ])
  },

  async searchWidget(args: {
    doctype: string
    txt?: string
    query?: string
    searchfield?: string
    start?: number
    page_length?: number
    filters?: Record<string, unknown>
    filter_fields?: string[]
    as_dict?: boolean
  }): Promise<Array<Record<string, unknown>>> {
    const fields: Array<[string, string]> = [
      ["doctype", args.doctype],
      ["txt", args.txt ?? ""],
      ...(args.query ? [["query", args.query] as [string, string]] : []),
      ...(args.searchfield ? [["searchfield", args.searchfield] as [string, string]] : []),
      ["start", String(args.start ?? 0)],
      ["page_length", String(args.page_length ?? 10)],
    ]
    if (args.filters) fields.push(["filters", JSON.stringify(args.filters)])
    if (args.filter_fields) fields.push(["filter_fields", JSON.stringify(args.filter_fields)])
    fields.push(["as_dict", args.as_dict === false ? "false" : "true"])
    return apiFormCall<Array<Record<string, unknown>>>(
      "/method/frappe.desk.search.search_widget",
      fields,
      { doctype: args.doctype },
    )
  },

  async getList(args: {
    doctype: string
    fields: string[]
    filters?: unknown[]
    parent?: string
    order_by?: string
    limit_start?: number
    limit_page_length?: number
  }): Promise<Array<Record<string, unknown>>> {
    const fields: Array<[string, string]> = [
      ["doctype", args.doctype],
      ["fields", JSON.stringify(args.fields)],
    ]
    if (args.filters) fields.push(["filters", JSON.stringify(args.filters)])
    if (args.parent !== undefined) fields.push(["parent", args.parent])
    if (args.order_by) fields.push(["order_by", args.order_by])
    fields.push(["limit_start", String(args.limit_start ?? 0)])
    fields.push(["limit_page_length", String(args.limit_page_length ?? 20)])
    return apiFormCall<Array<Record<string, unknown>>>("/method/frappe.client.get_list", fields, {
      doctype: args.doctype,
    })
  },
}

export { deskChildRow }
export type { DeskDocEnvelopeOptions }

/** Child-row std fields skipped when merging desk get_item_details output. */
export const SALES_ORDER_ITEM_STD_FIELDS = new Set([
  "doctype",
  "name",
  "owner",
  "creation",
  "modified",
  "modified_by",
  "docstatus",
  "idx",
  "parent",
  "parentfield",
  "parenttype",
  "__islocal",
  "__unsaved",
  "__unedited",
  "_user_tags",
  "comments",
  "likes",
])

export interface EnrichSalesOrderItemOptions {
  /** True for a fresh unsaved doc (desk __islocal/__unsaved envelope). */
  isNew: boolean
  /** Session user id (desk doc.owner). Omitted when unknown. */
  owner?: string
  /** Resolved doc name for the desk call (existing name or new-doc id). */
  name: string
  /** Company fallback when snapshot carries no company value. */
  company?: string
}

/**
 * ERPNext-faithful item select for a Sales Order item row. Single source of
 * truth shared by the form's item grid and the Update Items dialog (mirrors
 * the quotation module's enrichQuotationItem): validates the item link, calls
 * the full desk get_item_details (price list, currency conversion, margins,
 * discounts, pricing rules, item defaults), computes the net rate + amount
 * like transaction.js, and fetches the item tax template.
 *
 * `snapshot` is the current Sales Order doc (party/price list/currency…),
 * `item` the target row to enrich (may carry existing qty). The desk call
 * rewrites volatile child fields (uom/conversion_factor/price fields reset to
 * 0) exactly as the main form's runItemCodeFlow does; `opts.isNew` must
 * therefore be true only for a real new doc.
 */
export async function enrichSalesOrderItem(
  snapshot: Partial<SalesOrderDoc> & Record<string, unknown>,
  item: SalesOrderItemForm | null,
  itemCode: string,
  opts: EnrichSalesOrderItemOptions,
): Promise<SalesOrderItemForm | null> {
  if (!item || !itemCode) return null

  const patched: SalesOrderItemForm = {
    ...item,
    item_code: itemCode,
    weight_per_unit: 0,
    weight_uom: "",
    uom: "",
    conversion_factor: 0,
    barcode: null,
    pricing_rules: "",
  }

  await salesOrderService.validateLink("Item", itemCode, []).catch(() => undefined)

  const items = [...((snapshot.items ?? []) as SalesOrderItemForm[])]
  const idxOf = items.findIndex((r) => r === item || r.name === item.name)
  if (idxOf >= 0) items[idxOf] = patched
  else items.push(patched)

  // ERPNext resolves the rate from args.price_list. A Sales Order whose
  // selling_price_list is empty (e.g. a hand-crafted doc) yields rate 0 even
  // when an Item Price exists — fall back to the customer's default price
  // list so the added item still prices itself like desk would.
  let priceList = String(snapshot.selling_price_list || "").trim()
  if (!priceList) {
    const customer = String(snapshot.customer || "").trim()
    if (customer) {
      const defaults = await salesOrderService.getValue(
        "Customer",
        "default_price_list",
        { name: customer },
      )
      const fallback = (defaults as { default_price_list?: unknown })?.default_price_list
      if (typeof fallback === "string" && fallback.trim()) priceList = fallback.trim()
    }
  }

  const docName = opts.name || `new-sales-order-${deskRandomString()}`
  const doc = buildDeskApplyPriceListDoc(
    { ...snapshot, name: docName, items },
    { isNew: opts.isNew, owner: opts.owner },
  )
  const args: Record<string, unknown> = {
    item_code: itemCode,
    barcode: null,
    serial_no: undefined,
    batch_no: undefined,
    set_warehouse: snapshot.set_warehouse || undefined,
    warehouse: patched.warehouse || undefined,
    customer: snapshot.customer || undefined,
    currency: snapshot.currency || undefined,
    conversion_rate: snapshot.conversion_rate ?? 1,
    price_list: priceList || undefined,
    price_list_currency: snapshot.price_list_currency || undefined,
    plc_conversion_rate: snapshot.plc_conversion_rate ?? 1,
    company: snapshot.company || opts.company,
    order_type: snapshot.order_type || undefined,
    ignore_pricing_rule: snapshot.ignore_pricing_rule ?? 0,
    doctype: DOCTYPE,
    name: docName || undefined,
    qty: patched.qty || 1,
    net_rate: patched.rate || undefined,
    stock_qty: patched.stock_qty || undefined,
    conversion_factor: 0,
    weight_per_unit: 0,
    uom: null,
    stock_uom: patched.stock_uom || "Nos",
    tax_category: snapshot.tax_category || "",
    item_tax_template: undefined,
    child_doctype: "Sales Order Item",
    child_docname: patched.name || undefined,
    transaction_date: snapshot.transaction_date || todayIsoDate(),
    delivery_date: snapshot.delivery_date || "",
    is_pos: 0,
    is_return: 0,
    is_subcontracted: undefined,
    update_stock: 0,
  }

  const details = await salesOrderService.getItemDetailsDesk(doc, args)
  if (!details || typeof details !== "object") return null

  const merged: Record<string, unknown> = { ...patched }
  for (const [k, v] of Object.entries(details)) {
    if (SALES_ORDER_ITEM_STD_FIELDS.has(k)) continue
    merged[k] = v
  }

  const plr = Number(merged.price_list_rate) || 0
  const marginType = String(merged.margin_type ?? "")
  const mra = Number(merged.margin_rate_or_amount) || 0
  const rateWithMargin = plr + (marginType === "Percentage" ? plr * (mra / 100) : mra)
  const discPct = Number(merged.discount_percentage) || 0
  let discountAmount = Number(merged.discount_amount) || 0
  if (discPct && !discountAmount) discountAmount = rateWithMargin * (discPct / 100)
  let rate = rateWithMargin
  if (discountAmount > 0) {
    rate = rateWithMargin - discountAmount
    merged.discount_percentage = (100 * discountAmount) / rateWithMargin
  }

  const qty = Number(merged.qty) || 0
  const convRate = Number(snapshot.conversion_rate) || 1
  merged.rate = Math.round(rate * 100) / 100
  merged.amount = Math.round(rate * qty * 100) / 100
  merged.base_net_rate = Math.round(rate * convRate * 100) / 100
  merged.stock_qty = qty * (Number(merged.conversion_factor) || 0)

  if (plr > 0 && rate > plr) {
    merged.discount_percentage = 0
    merged.margin_type = "Amount"
    merged.margin_rate_or_amount = Math.round((rate - plr) * 100) / 100
    merged.rate_with_margin = rate
  } else if (plr > 0) {
    merged.discount_percentage = Math.round((1 - rate / plr) * 100 * 100) / 100
    merged.discount_amount = Math.round((plr - rate) * 100) / 100
    merged.margin_type = ""
    merged.margin_rate_or_amount = 0
    merged.rate_with_margin = 0
  } else {
    merged.discount_percentage = 0
    merged.margin_type = ""
    merged.margin_rate_or_amount = 0
    merged.rate_with_margin = 0
  }

  if (!merged.delivery_date) {
    merged.delivery_date = snapshot.delivery_date || ""
  }

  const mergedRow = merged as unknown as SalesOrderItemForm

  if (mergedRow.item_code && mergedRow.rate) {
    const tpl = await salesOrderService.getItemTaxTemplate({
      item_code: mergedRow.item_code,
      company: snapshot.company || opts.company || "",
      base_net_rate: Number(merged.base_net_rate) || 0,
      tax_category: snapshot.tax_category || "",
      transaction_date: snapshot.transaction_date || "",
    })
    if (tpl) mergedRow.item_tax_template = tpl
  }

  return mergedRow
}
