import { apiClient } from "@/services/api-client"
import { API_CONFIG } from "@/config/api.config"
import { getCompany } from "@/services/company"
import { getDefaultTaxTemplate as sharedGetDefault, getTaxTemplateDetails as sharedGetDetails } from "@/services/tax-template"
export type { TaxTemplateResult, TaxRow } from "@/services/tax-template"
import type { TaxTemplateResult } from "@/services/tax-template"
import type { SalesInvoice, SalesInvoiceFormData, SalesInvoiceItem, SalesInvoiceTax, SalesInvoiceListResponse, EditableTaxRow, ChargeType } from "../types"

export type { SalesInvoice, SalesInvoiceFormData, SalesInvoiceItem, SalesInvoiceTax, SalesInvoiceListResponse, EditableTaxRow, ChargeType }

export interface AccountInfo {
  name: string
  account_name?: string
  account_type?: string
  tax_rate?: number
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

const SALES_DOCTYPE = "Sales Taxes and Charges Template"

function buildListUrl(
  doctype: string,
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
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

async function getCount(doctype: string, filters?: unknown[]): Promise<number> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  if (filters) qp.set("filters", JSON.stringify(filters))
  const result = await apiClient<number | string>(`/method/frappe.client.get_count?${qp.toString()}`)
  return Number(result)
}

const LIST_FIELDS = [
  "name", "customer", "customer_name", "posting_date", "due_date",
  "grand_total", "total_taxes_and_charges", "outstanding_amount", "status", "docstatus",
  "currency", "company",
]

const DETAIL_FIELDS = [
  ...LIST_FIELDS,
  "posting_time", "conversion_rate", "selling_price_list", "price_list_currency", "plc_conversion_rate",
  "ignore_pricing_rule", "set_warehouse", "set_target_warehouse", "update_stock", "net_total", "total_taxes_and_charges",
  "rounded_total", "in_words", "taxes_and_charges", "tax_category",
  "customer_address", "shipping_address_name", "contact_person",
  "contact_email", "contact_mobile", "po_no", "po_date",
  "payment_terms_template", "apply_discount_on", "discount_amount",
  "additional_discount_percentage", "coupon_code", "additional_discount_account",
  "is_cash_or_non_trade_discount", "disable_rounded_total", "use_company_roundoff_cost_center",
  "write_off_amount", "write_off_account", "write_off_cost_center",
  "write_off_outstanding_amount_automatically",
  "cost_center", "project", "debit_to",
  // Phase D
  "sales_partner", "commission_rate", "total_commission",
  "redeem_loyalty_points", "loyalty_program", "loyalty_points", "loyalty_amount",
  "redemption_account", "redemption_cost_center",
  "letter_head", "group_same_items", "select_print_heading", "language",
  "tc_name", "terms",
  // Phase E
  "is_return", "return_against", "is_debit_note",
  "update_billed_amount_in_sales_order", "update_billed_amount_in_delivery_note",
  "update_outstanding_for_self",
  "allocate_advances_automatically", "only_include_allocated_payments",
  "is_pos", "pos_profile", "account_for_change_amount",
  "subscription", "from_date", "to_date", "auto_repeat",
  "is_opening", "customer_group", "remarks",
  // Phase F: fetch_from / round-trip fields
  "title", "naming_series", "set_posting_time",
  "tax_id", "company_tax_id", "is_internal_customer", "represents_company",
  "dispatch_address_name", "contact_display",
  "company_address", "company_address_display",
  "tax_withholding_category",
  // Base currency (ERPNext-computed)
  "base_grand_total", "base_net_total", "base_total_taxes_and_charges",
  "base_rounding_adjustment", "base_rounded_total", "base_in_words",
  "total_net_weight", "rounding_adjustment",
  "base_paid_amount", "paid_amount", "base_change_amount", "change_amount",
  "base_write_off_amount", "total_advance",
  // Accounting
  "unrealized_profit_loss_account", "against_income_account",
  // Child tables
  "items", "taxes", "payments",
]

export interface PartyDetailsResponse {
  customer: string
  customer_name: string
  customer_group?: string
  territory?: string
  language?: string
  tax_id?: string
  customer_address?: string
  address_display?: string
  shipping_address_name?: string
  shipping_address?: string
  contact_person?: string
  contact_display?: string
  contact_email?: string
  contact_mobile?: string
  contact_phone?: string
  contact_designation?: string
  contact_department?: string
  company_address?: string
  company_address_display?: string
  tax_category?: string
  payment_terms_template?: string
  selling_price_list?: string
  price_list_currency?: string
  currency?: string
  due_date?: string
  debit_to?: string
  taxes_and_charges?: string
  sales_team?: Array<{ sales_person: string; allocated_percentage?: number; commission_rate?: number }>
}

export const invoiceService = {
  lookups: {
    async addresses(customerName: string): Promise<DocTypeOption[]> {
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["name", "address_title", "address_line1", "city", "address_type"]))
      qp.set("filters", JSON.stringify([["Dynamic Link", "link_doctype", "=", "Customer"], ["Dynamic Link", "link_name", "=", customerName]]))
      qp.set("limit_page_length", "50")
      return apiClient<DocTypeOption[]>(`/resource/Address?${qp.toString()}`)
    },
    async contacts(customerName: string): Promise<DocTypeOption[]> {
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["name", "full_name", "email_id", "mobile_no"]))
      qp.set("filters", JSON.stringify([["Dynamic Link", "link_doctype", "=", "Customer"], ["Dynamic Link", "link_name", "=", customerName]]))
      qp.set("limit_page_length", "50")
      return apiClient<DocTypeOption[]>(`/resource/Contact?${qp.toString()}`)
    },
    paymentTermsTemplates: (): Promise<string[]> => fetchOptions("Payment Terms Template"),
    taxCategories: (): Promise<string[]> => fetchOptions("Tax Category"),
    taxesAndChargesTemplates: (): Promise<string[]> => fetchOptions("Sales Taxes and Charges Template"),
    couponCodes: (): Promise<string[]> => fetchOptions("Coupon Code"),
    accounts: async (): Promise<string[]> => {
      const company = await getCompany()
      return fetchOptions("Account", [["is_group", "=", 0], ["company", "=", company]])
    },
    taxAccounts: async (): Promise<AccountInfo[]> => {
      const company = await getCompany()
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["name", "account_name", "account_type", "tax_rate"]))
      qp.set("filters", JSON.stringify([
        ["is_group", "=", 0],
        ["company", "=", company],
        ["disabled", "=", 0],
        ["account_type", "in", ["Tax", "Chargeable", "Expense Account"]],
      ]))
      qp.set("limit_page_length", "500")
      return apiClient<AccountInfo[]>(`/resource/Account?${qp.toString()}`)
    },
    costCenters: (): Promise<string[]> => fetchOptions("Cost Center"),
    terms: (): Promise<string[]> => fetchOptions("Terms and Conditions"),
    letterHeads: (): Promise<string[]> => fetchOptions("Letter Head"),
    salesPartners: (): Promise<string[]> => fetchOptions("Sales Partner"),
    salesPersons: (): Promise<string[]> => fetchOptions("Sales Person"),
    loyaltyPrograms: (): Promise<string[]> => fetchOptions("Loyalty Program"),
    printHeadings: (): Promise<string[]> => fetchOptions("Print Heading"),
    itemTaxTemplates: (): Promise<string[]> => fetchOptions("Item Tax Template"),
    shippingRules: (): Promise<string[]> => fetchOptions("Shipping Rule"),
    incoterms: (): Promise<string[]> => fetchOptions("Incoterm"),
    taxWithholdingGroups: (): Promise<string[]> => fetchOptions("Tax Withholding Category"),
    modeOfPayments: (): Promise<string[]> => fetchOptions("Mode of Payment"),
    warehouses: async (): Promise<string[]> => {
      const company = await getCompany()
      return fetchOptions("Warehouse", [["is_group", "=", 0], ["company", "=", company]])
    },
    companies: (): Promise<string[]> => fetchOptions("Company"),
    territories: (): Promise<string[]> => fetchOptions("Territory"),
    campaigns: (): Promise<string[]> => fetchOptions("Campaign"),
    sources: (): Promise<string[]> => fetchOptions("Lead Source"),
    projects: (): Promise<string[]> => fetchOptions("Project"),
  },

  async searchItems(query: string, start = 0, pageLength = 10): Promise<{
    items: Array<{ value: string; label: string; description: string }>
  }> {
    const qp = new URLSearchParams()
    qp.set("txt", query || "")
    qp.set("doctype", "Item")
    qp.set("reference_doctype", "Sales Invoice")
    qp.set("link_fieldname", "item_code")
    qp.set("start", String(start))
    qp.set("page_length", String(pageLength))
    try {
      const result = await apiClient<Array<{ value: string; label: string; description: string }>>(
        `/method/frappe.desk.search.search_link?${qp.toString()}`
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  async getItemDetails(itemCode: string): Promise<Record<string, unknown> | null> {
    try {
      return await apiClient<Record<string, unknown>>(`/resource/Item/${encodeURIComponent(itemCode)}`)
    } catch {
      return null
    }
  },

  async getTaxRate(accountHead: string): Promise<{ tax_rate: number; account_name: string }> {
    try {
      return await apiClient<{ tax_rate: number; account_name: string }>(
        `/method/erpnext.controllers.accounts_controller.get_tax_rate?account_head=${encodeURIComponent(accountHead)}`
      )
    } catch {
      return { tax_rate: 0, account_name: accountHead }
    }
  },

  async getDefaultTaxTemplate(): Promise<TaxTemplateResult | null> {
    return sharedGetDefault(SALES_DOCTYPE)
  },

  async getTaxTemplateDetails(name: string): Promise<TaxTemplateResult | null> {
    return sharedGetDetails(SALES_DOCTYPE, name)
  },
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
    status?: string
    customerId?: string
    postingDateFrom?: string
    postingDateTo?: string
  }): Promise<SalesInvoiceListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    const filters: unknown[] = []

    if (params.search) {
      filters.push(["customer_name", "like", `%${params.search}%`])
    }
    if (params.customerId) {
      filters.push(["customer", "=", params.customerId])
    }
    if (params.status && params.status !== "all") {
      const statusMap: Record<string, string> = {
        paid: "Paid",
        unpaid: "Unpaid",
        overdue: "Overdue",
        draft: "Draft",
        cancelled: "Cancelled",
        submitted: "Submitted",
      }
      const mapped = statusMap[params.status.toLowerCase()] || params.status
      filters.push(["status", "=", mapped])
    }
    if (params.postingDateFrom) {
      filters.push(["posting_date", ">=", params.postingDateFrom])
    }
    if (params.postingDateTo) {
      filters.push(["posting_date", "<=", params.postingDateTo])
    }

    const [rows, total] = await Promise.all([
      apiClient<SalesInvoice[]>(
        buildListUrl("Sales Invoice", {
          fields: LIST_FIELDS,
          filters: filters.length > 0 ? filters : undefined,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "posting_date desc",
        })
      ),
      getCount("Sales Invoice", filters.length > 0 ? filters : undefined),
    ])

    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getById(name: string): Promise<SalesInvoice> {
    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify(DETAIL_FIELDS))
    return apiClient<SalesInvoice>(`/resource/Sales Invoice/${encodeURIComponent(name)}?${qp.toString()}`)
  },

  async create(data: SalesInvoiceFormData): Promise<SalesInvoice> {
    return apiClient<SalesInvoice>("/resource/Sales Invoice", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        update_stock: data.update_stock ? 1 : 0,
      }),
    })
  },

  async update(name: string, data: Partial<SalesInvoiceFormData>): Promise<SalesInvoice> {
    return apiClient<SalesInvoice>(`/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({
        ...data,
        update_stock: data.update_stock !== undefined ? (data.update_stock ? 1 : 0) : undefined,
      }),
    })
  },

  async submit(name: string): Promise<SalesInvoice> {
    return apiClient<SalesInvoice>(`/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ docstatus: 1 }),
    })
  },

  async cancel(name: string): Promise<void> {
    return apiClient<void>("/method/frappe.client.cancel", {
      method: "POST",
      body: JSON.stringify({ doctype: "Sales Invoice", name }),
    })
  },

  async amend(name: string): Promise<SalesInvoice> {
    // ERPNext amend flow: GET cancelled doc → clean framework fields → POST with amended_from
    const doc = await apiClient<Record<string, unknown>>(
      `/resource/Sales Invoice/${encodeURIComponent(name)}`
    )

    const managedFields = new Set([
      "name", "creation", "modified", "modified_by", "owner",
      "docstatus", "idx", "_comments", "_assign", "_liked_by",
    ])
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(doc)) {
      if (managedFields.has(k)) continue
      if (Array.isArray(v)) {
        cleaned[k] = v.map((row: Record<string, unknown>) => {
          if (row && typeof row === "object") {
            const { name: _n, creation: _c, modified: _m, owner: _o, ...rest } = row as Record<string, unknown>
            return rest
          }
          return row
        })
      } else {
        cleaned[k] = v
      }
    }

    cleaned.amended_from = name
    cleaned.docstatus = 0

    return apiClient<SalesInvoice>("/resource/Sales Invoice", {
      method: "POST",
      body: JSON.stringify(cleaned),
    })
  },

  async delete(name: string): Promise<void> {
    return apiClient<void>(`/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: "DELETE",
    })
  },

  async getPartyDetails(party: string, company: string, postingDate: string): Promise<PartyDetailsResponse> {
    return apiClient<PartyDetailsResponse>("/method/erpnext.accounts.party.get_party_details", {
      method: "POST",
      body: JSON.stringify({
        party,
        party_type: "Customer",
        company,
        posting_date: postingDate,
        doctype: "Sales Invoice",
      }),
    })
  },

  async getExchangeRate(fromCurrency: string, toCurrency: string, date: string): Promise<number> {
    try {
      const result = await apiClient<number>("/method/erpnext.setup.utils.get_exchange_rate", {
        method: "POST",
        body: JSON.stringify({
          from_currency: fromCurrency,
          to_currency: toCurrency,
          transaction_date: date,
        }),
      })
      return typeof result === "number" ? result : parseFloat(String(result)) || 0
    } catch {
      return 0
    }
  },

  async getDueDate(postingDate: string, party: string, company: string, templateName?: string): Promise<string | null> {
    try {
      return await apiClient<string>("/method/erpnext.accounts.party.get_due_date", {
        method: "POST",
        body: JSON.stringify({
          posting_date: postingDate,
          party_type: "Customer",
          party,
          company,
          ...(templateName ? { template_name: templateName } : {}),
        }),
      })
    } catch {
      return null
    }
  },

  async getPrintFormats(): Promise<string[]> {
    try {
      const raw = await apiClient<Array<{ name: string }>>(
        `/resource/Print Format?filters=${JSON.stringify([["doc_type", "=", "Sales Invoice"], ["disabled", "=", 0]])}&fields=["name"]&limit_page_length=100`
      )
      return raw.map((f) => f.name)
    } catch {
      return ["Standard"]
    }
  },

  async generatePDF(name: string, options?: {
    printFormat?: string
    letterHead?: string
    noLetterhead?: boolean
    language?: string
  }): Promise<Blob> {
    const params = new URLSearchParams()
    params.set("doctype", "Sales Invoice")
    params.set("name", name)
    if (options?.printFormat) params.set("format", options.printFormat)
    if (options?.letterHead) params.set("letterhead", options.letterHead)
    if (options?.noLetterhead) params.set("no_letterhead", "1")
    if (options?.language) params.set("_lang", options.language)

    const res = await fetch(`${API_CONFIG.baseUrl}/method/frappe.utils.print_format.download_pdf?${params.toString()}`, {
      credentials: "include",
      headers: API_CONFIG.headers,
    })

    if (!res.ok) {
      throw new Error("Failed to generate PDF")
    }

    return res.blob()
  },

  async sendEmail(name: string, data: {
    recipients: string
    subject: string
    content: string
    printFormat?: string
  }): Promise<{ name: string }> {
    return apiClient<{ name: string }>("/method/frappe.core.doctype.communication.email.make", {
      method: "POST",
      body: JSON.stringify({
        doctype: "Sales Invoice",
        name,
        recipients: data.recipients,
        subject: data.subject,
        content: data.content,
        communication_medium: "Email",
        send_email: 1,
        print_format: data.printFormat || "Standard",
      }),
    })
  },
}

// ---------------------------------------------------------------------------
// Tax computation utilities
// ---------------------------------------------------------------------------

/** Convert TaxRow[] from a template into EditableTaxRow[] for the form. */
export function templateRowsToEditable(rows: TaxRow[]): EditableTaxRow[] {
  return rows.map((r) => ({
    charge_type: (r.chargeType || "On Net Total") as EditableTaxRow["charge_type"],
    account_head: r.accountHead,
    description: r.description ?? "",
    rate: Math.round(r.rate * 100 * 1000) / 1000,
    tax_amount: 0,
    net_amount: 0,
    total: 0,
    included_in_print_rate: !!r.includedInPrintRate,
    row_id: undefined,
  }))
}

/** Convert ERPNext invoice taxes[] into EditableTaxRow[] for editing an existing invoice. */
export function invoiceTaxesToEditable(taxes: SalesInvoiceTax[]): EditableTaxRow[] {
  return taxes.map((t) => ({
    charge_type: (t.charge_type || "On Net Total") as EditableTaxRow["charge_type"],
    account_head: t.account_head,
    description: t.description ?? "",
    rate: t.rate,
    tax_amount: t.tax_amount ?? 0,
    net_amount: 0,
    total: t.total ?? 0,
    included_in_print_rate: !!t.included_in_print_rate,
    row_id: undefined,
  }))
}

/** Compute tax amounts from editable rows — mirrors ERPNext server-side logic. */
export function computeTaxes(rows: EditableTaxRow[], subtotal: number, totalQty: number): EditableTaxRow[] {
  let runningTotal = subtotal
  return rows.map((row, i) => {
    let taxAmount = 0
    let netAmount = subtotal

    switch (row.charge_type) {
      case "Actual":
        taxAmount = row.tax_amount
        break
      case "On Net Total":
        taxAmount = Math.round(subtotal * (row.rate / 100) * 100) / 100
        break
      case "On Previous Row Amount": {
        const refIdx = (row.row_id ?? (i > 0 ? i : 1)) - 1
        const refRow = rows[refIdx]
        if (refRow) {
          taxAmount = Math.round(refRow.tax_amount * (row.rate / 100) * 100) / 100
          netAmount = refRow.tax_amount
        }
        break
      }
      case "On Previous Row Total": {
        const refIdx = (row.row_id ?? (i > 0 ? i : 1)) - 1
        const refRow = rows[refIdx]
        if (refRow) {
          taxAmount = Math.round(refRow.total * (row.rate / 100) * 100) / 100
          netAmount = refRow.total
        }
        break
      }
      case "On Item Quantity":
        taxAmount = Math.round(row.rate * totalQty * 100) / 100
        netAmount = totalQty
        break
    }

    runningTotal += taxAmount
    return {
      ...row,
      tax_amount: taxAmount,
      net_amount: netAmount,
      total: Math.round(runningTotal * 100) / 100,
    }
  })
}

/** Create a blank tax row with sensible defaults. */
export function createEmptyTaxRow(): EditableTaxRow {
  return {
    charge_type: "On Net Total",
    account_head: "",
    description: "",
    rate: 0,
    tax_amount: 0,
    net_amount: 0,
    total: 0,
    included_in_print_rate: false,
    row_id: undefined,
  }
}